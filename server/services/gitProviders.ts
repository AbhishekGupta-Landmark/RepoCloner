import { GitProvider, AuthCredentials, AuthResult, CloneOptions, CloneResult, FileNode } from "@shared/schema";
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { broadcastLog } from "../routes";

const execFileAsync = promisify(execFile);

// Security helper function to safely log URLs by masking credentials
function safeLogUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // If URL contains credentials, mask them
    if (parsedUrl.username || parsedUrl.password) {
      // Create a safe version with masked credentials
      const safeUrl = new URL(url);
      safeUrl.username = parsedUrl.username ? '***' : '';
      safeUrl.password = parsedUrl.password ? '***' : '';
      return safeUrl.toString();
    }
    
    // If no credentials, return original URL
    return url;
  } catch (error) {
    // If URL parsing fails, return a generic masked version
    return '[MASKED_URL]';
  }
}

// Post-clone verification functions
async function verifyRepositoryIsNotBare(repoPath: string): Promise<boolean> {
  try {
    const { stdout } = await execFileAsync('git', ['rev-parse', '--is-bare-repository'], {
      cwd: repoPath
    });
    const isBare = stdout.trim() === 'true';
    return !isBare;
  } catch (error) {
    broadcastLog('WARN', `Failed to verify repository bare status: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

async function verifyRepositoryHasWorkingFiles(repoPath: string): Promise<boolean> {
  try {
    const items = await fs.promises.readdir(repoPath, { withFileTypes: true });
    // Count non-.git files and directories
    const workingItems = items.filter(item => !item.name.startsWith('.git'));
    const hasWorkingFiles = workingItems.length > 0;
    
    if (!hasWorkingFiles) {
      broadcastLog('WARN', 'Repository verification: No working files found (only .git directory)');
    }
    
    return hasWorkingFiles;
  } catch (error) {
    broadcastLog('WARN', `Failed to verify repository working files: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return false;
  }
}

// Security helper functions
function sanitizeUrl(url: string): string {
  try {
    const parsedUrl = new URL(url);
    
    // Only allow specific protocols
    if (!['https:', 'http:'].includes(parsedUrl.protocol)) {
      throw new Error('Only HTTP and HTTPS protocols are allowed');
    }
    
    // Return the cleaned URL
    return parsedUrl.toString();
  } catch (error) {
    throw new Error('Invalid URL format');
  }
}

function validateGitHubUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Allow only github.com domain and its subdomains
    if (!parsedUrl.hostname.endsWith('github.com') && parsedUrl.hostname !== 'github.com') {
      return false;
    }
    
    // Basic path validation for GitHub repositories
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return false; // Need at least owner/repo
    }
    
    return true;
  } catch {
    return false;
  }
}

function validateGitLabUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Allow only gitlab.com domain and its subdomains
    if (!parsedUrl.hostname.endsWith('gitlab.com') && parsedUrl.hostname !== 'gitlab.com') {
      return false;
    }
    
    // Basic path validation for GitLab repositories
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return false; // Need at least owner/repo
    }
    
    return true;
  } catch {
    return false;
  }
}

function validateAzureDevOpsUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Allow only Azure DevOps domains
    const isDevAzureCom = parsedUrl.hostname === 'dev.azure.com';
    const isVisualStudioCom = parsedUrl.hostname.endsWith('.visualstudio.com');
    
    if (!isDevAzureCom && !isVisualStudioCom) {
      return false;
    }
    
    // Basic path validation for Azure DevOps repositories
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return false; // Need at least organization/project
    }
    
    return true;
  } catch {
    return false;
  }
}

function validateBitbucketUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Allow only bitbucket.org domain and its subdomains
    if (!parsedUrl.hostname.endsWith('bitbucket.org') && parsedUrl.hostname !== 'bitbucket.org') {
      return false;
    }
    
    // Basic path validation for Bitbucket repositories
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return false; // Need at least workspace/repo
    }
    
    return true;
  } catch {
    return false;
  }
}

function validateGiteaUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Basic path validation for Git repositories (Gitea can be self-hosted)
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return false; // Need at least owner/repo
    }
    
    // Check if the URL ends with .git or has typical Git URL structure
    const isGitUrl = parsedUrl.pathname.endsWith('.git') || 
                    pathParts.length >= 2; // owner/repo structure
    
    return isGitUrl;
  } catch {
    return false;
  }
}

function validateCodebergUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Allow only codeberg.org domain
    if (parsedUrl.hostname !== 'codeberg.org') {
      return false;
    }
    
    // Basic path validation for Codeberg repositories
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return false; // Need at least owner/repo
    }
    
    return true;
  } catch {
    return false;
  }
}

function validateSourceHutUrl(url: string): boolean {
  try {
    const parsedUrl = new URL(url);
    
    // Allow git.sr.ht domain
    if (parsedUrl.hostname !== 'git.sr.ht') {
      return false;
    }
    
    // Basic path validation for SourceHut repositories
    const pathParts = parsedUrl.pathname.split('/').filter(part => part.length > 0);
    if (pathParts.length < 2) {
      return false; // Need at least ~user/repo
    }
    
    return true;
  } catch {
    return false;
  }
}

export class GitHubProvider implements GitProvider {
  name = "GitHub";

  validateUrl(url: string): boolean {
    return validateGitHubUrl(url);
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    broadcastLog('INFO', `Starting GitHub authentication using ${credentials.type.toUpperCase()}`);
    
    try {
      switch (credentials.type) {
        case 'oauth':
          // OAuth implementation would redirect to GitHub OAuth flow
          // For now, return not implemented since Replit connector was dismissed
          broadcastLog('WARN', 'GitHub OAuth not configured - redirecting to PAT token authentication');
          return { success: false, error: "GitHub OAuth requires manual setup - please use PAT token instead" };

        case 'pat':
          if (!credentials.token) {
            broadcastLog('ERROR', 'Personal Access Token is missing');
            return { success: false, error: "Personal Access Token is required" };
          }
          
          // Validate PAT by making a simple API call
          const response = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `token ${credentials.token}`,
              'User-Agent': 'Git-Cloner-App'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            broadcastLog('INFO', `GitHub authentication successful for user: ${userData.login}`);
            return {
              success: true,
              username: userData.login,
              token: credentials.token
            };
          } else {
            broadcastLog('ERROR', `GitHub API responded with status ${response.status}: Invalid PAT`);
            return { success: false, error: "Invalid Personal Access Token" };
          }

        case 'credentials':
          broadcastLog('ERROR', 'Username/password authentication attempted - not supported by GitHub');
          return { success: false, error: "Username/password authentication is deprecated by GitHub" };

        default:
          broadcastLog('ERROR', `Unsupported authentication method: ${credentials.type}`);
          return { success: false, error: "Unsupported authentication method" };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
      broadcastLog('ERROR', `GitHub authentication failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async cloneRepository(url: string, options: CloneOptions): Promise<CloneResult> {
    broadcastLog('INFO', `Starting repository clone operation for: ${safeLogUrl(url)}`);
    
    try {
      // Validate and sanitize the URL
      if (!validateGitHubUrl(url)) {
        broadcastLog('ERROR', `Invalid GitHub URL provided: ${safeLogUrl(url)}`);
        return {
          success: false,
          error: "Invalid or unsafe repository URL. Only GitHub repositories are allowed."
        };
      }

      const sanitizedUrl = sanitizeUrl(url);
      const tempDir = path.join(process.cwd(), 'temp', `clone_${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });
      


      // Build git arguments safely without shell interpretation
      const gitArgs = ['clone'];
      
      // Handle mirror option for personal account cloning (like C# code)
      if (options.mirror) {

        gitArgs.push('--mirror');
      } else {
        // For technology detection only, use shallow clone

        gitArgs.push('--depth=1');
      }
      
      // Add the sanitized URL and destination directory as separate arguments
      gitArgs.push(sanitizedUrl);
      gitArgs.push(tempDir);


      // Use execFile instead of exec to prevent shell injection
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        broadcastLog('ERROR', `Git clone failed: ${stderr}`);
        throw new Error(stderr);
      }

      broadcastLog('INFO', `Repository cloned successfully to: ${tempDir}`);
      return {
        success: true,
        localPath: tempDir,
        remoteUrl: sanitizedUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
      broadcastLog('ERROR', `Repository clone failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getFileStructure(repoPath: string): Promise<FileNode[]> {
    broadcastLog('INFO', `Analyzing file structure for repository: ${path.basename(repoPath)}`);
    
    try {
      const buildTree = async (dirPath: string, relativePath: string = ''): Promise<FileNode[]> => {
        const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
        const nodes: FileNode[] = [];

        for (const item of items) {
          if (item.name.startsWith('.git')) continue;

          const fullPath = path.join(dirPath, item.name);
          const itemRelativePath = path.join(relativePath, item.name);

          if (item.isDirectory()) {
            const children = await buildTree(fullPath, itemRelativePath);
            nodes.push({
              name: item.name,
              type: 'directory',
              path: itemRelativePath,
              children
            });
          } else {
            const stats = await fs.promises.stat(fullPath);
            nodes.push({
              name: item.name,
              type: 'file',
              path: itemRelativePath,
              size: stats.size
            });
          }
        }

        return nodes.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
      };

      const fileStructure = await buildTree(repoPath);
      const fileCount = this.countFiles(fileStructure);
      const dirCount = this.countDirectories(fileStructure);
      
      broadcastLog('INFO', `File structure analysis complete: ${fileCount} files, ${dirCount} directories`);
      return fileStructure;
    } catch (error) {
      const errorMessage = `Failed to analyze file structure: ${error instanceof Error ? error.message : 'Unknown error'}`;
      broadcastLog('ERROR', errorMessage);
      throw new Error(errorMessage);
    }
  }

  private countFiles(nodes: FileNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'file') {
        count++;
      } else if (node.children) {
        count += this.countFiles(node.children);
      }
    }
    return count;
  }

  private countDirectories(nodes: FileNode[]): number {
    let count = 0;
    for (const node of nodes) {
      if (node.type === 'directory') {
        count++;
        if (node.children) {
          count += this.countDirectories(node.children);
        }
      }
    }
    return count;
  }
}

export class GitLabProvider implements GitProvider {
  name = "GitLab";

  validateUrl(url: string): boolean {
    return validateGitLabUrl(url);
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      switch (credentials.type) {
        case 'oauth':
          // For OAuth, we assume token validation happens in the route handler
          // This method is called after OAuth callback with the access token
          if (!credentials.token) {
            return { success: false, error: "OAuth access token is required" };
          }
          
          const oauthResponse = await fetch('https://gitlab.com/api/v4/user', {
            headers: {
              'Authorization': `Bearer ${credentials.token}`,
            }
          });
          
          if (oauthResponse.ok) {
            const userData = await oauthResponse.json();
            return {
              success: true,
              username: userData.username,
              token: credentials.token
            };
          } else {
            return { success: false, error: "Invalid OAuth access token" };
          }

        case 'pat':
          if (!credentials.token) {
            return { success: false, error: "Personal Access Token is required" };
          }
          
          const response = await fetch('https://gitlab.com/api/v4/user', {
            headers: {
              'Authorization': `Bearer ${credentials.token}`,
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            return {
              success: true,
              username: userData.username,
              token: credentials.token
            };
          } else {
            return { success: false, error: "Invalid Personal Access Token" };
          }

        case 'credentials':
          return { success: false, error: "Username/password authentication requires additional implementation" };

        default:
          return { success: false, error: "Unsupported authentication method" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed"
      };
    }
  }

  async cloneRepository(url: string, options: CloneOptions): Promise<CloneResult> {
    try {
      // Validate and sanitize the URL
      if (!validateGitLabUrl(url)) {
        return {
          success: false,
          error: "Invalid or unsafe repository URL. Only GitLab repositories are allowed."
        };
      }

      const sanitizedUrl = sanitizeUrl(url);
      const tempDir = path.join(process.cwd(), 'temp', `clone_${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Build git arguments safely without shell interpretation
      const gitArgs = ['clone'];
      
      if (options.mirror) {
        gitArgs.push('--mirror');
      } else {
        // For technology detection only, use shallow clone
        gitArgs.push('--depth=1');
      }
      
      // Add the sanitized URL and destination directory as separate arguments
      gitArgs.push(sanitizedUrl);
      gitArgs.push(tempDir);

      // Use execFile instead of exec to prevent shell injection
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        throw new Error(stderr);
      }

      return {
        success: true,
        localPath: tempDir,
        remoteUrl: sanitizedUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Clone operation failed"
      };
    }
  }

  async getFileStructure(repoPath: string): Promise<FileNode[]> {
    return new GitHubProvider().getFileStructure(repoPath);
  }
}

export class AzureDevOpsProvider implements GitProvider {
  name = "Azure DevOps";

  validateUrl(url: string): boolean {
    return validateAzureDevOpsUrl(url);
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    try {
      switch (credentials.type) {
        case 'oauth':
          // For OAuth, we assume token validation happens in the route handler
          // This method is called after OAuth callback with the access token
          if (!credentials.token) {
            return { success: false, error: "OAuth access token is required" };
          }
          
          const oauthResponse = await fetch('https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0', {
            headers: {
              'Authorization': `Bearer ${credentials.token}`,
              'Accept': 'application/json'
            }
          });
          
          if (oauthResponse.ok) {
            const userData = await oauthResponse.json();
            return {
              success: true,
              username: userData.displayName || userData.publicAlias || 'Azure DevOps User',
              token: credentials.token
            };
          } else {
            return { success: false, error: "Invalid OAuth access token" };
          }

        case 'pat':
          if (!credentials.token) {
            return { success: false, error: "Personal Access Token is required" };
          }
          
          // For PAT authentication, we need to test with a simple API call
          // Azure DevOps PAT uses Basic auth with empty username and PAT as password
          const patAuth = Buffer.from(`:${credentials.token}`).toString('base64');
          
          const response = await fetch('https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0', {
            headers: {
              'Authorization': `Basic ${patAuth}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            return {
              success: true,
              username: userData.displayName || userData.publicAlias || 'Azure DevOps User',
              token: credentials.token
            };
          } else {
            return { success: false, error: "Invalid Personal Access Token" };
          }

        case 'credentials':
          return { success: false, error: "Username/password authentication requires additional implementation" };

        default:
          return { success: false, error: "Unsupported authentication method" };
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Authentication failed"
      };
    }
  }

  async cloneRepository(url: string, options: CloneOptions): Promise<CloneResult> {
    try {
      // Validate and sanitize the URL
      if (!validateAzureDevOpsUrl(url)) {
        return {
          success: false,
          error: "Invalid or unsafe repository URL. Only Azure DevOps repositories are allowed."
        };
      }

      const sanitizedUrl = sanitizeUrl(url);
      const tempDir = path.join(process.cwd(), 'temp', `clone_${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });

      // Build git arguments safely without shell interpretation
      const gitArgs = ['clone'];
      
      if (options.mirror) {
        gitArgs.push('--mirror');
      } else {
        // For technology detection only, use shallow clone
        gitArgs.push('--depth=1');
      }
      
      // Add the sanitized URL and destination directory as separate arguments
      gitArgs.push(sanitizedUrl);
      gitArgs.push(tempDir);

      // Use execFile instead of exec to prevent shell interpretation
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        throw new Error(stderr);
      }

      return {
        success: true,
        localPath: tempDir,
        remoteUrl: sanitizedUrl
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Clone operation failed"
      };
    }
  }

  async getFileStructure(repoPath: string): Promise<FileNode[]> {
    return new GitHubProvider().getFileStructure(repoPath);
  }
}

export class BitbucketProvider implements GitProvider {
  name = "Bitbucket";

  validateUrl(url: string): boolean {
    return validateBitbucketUrl(url);
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    broadcastLog('INFO', `Starting Bitbucket authentication using ${credentials.type.toUpperCase()}`);
    
    try {
      switch (credentials.type) {
        case 'oauth':
          // For OAuth, we assume token validation happens in the route handler
          if (!credentials.token) {
            broadcastLog('ERROR', 'OAuth access token is missing');
            return { success: false, error: "OAuth access token is required" };
          }
          
          const oauthResponse = await fetch('https://api.bitbucket.org/2.0/user', {
            headers: {
              'Authorization': `Bearer ${credentials.token}`,
              'Accept': 'application/json'
            }
          });
          
          if (oauthResponse.ok) {
            const userData = await oauthResponse.json();
            broadcastLog('INFO', `Bitbucket authentication successful for user: ${userData.username}`);
            return {
              success: true,
              username: userData.username,
              token: credentials.token
            };
          } else {
            broadcastLog('ERROR', `Bitbucket API responded with status ${oauthResponse.status}: Invalid OAuth token`);
            return { success: false, error: "Invalid OAuth access token" };
          }

        case 'pat':
          if (!credentials.token) {
            broadcastLog('ERROR', 'Personal Access Token is missing');
            return { success: false, error: "Personal Access Token is required" };
          }
          
          // Bitbucket uses App Passwords, which are similar to PATs
          // Need username:app_password for Basic auth
          if (!credentials.username) {
            broadcastLog('ERROR', 'Username is required for Bitbucket App Password authentication');
            return { success: false, error: "Username is required for Bitbucket App Password authentication" };
          }
          
          const basicAuth = Buffer.from(`${credentials.username}:${credentials.token}`).toString('base64');
          const response = await fetch('https://api.bitbucket.org/2.0/user', {
            headers: {
              'Authorization': `Basic ${basicAuth}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            broadcastLog('INFO', `Bitbucket authentication successful for user: ${userData.username}`);
            return {
              success: true,
              username: userData.username,
              token: credentials.token
            };
          } else {
            broadcastLog('ERROR', `Bitbucket API responded with status ${response.status}: Invalid credentials`);
            return { success: false, error: "Invalid App Password or username" };
          }

        case 'credentials':
          broadcastLog('ERROR', 'Username/password authentication attempted - use App Password instead');
          return { success: false, error: "Use App Password instead of regular password" };

        default:
          broadcastLog('ERROR', `Unsupported authentication method: ${credentials.type}`);
          return { success: false, error: "Unsupported authentication method" };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
      broadcastLog('ERROR', `Bitbucket authentication failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async cloneRepository(url: string, options: CloneOptions): Promise<CloneResult> {
    broadcastLog('INFO', `Starting repository clone operation for: ${url}`);
    
    try {
      // Validate and sanitize the URL
      if (!validateBitbucketUrl(url)) {
        broadcastLog('ERROR', `Invalid Bitbucket URL provided: ${url}`);
        return {
          success: false,
          error: "Invalid or unsafe repository URL. Only Bitbucket repositories are allowed."
        };
      }

      const sanitizedUrl = sanitizeUrl(url);
      const tempDir = path.join(process.cwd(), 'temp', `clone_${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });
      


      // Build git arguments safely without shell interpretation
      const gitArgs = ['clone'];
      
      // Handle mirror option for personal account cloning (like C# code)
      if (options.mirror) {

        gitArgs.push('--mirror');
      } else {
        // For technology detection only, use shallow clone

        gitArgs.push('--depth=1');
      }
      
      // Add the sanitized URL and destination directory as separate arguments
      gitArgs.push(sanitizedUrl);
      gitArgs.push(tempDir);


      // Use execFile instead of exec to prevent shell injection
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        broadcastLog('ERROR', `Git clone failed: ${stderr}`);
        throw new Error(stderr);
      }

      broadcastLog('INFO', `Repository cloned successfully to: ${tempDir}`);
      return {
        success: true,
        localPath: tempDir,
        remoteUrl: sanitizedUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
      broadcastLog('ERROR', `Repository clone failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getFileStructure(repoPath: string): Promise<FileNode[]> {
    return new GitHubProvider().getFileStructure(repoPath);
  }
}

export class GiteaProvider implements GitProvider {
  name = "Gitea";

  validateUrl(url: string): boolean {
    return validateGiteaUrl(url);
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    broadcastLog('INFO', `Starting Gitea authentication using ${credentials.type.toUpperCase()}`);
    
    try {
      switch (credentials.type) {
        case 'oauth':
          // OAuth implementation would depend on the specific Gitea instance
          broadcastLog('WARN', 'Gitea OAuth requires instance-specific configuration');
          return { success: false, error: "Gitea OAuth requires manual setup for specific instance" };

        case 'pat':
          if (!credentials.token) {
            broadcastLog('ERROR', 'Personal Access Token is missing');
            return { success: false, error: "Personal Access Token is required" };
          }
          
          // Extract base URL from potential git URL to build API endpoint
          // This is a simplified approach - in production, you'd want more robust URL parsing
          return {
            success: true,
            username: 'gitea-user', // Placeholder since we can't validate without knowing the instance
            token: credentials.token
          };

        case 'credentials':
          broadcastLog('ERROR', 'Username/password authentication not recommended for Gitea');
          return { success: false, error: "Use Personal Access Token for better security" };

        default:
          broadcastLog('ERROR', `Unsupported authentication method: ${credentials.type}`);
          return { success: false, error: "Unsupported authentication method" };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
      broadcastLog('ERROR', `Gitea authentication failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async cloneRepository(url: string, options: CloneOptions): Promise<CloneResult> {
    broadcastLog('INFO', `Starting repository clone operation for: ${url}`);
    
    try {
      // Validate URL structure (can't validate domain since Gitea is self-hosted)
      if (!validateGiteaUrl(url)) {
        broadcastLog('ERROR', `Invalid Git repository URL provided: ${url}`);
        return {
          success: false,
          error: "Invalid repository URL structure."
        };
      }

      const sanitizedUrl = sanitizeUrl(url);
      const tempDir = path.join(process.cwd(), 'temp', `clone_${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });
      


      // Build git arguments safely without shell interpretation
      const gitArgs = ['clone'];
      
      // Handle mirror option for personal account cloning (like C# code)
      if (options.mirror) {

        gitArgs.push('--mirror');
      } else {
        // For technology detection only, use shallow clone

        gitArgs.push('--depth=1');
      }
      
      // Add the sanitized URL and destination directory as separate arguments
      gitArgs.push(sanitizedUrl);
      gitArgs.push(tempDir);


      // Use execFile instead of exec to prevent shell injection
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        broadcastLog('ERROR', `Git clone failed: ${stderr}`);
        throw new Error(stderr);
      }

      broadcastLog('INFO', `Repository cloned successfully to: ${tempDir}`);
      return {
        success: true,
        localPath: tempDir,
        remoteUrl: sanitizedUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
      broadcastLog('ERROR', `Repository clone failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getFileStructure(repoPath: string): Promise<FileNode[]> {
    return new GitHubProvider().getFileStructure(repoPath);
  }
}

export class CodebergProvider implements GitProvider {
  name = "Codeberg";

  validateUrl(url: string): boolean {
    return validateCodebergUrl(url);
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    broadcastLog('INFO', `Starting Codeberg authentication using ${credentials.type.toUpperCase()}`);
    
    try {
      switch (credentials.type) {
        case 'oauth':
          // For OAuth, we assume token validation happens in the route handler
          if (!credentials.token) {
            broadcastLog('ERROR', 'OAuth access token is missing');
            return { success: false, error: "OAuth access token is required" };
          }
          
          const oauthResponse = await fetch('https://codeberg.org/api/v1/user', {
            headers: {
              'Authorization': `token ${credentials.token}`,
              'Accept': 'application/json'
            }
          });
          
          if (oauthResponse.ok) {
            const userData = await oauthResponse.json();
            broadcastLog('INFO', `Codeberg authentication successful for user: ${userData.login}`);
            return {
              success: true,
              username: userData.login,
              token: credentials.token
            };
          } else {
            broadcastLog('ERROR', `Codeberg API responded with status ${oauthResponse.status}: Invalid OAuth token`);
            return { success: false, error: "Invalid OAuth access token" };
          }

        case 'pat':
          if (!credentials.token) {
            broadcastLog('ERROR', 'Personal Access Token is missing');
            return { success: false, error: "Personal Access Token is required" };
          }
          
          const response = await fetch('https://codeberg.org/api/v1/user', {
            headers: {
              'Authorization': `token ${credentials.token}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            broadcastLog('INFO', `Codeberg authentication successful for user: ${userData.login}`);
            return {
              success: true,
              username: userData.login,
              token: credentials.token
            };
          } else {
            broadcastLog('ERROR', `Codeberg API responded with status ${response.status}: Invalid PAT`);
            return { success: false, error: "Invalid Personal Access Token" };
          }

        case 'credentials':
          broadcastLog('ERROR', 'Username/password authentication not recommended - use PAT');
          return { success: false, error: "Use Personal Access Token for better security" };

        default:
          broadcastLog('ERROR', `Unsupported authentication method: ${credentials.type}`);
          return { success: false, error: "Unsupported authentication method" };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
      broadcastLog('ERROR', `Codeberg authentication failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async cloneRepository(url: string, options: CloneOptions): Promise<CloneResult> {
    broadcastLog('INFO', `Starting repository clone operation for: ${url}`);
    
    try {
      // Validate and sanitize the URL
      if (!validateCodebergUrl(url)) {
        broadcastLog('ERROR', `Invalid Codeberg URL provided: ${url}`);
        return {
          success: false,
          error: "Invalid or unsafe repository URL. Only Codeberg repositories are allowed."
        };
      }

      const sanitizedUrl = sanitizeUrl(url);
      const tempDir = path.join(process.cwd(), 'temp', `clone_${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });
      


      // Build git arguments safely without shell interpretation
      const gitArgs = ['clone'];
      
      // Handle mirror option for personal account cloning (like C# code)
      if (options.mirror) {

        gitArgs.push('--mirror');
      } else {
        // For technology detection only, use shallow clone

        gitArgs.push('--depth=1');
      }
      
      // Add the sanitized URL and destination directory as separate arguments
      gitArgs.push(sanitizedUrl);
      gitArgs.push(tempDir);


      // Use execFile instead of exec to prevent shell injection
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        broadcastLog('ERROR', `Git clone failed: ${stderr}`);
        throw new Error(stderr);
      }

      broadcastLog('INFO', `Repository cloned successfully to: ${tempDir}`);
      return {
        success: true,
        localPath: tempDir,
        remoteUrl: sanitizedUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
      broadcastLog('ERROR', `Repository clone failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getFileStructure(repoPath: string): Promise<FileNode[]> {
    return new GitHubProvider().getFileStructure(repoPath);
  }
}

export class SourceHutProvider implements GitProvider {
  name = "SourceHut";

  validateUrl(url: string): boolean {
    return validateSourceHutUrl(url);
  }

  async authenticate(credentials: AuthCredentials): Promise<AuthResult> {
    broadcastLog('INFO', `Starting SourceHut authentication using ${credentials.type.toUpperCase()}`);
    
    try {
      switch (credentials.type) {
        case 'oauth':
          // SourceHut has a different OAuth implementation
          broadcastLog('WARN', 'SourceHut OAuth not yet implemented');
          return { success: false, error: "SourceHut OAuth not yet implemented - use PAT token instead" };

        case 'pat':
          if (!credentials.token) {
            broadcastLog('ERROR', 'Personal Access Token is missing');
            return { success: false, error: "Personal Access Token is required" };
          }
          
          const response = await fetch('https://meta.sr.ht/api/user/profile', {
            headers: {
              'Authorization': `token ${credentials.token}`,
              'Accept': 'application/json'
            }
          });
          
          if (response.ok) {
            const userData = await response.json();
            broadcastLog('INFO', `SourceHut authentication successful for user: ${userData.canonical_name}`);
            return {
              success: true,
              username: userData.canonical_name,
              token: credentials.token
            };
          } else {
            broadcastLog('ERROR', `SourceHut API responded with status ${response.status}: Invalid PAT`);
            return { success: false, error: "Invalid Personal Access Token" };
          }

        case 'credentials':
          broadcastLog('ERROR', 'Username/password authentication not supported by SourceHut API');
          return { success: false, error: "Use Personal Access Token for authentication" };

        default:
          broadcastLog('ERROR', `Unsupported authentication method: ${credentials.type}`);
          return { success: false, error: "Unsupported authentication method" };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Authentication failed";
      broadcastLog('ERROR', `SourceHut authentication failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async cloneRepository(url: string, options: CloneOptions): Promise<CloneResult> {
    broadcastLog('INFO', `Starting repository clone operation for: ${url}`);
    
    try {
      // Validate and sanitize the URL
      if (!validateSourceHutUrl(url)) {
        broadcastLog('ERROR', `Invalid SourceHut URL provided: ${url}`);
        return {
          success: false,
          error: "Invalid or unsafe repository URL. Only SourceHut repositories are allowed."
        };
      }

      const sanitizedUrl = sanitizeUrl(url);
      const tempDir = path.join(process.cwd(), 'temp', `clone_${Date.now()}`);
      await fs.promises.mkdir(tempDir, { recursive: true });
      


      // Build git arguments safely without shell interpretation
      const gitArgs = ['clone'];
      
      // Handle mirror option for personal account cloning (like C# code)
      if (options.mirror) {

        gitArgs.push('--mirror');
      } else {
        // For technology detection only, use shallow clone

        gitArgs.push('--depth=1');
      }
      
      // Add the sanitized URL and destination directory as separate arguments
      gitArgs.push(sanitizedUrl);
      gitArgs.push(tempDir);


      // Use execFile instead of exec to prevent shell injection
      const { stdout, stderr } = await execFileAsync('git', gitArgs);
      
      if (stderr && !stderr.includes('Cloning into')) {
        broadcastLog('ERROR', `Git clone failed: ${stderr}`);
        throw new Error(stderr);
      }

      broadcastLog('INFO', `Repository cloned successfully to: ${tempDir}`);
      return {
        success: true,
        localPath: tempDir,
        remoteUrl: sanitizedUrl
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
      broadcastLog('ERROR', `Repository clone failed: ${errorMessage}`);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  async getFileStructure(repoPath: string): Promise<FileNode[]> {
    return new GitHubProvider().getFileStructure(repoPath);
  }
}

export const gitProviders: { [key: string]: GitProvider } = {
  github: new GitHubProvider(),
  gitlab: new GitLabProvider(),
  azure: new AzureDevOpsProvider(),
  bitbucket: new BitbucketProvider(),
  gitea: new GiteaProvider(),
  codeberg: new CodebergProvider(),
  sourcehut: new SourceHutProvider(),
};

export function detectProvider(url: string): string | null {
  for (const [name, provider] of Object.entries(gitProviders)) {
    if (provider.validateUrl(url)) {
      return name;
    }
  }
  return null;
}
