import { type User, type InsertUser, type Repository, type InsertRepository, type AnalysisReport, type InsertAnalysisReport, type OAuthConfig, type InsertOAuthConfig, type AISettings, type InsertAISettings } from "@shared/schema";
import { randomUUID } from "crypto";

// modify the interface with any CRUD methods
// you might need

export interface IStorage {
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  createRepository(repository: InsertRepository): Promise<Repository>;
  getRepository(id: string): Promise<Repository | undefined>;
  getAllRepositories(): Promise<Repository[]>;
  createAnalysisReport(report: InsertAnalysisReport): Promise<AnalysisReport>;
  getAnalysisReport(id: string): Promise<AnalysisReport | undefined>;
  getAnalysisReportsByRepository(repositoryId: string): Promise<AnalysisReport[]>;
  
  // OAuth Configuration methods
  createOAuthConfig(config: InsertOAuthConfig): Promise<OAuthConfig>;
  updateOAuthConfig(provider: string, config: Partial<InsertOAuthConfig>): Promise<OAuthConfig | undefined>;
  getOAuthConfig(provider: string): Promise<OAuthConfig | undefined>;
  getAllOAuthConfigs(): Promise<OAuthConfig[]>;
  deleteOAuthConfig(provider: string): Promise<boolean>;
  
  // AI Settings methods
  createAISettings(settings: InsertAISettings): Promise<AISettings>;
  updateAISettings(settings: Partial<InsertAISettings>): Promise<AISettings | undefined>;
  getAISettings(): Promise<AISettings | undefined>;
  deleteAISettings(): Promise<boolean>;
  
  // Download/file access methods
  getRepositoryPath(repositoryId: string): Promise<string | undefined>;
  getFileContent(repositoryId: string, filePath: string): Promise<Buffer | undefined>;
  getFilePath(repositoryId: string, filePath: string): Promise<string | undefined>;
  getFolderPath(repositoryId: string, folderPath: string): Promise<string | undefined>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private repositories: Map<string, Repository>;
  private analysisReports: Map<string, AnalysisReport>;
  private oauthConfigs: Map<string, OAuthConfig>;
  private aiSettings: AISettings | undefined;

  constructor() {
    this.users = new Map();
    this.repositories = new Map();
    this.analysisReports = new Map();
    this.oauthConfigs = new Map();
    this.aiSettings = undefined;
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async createRepository(insertRepository: InsertRepository): Promise<Repository> {
    const id = randomUUID();
    const repository: Repository = { 
      ...insertRepository, 
      id, 
      createdAt: new Date(),
      clonedUrl: insertRepository.clonedUrl ?? null,
      localPath: insertRepository.localPath ?? null,
      fileStructure: insertRepository.fileStructure ?? null,
      detectedTechnologies: insertRepository.detectedTechnologies ?? null
    };
    this.repositories.set(id, repository);
    return repository;
  }

  async getRepository(id: string): Promise<Repository | undefined> {
    return this.repositories.get(id);
  }

  async getAllRepositories(): Promise<Repository[]> {
    return Array.from(this.repositories.values());
  }

  async createAnalysisReport(insertReport: InsertAnalysisReport): Promise<AnalysisReport> {
    const id = randomUUID();
    const report: AnalysisReport = { 
      ...insertReport, 
      id, 
      createdAt: new Date(),
      repositoryId: insertReport.repositoryId ?? null
    };
    this.analysisReports.set(id, report);
    return report;
  }

  async getAnalysisReport(id: string): Promise<AnalysisReport | undefined> {
    return this.analysisReports.get(id);
  }

  async getAnalysisReportsByRepository(repositoryId: string): Promise<AnalysisReport[]> {
    return Array.from(this.analysisReports.values()).filter(
      (report) => report.repositoryId === repositoryId
    );
  }

  // OAuth Configuration methods
  async createOAuthConfig(insertConfig: InsertOAuthConfig): Promise<OAuthConfig> {
    const id = randomUUID();
    const config: OAuthConfig = {
      ...insertConfig,
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEnabled: insertConfig.isEnabled ?? null
    };
    this.oauthConfigs.set(insertConfig.provider, config);
    return config;
  }

  async updateOAuthConfig(provider: string, updates: Partial<InsertOAuthConfig>): Promise<OAuthConfig | undefined> {
    const existing = this.oauthConfigs.get(provider);
    if (!existing) {
      return undefined;
    }
    
    const updated: OAuthConfig = {
      ...existing,
      ...updates,
      provider, // Ensure provider doesn't change
      updatedAt: new Date()
    };
    
    this.oauthConfigs.set(provider, updated);
    return updated;
  }

  async getOAuthConfig(provider: string): Promise<OAuthConfig | undefined> {
    return this.oauthConfigs.get(provider);
  }

  async getAllOAuthConfigs(): Promise<OAuthConfig[]> {
    return Array.from(this.oauthConfigs.values());
  }

  async deleteOAuthConfig(provider: string): Promise<boolean> {
    return this.oauthConfigs.delete(provider);
  }

  // AI Settings methods
  async createAISettings(insertSettings: InsertAISettings): Promise<AISettings> {
    const id = randomUUID();
    const settings: AISettings = {
      apiKey: insertSettings.apiKey,
      model: insertSettings.model ?? "gpt-4",
      apiVersion: insertSettings.apiVersion ?? "2024-02-15-preview",
      apiEndpointUrl: insertSettings.apiEndpointUrl ?? "https://api.openai.com/v1/chat/completions",
      id,
      createdAt: new Date(),
      updatedAt: new Date(),
      isEnabled: insertSettings.isEnabled ?? true
    };
    this.aiSettings = settings;
    return settings;
  }

  async updateAISettings(updates: Partial<InsertAISettings>): Promise<AISettings | undefined> {
    if (!this.aiSettings) {
      return undefined;
    }
    
    const updated: AISettings = {
      ...this.aiSettings,
      ...updates,
      updatedAt: new Date()
    };
    
    this.aiSettings = updated;
    return updated;
  }

  async getAISettings(): Promise<AISettings | undefined> {
    return this.aiSettings;
  }

  async deleteAISettings(): Promise<boolean> {
    if (!this.aiSettings) {
      return false;
    }
    this.aiSettings = undefined;
    return true;
  }

  // Download/file access methods implementation
  async getRepositoryPath(repositoryId: string): Promise<string | undefined> {
    const repository = await this.getRepository(repositoryId);
    if (!repository) return undefined;
    
    // If repository has a stored local path, use it
    if (repository.localPath) {
      const fs = await import('fs');
      try {
        // Verify the path still exists
        await fs.promises.access(repository.localPath);
        return repository.localPath;
      } catch (error) {
        // Path no longer exists, fall back to searching
      }
    }
    
    // Fall back to the old behavior for repositories without stored local paths
    // Look for analysis clone directories (non-bare repos with actual files)
    const fs = await import('fs');
    const path = await import('path');
    
    try {
      const tempDir = path.join(process.cwd(), 'temp');
      const entries = await fs.promises.readdir(tempDir);
      
      // Find clone directories that still exist
      const cloneDirs = entries.filter(entry => entry.startsWith('clone_'));
      
      // Check each clone directory to find analysis clone (has working files, not bare)
      for (const cloneDir of cloneDirs.reverse()) {
        const fullPath = path.join(tempDir, cloneDir);
        try {
          const stats = await fs.promises.stat(fullPath);
          if (stats.isDirectory()) {
            // Check if this is a working directory (not bare) by looking for non-.git files
            const dirContents = await fs.promises.readdir(fullPath);
            const nonGitFiles = dirContents.filter(file => file !== '.git');
            if (nonGitFiles.length > 0) {
              // This is an analysis clone with actual project files
              return fullPath;
            }
          }
        } catch (error) {
          // Directory doesn't exist or can't be accessed, continue
        }
      }
    } catch (error) {
      // Temp directory doesn't exist
    }
    
    return undefined;
  }

  async getFileContent(repositoryId: string, filePath: string): Promise<Buffer | undefined> {
    const repoPath = await this.getRepositoryPath(repositoryId);
    if (!repoPath) return undefined;
    
    try {
      const path = await import('path');
      const fs = await import('fs');
      const fullPath = path.join(repoPath, filePath);
      
      // Security check: ensure the path is within the repository directory
      const normalizedRepoPath = path.normalize(path.resolve(repoPath));
      const normalizedFilePath = path.normalize(path.resolve(fullPath));
      if (!normalizedFilePath.startsWith(normalizedRepoPath)) {
        throw new Error('Invalid file path');
      }
      
      const content = await fs.promises.readFile(fullPath);
      return content;
    } catch (error) {
      return undefined;
    }
  }

  async getFilePath(repositoryId: string, filePath: string): Promise<string | undefined> {
    const repoPath = await this.getRepositoryPath(repositoryId);
    if (!repoPath) return undefined;
    
    try {
      const path = await import('path');
      const fs = await import('fs');
      const fullPath = path.join(repoPath, filePath);
      
      // Security check: ensure the path is within the repository directory
      const normalizedRepoPath = path.normalize(path.resolve(repoPath));
      const normalizedFilePath = path.normalize(path.resolve(fullPath));
      if (!normalizedFilePath.startsWith(normalizedRepoPath)) {
        throw new Error('Invalid file path');
      }
      
      // Check if file exists
      const stats = await fs.promises.stat(fullPath);
      if (stats.isFile()) {
        return fullPath;
      }
    } catch (error) {
      // File doesn't exist or can't be accessed
    }
    
    return undefined;
  }

  async getFolderPath(repositoryId: string, folderPath: string): Promise<string | undefined> {
    const repoPath = await this.getRepositoryPath(repositoryId);
    if (!repoPath) return undefined;
    
    try {
      const path = await import('path');
      const fs = await import('fs');
      const fullPath = path.join(repoPath, folderPath);
      
      // Security check: ensure the path is within the repository directory
      const normalizedRepoPath = path.normalize(path.resolve(repoPath));
      const normalizedFolderPath = path.normalize(path.resolve(fullPath));
      if (!normalizedFolderPath.startsWith(normalizedRepoPath)) {
        throw new Error('Invalid folder path');
      }
      
      // Check if directory exists
      const stats = await fs.promises.stat(fullPath);
      if (stats.isDirectory()) {
        return fullPath;
      }
    } catch (error) {
      // Directory doesn't exist or can't be accessed
    }
    
    return undefined;
  }
}

export const storage = new MemStorage();
