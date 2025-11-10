import { Repository } from "@shared/schema";
import path from 'path';
import fs from 'fs/promises';
import type { IStorage } from '../storage';

interface PushMigrationChangesParams {
  repository: Repository;
  branchName: string;
  changes: Record<string, string>;
  oldCoverage: any;
  newCoverage: any;
  accessToken: string;
  commitMessage: string;
  storage: IStorage;
}

async function findSlnFiles(repoPath: string): Promise<string[]> {
  const slnFiles: string[] = [];
  
  async function scanDir(dir: string) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!entry.name.startsWith('.') && entry.name !== 'node_modules') {
          await scanDir(fullPath);
        }
      } else if (entry.name.endsWith('.sln')) {
        slnFiles.push(fullPath);
      }
    }
  }
  
  await scanDir(repoPath);
  return slnFiles;
}

export async function pushMigrationChanges(params: PushMigrationChangesParams): Promise<{ prUrl?: string }> {
  const { repository, branchName, changes, storage, accessToken, commitMessage } = params;
  
  // Use clonedUrl if available (for forked repos), otherwise use url
  const targetUrl = (repository.clonedUrl && repository.clonedUrl.trim() !== '') 
    ? repository.clonedUrl 
    : repository.url;
  console.log(`🎯 Pushing to: ${targetUrl}${repository.clonedUrl ? ' (personal fork)' : ' (original repo)'}`);
  
  // Detect provider (GitHub or GitLab)
  const isGitHub = targetUrl.includes('github.com');
  const isGitLab = targetUrl.includes('gitlab.com');
  
  if (!isGitHub && !isGitLab) {
    throw new Error(`Unsupported Git provider. Only GitHub and GitLab are supported. URL: ${targetUrl}`);
  }
  
  let owner: string = '';
  let repoName: string = '';
  let projectPath: string = '';
  
  if (isGitHub) {
    const urlMatch = targetUrl.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
    if (!urlMatch) {
      throw new Error(`Invalid GitHub repository URL: ${targetUrl}`);
    }
    [, owner, repoName] = urlMatch;
    console.log(`📍 Detected GitHub: ${owner}/${repoName}`);
  } else {
    const urlMatch = targetUrl.match(/gitlab\.com[/:]([^/]+\/[^/.]+)/);
    if (!urlMatch) {
      throw new Error(`Invalid GitLab repository URL: ${targetUrl}`);
    }
    projectPath = urlMatch[1];
    console.log(`📍 Detected GitLab: ${projectPath}`);
  }
  
  try {
    // Write changed files to repository directory (migrated code)
    const filesList: string[] = [];
    if (!repository.localPath) {
      throw new Error('Repository local path is not set');
    }
    for (const [filePath, content] of Object.entries(changes)) {
      const fullPath = path.join(repository.localPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      
      // CRITICAL FIX: Write file in binary mode to preserve exact line endings
      // The content already has the correct line endings from the Python script
      // Using 'utf-8' encoding would normalize line endings on Linux to LF
      await fs.writeFile(fullPath, Buffer.from(content, 'utf-8'));
      
      filesList.push(filePath);
      console.log(`✅ Updated file: ${filePath}`);
    }
    
    // Get test coverage report to extract generated test files
    const reports = await storage.getAnalysisReportsByRepository(repository.id);
    const testCoverageReport = reports.find(r => r.analysisType === 'test-coverage');
    
    if (testCoverageReport?.structuredData && typeof testCoverageReport.structuredData === 'object' && 'fileReports' in testCoverageReport.structuredData) {
      console.log('📝 Extracting generated test files from test coverage report...');
      
      const fileReports = (testCoverageReport.structuredData as any).fileReports;
      
      // Detect existing test folder structure
      let testFolder = 'Test'; // Default
      try {
        const repoContents = await fs.readdir(repository.localPath!, { withFileTypes: true });
        const testDirs = repoContents.filter(entry => 
          entry.isDirectory() && 
          (entry.name.toLowerCase() === 'test' || 
           entry.name.toLowerCase() === 'tests' ||
           entry.name.toLowerCase().endsWith('.tests') ||
           entry.name.toLowerCase().endsWith('tests'))
        );
        if (testDirs.length > 0) {
          testFolder = testDirs[0].name;
          console.log(`🔍 Detected test folder: ${testFolder}`);
        }
      } catch (err) {
        console.log('⚠️ Could not detect test folder, using default: Test');
      }
      
      for (const fileReport of fileReports) {
        if (fileReport.generatedTests) {
          // ALWAYS place test files in the detected test folder (Test/, Tests/, etc.)
          // Ignore the testFile path from the report as it may point to wrong location
          const sourceFile = fileReport.file;
          const baseName = path.basename(sourceFile, path.extname(sourceFile));
          const testFilePath = path.join(testFolder, `${baseName}Tests${path.extname(sourceFile)}`);
          
          // Write the generated test file
          const fullTestPath = path.join(repository.localPath!, testFilePath);
          await fs.mkdir(path.dirname(fullTestPath), { recursive: true });
          
          // CRITICAL FIX: Write in binary mode to preserve line endings from generated tests
          await fs.writeFile(fullTestPath, Buffer.from(fileReport.generatedTests, 'utf-8'));
          
          // CRITICAL: Normalize path to forward slashes for Git compatibility
          const normalizedPath = testFilePath.replace(/\\/g, '/');
          filesList.push(normalizedPath);
          
          console.log(`✅ Added test file: ${normalizedPath}`);
        }
      }
      
      console.log(`📦 Total files to push: ${filesList.length}`);
    } else {
      console.warn('⚠️ No test coverage report found, pushing migration changes only');
    }
    
    // Include appropriate CI/CD workflow file based on provider
    let workflowFilePath: string;
    let workflowSourcePath: string;
    let workflowDestPath: string;
    
    if (isGitHub) {
      workflowFilePath = '.github/workflows/dotnet-tests.yml';
      workflowSourcePath = path.join(process.cwd(), workflowFilePath);
      workflowDestPath = path.join(repository.localPath!, workflowFilePath);
      
      try {
        await fs.access(workflowSourcePath);
        await fs.mkdir(path.dirname(workflowDestPath), { recursive: true });
        await fs.copyFile(workflowSourcePath, workflowDestPath);
        filesList.push(workflowFilePath);
        console.log(`✅ Added GitHub Actions workflow: ${workflowFilePath}`);
      } catch (err) {
        console.warn(`⚠️ Could not add GitHub Actions workflow: ${err}`);
      }
    } else if (isGitLab) {
      workflowFilePath = '.gitlab-ci.yml';
      workflowSourcePath = path.join(process.cwd(), workflowFilePath);
      workflowDestPath = path.join(repository.localPath!, workflowFilePath);
      
      try {
        await fs.access(workflowSourcePath);
        await fs.copyFile(workflowSourcePath, workflowDestPath);
        filesList.push(workflowFilePath);
        console.log(`✅ Added GitLab CI configuration: ${workflowFilePath}`);
      } catch (err) {
        console.warn(`⚠️ Could not add GitLab CI configuration: ${err}`);
      }
    }
    
    // Use appropriate pusher based on provider
    let prUrl: string | undefined;
    
    if (isGitHub) {
      const { GitHubPusher } = await import('../scripts/pushSpecificFiles.js');
      const pusher = new GitHubPusher(accessToken, owner, repoName);
      await pusher.pushSpecificFiles(branchName, commitMessage, filesList, repository.localPath!);
      
      console.log(`🎉 Successfully pushed ${filesList.length} files to GitHub branch: ${branchName}`);
      
      // Create draft PR
      try {
        const prTitle = `🤖 AI Migration: ${branchName}`;
        const prBody = `# AI-Generated Migration Changes

${commitMessage}

## Summary
- **Files Changed**: ${filesList.length}
- **Branch**: \`${branchName}\`

## Changes Include:
- Migrated code (Kafka → Azure Service Bus)
- Generated test files with improved coverage

---
*This is a draft pull request. Review the changes and mark as ready when satisfied.*`;

        prUrl = await pusher.createDraftPR(branchName, prTitle, prBody);
        console.log(`✅ Draft PR created: ${prUrl}`);
      } catch (prError) {
        console.warn(`⚠️ Failed to create draft PR (push succeeded): ${prError}`);
      }
      
      // Mark report as pushed
      try {
        const reports = await storage.getAnalysisReportsByRepository(repository.id!);
        if (reports.length > 0) {
          const latestReport = reports[reports.length - 1];
          await storage.updateAnalysisReport(latestReport.id!, {
            wasPushed: true,
            lastPushAt: new Date()
          });
          console.log(`✅ Marked report ${latestReport.id} as pushed`);
        }
      } catch (updateError) {
        console.warn(`⚠️ Failed to update report push status: ${updateError}`);
      }
    } else {
      const { GitLabPusher } = await import('../scripts/pushSpecificFilesGitLab.js');
      const pusher = new GitLabPusher(accessToken, projectPath);
      await pusher.pushSpecificFiles(branchName, commitMessage, filesList, repository.localPath!);
      
      console.log(`🎉 Successfully pushed ${filesList.length} files to GitLab branch: ${branchName}`);
      
      // Create draft MR
      try {
        const mrTitle = `🤖 AI Migration: ${branchName}`;
        const mrBody = `# AI-Generated Migration Changes

${commitMessage}

## Summary
- **Files Changed**: ${filesList.length}
- **Branch**: \`${branchName}\`

## Changes Include:
- Migrated code (Kafka → Azure Service Bus)
- Generated test files with improved coverage

---
*This is a draft merge request. Review the changes and mark as ready when satisfied.*`;

        prUrl = await pusher.createDraftMR(branchName, mrTitle, mrBody);
        console.log(`✅ Draft MR created: ${prUrl}`);
      } catch (mrError) {
        console.warn(`⚠️ Failed to create draft MR (push succeeded): ${mrError}`);
      }
    }
    
    return { prUrl };
  } catch (error) {
    console.error('Failed to push migration changes:', error);
    throw error;
  }
}
