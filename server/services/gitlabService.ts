import { broadcastLog } from '../utils/logger';

export interface GitLabRepoCreationResult {
  success: boolean;
  repoUrl?: string;
  repoName?: string;
  error?: string;
}

export class GitLabService {
  /**
   * Creates a new repository in user's GitLab account
   * Based on GitHub logic adapted for GitLab API
   */
  async createRepositoryInPersonalAccount(
    accessToken: string,
    sourceRepoUrl: string,
    requestedName?: string
  ): Promise<GitLabRepoCreationResult> {
    try {
      broadcastLog('INFO', 'Starting GitLab personal account repository creation');
      
      // Get GitLab username
      const username = await this.getGitLabUsername(accessToken);
      if (!username) {
        return { success: false, error: 'Failed to get GitLab username' };
      }
      
      // Extract repo name from source URL or use requested name
      let repoName = requestedName || this.extractRepoNameFromUrl(sourceRepoUrl);
      if (!repoName) {
        repoName = `ClonedRepo_${Date.now()}`;
      }
      
      
      // Ensure unique repo name
      const finalRepoName = await this.ensureUniqueRepoName(accessToken, username, repoName);
      
      // Create the repository
      const createResult = await this.createRepository(accessToken, finalRepoName);
      if (!createResult.success) {
        return createResult;
      }
      
      const newRepoUrl = `https://gitlab.com/${username}/${finalRepoName}`;
      broadcastLog('INFO', `✅ GitLab repository '${finalRepoName}' created successfully at: ${newRepoUrl}`);
      
      return {
        success: true,
        repoUrl: newRepoUrl,
        repoName: finalRepoName
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('ERROR', `Failed to create GitLab personal account repository: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Get GitLab username from access token
   */
  private async getGitLabUsername(accessToken: string): Promise<string | null> {
    try {
      const response = await fetch('https://gitlab.com/api/v4/user', {
        headers: {
          'Authorization': `Bearer ${accessToken}`,  // GitLab uses Bearer
          'User-Agent': 'Git-Cloner-App'
        }
      });
      
      if (!response.ok) {
        broadcastLog('ERROR', `GitLab API responded with status ${response.status} when getting username`);
        return null;
      }
      
      const userData = await response.json();
      return userData.username;  // GitLab uses 'username' field
    } catch (error) {
      broadcastLog('ERROR', `Failed to get GitLab username: ${error}`);
      return null;
    }
  }
  
  /**
   * Extract repository name from URL (same logic as GitHub)
   */
  private extractRepoNameFromUrl(url: string): string {
    try {
      
      // Parse URL and extract path segments
      const urlObj = new URL(url);
      const pathSegments = urlObj.pathname.split('/').filter(segment => segment.length > 0);
      
      // For GitLab URLs like: https://gitlab.com/owner/repo.git
      if (pathSegments.length >= 2) {
        // Get repo name (last segment), remove .git extension
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
   * Ensure repository name is unique
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
   * Check if repository exists in user's GitLab account
   */
  private async checkRepositoryExists(accessToken: string, username: string, repoName: string): Promise<boolean> {
    try {
      // GitLab API uses URL encoding for project path
      const encodedPath = encodeURIComponent(`${username}/${repoName}`);
      const response = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'User-Agent': 'Git-Cloner-App'
        }
      });
      
      return response.status === 200;
    } catch {
      return false;
    }
  }
  
  /**
   * Create repository via GitLab API
   */
  private async createRepository(accessToken: string, repoName: string): Promise<GitLabRepoCreationResult> {
    try {
      const response = await fetch('https://gitlab.com/api/v4/projects', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,  // GitLab uses Bearer
          'User-Agent': 'Git-Cloner-App',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: repoName,
          visibility: 'public',  // GitLab uses 'visibility' instead of 'private'
          description: `Repository created via Git Cloner App on ${new Date().toISOString()}`
        })
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        broadcastLog('ERROR', `GitLab API error creating repository: ${response.status} - ${errorText}`);
        return { success: false, error: `Failed to create GitLab repository: ${response.status}` };
      }
      
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('ERROR', `Exception creating GitLab repository: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
  
  /**
   * Push cloned repository to new GitLab repo
   */
  async pushToPersonalRepository(
    localPath: string,
    accessToken: string,
    username: string,
    repoName: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      broadcastLog('INFO', `Pushing cloned repository to https://gitlab.com/${username}/${repoName}`);
      
      const { execFile } = await import('child_process');
      const { promisify } = await import('util');
      const execFileAsync = promisify(execFile);
      
      // Push to new repository using --mirror flag
      // GitLab uses oauth2 token format
      const pushUrl = `https://oauth2:${accessToken}@gitlab.com/${username}/${repoName}.git`;
      
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
      
      broadcastLog('INFO', `✅ Successfully pushed repository to https://gitlab.com/${username}/${repoName}`);
      return { success: true };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('ERROR', `Failed to push to GitLab personal repository: ${errorMessage}`);
      return { success: false, error: errorMessage };
    }
  }
}

export const gitlabService = new GitLabService();