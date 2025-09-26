import fs from 'fs';
import path from 'path';
import { broadcastLog } from '../utils/logger';
import { findReadmePath } from '../utils/readmeResolver';
import { GeneratedFile } from '@shared/schema';

/**
 * Smart migration report finder that uses README resolver to locate migration reports
 * Fixes MD path issues by prioritizing migration-report-*.md files in the correct directories
 */
export async function findMigrationReport(repositoryPath: string, generatedFiles: GeneratedFile[]): Promise<string | null> {
  broadcastLog('INFO', `🔍 Smart migration report finder starting...`);
  
  // 1. First priority: migration-report-*.md files in generated files
  const migrationReportFiles = generatedFiles.filter(file => 
    (file.relativePath.includes('migration-report') && 
     (file.relativePath.endsWith('.md') || file.relativePath.endsWith('.markdown')))
  );
  
  if (migrationReportFiles.length > 0) {
    const reportFile = migrationReportFiles[0]; // Take the first one
    const fullPath = path.join(repositoryPath, reportFile.relativePath);
    broadcastLog('INFO', `✅ Found migration report in generated files: ${reportFile.relativePath}`);
    return fullPath;
  }
  
  // 2. Second priority: Search in README directory and common locations
  const readmePath = findReadmePath(repositoryPath);
  const searchDirectories = [
    repositoryPath, // Root
    ...(readmePath ? [path.dirname(readmePath)] : []), // README directory
    path.join(repositoryPath, 'docs'),
    path.join(repositoryPath, 'Documentation'),
    path.join(repositoryPath, 'documentation')
  ];
  
  // Remove duplicates
  const uniqueDirectories = Array.from(new Set(searchDirectories));
  
  for (const searchDir of uniqueDirectories) {
    try {
      if (!fs.existsSync(searchDir)) {
        continue;
      }
      
      const files = fs.readdirSync(searchDir);
      const migrationFile = files.find(file => 
        file.toLowerCase().includes('migration-report') && 
        (file.endsWith('.md') || file.endsWith('.markdown'))
      );
      
      if (migrationFile) {
        const fullPath = path.join(searchDir, migrationFile);
        broadcastLog('INFO', `✅ Found migration report via directory search: ${fullPath}`);
        return fullPath;
      }
    } catch (error) {
      broadcastLog('DEBUG', `⚠️  Error searching directory ${searchDir}: ${error}`);
    }
  }
  
  // 3. Third priority: Any markdown file that looks like a report
  const allMarkdownFiles = generatedFiles.filter(file => 
    file.relativePath.endsWith('.md') || file.relativePath.endsWith('.markdown')
  );
  
  if (allMarkdownFiles.length > 0) {
    // Prioritize files with "migration", "report", "analysis" in the name
    const reportLikeFile = allMarkdownFiles.find(file => {
      const name = file.relativePath.toLowerCase();
      return name.includes('migration') || name.includes('report') || name.includes('analysis');
    });
    
    if (reportLikeFile) {
      const fullPath = path.join(repositoryPath, reportLikeFile.relativePath);
      broadcastLog('INFO', `📄 Using report-like file: ${reportLikeFile.relativePath}`);
      return fullPath;
    }
    
    // Fallback to first markdown file
    const fallbackFile = allMarkdownFiles[0];
    const fullPath = path.join(repositoryPath, fallbackFile.relativePath);
    broadcastLog('INFO', `📄 Fallback to first markdown file: ${fallbackFile.relativePath}`);
    return fullPath;
  }
  
  broadcastLog('WARN', `❌ No migration report found in any location`);
  return null;
}

/**
 * Validate that a migration report file exists and is readable
 */
export function validateMigrationReport(reportPath: string): { isValid: boolean; error?: string; size?: number } {
  try {
    if (!fs.existsSync(reportPath)) {
      return { isValid: false, error: 'File does not exist' };
    }
    
    const stats = fs.statSync(reportPath);
    if (!stats.isFile()) {
      return { isValid: false, error: 'Path is not a file' };
    }
    
    if (stats.size === 0) {
      return { isValid: false, error: 'File is empty' };
    }
    
    return { isValid: true, size: stats.size };
  } catch (error) {
    return { isValid: false, error: `Validation error: ${error}` };
  }
}