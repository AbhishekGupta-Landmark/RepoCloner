import fs from 'fs';
import path from 'path';
import { broadcastLog } from './logger';

/**
 * Robust README path resolver with clear priority and logging
 * Fixes MD file generation issues by finding the correct README file deterministically
 */
export function findReadmePath(repoRoot: string): string | null {
  broadcastLog('INFO', `🔍 README Resolver: Starting search in ${repoRoot}`);
  
  // Priority-based search patterns (case-insensitive)
  const searchPatterns = [
    // 1. Root README files (highest priority)
    { pattern: 'README.md', location: 'root' },
    { pattern: 'README.markdown', location: 'root' },
    { pattern: 'readme.md', location: 'root' },
    { pattern: 'readme.markdown', location: 'root' },
    { pattern: 'README.txt', location: 'root' },
    { pattern: 'README', location: 'root' },
    
    // 2. docs/ directory README files  
    { pattern: path.join('docs', 'README.md'), location: 'docs' },
    { pattern: path.join('docs', 'README.markdown'), location: 'docs' },
    { pattern: path.join('docs', 'readme.md'), location: 'docs' },
    { pattern: path.join('docs', 'readme.markdown'), location: 'docs' },
    
    // 3. Documentation/ directory
    { pattern: path.join('Documentation', 'README.md'), location: 'Documentation' },
    { pattern: path.join('documentation', 'README.md'), location: 'documentation' }
  ];
  
  for (const { pattern, location } of searchPatterns) {
    const fullPath = path.resolve(repoRoot, pattern);
    
    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const fileSize = fs.statSync(fullPath).size;
        broadcastLog('INFO', `✅ README Resolver: Found ${pattern} in ${location} (${fileSize} bytes)`);
        broadcastLog('INFO', `📍 README Resolver: Selected path: ${fullPath}`);
        return fullPath;
      }
    } catch (error) {
      broadcastLog('DEBUG', `⚠️  README Resolver: Error checking ${fullPath}: ${error}`);
    }
  }
  
  // Fallback: search for any README.* files in root
  try {
    const rootFiles = fs.readdirSync(repoRoot);
    const readmeFile = rootFiles.find(file => 
      file.toLowerCase().startsWith('readme') && 
      (file.toLowerCase().endsWith('.md') || 
       file.toLowerCase().endsWith('.markdown') ||
       file.toLowerCase().endsWith('.txt') ||
       file.toLowerCase() === 'readme')
    );
    
    if (readmeFile) {
      const fallbackPath = path.resolve(repoRoot, readmeFile);
      broadcastLog('INFO', `📋 README Resolver: Fallback found: ${readmeFile}`);
      broadcastLog('INFO', `📍 README Resolver: Fallback path: ${fallbackPath}`);
      return fallbackPath;
    }
  } catch (error) {
    broadcastLog('ERROR', `❌ README Resolver: Error during fallback search: ${error}`);
  }
  
  broadcastLog('WARN', `⚠️  README Resolver: No README file found in ${repoRoot}`);
  return null;
}

/**
 * Get README content with error handling
 */
export function getReadmeContent(readmePath: string): string | null {
  try {
    if (!readmePath || !fs.existsSync(readmePath)) {
      broadcastLog('WARN', `⚠️  README Content: File not found: ${readmePath}`);
      return null;
    }
    
    const content = fs.readFileSync(readmePath, 'utf8');
    broadcastLog('INFO', `📖 README Content: Successfully read ${content.length} characters from ${readmePath}`);
    return content;
  } catch (error) {
    broadcastLog('ERROR', `❌ README Content: Error reading ${readmePath}: ${error}`);
    return null;
  }
}

/**
 * Validate README path and return metadata
 */
export function validateReadmePath(readmePath: string | null): { 
  isValid: boolean; 
  path: string | null; 
  size?: number; 
  error?: string 
} {
  if (!readmePath) {
    return { isValid: false, path: null, error: 'No README path provided' };
  }
  
  try {
    if (!fs.existsSync(readmePath)) {
      return { isValid: false, path: readmePath, error: 'File does not exist' };
    }
    
    const stats = fs.statSync(readmePath);
    if (!stats.isFile()) {
      return { isValid: false, path: readmePath, error: 'Path is not a file' };
    }
    
    return { 
      isValid: true, 
      path: readmePath, 
      size: stats.size 
    };
  } catch (error) {
    return { 
      isValid: false, 
      path: readmePath, 
      error: `Validation error: ${error}` 
    };
  }
}