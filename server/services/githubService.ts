import { broadcastLog } from '../utils/logger';

export interface GitHubRepoCreationResult {
  success: boolean;
  repoUrl?: string;
  repoName?: string;
  error?: string;
}

export class GitHubService {
  /**
   * Creates a new repository in user's GitHub account
   * Based on C# logic provided by user
   */
  async createRepositoryInPersonalAccount(
    accessToken: string,
    sourceRepoUrl: string,
    requestedName?: string
  ): Promise<GitHubRepoCreationResult> {
    try {
      broadcastLog('INFO', 'Starting personal account repository creation');
      
      // Get GitHub username
      const username = await this.getGitHubUsername(accessToken);
      if (!username) {
        return { success: false, error: 'Failed to get GitHub username' };
      }
      
      // Extract repo name from source URL or use requested name
      let repoName = requestedName || this.extractRepoNameFromUrl(sourceRepoUrl);
      if (!repoName) {
        repoName = `ClonedRepo_${Date.now()}`;
      }
      
      
      // Ensure unique repo name (following C# logic)
      const finalRepoName = await this.ensureUniqueRepoName(accessToken, username, repoName);
      
      // Create the repository
      const createResult = await this.createRepository(accessToken, finalRepoName);
      if (!createResult.success) {
        return createResult;
      }
      
      const newRepoUrl = `https://github.com/${username}/${finalRepoName}`;
      broadcastLog('INFO', `✅ Repository '${finalRepoName}' created successfully at: ${newRepoUrl}`);
      
      return {
        success: true,
        repoUrl: newRepoUrl,
        repoName: finalRepoName
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('ERROR', `Failed to create personal account repository: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Get GitHub username from access token
   */
  private async getGitHubUsername(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Git-Cloner-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      if (!response.ok) {
        broadcastLog('ERROR', `GitHub API responded with status ${response.status} when getting username`);
        return null;
      }
      
      const userData = await response.json();
      return userData.login;
    } catch (error) {
      broadcastLog('ERROR', `Failed to get GitHub username: ${error}`);
      return null;
    }
  }
  
  /**
   * Extract repository name from URL (matching C# Path.GetFileNameWithoutExtension)
   */
  private extractRepoNameFromUrl(url: string): string {
    try {
      
      // Parse URL and extract path segments (more reliable than regex)
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      // For GitHub URLs like: https://github.com/owner/repo.git
      // pathSegments will be: ["owner", "repo.git"] 
      if (pathSegments.length >= 2) {
        // Get repo name (last segment), remove .git extension (like C# Path.GetFileNameWithoutExtension)
        const repoWithExt = pathSegments[pathSegments.length - 1];
        const extracted = repoWithExt.replace(/\.git$/, '');
        return extracted;
      }
      
      broadcastLog('WARN', `Failed to extract repository name from URL: ${url} - insufficient path segments`);
      return '';
    } catch (error) {
      broadcastLog('ERROR', `Error extracting repo name from ${url}: ${error}`);
      return '';
    }
  }
  
  /**
   * Ensure repository name is unique (following C# logic)
   */
  private async ensureUniqueRepoName(accessToken: string, username: string, baseName: string): Promise<string> {
    let finalName = baseName;
    let counter = 0;
    
    while (true) {
      // Check if repository exists
      const exists = await this.checkRepositoryExists(accessToken, username, finalName);
      
      if (!exists) {
        return finalName;
      }
      
      // Repository exists, create unique name with timestamp and counter
      counter++;
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[-:]/g, '').replace('T', '_');
      finalName = `${baseName}_${timestamp}_${counter}`;
      
    }
  }
  
  /**
   * Check if repository exists in user's account
   */
  private async checkRepositoryExists(accessToken: string, username: string, repoName: string): Promise<boolean> {
    try {
      const response = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Git-Cloner-App',
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      
      return response.status === 200;
    } catch {
      return false;
    }
  }
  
  /**
   * Create repository via GitHub API
   */
  private async createRepository(accessToken: string, repoName: string): Promise<GitHubRepoCreationResult> {
    try {
      const response = await fetch('https://api.github.com/user/repos', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Git-Cloner-App',
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github.v3+json'
        },
        body: JSON.stringify({
          name: repoName,
          private: false,
          description: `Repository created via Git Cloner App on ${new Date().toISOString()}`
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        broadcastLog('ERROR', `GitHub API error creating repository: ${response.status} - ${errorText}`);
        return { success: false, error: `Failed to create repository: ${response.status}` };
      }
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('ERROR', `Exception creating repository: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Push cloned repository to new GitHub repo
   */
  async pushToPersonalRepository(
    localPath: string,
    accessToken: string,
    username: string,
    repoName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      broadcastLog('INFO', `Pushing cloned repository to https://github.com/${username}/${repoName}`);
      
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      
      // Push to new repository using --mirror flag (like C# code)
      const pushUrl = `https://${accessToken}@github.com/${username}/${repoName}.git`;
      
      const { stdout, stderr } = await execFileAsync('git', [
        'push', 
        '--mirror',
        pushUrl
      ], {
        cwd: localPath
      });
      
      if (stderr && !stderr.includes('Everything up-to-date')) {
        broadcastLog('WARN', `Git push warning: ${stderr}`);
      }
      
      broadcastLog('INFO', `✅ Successfully pushed repository to https://github.com/${username}/${repoName}`);
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('ERROR', `Failed to push to personal repository: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
}

export const githubService = new GitHubService();