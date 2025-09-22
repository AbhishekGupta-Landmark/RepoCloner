import * as fs from 'fs';
import * as path from 'path';
import { TechnologyDetection, TechnologyCategory } from '@shared/schema';

export interface EnhancedTechnologyDetectionService {
  detectTechnologies(repositoryPath: string): Promise<TechnologyDetection[]>;
}

interface GlobalEvidence {
  lockfile: 'npm' | 'yarn' | 'pnpm' | null;
  ciFiles: string[];
  packageJsonScripts: Record<string, string>;
  packageJsonPath: string | null;
}

interface ContentCheckResult {
  found: boolean;
  version?: string;
  dependency?: string;
  versionSpec?: string;
}

interface TechnologyPattern {
  pattern: string;
  check?: string | string[] | null;
  name: string;
  category: TechnologyCategory;
  confidence: number;
  icon: string;
  versionExtractor?: string; // Path to version in JSON or regex pattern
  configFiles?: string[]; // Known config files for this technology
  scriptTokens?: string[]; // Script tokens to look for in package.json scripts
}

class EnhancedTechnologyDetector implements EnhancedTechnologyDetectionService {
  private readonly technologyPatterns: TechnologyPattern[] = [
    // ========== FRONTEND ==========
    // React Ecosystem
    { pattern: 'package.json', check: 'react', name: 'React', category: 'frontend', confidence: 0.95, icon: 'react', versionExtractor: 'react', configFiles: ['.babelrc', '.babelrc.json', 'babel.config.js', 'babel.config.json'], scriptTokens: ['react'] },
    { pattern: 'package.json', check: 'next', name: 'Next.js', category: 'frontend', confidence: 0.95, icon: 'nextjs', versionExtractor: 'next', configFiles: ['next.config.js', 'next.config.mjs', 'next.config.ts'], scriptTokens: ['next'] },
    { pattern: 'package.json', check: 'gatsby', name: 'Gatsby', category: 'frontend', confidence: 0.95, icon: 'gatsby', versionExtractor: 'gatsby', configFiles: ['gatsby-config.js', 'gatsby-config.ts', 'gatsby-node.js', 'gatsby-browser.js', 'gatsby-ssr.js'], scriptTokens: ['gatsby'] },
    { pattern: 'package.json', check: '@remix-run/react', name: 'Remix', category: 'frontend', confidence: 0.95, icon: 'remix', versionExtractor: '@remix-run/react', configFiles: ['remix.config.js', 'remix.config.ts'], scriptTokens: ['remix'] },
    
    // Vue Ecosystem
    { pattern: 'package.json', check: 'vue', name: 'Vue.js', category: 'frontend', confidence: 0.95, icon: 'vue', versionExtractor: 'vue', configFiles: ['vue.config.js', 'vue.config.ts'], scriptTokens: ['vue', 'serve'] },
    { pattern: 'package.json', check: 'nuxt', name: 'Nuxt.js', category: 'frontend', confidence: 0.95, icon: 'nuxtjs', versionExtractor: 'nuxt', configFiles: ['nuxt.config.js', 'nuxt.config.ts'], scriptTokens: ['nuxt'] },
    { pattern: 'package.json', check: 'quasar', name: 'Quasar', category: 'frontend', confidence: 0.95, icon: 'quasar', versionExtractor: 'quasar', configFiles: ['quasar.config.js', 'quasar.config.ts'], scriptTokens: ['quasar'] },
    
    // Angular Ecosystem
    { pattern: 'package.json', check: ['@angular/core', 'angular'], name: 'Angular', category: 'frontend', confidence: 0.95, icon: 'angular', versionExtractor: '@angular/core', configFiles: ['angular.json', 'tsconfig.json', 'tsconfig.app.json'], scriptTokens: ['ng', 'angular'] },
    { pattern: 'package.json', check: '@angular/cli', name: 'Angular CLI', category: 'frontend', confidence: 0.90, icon: 'angular', versionExtractor: '@angular/cli', configFiles: ['angular.json'], scriptTokens: ['ng'] },
    
    // Other Frontend Frameworks
    { pattern: 'package.json', check: 'svelte', name: 'Svelte', category: 'frontend', confidence: 0.95, icon: 'svelte', versionExtractor: 'svelte', configFiles: ['svelte.config.js', 'svelte.config.ts'], scriptTokens: ['svelte'] },
    { pattern: 'package.json', check: '@sveltejs/kit', name: 'SvelteKit', category: 'frontend', confidence: 0.95, icon: 'svelte', versionExtractor: '@sveltejs/kit', configFiles: ['svelte.config.js', 'svelte.config.ts'], scriptTokens: ['svelte-kit'] },
    { pattern: 'package.json', check: 'astro', name: 'Astro', category: 'frontend', confidence: 0.95, icon: 'astro', versionExtractor: 'astro', configFiles: ['astro.config.js', 'astro.config.mjs', 'astro.config.ts'], scriptTokens: ['astro'] },
    
    // CSS Frameworks & Libraries
    { pattern: 'package.json', check: 'tailwindcss', name: 'Tailwind CSS', category: 'frontend', confidence: 0.90, icon: 'tailwindcss', versionExtractor: 'tailwindcss', configFiles: ['tailwind.config.js', 'tailwind.config.ts', 'tailwind.config.cjs'], scriptTokens: ['tailwind'] },
    { pattern: 'package.json', check: 'bootstrap', name: 'Bootstrap', category: 'frontend', confidence: 0.90, icon: 'bootstrap', versionExtractor: 'bootstrap' },
    { pattern: 'package.json', check: '@mui/material', name: 'Material-UI', category: 'frontend', confidence: 0.90, icon: 'mui', versionExtractor: '@mui/material' },
    { pattern: 'package.json', check: 'styled-components', name: 'Styled Components', category: 'frontend', confidence: 0.85, icon: 'styled-components', versionExtractor: 'styled-components' },
    
    // Build Tools
    { pattern: 'package.json', check: 'vite', name: 'Vite', category: 'devops', confidence: 0.90, icon: 'vite', versionExtractor: 'vite', configFiles: ['vite.config.js', 'vite.config.ts', 'vite.config.mjs'], scriptTokens: ['vite'] },
    { pattern: 'package.json', check: 'webpack', name: 'Webpack', category: 'devops', confidence: 0.85, icon: 'webpack', versionExtractor: 'webpack', configFiles: ['webpack.config.js', 'webpack.config.ts'], scriptTokens: ['webpack'] },
    { pattern: 'package.json', check: 'parcel', name: 'Parcel', category: 'devops', confidence: 0.85, icon: 'parcel', versionExtractor: 'parcel', configFiles: ['.parcelrc'], scriptTokens: ['parcel'] },
    { pattern: 'package.json', check: 'rollup', name: 'Rollup', category: 'devops', confidence: 0.85, icon: 'rollup', versionExtractor: 'rollup', configFiles: ['rollup.config.js', 'rollup.config.ts', 'rollup.config.mjs'], scriptTokens: ['rollup'] },
    
    // ========== BACKEND ==========
    // Node.js Frameworks
    { pattern: 'package.json', check: 'express', name: 'Express.js', category: 'backend', confidence: 0.95, icon: 'express', versionExtractor: 'express' },
    { pattern: 'package.json', check: 'fastify', name: 'Fastify', category: 'backend', confidence: 0.95, icon: 'fastify', versionExtractor: 'fastify' },
    { pattern: 'package.json', check: '@nestjs/core', name: 'NestJS', category: 'backend', confidence: 0.95, icon: 'nestjs', versionExtractor: '@nestjs/core' },
    { pattern: 'package.json', check: 'koa', name: 'Koa.js', category: 'backend', confidence: 0.95, icon: 'koa', versionExtractor: 'koa' },
    
    // Python Frameworks
    { pattern: 'requirements.txt', check: 'django', name: 'Django', category: 'backend', confidence: 0.95, icon: 'django', versionExtractor: 'django==' },
    { pattern: 'requirements.txt', check: 'flask', name: 'Flask', category: 'backend', confidence: 0.95, icon: 'flask', versionExtractor: 'flask==' },
    { pattern: 'requirements.txt', check: 'fastapi', name: 'FastAPI', category: 'backend', confidence: 0.95, icon: 'fastapi', versionExtractor: 'fastapi==' },
    
    // Java Frameworks
    { pattern: 'pom.xml', check: 'spring-boot', name: 'Spring Boot', category: 'backend', confidence: 0.95, icon: 'spring', versionExtractor: '<version>' },
    { pattern: 'build.gradle', check: 'spring-boot', name: 'Spring Boot', category: 'backend', confidence: 0.95, icon: 'spring' },
    
    // .NET Frameworks - Basic detection first
    { pattern: '*.csproj', check: null, name: '.NET/C#', category: 'backend', confidence: 0.90, icon: 'dotnet' },
    { pattern: '*.sln', check: null, name: '.NET Solution', category: 'backend', confidence: 0.90, icon: 'dotnet' },
    { pattern: '*.csproj', check: 'Microsoft.AspNetCore', name: 'ASP.NET Core', category: 'backend', confidence: 0.95, icon: 'dotnet', versionExtractor: 'Version="' },
    { pattern: '*.csproj', check: 'Microsoft.EntityFrameworkCore', name: 'Entity Framework Core', category: 'database', confidence: 0.90, icon: 'dotnet', versionExtractor: 'Version="' },
    { pattern: '*.csproj', check: ['Confluent.Kafka', 'confluent.kafka'], name: 'Apache Kafka (.NET)', category: 'database', confidence: 0.95, icon: 'kafka', versionExtractor: 'Version="' },
    
    // ========== DATABASE ==========
    // SQL Databases
    { pattern: 'package.json', check: 'pg', name: 'PostgreSQL', category: 'database', confidence: 0.90, icon: 'postgresql', versionExtractor: 'pg' },
    { pattern: 'package.json', check: 'mysql2', name: 'MySQL', category: 'database', confidence: 0.90, icon: 'mysql', versionExtractor: 'mysql2' },
    { pattern: 'package.json', check: 'sqlite3', name: 'SQLite', category: 'database', confidence: 0.90, icon: 'sqlite', versionExtractor: 'sqlite3' },
    
    // NoSQL Databases
    { pattern: 'package.json', check: 'mongodb', name: 'MongoDB', category: 'database', confidence: 0.90, icon: 'mongodb', versionExtractor: 'mongodb' },
    { pattern: 'package.json', check: 'redis', name: 'Redis', category: 'database', confidence: 0.90, icon: 'redis', versionExtractor: 'redis' },
    
    // ORMs
    { pattern: 'package.json', check: 'prisma', name: 'Prisma', category: 'database', confidence: 0.95, icon: 'prisma', versionExtractor: 'prisma' },
    { pattern: 'package.json', check: 'sequelize', name: 'Sequelize', category: 'database', confidence: 0.90, icon: 'sequelize', versionExtractor: 'sequelize' },
    { pattern: 'package.json', check: 'typeorm', name: 'TypeORM', category: 'database', confidence: 0.90, icon: 'typeorm', versionExtractor: 'typeorm' },
    { pattern: 'package.json', check: 'drizzle-orm', name: 'Drizzle ORM', category: 'database', confidence: 0.90, icon: 'drizzle', versionExtractor: 'drizzle-orm' },
    
    // ========== CLOUD ==========
    // AWS
    { pattern: 'package.json', check: 'aws-sdk', name: 'AWS SDK', category: 'cloud', confidence: 0.90, icon: 'aws', versionExtractor: 'aws-sdk' },
    { pattern: 'package.json', check: '@aws-sdk/client-s3', name: 'AWS S3', category: 'cloud', confidence: 0.95, icon: 'aws-s3', versionExtractor: '@aws-sdk/client-s3' },
    
    // Azure
    { pattern: 'package.json', check: '@azure/storage-blob', name: 'Azure Blob Storage', category: 'cloud', confidence: 0.95, icon: 'azure', versionExtractor: '@azure/storage-blob' },
    
    // Docker & Containers
    { pattern: 'Dockerfile', check: null, name: 'Docker', category: 'cloud', confidence: 0.95, icon: 'docker' },
    { pattern: 'docker-compose.yml', check: null, name: 'Docker Compose', category: 'cloud', confidence: 0.95, icon: 'docker' },
    { pattern: 'package.json', check: 'kubernetes', name: 'Kubernetes', category: 'cloud', confidence: 0.90, icon: 'kubernetes', versionExtractor: 'kubernetes' },
    
    // ========== TESTING ==========
    // JavaScript Testing
    { pattern: 'package.json', check: 'jest', name: 'Jest', category: 'testing', confidence: 0.95, icon: 'jest', versionExtractor: 'jest', configFiles: ['jest.config.js', 'jest.config.ts', 'jest.config.json'], scriptTokens: ['jest', 'test'] },
    { pattern: 'package.json', check: 'vitest', name: 'Vitest', category: 'testing', confidence: 0.95, icon: 'vitest', versionExtractor: 'vitest', configFiles: ['vitest.config.js', 'vitest.config.ts'], scriptTokens: ['vitest', 'test'] },
    { pattern: 'package.json', check: 'cypress', name: 'Cypress', category: 'testing', confidence: 0.95, icon: 'cypress', versionExtractor: 'cypress', configFiles: ['cypress.config.js', 'cypress.config.ts', 'cypress.json'], scriptTokens: ['cypress'] },
    { pattern: 'package.json', check: 'playwright', name: 'Playwright', category: 'testing', confidence: 0.95, icon: 'playwright', versionExtractor: 'playwright', configFiles: ['playwright.config.js', 'playwright.config.ts'], scriptTokens: ['playwright'] },
    { pattern: 'package.json', check: '@testing-library/react', name: 'React Testing Library', category: 'testing', confidence: 0.90, icon: 'testing-library', versionExtractor: '@testing-library/react', scriptTokens: ['test'] },
    
    // .NET Testing
    { pattern: '*.csproj', check: 'Microsoft.NET.Test.Sdk', name: 'MSTest', category: 'testing', confidence: 0.90, icon: 'dotnet' },
    { pattern: '*.csproj', check: 'xunit', name: 'xUnit', category: 'testing', confidence: 0.95, icon: 'xunit' },
    { pattern: '*.csproj', check: 'NUnit', name: 'NUnit', category: 'testing', confidence: 0.95, icon: 'nunit' },
    
    // ========== DEVOPS ==========
    // CI/CD
    { pattern: '.github/workflows', check: null, name: 'GitHub Actions', category: 'devops', confidence: 0.95, icon: 'github-actions' },
    { pattern: '.gitlab-ci.yml', check: null, name: 'GitLab CI', category: 'devops', confidence: 0.95, icon: 'gitlab' },
    { pattern: 'azure-pipelines.yml', check: null, name: 'Azure DevOps', category: 'devops', confidence: 0.95, icon: 'azure-devops' },
    
    // Package Managers
    { pattern: 'package.json', check: null, name: 'npm', category: 'utilities', confidence: 0.80, icon: 'npm' },
    { pattern: 'yarn.lock', check: null, name: 'Yarn', category: 'utilities', confidence: 0.90, icon: 'yarn' },
    { pattern: 'pnpm-lock.yaml', check: null, name: 'pnpm', category: 'utilities', confidence: 0.95, icon: 'pnpm' },
    
    // ========== SECURITY ==========
    { pattern: 'package.json', check: 'helmet', name: 'Helmet.js', category: 'security', confidence: 0.90, icon: 'helmet', versionExtractor: 'helmet' },
    { pattern: 'package.json', check: 'bcrypt', name: 'bcrypt', category: 'security', confidence: 0.95, icon: 'bcrypt', versionExtractor: 'bcrypt' },
    { pattern: 'package.json', check: 'jsonwebtoken', name: 'JWT', category: 'security', confidence: 0.95, icon: 'jwt', versionExtractor: 'jsonwebtoken' },
    
    // ========== MONITORING ==========
    { pattern: 'package.json', check: 'winston', name: 'Winston', category: 'monitoring', confidence: 0.90, icon: 'winston', versionExtractor: 'winston' },
    { pattern: 'package.json', check: 'morgan', name: 'Morgan', category: 'monitoring', confidence: 0.85, icon: 'morgan', versionExtractor: 'morgan' },
    
    // File Extensions
    { pattern: '*.tsx', check: null, name: 'TypeScript React', category: 'frontend', confidence: 0.85, icon: 'typescript', configFiles: ['tsconfig.json', 'tsconfig.react.json'] },
    { pattern: '*.ts', check: null, name: 'TypeScript', category: 'utilities', confidence: 0.85, icon: 'typescript', configFiles: ['tsconfig.json', 'tsconfig.build.json'], scriptTokens: ['tsc', 'typescript'] },
    { pattern: '*.jsx', check: null, name: 'React JSX', category: 'frontend', confidence: 0.80, icon: 'react' },
    { pattern: '*.vue', check: null, name: 'Vue Component', category: 'frontend', confidence: 0.90, icon: 'vue' },
    { pattern: '*.svelte', check: null, name: 'Svelte Component', category: 'frontend', confidence: 0.90, icon: 'svelte' },
    { pattern: '*.cs', check: null, name: 'C#', category: 'backend', confidence: 0.85, icon: 'csharp' },
    { pattern: '*.py', check: null, name: 'Python', category: 'backend', confidence: 0.80, icon: 'python', configFiles: ['pyproject.toml', 'setup.py', 'setup.cfg'] },
    { pattern: '*.java', check: null, name: 'Java', category: 'backend', confidence: 0.80, icon: 'java', configFiles: ['pom.xml', 'build.gradle', 'build.gradle.kts'] },
    { pattern: '*.go', check: null, name: 'Go', category: 'backend', confidence: 0.80, icon: 'go', configFiles: ['go.mod', 'go.sum'] },
    { pattern: '*.rs', check: null, name: 'Rust', category: 'backend', confidence: 0.80, icon: 'rust', configFiles: ['Cargo.toml', 'Cargo.lock'] },
  ];

  async detectTechnologies(repositoryPath: string): Promise<TechnologyDetection[]> {
    const technologies: TechnologyDetection[] = [];
    const detectedTechs = new Set<string>(); // Prevent duplicates

    try {
      // Check if path exists
      if (!fs.existsSync(repositoryPath)) {
        return [];
      }
      
      // Collect global evidence once
      const globalEvidence = await this.collectGlobalEvidence(repositoryPath);

      for (const pattern of this.technologyPatterns) {
        const detectedTech = await this.checkPattern(repositoryPath, pattern, globalEvidence);
        if (detectedTech && !detectedTechs.has(detectedTech.name)) {
          technologies.push(detectedTech);
          detectedTechs.add(detectedTech.name);
        }
      }
      
      // Sort by confidence score
      technologies.sort((a, b) => b.confidence - a.confidence);
      
      return technologies;
    } catch (error) {
      return [];
    }
  }

  private async checkPattern(repositoryPath: string, pattern: TechnologyPattern, globalEvidence: GlobalEvidence): Promise<TechnologyDetection | null> {
    try {
      if (pattern.pattern.includes('*')) {
        // File extension pattern
        return await this.checkFileExtensionPattern(repositoryPath, pattern, globalEvidence);
      } else {
        // Specific file pattern
        return await this.checkSpecificFilePattern(repositoryPath, pattern, globalEvidence);
      }
    } catch (error) {
      return null;
    }
  }

  private async checkFileExtensionPattern(repositoryPath: string, pattern: TechnologyPattern, globalEvidence: GlobalEvidence): Promise<TechnologyDetection | null> {
    const extension = pattern.pattern.replace('*', '');
    const extensionFiles = await this.getFilesWithExtension(repositoryPath, extension);
    
    if (extensionFiles.length > 0) {
      // If pattern has content checks, verify them
      if (pattern.check !== null) {
        for (const file of extensionFiles) {
          const filePath = path.join(repositoryPath, file);
          const hasContent = await this.checkFileContent(filePath, pattern.check!, pattern.versionExtractor);
          if (hasContent.found) {
            const evidence = await this.collectTechnologyEvidence(repositoryPath, pattern, globalEvidence, [file], hasContent);
            return {
              name: pattern.name,
              category: pattern.category,
              confidence: pattern.confidence,
              version: hasContent.version,
              icon: pattern.icon,
              ...evidence
            };
          }
        }
        return null; // Content check failed for all files
      } else {
        // No content check needed, just file existence
        const evidence = await this.collectTechnologyEvidence(repositoryPath, pattern, globalEvidence, extensionFiles);
        
        return {
          name: pattern.name,
          category: pattern.category,
          confidence: pattern.confidence,
          icon: pattern.icon,
          ...evidence
        };
      }
    }
    
    return null;
  }

  private async checkSpecificFilePattern(repositoryPath: string, pattern: TechnologyPattern, globalEvidence: GlobalEvidence): Promise<TechnologyDetection | null> {
    const filePath = path.join(repositoryPath, pattern.pattern);
    
    if (await this.fileExists(filePath)) {
      if (pattern.check === null) {
        // File existence check only
        const evidence = await this.collectTechnologyEvidence(repositoryPath, pattern, globalEvidence, [pattern.pattern]);
        
        return {
          name: pattern.name,
          category: pattern.category,
          confidence: pattern.confidence,
          icon: pattern.icon,
          ...evidence
        };
      }
      
      // Content-based check
      const hasContent = await this.checkFileContent(filePath, pattern.check!, pattern.versionExtractor);
      if (hasContent.found) {
        const evidence = await this.collectTechnologyEvidence(repositoryPath, pattern, globalEvidence, [pattern.pattern], hasContent);
        
        return {
          name: pattern.name,
          category: pattern.category,
          confidence: pattern.confidence,
          version: hasContent.version,
          icon: pattern.icon,
          ...evidence
        };
      }
    }
    
    return null;
  }

  private async getFilesWithExtension(dirPath: string, extension: string, repositoryRoot?: string): Promise<string[]> {
    const foundFiles: string[] = [];
    const rootPath = repositoryRoot || dirPath; // First call uses dirPath as root
    
    try {
      const files = await fs.promises.readdir(dirPath, { withFileTypes: true });
      
      for (const file of files) {
        if (file.isFile() && file.name.endsWith(extension)) {
          const filePath = path.join(dirPath, file.name);
          const relativePath = path.relative(rootPath, filePath);
          foundFiles.push(relativePath);
        } else if (file.isDirectory() && !file.name.startsWith('.') && !file.name.includes('node_modules')) {
          const subDirPath = path.join(dirPath, file.name);
          const subFiles = await this.getFilesWithExtension(subDirPath, extension, rootPath);
          foundFiles.push(...subFiles);
        }
      }
      
      return foundFiles;
    } catch (error) {
      return [];
    }
  }

  private async fileExists(filePath: string): Promise<boolean> {
    try {
      await fs.promises.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  private async checkFileContent(filePath: string, checks: string | string[], versionExtractor?: string): Promise<ContentCheckResult> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf8');
      const checksArray = Array.isArray(checks) ? checks : [checks];
      
      for (const check of checksArray) {
        if (content.includes(check)) {
          let version: string | undefined;
          let dependency: string | undefined;
          let versionSpec: string | undefined;
          
          // Extract version if possible
          if (versionExtractor && filePath.endsWith('.json')) {
            const versionInfo = this.extractVersionInfoFromJson(content, versionExtractor);
            version = versionInfo.version;
            dependency = versionExtractor;
            versionSpec = versionInfo.versionSpec;
          } else if (versionExtractor && (filePath.endsWith('.xml') || filePath.endsWith('.csproj'))) {
            version = this.extractVersionFromXml(content, versionExtractor);
            dependency = check;
          } else if (versionExtractor && filePath.includes('requirements.txt')) {
            version = this.extractVersionFromRequirements(content, versionExtractor);
            dependency = check;
          }
          
          return { found: true, version, dependency, versionSpec };
        }
      }
      
      return { found: false };
    } catch (error) {
      return { found: false };
    }
  }

  private extractVersionFromJson(content: string, packageName: string): string | undefined {
    const versionInfo = this.extractVersionInfoFromJson(content, packageName);
    return versionInfo.version;
  }

  private extractVersionInfoFromJson(content: string, packageName: string): {version?: string, versionSpec?: string} {
    try {
      const json = JSON.parse(content);
      const dependencies = { ...json.dependencies, ...json.devDependencies, ...json.peerDependencies };
      const versionSpec = dependencies[packageName];
      if (!versionSpec) return {};
      
      const version = versionSpec.replace(/[\^~]/, '');
      return { version, versionSpec };
    } catch {
      return {};
    }
  }

  private extractVersionFromXml(content: string, pattern: string): string | undefined {
    try {
      const regex = new RegExp(`${pattern}([^<"]+)`, 'i');
      const match = content.match(regex);
      return match ? match[1] : undefined;
    } catch {
      return undefined;
    }
  }

  private extractVersionFromRequirements(content: string, packagePattern: string): string | undefined {
    try {
      const lines = content.split('\n');
      for (const line of lines) {
        if (line.includes(packagePattern)) {
          const match = line.match(/==([^\s]+)/);
          return match ? match[1] : undefined;
        }
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  private async collectGlobalEvidence(repositoryPath: string): Promise<GlobalEvidence> {
    // Detect package manager from lockfiles
    let lockfile: 'npm' | 'yarn' | 'pnpm' | null = null;
    if (await this.fileExists(path.join(repositoryPath, 'package-lock.json'))) {
      lockfile = 'npm';
    } else if (await this.fileExists(path.join(repositoryPath, 'yarn.lock'))) {
      lockfile = 'yarn';
    } else if (await this.fileExists(path.join(repositoryPath, 'pnpm-lock.yaml'))) {
      lockfile = 'pnpm';
    }

    // Find CI/CD files
    const ciFiles: string[] = [];
    const ciPatterns = [
      '.github/workflows',
      '.gitlab-ci.yml',
      'azure-pipelines.yml',
      'circle.yml',
      'appveyor.yml',
      'bitbucket-pipelines.yml'
    ];

    for (const pattern of ciPatterns) {
      if (pattern.endsWith('/workflows')) {
        // Directory check for GitHub Actions
        const workflowDir = path.join(repositoryPath, pattern);
        if (await this.directoryExists(workflowDir)) {
          const workflowFiles = await this.getYmlFilesInDirectory(workflowDir);
          ciFiles.push(...workflowFiles.map(file => path.join(pattern, file)));
        }
      } else {
        // File check for other CI systems
        if (await this.fileExists(path.join(repositoryPath, pattern))) {
          ciFiles.push(pattern);
        }
      }
    }

    // Parse package.json scripts
    let packageJsonScripts: Record<string, string> = {};
    let packageJsonPath: string | null = null;
    const packageJsonFilePath = path.join(repositoryPath, 'package.json');
    
    if (await this.fileExists(packageJsonFilePath)) {
      packageJsonPath = 'package.json';
      try {
        const content = await fs.promises.readFile(packageJsonFilePath, 'utf8');
        const json = JSON.parse(content);
        packageJsonScripts = json.scripts || {};
      } catch (error) {
        // Silently ignore parse errors
      }
    }

    return {
      lockfile,
      ciFiles,
      packageJsonScripts,
      packageJsonPath
    };
  }

  private async collectTechnologyEvidence(
    repositoryPath: string,
    pattern: TechnologyPattern,
    globalEvidence: GlobalEvidence,
    evidenceFiles: string[],
    contentResult?: ContentCheckResult
  ): Promise<Partial<TechnologyDetection>> {
    const evidence: Partial<TechnologyDetection> = {};

    // 1. Evidence Files
    evidence.evidenceFiles = evidenceFiles;

    // 2. Manifest Information
    if (contentResult && globalEvidence.packageJsonPath) {
      evidence.manifest = {
        file: globalEvidence.packageJsonPath,
        dependency: contentResult.dependency,
        versionSpec: contentResult.versionSpec
      };
    } else if (pattern.pattern === 'requirements.txt' && contentResult) {
      evidence.manifest = {
        file: 'requirements.txt',
        dependency: contentResult.dependency,
        versionSpec: contentResult.versionSpec
      };
    } else if (pattern.pattern.endsWith('.csproj') && contentResult) {
      evidence.manifest = {
        file: evidenceFiles[0],
        dependency: contentResult.dependency,
        versionSpec: contentResult.version
      };
    }

    // 3. Config Files
    if (pattern.configFiles) {
      const existingConfigFiles: string[] = [];
      for (const configFile of pattern.configFiles) {
        if (await this.fileExists(path.join(repositoryPath, configFile))) {
          existingConfigFiles.push(configFile);
        }
      }
      if (existingConfigFiles.length > 0) {
        evidence.configFiles = existingConfigFiles;
      }
    }

    // 4. Scripts
    if (pattern.scriptTokens && globalEvidence.packageJsonPath) {
      const matchingScripts: { file: string; names: string[] } = {
        file: globalEvidence.packageJsonPath,
        names: []
      };

      for (const [scriptName, scriptCommand] of Object.entries(globalEvidence.packageJsonScripts)) {
        for (const token of pattern.scriptTokens) {
          if (scriptCommand.includes(token) || scriptName.includes(token)) {
            matchingScripts.names.push(scriptName);
            break;
          }
        }
      }

      if (matchingScripts.names.length > 0) {
        evidence.scripts = [matchingScripts];
      }
    }

    // 5. Lockfile (from global evidence)
    evidence.lockfile = globalEvidence.lockfile;

    // 6. CI Files (from global evidence, filtered by relevance)
    if (globalEvidence.ciFiles.length > 0) {
      evidence.ciFiles = globalEvidence.ciFiles;
    }

    return evidence;
  }

  private async directoryExists(dirPath: string): Promise<boolean> {
    try {
      const stats = await fs.promises.stat(dirPath);
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  private async getYmlFilesInDirectory(dirPath: string): Promise<string[]> {
    try {
      const files = await fs.promises.readdir(dirPath);
      return files.filter(file => file.endsWith('.yml') || file.endsWith('.yaml'));
    } catch {
      return [];
    }
  }
}

export const enhancedTechnologyDetectionService = new EnhancedTechnologyDetector();