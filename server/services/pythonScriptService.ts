import { exec, execFile } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';
import { broadcastLog } from '../utils/logger';
import { GeneratedFile, PythonScriptResult } from '@shared/schema';

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

class PythonScriptService {
  private defaultTimeout = 600000; // 30 seconds default timeout

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
            error: `Script file not found: ${options.scriptPath}`
          };
        }
        scriptToExecute = options.scriptPath;
        broadcastLog('INFO', `Using Python script from file: ${options.scriptPath}`);
      } else if (options.scriptContent) {
        // Create temporary script file from content
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

      broadcastLog('INFO', `Executing Python script: python ${pythonArgs.join(' ')}`);
      broadcastLog('INFO', `Working directory: ${workingDir}`);

      // Get file list before execution (for file tracking)
      const filesBeforeExecution = await this.getDirectoryFileList(workingDir);
      broadcastLog('INFO', `Files before execution: ${filesBeforeExecution.size} files in ${workingDir}`);
      const executionStartTime = Date.now();

      // Execute the Python script
      const result = await this.runPythonCommand(pythonArgs, workingDir, timeout);
      
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
  async executePostCloneScript(repositoryPath: string, repositoryUrl: string, repositoryId?: string): Promise<PythonExecutionResult> {
    broadcastLog('INFO', `Executing post-clone Python script for repository: ${repositoryUrl}`);
    
    // First try to use the default.py script from scripts folder
    const defaultScriptPath = path.join(process.cwd(), 'scripts', 'default.py');
    
    if (await this.fileExists(defaultScriptPath)) {
      broadcastLog('INFO', `Using Python script from scripts folder: ${defaultScriptPath}`);
      return await this.executePythonScript({
        scriptPath: defaultScriptPath,
        workingDirectory: repositoryPath,
        args: [repositoryUrl, repositoryPath]
      });
    } else {
      // Fallback to generated script content if default.py doesn't exist
      broadcastLog('INFO', 'default.py not found, using generated script content');
      const scriptContent = this.generatePostCloneScript(repositoryPath, repositoryUrl);
      
      return await this.executePythonScript({
        scriptContent,
        workingDirectory: repositoryPath,
        args: [repositoryUrl, repositoryPath]
      });
    }
  }

  /**
   * Check if Python is available on the system
   */
  async checkPythonAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    const commands = ['py --version', 'python --version', 'python3 --version'];
    
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
   * Run Python command with proper error handling
   */
  private async runPythonCommand(args: string[], workingDir: string, timeout: number): Promise<PythonExecutionResult> {
    const commands = ['py', 'python', 'python3'];
    
    for (const command of commands) {
      try {
        const { stdout, stderr } = await execFileAsync(command, args, {
          cwd: workingDir,
          timeout,
          maxBuffer: 1024 * 1024, // 1MB buffer
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // Force UTF-8 encoding
        });
        
        broadcastLog('INFO', `Python script executed successfully using '${command}' command`);
        return {
          success: true,
          output: stdout,
          error: stderr || undefined,
          exitCode: 0
        };
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // Command not found, try next one
          continue;
        } else {
          // Other error (timeout, script error, etc.), don't try other commands
          let errorMessage = 'Python execution failed';
          let exitCode = error.code || -1;
          
          if (error.signal === 'SIGTERM') {
            errorMessage = `Python script timed out after ${timeout}ms`;
          } else if (error.stderr) {
            errorMessage = error.stderr;
          } else if (error.message) {
            errorMessage = error.message;
          }
          
          return {
            success: false,
            error: errorMessage,
            exitCode
          };
        }
      }
    }
    
    // If we get here, none of the Python commands worked
    return {
      success: false,
      error: 'Python not found. Please install Python and ensure it is in your PATH.',
      exitCode: -1
    };
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
   * Get default script path or create one
   */
  private async getDefaultScript(): Promise<string> {
    const defaultScriptPath = path.join(process.cwd(), 'scripts', 'default.py');
    
    if (await this.fileExists(defaultScriptPath)) {
      return defaultScriptPath;
    }
    
    // Create default script if it doesn't exist
    const defaultContent = this.getDefaultScriptContent();
    const tempPath = await this.createTempScript(defaultContent);
    return tempPath;
  }

  /**
   * Generate a post-clone script content
   */
  private generatePostCloneScript(repositoryPath: string, repositoryUrl: string): string {
    return `#!/usr/bin/env python3
"""
Post-clone script executed after repository cloning.
This script runs automatically when a repository is cloned.
"""

import os
import sys
import json
from datetime import datetime

def main():
    print("[PYTHON] Python post-clone script started")
    print(f"Repository URL: {sys.argv[1] if len(sys.argv) > 1 else 'Unknown'}")
    print(f"Repository Path: {sys.argv[2] if len(sys.argv) > 2 else 'Unknown'}")
    print(f"Current working directory: {os.getcwd()}")
    print(f"Script execution time: {datetime.now().isoformat()}")
    
    # Example: Count files in the repository
    if len(sys.argv) > 2:
        repo_path = sys.argv[2]
        if os.path.exists(repo_path):
            file_count = sum([len(files) for r, d, files in os.walk(repo_path)])
            print(f"[FILES] Total files in repository: {file_count}")
            
            # Find common file types
            extensions = {}
            for root, dirs, files in os.walk(repo_path):
                for file in files:
                    ext = os.path.splitext(file)[1].lower()
                    extensions[ext] = extensions.get(ext, 0) + 1
            
            print("[TYPES] File types found:")
            for ext, count in sorted(extensions.items(), key=lambda x: x[1], reverse=True)[:10]:
                if ext:
                    print(f"  {ext}: {count} files")
    
    # Example: Create a simple analysis report
    report = {
        "script_execution_time": datetime.now().isoformat(),
        "repository_url": sys.argv[1] if len(sys.argv) > 1 else None,
        "repository_path": sys.argv[2] if len(sys.argv) > 2 else None,
        "status": "completed",
        "message": "Post-clone script executed successfully"
    }
    
    print("[SUCCESS] Python post-clone script completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;
  }

  /**
   * Create an analysis report for Python script execution
   */
  async createPythonScriptReport(
    repositoryId: string,
    repositoryUrl: string,
    repositoryPath: string,
    executionResult: PythonExecutionResult,
    scriptPath: string
  ): Promise<void> {
    if (!executionResult.success || !executionResult.generatedFiles || executionResult.generatedFiles.length === 0) {
      return; // No report needed if script failed or no files generated
    }

    try {
      const { storage } = await import('../storage');
      
      const pythonScriptResult: PythonScriptResult = {
        executedAt: new Date().toISOString(),
        scriptPath,
        repositoryUrl,
        repositoryPath,
        output: executionResult.output || '',
        generatedFiles: executionResult.generatedFiles,
        exitCode: executionResult.exitCode || 0,
        executionTime: executionResult.executionEndTime && executionResult.executionStartTime 
          ? executionResult.executionEndTime - executionResult.executionStartTime 
          : 0
      };

      const analysisResult = {
        summary: {},
        issues: [],
        recommendations: [`Python script generated ${executionResult.generatedFiles.length} files`],
        metrics: {
          generatedFilesCount: executionResult.generatedFiles.length,
          executionTime: pythonScriptResult.executionTime,
          totalFileSize: executionResult.generatedFiles.reduce((sum, file) => sum + file.size, 0)
        },
        technologies: [],
        pythonScriptOutput: pythonScriptResult
      };

      await storage.createAnalysisReport({
        repositoryId,
        analysisType: 'python-script',
        results: analysisResult as any
      });

      broadcastLog('INFO', `Created Python script analysis report with ${executionResult.generatedFiles.length} generated files`);
    } catch (error) {
      broadcastLog('ERROR', `Failed to create Python script report: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get default script content
   */
  private getDefaultScriptContent(): string {
    return `#!/usr/bin/env python3
"""
Default Python script for RepoCloner
"""

import sys
from datetime import datetime

def main():
    print("[PYTHON] Default Python script executed")
    print(f"Python version: {sys.version}")
    print(f"Execution time: {datetime.now().isoformat()}")
    print("[SUCCESS] Default script completed successfully")
    return 0

if __name__ == "__main__":
    sys.exit(main())
`;
  }

  /**
   * Get list of files in a directory before script execution
   */
  private async getDirectoryFileList(directoryPath: string): Promise<Set<string>> {
    const fileSet = new Set<string>();
    
    try {
      const getAllFiles = async (dir: string): Promise<void> => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory()) {
            // Skip hidden directories and common exclude patterns
            if (!entry.name.startsWith('.') && 
                !['node_modules', '__pycache__', 'venv', '.git'].includes(entry.name)) {
              await getAllFiles(fullPath);
            }
          } else {
            // Skip hidden files and common temp files
            if (!entry.name.startsWith('.') && 
                !entry.name.endsWith('.pyc') && 
                !entry.name.endsWith('.tmp')) {
              fileSet.add(fullPath);
            }
          }
        }
      };
      
      await getAllFiles(directoryPath);
    } catch (error) {
      broadcastLog('WARN', `Failed to scan directory for file list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
    
    return fileSet;
  }

  /**
   * Compare file lists and identify generated files
   */
  private async identifyGeneratedFiles(
    beforeFiles: Set<string>, 
    workingDirectory: string
  ): Promise<GeneratedFile[]> {
    const afterFiles = await this.getDirectoryFileList(workingDirectory);
    const generatedFiles: GeneratedFile[] = [];
    
    broadcastLog('INFO', `File comparison: before=${beforeFiles.size}, after=${afterFiles.size}`);

    for (const filePath of Array.from(afterFiles)) {
      if (!beforeFiles.has(filePath)) {
        try {
          const stats = await fs.promises.stat(filePath);
          const relativePath = path.relative(workingDirectory, filePath);
          
          // Try to determine file type
          let fileType: 'text' | 'binary' = 'text';
          let mimeType: string | undefined;
          
          const ext = path.extname(filePath).toLowerCase();
          if (['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.zip', '.exe'].includes(ext)) {
            fileType = 'binary';
          }
          
          // Set basic mime types
          const mimeTypes: Record<string, string> = {
            '.txt': 'text/plain',
            '.py': 'text/x-python',
            '.js': 'text/javascript',
            '.json': 'application/json',
            '.csv': 'text/csv',
            '.html': 'text/html',
            '.md': 'text/markdown',
            '.xml': 'application/xml'
          };
          mimeType = mimeTypes[ext];

          const generatedFile: GeneratedFile = {
            name: path.basename(filePath),
            path: filePath,
            relativePath: relativePath,
            size: stats.size,
            type: fileType,
            mimeType,
            createdAt: stats.birthtime.toISOString()
          };

          generatedFiles.push(generatedFile);
          broadcastLog('INFO', `Detected generated file: ${relativePath} (${stats.size} bytes)`);
        } catch (error) {
          broadcastLog('WARN', `Failed to process generated file ${filePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    }

    return generatedFiles;
  }
}

// Export singleton instance
export const pythonScriptService = new PythonScriptService();