import { exec, execFile, execSync } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import * as fs from 'fs';
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
        return {
          success: false,
          error: 'No script path or content provided for execution'
        };
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
    broadcastLog('INFO', `Executing post-clone Python script for repository: ${repositoryUrl}`);
    
    // First try to use the default.py script from scripts folder
    const defaultScriptPath = path.join(process.cwd(), 'scripts', 'default.py');
    
    if (await this.fileExists(defaultScriptPath)) {
      broadcastLog('INFO', `Using Python script from scripts folder: ${defaultScriptPath}`);
      
      // Build command arguments including AI settings
      let scriptArgs = [repositoryUrl, repositoryPath];
      
      // Add AI settings as command-line arguments if available
      if (aiSettings && aiSettings.apiKey && aiSettings.model) {
        broadcastLog('INFO', 'Passing AI settings to Python script');
        scriptArgs.push(
          '--api-key', aiSettings.apiKey,
          '--model', aiSettings.model
        );
        
        if (aiSettings.apiEndpointUrl) {
          // Use the URL exactly as configured by the user - don't modify it!
          // EPAM proxy and other services may require api-version in URL for routing/auth
          scriptArgs.push('--base-url', aiSettings.apiEndpointUrl);
        }
        
        if (aiSettings.apiVersion) {
          // Only pass api-version as header if it's NOT already in the URL
          if (!aiSettings.apiEndpointUrl?.includes('api-version=')) {
            scriptArgs.push('--api-version', aiSettings.apiVersion);
          }
        }
        
        // SECURITY: Properly mask sensitive arguments
        const maskedArgs = this.maskSensitiveArgs(scriptArgs);
        broadcastLog('INFO', `Final script command: python ${defaultScriptPath} ${maskedArgs.join(' ')}`);
      } else {
        broadcastLog('ERROR', 'AI settings are required for migration analysis');
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
      // Return failure when default.py doesn't exist - no fallback script generation
      broadcastLog('ERROR', 'default.py not found and no fallback script should be generated');
      return {
        success: false,
        error: 'Python analysis script not found. Analysis requires proper AI configuration.',
        exitCode: -1
      };
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
    broadcastLog('INFO', `🐍 Working directory: ${workingDir}`);
    // SECURITY: Mask sensitive arguments in logs
    const maskedArgs = this.maskSensitiveArgs(args);
    broadcastLog('INFO', `🐍 Command arguments: [${maskedArgs.join(', ')}]`);
    broadcastLog('INFO', `🐍 Using Python interpreter: ${pythonCommand}`);
    
    try {
      const { stdout, stderr } = await execFileAsync(pythonCommand, args, {
        cwd: workingDir,
        timeout,
        maxBuffer: 10 * 1024 * 1024, // Increased to 10MB buffer for large outputs
        env: { ...process.env, PYTHONIOENCODING: 'utf-8' } // Force UTF-8 encoding
      });
      
      broadcastLog('INFO', `🐍 Python script executed successfully using '${pythonCommand}' command`);
      broadcastLog('INFO', `🐍 Script stdout length: ${stdout.length} characters`);
      
      if (stdout.length > 0) {
        // Log first 1000 characters of output
        broadcastLog('INFO', `🐍 Script output preview: ${stdout.substring(0, 1000)}${stdout.length > 1000 ? '...' : ''}`);
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
      
      if (error.signal === 'SIGTERM') {
        errorMessage = `Python script timed out after ${timeout}ms`;
        broadcastLog('ERROR', `🐍 TIMEOUT: Script execution exceeded ${timeout}ms limit`);
      } else if (error.stderr) {
        errorMessage = error.stderr;
        broadcastLog('ERROR', `🐍 Script stderr: ${error.stderr.substring(0, 1000)}${error.stderr.length > 1000 ? '...' : ''}`);

      } else if (error.message) {
        errorMessage = error.message;
        broadcastLog('ERROR', `🐍 Error message: ${error.message}`);
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
            name: path.basename(filePath),
            path: fullPath,
            size: stats.size,
            relativePath: filePath,
            createdAt: stats.birthtime
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
      const reportPath = await findMigrationReport(repositoryPath, []);
      
      if (!reportPath) {
        return {
          success: false,
          output: '',
          error: `Migration report not found in repository: ${repositoryPath}`,
          exitCode: 1,
          executionTime: 0,
          executedAt: new Date().toISOString(),
          scriptPath: '',
          repositoryUrl: '',
          repositoryPath: repositoryPath,
          generatedFiles: []
        };
      }

      const validation = await validateMigrationReport(reportPath);
      if (!validation.isValid) {
        return {
          success: false,
          output: '',
          error: `Invalid migration report: ${validation.error}`,
          exitCode: 1,
          executionTime: 0,
          executedAt: new Date().toISOString(),
          scriptPath: '',
          repositoryUrl: '',
          repositoryPath: repositoryPath,
          generatedFiles: []
        };
      }

      // Extract structured data from report
      const reportContent = await fs.promises.readFile(reportPath, 'utf8');
      const structuredData = await this.extractStructuredData(reportContent, reportPath);

      return {
        success: true,
        output: reportContent,
        exitCode: 0,
        executionTime: 0,
        executedAt: new Date().toISOString(),
        scriptPath: reportPath,
        repositoryUrl: '',
        repositoryPath: repositoryPath,
        generatedFiles: [],
        parsedMigrationData: structuredData ? {
          title: structuredData.title,
          kafkaInventory: structuredData.kafka_inventory.map(item => ({
            file: item.file,
            apis_used: item.apis_used || '',
            summary: item.summary || ''
          })),
          codeDiffs: structuredData.code_diffs.map(diff => ({
            file: diff.file,
            diff_content: diff.diff_content,
            diffContent: diff.diff_content,
            language: diff.language
          })),
          sections: structuredData.sections,
          stats: {
            totalFilesWithKafka: structuredData.stats.total_files_with_kafka,
            totalFilesWithDiffs: structuredData.stats.total_files_with_diffs,
            sectionsCount: structuredData.stats.sections_count
          }
        } : undefined
      };
    } catch (error) {
      return {
        success: false,
        output: '',
        error: `Failed to process migration report: ${error}`,
        exitCode: 1,
        executionTime: 0,
        executedAt: new Date().toISOString(),
        scriptPath: '',
        repositoryUrl: '',
        repositoryPath: repositoryPath,
        generatedFiles: []
      };
    }
  }

  /**
   * Convert JSON report data to our internal MigrationReportData format
   */
  private convertJsonToMigrationData(jsonData: any): MigrationReportData {
    // Pure JSON deserialization - no regex cleanup needed
    // Python script already extracts key changes/notes into separate arrays
    const codeDiffs = jsonData.diffs.map((diff: any) => {
      return {
        file: diff.path,
        diff_content: diff.diff,
        description: diff.description,
        diffContent: diff.diff,
        language: 'diff',
        key_changes: []  // Key changes are in the top-level keyChanges array
      };
    });
    
    const sections = codeDiffs.map((diff: any, idx: number) => ({
      id: `section-${idx + 1}`,
      title: diff.file,
      description: diff.description,
      diffBlock: diff.diff_content,
      keyChanges: [], // Will be populated from global keyChanges array
      notes: [], // Will be populated from global notes array
      evidence: []
    }));
    
    return {
      title: 'Kafka → Azure Service Bus Migration Analysis',
      kafka_inventory: jsonData.inventory.map((item: any) => ({
        file: item.file,
        apis_used: item.kafka_apis?.join(', ') || '',
        summary: item.summary || ''
      })),
      code_diffs: codeDiffs,
      sections: sections,
      keyChanges: jsonData.keyChanges || [],
      notes: jsonData.notes || [],
      stats: {
        total_files_with_kafka: jsonData.inventory.length,
        total_files_with_diffs: jsonData.diffs.length,
        notes_count: (jsonData.notes || []).length,
        sections_count: sections.length
      }
    };
  }

  /**
   * Extract structured data from migration report content
   * @param reportPath Optional path to the report file for standalone JSON lookup
   */
  private async extractStructuredData(reportContent: string, reportPath?: string): Promise<MigrationReportData | null> {
    try {
      // First, try to extract JSON data embedded in markdown (<!--BEGIN:REPORT_JSON-->...<!--END:REPORT_JSON-->)
      const jsonMarkerMatch = reportContent.match(/<!--BEGIN:REPORT_JSON-->\s*([\s\S]*?)\s*<!--END:REPORT_JSON-->/);
      
      if (jsonMarkerMatch) {
        try {
          const jsonData = JSON.parse(jsonMarkerMatch[1]);
          broadcastLog('INFO', '✅ Found and parsed embedded JSON data from report');
          
          // Convert JSON format to our internal MigrationReportData format
          return this.convertJsonToMigrationData(jsonData);
        } catch (jsonError) {
          broadcastLog('WARN', `⚠️  Failed to parse embedded JSON, falling back to standalone JSON file: ${jsonError}`);
        }
      }
      
      // Second, try to read standalone JSON file (migration-report-*.json)
      if (reportPath) {
        const jsonPath = reportPath.replace(/\.md$/, '.json');
        if (await this.fileExists(jsonPath)) {
          try {
            const jsonContent = await fs.promises.readFile(jsonPath, 'utf-8');
            const jsonData = JSON.parse(jsonContent);
            broadcastLog('INFO', `✅ Found and parsed standalone JSON file: ${jsonPath}`);
            
            return this.convertJsonToMigrationData(jsonData);
          } catch (jsonError) {
            broadcastLog('WARN', `⚠️  Failed to parse standalone JSON file, falling back to markdown parsing: ${jsonError}`);
          }
        }
      }
      
      // Fallback: Parse migration report sections using regex patterns
      const titleMatch = reportContent.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : 'Kafka to Azure Service Bus Migration Analysis';

      // Extract Kafka inventory from markdown table
      const kafkaInventory: any[] = [];
      
      // Find the Kafka Usage Inventory section
      const inventorySection = reportContent.match(/##\s+\d+\.\s*Kafka Usage Inventory([\s\S]*?)(?=##|$)/i);
      
      if (inventorySection) {
        // Parse markdown table rows (skip header and separator rows)
        const tableRowRegex = /^\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|$/gm;
        let rowMatch;
        let rowCount = 0;
        
        while ((rowMatch = tableRowRegex.exec(inventorySection[1])) !== null) {
          rowCount++;
          // Skip header row (File | APIs Used | Summary) and separator row (---|---|---)
          if (rowCount <= 2) continue;
          
          kafkaInventory.push({
            file: rowMatch[1].trim(),
            apis_used: rowMatch[2].trim(),
            summary: rowMatch[3].trim()
          });
        }
      }

      // Extract code diffs with descriptions and key changes
      const codeDiffs: any[] = [];
      
      // Match file sections: ### filename, then description, then ```diff block
      const fileSectionRegex = /###\s+([^\n]+)\n([\s\S]*?)(?=###|$)/g;
      let fileMatch;
      
      while ((fileMatch = fileSectionRegex.exec(reportContent)) !== null) {
        const fileName = fileMatch[1].replace(/`/g, '').trim();
        let sectionContent = fileMatch[2].trim();
        
        // Extract diff block (handle both Unix \n and Windows \r\n line endings)
        // AI sometimes duplicates ```diff markers, so find the LAST one to get actual diff
        const allDiffMarkers = Array.from(sectionContent.matchAll(/```diff/g));
        let diffContent = '';
        let description = sectionContent;
        let afterDiffText = '';
        let actualDiffEndIndex = 0;
        
        if (allDiffMarkers.length > 0) {
          // Use the LAST ```diff marker as the start of actual diff content
          const lastMarker = allDiffMarkers[allDiffMarkers.length - 1];
          const actualDiffStartIndex = (lastMarker.index || 0) + lastMarker[0].length;
          
          // Find the FIRST ``` after this point (this closes the actual diff)
          const afterLastDiff = sectionContent.substring(actualDiffStartIndex);
          const closingMatch = /[\r\n]+([\s\S]*?)[\r\n]+```/.exec(afterLastDiff);
          
          if (closingMatch) {
            diffContent = closingMatch[1];
            actualDiffEndIndex = actualDiffStartIndex + (closingMatch.index || 0) + closingMatch[0].length;
            
            // Get description (everything before the LAST ```diff marker)
            description = sectionContent.substring(0, lastMarker.index || 0).trim();
            
            // Get text after the FIRST closing ``` (where AI often puts "Key changes:" summary)
            afterDiffText = sectionContent.substring(actualDiffEndIndex).trim();
          }
        }
        
        // Extract key changes from multiple locations
        let keyChanges: string[] = [];
        
        // 1. Check for explicit "Key Changes:" header in description
        const explicitKeyChangesMatch = /(?:^|[\r\n])\s*(?:\*\*|##?)?\s*Key\s+Changes\s*:?\s*[\r\n]+((?:[\s]*[-*•]\s+.+[\r\n]+)+)/i.exec(description);
        
        if (explicitKeyChangesMatch) {
          keyChanges = explicitKeyChangesMatch[1]
            .split(/\r?\n/)
            .map(line => line.trim())
            .filter(line => line.startsWith('-') || line.startsWith('*') || line.startsWith('•'))
            .map(line => line.replace(/^[-*•]\s*/, '').trim())
            .filter(line => line.length > 0);
          
          description = description.replace(explicitKeyChangesMatch[0], '').trim();
        } 
        // 2. Check for bullet lists in description
        else {
          const bulletListMatch = description.match(/(?:^|[\r\n])((?:[\s]*[-*•]\s+.+[\r\n]+)+)/);
          
          if (bulletListMatch) {
            keyChanges = bulletListMatch[1]
              .split(/\r?\n/)
              .map(line => line.trim())
              .filter(line => line.startsWith('-') || line.startsWith('*') || line.startsWith('•'))
              .map(line => line.replace(/^[-*•]\s*/, '').trim())
              .filter(line => line.length > 0);
            
            if (keyChanges.length > 0) {
              description = description.replace(bulletListMatch[0], '').trim();
            }
          }
        }
        
        // 3. Check for "Key changes:" section AFTER the diff block (common AI pattern)
        if (keyChanges.length === 0 && afterDiffText) {
          const afterDiffKeyChangesMatch = /(?:^|[\r\n])\s*(?:\*\*|##?)?\s*Key\s+[Cc]hanges\s*:?\s*[\r\n]+((?:[\s]*[-*•]\s+.+(?:[\r\n]+|$))+)/i.exec(afterDiffText);
          
          if (afterDiffKeyChangesMatch) {
            keyChanges = afterDiffKeyChangesMatch[1]
              .split(/\r?\n/)
              .map(line => line.trim())
              .filter(line => line.startsWith('-') || line.startsWith('*') || line.startsWith('•'))
              .map(line => line.replace(/^[-*•]\s*/, '').trim())
              .filter(line => line.length > 0);
          }
        }
        
        // 4. CRITICAL FIX: Extract summary deletion lines from BETWEEN file headers (---/+++) and first hunk header (@@)
        // AI embeds descriptive lines like "- Replaced Kafka..." as deletion lines before actual code diffs
        if (diffContent) {
          const diffLines = diffContent.split(/\r?\n/);
          const extractedSummaryLines: string[] = [];
          const cleanedDiffLines: string[] = [];
          let foundFirstHunkHeader = false;
          let pastFileHeaders = false;
          
          for (let i = 0; i < diffLines.length; i++) {
            const line = diffLines[i];
            const trimmed = line.trim();
            
            // Skip file headers (--- and +++)
            if (trimmed.startsWith('---') || trimmed.startsWith('+++')) {
              cleanedDiffLines.push(line);
              pastFileHeaders = true;
              continue;
            }
            
            // Found first hunk header - from here on, keep everything as-is
            if (trimmed.match(/^@@\s+.*\s+@@/)) {
              foundFirstHunkHeader = true;
              cleanedDiffLines.push(line);
              continue;
            }
            
            // If we're past file headers but before first hunk, check for summary deletion lines
            if (pastFileHeaders && !foundFirstHunkHeader && trimmed.startsWith('-')) {
              // Check if it's a descriptive summary (action verb pattern)
              const summaryMatch = trimmed.match(/^-\s+(Replaced|Added|Implemented|Updated|Removed|Changed|Fixed|Created|Modified|Introduced|Migrated|Configured|Refactored|Used|Simplified|Kept)\b/i);
              if (summaryMatch) {
                // This is a summary line - extract it and don't include in cleaned diff
                extractedSummaryLines.push(trimmed.replace(/^-\s*/, '').trim());
                continue;
              }
            }
            
            // Keep all other lines (including actual code deletions inside hunks)
            cleanedDiffLines.push(line);
          }
          
          // Add extracted summaries to key changes (de-duplicate)
          if (extractedSummaryLines.length > 0) {
            const existingSet = new Set(keyChanges.map(k => k.toLowerCase()));
            for (const summary of extractedSummaryLines) {
              if (!existingSet.has(summary.toLowerCase())) {
                keyChanges.push(summary);
                existingSet.add(summary.toLowerCase());
              }
            }
            
            // Update diff content with cleaned lines
            diffContent = cleanedDiffLines.join('\n').trim();
          }
        }
        
        codeDiffs.push({
          file: fileName,
          diff_content: diffContent,
          description: description || undefined,
          key_changes: keyChanges.length > 0 ? keyChanges : undefined,
          language: this.inferLanguageFromFile(fileName),
          hunks: this.parseDiffHunks(diffContent),
          stats: this.calculateDiffStats(diffContent)
        });
      }

      const structuredData: MigrationReportData = {
        title,
        kafka_inventory: kafkaInventory,
        code_diffs: codeDiffs,
        keyChanges: [],
        sections: [],
        notes: [],
        stats: {
          total_files_with_kafka: kafkaInventory.length,
          total_files_with_diffs: codeDiffs.length,
          notes_count: 0,
          sections_count: 0
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
    const lines = diffContent.split(/\r?\n/);
    
    let currentHunk: any = null;
    let oldPtr = 0;
    let newPtr = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Skip code fence markers
      if (line === '```' || line === '```diff') {
        continue;
      }
      
      // Check for hunk header: @@ -a,b +c,d @@
      const hunkHeaderMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@(.*)$/);
      if (hunkHeaderMatch) {
        // Save previous hunk if exists
        if (currentHunk) {
          hunks.push(currentHunk);
        }
        
        // Create new hunk
        const oldStart = parseInt(hunkHeaderMatch[1]);
        const oldCount = parseInt(hunkHeaderMatch[2] || '1');
        const newStart = parseInt(hunkHeaderMatch[3]);
        const newCount = parseInt(hunkHeaderMatch[4] || '1');
        
        currentHunk = {
          header: line,
          old_start: oldStart,
          old_count: oldCount,
          new_start: newStart,
          new_count: newCount,
          lines: []
        };
        
        oldPtr = oldStart;
        newPtr = newStart;
        continue;
      }
      
      // If we're inside a hunk, parse diff lines
      if (currentHunk) {
        // Addition line
        if (line.startsWith('+') && !line.startsWith('+++')) {
          currentHunk.lines.push({
            type: 'addition',
            content: line.substring(1),
            old_line: null,
            new_line: newPtr++
          });
        }
        // Deletion line
        else if (line.startsWith('-') && !line.startsWith('---')) {
          currentHunk.lines.push({
            type: 'deletion',
            content: line.substring(1),
            old_line: oldPtr++,
            new_line: null
          });
        }
        // Context line (starts with space)
        else if (line.startsWith(' ')) {
          currentHunk.lines.push({
            type: 'context',
            content: line.substring(1),
            old_line: oldPtr++,
            new_line: newPtr++
          });
        }
        // Special marker (e.g., "\ No newline at end of file")
        else if (line.startsWith('\\')) {
          currentHunk.lines.push({
            type: 'context',
            content: line,
            old_line: null,
            new_line: null
          });
        }
        // Empty line within hunk - treat as context
        else if (line === '' && currentHunk.lines.length > 0) {
          currentHunk.lines.push({
            type: 'context',
            content: '',
            old_line: oldPtr++,
            new_line: newPtr++
          });
        }
      }
    }
    
    // Push last hunk if exists
    if (currentHunk) {
      hunks.push(currentHunk);
    }
    
    // If no hunks were created but there are diff lines, create a synthetic hunk
    if (hunks.length === 0 && diffContent.trim()) {
      const hasDiffLines = lines.some(line => 
        (line.startsWith('+') && !line.startsWith('+++')) ||
        (line.startsWith('-') && !line.startsWith('---'))
      );
      
      if (hasDiffLines) {
        // Create a single synthetic hunk containing all lines
        const syntheticHunk: any = {
          header: '@@ File changes @@',
          old_start: 1,
          old_count: 0,
          new_start: 1,
          new_count: 0,
          lines: []
        };
        
        let oldLine = 1;
        let newLine = 1;
        
        for (const line of lines) {
          if (line === '```' || line === '```diff') {
            continue;
          }
          
          if (line.startsWith('+') && !line.startsWith('+++')) {
            syntheticHunk.lines.push({
              type: 'addition',
              content: line.substring(1),
              old_line: null,
              new_line: newLine++
            });
          } else if (line.startsWith('-') && !line.startsWith('---')) {
            syntheticHunk.lines.push({
              type: 'deletion',
              content: line.substring(1),
              old_line: oldLine++,
              new_line: null
            });
          } else if (line.startsWith(' ')) {
            syntheticHunk.lines.push({
              type: 'context',
              content: line.substring(1),
              old_line: oldLine++,
              new_line: newLine++
            });
          } else if (line.trim() !== '' && !line.startsWith('diff ') && !line.startsWith('index ')) {
            // Treat other non-empty lines as context
            syntheticHunk.lines.push({
              type: 'context',
              content: line,
              old_line: oldLine++,
              new_line: newLine++
            });
          }
        }
        
        if (syntheticHunk.lines.length > 0) {
          hunks.push(syntheticHunk);
        }
      }
    }
    
    return hunks;
  }

  private calculateDiffStats(diffContent: string): any {
    const lines = diffContent.split(/\r?\n/);
    let additions = 0;
    let deletions = 0;
    let context = 0;
    
    for (const line of lines) {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        additions++;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        deletions++;
      } else if (line.startsWith(' ')) {
        context++;
      }
    }
    
    return {
      additions,
      deletions,
      context,
      total_changes: additions + deletions
    };
  }

  /**
   * Create structured report from Python script results and return report ID
   */
  async createPythonScriptReport(
    repositoryId: string,
    repositoryUrl: string,
    repositoryPath: string,
    pythonResult: PythonExecutionResult,
    scriptPath: string,
    storage: any
  ): Promise<string | undefined> {
    try {
      broadcastLog('INFO', `📊 Processing Python script results for structured report...`);
      
      if (!pythonResult.generatedFiles || pythonResult.generatedFiles.length === 0) {
        broadcastLog('WARN', `⚠️ No generated files found for repository ${repositoryId}`);
        return undefined;
      }

      // Find and process the migration report markdown file
      const migrationReportFile = pythonResult.generatedFiles.find(file => 
        file.name.endsWith('.md') && file.name.includes('migration')
      );

      if (!migrationReportFile) {
        broadcastLog('WARN', `⚠️ No migration report markdown file found for repository ${repositoryId}`);
        return undefined;
      }

      broadcastLog('INFO', `📄 Processing migration report: ${migrationReportFile.name}`);
      
      try {
        const fileContent = await fs.promises.readFile(migrationReportFile.path, 'utf-8');
        const parsedMigrationData = await this.extractStructuredData(fileContent, migrationReportFile.path);
        
        if (!parsedMigrationData) {
          throw new Error('Failed to extract structured data from migration report');
        }
        
        // Set the parsed data directly on the pythonResult object (this is where the API expects it)
        (pythonResult as any).parsedMigrationData = parsedMigrationData;
        
        broadcastLog('INFO', `✅ Successfully parsed migration data: ${parsedMigrationData.code_diffs?.length || 0} diffs, ${parsedMigrationData.kafka_inventory?.length || 0} files with Kafka`);
        
        // Create analysis report in database and return its ID
        const report = await storage.createAnalysisReport({
          repositoryId,
          analysisType: 'migration' as any,
          results: {
            pythonScriptOutput: {
              ...pythonResult,
              parsedMigrationData
            }
          }
        });
        
        broadcastLog('INFO', `🎉 Migration analysis report created with ID: ${report.id}`);
        return report.id;
        
      } catch (fileError) {
        broadcastLog('ERROR', `❌ Failed to process ${migrationReportFile.name}: ${fileError}`);
        throw fileError;
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('ERROR', `❌ Failed to create Python script report: ${errorMessage}`);
      throw new Error(`Failed to create Python script report: ${errorMessage}`);
    }
  }

  /**
   * Parse markdown content into migration data structure
   */
  private async parseMarkdownToMigrationData(content: string): Promise<any> {
    try {
      // Parse the markdown content into structured migration data
      const sections = this.parseMarkdownSections(content);
      
      // Extract specific sections for migration analysis
      const migrationSummary = this.extractMigrationSummary(sections);
      const codeChanges = this.extractCodeChanges(sections);
      const keyChanges = this.extractKeyChanges(sections);
      const notes = this.extractNotes(sections);
      
      return {
        migrationSummary,
        codeChanges,
        keyChanges,
        notes,
        sections, // Keep all sections for flexibility
        generatedAt: new Date().toISOString(),
        contentLength: content.length
      };
      
    } catch (error) {
      broadcastLog('ERROR', `Failed to parse migration markdown: ${error}`);
      return {
        sections: [],
        generatedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : 'Unknown parsing error'
      };
    }
  }

  /**
   * Extract migration summary from sections
   */
  private extractMigrationSummary(sections: any[]): any {
    const summarySection = sections.find(s => 
      s.title?.toLowerCase().includes('summary') || 
      s.title?.toLowerCase().includes('overview')
    );
    
    return summarySection ? {
      title: summarySection.title,
      content: summarySection.content,
      type: 'summary'
    } : null;
  }

  /**
   * Extract code changes from sections
   */
  private extractCodeChanges(sections: any[]): any[] {
    const changes: any[] = [];
    
    sections.forEach(section => {
      if (section.content && section.content.includes('```')) {
        // This section contains code blocks
        const codeBlocks = this.extractCodeBlocks(section.content);
        if (codeBlocks.length > 0) {
          changes.push({
            sectionTitle: section.title,
            description: section.content.split('```')[0].trim(),
            codeBlocks,
            type: 'code_change'
          });
        }
      }
    });
    
    return changes;
  }

  /**
   * Extract key changes from sections
   */
  private extractKeyChanges(sections: any[]): string[] {
    const keyChangesSection = sections.find(s => 
      s.title?.toLowerCase().includes('key changes') ||
      s.title?.toLowerCase().includes('changes') ||
      s.title?.toLowerCase().includes('modifications')
    );
    
    if (!keyChangesSection) return [];
    
    // Extract bullet points or numbered lists
    const lines = keyChangesSection.content.split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line.startsWith('-') || line.startsWith('*') || /^\d+\./.test(line))
      .map((line: string) => line.replace(/^[-*\d.]\s*/, '').trim())
      .filter((line: string) => line.length > 0);
    
    return lines;
  }

  /**
   * Extract notes from sections
   */
  private extractNotes(sections: any[]): string[] {
    const notes: string[] = [];
    
    sections.forEach(section => {
      if (section.title?.toLowerCase().includes('note') ||
          section.content?.toLowerCase().includes('note:') ||
          section.content?.toLowerCase().includes('important:')) {
        
        // Extract note content
        const noteLines = section.content.split('\n')
          .filter((line: string) => line.trim().length > 0)
          .map((line: string) => line.trim());
        
        notes.push(...noteLines);
      }
    });
    
    return notes.filter(note => note.length > 0);
  }

  /**
   * Extract code blocks from content
   */
  private extractCodeBlocks(content: string): any[] {
    const codeBlocks: any[] = [];
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    let match;
    
    while ((match = codeBlockRegex.exec(content)) !== null) {
      codeBlocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        type: 'code_block'
      });
    }
    
    return codeBlocks;
  }

  /**
   * Parse markdown into structured sections
   */
  private parseMarkdownSections(content: string): any[] {
    const sections: any[] = [];
    const lines = content.split('\n');
    let currentSection: any = null;
    let currentContent: string[] = [];

    for (const line of lines) {
      if (line.startsWith('#')) {
        // Save previous section
        if (currentSection) {
          currentSection.content = currentContent.join('\n').trim();
          sections.push(currentSection);
        }

        // Start new section
        const level = (line.match(/^#+/) || [''])[0].length;
        const title = line.replace(/^#+\s*/, '').trim();
        
        currentSection = {
          type: 'heading',
          level,
          title,
          content: ''
        };
        currentContent = [];
      } else {
        currentContent.push(line);
      }
    }

    // Add the last section
    if (currentSection) {
      currentSection.content = currentContent.join('\n').trim();
      sections.push(currentSection);
    }

    return sections;
  }
}

// Export singleton instance for use in routes
export const pythonScriptService = new PythonScriptService();