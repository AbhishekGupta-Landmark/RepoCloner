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
      await this.apiRequest('GET', `/projects/${this.projectId}/repository/files/${encodeURIComponent(filePath)}?ref=${branchName}`);
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
      
      const defaultBranch = await this.getDefaultBranch();
      console.log(`📍 Default branch: ${defaultBranch}`);

      await this.createBranch(branchName, defaultBranch);

      const fileChanges: FileChange[] = [];
      for (const filePath of filePaths) {
        try {
          const fullPath = join(workspaceDir, filePath);
          const content = readFileSync(fullPath, 'utf-8');
          fileChanges.push({ path: filePath, content });
        } catch (error) {
          console.warn(`⚠️  Skipping file ${filePath}:`, error);
        }
      }

      console.log(`📁 Pushing ${fileChanges.length} files to GitLab...`);
      
      const batchSize = 100;
      const batches = [];
      for (let i = 0; i < fileChanges.length; i += batchSize) {
        batches.push(fileChanges.slice(i, i + batchSize));
      }

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchCommitMessage = batches.length > 1 
          ? `${commitMessage} (batch ${i + 1}/${batches.length})`
          : commitMessage;
        
        await this.commitFiles(branchName, batch, batchCommitMessage);
        console.log(`✅ Committed batch ${i + 1}/${batches.length} (${batch.length} files)`);
      }

      console.log('🎉 SUCCESS! Code pushed to GitLab');
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
