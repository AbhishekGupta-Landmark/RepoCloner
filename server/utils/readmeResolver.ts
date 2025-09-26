import fs from 'fs';
import path from 'path';
import { broadcastLog } from './logger';

/**
 * Enhanced fallback strategies for MD parsing with security improvements
 * Robust README path resolver with comprehensive search and API key masking
 */

/**
 * Mask API keys in content for security logging
 */
function maskApiKey(content: string): string {
  // Enhanced API key masking patterns for security
  return content
    .replace(/dial-[a-zA-Z0-9]{20,}/g, 'dial-***MASKED***')
    .replace(/sk-[a-zA-Z0-9]{40,}/g, 'sk-***MASKED***')
    .replace(/gpt-[a-zA-Z0-9-]{10,}/g, 'gpt-***MASKED***')
    .replace(/claude-[a-zA-Z0-9-@]{10,}/g, 'claude-***MASKED***')
    .replace(/"api[_-]?key"\s*:\s*"[^"]{10,}"/gi, '"api_key": "***MASKED***"')
    .replace(/api[_-]?key[=:]\s*[a-zA-Z0-9]{20,}/gi, 'api_key=***MASKED***');
}

export function findReadmePath(repoRoot: string): string | null {
  broadcastLog('INFO', `🔍 Enhanced README Resolver: Starting comprehensive search in ${repoRoot}`);
  
  // Enhanced fallback strategies with comprehensive search patterns
  const searchPatterns = [
    // 1. Root README files (highest priority)
    { pattern: 'README.md', location: 'root', priority: 1 },
    { pattern: 'README.markdown', location: 'root', priority: 2 },
    { pattern: 'readme.md', location: 'root', priority: 3 },
    { pattern: 'readme.markdown', location: 'root', priority: 4 },
    { pattern: 'README.txt', location: 'root', priority: 5 },
    { pattern: 'README', location: 'root', priority: 6 },
    
    // 2. docs/ directory README files  
    { pattern: path.join('docs', 'README.md'), location: 'docs', priority: 7 },
    { pattern: path.join('docs', 'README.markdown'), location: 'docs', priority: 8 },
    { pattern: path.join('docs', 'readme.md'), location: 'docs', priority: 9 },
    { pattern: path.join('docs', 'readme.markdown'), location: 'docs', priority: 10 },
    
    // 3. Documentation/ directory (Enhanced fallback strategies)
    { pattern: path.join('Documentation', 'README.md'), location: 'Documentation', priority: 11 },
    { pattern: path.join('documentation', 'README.md'), location: 'documentation', priority: 12 },
    { pattern: path.join('DOC', 'README.md'), location: 'DOC', priority: 13 },
    { pattern: path.join('doc', 'README.md'), location: 'doc', priority: 14 },
    
    // 4. Additional fallback patterns for comprehensive coverage
    { pattern: path.join('wiki', 'README.md'), location: 'wiki', priority: 15 },
    { pattern: path.join('help', 'README.md'), location: 'help', priority: 16 },
    { pattern: path.join('manual', 'README.md'), location: 'manual', priority: 17 }
  ];
  
  // Sort by priority for Enhanced fallback strategies
  searchPatterns.sort((a, b) => a.priority - b.priority);
  
  for (const { pattern, location, priority } of searchPatterns) {
    const fullPath = path.resolve(repoRoot, pattern);
    
    try {
      if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
        const fileSize = fs.statSync(fullPath).size;
        const maskedPath = maskApiKey(fullPath);
        broadcastLog('INFO', `✅ Enhanced README Resolver: Found ${pattern} in ${location} (${fileSize} bytes, priority ${priority})`);
        broadcastLog('INFO', `📍 Enhanced README Resolver: Selected path: ${maskedPath}`);
        return fullPath;
      }
    } catch (error) {
      const maskedError = maskApiKey(String(error));
      broadcastLog('DEBUG', `⚠️  Enhanced README Resolver: Error checking ${pattern}: ${maskedError}`);
    }
  }
  
  // Enhanced fallback strategies: comprehensive search for any README-like files
  try {
    const rootFiles = fs.readdirSync(repoRoot);
    const readmeFiles = rootFiles.filter(file => 
      file.toLowerCase().includes('readme') || 
      file.toLowerCase().includes('read_me') ||
      file.toLowerCase().includes('read-me') ||
      (file.toLowerCase().startsWith('readme') && 
       (file.toLowerCase().endsWith('.md') || 
        file.toLowerCase().endsWith('.markdown') ||
        file.toLowerCase().endsWith('.txt') ||
        file.toLowerCase().endsWith('.rst') ||
        file.toLowerCase() === 'readme'))
    );
    
    if (readmeFiles.length > 0) {
      // Prefer .md files in Enhanced fallback strategies
      const preferredFile = readmeFiles.find(f => f.toLowerCase().endsWith('.md')) || readmeFiles[0];
      const fallbackPath = path.resolve(repoRoot, preferredFile);
      const maskedPath = maskApiKey(fallbackPath);
      broadcastLog('INFO', `📋 Enhanced README Resolver: Fallback found: ${preferredFile} (from ${readmeFiles.length} candidates)`);
      broadcastLog('INFO', `📍 Enhanced README Resolver: Fallback path: ${maskedPath}`);
      return fallbackPath;
    }
  } catch (error) {
    const maskedError = maskApiKey(String(error));
    broadcastLog('ERROR', `❌ Enhanced README Resolver: Error during Enhanced fallback strategies: ${maskedError}`);
  }
  
  broadcastLog('WARN', `⚠️  Enhanced README Resolver: No README file found in ${repoRoot} despite Enhanced fallback strategies`);
  return null;
}

/**
 * Get README content with error handling and Enhanced fallback strategies
 */
export function getReadmeContent(readmePath: string): string | null {
  try {
    if (!readmePath || !fs.existsSync(readmePath)) {
      const maskedPath = maskApiKey(readmePath || 'null');
      broadcastLog('WARN', `⚠️  Enhanced README Content: File not found: ${maskedPath}`);
      return null;
    }
    
    const content = fs.readFileSync(readmePath, 'utf8');
    const maskedPath = maskApiKey(readmePath);
    const maskedContent = maskApiKey(content.substring(0, 200)); // Only mask first 200 chars for logging
    
    broadcastLog('INFO', `📖 Enhanced README Content: Successfully read ${content.length} characters from ${maskedPath}`);
    broadcastLog('DEBUG', `📋 Enhanced README Content Preview: ${maskedContent}...`);
    return content;
  } catch (error) {
    const maskedError = maskApiKey(String(error));
    const maskedPath = maskApiKey(readmePath);
    broadcastLog('ERROR', `❌ Enhanced README Content: Error reading ${maskedPath}: ${maskedError}`);
    return null;
  }
}

/**
 * Validate README path and return metadata with Enhanced fallback strategies
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
  
  const maskedPath = maskApiKey(readmePath);
  
  try {
    if (!fs.existsSync(readmePath)) {
      broadcastLog('WARN', `⚠️  Enhanced README Validation: File does not exist: ${maskedPath}`);
      return { isValid: false, path: readmePath, error: 'File does not exist' };
    }
    
    const stats = fs.statSync(readmePath);
    if (!stats.isFile()) {
      broadcastLog('WARN', `⚠️  Enhanced README Validation: Path is not a file: ${maskedPath}`);
      return { isValid: false, path: readmePath, error: 'Path is not a file' };
    }
    
    broadcastLog('INFO', `✅ Enhanced README Validation: Valid file found: ${maskedPath} (${stats.size} bytes)`);
    return { 
      isValid: true, 
      path: readmePath, 
      size: stats.size 
    };
  } catch (error) {
    const maskedError = maskApiKey(String(error));
    broadcastLog('ERROR', `❌ Enhanced README Validation: Error validating ${maskedPath}: ${maskedError}`);
    return { 
      isValid: false, 
      path: readmePath, 
      error: `Validation error: ${maskedError}` 
    };
  }
}