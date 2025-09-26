#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

console.log('🔧 Fixing Vite config for local development...');

// Check if we're in the right directory
if (!fs.existsSync('vite.config.ts') || !fs.existsSync('vite.config.local.ts')) {
  console.error('❌ Error: vite.config.ts or vite.config.local.ts not found');
  console.error('Make sure you\'re in the project root directory');
  process.exit(1);
}

try {
  // Backup original config
  if (!fs.existsSync('vite.config.replit.ts')) {
    fs.copyFileSync('vite.config.ts', 'vite.config.replit.ts');
    console.log('✅ Backed up original config to vite.config.replit.ts');
  }

  // Replace main config with local config
  fs.copyFileSync('vite.config.local.ts', 'vite.config.ts');
  console.log('✅ Replaced vite.config.ts with local version');

  // Check if 'which' dependency exists
  const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
  if (!packageJson.dependencies.which && !packageJson.devDependencies?.which) {
    console.log('⚠️  Missing "which" dependency. Installing...');
    const { execSync } = require('child_process');
    execSync('npm install which', { stdio: 'inherit' });
    console.log('✅ Installed "which" dependency');
  }

  console.log('');
  console.log('🎉 Local development setup complete!');
  console.log('');
  console.log('Now you can run:');
  console.log('  npm run dev');
  console.log('');
  console.log('To restore Replit config later:');
  console.log('  mv vite.config.replit.ts vite.config.ts');

} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}