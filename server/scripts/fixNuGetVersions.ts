import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import https from 'https';

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

async function fixCsprojVersions(repoPath: string, fixes: NuGetPackageFix[]): Promise<number> {
  let fixCount = 0;
  
  // Find all .csproj files recursively
  const findCsprojFiles = (dir: string): string[] => {
    const files: string[] = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.git') {
        files.push(...findCsprojFiles(fullPath));
      } else if (entry.isFile() && entry.name.endsWith('.csproj')) {
        files.push(fullPath);
      }
    }
    
    return files;
  };
  
  const csprojFiles = findCsprojFiles(repoPath);
  console.log(`Found ${csprojFiles.length} .csproj file(s)`);
  
  for (const csprojFile of csprojFiles) {
    let content = fs.readFileSync(csprojFile, 'utf-8');
    let fileModified = false;
    
    for (const fix of fixes) {
      // Match PackageReference with specific package name and version
      // Using XML-aware pattern (not complex regex, but safe for .csproj structure)
      const pattern = new RegExp(
        `(<PackageReference\\s+Include="${fix.packageName}"\\s+Version=")${fix.invalidVersion}(")`,
        'g'
      );
      
      if (pattern.test(content)) {
        const correctVersion = fix.correctVersion || fix.invalidVersion;
        content = content.replace(pattern, `$1${correctVersion}$2`);
        fileModified = true;
        console.log(`  ✅ Fixed ${fix.packageName} version in ${path.basename(csprojFile)}: ${fix.invalidVersion} → ${correctVersion}`);
        fixCount++;
      }
    }
    
    if (fileModified) {
      fs.writeFileSync(csprojFile, content, 'utf-8');
    }
  }
  
  return fixCount;
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length < 3) {
    console.error('Usage: tsx fixNuGetVersions.ts <repoOwner> <repoName> <branchName>');
    process.exit(1);
  }
  
  const [repoOwner, repoName, branchName] = args;
  const cloneDir = path.join(process.cwd(), 'temp', `fix_${Date.now()}`);
  
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
    
    const fixes: NuGetPackageFix[] = [
      {
        packageName: 'Azure.Messaging.ServiceBus',
        invalidVersion: '8.0.0',
        correctVersion: latestVersion
      }
    ];
    
    // Clone repository with authentication
    console.log(`\n📥 Cloning repository...`);
    const repoUrl = `https://${githubToken}@github.com/${repoOwner}/${repoName}.git`;
    execSync(`git clone --branch ${branchName} --single-branch ${repoUrl} ${cloneDir}`, { stdio: 'inherit' });
    
    // Fix .csproj files
    console.log(`\n🔧 Fixing .csproj files...`);
    const fixCount = await fixCsprojVersions(cloneDir, fixes);
    
    if (fixCount === 0) {
      console.log('\n⚠️  No fixes needed - all versions are correct');
      // Cleanup
      execSync(`rm -rf ${cloneDir}`);
      process.exit(0);
    }
    
    console.log(`\n✅ Fixed ${fixCount} package reference(s)`);
    
    // Commit and push
    console.log(`\n📤 Committing and pushing changes...`);
    process.chdir(cloneDir);
    
    // Configure git to use token auth without askpass
    execSync('git config user.name "AI Migration Tool"');
    execSync('git config user.email "ai-migration@replit.dev"');
    execSync(`git remote set-url origin https://${githubToken}@github.com/${repoOwner}/${repoName}.git`);
    
    execSync('git add .');
    execSync(`git commit -m "Fix NuGet package versions: Azure.Messaging.ServiceBus ${latestVersion}"`);
    
    // Push with no askpass
    execSync(`git push origin ${branchName}`, { 
      stdio: 'inherit',
      env: { ...process.env, GIT_ASKPASS: '', GIT_TERMINAL_PROMPT: '0' }
    });
    
    console.log('\n🎉 Successfully pushed fixes to GitHub!');
    
    // Cleanup
    process.chdir(process.cwd());
    execSync(`rm -rf ${cloneDir}`);
    
  } catch (error) {
    console.error('\n❌ Error:', error);
    // Cleanup on error
    try {
      execSync(`rm -rf ${cloneDir}`);
    } catch {}
    process.exit(1);
  }
}

main();
