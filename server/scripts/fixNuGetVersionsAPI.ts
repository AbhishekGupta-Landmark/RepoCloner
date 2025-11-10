import * as fs from 'fs';
import * as path from 'path';
import https from 'https';
import { Octokit } from '@octokit/rest';

interface NuGetPackageFix {
  packageName: string;
  invalidVersion: string;
  correctVersion?: string;
}

async function getNuGetLatestVersion(packageName: string): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const url = `https://api.nuget.org/v3-flatcontainer/${packageName.toLowerCase()}/index.json`;
    
    https.get(url, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          const versions = json.versions || [];
          const latestVersion = versions[versions.length - 1];
          resolve(latestVersion || null);
        } catch (error) {
          reject(error);
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: tsx fixNuGetVersionsAPI.ts <repoOwner> <repoName> <branchName>');
    process.exit(1);
  }
  
  const [repoOwner, repoName, branchName] = args;
  
  // Get GitHub token from environment
  const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  if (!githubToken) {
    console.error('❌ No GitHub token found in environment variables');
    process.exit(1);
  }
  
  try {
    console.log(`🔍 Fetching latest version from NuGet...`);
    const latestVersion = await getNuGetLatestVersion('Azure.Messaging.ServiceBus');
    
    if (!latestVersion) {
      console.error('❌ Could not fetch latest version from NuGet');
      process.exit(1);
    }
    
    console.log(`✅ Latest version: ${latestVersion}`);
    
    // Initialize Octokit
    const octokit = new Octokit({ auth: githubToken });
    
    // Get current files from branch
    console.log(`\n📥 Fetching branch data...`);
    const { data: branch } = await octokit.repos.getBranch({
      owner: repoOwner,
      repo: repoName,
      branch: branchName
    });
    
    // Get the tree
    const { data: tree } = await octokit.git.getTree({
      owner: repoOwner,
      repo: repoName,
      tree_sha: branch.commit.sha,
      recursive: 'true'
    });
    
    // Find .csproj files
    const csprojFiles = tree.tree.filter(file => 
      file.path && file.path.endsWith('.csproj') && file.type === 'blob'
    );
    
    console.log(`\n🔧 Found ${csprojFiles.length} .csproj file(s)`);
    
    if (csprojFiles.length === 0) {
      console.log('⚠️  No .csproj files found');
      process.exit(0);
    }
    
    let fixCount = 0;
    const updates: Array<{ path: string; content: string }> = [];
    
    // Process each .csproj file
    for (const file of csprojFiles) {
      if (!file.sha || !file.path) continue;
      
      // Get file content
      const { data: blob } = await octokit.git.getBlob({
        owner: repoOwner,
        repo: repoName,
        file_sha: file.sha
      });
      
      const content = Buffer.from(blob.content, 'base64').toString('utf-8');
      
      // Fix the version
      const pattern = /(<PackageReference\s+Include="Azure\.Messaging\.ServiceBus"\s+Version=")8\.0\.0(")/g;
      
      if (pattern.test(content)) {
        const newContent = content.replace(pattern, `$1${latestVersion}$2`);
        updates.push({ path: file.path, content: newContent });
        console.log(`  ✅ Will fix ${path.basename(file.path)}: 8.0.0 → ${latestVersion}`);
        fixCount++;
      }
    }
    
    if (fixCount === 0) {
      console.log('\n⚠️  No fixes needed - all versions are correct');
      process.exit(0);
    }
    
    console.log(`\n📤 Creating commit with ${fixCount} file(s)...`);
    
    // Create blobs for updated files
    const blobs = await Promise.all(
      updates.map(async (update) => ({
        path: update.path,
        sha: (await octokit.git.createBlob({
          owner: repoOwner,
          repo: repoName,
          content: Buffer.from(update.content).toString('base64'),
          encoding: 'base64'
        })).data.sha
      }))
    );
    
    // Create new tree
    const { data: newTree } = await octokit.git.createTree({
      owner: repoOwner,
      repo: repoName,
      base_tree: branch.commit.commit.tree.sha,
      tree: blobs.map(blob => ({
        path: blob.path,
        mode: '100644' as any,
        type: 'blob' as any,
        sha: blob.sha
      }))
    });
    
    // Create commit
    const { data: newCommit } = await octokit.git.createCommit({
      owner: repoOwner,
      repo: repoName,
      message: `Fix NuGet package versions: Azure.Messaging.ServiceBus ${latestVersion}`,
      tree: newTree.sha,
      parents: [branch.commit.sha]
    });
    
    // Update branch reference
    await octokit.git.updateRef({
      owner: repoOwner,
      repo: repoName,
      ref: `heads/${branchName}`,
      sha: newCommit.sha
    });
    
    console.log(`\n🎉 Successfully pushed fixes to GitHub!`);
    console.log(`📋 Commit: ${newCommit.sha.substring(0, 7)}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    process.exit(1);
  }
}

main();
