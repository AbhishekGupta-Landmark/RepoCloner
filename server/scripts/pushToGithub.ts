import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';

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

  private async getChangedFiles(): Promise<string[]> {
    const { execSync } = await import('child_process');
    
    try {
      // Get all files changed in recent commits (last 10 commits to be safe)
      const output = execSync('git diff --name-only HEAD~10 HEAD', { 
        encoding: 'utf-8',
        cwd: '/home/runner/workspace'
      });
      
      const files = output
        .trim()
        .split('\n')
        .filter(f => f.length > 0);
      
      console.log(`📝 Found files from last 10 commits:`, files);
      return files;
    } catch (error) {
      console.error('Failed to get changed files from git:', error);
      return [];
    }
  }

  private async getMainBranchOid(): Promise<string> {
    const query = `
      query($owner: String!, $repo: String!) {
        repository(owner: $owner, name: $repo) {
          ref(qualifiedName: "refs/heads/main") {
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
    });

    if (result.errors) {
      throw new Error(`Failed to get main branch: ${result.errors[0].message}`);
    }

    return result.data.repository.ref.target.oid;
  }

  private async getBranchOid(branchName: string): Promise<string> {
    const query = `
      query($owner: String!, $repo: String!, $branchName: String!) {
        repository(owner: $owner, name: $repo) {
          ref(qualifiedName: $branchName) {
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
      branchName: `refs/heads/${branchName}`,
    });

    if (result.errors) {
      throw new Error(`Failed to get branch ${branchName}: ${result.errors[0].message}`);
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

  private async commitFiles(branchName: string, files: FileChange[], expectedHeadOid: string, message: string): Promise<string> {
    const mutation = `
      mutation($input: CreateCommitOnBranchInput!) {
        createCommitOnBranch(input: $input) {
          commit {
            oid
          }
        }
      }
    `;

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
          additions: files.map(file => ({
            path: file.path,
            contents: file.contents,
          })),
        },
        expectedHeadOid: expectedHeadOid,
      },
    });

    if (result.errors) {
      throw new Error(`Failed to commit files: ${result.errors[0].message}`);
    }

    return result.data.createCommitOnBranch.commit.oid;
  }

  private async createPullRequest(branchName: string, title: string, body: string): Promise<string> {
    const mutation = `
      mutation($input: CreatePullRequestInput!) {
        createPullRequest(input: $input) {
          pullRequest {
            url
          }
        }
      }
    `;

    const result = await this.graphqlRequest(mutation, {
      input: {
        repositoryId: await this.getRepositoryId(),
        baseRefName: 'main',
        headRefName: branchName,
        title: title,
        body: body,
      },
    });

    if (result.errors) {
      throw new Error(`Failed to create pull request: ${result.errors[0].message}`);
    }

    return result.data.createPullRequest.pullRequest.url;
  }

  async pushCode(): Promise<void> {
    try {
      console.log('🚀 Starting GitHub push process...');
      
      // Get only changed files to push
      const workspaceDir = '/home/runner/workspace';
      const allFiles = await this.getChangedFiles();
      
      console.log(`📁 Found ${allFiles.length} changed files to push`);
      
      // Prepare file changes with base64 encoding
      const fileChanges: FileChange[] = [];
      
      for (const filePath of allFiles) {
        try {
          const fullPath = join(workspaceDir, filePath);
          const content = readFileSync(fullPath);
          
          // Convert to base64
          const base64Content = content.toString('base64');
          
          fileChanges.push({
            path: filePath,
            contents: base64Content,
          });
        } catch (error) {
          console.warn(`⚠️  Skipping file ${filePath}:`, error);
        }
      }

      console.log(`✅ Prepared ${fileChanges.length} files for push`);

      // Use existing branch
      const branchName = 'fix/check-again-and-url';
      console.log('🎯 Pushing to existing branch:', branchName);
      
      // Get the current OID of the branch
      let currentOid: string;
      try {
        currentOid = await this.getBranchOid(branchName);
        console.log('📍 Got branch OID:', currentOid.substring(0, 8));
      } catch (error) {
        // Branch doesn't exist, create it from main
        console.log('📍 Branch does not exist, creating from main...');
        const mainOid = await this.getMainBranchOid();
        currentOid = await this.createBranch(branchName, mainOid);
        console.log('📍 Created branch OID:', currentOid.substring(0, 8));
      }

      // Commit files in batches
      const batchSize = 20; // Files per commit (smaller to stay under 45MB limit)
      const batches = [];
      
      for (let i = 0; i < fileChanges.length; i += batchSize) {
        batches.push(fileChanges.slice(i, i + batchSize));
      }

      console.log(`📦 Pushing in ${batches.length} batch(es)...`);

      for (let i = 0; i < batches.length; i++) {
        const batch = batches[i];
        const commitMessage = batches.length > 1 
          ? `Migration analysis UI fixes (batch ${i + 1}/${batches.length})`
          : 'Fix migration analysis UI: Report ID, caching, Key Changes deduplication, Notes display';
        
        currentOid = await this.commitFiles(branchName, batch, currentOid, commitMessage);
        console.log(`✅ Committed batch ${i + 1}/${batches.length} (${batch.length} files)`);
      }

      console.log('🎉 SUCCESS! Code pushed to GitHub');
      console.log(`📋 Pushed ${batches.length} batch(es) to branch: ${branchName}`);

    } catch (error) {
      console.error('❌ Failed to push code:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!token) {
    throw new Error('GITHUB_PERSONAL_ACCESS_TOKEN environment variable is required');
  }

  const pusher = new GitHubPusher(token, 'AbhishekGupta-Landmark', 'RepoCloner');
  await pusher.pushCode();
}

export { GitHubPusher };

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}