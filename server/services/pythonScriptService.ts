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

      // SECURITY: Mask sensitive arguments in logs
      const maskedPythonArgs = this.maskSensitiveArgs(pythonArgs);
      broadcastLog('INFO', `Executing Python script: python ${maskedPythonArgs.join(' ')}`);
      broadcastLog('INFO', `Working directory: ${workingDir}`);

      // Get file list before execution (for file tracking)
      const filesBeforeExecution = await this.getDirectoryFileList(workingDir);
      broadcastLog('INFO', `Files before execution: ${filesBeforeExecution.size} files in ${workingDir}`);
      const executionStartTime = Date.now();

      // Try different Python commands - PUT 'py' FIRST for Windows
      const pythonCommands = ['py', 'python', 'python3'];
      let pythonCommand = 'py'; // Default to 'py' for Windows

      for (const cmd of pythonCommands) {
        try {
          const { execSync } = require('child_process');
          execSync(`${cmd} --version`, { stdio: 'ignore' });
          pythonCommand = cmd;
          break;
        } catch (error) {
          continue;
        }
      }

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
  async executePostCloneScript(repositoryPath: string, repositoryUrl: string, repositoryId?: string, aiSettings?: any): Promise<PythonExecutionResult> {
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
          scriptArgs.push('--base-url', aiSettings.apiEndpointUrl);
        }
        
        if (aiSettings.apiVersion) {
          scriptArgs.push('--api-version', aiSettings.apiVersion);
        }
        
        // SECURITY: Properly mask sensitive arguments
        const maskedArgs = this.maskSensitiveArgs(scriptArgs);
        broadcastLog('INFO', `Final script command: python ${defaultScriptPath} ${maskedArgs.join(' ')}`);
      } else {
        broadcastLog('WARN', 'No AI settings provided - Python script may use defaults or fail');
        broadcastLog('DEBUG', `Condition failed: aiSettings=${!!aiSettings}, apiKey=${aiSettings?.apiKey}, model=${aiSettings?.model}`);
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
      
      // Build args with AI settings for fallback case too
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
      
      broadcastLog('INFO', `🐍 About to execute generated Python script with ${scriptArgs.length} arguments`);
      
      const result = await this.executePythonScript({
        scriptContent,
        workingDirectory: repositoryPath,
        args: scriptArgs
      });
      
      broadcastLog('INFO', `🐍 Generated Python script execution completed - Success: ${result.success}`);
      if (!result.success) {
        broadcastLog('ERROR', `🐍 Generated script execution failed: ${result.error}`);
      }
      
      return result;
    }
  }

  /**
   * Check if Python is available on the system
   */
  async checkPythonAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    const commands = ['py --version', 'python', 'python3'];
    
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
   * Run Python command with proper error handling and detailed logging
   */
  private async runPythonCommand(args: string[], workingDir: string, timeout: number): Promise<PythonExecutionResult> {
    const commands = ['py', 'python', 'python3'];
    
    broadcastLog('INFO', `🐍 Starting Python execution with timeout: ${timeout}ms`);
    console.log(`🐍 Starting Python execution with timeout: ${timeout}ms`);
    broadcastLog('INFO', `🐍 Working directory: ${workingDir}`);
    console.log(`🐍 Working directory: ${workingDir}`);
    // SECURITY: Mask sensitive arguments in logs
    const maskedArgs = this.maskSensitiveArgs(args);
    broadcastLog('INFO', `🐍 Command arguments: [${maskedArgs.join(', ')}]`);
    console.log(`🐍 Command arguments: [${maskedArgs.join(', ')}]`);
    
    for (const command of commands) {
      try {
        broadcastLog('INFO', `🐍 Trying Python command: ${command}`);
        console.log(`🐍 Trying Python command: ${command}`);
        
        const { stdout, stderr } = await execFileAsync(command, args, {
          cwd: workingDir,
          timeout,
          maxBuffer: 10 * 1024 * 1024, // Increased to 10MB buffer for large outputs
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // Force UTF-8 encoding
        });
        
        broadcastLog('INFO', `🐍 Python script executed successfully using '${command}' command`);
        console.log(`🐍 Python script executed successfully using '${command}' command`);
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
        if (error.code === 'ENOENT') {
          // Command not found, try next one
          broadcastLog('WARN', `🐍 Python command '${command}' not found, trying next...`);
          continue;
        } else {
          // Other error (timeout, script error, etc.), don't try other commands
          let errorMessage = 'Python execution failed';
          let exitCode = error.code || -1;
          
          broadcastLog('ERROR', `🐍 Python command '${command}' failed with error code: ${error.code}, signal: ${error.signal}`);
          console.error(`🐍 Python command '${command}' failed with error code: ${error.code}, signal: ${error.signal}`);
          
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
    }
    
    // If we get here, none of the Python commands worked
    broadcastLog('ERROR', '🐍 All Python commands failed - Python not found on system');
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
   * Parse markdown report to extract structured data
   */
  async parseMarkdownReport(filePath: string): Promise<MigrationReportData | null> {
    try {
      let reportContent = await fs.promises.readFile(filePath, 'utf-8');
      
      // CRITICAL FIX: Normalize line endings and content
      reportContent = this.normalizeMarkdownContent(reportContent);
      
      const title = this.extractTitle(reportContent);
      const kafkaInventory = this.parseKafkaInventory(reportContent);
      const codeDiffs = this.parseCodeDiffs(reportContent);
      
      // Log parsing results for debugging
      broadcastLog('DEBUG', `MD Parser: Title="${title}"`);
      broadcastLog('DEBUG', `MD Parser: Found ${kafkaInventory.length} Kafka items, ${codeDiffs.length} diffs`);
      
      // If no structured data found, log first 300 chars for diagnosis
      if (kafkaInventory.length === 0 && codeDiffs.length === 0) {
        const preview = reportContent.substring(0, 300).replace(/\n/g, '\\n');
        broadcastLog('WARN', `MD Parser: No data found. Content preview: ${preview}...`);
      }
      
      return {
        title,
        kafka_inventory: kafkaInventory,
        code_diffs: codeDiffs,
        sections: {},
        stats: {
          total_files_with_kafka: kafkaInventory.length,
          total_files_with_diffs: codeDiffs.length,
          sections_count: 2
        }
      };
    } catch (error) {
      broadcastLog('ERROR', `Failed to parse markdown report: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return null;
    }
  }

  /**
   * SECURITY: Mask sensitive arguments like API keys, tokens, passwords
   */
  private maskSensitiveArgs(args: string[]): string[] {
    const maskedArgs: string[] = [];
    const sensitiveFlags = ['--api-key', '--token', '--password', '--secret'];
    
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      
      // Check for --flag=value format
      if (arg.includes('=')) {
        const [flag, value] = arg.split('=', 2);
        if (sensitiveFlags.some(f => flag.startsWith(f))) {
          maskedArgs.push(`${flag}=***`);
        } else {
          maskedArgs.push(arg);
        }
      }
      // Check for --flag value format  
      else if (sensitiveFlags.includes(arg) && i + 1 < args.length) {
        maskedArgs.push(arg);
        maskedArgs.push('***');
        i++; // Skip next arg (the value)
      }
      // Check for common flag variants (case-insensitive)
      else if (/^(--access-token|--client-secret|--authorization|-k)$/i.test(arg) && i + 1 < args.length) {
        maskedArgs.push(arg);
        maskedArgs.push('***');
        i++; // Skip next arg (the value)
      }
      // Check for bare API keys (starts with common prefixes)
      else if (/^(sk-|dial-|bearer |token |key-)/i.test(arg)) {
        maskedArgs.push('***');
      }
      // Check for URLs with credentials
      else if (arg.includes('://') && (arg.includes('@') || arg.includes('api_key=') || arg.includes('token='))) {
        const url = new URL(arg);
        url.username = url.username ? '***' : url.username;
        url.password = url.password ? '***' : url.password;
        url.searchParams.forEach((value, key) => {
          if (/^(api_key|token|key|password|secret)$/i.test(key)) {
            url.searchParams.set(key, '***');
          }
        });
        maskedArgs.push(url.toString());
      }
      else {
        maskedArgs.push(arg);
      }
    }
    
    return maskedArgs;
  }

  /**
   * Normalize markdown content: fix line endings, remove emoji, etc.
   */
  private normalizeMarkdownContent(content: string): string {
    // 1. Normalize CRLF to LF
    content = content.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // 2. Remove or normalize emoji and special Unicode characters from headers
    content = content.replace(/^(#{1,6})\s*[^\w\s]*\s*(.+)$/gm, '$1 $2');
    
    return content;
  }

  private extractTitle(content: string): string {
    // More flexible title extraction
    const patterns = [
      /^#\s*(.+)$/m,                           // # Title
      /^#\s*[^\w\s]*\s*(.+)$/m,               // # 🚀 Title  
      /migration.*report/i,                    // "Migration Report" anywhere
      /kafka.*azure.*service.*bus/i           // Kafka to Azure Service Bus
    ];
    
    for (const pattern of patterns) {
      const match = content.match(pattern);
      if (match) {
        return match[1] ? match[1].trim() : match[0].trim();
      }
    }
    
    return 'Kafka → Azure Service Bus Migration Report';
  }

  private parseKafkaInventory(content: string): any[] {
    const inventory: any[] = [];
    
    // Multiple patterns to match different section formats - LOOSER MATCHING
    const sectionPatterns = [
      // Exact section match with optional blank lines
      /##\s*\d*\.?\s*Kafka\s*(Usage\s*)?(Inventory|Files|Analysis)[\s\S]*?\n\n?(.*?)(?=\n## |\n# |\Z)/i,
      /##\s*Kafka\s*(Inventory|Files|Usage)[\s\S]*?\n\n?(.*?)(?=\n## |\n# |\Z)/i,
      /####?\s*Kafka\s*(Inventory|Files)[\s\S]*?\n\n?(.*?)(?=\n## |\n# |\Z)/i,
      
      // File-based headings
      /####?\s*File:\s*[\s\S]*?\n\n?(.*?)(?=\n## |\n# |\Z)/i,
      
      // General Kafka mentions
      /##\s*.*Kafka.*[\s\S]*?\n\n?(.*?)(?=\n## |\n# |\Z)/i
    ];
    
    let sectionContent = '';
    for (const pattern of sectionPatterns) {
      const match = content.match(pattern);
      if (match) {
        sectionContent = match[match.length - 1]; // Last capture group
        break;
      }
    }
    
    if (!sectionContent) {
      // Fallback: search for any table with file paths and Kafka mentions
      const tableMatches = content.match(/\|.*?\|[\s\S]*?\|.*?\|/g);
      if (tableMatches) {
        for (const tableMatch of tableMatches) {
          if (tableMatch.toLowerCase().includes('kafka') || tableMatch.includes('.cs') || tableMatch.includes('.java')) {
            sectionContent = tableMatch;
            break;
          }
        }
      }
    }
    
    if (sectionContent) {
      const lines = sectionContent.split('\n');
      let inTable = false;
      let foundTableRows = false;
      
      // First pass: look for any pipe-delimited rows (looser table detection)
      for (const line of lines) {
        if (line.includes('|') && (line.includes('---') || line.includes(':-'))) {
          inTable = true;
          continue;
        }
        if (line.startsWith('|') && line.split('|').length >= 3) {
          foundTableRows = true;
          const columns = line.split('|').map(col => col.trim()).filter(col => col);
          if (columns.length >= 2) {
            inventory.push({
              file: columns[0] || 'Unknown file',
              apis_used: columns[1] || 'N/A',
              summary: columns[2] || 'Kafka usage detected'
            });
          }
        } else if (!line.startsWith('|') && inTable) {
          break;
        }
      }
      
      // If no proper table found, try parsing any pipe-delimited lines
      if (!foundTableRows) {
        for (const line of lines) {
          if (line.includes('|') && line.split('|').length >= 3) {
            const columns = line.split('|').map(col => col.trim()).filter(col => col);
            if (columns.length >= 2 && (columns[0].includes('.') || columns[1].toLowerCase().includes('kafka'))) {
              inventory.push({
                file: columns[0] || 'Unknown file',
                apis_used: columns[1] || 'Kafka APIs',
                summary: columns[2] || 'Detected from content analysis'
              });
            }
          }
        }
      }
      
      // Additional fallback: bullet list parsing
      if (inventory.length === 0) {
        for (const line of lines) {
          const bulletMatch = line.match(/[-*]\s*(.*?\.(?:cs|java|js|ts|py))\s*[:-]\s*(.*)/i);
          if (bulletMatch) {
            inventory.push({
              file: bulletMatch[1].trim(),
              apis_used: 'Kafka APIs',
              summary: bulletMatch[2].trim() || 'Found in bullet list'
            });
          }
        }
      }
    }
    
    // Additional fallback: scan for file mentions with Kafka
    if (inventory.length === 0) {
      const filePatterns = [
        /(\S+\.(cs|java|js|ts|py))\s*[:\-]\s*.*(kafka|producer|consumer)/gi,
        /File:\s*(\S+\.(cs|java|js|ts|py))/gi
      ];
      
      for (const pattern of filePatterns) {
        let match;
        while ((match = pattern.exec(content)) !== null && inventory.length < 10) {
          inventory.push({
            file: match[1] || match[0],
            apis_used: 'Kafka APIs',
            summary: 'Detected from file analysis'
          });
        }
      }
    }
    
    return inventory;
  }

  private parseCodeDiffs(content: string): any[] {
    const diffs: any[] = [];
    
    // Multiple patterns for different diff formats - COMPREHENSIVE MATCHING
    const diffPatterns = [
      /###?\s*([^\n]+)\n```diff\n([\s\S]*?)\n```/g,          // ### file\n```diff
      /###?\s*([^\n]+)\n```patch\n([\s\S]*?)\n```/g,         // ### file\n```patch
      /###?\s*([^\n]+)\n```\n([\s\S]*?)\n```/g,              // ### file\n```
      /####?\s*File:\s*([^\n]+)\n```[\w]*\n([\s\S]*?)\n```/g, // #### File: path\n```
      /##\s*([^\n]+)\n```diff\n([\s\S]*?)\n```/g,            // ## file\n```diff
      /```diff\n([\s\S]*?)\n```/g,                           // Any ```diff block
      /```patch\n([\s\S]*?)\n```/g                           // Any ```patch block
    ];
    
    for (const pattern of diffPatterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex
      while ((match = pattern.exec(content)) !== null) {
        // Handle patterns with different capture group counts
        if (match.length >= 3 && match[1] && match[2]) {
          // Pattern has both file and content groups
          diffs.push({
            file: match[1].trim(),
            diff_content: match[2].trim(),
            language: 'diff'
          });
        } else if (match.length >= 2 && match[1]) {
          // Pattern has only content group (anonymous diff block)
          diffs.push({
            file: `Migration Diff ${diffs.length + 1}`,
            diff_content: match[1].trim(),
            language: 'diff'
          });
        }
      }
    }
    
    // Fallback: look for any code blocks with +/- changes
    if (diffs.length === 0) {
      const codeBlockPattern = /```[\w]*\n([\s\S]*?)\n```/g;
      let match;
      while ((match = codeBlockPattern.exec(content)) !== null) {
        const blockContent = match[1];
        if (blockContent.includes('+ ') || blockContent.includes('- ') || 
            blockContent.includes('+') || blockContent.includes('-')) {
          diffs.push({
            file: `Migration Code ${diffs.length + 1}`,
            diff_content: blockContent.trim(),
            language: 'diff'
          });
        }
      }
    }
    
    // Additional fallback: scan for specific migration patterns
    if (diffs.length === 0) {
      const migrationPatterns = [
        /ServiceBus|Azure|Connection|Producer|Consumer/gi
      ];
      
      for (const pattern of migrationPatterns) {
        const matches = Array.from(content.matchAll(pattern));
        if (matches.length > 0) {
          diffs.push({
            file: 'Detected Migration Changes',
            diff_content: `Found ${matches.length} migration-related changes in the codebase`,
            language: 'text'
          });
          break;
        }
      }
    }
    
    return diffs;
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
        success: executionResult.success || (executionResult.exitCode === 0), // Add this property
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

      // Use smart MD report discovery with README resolver
      let structuredData: MigrationReportData | null = null;
      const migrationReportPath = await findMigrationReport(repositoryPath, executionResult.generatedFiles);
      
      if (migrationReportPath) {
        broadcastLog('INFO', `🎯 Found migration report: ${migrationReportPath}`);
        structuredData = await this.parseMarkdownReport(migrationReportPath);
        
        if (structuredData) {
          broadcastLog('INFO', `✅ Successfully parsed migration report: ${structuredData.title}`);
          broadcastLog('INFO', `📊 Found ${structuredData.kafka_inventory.length} Kafka files and ${structuredData.code_diffs.length} code diffs`);
        } else {
          broadcastLog('WARN', `⚠️  Failed to parse migration report from: ${migrationReportPath}`);
        }
      } else {
        broadcastLog('WARN', `⚠️  No migration report found in generated files`);
      }

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
        results: analysisResult as any,
        structuredData: structuredData as any
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