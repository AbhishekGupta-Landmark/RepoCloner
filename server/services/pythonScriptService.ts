import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { broadcastLog } from '../utils/logger';
import { findReadmePath, getReadmeContent, validateReadmePath } from '../utils/readmeResolver';
import { findMigrationReport, validateMigrationReport } from './migrationReportFinder';
import { GeneratedFile, PythonScriptResult, MigrationReportData } from '@shared/schema';

const execAsync = promisify(exec);
const execFileAsync = promisify(execFile);

export interface PythonExecutionResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  generatedFiles?: GeneratedFile[];
  executionStartTime?: number;
  executionEndTime?: number;
}

export interface PythonExecutionOptions {
  scriptPath?: string;
  scriptContent?: string;
  workingDirectory?: string;
  args?: string[];
  timeout?: number; // in milliseconds
}

export class PythonScriptService {
  private defaultTimeout = 600000; // 10 minutes default timeout

  /**
   * Execute a Python script with the provided options
   */
  async executePythonScript(options: PythonExecutionOptions): Promise<PythonExecutionResult> {
    broadcastLog('INFO', 'Starting Python script execution');
    
    try {
      let scriptToExecute: string;
      let tempScriptPath: string | null = null;

      // Determine script source
      if (options.scriptPath) {
        // Use provided script path
        if (!await this.fileExists(options.scriptPath)) {
          broadcastLog('ERROR', `Python script not found at path: ${options.scriptPath}`);
          return {
            success: false,
            error: `Python script not found at path: ${options.scriptPath}`
          };
        }
        scriptToExecute = options.scriptPath;
        broadcastLog('INFO', `Using Python script from file: ${options.scriptPath}`);
      } else if (options.scriptContent) {
        // Create temporary script from content
        tempScriptPath = await this.createTempScript(options.scriptContent);
        scriptToExecute = tempScriptPath;
        broadcastLog('INFO', 'Created temporary Python script from content');
      } else {
        // Use default script
        scriptToExecute = await this.getDefaultScript();
        broadcastLog('INFO', 'Using default Python script');
      }

      // Prepare execution arguments
      const pythonArgs = [scriptToExecute, ...(options.args || [])];
      
      // Set working directory
      const workingDir = options.workingDirectory || process.cwd();
      const timeout = options.timeout || this.defaultTimeout;

      // SECURITY: Mask sensitive arguments in logs
      const maskedPythonArgs = this.maskSensitiveArgs(pythonArgs);
      broadcastLog('INFO', `Executing Python script: python ${maskedPythonArgs.join(' ')}`);
      broadcastLog('INFO', `Working directory: ${workingDir}`);

      // Get file list before execution (for file tracking)
      const filesBeforeExecution = await this.getDirectoryFileList(workingDir);
      broadcastLog('INFO', `Files before execution: ${filesBeforeExecution.size} files in ${workingDir}`);
      const executionStartTime = Date.now();

      // Platform-specific Python interpreter detection with environment override
      let pythonCommand = process.env.PYTHON_CMD;
      if (pythonCommand) {
        broadcastLog('INFO', `🐍 Using Python interpreter from PYTHON_CMD env var: ${pythonCommand}`);
      } else {
        const isWindows = process.platform === 'win32';
        const pythonCommands = isWindows ? ['py', 'python', 'python3'] : ['python3', 'python', 'py'];
        pythonCommand = 'python'; // Fallback default

        broadcastLog('INFO', `🐍 Platform: ${process.platform}, trying commands: ${pythonCommands.join(', ')}`);
        
        for (const cmd of pythonCommands) {
          try {
            const { execSync } = require('child_process');
            execSync(`${cmd} --version`, { stdio: 'ignore' });
            pythonCommand = cmd;
            broadcastLog('INFO', `🐍 Found working Python interpreter: ${pythonCommand}`);
            break;
          } catch (error) {
            broadcastLog('INFO', `🐍 Command '${cmd}' failed, trying next...`);
            continue;
          }
        }
      }

      broadcastLog('INFO', `🐍 Selected Python interpreter: ${pythonCommand}`);
      
      // Execute the Python script with fallback retry logic
      let result = await this.runPythonCommandWithFallback(pythonCommand, pythonArgs, workingDir, timeout);
      
      const executionEndTime = Date.now();

      // Track generated files if execution was successful
      if (result.success) {
        broadcastLog('INFO', `Script execution successful, checking for generated files...`);
        const generatedFiles = await this.identifyGeneratedFiles(filesBeforeExecution, workingDir);
        result.generatedFiles = generatedFiles;
        result.executionStartTime = executionStartTime;
        result.executionEndTime = executionEndTime;

        if (generatedFiles.length > 0) {
          broadcastLog('INFO', `Python script generated ${generatedFiles.length} files`);
        } else {
          broadcastLog('INFO', `No new files detected after Python script execution`);
        }
      }

      // Clean up temporary script if created
      if (tempScriptPath) {
        await this.cleanupTempScript(tempScriptPath);
      }

      if (result.success) {
        broadcastLog('INFO', 'Python script execution completed successfully');
        if (result.output) {
          broadcastLog('INFO', `Python script output: ${result.output.substring(0, 500)}...`);
        }
      } else {
        broadcastLog('ERROR', `Python script execution failed: ${result.error}`);
      }

      return result;

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      broadcastLog('ERROR', `Python script service error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Execute Python script after repository cloning
   */
  async executePostCloneScript(repositoryPath: string, repositoryUrl: string, repositoryId?: string, aiSettings?: any): Promise<PythonExecutionResult> {
    broadcastLog('INFO', `🔄 Starting Python script execution for migration analysis...`);
    console.log(`🔄 Starting Python script execution for migration analysis...`);
    broadcastLog('INFO', `Executing post-clone Python script for repository: ${repositoryUrl}`);
    
    // First try to use the default.py script from scripts folder
    const defaultScriptPath = path.join(process.cwd(), 'scripts', 'default.py');
    
    if (await this.fileExists(defaultScriptPath)) {
      broadcastLog('INFO', `Using Python script from scripts folder: ${defaultScriptPath}`);
      
      // Build command arguments including AI settings
      let scriptArgs = [repositoryUrl, repositoryPath];
      
      // Add AI settings as command-line arguments if available
      broadcastLog('DEBUG', `AI settings debug: exists=${!!aiSettings}, hasApiKey=${!!aiSettings?.apiKey}, hasModel=${!!aiSettings?.model}`);
      broadcastLog('DEBUG', `AI settings (masked): ${JSON.stringify({ ...aiSettings, apiKey: '***' })}`);
      broadcastLog('DEBUG', `AI settings keys: ${aiSettings ? Object.keys(aiSettings).join(', ') : 'null'}`);
      
      if (aiSettings && aiSettings.apiKey && aiSettings.model) {
        broadcastLog('INFO', 'Passing AI settings to Python script');
        scriptArgs.push(
          '--api-key', aiSettings.apiKey,
          '--model', aiSettings.model
        );
        
        if (aiSettings.apiEndpointUrl) {
          // Fix: Remove api-version query parameter from URL if it exists, since we pass it separately
          let cleanUrl = aiSettings.apiEndpointUrl;
          if (cleanUrl.includes('?api-version=')) {
            cleanUrl = cleanUrl.split('?api-version=')[0];
            broadcastLog('INFO', `🔧 Cleaned URL by removing embedded api-version parameter`);
          }
          scriptArgs.push('--base-url', cleanUrl);
        }
        
        if (aiSettings.apiVersion) {
          // Handle API versions with spaces by quoting them
          scriptArgs.push('--api-version', aiSettings.apiVersion);
        }
        
        // SECURITY: Properly mask sensitive arguments
        const maskedArgs = this.maskSensitiveArgs(scriptArgs);
        broadcastLog('INFO', `Final script command: python ${defaultScriptPath} ${maskedArgs.join(' ')}`);
      } else {
        broadcastLog('ERROR', 'AI settings are required for migration analysis');
        broadcastLog('DEBUG', `Condition failed: aiSettings=${!!aiSettings}, apiKey=${aiSettings?.apiKey}, model=${aiSettings?.model}`);
        return {
          success: false,
          error: 'AI configuration is required to perform migration analysis. Please configure AI settings first.',
          exitCode: -1
        };
      }
      
      broadcastLog('INFO', `🐍 About to execute Python script with ${scriptArgs.length} arguments`);
      broadcastLog('INFO', `🐍 Script path: ${defaultScriptPath}`);
      
      const result = await this.executePythonScript({
        scriptPath: defaultScriptPath,
        workingDirectory: repositoryPath,
        args: scriptArgs
      });
      
      // Use robust README resolver for MD file generation - pass report directory to script
      broadcastLog('INFO', `🔍 Using README resolver to find correct README file path`);
      const readmePath = findReadmePath(repositoryPath);
      const readmeValidation = validateReadmePath(readmePath);
      
      let reportDirectory = repositoryPath; // Default to repo root
      if (readmeValidation.isValid && readmePath) {
        reportDirectory = path.dirname(readmePath);
        broadcastLog('INFO', `✅ README resolver found valid file: ${readmePath} (${readmeValidation.size} bytes)`);
        broadcastLog('INFO', `📁 Setting report directory to: ${reportDirectory}`);
        
        // Pass report directory to Python script via environment variable
        if (process.env.REPORT_DIR !== reportDirectory) {
          process.env.REPORT_DIR = reportDirectory;
          broadcastLog('INFO', `🔧 Set REPORT_DIR environment variable: ${reportDirectory}`);
        }
      } else {
        broadcastLog('WARN', `⚠️  README resolver issue: ${readmeValidation.error || 'No README file found'}`);
        broadcastLog('INFO', `📁 Using default report directory: ${reportDirectory}`);
      }
      
      // DEBUGGING: Log expected MD file path and check what files actually exist
      const expectedMdPattern = `migration-report-*.md`;
      broadcastLog('INFO', `🐍 Expected MD file pattern: ${expectedMdPattern}`);
      broadcastLog('INFO', `🐍 Repository working directory: ${repositoryPath}`);
      
      // Check if any migration report files were actually created
      try {
        const fs = await import('fs');
        const files = await fs.promises.readdir(repositoryPath);
        const migrationReports = files.filter(file => file.startsWith('migration-report-') && file.endsWith('.md'));
        broadcastLog('INFO', `🐍 Found ${migrationReports.length} migration report files: ${migrationReports.join(', ')}`);
        if (migrationReports.length > 0) {
          migrationReports.forEach(file => {
            const fullPath = path.join(repositoryPath, file);
            broadcastLog('INFO', `🐍 MD file found at: ${fullPath}`);
          });
        } else {
          broadcastLog('WARN', `🐍 No migration report MD files found in ${repositoryPath}`);
          // List all files for debugging
          broadcastLog('DEBUG', `🐍 All files in directory: ${files.join(', ')}`);
        }
      } catch (error) {
        broadcastLog('ERROR', `🐍 Error checking for MD files: ${error}`);
      }
      
      broadcastLog('INFO', `🐍 Python script execution completed - Success: ${result.success}`);
      if (result.success) {
        broadcastLog('INFO', `🐍 Generated ${result.generatedFiles?.length || 0} files`);
        if (result.generatedFiles && result.generatedFiles.length > 0) {
          result.generatedFiles.forEach(file => {
            broadcastLog('INFO', `🐍 Generated file: ${file.relativePath} (${file.size} bytes)`);
          });
        }
      } else {
        broadcastLog('ERROR', `🐍 Script execution failed: ${result.error}`);
      }
      
      return result;
    } else {
      // Fallback to generated script content if default.py doesn't exist
      broadcastLog('INFO', 'default.py not found, using generated script content');
      const scriptContent = this.generatePostCloneScript(repositoryPath, repositoryUrl);
      
      // AI settings are required for migration analysis
      let scriptArgs = [repositoryUrl, repositoryPath];
      if (aiSettings && aiSettings.apiKey && aiSettings.model) {
        scriptArgs.push(
          '--api-key', aiSettings.apiKey,
          '--model', aiSettings.model
        );
        if (aiSettings.apiEndpointUrl) {
          scriptArgs.push('--base-url', aiSettings.apiEndpointUrl);
        }
        if (aiSettings.apiVersion) {
          scriptArgs.push('--api-version', aiSettings.apiVersion);
        }
      }

      return await this.executePythonScript({
        scriptContent,
        workingDirectory: repositoryPath,
        args: scriptArgs
      });
    }
  }

  /**
   * Check if Python is available on the system
   */
  async checkPythonAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    const commands = ['python3 --version', 'python --version', 'py --version'];
    
    for (const cmd of commands) {
      try {
        const { stdout, stderr } = await execAsync(cmd, { timeout: 5000 });
        const version = stdout || stderr; // Python version might be output to stderr
        
        broadcastLog('INFO', `Python detected using '${cmd.split(' ')[0]}': ${version.trim()}`);
        return {
          available: true,
          version: version.trim()
        };
      } catch (error) {
        continue; // Try next command
      }
    }
    
    const errorMessage = 'Python not found on system. Please install Python and ensure it is in your PATH.';
    broadcastLog('ERROR', errorMessage);
    return {
      available: false,
      error: errorMessage
    };
  }

  /**
   * Run Python command with fallback retry logic
   */
  private async runPythonCommandWithFallback(primaryCommand: string, args: string[], workingDir: string, timeout: number): Promise<PythonExecutionResult> {
    // Try the primary command first
    const result = await this.runPythonCommand(primaryCommand, args, workingDir, timeout);
    
    // If it failed with command not found, try fallback commands
    if (!result.success && (result.error?.includes('ENOENT') || result.error?.includes('command not found'))) {
      broadcastLog('WARN', `🐍 Primary command '${primaryCommand}' failed, trying fallbacks...`);
      const isWindows = process.platform === 'win32';
      const fallbackCommands = isWindows ? ['py', 'python', 'python3'] : ['python3', 'python', 'py'];
      
      for (const cmd of fallbackCommands) {
        if (cmd === primaryCommand) continue; // Skip already tried command
        
        broadcastLog('INFO', `🐍 Trying fallback command: ${cmd}`);
        const fallbackResult = await this.runPythonCommand(cmd, args, workingDir, timeout);
        
        if (fallbackResult.success) {
          broadcastLog('INFO', `🐍 Fallback command '${cmd}' succeeded!`);
          return fallbackResult;
        } else {
          broadcastLog('INFO', `🐍 Fallback command '${cmd}' also failed`);
        }
      }
      
      broadcastLog('ERROR', `🐍 All Python commands failed`);
    }
    
    return result;
  }

  /**
   * Run Python command with proper error handling and detailed logging
   */
  private async runPythonCommand(pythonCommand: string, args: string[], workingDir: string, timeout: number): Promise<PythonExecutionResult> {
    broadcastLog('INFO', `🐍 Starting Python execution with timeout: ${timeout}ms`);
    console.log(`🐍 Starting Python execution with timeout: ${timeout}ms`);
    broadcastLog('INFO', `🐍 Working directory: ${workingDir}`);
    console.log(`🐍 Working directory: ${workingDir}`);
    // SECURITY: Mask sensitive arguments in logs
    const maskedArgs = this.maskSensitiveArgs(args);
    broadcastLog('INFO', `🐍 Command arguments: [${maskedArgs.join(', ')}]`);
    console.log(`🐍 Command arguments: [${maskedArgs.join(', ')}]`);
    broadcastLog('INFO', `🐍 Using Python interpreter: ${pythonCommand}`);
    console.log(`🐍 Using Python interpreter: ${pythonCommand}`);
    
    try {
      const { stdout, stderr } = await execFileAsync(pythonCommand, args, {
        cwd: workingDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // Increased to 10MB buffer for large outputs
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // Force UTF-8 encoding
      });
      
      broadcastLog('INFO', `🐍 Python script executed successfully using '${pythonCommand}' command`);
      console.log(`🐍 Python script executed successfully using '${pythonCommand}' command`);
      broadcastLog('INFO', `🐍 Script stdout length: ${stdout.length} characters`);
      console.log(`🐍 Script stdout length: ${stdout.length} characters`);
      
      if (stdout.length > 0) {
        // Log first 1000 characters of output for debugging
        broadcastLog('INFO', `🐍 Script output preview: ${stdout.substring(0, 1000)}${stdout.length > 1000 ? '...' : ''}`);
        console.log(`🐍 Script output preview: ${stdout.substring(0, 500)}${stdout.length > 500 ? '...' : ''}`);
      }
      
      if (stderr && stderr.length > 0) {
        broadcastLog('WARN', `🐍 Script stderr: ${stderr.substring(0, 500)}${stderr.length > 500 ? '...' : ''}`);
      }
      
      return {
        success: true,
        output: stdout,
        error: stderr || undefined,
        exitCode: 0
      };
    } catch (error: any) {
      let errorMessage = 'Python execution failed';
      let exitCode = error.code || -1;
      
      broadcastLog('ERROR', `🐍 Python command '${pythonCommand}' failed with error code: ${error.code}, signal: ${error.signal}`);
      console.error(`🐍 Python command '${pythonCommand}' failed with error code: ${error.code}, signal: ${error.signal}`);
      
      if (error.signal === 'SIGTERM') {
        errorMessage = `Python script timed out after ${timeout}ms`;
        broadcastLog('ERROR', `🐍 TIMEOUT: Script execution exceeded ${timeout}ms limit`);
        console.error(`🐍 TIMEOUT: Script execution exceeded ${timeout}ms limit`);
      } else if (error.stderr) {
        errorMessage = error.stderr;
        broadcastLog('ERROR', `🐍 Script stderr: ${error.stderr.substring(0, 1000)}${error.stderr.length > 1000 ? '...' : ''}`);
        console.error(`🐍 Script stderr: ${error.stderr.substring(0, 500)}${error.stderr.length > 500 ? '...' : ''}`);
      } else if (error.message) {
        errorMessage = error.message;
        broadcastLog('ERROR', `🐍 Error message: ${error.message}`);
        console.error(`🐍 Error message: ${error.message}`);
      }
      
      if (error.stdout) {
        broadcastLog('ERROR', `🐍 Script stdout before failure: ${error.stdout.substring(0, 1000)}${error.stdout.length > 1000 ? '...' : ''}`);
        console.error(`🐍 Script stdout before failure: ${error.stdout.substring(0, 500)}${error.stdout.length > 500 ? '...' : ''}`);
      }
      
      return {
        success: false,
        error: errorMessage,
        exitCode
      };
    }
  }

  /**
   * Create a temporary script file
   */
  private async createTempScript(content: string): Promise<string> {
    const tempDir = path.join(process.cwd(), 'temp');
    await fs.promises.mkdir(tempDir, { recursive: true });
    
    const tempScriptPath = path.join(tempDir, `script_${Date.now()}.py`);
    // Add UTF-8 BOM and encoding declaration
    const scriptContent = '# -*- coding: utf-8 -*-\n' + content;
    await fs.promises.writeFile(tempScriptPath, scriptContent, 'utf8');
    
    return tempScriptPath;
  }

  /**
   * Clean up temporary script file
   */
  private async cleanupTempScript(scriptPath: string): Promise<void> {
    try {
      await fs.promises.unlink(scriptPath);
      broadcastLog('INFO', `Cleaned up temporary script: ${scriptPath}`);
    } catch (error) {
      broadcastLog('WARN', `Failed to clean up temporary script: ${scriptPath}`);
    }
  }

  /**
   * Check if file exists
   */
  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get default Python script content
   */
  private async getDefaultScript(): Promise<string> {
    const defaultScript = `
import os
import sys
import subprocess

def main():
    if len(sys.argv) < 3:
        print("Usage: script.py <repo_url> <repo_path>")
        return 1
    
    repo_url = sys.argv[1]
    repo_path = sys.argv[2]
    
    print(f"Processing repository: {repo_url}")
    print(f"Repository path: {repo_path}")
    
    # Basic placeholder analysis
    print("Basic analysis completed - no AI integration available")
    return 0

if __name__ == "__main__":
    exit(main())
`;
    return defaultScript;
  }

  /**
   * Generate post-clone script content
   */
  private generatePostCloneScript(repositoryPath: string, repositoryUrl: string): string {
    return `
import os
import sys
import json
from pathlib import Path

def analyze_repository():
    repo_path = "${repositoryPath}"
    repo_url = "${repositoryUrl}"
    
    print(f"Analyzing repository: {repo_url}")
    print(f"Path: {repo_path}")
    
    # Basic file analysis
    file_count = 0
    for root, dirs, files in os.walk(repo_path):
        if '.git' in dirs:
            dirs.remove('.git')  # Don't recurse into .git
        file_count += len(files)
    
    print(f"Total files: {file_count}")
    
    # Generate basic report
    report = {
        "repository_url": repo_url,
        "file_count": file_count,
        "analysis_type": "basic",
        "timestamp": "$(date)"
    }
    
    report_path = os.path.join(repo_path, "analysis-report.json")
    with open(report_path, 'w') as f:
        json.dump(report, f, indent=2)
    
    print(f"Report saved to: {report_path}")
    return 0

if __name__ == "__main__":
    exit(analyze_repository())
`;
  }

  /**
   * Mask sensitive arguments for logging
   */
  private maskSensitiveArgs(args: string[]): string[] {
    const maskedArgs = [...args];
    for (let i = 0; i < maskedArgs.length - 1; i++) {
      if (maskedArgs[i] === '--api-key' && i + 1 < maskedArgs.length) {
        maskedArgs[i + 1] = '***';
      }
    }
    return maskedArgs;
  }

  /**
   * Get list of files in directory for tracking
   */
  private async getDirectoryFileList(dirPath: string): Promise<Set<string>> {
    const files = new Set<string>();
    
    try {
      const walkDir = async (currentPath: string) => {
        const entries = await fs.promises.readdir(currentPath, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(currentPath, entry.name);
          const relativePath = path.relative(dirPath, fullPath);
          
          if (entry.isDirectory()) {
            // Skip .git directory
            if (entry.name !== '.git') {
              await walkDir(fullPath);
            }
          } else {
            files.add(relativePath);
          }
        }
      };
      
      await walkDir(dirPath);
    } catch (error) {
      broadcastLog('WARN', `Could not list directory files: ${error}`);
    }
    
    return files;
  }

  /**
   * Identify files that were generated after script execution
   */
  private async identifyGeneratedFiles(beforeFiles: Set<string>, workingDir: string): Promise<GeneratedFile[]> {
    const afterFiles = await this.getDirectoryFileList(workingDir);
    const generatedFiles: GeneratedFile[] = [];
    
    // Find new files
    for (const filePath of Array.from(afterFiles)) {
      if (!beforeFiles.has(filePath)) {
        try {
          const fullPath = path.join(workingDir, filePath);
          const stats = await fs.promises.stat(fullPath);
          
          generatedFiles.push({
            relativePath: filePath,
            size: stats.size,
            createdAt: stats.birthtime,
            modifiedAt: stats.mtime
          });
        } catch (error) {
          // File might have been deleted or moved, skip it
          continue;
        }
      }
    }
    
    return generatedFiles;
  }

  /**
   * Process migration report and parse structured data
   */
  async processMigrationReport(repositoryPath: string): Promise<PythonScriptResult> {
    try {
      const reportResult = await findMigrationReport(repositoryPath);
      
      if (!reportResult || !reportResult.success || !reportResult.reportPath) {
        return {
          success: false,
          error: `Migration report not found: ${reportResult?.error || 'Unknown error'}`
        };
      }

      const validation = await validateMigrationReport(reportResult.reportPath);
      if (!validation.isValid) {
        return {
          success: false,
          error: `Invalid migration report: ${validation.error}`,
          hasStructuredData: false
        };
      }

      // Extract structured data from report
      const reportContent = await fs.promises.readFile(reportResult.reportPath, 'utf8');
      const structuredData = await this.extractStructuredData(reportContent);

      return {
        success: true,
        reportPath: reportResult.reportPath,
        reportContent,
        structuredData,
        hasStructuredData: true
      };
    } catch (error) {
      return {
        success: false,
        error: `Failed to process migration report: ${error}`,
        hasStructuredData: false
      };
    }
  }

  /**
   * Extract structured data from migration report content
   */
  private async extractStructuredData(reportContent: string): Promise<MigrationReportData | null> {
    try {
      // Parse migration report sections using regex patterns
      const titleMatch = reportContent.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : 'Kafka to Azure Service Bus Migration Analysis';

      // Extract Kafka inventory
      const kafkaInventory: any[] = [];
      const inventoryRegex = /\*\*File:\*\* `([^`]+)`\s*\n\*\*APIs Used:\*\* `([^`]+)`\s*\n\*\*Summary:\*\* (.+?)(?=\n\n|\n\*\*File:\*\*|$)/gs;
      let inventoryMatch;
      while ((inventoryMatch = inventoryRegex.exec(reportContent)) !== null) {
        kafkaInventory.push({
          file: inventoryMatch[1],
          apis_used: inventoryMatch[2],
          summary: inventoryMatch[3].trim()
        });
      }

      // Extract code diffs
      const codeDiffs: any[] = [];
      const diffRegex = /```diff\n([\s\S]*?)\n```/g;
      let diffMatch;
      const fileHeaders: string[] = [];
      const fileHeaderRegex = /### `([^`]+)`/g;
      let headerMatch;
      while ((headerMatch = fileHeaderRegex.exec(reportContent)) !== null) {
        fileHeaders.push(headerMatch[1]);
      }

      let diffIndex = 0;
      while ((diffMatch = diffRegex.exec(reportContent)) !== null) {
        const diffContent = diffMatch[1];
        const fileName = fileHeaders[diffIndex] || `file_${diffIndex + 1}`;
        
        codeDiffs.push({
          file: fileName,
          diff_content: diffContent,
          language: this.inferLanguageFromFile(fileName),
          hunks: this.parseDiffHunks(diffContent),
          stats: this.calculateDiffStats(diffContent)
        });
        diffIndex++;
      }

      const structuredData: MigrationReportData = {
        title,
        kafka_inventory: kafkaInventory,
        code_diffs: codeDiffs,
        sections: {},
        stats: {
          total_files_with_kafka: kafkaInventory.length,
          total_files_with_diffs: codeDiffs.length,
          notes_count: 0,
          sections_count: Object.keys({}).length
        }
      };

      return structuredData;
    } catch (error) {
      broadcastLog('ERROR', `Failed to extract structured data: ${error}`);
      return null;
    }
  }

  private inferLanguageFromFile(fileName: string): string {
    const extension = path.extname(fileName).toLowerCase();
    const languageMap: Record<string, string> = {
      '.cs': 'csharp',
      '.js': 'javascript',
      '.ts': 'typescript',
      '.py': 'python',
      '.java': 'java',
      '.cpp': 'cpp',
      '.c': 'c',
      '.h': 'c',
      '.hpp': 'cpp'
    };
    return languageMap[extension] || 'text';
  }

  private parseDiffHunks(diffContent: string): any[] {
    const hunks: any[] = [];
    const hunkRegex = /@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/g;
    let hunkMatch;
    
    while ((hunkMatch = hunkRegex.exec(diffContent)) !== null) {
      hunks.push({
        oldStart: parseInt(hunkMatch[1]),
        oldLines: parseInt(hunkMatch[2] || '1'),
        newStart: parseInt(hunkMatch[3]),
        newLines: parseInt(hunkMatch[4] || '1')
      });
    }
    
    return hunks;
  }

  private calculateDiffStats(diffContent: string): any {
    const lines = diffContent.split('\n');
    let additions = 0;
    let deletions = 0;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      }
    }
    
    return {
      additions,
      deletions,
      changes: additions + deletions
    };
  }
}

// Export singleton instance for use in routes
export const pythonScriptService = new PythonScriptService();