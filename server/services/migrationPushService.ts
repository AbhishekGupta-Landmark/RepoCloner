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

export async function pushMigrationChanges(params: PushMigrationChangesParams): Promise<void> {
  const { repository, branchName, changes, storage, accessToken, commitMessage } = params;
  
  // Import the GitHub pusher class
  const { GitHubPusher } = await import('../scripts/pushSpecificFiles.js');
  
  // Extract owner and repo name from repository URL
  const urlMatch = repository.url.match(/github\.com[/:]([^/]+)\/([^/.]+)/);
  if (!urlMatch) {
    throw new Error(`Invalid GitHub repository URL: ${repository.url}`);
  }
  const [, owner, repoName] = urlMatch;
  
  try {
    // Write changed files to repository directory (migrated code)
    const filesList: string[] = [];
    for (const [filePath, content] of Object.entries(changes)) {
      const fullPath = path.join(repository.localPath, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      filesList.push(filePath);
      console.log(`✅ Updated file: ${filePath}`);
    }
    
    // Get test coverage report to extract generated test files
    const reports = await storage.getAnalysisReportsByRepository(repository.id);
    const testCoverageReport = reports.find(r => r.analysisType === 'test-coverage');
    
    if (testCoverageReport?.structuredData?.fileReports) {
      console.log('📝 Extracting generated test files from test coverage report...');
      
      const fileReports = testCoverageReport.structuredData.fileReports;
      
      for (const fileReport of fileReports) {
        if (fileReport.generatedTests && fileReport.testFile) {
          // Determine test file path
          let testFilePath = fileReport.testFile;
          
          // If testFile is "None" or doesn't exist, generate a test file name
          if (testFilePath === 'None' || !testFilePath) {
            const sourceFile = fileReport.file;
            const baseName = path.basename(sourceFile, path.extname(sourceFile));
            const sourceDir = path.dirname(sourceFile);
            testFilePath = path.join(sourceDir, `${baseName}Tests${path.extname(sourceFile)}`);
          }
          
          // Write the generated test file
          const fullTestPath = path.join(repository.localPath, testFilePath);
          await fs.mkdir(path.dirname(fullTestPath), { recursive: true });
          await fs.writeFile(fullTestPath, fileReport.generatedTests, 'utf-8');
          filesList.push(testFilePath);
          
          console.log(`✅ Added test file: ${testFilePath}`);
        }
      }
      
      console.log(`📦 Total files to push: ${filesList.length}`);
    } else {
      console.warn('⚠️ No test coverage report found, pushing migration changes only');
    }
    
    // Use GitHubPusher to push the specific files
    const pusher = new GitHubPusher(accessToken, owner, repoName);
    await pusher.pushSpecificFiles(branchName, commitMessage, filesList);
    
    console.log(`🎉 Successfully pushed ${filesList.length} files to branch: ${branchName}`);
  } catch (error) {
    console.error('Failed to push migration changes:', error);
    throw error;
  }
}
