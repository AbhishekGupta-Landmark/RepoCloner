const fs = require('fs');
const path = require('path');
const https = require('https');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'AbhishekGupta-Landmark';
const REPO_NAME = 'RepoCloner';
const BRANCH = 'main';

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN environment variable is required');
  process.exit(1);
}

// Function to make GitHub API requests
function makeGitHubRequest(method, endpoint, data = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.github.com',
      path: endpoint,
      method: method,
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'RepoCloner-Agent',
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => responseData += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(responseData);
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(parsed);
          } else {
            reject(new Error(`GitHub API Error ${res.statusCode}: ${parsed.message || responseData}`));
          }
        } catch (e) {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(responseData);
          } else {
            reject(new Error(`GitHub API Error ${res.statusCode}: ${responseData}`));
          }
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(JSON.stringify(data));
    }

    req.end();
  });
}

// Function to get file content as base64
function getFileContent(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    return Buffer.from(content).toString('base64');
  } catch (err) {
    return null;
  }
}

// Function to check if file is binary
function isBinaryFile(filePath) {
  const binaryExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.otf', '.pdf', '.zip', '.tar', '.gz'];
  return binaryExtensions.some(ext => filePath.toLowerCase().endsWith(ext));
}

// Function to get all files recursively
function getAllFiles(dirPath, arrayOfFiles = []) {
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    
    // Skip certain directories and files
    if (file === 'node_modules' || file === '.git' || file === 'dist' || file === '.cache' || file === '.local' || file === '.upm' || file === '.config' || file === 'temp') {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      // Convert to relative path with forward slashes
      const relativePath = path.relative('.', fullPath).replace(/\\/g, '/');
      arrayOfFiles.push(relativePath);
    }
  });

  return arrayOfFiles;
}

async function pushToGitHub() {
  try {
    console.log('🚀 Starting GitHub push process...');

    // Get all files to upload
    const files = getAllFiles('.');
    console.log(`📁 Found ${files.length} files to process`);

    // Get current SHA of the branch
    let currentSha;
    try {
      const branchInfo = await makeGitHubRequest('GET', `/repos/${REPO_OWNER}/${REPO_NAME}/branches/${BRANCH}`);
      currentSha = branchInfo.commit.sha;
      console.log(`🔍 Current branch SHA: ${currentSha}`);
    } catch (err) {
      console.log('🆕 Branch does not exist, will create new branch');
      currentSha = null;
    }

    // Get current tree
    let baseTreeSha = currentSha;
    if (currentSha) {
      const commit = await makeGitHubRequest('GET', `/repos/${REPO_OWNER}/${REPO_NAME}/commits/${currentSha}`);
      baseTreeSha = commit.tree.sha;
    }

    // Create tree entries for all files
    console.log('📋 Creating tree entries...');
    const treeEntries = [];

    for (const file of files) {
      const content = getFileContent(file);
      if (content === null) {
        console.log(`⚠️  Skipping ${file} (cannot read)`);
        continue;
      }

      console.log(`📄 Processing ${file}`);
      
      treeEntries.push({
        path: file,
        mode: '100644',
        type: 'blob',
        content: isBinaryFile(file) ? undefined : Buffer.from(content, 'base64').toString('utf-8'),
        ...(isBinaryFile(file) ? { content: content, encoding: 'base64' } : {})
      });
    }

    // Create new tree
    console.log('🌳 Creating new tree...');
    const treeData = {
      tree: treeEntries,
      ...(baseTreeSha ? { base_tree: baseTreeSha } : {})
    };

    const newTree = await makeGitHubRequest('POST', `/repos/${REPO_OWNER}/${REPO_NAME}/git/trees`, treeData);

    // Create commit
    console.log('💾 Creating commit...');
    const commitData = {
      message: `feat: Fix multi-signin dropdown and remove error overlays

- Fixed multi-signin functionality to always show 'Add another account' option regardless of OAuth configuration
- PAT authentication now always available even with single account or no OAuth setup
- Implemented targeted Vite error overlay blocking that preserves UI dropdown functionality
- Enhanced authentication flow with better user experience
- All existing functionality preserved and improved

Pushed from Replit Agent`,
      tree: newTree.sha,
      ...(currentSha ? { parents: [currentSha] } : {})
    };

    const newCommit = await makeGitHubRequest('POST', `/repos/${REPO_OWNER}/${REPO_NAME}/git/commits`, commitData);

    // Update branch reference
    console.log('🔄 Updating branch reference...');
    if (currentSha) {
      await makeGitHubRequest('PATCH', `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs/heads/${BRANCH}`, {
        sha: newCommit.sha
      });
    } else {
      await makeGitHubRequest('POST', `/repos/${REPO_OWNER}/${REPO_NAME}/git/refs`, {
        ref: `refs/heads/${BRANCH}`,
        sha: newCommit.sha
      });
    }

    console.log('✅ Successfully pushed to GitHub!');
    console.log(`🔗 Repository: https://github.com/${REPO_OWNER}/${REPO_NAME}`);
    console.log(`📝 Commit: ${newCommit.sha}`);

  } catch (error) {
    console.error('❌ Error pushing to GitHub:', error.message);
    process.exit(1);
  }
}

pushToGitHub();