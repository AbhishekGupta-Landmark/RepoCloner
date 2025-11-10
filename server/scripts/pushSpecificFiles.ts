import { readFileSync } from 'fs';
import { join } from 'path';

interface FileChange {
  path: string;
  contents: string; // base64 encoded
}

interface GitHubResponse {
  data?: any;
  errors?: Array<{ message: string }>;
}

class GitHubPusher {
  private token: string;
  private owner: string;
  private repo: string;
  private apiUrl = 'https://api.github.com/graphql';

  constructor(token: string, owner: string, repo: string) {
    this.token = token;
    this.owner = owner;
    this.repo = repo;
  }

  private async graphqlRequest(query: string, variables: any = {}): Promise<GitHubResponse> {
    const response = await fetch(this.apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GitHub API request failed: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async getMainBranchOid(): Promise<string> {
    // First, get the default branch name
    const defaultBranchQuery = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          defaultBranchRef {
            name
            target {
              oid
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(defaultBranchQuery, {
      owner: this.owner,
      repo: this.repo,
    });

    if (result.errors) {
      throw new Error(`Failed to get default branch: ${result.errors[0].message}`);
    }

    const defaultBranchRef = result.data.repository.defaultBranchRef;
    if (!defaultBranchRef) {
      throw new Error('Repository has no default branch');
    }

    console.log(`📍 Using default branch: ${defaultBranchRef.name}`);
    return defaultBranchRef.target.oid;
  }

  private async getBranchOid(branchName: string): Promise<string> {
    const query = `
      query($owner: String!, $repo: String!, $qualifiedName: String!) {
        repository(owner: $owner, name: $repo) {
          ref(qualifiedName: $qualifiedName) {
            target {
              oid
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      owner: this.owner,
      repo: this.repo,
      qualifiedName: `refs/heads/${branchName}`,
    });

    if (result.errors || !result.data.repository.ref) {
      throw new Error(`Branch ${branchName} not found`);
    }

    return result.data.repository.ref.target.oid;
  }

  private async createBranch(branchName: string, fromOid: string): Promise<string> {
    const mutation = `
      mutation($input: CreateRefInput!) {
        createRef(input: $input) {
          ref {
            target {
              oid
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(mutation, {
      input: {
        repositoryId: await this.getRepositoryId(),
        name: `refs/heads/${branchName}`,
        oid: fromOid,
      },
    });

    if (result.errors) {
      throw new Error(`Failed to create branch: ${result.errors[0].message}`);
    }

    return result.data.createRef.ref.target.oid;
  }

  private async getRepositoryId(): Promise<string> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          id
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      owner: this.owner,
      repo: this.repo,
    });

    if (result.errors) {
      throw new Error(`Failed to get repository ID: ${result.errors[0].message}`);
    }

    return result.data.repository.id;
  }

  private async getAllBranches(): Promise<Array<{ name: string; id: string }>> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          refs(refPrefix: "refs/heads/", first: 100) {
            nodes {
              id
              name
            }
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      owner: this.owner,
      repo: this.repo,
    });

    if (result.errors) {
      throw new Error(`Failed to get branches: ${result.errors[0].message}`);
    }

    return result.data.repository.refs.nodes;
  }

  private async deleteBranch(refId: string): Promise<void> {
    const mutation = `
      mutation($input: DeleteRefInput!) {
        deleteRef(input: $input) {
          clientMutationId
        }
      }
    `;

    const result = await this.graphqlRequest(mutation, {
      input: {
        refId,
      },
    });

    if (result.errors) {
      throw new Error(`Failed to delete branch: ${result.errors[0].message}`);
    }
  }

  private async getDefaultBranchName(): Promise<string> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          defaultBranchRef {
            name
          }
        }
      }
    `;

    const result = await this.graphqlRequest(query, {
      owner: this.owner,
      repo: this.repo,
    });

    if (result.errors) {
      throw new Error(`Failed to get default branch: ${result.errors[0].message}`);
    }

    const defaultBranchRef = result.data.repository.defaultBranchRef;
    if (!defaultBranchRef) {
      throw new Error('Repository has no default branch');
    }

    return defaultBranchRef.name;
  }

  async deleteAllBranchesExceptMain(): Promise<void> {
    try {
      // Get the actual default branch name (could be "main", "master", etc.)
      const defaultBranch = await this.getDefaultBranchName();
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
          await this.deleteBranch(branch.id);
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

  private async commitFiles(
    branchName: string,
    fileChanges: FileChange[],
    expectedHeadOid: string,
    message: string
  ): Promise<string> {
    const mutation = `
      mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit {
            oid
          }
        }
      }
    `;

    const additions = fileChanges.map(file => ({
      path: file.path,
      contents: file.contents,
    }));

    const result = await this.graphqlRequest(mutation, {
      input: {
        branch: {
          repositoryNameWithOwner: `${this.owner}/${this.repo}`,
          branchName: branchName,
        },
        message: {
          headline: message,
        },
        fileChanges: {
          additions,
        },
        expectedHeadOid,
      },
    });

    if (result.errors) {
      throw new Error(`Failed to commit files: ${result.errors[0].message}`);
    }

    return result.data.createCommitOnBranch.commit.oid;
  }

  async pushSpecificFiles(branchName: string, commitMessage: string, filePaths: string[], baseDir?: string): Promise<void> {
    try {
      console.log('🚀 Starting GitHub push process...');
      console.log(`📁 Pushing ${filePaths.length} specific files:`, filePaths);
      
      // Use provided baseDir or fall back to Replit workspace
      const workspaceDir = baseDir || '/home/runner/workspace';
      console.log(`📂 Base directory: ${workspaceDir}`);
      
      // Prepare file changes with base64 encoding
      const fileChanges: FileChange[] = [];
      
      for (const filePath of filePaths) {
        try {
          const fullPath = join(workspaceDir, filePath);
          const content = readFileSync(fullPath);
          
          // Convert to base64
          const base64Content = content.toString('base64');
          
          // CRITICAL: Normalize path to use forward slashes (Git standard)
          // Windows uses backslashes, but Git always uses forward slashes
          const normalizedPath = filePath.replace(/\\/g, '/');
          
          fileChanges.push({
            path: normalizedPath,
            contents: base64Content,
          });
        } catch (error) {
          console.warn(`⚠️  Skipping file ${filePath}:`, error);
        }
      }

      if (fileChanges.length === 0) {
        console.error('❌ No files could be read from the repository');
        throw new Error(`Failed to read any of the ${filePaths.length} files from ${workspaceDir}`);
      }

      console.log(`✅ Prepared ${fileChanges.length} files for push`);
      
      // Check if branch already exists
      let currentOid: string;
      try {
        currentOid = await this.getBranchOid(branchName);
        console.log(`📍 Branch '${branchName}' exists, updating it...`);
      } catch {
        // Branch doesn't exist, delete all other branches and create new one
        console.log(`🎯 Branch '${branchName}' doesn't exist, creating it...`);
        await this.deleteAllBranchesExceptMain();
        
        const mainOid = await this.getMainBranchOid();
        console.log('📍 Main branch OID:', mainOid.substring(0, 8));
        
        currentOid = await this.createBranch(branchName, mainOid);
        console.log('📍 Created branch OID:', currentOid.substring(0, 8));
      }

      // Commit files in batches
      const batchSize = 20;
      const batches = [];
      
      for (let i = 0; i < fileChanges.length; i += batchSize) {
        batches.push(fileChanges.slice(i, i + batchSize));
      }

      console.log(`📦 Pushing in ${batches.length} batch(es)...`);

      let latestOid = currentOid;
      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const batchCommitMessage = batches.length > 1 
          ? `${commitMessage} (batch ${i + 1}/${batches.length})`
          : commitMessage;
        
        latestOid = await this.commitFiles(branchName, batch, latestOid, batchCommitMessage);
        console.log(`✅ Committed batch ${i + 1}/${batches.length} (${batch.length} files)`);
      }

      console.log('🎉 SUCCESS! Code pushed to GitHub');
      console.log(`📋 Pushed ${batches.length} batch(es) to branch: ${branchName}`);

    } catch (error) {
      console.error('❌ Failed to push code:', error);
      throw error;
    }
  }

  /**
   * Create a draft pull request from a branch to the default branch
   * @param branchName The source branch for the PR
   * @param title PR title
   * @param body PR description
   * @returns PR URL
   */
  async createDraftPR(branchName: string, title: string, body: string): Promise<string> {
    try {
      console.log(`📝 Creating draft PR from ${branchName}...`);
      
      // Use GitHub REST API for PR creation (not GraphQL)
      const restApiUrl = `https://api.github.com/repos/${this.owner}/${this.repo}/pulls`;
      
      // Get default branch name
      const defaultBranch = await this.getDefaultBranchName();
      
      const response = await fetch(restApiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.token}`,
          'Content-Type': 'application/json',
          'Accept': 'application/vnd.github+json',
        },
        body: JSON.stringify({
          title,
          head: branchName,
          base: defaultBranch,
          body,
          draft: true,  // Create as draft PR
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to create PR: ${response.status} ${error}`);
      }

      const prData = await response.json();
      console.log(`✅ Draft PR created: ${prData.html_url}`);
      
      return prData.html_url;
    } catch (error) {
      console.error('❌ Failed to create draft PR:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN_NEW1 || process.env.GITHUB_PERSONAL_ACCESS_TOKEN_NEW || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('GITHUB_PERSONAL_ACCESS_TOKEN_NEW1 or GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required');
  }

  // Get branch name, commit message, and file paths from command line arguments
  const branchName = process.argv[2];
  const commitMessage = process.argv[3];
  const filePaths = process.argv.slice(4);

  if (!branchName || !commitMessage || filePaths.length === 0) {
    console.error('Usage: tsx pushSpecificFiles.ts <branch-name> <commit-message> <file1> [file2] [file3] ...');
    process.exit(1);
  }

  console.log(`📌 Branch: ${branchName}`);
  console.log(`📝 Commit message: ${commitMessage}`);
  console.log(`📄 Files: ${filePaths.length} file(s)`);

  const pusher = new GitHubPusher(token, 'AbhishekGupta-Landmark', 'RepoCloner');
  await pusher.pushSpecificFiles(branchName, commitMessage, filePaths);
}

export { GitHubPusher };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
