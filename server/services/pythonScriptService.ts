import path from 'path';
import * as fs from 'fs';
import { broadcastLog } from '../utils/logger';
import { findReadmePath, getReadmeContent, validateReadmePath } from '../utils/readmeResolver';
import { findMigrationReport, validateMigrationReport } from './migrationReportFinder';
import { 
  GeneratedFile, 
  PythonScriptResult, 
  MigrationReportData, 
  ParsedMigrationReport,
  KafkaUsageItem as ParsedKafkaUsageItem,
  CodeDiff as ParsedCodeDiff
} from '@shared/schema';

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
  private apiBaseUrl = 'http://127.0.0.1:8000/hello';

  /**
   * Execute a Python script via API call instead of local execution
   */
  async executePythonScript(options: PythonExecutionOptions): Promise<PythonExecutionResult> {
    broadcastLog('INFO', 'Starting API call to Python service');
    
    try {
      const executionStartTime = Date.now();

      // Prepare API request payload
      const payload = {
        workingDirectory: options.workingDirectory || process.cwd(),
        args: options.args || [],
        scriptPath: options.scriptPath,
        scriptContent: options.scriptContent,
        timeout: options.timeout || this.defaultTimeout
      };

      broadcastLog('INFO', `Making API call to ${this.apiBaseUrl}/execute`);
      broadcastLog('INFO', `Working directory: ${payload.workingDirectory}`);

      // Make API call to Python service
      const response = await fetch(this.apiBaseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(payload.timeout)
      });

      const executionEndTime = Date.now();

      if (!response.ok) {
        const errorText = await response.text();
        broadcastLog('ERROR', `API call failed with status ${response.status}: ${errorText}`);
        return {
          success: false,
          error: `API call failed with status ${response.status}: ${errorText}`,
          exitCode: response.status,
          executionStartTime,
          executionEndTime
        };
      }

      const result = await response.json();
      
      broadcastLog('INFO', 'API call completed successfully');
      if (result.output) {
        broadcastLog('INFO', `API response output: ${result.output.substring(0, 500)}...`);
      }

      return {
        success: result.success || true,
        output: result.output,
        error: result.error,
        exitCode: result.exitCode || 0,
        generatedFiles: result.generatedFiles || [],
        executionStartTime,
        executionEndTime
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      broadcastLog('ERROR', `API call error: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage,
        executionStartTime: Date.now(),
        executionEndTime: Date.now()
      };
    }
  }

  /**
   * Execute migration analysis via API call instead of local Python script
   */
  async executePostCloneScript(repositoryPath: string, repositoryUrl: string, repositoryId?: string, aiSettings?: any, analysisType: string = 'default'): Promise<PythonExecutionResult> {
    broadcastLog('INFO', `🔄 Starting Python script execution for migration analysis...`);
    broadcastLog('INFO', `Executing post-clone Python script for repository: ${repositoryUrl}`);
    broadcastLog('INFO', `Selected analysis type: ${analysisType}`);
    
    // Use analysisRegistry to get the correct script path
    const { analysisRegistry } = await import('./analysisRegistry');
    const analysisTypeInfo = await analysisRegistry.getTypeById(analysisType);
    
    if (!analysisTypeInfo) {
      broadcastLog('ERROR', `Analysis type '${analysisType}' not found in registry`);
      return {
        success: false,
        error: `Analysis type '${analysisType}' not found. Available types: default, quick-migration-1`,
        exitCode: -1
      };
    }
    
    const scriptPath = analysisTypeInfo.scriptPath;
    broadcastLog('INFO', `Using Python script: ${scriptPath} (${analysisTypeInfo.label})`);
    
    if (await this.fileExists(scriptPath)) {
      broadcastLog('INFO', `✅ Script file exists: ${scriptPath}`);
      
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
        broadcastLog('INFO', `Final script command: python ${scriptPath} ${maskedArgs.join(' ')}`);
      } else {
        broadcastLog('ERROR', 'AI settings are required for migration analysis');
        return {
          success: false,
          error: `Migration analysis API failed with status ${response.status}: ${errorText}`,
          exitCode: response.status,
          executionStartTime,
          executionEndTime
        };
      }

      const result = await response.json();
      
      broadcastLog('INFO', `🐍 About to execute Python script with ${scriptArgs.length} arguments`);
      broadcastLog('INFO', `🐍 Script path: ${scriptPath}`);
      
      const result = await this.executePythonScript({
        scriptPath: scriptPath,
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
      } else {
        broadcastLog('WARN', `⚠️  README resolver issue: ${readmeValidation.error || 'No README file found'}`);
        broadcastLog('INFO', `📁 Using default report directory: ${reportDirectory}`);
      }
      
      // Check for generated migration report files (supports both timestamped and non-timestamped)
      broadcastLog('INFO', `🐍 Checking for migration report files in: ${repositoryPath}`);
      
      // Check if migration report file was created
      try {
        const fs = await import('fs');
        const files = await fs.promises.readdir(repositoryPath);
        const migrationReports = files.filter(file => 
          (file.startsWith('migration-report') || file.startsWith('quick-migration-report')) && file.endsWith('.md')
        );
        
        if (migrationReports.length > 0) {
          for (const reportFile of migrationReports) {
            const stats = await fs.promises.stat(path.join(repositoryPath, reportFile));
            broadcastLog('INFO', `✅ Migration report found: ${reportFile} (${stats.size} bytes)`);
          }
        } else {
          broadcastLog('WARN', `⚠️  No migration report files found matching pattern: migration-report*.md`);
        }
      } catch (error) {
        broadcastLog('ERROR', `🐍 Error checking for migration report files: ${error}`);
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
        error: `Migration analysis API error: ${errorMessage}`,
        exitCode: -1,
        executionStartTime: Date.now(),
        executionEndTime: Date.now()
      };
    }
  }

  /**
   * Check if Python API service is available
   */
  async checkPythonAvailability(): Promise<{ available: boolean; version?: string; error?: string }> {
    try {
      broadcastLog('INFO', `Checking Python API availability at ${this.apiBaseUrl}`);
      
      const response = await fetch(this.apiBaseUrl, {
        method: 'GET',
        signal: AbortSignal.timeout(5000)
      });

      if (response.ok) {
        const healthData = await response.json();
        const version = healthData.version || healthData.python_version || 'Unknown';
        
        broadcastLog('INFO', `Python API service available: ${version}`);
        return {
          available: true,
          version: `API Service ${version}`
        };
      } else {
        const errorText = await response.text();
        broadcastLog('WARN', `Python API service responded with status ${response.status}: ${errorText}`);
        return {
          available: false,
          error: `API service responded with status ${response.status}`
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('WARN', `Python API service not available: ${errorMessage}`);
      return {
        available: false,
        error: `Failed to connect to API service: ${errorMessage}`
      };
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
      const structuredData = await this.extractStructuredData(reportContent);

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
            apisUsed: item.apis_used || '',
            summary: item.summary || ''
          } as ParsedKafkaUsageItem)),
          codeDiffs: structuredData.code_diffs.map(diff => ({
            file: diff.file,
            diffContent: diff.diff_content,
            language: diff.language
          } as ParsedCodeDiff)),
          sections: structuredData.sections,
          stats: {
            totalFilesWithKafka: structuredData.stats.total_files_with_kafka,
            totalFilesWithDiffs: structuredData.stats.total_files_with_diffs,
            sectionsCount: structuredData.stats.sections_count
          }
        } as ParsedMigrationReport : undefined
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
   * Extract structured data from migration report content
   */
  private async extractStructuredData(reportContent: string): Promise<MigrationReportData | null> {
    try {
      // Parse migration report sections using regex patterns
      const titleMatch = reportContent.match(/^#\s+(.+)$/m);
      const title = titleMatch ? titleMatch[1] : 'Kafka to Azure Service Bus Migration Analysis';

      // CRITICAL: Try to extract JSON block first (for default2.py reports)
      const jsonBlockMatch = reportContent.match(/```json\s*\n([\s\S]*?)\n```/);
      
      if (jsonBlockMatch) {
        // Parse JSON structure from default2.py
        try {
          const jsonData = JSON.parse(jsonBlockMatch[1]);
          broadcastLog('INFO', `📦 Found JSON block in report - parsing default2.py format`);
          
          // Map inventory array to kafka_inventory
          const kafkaInventory = (jsonData.inventory || []).map((item: any) => ({
            file: item.file,
            apis_used: Array.isArray(item.kafka_apis) ? item.kafka_apis.join(', ') : item.kafka_apis,
            summary: item.summary || ''
          }));
          
          // Map diffs array to code_diffs
          const codeDiffs = (jsonData.diffs || []).map((item: any) => ({
            file: item.file,
            diff_content: item.diff || '',
            migrated_code: item.migrated_code || '',  // Include full migrated code
            description: item.description || '',
            key_changes: item.key_changes || [],
            language: this.inferLanguageFromFile(item.file),
            hunks: this.parseDiffHunks(item.diff || ''),
            stats: this.calculateDiffStats(item.diff || '')
          }));
          
          // Parse markdown sections for AI results and package changes
          const sections: any = {};
          
          // Extract AI-Powered Analysis Results section
          const aiSectionMatch = reportContent.match(/###\s*AI-Powered Analysis Results\s*\n([\s\S]*?)(?=###|##|```json|$)/i);
          if (aiSectionMatch && aiSectionMatch[1].trim()) {
            sections.ai_powered = {
              title: 'AI-Powered Analysis Results',
              content: aiSectionMatch[1].trim()
            };
          }
          
          // Extract NuGet Package Changes section
          const packageSectionMatch = reportContent.match(/###\s*NuGet Package Changes\s*\n([\s\S]*?)(?=###|##|```json|$)/i);
          if (packageSectionMatch && packageSectionMatch[1].trim()) {
            sections.package_changes = {
              title: 'NuGet Package Changes',
              content: packageSectionMatch[1].trim()
            };
          }
          
          // Extract Manual Keyword Detection section
          const manualSectionMatch = reportContent.match(/###\s*Manual Keyword Detection\s*\n([\s\S]*?)(?=###|##|```json|$)/i);
          if (manualSectionMatch && manualSectionMatch[1].trim()) {
            sections.manual_detection = {
              title: 'Manual Keyword Detection',
              content: manualSectionMatch[1].trim()
            };
          }
          
          const structuredData: MigrationReportData = {
            title,
            kafka_inventory: kafkaInventory,
            code_diffs: codeDiffs,
            sections,
            stats: {
              total_files_with_kafka: kafkaInventory.length,
              total_files_with_diffs: codeDiffs.length,
              sections_count: Object.keys(sections).length
            }
          };
          
          broadcastLog('INFO', `✅ Parsed JSON format: ${kafkaInventory.length} inventory items, ${codeDiffs.length} diffs, ${Object.keys(sections).length} sections`);
          return structuredData;
        } catch (jsonError) {
          broadcastLog('WARN', `Failed to parse JSON block, falling back to markdown parsing: ${jsonError}`);
          // Fall through to markdown parsing
        }
      }

      // FALLBACK: Extract Kafka inventory from markdown table (for default.py reports)
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
        const diffMatch = /```diff[\r\n]+([\s\S]*?)[\r\n]+```/.exec(sectionContent);
        let diffContent = diffMatch ? diffMatch[1] : '';
        
        // Get description (everything before the diff block)
        let description = diffMatch ? sectionContent.substring(0, diffMatch.index).trim() : sectionContent;
        
        // Extract key changes - check multiple locations
        let keyChanges: string[] = [];
        
        // 1. First check for explicit "Key Changes:" header in description
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
        
        // 3. CRITICAL: Check for summary lines INSIDE the diff content (at the beginning, before actual diff syntax)
        // These look like: "- Replaced Kafka..." "- Added message..." but appear before @@ or --- markers
        if (keyChanges.length === 0 && diffContent) {
          const diffLines = diffContent.split(/\r?\n/);
          const summaryLines: string[] = [];
          let foundActualDiff = false;
          
          for (const line of diffLines) {
            const trimmed = line.trim();
            
            // Check if we've hit actual diff syntax
            if (trimmed.startsWith('@@') || trimmed.startsWith('---') || trimmed.startsWith('+++') || trimmed.match(/^diff\s+/)) {
              foundActualDiff = true;
              break;
            }
            
            // Collect lines that look like summary bullets (but not empty lines)
            if (trimmed && (trimmed.startsWith('-') || trimmed.startsWith('*') || trimmed.startsWith('•'))) {
              // Check if it's a descriptive summary (contains words like "Replaced", "Added", "Used", "Implemented", "Updated", "Removed", "Changed", "Fixed")
              if (/^[-*•]\s*(Replaced|Added|Used|Implemented|Updated|Removed|Changed|Fixed|Created|Modified|Introduced|Migrated|Converted)/i.test(trimmed)) {
                summaryLines.push(trimmed);
              }
            }
          }
          
          if (summaryLines.length > 0) {
            keyChanges = summaryLines.map(line => line.replace(/^[-*•]\s*/, '').trim());
            
            // Remove these summary lines from diff content
            const summaryBlock = summaryLines.join('\n');
            diffContent = diffContent.replace(new RegExp(summaryLines.map(l => l.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('[\\r\\n]+'), 'g'), '').trim();
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
        sections: {},
        stats: {
          total_files_with_kafka: kafkaInventory.length,
          total_files_with_diffs: codeDiffs.length,
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
    storage: any,
    analysisTypeLabel?: string,
    analysisTypeId?: string
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
        const parsedMigrationData = await this.extractStructuredData(fileContent);
        
        if (!parsedMigrationData) {
          throw new Error('Failed to extract structured data from migration report');
        }
        
        // Set the parsed data directly on the pythonResult object (this is where the API expects it)
        (pythonResult as any).parsedMigrationData = parsedMigrationData;
        
        // Add analysis type label to parsed data for display
        if (analysisTypeLabel) {
          parsedMigrationData.analysisTypeLabel = analysisTypeLabel;
        }
        
        broadcastLog('INFO', `✅ Successfully parsed migration data: ${parsedMigrationData.code_diffs?.length || 0} diffs, ${parsedMigrationData.kafka_inventory?.length || 0} files with Kafka`);
        
        // CRITICAL FIX: Use the actual analysisTypeId from the dropdown selection
        // instead of deriving from filename (which caused mismatch between frontend query and backend storage)
        const reportAnalysisType = analysisTypeId || 'default';
        broadcastLog('INFO', `📝 Storing report with analysisType: ${reportAnalysisType}`);
        
        // Create analysis report in database and return its ID
        const report = await storage.createAnalysisReport({
          repositoryId,
          analysisType: reportAnalysisType as any,
          results: {
            pythonScriptOutput: {
              ...pythonResult,
              parsedMigrationData,
              analysisTypeLabel: analysisTypeLabel || 'Migration Analysis' // Store label for retrieval
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