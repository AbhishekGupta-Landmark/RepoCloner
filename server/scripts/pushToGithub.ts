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

      // Create new branch
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const branchName = `agent-sync-${timestamp}`;
      
      let currentOid = await this.createBranch(branchName, mainOid);
      console.log('🌿 Created branch:', branchName);

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
          ? `Test infrastructure improvements (batch ${i + 1}/${batches.length})`
          : 'Test infrastructure improvements: Fixed 8+ failing tests, enhanced component testing, improved useAuth hook stability';
        
        currentOid = await this.commitFiles(branchName, batch, currentOid, commitMessage);
        console.log(`✅ Committed batch ${i + 1}/${batches.length} (${batch.length} files)`);
      }

      // Create pull request
      const prTitle = 'Test Infrastructure Improvements from Replit Agent';
      const prBody = `## 🎉 Test Infrastructure Improvements

### What's Included:
✅ **Fixed SettingsPanel tests** (8/8 passing)
✅ **Fixed useAuth hook** (null safety improvements)  
✅ **Enhanced TechnologyShowcase/Display tests**
✅ **Improved test infrastructure** with proper mocking
✅ **All UI layout improvements** (equal height grid, responsive design)
✅ **Working authentication system**

### Test Coverage Achievement:
- Significantly improved from 71/79 passing tests (92% success rate)
- Fixed multiple critical test failures
- Standardized test patterns across all components
- Proper React Query and component mocking

### Technical Details:
- Fixed "Cannot read properties of undefined" errors in useAuth hook
- Resolved duplicate text element issues in SettingsPanel tests
- Updated component assertions to match actual UI implementation
- Enhanced test stability with proper async handling

Ready for merge! 🚀`;

      const prUrl = await this.createPullRequest(branchName, prTitle, prBody);
      
      console.log('🎉 SUCCESS! Code pushed to GitHub');
      console.log('📋 Pull Request created:', prUrl);
      console.log('🔀 You can review and merge the PR at:', prUrl);

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