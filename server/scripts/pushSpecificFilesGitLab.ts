import { readFileSync } from 'fs';
import { join } from 'path';

interface FileChange {
  path: string;
  content: string;
}

class GitLabPusher {
  private token: string;
  private projectId: string;
  private apiUrl: string;

  constructor(token: string, projectPath: string) {
    this.token = token;
    this.projectId = encodeURIComponent(projectPath);
    this.apiUrl = 'https://gitlab.com/api/v4';
  }

  private async apiRequest(method: string, endpoint: string, data?: any): Promise<any> {
    const url = `${this.apiUrl}${endpoint}`;
    const response = await fetch(url, {
      method,
      headers: {
        'PRIVATE-TOKEN': this.token,
        'Content-Type': 'application/json',
      },
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitLab API request failed: ${response.status} ${error}`);
    }

    return response.json();
  }

  private async getDefaultBranch(): Promise<string> {
    const project = await this.apiRequest('GET', `/projects/${this.projectId}`);
    return project.default_branch || 'main';
  }

  private async getAllBranches(): Promise<Array<{ name: string }>> {
    const branches = await this.apiRequest('GET', `/projects/${this.projectId}/repository/branches?per_page=100`);
    return branches;
  }

  private async deleteBranch(branchName: string): Promise<void> {
    await this.apiRequest('DELETE', `/projects/${this.projectId}/repository/branches/${encodeURIComponent(branchName)}`);
  }

  async deleteAllBranchesExceptDefault(): Promise<void> {
    try {
      const defaultBranch = await this.getDefaultBranch();
      console.log(`🗑️  Deleting all branches except ${defaultBranch}...`);
      
      const branches = await this.getAllBranches();
      const branchesToDelete = branches.filter(branch => branch.name !== defaultBranch);
      
      if (branchesToDelete.length === 0) {
        console.log(`✅ No branches to delete (only ${defaultBranch} exists)`);
        return;
      }

      console.log(`🗑️  Found ${branchesToDelete.length} branch(es) to delete:`, branchesToDelete.map(b => b.name).join(', '));

      for (const branch of branchesToDelete) {
        try {
          await this.deleteBranch(branch.name);
          console.log(`✅ Deleted branch: ${branch.name}`);
        } catch (error: any) {
          console.warn(`⚠️  Could not delete branch ${branch.name}: ${error.message}`);
          // Continue with other branches even if one fails
        }
      }

      console.log('🎉 Branch cleanup completed');
    } catch (error) {
      console.error('❌ Failed to delete branches:', error);
      // Don't throw - continue with push even if deletion fails
    }
  }

  private async branchExists(branchName: string): Promise<boolean> {
    try {
      await this.apiRequest('GET', `/projects/${this.projectId}/repository/branches/${encodeURIComponent(branchName)}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async createBranch(branchName: string, ref: string): Promise<void> {
    try {
      await this.apiRequest('POST', `/projects/${this.projectId}/repository/branches`, {
        branch: branchName,
        ref,
      });
      console.log(`✅ Created branch: ${branchName}`);
    } catch (error: any) {
      if (error.message.includes('already exists')) {
        console.log(`📍 Branch ${branchName} already exists`);
      } else {
        throw error;
      }
    }
  }

  private async getFileExists(branchName: string, filePath: string): Promise<boolean> {
    try {
      // Normalize path for GitLab API (convert backslashes to forward slashes)
      const normalizedPath = filePath.replace(/\\/g, '/');
      await this.apiRequest('GET', `/projects/${this.projectId}/repository/files/${encodeURIComponent(normalizedPath)}?ref=${branchName}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  private async commitFiles(branchName: string, files: FileChange[], commitMessage: string): Promise<void> {
    const actions = await Promise.all(files.map(async (file) => {
      const exists = await this.getFileExists(branchName, file.path);
      return {
        action: exists ? 'update' : 'create',
        file_path: file.path,
        content: file.content,
      };
    }));

    await this.apiRequest('POST', `/projects/${this.projectId}/repository/commits`, {
      branch: branchName,
      commit_message: commitMessage,
      actions,
    });
  }

  async pushSpecificFiles(branchName: string, commitMessage: string, filePaths: string[], workspaceDir: string): Promise<void> {
    try {
      console.log('🚀 Starting GitLab push process...');
      console.log(`📁 Pushing ${filePaths.length} specific files:`, filePaths);
      console.log(`📂 Base directory: ${workspaceDir}`);
      
      // Check if branch already exists
      const exists = await this.branchExists(branchName);
      
      if (exists) {
        console.log(`📍 Branch '${branchName}' exists, updating it...`);
      } else {
        // Branch doesn't exist, delete all other branches and create new one
        console.log(`🎯 Branch '${branchName}' doesn't exist, creating it...`);
        await this.deleteAllBranchesExceptDefault();
        
        const defaultBranch = await this.getDefaultBranch();
        console.log(`📍 Default branch: ${defaultBranch}`);
        await this.createBranch(branchName, defaultBranch);
      }

      const fileChanges: FileChange[] = [];
      for (const filePath of filePaths) {
        try {
          const fullPath = join(workspaceDir, filePath);
          const content = readFileSync(fullPath, 'utf-8');
          
          // CRITICAL: Normalize path to use forward slashes (Git standard)
          // Windows uses backslashes, but Git always uses forward slashes
          const normalizedPath = filePath.replace(/\\/g, '/');
          
          fileChanges.push({ path: normalizedPath, content });
        } catch (error) {
          console.warn(`⚠️  Skipping file ${filePath}:`, error);
        }
      }

      if (fileChanges.length === 0) {
        console.error('❌ No files could be read from the repository');
        throw new Error(`Failed to read any of the ${filePaths.length} files from ${workspaceDir}`);
      }

      console.log(`✅ Prepared ${fileChanges.length} files for push`);

      const batchSize = 100;
      const batches = [];
      for (let i = 0; i < fileChanges.length; i += batchSize) {
        batches.push(fileChanges.slice(i, i + batchSize));
      }

      console.log(`📦 Pushing in ${batches.length} batch(es)...`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchCommitMessage = batches.length > 1 
          ? `${commitMessage} (batch ${i + 1}/${batches.length})`
          : commitMessage;
        
        await this.commitFiles(branchName, batch, batchCommitMessage);
        console.log(`✅ Committed batch ${i + 1}/${batches.length} (${batch.length} files)`);
      }

      console.log('🎉 SUCCESS! Code pushed to GitLab');
      console.log(`📋 Pushed ${batches.length} batch(es) to branch: ${branchName}`);
    } catch (error) {
      console.error('❌ Failed to push to GitLab:', error);
      throw error;
    }
  }

  async createDraftMR(branchName: string, title: string, body: string): Promise<string> {
    try {
      const defaultBranch = await this.getDefaultBranch();
      const mr = await this.apiRequest('POST', `/projects/${this.projectId}/merge_requests`, {
        source_branch: branchName,
        target_branch: defaultBranch,
        title,
        description: body,
        draft: true,
      });
      console.log(`✅ Draft MR created: ${mr.web_url}`);
      return mr.web_url;
    } catch (error) {
      console.error('❌ Failed to create draft MR:', error);
      throw error;
    }
  }
}

export { GitLabPusher };
