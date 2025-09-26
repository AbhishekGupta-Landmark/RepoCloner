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

  private getAllFiles(dir: string, baseDir: string = dir): string[] {
    const files: string[] = [];
    const excludeDirs = ['.git', 'node_modules', 'dist', 'coverage', '.next', '.vercel', 'temp', 'build', '.cache'];
    const excludePatterns = ['temp/', '.log', '.tmp', 'clone_', '.env', 'coverage/', '.nyc_output/', '.DS_Store'];
    const excludeExtensions = ['.log', '.tmp', '.cache', '.lock'];

    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = join(dir, entry.name);
        const relativePath = relative(baseDir, fullPath);
        
        // Skip excluded directories and patterns
        if (excludeDirs.includes(entry.name) || 
            excludePatterns.some(pattern => relativePath.includes(pattern)) ||
            excludeExtensions.some(ext => entry.name.endsWith(ext))) {
          continue;
        }

        if (entry.isDirectory()) {
          files.push(...this.getAllFiles(fullPath, baseDir));
        } else if (entry.isFile()) {
          // Skip large files (>1MB) to keep payload manageable
          const stats = statSync(fullPath);
          if (stats.size < 1024 * 1024) {
            files.push(relativePath);
          } else {
            console.log(`Skipping large file: ${relativePath} (${Math.round(stats.size / 1024)}KB)`);
          }
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not read directory ${dir}:`, error);
    }

    return files;
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
      
      // Get all files to push
      const workspaceDir = '/home/runner/workspace';
      const allFiles = this.getAllFiles(workspaceDir);
      
      console.log(`📁 Found ${allFiles.length} files to push`);
      
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

      // Get current main branch OID
      const mainOid = await this.getMainBranchOid();
      console.log('📍 Got main branch OID:', mainOid.substring(0, 8));

      // Use existing branch specified by user
      const branchName = 'feature-workflow-separation-2025-09-25T13-22-56';
      console.log('🎯 Pushing to existing branch:', branchName);
      
      // Get current branch OID instead of creating new branch
      let currentOid = await this.getBranchOid(branchName);
      console.log('📍 Got branch OID:', currentOid.substring(0, 8));

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
          ? `UI fixes and enhancements (batch ${i + 1}/${batches.length})`
          : 'UI fixes: Dark theme colors, Migration Summary collapsible, descriptive text extraction';
        
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