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
  
  // For now, use the existing pushSpecificFiles functionality
  // This is a simplified implementation that delegates to the existing push service
  const { pushSpecificFiles } = await import('../scripts/pushSpecificFiles.js');
  
  // Create a temporary directory with the migration files and test files
  const tempDir = path.join(process.cwd(), 'temp', `migration-${Date.now()}`);
  await fs.mkdir(tempDir, { recursive: true });
  
  try {
    // Write changed files (migrated code)
    const filesList: string[] = [];
    for (const [filePath, content] of Object.entries(changes)) {
      const fullPath = path.join(tempDir, filePath);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, content, 'utf-8');
      filesList.push(filePath);
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
          const fullTestPath = path.join(tempDir, testFilePath);
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
    
    // Use the existing pushSpecificFiles to push to GitHub
    await pushSpecificFiles(
      repository.url,
      branchName,
      commitMessage,
      tempDir,
      filesList,
      accessToken
    );
  } finally {
    // Cleanup temp directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.error('Failed to cleanup temp directory:', error);
    }
  }
}
