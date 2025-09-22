import * as fs from 'fs';
import * as path from 'path';
import { TechnologyDetection, TechnologyCategory } from '@shared/schema';

export interface TechnologyDetectionService {
  detectTechnologies(repositoryPath: string): Promise<TechnologyDetection[]>;
}

class TechnologyDetector implements TechnologyDetectionService {
  private readonly technologyPatterns = {
    frontend: [
      // JavaScript/TypeScript Frameworks
      { pattern: 'package.json', check: 'react', name: 'React', confidence: 0.9, icon: 'react', description: 'JavaScript library for building user interfaces' },
      { pattern: 'package.json', check: 'vue', name: 'Vue.js', confidence: 0.9, icon: 'vue', description: 'Progressive JavaScript framework' },
      { pattern: 'package.json', check: 'angular', name: 'Angular', confidence: 0.9, icon: 'angular', description: 'Platform for building mobile and desktop web applications' },
      { pattern: 'package.json', check: '@angular/core', name: 'Angular', confidence: 0.95, icon: 'angular', description: 'Platform for building mobile and desktop web applications' },
      { pattern: 'package.json', check: 'svelte', name: 'Svelte', confidence: 0.9, icon: 'svelte', description: 'Cybernetically enhanced web apps' },
      { pattern: 'package.json', check: 'next', name: 'Next.js', confidence: 0.9, icon: 'nextjs', description: 'React framework for production' },
      { pattern: 'package.json', check: 'nuxt', name: 'Nuxt.js', confidence: 0.9 },
      { pattern: 'package.json', check: 'gatsby', name: 'Gatsby', confidence: 0.9 },
      { pattern: 'package.json', check: 'astro', name: 'Astro', confidence: 0.9 },
      
      // CSS Frameworks
      { pattern: 'package.json', check: 'tailwindcss', name: 'Tailwind CSS', confidence: 0.8 },
      { pattern: 'package.json', check: 'bootstrap', name: 'Bootstrap', confidence: 0.8 },
      { pattern: 'package.json', check: 'bulma', name: 'Bulma', confidence: 0.8 },
      { pattern: 'package.json', check: 'styled-components', name: 'Styled Components', confidence: 0.8 },
      { pattern: 'package.json', check: '@emotion/react', name: 'Emotion', confidence: 0.8 },
      
      // Mobile Development
      { pattern: 'package.json', check: 'react-native', name: 'React Native', confidence: 0.9 },
      { pattern: 'package.json', check: '@ionic/react', name: 'Ionic React', confidence: 0.9 },
      { pattern: 'package.json', check: 'expo', name: 'Expo', confidence: 0.9 },
      
      // Build Tools
      { pattern: 'package.json', check: 'webpack', name: 'Webpack', confidence: 0.7 },
      { pattern: 'package.json', check: 'vite', name: 'Vite', confidence: 0.8 },
      { pattern: 'package.json', check: 'parcel', name: 'Parcel', confidence: 0.8 },
      
      // File Extensions
      { pattern: '*.tsx', check: null, name: 'TypeScript React', confidence: 0.9 },
      { pattern: '*.jsx', check: null, name: 'React JSX', confidence: 0.8 },
      { pattern: '*.vue', check: null, name: 'Vue.js', confidence: 0.9 },
      { pattern: '*.svelte', check: null, name: 'Svelte', confidence: 0.9 },
      { pattern: '*.scss', check: null, name: 'SCSS', confidence: 0.7 },
      { pattern: '*.sass', check: null, name: 'Sass', confidence: 0.7 },
      { pattern: '*.less', check: null, name: 'Less', confidence: 0.7 },
      { pattern: '*.styl', check: null, name: 'Stylus', confidence: 0.7 },
    ],
    
    backend: [
      // Node.js
      { pattern: 'package.json', check: 'express', name: 'Express.js', confidence: 0.9 },
      { pattern: 'package.json', check: 'fastify', name: 'Fastify', confidence: 0.9 },
      { pattern: 'package.json', check: 'koa', name: 'Koa.js', confidence: 0.9 },
      { pattern: 'package.json', check: 'hapi', name: 'Hapi.js', confidence: 0.9 },
      { pattern: 'package.json', check: 'nestjs', name: 'NestJS', confidence: 0.9 },
      { pattern: 'package.json', check: '@nestjs/core', name: 'NestJS', confidence: 0.95 },
      
      // Python
      { pattern: 'requirements.txt', check: 'django', name: 'Django', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'flask', name: 'Flask', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'fastapi', name: 'FastAPI', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'tornado', name: 'Tornado', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'pyramid', name: 'Pyramid', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'bottle', name: 'Bottle', confidence: 0.9 },
      { pattern: 'pyproject.toml', check: 'django', name: 'Django', confidence: 0.8 },
      { pattern: 'pyproject.toml', check: 'flask', name: 'Flask', confidence: 0.8 },
      { pattern: 'pyproject.toml', check: 'fastapi', name: 'FastAPI', confidence: 0.8 },
      
      // Java
      { pattern: 'pom.xml', check: 'spring-boot', name: 'Spring Boot', confidence: 0.9 },
      { pattern: 'pom.xml', check: 'spring-core', name: 'Spring Framework', confidence: 0.9 },
      { pattern: 'build.gradle', check: 'spring-boot', name: 'Spring Boot', confidence: 0.9 },
      { pattern: 'build.gradle', check: 'micronaut', name: 'Micronaut', confidence: 0.9 },
      { pattern: 'build.gradle', check: 'quarkus', name: 'Quarkus', confidence: 0.9 },
      
      // .NET
      { pattern: '*.csproj', check: null, name: '.NET', confidence: 0.9 },
      { pattern: '*.sln', check: null, name: '.NET Solution', confidence: 0.9 },
      { pattern: 'global.json', check: null, name: '.NET', confidence: 0.8 },
      { pattern: '*.csproj', check: 'Microsoft.AspNetCore', name: 'ASP.NET Core', confidence: 0.95 },
      { pattern: '*.csproj', check: 'Microsoft.EntityFrameworkCore', name: 'Entity Framework Core', confidence: 0.9 },
      { pattern: '*.csproj', check: 'Confluent.Kafka', name: 'Apache Kafka (.NET)', confidence: 0.95 },
      { pattern: '*.csproj', check: 'Microsoft.Extensions.Hosting', name: '.NET Generic Host', confidence: 0.85 },
      { pattern: '*.csproj', check: 'Microsoft.Extensions.DependencyInjection', name: '.NET Dependency Injection', confidence: 0.8 },
      { pattern: '*.csproj', check: 'Newtonsoft.Json', name: 'Newtonsoft.Json', confidence: 0.8 },
      { pattern: '*.csproj', check: 'System.Text.Json', name: 'System.Text.Json', confidence: 0.8 },
      { pattern: '*.csproj', check: 'Microsoft.Extensions.Configuration', name: '.NET Configuration', confidence: 0.8 },
      { pattern: '*.csproj', check: 'Microsoft.Extensions.Logging', name: '.NET Logging', confidence: 0.8 },
      { pattern: 'Program.cs', check: null, name: '.NET Application', confidence: 0.8 },
      { pattern: 'Startup.cs', check: null, name: 'ASP.NET Core', confidence: 0.9 },
      
      // Ruby
      { pattern: 'Gemfile', check: 'rails', name: 'Ruby on Rails', confidence: 0.9 },
      { pattern: 'Gemfile', check: 'sinatra', name: 'Sinatra', confidence: 0.9 },
      
      // PHP
      { pattern: 'composer.json', check: 'laravel/framework', name: 'Laravel', confidence: 0.9 },
      { pattern: 'composer.json', check: 'symfony/symfony', name: 'Symfony', confidence: 0.9 },
      { pattern: 'composer.json', check: 'slim/slim', name: 'Slim Framework', confidence: 0.9 },
      
      // Go
      { pattern: 'go.mod', check: 'gin-gonic/gin', name: 'Gin', confidence: 0.9 },
      { pattern: 'go.mod', check: 'gorilla/mux', name: 'Gorilla Mux', confidence: 0.9 },
      { pattern: 'go.mod', check: 'echo', name: 'Echo', confidence: 0.9 },
      
      // Rust
      { pattern: 'Cargo.toml', check: 'actix-web', name: 'Actix Web', confidence: 0.9 },
      { pattern: 'Cargo.toml', check: 'warp', name: 'Warp', confidence: 0.9 },
      { pattern: 'Cargo.toml', check: 'rocket', name: 'Rocket', confidence: 0.9 },
      
      // File Extensions
      { pattern: '*.py', check: null, name: 'Python', confidence: 0.8 },
      { pattern: '*.java', check: null, name: 'Java', confidence: 0.8 },
      { pattern: '*.cs', check: null, name: 'C#', confidence: 0.8 },
      { pattern: '*.rb', check: null, name: 'Ruby', confidence: 0.8 },
      { pattern: '*.php', check: null, name: 'PHP', confidence: 0.8 },
      { pattern: '*.go', check: null, name: 'Go', confidence: 0.8 },
      { pattern: '*.rs', check: null, name: 'Rust', confidence: 0.8 },
    ],
    
    databaseCloud: [
      // Databases
      { pattern: 'package.json', check: 'mongoose', name: 'MongoDB', confidence: 0.9 },
      { pattern: 'package.json', check: 'pg', name: 'PostgreSQL', confidence: 0.9 },
      { pattern: 'package.json', check: 'mysql2', name: 'MySQL', confidence: 0.9 },
      { pattern: 'package.json', check: 'redis', name: 'Redis', confidence: 0.9 },
      { pattern: 'package.json', check: 'prisma', name: 'Prisma', confidence: 0.9 },
      { pattern: 'package.json', check: 'typeorm', name: 'TypeORM', confidence: 0.8 },
      { pattern: 'package.json', check: 'sequelize', name: 'Sequelize', confidence: 0.8 },
      { pattern: 'package.json', check: 'drizzle-orm', name: 'Drizzle ORM', confidence: 0.9 },
      
      { pattern: 'requirements.txt', check: 'psycopg2', name: 'PostgreSQL', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'pymongo', name: 'MongoDB', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'redis', name: 'Redis', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'sqlalchemy', name: 'SQLAlchemy', confidence: 0.8 },
      
      // Messaging & Streaming
      { pattern: '*.csproj', check: 'Confluent.Kafka', name: 'Apache Kafka', confidence: 0.95 },
      { pattern: 'package.json', check: 'kafkajs', name: 'Apache Kafka', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'kafka-python', name: 'Apache Kafka', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'confluent-kafka', name: 'Apache Kafka', confidence: 0.9 },
      { pattern: 'pom.xml', check: 'kafka-clients', name: 'Apache Kafka', confidence: 0.9 },
      { pattern: 'go.mod', check: 'kafka-go', name: 'Apache Kafka', confidence: 0.9 },

      // Cloud Services
      { pattern: 'package.json', check: 'aws-sdk', name: 'AWS SDK', confidence: 0.9 },
      { pattern: 'package.json', check: '@aws-sdk', name: 'AWS SDK v3', confidence: 0.9 },
      { pattern: 'package.json', check: '@google-cloud', name: 'Google Cloud', confidence: 0.9 },
      { pattern: 'package.json', check: '@azure', name: 'Azure', confidence: 0.9 },
      { pattern: 'package.json', check: 'firebase', name: 'Firebase', confidence: 0.9 },
      { pattern: 'package.json', check: 'supabase', name: 'Supabase', confidence: 0.9 },
      
      { pattern: 'requirements.txt', check: 'boto3', name: 'AWS (Boto3)', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'google-cloud', name: 'Google Cloud', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'azure', name: 'Azure', confidence: 0.9 },
      
      // Config Files
      { pattern: 'docker-compose.yml', check: null, name: 'Docker Compose', confidence: 0.8 },
      { pattern: 'Dockerfile', check: null, name: 'Docker', confidence: 0.8 },
      { pattern: 'kubernetes', check: null, name: 'Kubernetes', confidence: 0.8 },
      { pattern: 'serverless.yml', check: null, name: 'Serverless Framework', confidence: 0.9 },
      { pattern: 'terraform', check: null, name: 'Terraform', confidence: 0.8 },
    ],
    
    other: [
      // Languages
      { pattern: '*.ts', check: null, name: 'TypeScript', confidence: 0.9 },
      { pattern: '*.js', check: null, name: 'JavaScript', confidence: 0.8 },
      { pattern: '*.cpp', check: null, name: 'C++', confidence: 0.8 },
      { pattern: '*.c', check: null, name: 'C', confidence: 0.8 },
      { pattern: '*.swift', check: null, name: 'Swift', confidence: 0.8 },
      { pattern: '*.kt', check: null, name: 'Kotlin', confidence: 0.8 },
      { pattern: '*.dart', check: null, name: 'Dart', confidence: 0.8 },
      { pattern: '*.r', check: null, name: 'R', confidence: 0.8 },
      { pattern: '*.scala', check: null, name: 'Scala', confidence: 0.8 },
      { pattern: '*.clj', check: null, name: 'Clojure', confidence: 0.8 },
      { pattern: '*.hs', check: null, name: 'Haskell', confidence: 0.8 },
      { pattern: '*.elm', check: null, name: 'Elm', confidence: 0.8 },
      { pattern: '*.ml', check: null, name: 'OCaml', confidence: 0.8 },
      
      // Testing
      { pattern: 'package.json', check: 'jest', name: 'Jest', confidence: 0.8 },
      { pattern: 'package.json', check: 'mocha', name: 'Mocha', confidence: 0.8 },
      { pattern: 'package.json', check: 'cypress', name: 'Cypress', confidence: 0.8 },
      { pattern: 'package.json', check: 'playwright', name: 'Playwright', confidence: 0.8 },
      { pattern: 'package.json', check: 'vitest', name: 'Vitest', confidence: 0.8 },
      
      { pattern: 'requirements.txt', check: 'pytest', name: 'PyTest', confidence: 0.8 },
      { pattern: 'requirements.txt', check: 'unittest', name: 'Python unittest', confidence: 0.7 },
      
      // .NET Testing
      { pattern: '*.csproj', check: 'Microsoft.NET.Test.Sdk', name: '.NET Test SDK', confidence: 0.8 },
      { pattern: '*.csproj', check: 'xunit', name: 'xUnit', confidence: 0.8 },
      { pattern: '*.csproj', check: 'NUnit', name: 'NUnit', confidence: 0.8 },
      { pattern: '*.csproj', check: 'MSTest', name: 'MSTest', confidence: 0.8 },
      { pattern: '*.csproj', check: 'FluentAssertions', name: 'FluentAssertions', confidence: 0.7 },
      { pattern: '*.csproj', check: 'Moq', name: 'Moq (.NET)', confidence: 0.7 },
      
      // Documentation
      { pattern: 'package.json', check: 'storybook', name: 'Storybook', confidence: 0.8 },
      { pattern: 'package.json', check: 'typedoc', name: 'TypeDoc', confidence: 0.7 },
      { pattern: 'requirements.txt', check: 'sphinx', name: 'Sphinx', confidence: 0.7 },
      
      // AI/ML
      { pattern: 'requirements.txt', check: 'tensorflow', name: 'TensorFlow', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'pytorch', name: 'PyTorch', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'scikit-learn', name: 'Scikit-learn', confidence: 0.9 },
      { pattern: 'requirements.txt', check: 'pandas', name: 'Pandas', confidence: 0.8 },
      { pattern: 'requirements.txt', check: 'numpy', name: 'NumPy', confidence: 0.8 },
      { pattern: 'package.json', check: 'openai', name: 'OpenAI', confidence: 0.9 },
      
      // Mobile
      { pattern: 'pubspec.yaml', check: 'flutter', name: 'Flutter', confidence: 0.9 },
      { pattern: '*.xcodeproj', check: null, name: 'iOS (Xcode)', confidence: 0.9 },
      { pattern: 'android', check: null, name: 'Android', confidence: 0.8 },
    ]
  };

  async detectTechnologies(repositoryPath: string): Promise<TechnologyDetection[]> {
    const detectedTechnologies: TechnologyDetection[] = [];
    
    try {
      // Get all files in the repository
      const allFiles = await this.getAllFiles(repositoryPath);
      
      if (allFiles.length === 0) {
        return [];
      }
      
      // Check each category
      for (const [category, patterns] of Object.entries(this.technologyPatterns)) {
        for (const pattern of patterns) {
          const detection = await this.checkPattern(
            pattern, 
            allFiles, 
            repositoryPath, 
            category as TechnologyCategory
          );
          
          if (detection) {
            // Check if already detected to avoid duplicates
            const existing = detectedTechnologies.find(d => d.name === detection.name);
            if (!existing || existing.confidence < detection.confidence) {
              if (existing) {
                // Remove the existing one with lower confidence
                const index = detectedTechnologies.indexOf(existing);
                detectedTechnologies.splice(index, 1);
              }
              detectedTechnologies.push(detection);
            }
          }
        }
      }
      
      // Sort by confidence and category
      return detectedTechnologies.sort((a, b) => {
        if (a.category !== b.category) {
          const categoryOrder = ['frontend', 'backend', 'databaseCloud', 'other'];
          return categoryOrder.indexOf(a.category) - categoryOrder.indexOf(b.category);
        }
        return b.confidence - a.confidence;
      });
      
    } catch (error) {
      return [];
    }
  }

  private async getAllFiles(dir: string, files: string[] = []): Promise<string[]> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip common directories that don't contain useful information
          if (!['node_modules', '.git', 'dist', 'build', '__pycache__', '.next', '.nuxt'].includes(entry.name)) {
            await this.getAllFiles(fullPath, files);
          }
        } else {
          files.push(fullPath);
        }
      }
      
      return files;
    } catch (error) {
      return files;
    }
  }

  private async checkPattern(
    pattern: any, 
    allFiles: string[], 
    repositoryPath: string, 
    category: TechnologyCategory
  ): Promise<TechnologyDetection | null> {
    
    // Check file extension patterns
    if (pattern.pattern.startsWith('*.')) {
      const extension = pattern.pattern.substring(1);
      const hasExtension = allFiles.some(file => file.endsWith(extension));
      
      if (hasExtension) {
        return {
          category,
          name: pattern.name,
          confidence: pattern.confidence
        };
      }
    }
    
    // Check specific file patterns
    else {
      const matchingFiles = allFiles.filter(file => 
        file.includes(pattern.pattern) || path.basename(file) === pattern.pattern
      );
      
      if (matchingFiles.length > 0) {
        // If no specific check is needed, just return the detection
        if (!pattern.check) {
          return {
            category,
            name: pattern.name,
            confidence: pattern.confidence
          };
        }
        
        // Check file contents for specific dependencies
        for (const file of matchingFiles) {
          try {
            const content = await fs.promises.readFile(file, 'utf8');
            
            if (file.endsWith('package.json')) {
              const packageJson = JSON.parse(content);
              const dependencies = {
                ...packageJson.dependencies,
                ...packageJson.devDependencies,
                ...packageJson.peerDependencies
              };
              
              if (dependencies[pattern.check] || 
                  Object.keys(dependencies).some(dep => dep.includes(pattern.check))) {
                // Extract version if available
                const version = dependencies[pattern.check] || 
                             Object.entries(dependencies).find(([dep]) => dep.includes(pattern.check))?.[1];
                
                return {
                  category,
                  name: pattern.name,
                  version: typeof version === 'string' ? version.replace(/[\^~]/, '') : undefined,
                  confidence: pattern.confidence
                };
              }
            }
            
            else if (content.toLowerCase().includes(pattern.check.toLowerCase())) {
              return {
                category,
                name: pattern.name,
                confidence: pattern.confidence
              };
            }
            
          } catch (error) {
            // Skip files that can't be read
            continue;
          }
        }
      }
    }
    
    return null;
  }
}

export const technologyDetectionService = new TechnologyDetector();