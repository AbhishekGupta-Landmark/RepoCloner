var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/storage.ts
import { randomUUID } from "crypto";
var MemStorage, storage;
var init_storage = __esm({
  "server/storage.ts"() {
    "use strict";
    MemStorage = class {
      users;
      repositories;
      analysisReports;
      oauthConfigs;
      constructor() {
        this.users = /* @__PURE__ */ new Map();
        this.repositories = /* @__PURE__ */ new Map();
        this.analysisReports = /* @__PURE__ */ new Map();
        this.oauthConfigs = /* @__PURE__ */ new Map();
      }
      async getUser(id) {
        return this.users.get(id);
      }
      async getUserByUsername(username) {
        return Array.from(this.users.values()).find(
          (user) => user.username === username
        );
      }
      async createUser(insertUser) {
        const id = randomUUID();
        const user = { ...insertUser, id };
        this.users.set(id, user);
        return user;
      }
      async createRepository(insertRepository) {
        const id = randomUUID();
        const repository = {
          ...insertRepository,
          id,
          createdAt: /* @__PURE__ */ new Date(),
          clonedUrl: insertRepository.clonedUrl ?? null,
          localPath: insertRepository.localPath ?? null,
          fileStructure: insertRepository.fileStructure ?? null,
          detectedTechnologies: insertRepository.detectedTechnologies ?? null
        };
        this.repositories.set(id, repository);
        return repository;
      }
      async getRepository(id) {
        return this.repositories.get(id);
      }
      async getAllRepositories() {
        return Array.from(this.repositories.values());
      }
      async createAnalysisReport(insertReport) {
        const id = randomUUID();
        const report = {
          ...insertReport,
          id,
          createdAt: /* @__PURE__ */ new Date(),
          repositoryId: insertReport.repositoryId ?? null
        };
        this.analysisReports.set(id, report);
        return report;
      }
      async getAnalysisReport(id) {
        return this.analysisReports.get(id);
      }
      async getAnalysisReportsByRepository(repositoryId) {
        return Array.from(this.analysisReports.values()).filter(
          (report) => report.repositoryId === repositoryId
        );
      }
      // OAuth Configuration methods
      async createOAuthConfig(insertConfig) {
        const id = randomUUID();
        const config = {
          ...insertConfig,
          id,
          createdAt: /* @__PURE__ */ new Date(),
          updatedAt: /* @__PURE__ */ new Date(),
          isEnabled: insertConfig.isEnabled ?? null
        };
        this.oauthConfigs.set(insertConfig.provider, config);
        return config;
      }
      async updateOAuthConfig(provider, updates) {
        const existing = this.oauthConfigs.get(provider);
        if (!existing) {
          return void 0;
        }
        const updated = {
          ...existing,
          ...updates,
          provider,
          // Ensure provider doesn't change
          updatedAt: /* @__PURE__ */ new Date()
        };
        this.oauthConfigs.set(provider, updated);
        return updated;
      }
      async getOAuthConfig(provider) {
        return this.oauthConfigs.get(provider);
      }
      async getAllOAuthConfigs() {
        return Array.from(this.oauthConfigs.values());
      }
      async deleteOAuthConfig(provider) {
        return this.oauthConfigs.delete(provider);
      }
      // Download/file access methods implementation
      async getRepositoryPath(repositoryId) {
        const repository = await this.getRepository(repositoryId);
        if (!repository) return void 0;
        if (repository.localPath) {
          const fs6 = await import("fs");
          try {
            await fs6.promises.access(repository.localPath);
            return repository.localPath;
          } catch (error) {
          }
        }
        const fs5 = await import("fs");
        const path6 = await import("path");
        try {
          const tempDir = path6.join(process.cwd(), "temp");
          const entries = await fs5.promises.readdir(tempDir);
          const cloneDirs = entries.filter((entry) => entry.startsWith("clone_"));
          for (const cloneDir of cloneDirs.reverse()) {
            const fullPath = path6.join(tempDir, cloneDir);
            try {
              const stats = await fs5.promises.stat(fullPath);
              if (stats.isDirectory()) {
                const dirContents = await fs5.promises.readdir(fullPath);
                const nonGitFiles = dirContents.filter((file) => file !== ".git");
                if (nonGitFiles.length > 0) {
                  return fullPath;
                }
              }
            } catch (error) {
            }
          }
        } catch (error) {
        }
        return void 0;
      }
      async getFileContent(repositoryId, filePath) {
        const repoPath = await this.getRepositoryPath(repositoryId);
        if (!repoPath) return void 0;
        try {
          const path6 = await import("path");
          const fs5 = await import("fs");
          const fullPath = path6.join(repoPath, filePath);
          const normalizedRepoPath = path6.normalize(path6.resolve(repoPath));
          const normalizedFilePath = path6.normalize(path6.resolve(fullPath));
          if (!normalizedFilePath.startsWith(normalizedRepoPath)) {
            throw new Error("Invalid file path");
          }
          const content = await fs5.promises.readFile(fullPath);
          return content;
        } catch (error) {
          return void 0;
        }
      }
      async getFilePath(repositoryId, filePath) {
        const repoPath = await this.getRepositoryPath(repositoryId);
        if (!repoPath) return void 0;
        try {
          const path6 = await import("path");
          const fs5 = await import("fs");
          const fullPath = path6.join(repoPath, filePath);
          const normalizedRepoPath = path6.normalize(path6.resolve(repoPath));
          const normalizedFilePath = path6.normalize(path6.resolve(fullPath));
          if (!normalizedFilePath.startsWith(normalizedRepoPath)) {
            throw new Error("Invalid file path");
          }
          const stats = await fs5.promises.stat(fullPath);
          if (stats.isFile()) {
            return fullPath;
          }
        } catch (error) {
        }
        return void 0;
      }
      async getFolderPath(repositoryId, folderPath) {
        const repoPath = await this.getRepositoryPath(repositoryId);
        if (!repoPath) return void 0;
        try {
          const path6 = await import("path");
          const fs5 = await import("fs");
          const fullPath = path6.join(repoPath, folderPath);
          const normalizedRepoPath = path6.normalize(path6.resolve(repoPath));
          const normalizedFolderPath = path6.normalize(path6.resolve(fullPath));
          if (!normalizedFolderPath.startsWith(normalizedRepoPath)) {
            throw new Error("Invalid folder path");
          }
          const stats = await fs5.promises.stat(fullPath);
          if (stats.isDirectory()) {
            return fullPath;
          }
        } catch (error) {
        }
        return void 0;
      }
    };
    storage = new MemStorage();
  }
});

// server/services/gitProviders.ts
import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
function safeLogUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.username || parsedUrl.password) {
      const safeUrl = new URL(url);
      safeUrl.username = parsedUrl.username ? "***" : "";
      safeUrl.password = parsedUrl.password ? "***" : "";
      return safeUrl.toString();
    }
    return url;
  } catch (error) {
    return "[MASKED_URL]";
  }
}
function sanitizeUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (!["https:", "http:"].includes(parsedUrl.protocol)) {
      throw new Error("Only HTTP and HTTPS protocols are allowed");
    }
    return parsedUrl.toString();
  } catch (error) {
    throw new Error("Invalid URL format");
  }
}
function validateGitHubUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith("github.com") && parsedUrl.hostname !== "github.com") {
      return false;
    }
    const pathParts = parsedUrl.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 2) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function validateGitLabUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith("gitlab.com") && parsedUrl.hostname !== "gitlab.com") {
      return false;
    }
    const pathParts = parsedUrl.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 2) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function validateAzureDevOpsUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const isDevAzureCom = parsedUrl.hostname === "dev.azure.com";
    const isVisualStudioCom = parsedUrl.hostname.endsWith(".visualstudio.com");
    if (!isDevAzureCom && !isVisualStudioCom) {
      return false;
    }
    const pathParts = parsedUrl.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 2) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function validateBitbucketUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (!parsedUrl.hostname.endsWith("bitbucket.org") && parsedUrl.hostname !== "bitbucket.org") {
      return false;
    }
    const pathParts = parsedUrl.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 2) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function validateGiteaUrl(url) {
  try {
    const parsedUrl = new URL(url);
    const pathParts = parsedUrl.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 2) {
      return false;
    }
    const isGitUrl = parsedUrl.pathname.endsWith(".git") || pathParts.length >= 2;
    return isGitUrl;
  } catch {
    return false;
  }
}
function validateCodebergUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "codeberg.org") {
      return false;
    }
    const pathParts = parsedUrl.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 2) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function validateSourceHutUrl(url) {
  try {
    const parsedUrl = new URL(url);
    if (parsedUrl.hostname !== "git.sr.ht") {
      return false;
    }
    const pathParts = parsedUrl.pathname.split("/").filter((part) => part.length > 0);
    if (pathParts.length < 2) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}
function detectProvider(url) {
  for (const [name, provider] of Object.entries(gitProviders)) {
    if (provider.validateUrl(url)) {
      return name;
    }
  }
  return null;
}
var execFileAsync, GitHubProvider, GitLabProvider, AzureDevOpsProvider, BitbucketProvider, GiteaProvider, CodebergProvider, SourceHutProvider, gitProviders;
var init_gitProviders = __esm({
  "server/services/gitProviders.ts"() {
    "use strict";
    init_routes();
    execFileAsync = promisify(execFile);
    GitHubProvider = class {
      name = "GitHub";
      validateUrl(url) {
        return validateGitHubUrl(url);
      }
      async authenticate(credentials) {
        broadcastLog("INFO", `Starting GitHub authentication using ${credentials.type.toUpperCase()}`);
        try {
          switch (credentials.type) {
            case "oauth":
              broadcastLog("WARN", "GitHub OAuth not configured - redirecting to PAT token authentication");
              return { success: false, error: "GitHub OAuth requires manual setup - please use PAT token instead" };
            case "pat":
              if (!credentials.token) {
                broadcastLog("ERROR", "Personal Access Token is missing");
                return { success: false, error: "Personal Access Token is required" };
              }
              const response = await fetch("https://api.github.com/user", {
                headers: {
                  "Authorization": `token ${credentials.token}`,
                  "User-Agent": "Git-Cloner-App"
                }
              });
              if (response.ok) {
                const userData = await response.json();
                broadcastLog("INFO", `GitHub authentication successful for user: ${userData.login}`);
                return {
                  success: true,
                  username: userData.login,
                  token: credentials.token
                };
              } else {
                broadcastLog("ERROR", `GitHub API responded with status ${response.status}: Invalid PAT`);
                return { success: false, error: "Invalid Personal Access Token" };
              }
            case "credentials":
              broadcastLog("ERROR", "Username/password authentication attempted - not supported by GitHub");
              return { success: false, error: "Username/password authentication is deprecated by GitHub" };
            default:
              broadcastLog("ERROR", `Unsupported authentication method: ${credentials.type}`);
              return { success: false, error: "Unsupported authentication method" };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Authentication failed";
          broadcastLog("ERROR", `GitHub authentication failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async cloneRepository(url, options) {
        broadcastLog("INFO", `Starting repository clone operation for: ${safeLogUrl(url)}`);
        try {
          if (!validateGitHubUrl(url)) {
            broadcastLog("ERROR", `Invalid GitHub URL provided: ${safeLogUrl(url)}`);
            return {
              success: false,
              error: "Invalid or unsafe repository URL. Only GitHub repositories are allowed."
            };
          }
          const sanitizedUrl = sanitizeUrl(url);
          const tempDir = path.join(process.cwd(), "temp", `clone_${Date.now()}`);
          await fs.promises.mkdir(tempDir, { recursive: true });
          const gitArgs = ["clone"];
          if (options.mirror) {
            gitArgs.push("--mirror");
          } else {
            gitArgs.push("--depth=1");
          }
          gitArgs.push(sanitizedUrl);
          gitArgs.push(tempDir);
          const { stdout, stderr } = await execFileAsync("git", gitArgs);
          if (stderr && !stderr.includes("Cloning into")) {
            broadcastLog("ERROR", `Git clone failed: ${stderr}`);
            throw new Error(stderr);
          }
          broadcastLog("INFO", `Repository cloned successfully to: ${tempDir}`);
          return {
            success: true,
            localPath: tempDir,
            remoteUrl: sanitizedUrl
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
          broadcastLog("ERROR", `Repository clone failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async getFileStructure(repoPath) {
        broadcastLog("INFO", `Analyzing file structure for repository: ${path.basename(repoPath)}`);
        try {
          const buildTree = async (dirPath, relativePath = "") => {
            const items = await fs.promises.readdir(dirPath, { withFileTypes: true });
            const nodes = [];
            for (const item of items) {
              if (item.name.startsWith(".git")) continue;
              const fullPath = path.join(dirPath, item.name);
              const itemRelativePath = path.join(relativePath, item.name);
              if (item.isDirectory()) {
                const children = await buildTree(fullPath, itemRelativePath);
                nodes.push({
                  name: item.name,
                  type: "directory",
                  path: itemRelativePath,
                  children
                });
              } else {
                const stats = await fs.promises.stat(fullPath);
                nodes.push({
                  name: item.name,
                  type: "file",
                  path: itemRelativePath,
                  size: stats.size
                });
              }
            }
            return nodes.sort((a, b) => {
              if (a.type !== b.type) return a.type === "directory" ? -1 : 1;
              return a.name.localeCompare(b.name);
            });
          };
          const fileStructure = await buildTree(repoPath);
          const fileCount = this.countFiles(fileStructure);
          const dirCount = this.countDirectories(fileStructure);
          broadcastLog("INFO", `File structure analysis complete: ${fileCount} files, ${dirCount} directories`);
          return fileStructure;
        } catch (error) {
          const errorMessage = `Failed to analyze file structure: ${error instanceof Error ? error.message : "Unknown error"}`;
          broadcastLog("ERROR", errorMessage);
          throw new Error(errorMessage);
        }
      }
      countFiles(nodes) {
        let count = 0;
        for (const node of nodes) {
          if (node.type === "file") {
            count++;
          } else if (node.children) {
            count += this.countFiles(node.children);
          }
        }
        return count;
      }
      countDirectories(nodes) {
        let count = 0;
        for (const node of nodes) {
          if (node.type === "directory") {
            count++;
            if (node.children) {
              count += this.countDirectories(node.children);
            }
          }
        }
        return count;
      }
    };
    GitLabProvider = class {
      name = "GitLab";
      validateUrl(url) {
        return validateGitLabUrl(url);
      }
      async authenticate(credentials) {
        try {
          switch (credentials.type) {
            case "oauth":
              if (!credentials.token) {
                return { success: false, error: "OAuth access token is required" };
              }
              const oauthResponse = await fetch("https://gitlab.com/api/v4/user", {
                headers: {
                  "Authorization": `Bearer ${credentials.token}`
                }
              });
              if (oauthResponse.ok) {
                const userData = await oauthResponse.json();
                return {
                  success: true,
                  username: userData.username,
                  token: credentials.token
                };
              } else {
                return { success: false, error: "Invalid OAuth access token" };
              }
            case "pat":
              if (!credentials.token) {
                return { success: false, error: "Personal Access Token is required" };
              }
              const response = await fetch("https://gitlab.com/api/v4/user", {
                headers: {
                  "Authorization": `Bearer ${credentials.token}`
                }
              });
              if (response.ok) {
                const userData = await response.json();
                return {
                  success: true,
                  username: userData.username,
                  token: credentials.token
                };
              } else {
                return { success: false, error: "Invalid Personal Access Token" };
              }
            case "credentials":
              return { success: false, error: "Username/password authentication requires additional implementation" };
            default:
              return { success: false, error: "Unsupported authentication method" };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Authentication failed"
          };
        }
      }
      async cloneRepository(url, options) {
        try {
          if (!validateGitLabUrl(url)) {
            return {
              success: false,
              error: "Invalid or unsafe repository URL. Only GitLab repositories are allowed."
            };
          }
          const sanitizedUrl = sanitizeUrl(url);
          const tempDir = path.join(process.cwd(), "temp", `clone_${Date.now()}`);
          await fs.promises.mkdir(tempDir, { recursive: true });
          const gitArgs = ["clone"];
          if (options.mirror) {
            gitArgs.push("--mirror");
          } else {
            gitArgs.push("--depth=1");
          }
          gitArgs.push(sanitizedUrl);
          gitArgs.push(tempDir);
          const { stdout, stderr } = await execFileAsync("git", gitArgs);
          if (stderr && !stderr.includes("Cloning into")) {
            throw new Error(stderr);
          }
          return {
            success: true,
            localPath: tempDir,
            remoteUrl: sanitizedUrl
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Clone operation failed"
          };
        }
      }
      async getFileStructure(repoPath) {
        return new GitHubProvider().getFileStructure(repoPath);
      }
    };
    AzureDevOpsProvider = class {
      name = "Azure DevOps";
      validateUrl(url) {
        return validateAzureDevOpsUrl(url);
      }
      async authenticate(credentials) {
        try {
          switch (credentials.type) {
            case "oauth":
              if (!credentials.token) {
                return { success: false, error: "OAuth access token is required" };
              }
              const oauthResponse = await fetch("https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0", {
                headers: {
                  "Authorization": `Bearer ${credentials.token}`,
                  "Accept": "application/json"
                }
              });
              if (oauthResponse.ok) {
                const userData = await oauthResponse.json();
                return {
                  success: true,
                  username: userData.displayName || userData.publicAlias || "Azure DevOps User",
                  token: credentials.token
                };
              } else {
                return { success: false, error: "Invalid OAuth access token" };
              }
            case "pat":
              if (!credentials.token) {
                return { success: false, error: "Personal Access Token is required" };
              }
              const patAuth = Buffer.from(`:${credentials.token}`).toString("base64");
              const response = await fetch("https://app.vssps.visualstudio.com/_apis/profile/profiles/me?api-version=6.0", {
                headers: {
                  "Authorization": `Basic ${patAuth}`,
                  "Accept": "application/json"
                }
              });
              if (response.ok) {
                const userData = await response.json();
                return {
                  success: true,
                  username: userData.displayName || userData.publicAlias || "Azure DevOps User",
                  token: credentials.token
                };
              } else {
                return { success: false, error: "Invalid Personal Access Token" };
              }
            case "credentials":
              return { success: false, error: "Username/password authentication requires additional implementation" };
            default:
              return { success: false, error: "Unsupported authentication method" };
          }
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Authentication failed"
          };
        }
      }
      async cloneRepository(url, options) {
        try {
          if (!validateAzureDevOpsUrl(url)) {
            return {
              success: false,
              error: "Invalid or unsafe repository URL. Only Azure DevOps repositories are allowed."
            };
          }
          const sanitizedUrl = sanitizeUrl(url);
          const tempDir = path.join(process.cwd(), "temp", `clone_${Date.now()}`);
          await fs.promises.mkdir(tempDir, { recursive: true });
          const gitArgs = ["clone"];
          if (options.mirror) {
            gitArgs.push("--mirror");
          } else {
            gitArgs.push("--depth=1");
          }
          gitArgs.push(sanitizedUrl);
          gitArgs.push(tempDir);
          const { stdout, stderr } = await execFileAsync("git", gitArgs);
          if (stderr && !stderr.includes("Cloning into")) {
            throw new Error(stderr);
          }
          return {
            success: true,
            localPath: tempDir,
            remoteUrl: sanitizedUrl
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Clone operation failed"
          };
        }
      }
      async getFileStructure(repoPath) {
        return new GitHubProvider().getFileStructure(repoPath);
      }
    };
    BitbucketProvider = class {
      name = "Bitbucket";
      validateUrl(url) {
        return validateBitbucketUrl(url);
      }
      async authenticate(credentials) {
        broadcastLog("INFO", `Starting Bitbucket authentication using ${credentials.type.toUpperCase()}`);
        try {
          switch (credentials.type) {
            case "oauth":
              if (!credentials.token) {
                broadcastLog("ERROR", "OAuth access token is missing");
                return { success: false, error: "OAuth access token is required" };
              }
              const oauthResponse = await fetch("https://api.bitbucket.org/2.0/user", {
                headers: {
                  "Authorization": `Bearer ${credentials.token}`,
                  "Accept": "application/json"
                }
              });
              if (oauthResponse.ok) {
                const userData = await oauthResponse.json();
                broadcastLog("INFO", `Bitbucket authentication successful for user: ${userData.username}`);
                return {
                  success: true,
                  username: userData.username,
                  token: credentials.token
                };
              } else {
                broadcastLog("ERROR", `Bitbucket API responded with status ${oauthResponse.status}: Invalid OAuth token`);
                return { success: false, error: "Invalid OAuth access token" };
              }
            case "pat":
              if (!credentials.token) {
                broadcastLog("ERROR", "Personal Access Token is missing");
                return { success: false, error: "Personal Access Token is required" };
              }
              if (!credentials.username) {
                broadcastLog("ERROR", "Username is required for Bitbucket App Password authentication");
                return { success: false, error: "Username is required for Bitbucket App Password authentication" };
              }
              const basicAuth = Buffer.from(`${credentials.username}:${credentials.token}`).toString("base64");
              const response = await fetch("https://api.bitbucket.org/2.0/user", {
                headers: {
                  "Authorization": `Basic ${basicAuth}`,
                  "Accept": "application/json"
                }
              });
              if (response.ok) {
                const userData = await response.json();
                broadcastLog("INFO", `Bitbucket authentication successful for user: ${userData.username}`);
                return {
                  success: true,
                  username: userData.username,
                  token: credentials.token
                };
              } else {
                broadcastLog("ERROR", `Bitbucket API responded with status ${response.status}: Invalid credentials`);
                return { success: false, error: "Invalid App Password or username" };
              }
            case "credentials":
              broadcastLog("ERROR", "Username/password authentication attempted - use App Password instead");
              return { success: false, error: "Use App Password instead of regular password" };
            default:
              broadcastLog("ERROR", `Unsupported authentication method: ${credentials.type}`);
              return { success: false, error: "Unsupported authentication method" };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Authentication failed";
          broadcastLog("ERROR", `Bitbucket authentication failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async cloneRepository(url, options) {
        broadcastLog("INFO", `Starting repository clone operation for: ${url}`);
        try {
          if (!validateBitbucketUrl(url)) {
            broadcastLog("ERROR", `Invalid Bitbucket URL provided: ${url}`);
            return {
              success: false,
              error: "Invalid or unsafe repository URL. Only Bitbucket repositories are allowed."
            };
          }
          const sanitizedUrl = sanitizeUrl(url);
          const tempDir = path.join(process.cwd(), "temp", `clone_${Date.now()}`);
          await fs.promises.mkdir(tempDir, { recursive: true });
          const gitArgs = ["clone"];
          if (options.mirror) {
            gitArgs.push("--mirror");
          } else {
            gitArgs.push("--depth=1");
          }
          gitArgs.push(sanitizedUrl);
          gitArgs.push(tempDir);
          const { stdout, stderr } = await execFileAsync("git", gitArgs);
          if (stderr && !stderr.includes("Cloning into")) {
            broadcastLog("ERROR", `Git clone failed: ${stderr}`);
            throw new Error(stderr);
          }
          broadcastLog("INFO", `Repository cloned successfully to: ${tempDir}`);
          return {
            success: true,
            localPath: tempDir,
            remoteUrl: sanitizedUrl
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
          broadcastLog("ERROR", `Repository clone failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async getFileStructure(repoPath) {
        return new GitHubProvider().getFileStructure(repoPath);
      }
    };
    GiteaProvider = class {
      name = "Gitea";
      validateUrl(url) {
        return validateGiteaUrl(url);
      }
      async authenticate(credentials) {
        broadcastLog("INFO", `Starting Gitea authentication using ${credentials.type.toUpperCase()}`);
        try {
          switch (credentials.type) {
            case "oauth":
              broadcastLog("WARN", "Gitea OAuth requires instance-specific configuration");
              return { success: false, error: "Gitea OAuth requires manual setup for specific instance" };
            case "pat":
              if (!credentials.token) {
                broadcastLog("ERROR", "Personal Access Token is missing");
                return { success: false, error: "Personal Access Token is required" };
              }
              return {
                success: true,
                username: "gitea-user",
                // Placeholder since we can't validate without knowing the instance
                token: credentials.token
              };
            case "credentials":
              broadcastLog("ERROR", "Username/password authentication not recommended for Gitea");
              return { success: false, error: "Use Personal Access Token for better security" };
            default:
              broadcastLog("ERROR", `Unsupported authentication method: ${credentials.type}`);
              return { success: false, error: "Unsupported authentication method" };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Authentication failed";
          broadcastLog("ERROR", `Gitea authentication failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async cloneRepository(url, options) {
        broadcastLog("INFO", `Starting repository clone operation for: ${url}`);
        try {
          if (!validateGiteaUrl(url)) {
            broadcastLog("ERROR", `Invalid Git repository URL provided: ${url}`);
            return {
              success: false,
              error: "Invalid repository URL structure."
            };
          }
          const sanitizedUrl = sanitizeUrl(url);
          const tempDir = path.join(process.cwd(), "temp", `clone_${Date.now()}`);
          await fs.promises.mkdir(tempDir, { recursive: true });
          const gitArgs = ["clone"];
          if (options.mirror) {
            gitArgs.push("--mirror");
          } else {
            gitArgs.push("--depth=1");
          }
          gitArgs.push(sanitizedUrl);
          gitArgs.push(tempDir);
          const { stdout, stderr } = await execFileAsync("git", gitArgs);
          if (stderr && !stderr.includes("Cloning into")) {
            broadcastLog("ERROR", `Git clone failed: ${stderr}`);
            throw new Error(stderr);
          }
          broadcastLog("INFO", `Repository cloned successfully to: ${tempDir}`);
          return {
            success: true,
            localPath: tempDir,
            remoteUrl: sanitizedUrl
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
          broadcastLog("ERROR", `Repository clone failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async getFileStructure(repoPath) {
        return new GitHubProvider().getFileStructure(repoPath);
      }
    };
    CodebergProvider = class {
      name = "Codeberg";
      validateUrl(url) {
        return validateCodebergUrl(url);
      }
      async authenticate(credentials) {
        broadcastLog("INFO", `Starting Codeberg authentication using ${credentials.type.toUpperCase()}`);
        try {
          switch (credentials.type) {
            case "oauth":
              if (!credentials.token) {
                broadcastLog("ERROR", "OAuth access token is missing");
                return { success: false, error: "OAuth access token is required" };
              }
              const oauthResponse = await fetch("https://codeberg.org/api/v1/user", {
                headers: {
                  "Authorization": `token ${credentials.token}`,
                  "Accept": "application/json"
                }
              });
              if (oauthResponse.ok) {
                const userData = await oauthResponse.json();
                broadcastLog("INFO", `Codeberg authentication successful for user: ${userData.login}`);
                return {
                  success: true,
                  username: userData.login,
                  token: credentials.token
                };
              } else {
                broadcastLog("ERROR", `Codeberg API responded with status ${oauthResponse.status}: Invalid OAuth token`);
                return { success: false, error: "Invalid OAuth access token" };
              }
            case "pat":
              if (!credentials.token) {
                broadcastLog("ERROR", "Personal Access Token is missing");
                return { success: false, error: "Personal Access Token is required" };
              }
              const response = await fetch("https://codeberg.org/api/v1/user", {
                headers: {
                  "Authorization": `token ${credentials.token}`,
                  "Accept": "application/json"
                }
              });
              if (response.ok) {
                const userData = await response.json();
                broadcastLog("INFO", `Codeberg authentication successful for user: ${userData.login}`);
                return {
                  success: true,
                  username: userData.login,
                  token: credentials.token
                };
              } else {
                broadcastLog("ERROR", `Codeberg API responded with status ${response.status}: Invalid PAT`);
                return { success: false, error: "Invalid Personal Access Token" };
              }
            case "credentials":
              broadcastLog("ERROR", "Username/password authentication not recommended - use PAT");
              return { success: false, error: "Use Personal Access Token for better security" };
            default:
              broadcastLog("ERROR", `Unsupported authentication method: ${credentials.type}`);
              return { success: false, error: "Unsupported authentication method" };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Authentication failed";
          broadcastLog("ERROR", `Codeberg authentication failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async cloneRepository(url, options) {
        broadcastLog("INFO", `Starting repository clone operation for: ${url}`);
        try {
          if (!validateCodebergUrl(url)) {
            broadcastLog("ERROR", `Invalid Codeberg URL provided: ${url}`);
            return {
              success: false,
              error: "Invalid or unsafe repository URL. Only Codeberg repositories are allowed."
            };
          }
          const sanitizedUrl = sanitizeUrl(url);
          const tempDir = path.join(process.cwd(), "temp", `clone_${Date.now()}`);
          await fs.promises.mkdir(tempDir, { recursive: true });
          const gitArgs = ["clone"];
          if (options.mirror) {
            gitArgs.push("--mirror");
          } else {
            gitArgs.push("--depth=1");
          }
          gitArgs.push(sanitizedUrl);
          gitArgs.push(tempDir);
          const { stdout, stderr } = await execFileAsync("git", gitArgs);
          if (stderr && !stderr.includes("Cloning into")) {
            broadcastLog("ERROR", `Git clone failed: ${stderr}`);
            throw new Error(stderr);
          }
          broadcastLog("INFO", `Repository cloned successfully to: ${tempDir}`);
          return {
            success: true,
            localPath: tempDir,
            remoteUrl: sanitizedUrl
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
          broadcastLog("ERROR", `Repository clone failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async getFileStructure(repoPath) {
        return new GitHubProvider().getFileStructure(repoPath);
      }
    };
    SourceHutProvider = class {
      name = "SourceHut";
      validateUrl(url) {
        return validateSourceHutUrl(url);
      }
      async authenticate(credentials) {
        broadcastLog("INFO", `Starting SourceHut authentication using ${credentials.type.toUpperCase()}`);
        try {
          switch (credentials.type) {
            case "oauth":
              broadcastLog("WARN", "SourceHut OAuth not yet implemented");
              return { success: false, error: "SourceHut OAuth not yet implemented - use PAT token instead" };
            case "pat":
              if (!credentials.token) {
                broadcastLog("ERROR", "Personal Access Token is missing");
                return { success: false, error: "Personal Access Token is required" };
              }
              const response = await fetch("https://meta.sr.ht/api/user/profile", {
                headers: {
                  "Authorization": `token ${credentials.token}`,
                  "Accept": "application/json"
                }
              });
              if (response.ok) {
                const userData = await response.json();
                broadcastLog("INFO", `SourceHut authentication successful for user: ${userData.canonical_name}`);
                return {
                  success: true,
                  username: userData.canonical_name,
                  token: credentials.token
                };
              } else {
                broadcastLog("ERROR", `SourceHut API responded with status ${response.status}: Invalid PAT`);
                return { success: false, error: "Invalid Personal Access Token" };
              }
            case "credentials":
              broadcastLog("ERROR", "Username/password authentication not supported by SourceHut API");
              return { success: false, error: "Use Personal Access Token for authentication" };
            default:
              broadcastLog("ERROR", `Unsupported authentication method: ${credentials.type}`);
              return { success: false, error: "Unsupported authentication method" };
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Authentication failed";
          broadcastLog("ERROR", `SourceHut authentication failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async cloneRepository(url, options) {
        broadcastLog("INFO", `Starting repository clone operation for: ${url}`);
        try {
          if (!validateSourceHutUrl(url)) {
            broadcastLog("ERROR", `Invalid SourceHut URL provided: ${url}`);
            return {
              success: false,
              error: "Invalid or unsafe repository URL. Only SourceHut repositories are allowed."
            };
          }
          const sanitizedUrl = sanitizeUrl(url);
          const tempDir = path.join(process.cwd(), "temp", `clone_${Date.now()}`);
          await fs.promises.mkdir(tempDir, { recursive: true });
          const gitArgs = ["clone"];
          if (options.mirror) {
            gitArgs.push("--mirror");
          } else {
            gitArgs.push("--depth=1");
          }
          gitArgs.push(sanitizedUrl);
          gitArgs.push(tempDir);
          const { stdout, stderr } = await execFileAsync("git", gitArgs);
          if (stderr && !stderr.includes("Cloning into")) {
            broadcastLog("ERROR", `Git clone failed: ${stderr}`);
            throw new Error(stderr);
          }
          broadcastLog("INFO", `Repository cloned successfully to: ${tempDir}`);
          return {
            success: true,
            localPath: tempDir,
            remoteUrl: sanitizedUrl
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Clone operation failed";
          broadcastLog("ERROR", `Repository clone failed: ${errorMessage}`);
          return {
            success: false,
            error: errorMessage
          };
        }
      }
      async getFileStructure(repoPath) {
        return new GitHubProvider().getFileStructure(repoPath);
      }
    };
    gitProviders = {
      github: new GitHubProvider(),
      gitlab: new GitLabProvider(),
      azure: new AzureDevOpsProvider(),
      bitbucket: new BitbucketProvider(),
      gitea: new GiteaProvider(),
      codeberg: new CodebergProvider(),
      sourcehut: new SourceHutProvider()
    };
  }
});

// server/services/openaiService.ts
import OpenAI from "openai";
import * as fs2 from "fs";
import * as path2 from "path";
var openai, OpenAIAnalysisService, openaiService;
var init_openaiService = __esm({
  "server/services/openaiService.ts"() {
    "use strict";
    init_routes();
    openai = new OpenAI({
      apiKey: process.env.EPAM_AI_API_KEY || "default_key",
      baseURL: "https://ai-proxy.lab.epam.com/openai/deployments/gpt-4o-mini-2024-07-18"
    });
    OpenAIAnalysisService = class {
      validateApiKey() {
        const apiKey = process.env.EPAM_AI_API_KEY || "default_key";
        if (!apiKey || apiKey === "default_key" || apiKey.length < 10) {
          return false;
        }
        return true;
      }
      async analyzeRepository(request, fileStructure, repoPath) {
        broadcastLog("INFO", `Starting ${request.analysisType} analysis at ${request.depth} depth level`);
        try {
          if (!this.validateApiKey()) {
            broadcastLog("WARN", "EPAM AI API key not configured, returning mock analysis results");
            return this.getMockAnalysisResult();
          }
          const codeFiles = await this.extractCodeFiles(fileStructure, repoPath);
          broadcastLog("INFO", `Found ${codeFiles.length} code files for analysis`);
          const analysisPrompt = this.buildAnalysisPrompt(request, codeFiles);
          broadcastLog("INFO", "Sending analysis request to EPAM AI (OpenAI GPT-4o-mini)");
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
              {
                role: "system",
                content: "You are an expert code analyst. Analyze the provided code and return a detailed analysis in JSON format."
              },
              {
                role: "user",
                content: analysisPrompt
              }
            ],
            response_format: { type: "json_object" },
            max_tokens: 4e3
          });
          const analysisData = JSON.parse(response.choices[0].message.content || "{}");
          const result = {
            summary: {
              qualityScore: analysisData.summary?.qualityScore || 0,
              securityScore: analysisData.summary?.securityScore || 0,
              maintainabilityScore: analysisData.summary?.maintainabilityScore || 0
            },
            issues: analysisData.issues || [],
            recommendations: analysisData.recommendations || [],
            metrics: analysisData.metrics || {},
            technologies: []
          };
          broadcastLog("INFO", `Code analysis completed successfully: Quality ${result.summary.qualityScore}%, Security ${result.summary.securityScore}%, ${result.issues.length} issues found`);
          return result;
        } catch (error) {
          if (error instanceof Error) {
            if (error.message.includes("401") || error.message.includes("Incorrect API key")) {
              broadcastLog("ERROR", "Invalid EPAM AI API key - authentication failed");
              throw new Error("Invalid EPAM AI API key. Please contact your administrator for access.");
            }
            if (error.message.includes("quota") || error.message.includes("billing")) {
              broadcastLog("ERROR", "EPAM AI API quota exceeded - billing limit reached");
              throw new Error("EPAM AI API quota exceeded. Please contact your administrator.");
            }
            if (error.message.includes("rate limit")) {
              broadcastLog("WARN", "OpenAI API rate limit exceeded - throttling requests");
              throw new Error("OpenAI API rate limit exceeded. Please try again in a moment.");
            }
          }
          const errorMessage = `Code analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`;
          broadcastLog("ERROR", errorMessage);
          throw new Error(errorMessage);
        }
      }
      async extractCodeFiles(fileStructure, repoPath, maxFiles = 20) {
        const codeFiles = [];
        const codeExtensions = /* @__PURE__ */ new Set([".js", ".ts", ".tsx", ".jsx", ".py", ".java", ".cs", ".cpp", ".c", ".go", ".rs", ".php", ".rb"]);
        const extractFiles = async (nodes) => {
          for (const node of nodes) {
            if (codeFiles.length >= maxFiles) break;
            if (node.type === "file") {
              const ext = path2.extname(node.name);
              if (codeExtensions.has(ext)) {
                try {
                  const fullPath = path2.join(repoPath, node.path);
                  const content = await fs2.promises.readFile(fullPath, "utf-8");
                  if (content.length < 5e4) {
                    codeFiles.push({
                      path: node.path,
                      content: content.substring(0, 1e4)
                      // Limit content length
                    });
                  } else {
                  }
                } catch (error) {
                  broadcastLog("WARN", `Failed to read file ${node.path}: ${error instanceof Error ? error.message : "Unknown error"}`);
                }
              }
            } else if (node.children) {
              await extractFiles(node.children);
            }
          }
        };
        await extractFiles(fileStructure);
        return codeFiles;
      }
      buildAnalysisPrompt(request, codeFiles) {
        const fileContents = codeFiles.map(
          (file) => `
--- File: ${file.path} ---
${file.content}`
        ).join("\n");
        return `Analyze this ${request.analysisType} for the following code repository. Provide analysis at ${request.depth} depth level.

Code Files:
${fileContents}

Please provide a comprehensive analysis in JSON format with the following structure:
{
  "summary": {
    "qualityScore": number (0-100),
    "securityScore": number (0-100),
    "maintainabilityScore": number (0-100)
  },
  "issues": [
    {
      "severity": "low|medium|high|critical",
      "type": "string",
      "description": "string",
      "file": "string",
      "line": number,
      "suggestion": "string"
    }
  ],
  "recommendations": ["string array of actionable recommendations"],
  "metrics": {
    "linesOfCode": number,
    "complexity": number,
    "testCoverage": number,
    "dependencies": number
  }
}

Focus on:
${request.analysisType === "security" ? "- Security vulnerabilities\n- Authentication issues\n- Data exposure risks" : ""}
${request.analysisType === "quality" ? "- Code maintainability\n- Best practices adherence\n- Design patterns" : ""}
${request.analysisType === "performance" ? "- Performance bottlenecks\n- Resource usage\n- Optimization opportunities" : ""}
${request.analysisType === "documentation" ? "- Code documentation quality\n- README completeness\n- API documentation" : ""}
${request.analysisType === "architecture" ? "- System architecture\n- Component relationships\n- Design patterns usage" : ""}`;
      }
      getMockAnalysisResult() {
        return {
          summary: {
            qualityScore: 75,
            securityScore: 80,
            maintainabilityScore: 70
          },
          issues: [
            {
              type: "warning",
              severity: "low",
              description: "Analysis service is running in demo mode. Configure EPAM_AI_API_KEY for real analysis.",
              file: "system",
              line: 0,
              suggestion: "Contact administrator to configure API key"
            }
          ],
          recommendations: [
            "Configure EPAM AI API key to enable full analysis capabilities",
            "This is a demo response - real analysis requires proper API configuration"
          ],
          metrics: {
            linesOfCode: 0,
            complexity: 0,
            testCoverage: 0,
            dependencies: 0
          },
          technologies: []
        };
      }
      async generateSummaryReport(repositoryName, analyses) {
        broadcastLog("INFO", `Generating comprehensive summary report for repository: ${repositoryName}`);
        const prompt = `Generate a comprehensive summary report for repository "${repositoryName}" based on multiple analysis results. 

Analysis Results:
${JSON.stringify(analyses, null, 2)}

Create a professional report that includes:
1. Executive Summary
2. Key Findings
3. Risk Assessment
4. Recommendations
5. Next Steps

Format as markdown for easy reading.`;
        try {
          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini-2024-07-18",
            messages: [
              {
                role: "system",
                content: "You are a senior software architect creating executive reports for code analysis."
              },
              {
                role: "user",
                content: prompt
              }
            ],
            max_tokens: 3e3
          });
          const reportContent = response.choices[0].message.content || "Report generation failed";
          broadcastLog("INFO", `Summary report generated successfully (${Math.round(reportContent.length / 1024)}KB)`);
          return reportContent;
        } catch (error) {
          const errorMessage = `Summary report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`;
          broadcastLog("ERROR", errorMessage);
          throw new Error(errorMessage);
        }
      }
    };
    openaiService = new OpenAIAnalysisService();
  }
});

// server/services/reportBuilder.ts
var ReportBuilder;
var init_reportBuilder = __esm({
  "server/services/reportBuilder.ts"() {
    "use strict";
    ReportBuilder = class {
      static async generateReport(data, format) {
        switch (format) {
          case "pdf":
            return this.generatePDF(data);
          case "xlsx":
            return this.generateExcel(data);
          case "docx":
            return this.generateWord(data);
          default:
            throw new Error(`Unsupported format: ${format}`);
        }
      }
      static async generatePDF(data) {
        let content = "";
        content += "=".repeat(60) + "\n";
        content += "           REPOSITORY ANALYSIS REPORT\n";
        content += "=".repeat(60) + "\n\n";
        content += "REPOSITORY INFORMATION\n";
        content += "-".repeat(30) + "\n";
        content += `Name: ${data.repository.name}
`;
        content += `URL: ${data.repository.url}
`;
        content += `Provider: ${data.repository.provider}
`;
        content += `Analysis Date: ${new Date(data.analysisReport.createdAt || "").toLocaleDateString()}
`;
        content += `Analysis Type: ${data.analysisReport.analysisType}

`;
        if (data.analysisResults.summary) {
          content += "SUMMARY SCORES\n";
          content += "-".repeat(20) + "\n";
          const summary = data.analysisResults.summary;
          if (summary.qualityScore !== void 0) {
            content += `Quality Score: ${summary.qualityScore}%
`;
          }
          if (summary.securityScore !== void 0) {
            content += `Security Score: ${summary.securityScore}%
`;
          }
          if (summary.maintainabilityScore !== void 0) {
            content += `Maintainability Score: ${summary.maintainabilityScore}%
`;
          }
          content += "\n";
        }
        if (data.analysisResults.technologies && data.analysisResults.technologies.length > 0) {
          content += "TECHNOLOGIES DETECTED\n";
          content += "-".repeat(25) + "\n";
          data.analysisResults.technologies.forEach((tech) => {
            content += `\u2022 ${tech.name} (${tech.category}) - Confidence: ${(tech.confidence * 100).toFixed(1)}%
`;
          });
          content += "\n";
        }
        if (data.analysisResults.issues && data.analysisResults.issues.length > 0) {
          content += "ISSUES FOUND\n";
          content += "-".repeat(15) + "\n";
          const groupedIssues = data.analysisResults.issues.reduce((acc, issue) => {
            if (!acc[issue.severity]) acc[issue.severity] = [];
            acc[issue.severity].push(issue);
            return acc;
          }, {});
          Object.entries(groupedIssues).forEach(([severity, issues]) => {
            content += `
${severity.toUpperCase()} (${issues.length})
`;
            content += "~".repeat(severity.length + 10) + "\n";
            issues.forEach((issue, index) => {
              content += `${index + 1}. ${issue.description}
`;
              if (issue.file) content += `   File: ${issue.file}${issue.line ? `:${issue.line}` : ""}
`;
              if (issue.suggestion) content += `   Suggestion: ${issue.suggestion}
`;
              content += "\n";
            });
          });
        }
        if (data.analysisResults.recommendations && data.analysisResults.recommendations.length > 0) {
          content += "RECOMMENDATIONS\n";
          content += "-".repeat(20) + "\n";
          data.analysisResults.recommendations.forEach((rec, index) => {
            content += `${index + 1}. ${rec}
`;
          });
          content += "\n";
        }
        if (data.analysisResults.metrics && Object.keys(data.analysisResults.metrics).length > 0) {
          content += "DETAILED METRICS\n";
          content += "-".repeat(20) + "\n";
          Object.entries(data.analysisResults.metrics).forEach(([key, value]) => {
            content += `${key}: ${JSON.stringify(value)}
`;
          });
        }
        return Buffer.from(content, "utf8");
      }
      static async generateExcel(data) {
        let csvContent = "";
        csvContent += "REPOSITORY SUMMARY\n";
        csvContent += "Property,Value\n";
        csvContent += `Repository Name,"${data.repository.name}"
`;
        csvContent += `Repository URL,"${data.repository.url}"
`;
        csvContent += `Provider,"${data.repository.provider}"
`;
        csvContent += `Analysis Date,"${new Date(data.analysisReport.createdAt || "").toLocaleDateString()}"
`;
        csvContent += `Analysis Type,"${data.analysisReport.analysisType}"
`;
        csvContent += "\n";
        if (data.analysisResults.summary) {
          const summary = data.analysisResults.summary;
          if (summary.qualityScore !== void 0) {
            csvContent += `Quality Score,"${summary.qualityScore}%"
`;
          }
          if (summary.securityScore !== void 0) {
            csvContent += `Security Score,"${summary.securityScore}%"
`;
          }
          if (summary.maintainabilityScore !== void 0) {
            csvContent += `Maintainability Score,"${summary.maintainabilityScore}%"
`;
          }
        }
        if (data.analysisResults.technologies && data.analysisResults.technologies.length > 0) {
          csvContent += "\nTECHNOLOGIES\n";
          csvContent += "Technology,Category,Version,Confidence\n";
          data.analysisResults.technologies.forEach((tech) => {
            csvContent += `"${tech.name}","${tech.category}","${tech.version || "N/A"}","${(tech.confidence * 100).toFixed(1)}%"
`;
          });
        }
        if (data.analysisResults.issues && data.analysisResults.issues.length > 0) {
          csvContent += "\nISSUES\n";
          csvContent += "Severity,Type,Description,File,Line,Suggestion\n";
          data.analysisResults.issues.forEach((issue) => {
            csvContent += `"${issue.severity}","${issue.type}","${issue.description}","${issue.file || "N/A"}","${issue.line || "N/A"}","${issue.suggestion || "N/A"}"
`;
          });
        }
        if (data.analysisResults.recommendations && data.analysisResults.recommendations.length > 0) {
          csvContent += "\nRECOMMENDATIONS\n";
          csvContent += "#,Recommendation\n";
          data.analysisResults.recommendations.forEach((rec, index) => {
            csvContent += `"${index + 1}","${rec}"
`;
          });
        }
        return Buffer.from(csvContent, "utf8");
      }
      static async generateWord(data) {
        let content = "";
        content += "REPOSITORY ANALYSIS REPORT\n";
        content += "==========================\n\n";
        content += "Repository Information\n";
        content += "---------------------\n";
        content += `Name: ${data.repository.name}
`;
        content += `URL: ${data.repository.url}
`;
        content += `Provider: ${data.repository.provider}
`;
        content += `Analysis Date: ${new Date(data.analysisReport.createdAt || "").toLocaleDateString()}
`;
        content += `Analysis Type: ${data.analysisReport.analysisType}

`;
        if (data.analysisResults.summary) {
          content += "Summary Scores\n";
          content += "--------------\n";
          const summary = data.analysisResults.summary;
          if (summary.qualityScore !== void 0) {
            content += `Quality Score: ${summary.qualityScore}%
`;
          }
          if (summary.securityScore !== void 0) {
            content += `Security Score: ${summary.securityScore}%
`;
          }
          if (summary.maintainabilityScore !== void 0) {
            content += `Maintainability Score: ${summary.maintainabilityScore}%
`;
          }
          content += "\n";
        }
        if (data.analysisResults.technologies && data.analysisResults.technologies.length > 0) {
          content += "Technologies Detected\n";
          content += "--------------------\n";
          data.analysisResults.technologies.forEach((tech) => {
            content += `\u2022 ${tech.name} (${tech.category}) - Confidence: ${(tech.confidence * 100).toFixed(1)}%
`;
          });
          content += "\n";
        }
        if (data.analysisResults.issues && data.analysisResults.issues.length > 0) {
          content += "Issues Found\n";
          content += "------------\n";
          const groupedIssues = data.analysisResults.issues.reduce((acc, issue) => {
            if (!acc[issue.severity]) acc[issue.severity] = [];
            acc[issue.severity].push(issue);
            return acc;
          }, {});
          Object.entries(groupedIssues).forEach(([severity, issues]) => {
            content += `
${severity.toUpperCase()} (${issues.length})
`;
            content += "-".repeat(severity.length + 10) + "\n";
            issues.forEach((issue, index) => {
              content += `${index + 1}. ${issue.description}
`;
              if (issue.file) {
                content += `   File: ${issue.file}${issue.line ? `:${issue.line}` : ""}
`;
              }
              if (issue.suggestion) {
                content += `   Suggestion: ${issue.suggestion}
`;
              }
              content += "\n";
            });
          });
        }
        if (data.analysisResults.recommendations && data.analysisResults.recommendations.length > 0) {
          content += "Recommendations\n";
          content += "---------------\n";
          data.analysisResults.recommendations.forEach((rec, index) => {
            content += `${index + 1}. ${rec}
`;
          });
          content += "\n";
        }
        if (data.analysisResults.metrics && Object.keys(data.analysisResults.metrics).length > 0) {
          content += "Detailed Metrics\n";
          content += "----------------\n";
          Object.entries(data.analysisResults.metrics).forEach(([key, value]) => {
            content += `${key}: ${JSON.stringify(value)}
`;
          });
        }
        return Buffer.from(content, "utf8");
      }
      static getContentType(format) {
        switch (format) {
          case "pdf":
            return "text/plain";
          // Changed to text/plain since we're generating text
          case "xlsx":
            return "text/csv";
          // Changed to text/csv since we're generating CSV
          case "docx":
            return "text/plain";
          // Changed to text/plain since we're generating text
          default:
            throw new Error(`Unsupported format: ${format}`);
        }
      }
      static getFileExtension(format) {
        switch (format) {
          case "pdf":
            return "txt";
          // Changed to txt since we're generating text
          case "xlsx":
            return "csv";
          // Changed to csv since we're generating CSV
          case "docx":
            return "txt";
          // Changed to txt since we're generating text
          default:
            throw new Error(`Unsupported format: ${format}`);
        }
      }
    };
  }
});

// server/services/enhancedTechnologyDetection.ts
import * as fs3 from "fs";
import * as path3 from "path";
var EnhancedTechnologyDetector, enhancedTechnologyDetectionService;
var init_enhancedTechnologyDetection = __esm({
  "server/services/enhancedTechnologyDetection.ts"() {
    "use strict";
    EnhancedTechnologyDetector = class {
      technologyPatterns = [
        // ========== FRONTEND ==========
        // React Ecosystem
        { pattern: "package.json", check: "react", name: "React", category: "frontend", confidence: 0.95, icon: "react", versionExtractor: "react", configFiles: [".babelrc", ".babelrc.json", "babel.config.js", "babel.config.json"], scriptTokens: ["react"] },
        { pattern: "package.json", check: "next", name: "Next.js", category: "frontend", confidence: 0.95, icon: "nextjs", versionExtractor: "next", configFiles: ["next.config.js", "next.config.mjs", "next.config.ts"], scriptTokens: ["next"] },
        { pattern: "package.json", check: "gatsby", name: "Gatsby", category: "frontend", confidence: 0.95, icon: "gatsby", versionExtractor: "gatsby", configFiles: ["gatsby-config.js", "gatsby-config.ts", "gatsby-node.js", "gatsby-browser.js", "gatsby-ssr.js"], scriptTokens: ["gatsby"] },
        { pattern: "package.json", check: "@remix-run/react", name: "Remix", category: "frontend", confidence: 0.95, icon: "remix", versionExtractor: "@remix-run/react", configFiles: ["remix.config.js", "remix.config.ts"], scriptTokens: ["remix"] },
        // Vue Ecosystem
        { pattern: "package.json", check: "vue", name: "Vue.js", category: "frontend", confidence: 0.95, icon: "vue", versionExtractor: "vue", configFiles: ["vue.config.js", "vue.config.ts"], scriptTokens: ["vue", "serve"] },
        { pattern: "package.json", check: "nuxt", name: "Nuxt.js", category: "frontend", confidence: 0.95, icon: "nuxtjs", versionExtractor: "nuxt", configFiles: ["nuxt.config.js", "nuxt.config.ts"], scriptTokens: ["nuxt"] },
        { pattern: "package.json", check: "quasar", name: "Quasar", category: "frontend", confidence: 0.95, icon: "quasar", versionExtractor: "quasar", configFiles: ["quasar.config.js", "quasar.config.ts"], scriptTokens: ["quasar"] },
        // Angular Ecosystem
        { pattern: "package.json", check: ["@angular/core", "angular"], name: "Angular", category: "frontend", confidence: 0.95, icon: "angular", versionExtractor: "@angular/core", configFiles: ["angular.json", "tsconfig.json", "tsconfig.app.json"], scriptTokens: ["ng", "angular"] },
        { pattern: "package.json", check: "@angular/cli", name: "Angular CLI", category: "frontend", confidence: 0.9, icon: "angular", versionExtractor: "@angular/cli", configFiles: ["angular.json"], scriptTokens: ["ng"] },
        // Other Frontend Frameworks
        { pattern: "package.json", check: "svelte", name: "Svelte", category: "frontend", confidence: 0.95, icon: "svelte", versionExtractor: "svelte", configFiles: ["svelte.config.js", "svelte.config.ts"], scriptTokens: ["svelte"] },
        { pattern: "package.json", check: "@sveltejs/kit", name: "SvelteKit", category: "frontend", confidence: 0.95, icon: "svelte", versionExtractor: "@sveltejs/kit", configFiles: ["svelte.config.js", "svelte.config.ts"], scriptTokens: ["svelte-kit"] },
        { pattern: "package.json", check: "astro", name: "Astro", category: "frontend", confidence: 0.95, icon: "astro", versionExtractor: "astro", configFiles: ["astro.config.js", "astro.config.mjs", "astro.config.ts"], scriptTokens: ["astro"] },
        // CSS Frameworks & Libraries
        { pattern: "package.json", check: "tailwindcss", name: "Tailwind CSS", category: "frontend", confidence: 0.9, icon: "tailwindcss", versionExtractor: "tailwindcss", configFiles: ["tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs"], scriptTokens: ["tailwind"] },
        { pattern: "package.json", check: "bootstrap", name: "Bootstrap", category: "frontend", confidence: 0.9, icon: "bootstrap", versionExtractor: "bootstrap" },
        { pattern: "package.json", check: "@mui/material", name: "Material-UI", category: "frontend", confidence: 0.9, icon: "mui", versionExtractor: "@mui/material" },
        { pattern: "package.json", check: "styled-components", name: "Styled Components", category: "frontend", confidence: 0.85, icon: "styled-components", versionExtractor: "styled-components" },
        // Build Tools
        { pattern: "package.json", check: "vite", name: "Vite", category: "devops", confidence: 0.9, icon: "vite", versionExtractor: "vite", configFiles: ["vite.config.js", "vite.config.ts", "vite.config.mjs"], scriptTokens: ["vite"] },
        { pattern: "package.json", check: "webpack", name: "Webpack", category: "devops", confidence: 0.85, icon: "webpack", versionExtractor: "webpack", configFiles: ["webpack.config.js", "webpack.config.ts"], scriptTokens: ["webpack"] },
        { pattern: "package.json", check: "parcel", name: "Parcel", category: "devops", confidence: 0.85, icon: "parcel", versionExtractor: "parcel", configFiles: [".parcelrc"], scriptTokens: ["parcel"] },
        { pattern: "package.json", check: "rollup", name: "Rollup", category: "devops", confidence: 0.85, icon: "rollup", versionExtractor: "rollup", configFiles: ["rollup.config.js", "rollup.config.ts", "rollup.config.mjs"], scriptTokens: ["rollup"] },
        // ========== BACKEND ==========
        // Node.js Frameworks
        { pattern: "package.json", check: "express", name: "Express.js", category: "backend", confidence: 0.95, icon: "express", versionExtractor: "express" },
        { pattern: "package.json", check: "fastify", name: "Fastify", category: "backend", confidence: 0.95, icon: "fastify", versionExtractor: "fastify" },
        { pattern: "package.json", check: "@nestjs/core", name: "NestJS", category: "backend", confidence: 0.95, icon: "nestjs", versionExtractor: "@nestjs/core" },
        { pattern: "package.json", check: "koa", name: "Koa.js", category: "backend", confidence: 0.95, icon: "koa", versionExtractor: "koa" },
        // Python Frameworks
        { pattern: "requirements.txt", check: "django", name: "Django", category: "backend", confidence: 0.95, icon: "django", versionExtractor: "django==" },
        { pattern: "requirements.txt", check: "flask", name: "Flask", category: "backend", confidence: 0.95, icon: "flask", versionExtractor: "flask==" },
        { pattern: "requirements.txt", check: "fastapi", name: "FastAPI", category: "backend", confidence: 0.95, icon: "fastapi", versionExtractor: "fastapi==" },
        // Java Frameworks
        { pattern: "pom.xml", check: "spring-boot", name: "Spring Boot", category: "backend", confidence: 0.95, icon: "spring", versionExtractor: "<version>" },
        { pattern: "build.gradle", check: "spring-boot", name: "Spring Boot", category: "backend", confidence: 0.95, icon: "spring" },
        // .NET Frameworks - Basic detection first
        { pattern: "*.csproj", check: null, name: ".NET/C#", category: "backend", confidence: 0.9, icon: "dotnet" },
        { pattern: "*.sln", check: null, name: ".NET Solution", category: "backend", confidence: 0.9, icon: "dotnet" },
        { pattern: "*.csproj", check: "Microsoft.AspNetCore", name: "ASP.NET Core", category: "backend", confidence: 0.95, icon: "dotnet", versionExtractor: 'Version="' },
        { pattern: "*.csproj", check: "Microsoft.EntityFrameworkCore", name: "Entity Framework Core", category: "database", confidence: 0.9, icon: "dotnet", versionExtractor: 'Version="' },
        { pattern: "*.csproj", check: ["Confluent.Kafka", "confluent.kafka"], name: "Apache Kafka (.NET)", category: "database", confidence: 0.95, icon: "kafka", versionExtractor: 'Version="' },
        // ========== DATABASE ==========
        // SQL Databases
        { pattern: "package.json", check: "pg", name: "PostgreSQL", category: "database", confidence: 0.9, icon: "postgresql", versionExtractor: "pg" },
        { pattern: "package.json", check: "mysql2", name: "MySQL", category: "database", confidence: 0.9, icon: "mysql", versionExtractor: "mysql2" },
        { pattern: "package.json", check: "sqlite3", name: "SQLite", category: "database", confidence: 0.9, icon: "sqlite", versionExtractor: "sqlite3" },
        // NoSQL Databases
        { pattern: "package.json", check: "mongodb", name: "MongoDB", category: "database", confidence: 0.9, icon: "mongodb", versionExtractor: "mongodb" },
        { pattern: "package.json", check: "redis", name: "Redis", category: "database", confidence: 0.9, icon: "redis", versionExtractor: "redis" },
        // ORMs
        { pattern: "package.json", check: "prisma", name: "Prisma", category: "database", confidence: 0.95, icon: "prisma", versionExtractor: "prisma" },
        { pattern: "package.json", check: "sequelize", name: "Sequelize", category: "database", confidence: 0.9, icon: "sequelize", versionExtractor: "sequelize" },
        { pattern: "package.json", check: "typeorm", name: "TypeORM", category: "database", confidence: 0.9, icon: "typeorm", versionExtractor: "typeorm" },
        { pattern: "package.json", check: "drizzle-orm", name: "Drizzle ORM", category: "database", confidence: 0.9, icon: "drizzle", versionExtractor: "drizzle-orm" },
        // ========== CLOUD ==========
        // AWS
        { pattern: "package.json", check: "aws-sdk", name: "AWS SDK", category: "cloud", confidence: 0.9, icon: "aws", versionExtractor: "aws-sdk" },
        { pattern: "package.json", check: "@aws-sdk/client-s3", name: "AWS S3", category: "cloud", confidence: 0.95, icon: "aws-s3", versionExtractor: "@aws-sdk/client-s3" },
        // Azure
        { pattern: "package.json", check: "@azure/storage-blob", name: "Azure Blob Storage", category: "cloud", confidence: 0.95, icon: "azure", versionExtractor: "@azure/storage-blob" },
        // Docker & Containers
        { pattern: "Dockerfile", check: null, name: "Docker", category: "cloud", confidence: 0.95, icon: "docker" },
        { pattern: "docker-compose.yml", check: null, name: "Docker Compose", category: "cloud", confidence: 0.95, icon: "docker" },
        { pattern: "package.json", check: "kubernetes", name: "Kubernetes", category: "cloud", confidence: 0.9, icon: "kubernetes", versionExtractor: "kubernetes" },
        // ========== TESTING ==========
        // JavaScript Testing
        { pattern: "package.json", check: "jest", name: "Jest", category: "testing", confidence: 0.95, icon: "jest", versionExtractor: "jest", configFiles: ["jest.config.js", "jest.config.ts", "jest.config.json"], scriptTokens: ["jest", "test"] },
        { pattern: "package.json", check: "vitest", name: "Vitest", category: "testing", confidence: 0.95, icon: "vitest", versionExtractor: "vitest", configFiles: ["vitest.config.js", "vitest.config.ts"], scriptTokens: ["vitest", "test"] },
        { pattern: "package.json", check: "cypress", name: "Cypress", category: "testing", confidence: 0.95, icon: "cypress", versionExtractor: "cypress", configFiles: ["cypress.config.js", "cypress.config.ts", "cypress.json"], scriptTokens: ["cypress"] },
        { pattern: "package.json", check: "playwright", name: "Playwright", category: "testing", confidence: 0.95, icon: "playwright", versionExtractor: "playwright", configFiles: ["playwright.config.js", "playwright.config.ts"], scriptTokens: ["playwright"] },
        { pattern: "package.json", check: "@testing-library/react", name: "React Testing Library", category: "testing", confidence: 0.9, icon: "testing-library", versionExtractor: "@testing-library/react", scriptTokens: ["test"] },
        // .NET Testing
        { pattern: "*.csproj", check: "Microsoft.NET.Test.Sdk", name: "MSTest", category: "testing", confidence: 0.9, icon: "dotnet" },
        { pattern: "*.csproj", check: "xunit", name: "xUnit", category: "testing", confidence: 0.95, icon: "xunit" },
        { pattern: "*.csproj", check: "NUnit", name: "NUnit", category: "testing", confidence: 0.95, icon: "nunit" },
        // ========== DEVOPS ==========
        // CI/CD
        { pattern: ".github/workflows", check: null, name: "GitHub Actions", category: "devops", confidence: 0.95, icon: "github-actions" },
        { pattern: ".gitlab-ci.yml", check: null, name: "GitLab CI", category: "devops", confidence: 0.95, icon: "gitlab" },
        { pattern: "azure-pipelines.yml", check: null, name: "Azure DevOps", category: "devops", confidence: 0.95, icon: "azure-devops" },
        // Package Managers
        { pattern: "package.json", check: null, name: "npm", category: "utilities", confidence: 0.8, icon: "npm" },
        { pattern: "yarn.lock", check: null, name: "Yarn", category: "utilities", confidence: 0.9, icon: "yarn" },
        { pattern: "pnpm-lock.yaml", check: null, name: "pnpm", category: "utilities", confidence: 0.95, icon: "pnpm" },
        // ========== SECURITY ==========
        { pattern: "package.json", check: "helmet", name: "Helmet.js", category: "security", confidence: 0.9, icon: "helmet", versionExtractor: "helmet" },
        { pattern: "package.json", check: "bcrypt", name: "bcrypt", category: "security", confidence: 0.95, icon: "bcrypt", versionExtractor: "bcrypt" },
        { pattern: "package.json", check: "jsonwebtoken", name: "JWT", category: "security", confidence: 0.95, icon: "jwt", versionExtractor: "jsonwebtoken" },
        // ========== MONITORING ==========
        { pattern: "package.json", check: "winston", name: "Winston", category: "monitoring", confidence: 0.9, icon: "winston", versionExtractor: "winston" },
        { pattern: "package.json", check: "morgan", name: "Morgan", category: "monitoring", confidence: 0.85, icon: "morgan", versionExtractor: "morgan" },
        // File Extensions
        { pattern: "*.tsx", check: null, name: "TypeScript React", category: "frontend", confidence: 0.85, icon: "typescript", configFiles: ["tsconfig.json", "tsconfig.react.json"] },
        { pattern: "*.ts", check: null, name: "TypeScript", category: "utilities", confidence: 0.85, icon: "typescript", configFiles: ["tsconfig.json", "tsconfig.build.json"], scriptTokens: ["tsc", "typescript"] },
        { pattern: "*.jsx", check: null, name: "React JSX", category: "frontend", confidence: 0.8, icon: "react" },
        { pattern: "*.vue", check: null, name: "Vue Component", category: "frontend", confidence: 0.9, icon: "vue" },
        { pattern: "*.svelte", check: null, name: "Svelte Component", category: "frontend", confidence: 0.9, icon: "svelte" },
        { pattern: "*.cs", check: null, name: "C#", category: "backend", confidence: 0.85, icon: "csharp" },
        { pattern: "*.py", check: null, name: "Python", category: "backend", confidence: 0.8, icon: "python", configFiles: ["pyproject.toml", "setup.py", "setup.cfg"] },
        { pattern: "*.java", check: null, name: "Java", category: "backend", confidence: 0.8, icon: "java", configFiles: ["pom.xml", "build.gradle", "build.gradle.kts"] },
        { pattern: "*.go", check: null, name: "Go", category: "backend", confidence: 0.8, icon: "go", configFiles: ["go.mod", "go.sum"] },
        { pattern: "*.rs", check: null, name: "Rust", category: "backend", confidence: 0.8, icon: "rust", configFiles: ["Cargo.toml", "Cargo.lock"] }
      ];
      async detectTechnologies(repositoryPath) {
        const technologies = [];
        const detectedTechs = /* @__PURE__ */ new Set();
        try {
          if (!fs3.existsSync(repositoryPath)) {
            return [];
          }
          const globalEvidence = await this.collectGlobalEvidence(repositoryPath);
          for (const pattern of this.technologyPatterns) {
            const detectedTech = await this.checkPattern(repositoryPath, pattern, globalEvidence);
            if (detectedTech && !detectedTechs.has(detectedTech.name)) {
              technologies.push(detectedTech);
              detectedTechs.add(detectedTech.name);
            }
          }
          technologies.sort((a, b) => b.confidence - a.confidence);
          return technologies;
        } catch (error) {
          return [];
        }
      }
      async checkPattern(repositoryPath, pattern, globalEvidence) {
        try {
          if (pattern.pattern.includes("*")) {
            return await this.checkFileExtensionPattern(repositoryPath, pattern, globalEvidence);
          } else {
            return await this.checkSpecificFilePattern(repositoryPath, pattern, globalEvidence);
          }
        } catch (error) {
          return null;
        }
      }
      async checkFileExtensionPattern(repositoryPath, pattern, globalEvidence) {
        const extension = pattern.pattern.replace("*", "");
        const extensionFiles = await this.getFilesWithExtension(repositoryPath, extension);
        if (extensionFiles.length > 0) {
          if (pattern.check !== null) {
            for (const file of extensionFiles) {
              const filePath = path3.join(repositoryPath, file);
              const hasContent = await this.checkFileContent(filePath, pattern.check, pattern.versionExtractor);
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
            return null;
          } else {
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
      async checkSpecificFilePattern(repositoryPath, pattern, globalEvidence) {
        const filePath = path3.join(repositoryPath, pattern.pattern);
        if (await this.fileExists(filePath)) {
          if (pattern.check === null) {
            const evidence = await this.collectTechnologyEvidence(repositoryPath, pattern, globalEvidence, [pattern.pattern]);
            return {
              name: pattern.name,
              category: pattern.category,
              confidence: pattern.confidence,
              icon: pattern.icon,
              ...evidence
            };
          }
          const hasContent = await this.checkFileContent(filePath, pattern.check, pattern.versionExtractor);
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
      async getFilesWithExtension(dirPath, extension, repositoryRoot) {
        const foundFiles = [];
        const rootPath = repositoryRoot || dirPath;
        try {
          const files = await fs3.promises.readdir(dirPath, { withFileTypes: true });
          for (const file of files) {
            if (file.isFile() && file.name.endsWith(extension)) {
              const filePath = path3.join(dirPath, file.name);
              const relativePath = path3.relative(rootPath, filePath);
              foundFiles.push(relativePath);
            } else if (file.isDirectory() && !file.name.startsWith(".") && !file.name.includes("node_modules")) {
              const subDirPath = path3.join(dirPath, file.name);
              const subFiles = await this.getFilesWithExtension(subDirPath, extension, rootPath);
              foundFiles.push(...subFiles);
            }
          }
          return foundFiles;
        } catch (error) {
          return [];
        }
      }
      async fileExists(filePath) {
        try {
          await fs3.promises.access(filePath);
          return true;
        } catch {
          return false;
        }
      }
      async checkFileContent(filePath, checks, versionExtractor) {
        try {
          const content = await fs3.promises.readFile(filePath, "utf8");
          const checksArray = Array.isArray(checks) ? checks : [checks];
          for (const check of checksArray) {
            if (content.includes(check)) {
              let version;
              let dependency;
              let versionSpec;
              if (versionExtractor && filePath.endsWith(".json")) {
                const versionInfo = this.extractVersionInfoFromJson(content, versionExtractor);
                version = versionInfo.version;
                dependency = versionExtractor;
                versionSpec = versionInfo.versionSpec;
              } else if (versionExtractor && (filePath.endsWith(".xml") || filePath.endsWith(".csproj"))) {
                version = this.extractVersionFromXml(content, versionExtractor);
                dependency = check;
              } else if (versionExtractor && filePath.includes("requirements.txt")) {
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
      extractVersionFromJson(content, packageName) {
        const versionInfo = this.extractVersionInfoFromJson(content, packageName);
        return versionInfo.version;
      }
      extractVersionInfoFromJson(content, packageName) {
        try {
          const json = JSON.parse(content);
          const dependencies = { ...json.dependencies, ...json.devDependencies, ...json.peerDependencies };
          const versionSpec = dependencies[packageName];
          if (!versionSpec) return {};
          const version = versionSpec.replace(/[\^~]/, "");
          return { version, versionSpec };
        } catch {
          return {};
        }
      }
      extractVersionFromXml(content, pattern) {
        try {
          const regex = new RegExp(`${pattern}([^<"]+)`, "i");
          const match = content.match(regex);
          return match ? match[1] : void 0;
        } catch {
          return void 0;
        }
      }
      extractVersionFromRequirements(content, packagePattern) {
        try {
          const lines = content.split("\n");
          for (const line of lines) {
            if (line.includes(packagePattern)) {
              const match = line.match(/==([^\s]+)/);
              return match ? match[1] : void 0;
            }
          }
          return void 0;
        } catch {
          return void 0;
        }
      }
      async collectGlobalEvidence(repositoryPath) {
        let lockfile = null;
        if (await this.fileExists(path3.join(repositoryPath, "package-lock.json"))) {
          lockfile = "npm";
        } else if (await this.fileExists(path3.join(repositoryPath, "yarn.lock"))) {
          lockfile = "yarn";
        } else if (await this.fileExists(path3.join(repositoryPath, "pnpm-lock.yaml"))) {
          lockfile = "pnpm";
        }
        const ciFiles = [];
        const ciPatterns = [
          ".github/workflows",
          ".gitlab-ci.yml",
          "azure-pipelines.yml",
          "circle.yml",
          "appveyor.yml",
          "bitbucket-pipelines.yml"
        ];
        for (const pattern of ciPatterns) {
          if (pattern.endsWith("/workflows")) {
            const workflowDir = path3.join(repositoryPath, pattern);
            if (await this.directoryExists(workflowDir)) {
              const workflowFiles = await this.getYmlFilesInDirectory(workflowDir);
              ciFiles.push(...workflowFiles.map((file) => path3.join(pattern, file)));
            }
          } else {
            if (await this.fileExists(path3.join(repositoryPath, pattern))) {
              ciFiles.push(pattern);
            }
          }
        }
        let packageJsonScripts = {};
        let packageJsonPath = null;
        const packageJsonFilePath = path3.join(repositoryPath, "package.json");
        if (await this.fileExists(packageJsonFilePath)) {
          packageJsonPath = "package.json";
          try {
            const content = await fs3.promises.readFile(packageJsonFilePath, "utf8");
            const json = JSON.parse(content);
            packageJsonScripts = json.scripts || {};
          } catch (error) {
          }
        }
        return {
          lockfile,
          ciFiles,
          packageJsonScripts,
          packageJsonPath
        };
      }
      async collectTechnologyEvidence(repositoryPath, pattern, globalEvidence, evidenceFiles, contentResult) {
        const evidence = {};
        evidence.evidenceFiles = evidenceFiles;
        if (contentResult && globalEvidence.packageJsonPath) {
          evidence.manifest = {
            file: globalEvidence.packageJsonPath,
            dependency: contentResult.dependency,
            versionSpec: contentResult.versionSpec
          };
        } else if (pattern.pattern === "requirements.txt" && contentResult) {
          evidence.manifest = {
            file: "requirements.txt",
            dependency: contentResult.dependency,
            versionSpec: contentResult.versionSpec
          };
        } else if (pattern.pattern.endsWith(".csproj") && contentResult) {
          evidence.manifest = {
            file: evidenceFiles[0],
            dependency: contentResult.dependency,
            versionSpec: contentResult.version
          };
        }
        if (pattern.configFiles) {
          const existingConfigFiles = [];
          for (const configFile of pattern.configFiles) {
            if (await this.fileExists(path3.join(repositoryPath, configFile))) {
              existingConfigFiles.push(configFile);
            }
          }
          if (existingConfigFiles.length > 0) {
            evidence.configFiles = existingConfigFiles;
          }
        }
        if (pattern.scriptTokens && globalEvidence.packageJsonPath) {
          const matchingScripts = {
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
        evidence.lockfile = globalEvidence.lockfile;
        if (globalEvidence.ciFiles.length > 0) {
          evidence.ciFiles = globalEvidence.ciFiles;
        }
        return evidence;
      }
      async directoryExists(dirPath) {
        try {
          const stats = await fs3.promises.stat(dirPath);
          return stats.isDirectory();
        } catch {
          return false;
        }
      }
      async getYmlFilesInDirectory(dirPath) {
        try {
          const files = await fs3.promises.readdir(dirPath);
          return files.filter((file) => file.endsWith(".yml") || file.endsWith(".yaml"));
        } catch {
          return [];
        }
      }
    };
    enhancedTechnologyDetectionService = new EnhancedTechnologyDetector();
  }
});

// server/services/githubService.ts
var githubService_exports = {};
__export(githubService_exports, {
  GitHubService: () => GitHubService,
  githubService: () => githubService
});
var GitHubService, githubService;
var init_githubService = __esm({
  "server/services/githubService.ts"() {
    "use strict";
    init_routes();
    GitHubService = class {
      /**
       * Creates a new repository in user's GitHub account
       * Based on C# logic provided by user
       */
      async createRepositoryInPersonalAccount(accessToken, sourceRepoUrl, requestedName) {
        try {
          broadcastLog("INFO", "Starting personal account repository creation");
          const username = await this.getGitHubUsername(accessToken);
          if (!username) {
            return { success: false, error: "Failed to get GitHub username" };
          }
          let repoName = requestedName || this.extractRepoNameFromUrl(sourceRepoUrl);
          if (!repoName) {
            repoName = `ClonedRepo_${Date.now()}`;
          }
          const finalRepoName = await this.ensureUniqueRepoName(accessToken, username, repoName);
          const createResult = await this.createRepository(accessToken, finalRepoName);
          if (!createResult.success) {
            return createResult;
          }
          const newRepoUrl = `https://github.com/${username}/${finalRepoName}`;
          broadcastLog("INFO", `\u2705 Repository '${finalRepoName}' created successfully at: ${newRepoUrl}`);
          return {
            success: true,
            repoUrl: newRepoUrl,
            repoName: finalRepoName
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          broadcastLog("ERROR", `Failed to create personal account repository: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      }
      /**
       * Get GitHub username from access token
       */
      async getGitHubUsername(accessToken) {
        try {
          const response = await fetch("https://api.github.com/user", {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "User-Agent": "Git-Cloner-App",
              "Accept": "application/vnd.github.v3+json"
            }
          });
          if (!response.ok) {
            broadcastLog("ERROR", `GitHub API responded with status ${response.status} when getting username`);
            return null;
          }
          const userData = await response.json();
          return userData.login;
        } catch (error) {
          broadcastLog("ERROR", `Failed to get GitHub username: ${error}`);
          return null;
        }
      }
      /**
       * Extract repository name from URL (matching C# Path.GetFileNameWithoutExtension)
       */
      extractRepoNameFromUrl(url) {
        try {
          const urlObj = new URL(url);
          const pathSegments = urlObj.pathname.split("/").filter((segment) => segment.length > 0);
          if (pathSegments.length >= 2) {
            const repoWithExt = pathSegments[pathSegments.length - 1];
            const extracted = repoWithExt.replace(/\.git$/, "");
            return extracted;
          }
          broadcastLog("WARN", `Failed to extract repository name from URL: ${url} - insufficient path segments`);
          return "";
        } catch (error) {
          broadcastLog("ERROR", `Error extracting repo name from ${url}: ${error}`);
          return "";
        }
      }
      /**
       * Ensure repository name is unique (following C# logic)
       */
      async ensureUniqueRepoName(accessToken, username, baseName) {
        let finalName = baseName;
        let counter = 0;
        while (true) {
          const exists = await this.checkRepositoryExists(accessToken, username, finalName);
          if (!exists) {
            return finalName;
          }
          counter++;
          const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "_");
          finalName = `${baseName}_${timestamp}_${counter}`;
        }
      }
      /**
       * Check if repository exists in user's account
       */
      async checkRepositoryExists(accessToken, username, repoName) {
        try {
          const response = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "User-Agent": "Git-Cloner-App",
              "Accept": "application/vnd.github.v3+json"
            }
          });
          return response.status === 200;
        } catch {
          return false;
        }
      }
      /**
       * Create repository via GitHub API
       */
      async createRepository(accessToken, repoName) {
        try {
          const response = await fetch("https://api.github.com/user/repos", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "User-Agent": "Git-Cloner-App",
              "Content-Type": "application/json",
              "Accept": "application/vnd.github.v3+json"
            },
            body: JSON.stringify({
              name: repoName,
              private: false,
              description: `Repository created via Git Cloner App on ${(/* @__PURE__ */ new Date()).toISOString()}`
            })
          });
          if (!response.ok) {
            const errorText = await response.text();
            broadcastLog("ERROR", `GitHub API error creating repository: ${response.status} - ${errorText}`);
            return { success: false, error: `Failed to create repository: ${response.status}` };
          }
          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          broadcastLog("ERROR", `Exception creating repository: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      }
      /**
       * Push cloned repository to new GitHub repo
       */
      async pushToPersonalRepository(localPath, accessToken, username, repoName) {
        try {
          broadcastLog("INFO", `Pushing cloned repository to https://github.com/${username}/${repoName}`);
          const { execFile: execFile2 } = await import("child_process");
          const { promisify: promisify2 } = await import("util");
          const execFileAsync2 = promisify2(execFile2);
          const pushUrl = `https://${accessToken}@github.com/${username}/${repoName}.git`;
          const { stdout, stderr } = await execFileAsync2("git", [
            "push",
            "--mirror",
            pushUrl
          ], {
            cwd: localPath
          });
          if (stderr && !stderr.includes("Everything up-to-date")) {
            broadcastLog("WARN", `Git push warning: ${stderr}`);
          }
          broadcastLog("INFO", `\u2705 Successfully pushed repository to https://github.com/${username}/${repoName}`);
          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          broadcastLog("ERROR", `Failed to push to personal repository: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      }
    };
    githubService = new GitHubService();
  }
});

// server/services/gitlabService.ts
var gitlabService_exports = {};
__export(gitlabService_exports, {
  GitLabService: () => GitLabService,
  gitlabService: () => gitlabService
});
var GitLabService, gitlabService;
var init_gitlabService = __esm({
  "server/services/gitlabService.ts"() {
    "use strict";
    init_routes();
    GitLabService = class {
      /**
       * Creates a new repository in user's GitLab account
       * Based on GitHub logic adapted for GitLab API
       */
      async createRepositoryInPersonalAccount(accessToken, sourceRepoUrl, requestedName) {
        try {
          broadcastLog("INFO", "Starting GitLab personal account repository creation");
          const username = await this.getGitLabUsername(accessToken);
          if (!username) {
            return { success: false, error: "Failed to get GitLab username" };
          }
          let repoName = requestedName || this.extractRepoNameFromUrl(sourceRepoUrl);
          if (!repoName) {
            repoName = `ClonedRepo_${Date.now()}`;
          }
          const finalRepoName = await this.ensureUniqueRepoName(accessToken, username, repoName);
          const createResult = await this.createRepository(accessToken, finalRepoName);
          if (!createResult.success) {
            return createResult;
          }
          const newRepoUrl = `https://gitlab.com/${username}/${finalRepoName}`;
          broadcastLog("INFO", `\u2705 GitLab repository '${finalRepoName}' created successfully at: ${newRepoUrl}`);
          return {
            success: true,
            repoUrl: newRepoUrl,
            repoName: finalRepoName
          };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          broadcastLog("ERROR", `Failed to create GitLab personal account repository: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      }
      /**
       * Get GitLab username from access token
       */
      async getGitLabUsername(accessToken) {
        try {
          const response = await fetch("https://gitlab.com/api/v4/user", {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              // GitLab uses Bearer
              "User-Agent": "Git-Cloner-App"
            }
          });
          if (!response.ok) {
            broadcastLog("ERROR", `GitLab API responded with status ${response.status} when getting username`);
            return null;
          }
          const userData = await response.json();
          return userData.username;
        } catch (error) {
          broadcastLog("ERROR", `Failed to get GitLab username: ${error}`);
          return null;
        }
      }
      /**
       * Extract repository name from URL (same logic as GitHub)
       */
      extractRepoNameFromUrl(url) {
        try {
          const urlObj = new URL(url);
          const pathSegments = urlObj.pathname.split("/").filter((segment) => segment.length > 0);
          if (pathSegments.length >= 2) {
            const repoWithExt = pathSegments[pathSegments.length - 1];
            const extracted = repoWithExt.replace(/\.git$/, "");
            return extracted;
          }
          broadcastLog("WARN", `Failed to extract repository name from URL: ${url} - insufficient path segments`);
          return "";
        } catch (error) {
          broadcastLog("ERROR", `Error extracting repo name from ${url}: ${error}`);
          return "";
        }
      }
      /**
       * Ensure repository name is unique
       */
      async ensureUniqueRepoName(accessToken, username, baseName) {
        let finalName = baseName;
        let counter = 0;
        while (true) {
          const exists = await this.checkRepositoryExists(accessToken, username, finalName);
          if (!exists) {
            return finalName;
          }
          counter++;
          const timestamp = (/* @__PURE__ */ new Date()).toISOString().slice(0, 19).replace(/[-:]/g, "").replace("T", "_");
          finalName = `${baseName}_${timestamp}_${counter}`;
        }
      }
      /**
       * Check if repository exists in user's GitLab account
       */
      async checkRepositoryExists(accessToken, username, repoName) {
        try {
          const encodedPath = encodeURIComponent(`${username}/${repoName}`);
          const response = await fetch(`https://gitlab.com/api/v4/projects/${encodedPath}`, {
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              "User-Agent": "Git-Cloner-App"
            }
          });
          return response.status === 200;
        } catch {
          return false;
        }
      }
      /**
       * Create repository via GitLab API
       */
      async createRepository(accessToken, repoName) {
        try {
          const response = await fetch("https://gitlab.com/api/v4/projects", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${accessToken}`,
              // GitLab uses Bearer
              "User-Agent": "Git-Cloner-App",
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              name: repoName,
              visibility: "public",
              // GitLab uses 'visibility' instead of 'private'
              description: `Repository created via Git Cloner App on ${(/* @__PURE__ */ new Date()).toISOString()}`
            })
          });
          if (!response.ok) {
            const errorText = await response.text();
            broadcastLog("ERROR", `GitLab API error creating repository: ${response.status} - ${errorText}`);
            return { success: false, error: `Failed to create GitLab repository: ${response.status}` };
          }
          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          broadcastLog("ERROR", `Exception creating GitLab repository: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      }
      /**
       * Push cloned repository to new GitLab repo
       */
      async pushToPersonalRepository(localPath, accessToken, username, repoName) {
        try {
          broadcastLog("INFO", `Pushing cloned repository to https://gitlab.com/${username}/${repoName}`);
          const { execFile: execFile2 } = await import("child_process");
          const { promisify: promisify2 } = await import("util");
          const execFileAsync2 = promisify2(execFile2);
          const pushUrl = `https://oauth2:${accessToken}@gitlab.com/${username}/${repoName}.git`;
          const { stdout, stderr } = await execFileAsync2("git", [
            "push",
            "--mirror",
            pushUrl
          ], {
            cwd: localPath
          });
          if (stderr && !stderr.includes("Everything up-to-date")) {
            broadcastLog("WARN", `Git push warning: ${stderr}`);
          }
          broadcastLog("INFO", `\u2705 Successfully pushed repository to https://gitlab.com/${username}/${repoName}`);
          return { success: true };
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : "Unknown error";
          broadcastLog("ERROR", `Failed to push to GitLab personal repository: ${errorMessage}`);
          return { success: false, error: errorMessage };
        }
      }
    };
    gitlabService = new GitLabService();
  }
});

// server/routes.ts
import { createServer } from "http";
import session from "express-session";
import { randomUUID as randomUUID2 } from "crypto";
function getActiveAccount(req) {
  if (!req.session?.accounts || !req.session.activeAccountId) {
    return null;
  }
  return req.session.accounts[req.session.activeAccountId] || null;
}
function getAllAccounts(req) {
  if (!req.session?.accounts) {
    return [];
  }
  return Object.values(req.session.accounts);
}
function addAccount(req, account) {
  if (!req.session) {
    throw new Error("Session not available - ensure express-session middleware is configured");
  }
  if (!req.session.accounts) {
    req.session.accounts = {};
  }
  req.session.accounts[account.id] = account;
  if (!req.session.activeAccountId) {
    req.session.activeAccountId = account.id;
  }
}
function removeAccount(req, accountId) {
  if (!req.session?.accounts || !req.session.accounts[accountId]) {
    return false;
  }
  delete req.session.accounts[accountId];
  if (req.session.activeAccountId === accountId) {
    const remainingAccounts = Object.keys(req.session.accounts);
    req.session.activeAccountId = remainingAccounts.length > 0 ? remainingAccounts[0] : void 0;
  }
  return true;
}
function switchActiveAccount(req, accountId) {
  if (!req.session?.accounts || !req.session.accounts[accountId]) {
    return false;
  }
  req.session.activeAccountId = accountId;
  return true;
}
function accountToPublic(account) {
  return {
    id: account.id,
    provider: account.provider,
    providerUserId: account.providerUserId,
    username: account.username,
    displayName: account.displayName,
    email: account.email,
    avatarUrl: account.avatarUrl,
    scopes: account.scopes,
    connectedAt: account.connectedAt
  };
}
function broadcastLog(level, message) {
}
async function registerRoutes(app2) {
  app2.use(session({
    secret: process.env.SESSION_SECRET || "dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1e3
      // 24 hours
    }
  }));
  app2.post("/api/admin/oauth-config", (req, res) => {
    try {
      const { github, gitlab, azure, bitbucket, gitea, codeberg, sourcehut } = req.body;
      if (github?.clientId && github?.clientSecret) {
        oauthCredentials.set("github", {
          clientId: github.clientId,
          clientSecret: github.clientSecret,
          scope: github.scope || "user:email public_repo",
          enabled: github.enabled !== void 0 ? github.enabled : true
        });
      }
      if (gitlab?.clientId && gitlab?.clientSecret) {
        oauthCredentials.set("gitlab", {
          clientId: gitlab.clientId,
          clientSecret: gitlab.clientSecret,
          scope: gitlab.scope || "api",
          enabled: gitlab.enabled !== void 0 ? gitlab.enabled : true
        });
      }
      if (azure?.clientId && azure?.clientSecret) {
        oauthCredentials.set("azure", {
          clientId: azure.clientId,
          clientSecret: azure.clientSecret,
          scope: azure.scope || "vso.code,vso.identity",
          enabled: azure.enabled !== void 0 ? azure.enabled : true
        });
      }
      if (bitbucket?.clientId && bitbucket?.clientSecret) {
        oauthCredentials.set("bitbucket", {
          clientId: bitbucket.clientId,
          clientSecret: bitbucket.clientSecret,
          scope: bitbucket.scope || "repositories:read,account:read",
          enabled: bitbucket.enabled !== void 0 ? bitbucket.enabled : true
        });
      }
      if (gitea?.clientId && gitea?.clientSecret) {
        oauthCredentials.set("gitea", {
          clientId: gitea.clientId,
          clientSecret: gitea.clientSecret,
          scope: gitea.scope || "read:user,read:repository",
          enabled: gitea.enabled !== void 0 ? gitea.enabled : true
        });
      }
      if (codeberg?.clientId && codeberg?.clientSecret) {
        oauthCredentials.set("codeberg", {
          clientId: codeberg.clientId,
          clientSecret: codeberg.clientSecret,
          scope: codeberg.scope || "read:user,read:repository",
          enabled: codeberg.enabled !== void 0 ? codeberg.enabled : true
        });
      }
      if (sourcehut?.clientId && sourcehut?.clientSecret) {
        oauthCredentials.set("sourcehut", {
          clientId: sourcehut.clientId,
          clientSecret: sourcehut.clientSecret,
          scope: sourcehut.scope || "profile,repositories",
          enabled: sourcehut.enabled !== void 0 ? sourcehut.enabled : true
        });
      }
      res.json({
        success: true,
        message: "OAuth configuration saved successfully"
      });
    } catch (error) {
      res.status(500).json({
        error: "Failed to save OAuth configuration"
      });
    }
  });
  app2.get("/api/admin/oauth-config", (req, res) => {
    try {
      const config = {
        github: {
          clientId: oauthCredentials.get("github")?.clientId || process.env.GITHUB_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("github")?.clientSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          scope: oauthCredentials.get("github")?.scope || "user:email public_repo",
          enabled: oauthCredentials.get("github")?.enabled !== void 0 ? oauthCredentials.get("github")?.enabled : true
        },
        gitlab: {
          clientId: oauthCredentials.get("gitlab")?.clientId || process.env.GITLAB_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("gitlab")?.clientSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          scope: oauthCredentials.get("gitlab")?.scope || "api",
          enabled: oauthCredentials.get("gitlab")?.enabled !== void 0 ? oauthCredentials.get("gitlab")?.enabled : true
        },
        azure: {
          clientId: oauthCredentials.get("azure")?.clientId || process.env.AZURE_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("azure")?.clientSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          scope: oauthCredentials.get("azure")?.scope || "vso.code,vso.identity",
          enabled: oauthCredentials.get("azure")?.enabled !== void 0 ? oauthCredentials.get("azure")?.enabled : true
        },
        bitbucket: {
          clientId: oauthCredentials.get("bitbucket")?.clientId || process.env.BITBUCKET_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("bitbucket")?.clientSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          scope: oauthCredentials.get("bitbucket")?.scope || "repositories:read,account:read",
          enabled: oauthCredentials.get("bitbucket")?.enabled !== void 0 ? oauthCredentials.get("bitbucket")?.enabled : true
        },
        gitea: {
          clientId: oauthCredentials.get("gitea")?.clientId || process.env.GITEA_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("gitea")?.clientSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          scope: oauthCredentials.get("gitea")?.scope || "read:user,read:repository",
          enabled: oauthCredentials.get("gitea")?.enabled !== void 0 ? oauthCredentials.get("gitea")?.enabled : true
        },
        codeberg: {
          clientId: oauthCredentials.get("codeberg")?.clientId || process.env.CODEBERG_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("codeberg")?.clientSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          scope: oauthCredentials.get("codeberg")?.scope || "read:user,read:repository",
          enabled: oauthCredentials.get("codeberg")?.enabled !== void 0 ? oauthCredentials.get("codeberg")?.enabled : true
        },
        sourcehut: {
          clientId: oauthCredentials.get("sourcehut")?.clientId || process.env.SOURCEHUT_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("sourcehut")?.clientSecret ? "\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022" : "",
          scope: oauthCredentials.get("sourcehut")?.scope || "profile,repositories",
          enabled: oauthCredentials.get("sourcehut")?.enabled !== void 0 ? oauthCredentials.get("sourcehut")?.enabled : true
        }
      };
      const status = {
        github: !!(config.github.clientId && config.github.clientSecret),
        gitlab: !!(config.gitlab.clientId && config.gitlab.clientSecret),
        azure: !!(config.azure.clientId && config.azure.clientSecret),
        bitbucket: !!(config.bitbucket.clientId && config.bitbucket.clientSecret),
        gitea: !!(config.gitea.clientId && config.gitea.clientSecret),
        codeberg: !!(config.codeberg.clientId && config.codeberg.clientSecret),
        sourcehut: !!(config.sourcehut.clientId && config.sourcehut.clientSecret)
      };
      const enabled = {
        github: status.github && config.github.enabled,
        gitlab: status.gitlab && config.gitlab.enabled,
        azure: status.azure && config.azure.enabled,
        bitbucket: status.bitbucket && config.bitbucket.enabled,
        gitea: status.gitea && config.gitea.enabled,
        codeberg: status.codeberg && config.codeberg.enabled,
        sourcehut: status.sourcehut && config.sourcehut.enabled
      };
      res.json({ config, status, enabled });
    } catch (error) {
      res.status(500).json({
        error: "Failed to retrieve OAuth configuration"
      });
    }
  });
  app2.get("/api/auth/providers", (req, res) => {
    try {
      const enabledProviders = [];
      const providers = ["github", "gitlab", "azure", "bitbucket", "gitea", "codeberg", "sourcehut"];
      for (const provider of providers) {
        const creds = oauthCredentials.get(provider);
        const envClientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
        const envClientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
        const clientId = creds?.clientId || envClientId;
        const clientSecret = creds?.clientSecret || envClientSecret;
        const isConfigured = !!(clientId && clientSecret);
        const isEnabled = creds?.enabled !== void 0 ? creds.enabled : true;
        if (isConfigured && isEnabled) {
          enabledProviders.push(provider);
        }
      }
      res.json(enabledProviders);
    } catch (error) {
      res.status(500).json({
        error: "Failed to retrieve enabled providers"
      });
    }
  });
  app2.get("/api/auth/redirect-uri/:provider", (req, res) => {
    const { provider } = req.params;
    const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
    const host = replitDomain || req.get("host");
    const protocol = host && (host.includes("replit.dev") || host.includes("replit.app")) ? "https" : req.protocol;
    const redirectUri = `${protocol}://${host}/api/auth/callback/${provider}`;
    res.json({
      provider,
      redirectUri,
      currentDomain: replitDomain,
      instructions: `Add this URL to your ${provider} OAuth app's Authorization callback URL field`,
      note: "This URL is now dynamically generated and will update automatically"
    });
  });
  app2.get("/api/auth/:provider/start", (req, res) => {
    const { provider } = req.params;
    const config = getOauthConfig()[provider];
    if (!config) {
      return res.status(400).json({ error: "Unsupported OAuth provider" });
    }
    const missing = [];
    if (!config.clientId) missing.push("client ID");
    if (!config.clientSecret) missing.push("client secret");
    if (!config.scope) missing.push("scope");
    if (missing.length > 0) {
      const missingItems = missing.join(", ");
      return res.status(500).json({
        error: `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth not configured - missing ${missingItems}. Please configure these in Settings.`
      });
    }
    req.session = req.session || {};
    req.session.oauthProvider = provider;
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    req.session.oauthState = state;
    const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
    const host = replitDomain || req.get("host");
    const protocol = host && (host.includes("replit.dev") || host.includes("replit.app")) ? "https" : req.protocol;
    const redirectUri = `${protocol}://${host}/api/auth/callback/${provider}`;
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state,
      response_type: "code"
    });
    const authUrl = `${config.authorizeUrl}?${params.toString()}`;
    res.redirect(authUrl);
  });
  app2.get("/api/auth/oauth/:provider", (req, res) => {
    const { provider } = req.params;
    res.redirect(`/api/auth/${provider}/start`);
  });
  app2.get("/api/auth/callback/:provider", async (req, res) => {
    const { provider } = req.params;
    const { code, state } = req.query;
    const config = getOauthConfig()[provider];
    if (!config) {
      return res.status(400).json({ error: "Unsupported OAuth provider" });
    }
    if (state !== req.session?.oauthState) {
      return res.status(400).json({ error: "Invalid state parameter" });
    }
    if (!code) {
      return res.status(400).json({ error: "No authorization code received" });
    }
    try {
      const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
      const host = replitDomain || req.get("host");
      const protocol = host && (host.includes("replit.dev") || host.includes("replit.app")) ? "https" : req.protocol;
      const redirectUri = `${protocol}://${host}/api/auth/callback/${provider}`;
      const tokenParams = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: redirectUri
      });
      if (provider === "gitlab") {
        tokenParams.set("grant_type", "authorization_code");
      }
      const tokenResponse = await fetch(config.tokenUrl, {
        method: "POST",
        headers: {
          "Accept": "application/json",
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: tokenParams.toString()
      });
      const tokenData = await tokenResponse.json();
      if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || `Token exchange failed: ${JSON.stringify(tokenData)}`);
      }
      const authHeaderValue = provider === "gitlab" ? `Bearer ${tokenData.access_token}` : `token ${tokenData.access_token}`;
      const userResponse = await fetch(config.userUrl, {
        headers: {
          "Authorization": authHeaderValue,
          "Accept": "application/json",
          "User-Agent": "Git-Cloner-App"
        }
      });
      const userData = await userResponse.json();
      if (!userResponse.ok) {
        throw new Error("Failed to fetch user data");
      }
      const accountId = randomUUID2();
      const newAccount = {
        id: accountId,
        provider,
        providerUserId: userData.id?.toString() || userData.login || userData.username,
        username: userData.login || userData.username,
        displayName: userData.name || userData.display_name || userData.login || userData.username,
        email: userData.email,
        avatarUrl: userData.avatar_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        scopes: config.scope.split(",").map((s) => s.trim()),
        connectedAt: /* @__PURE__ */ new Date()
      };
      addAccount(req, newAccount);
      if (req.session) {
        delete req.session.oauthProvider;
        delete req.session.oauthState;
      }
      res.redirect(`/?auth=success&provider=${provider}&username=${encodeURIComponent(newAccount.username)}&accountId=${accountId}`);
    } catch (error) {
      res.redirect(`/?auth=error&message=${encodeURIComponent(error instanceof Error ? error.message : "Authentication failed")}`);
    }
  });
  app2.post("/api/auth/authenticate", async (req, res) => {
    try {
      const { provider, credentials } = req.body;
      if (!gitProviders[provider]) {
        return res.status(400).json({ error: "Unsupported provider" });
      }
      const result = await gitProviders[provider].authenticate(credentials);
      if (result.success) {
        const accountId = randomUUID2();
        const newAccount = {
          id: accountId,
          provider,
          providerUserId: result.username || "unknown",
          username: result.username || "unknown",
          displayName: result.username || "unknown",
          email: void 0,
          avatarUrl: void 0,
          accessToken: result.token || "",
          refreshToken: void 0,
          scopes: ["basic"],
          connectedAt: /* @__PURE__ */ new Date()
        };
        addAccount(req, newAccount);
        res.json({
          success: true,
          accountId,
          username: result.username,
          provider,
          account: accountToPublic(newAccount)
        });
      } else {
        res.status(401).json({ error: result.error });
      }
    } catch (error) {
      res.status(500).json({ error: "Authentication failed" });
    }
  });
  app2.post("/api/auth/logout", (req, res) => {
    try {
      const { accountId } = req.body;
      if (accountId) {
        if (removeAccount(req, accountId)) {
          const remainingAccounts = getAllAccounts(req);
          res.json({
            success: true,
            accountsRemaining: remainingAccounts.length,
            activeAccountId: req.session?.activeAccountId
          });
        } else {
          res.status(404).json({ error: "Account not found" });
        }
      } else {
        if (req.session) {
          req.session.destroy((err) => {
            if (err) {
              return res.status(500).json({ error: "Logout failed" });
            }
            res.json({ success: true, accountsRemaining: 0 });
          });
        } else {
          res.json({ success: true, accountsRemaining: 0 });
        }
      }
    } catch (error) {
      res.status(500).json({ error: "Logout failed" });
    }
  });
  app2.get("/api/auth/status", (req, res) => {
    const activeAccount = getActiveAccount(req);
    if (activeAccount) {
      res.json({
        authenticated: true,
        username: activeAccount.username,
        provider: activeAccount.provider,
        displayName: activeAccount.displayName,
        accountId: activeAccount.id
      });
    } else {
      const auth = req.session?.auth;
      if (auth) {
        res.json({
          authenticated: true,
          username: auth.username,
          provider: auth.provider
        });
      } else {
        res.json({ authenticated: false });
      }
    }
  });
  app2.get("/api/auth/accounts", (req, res) => {
    try {
      const accounts = getAllAccounts(req).map(accountToPublic);
      const response = {
        accounts,
        activeAccountId: req.session?.activeAccountId
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve accounts" });
    }
  });
  app2.post("/api/auth/switch", (req, res) => {
    try {
      const { accountId } = req.body;
      if (!accountId || typeof accountId !== "string") {
        return res.status(400).json({ error: "Account ID is required" });
      }
      if (switchActiveAccount(req, accountId)) {
        const activeAccount = getActiveAccount(req);
        res.json({
          success: true,
          activeAccountId: accountId,
          account: activeAccount ? accountToPublic(activeAccount) : null
        });
      } else {
        res.status(404).json({ error: "Account not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to switch account" });
    }
  });
  app2.post("/api/auth/remove", (req, res) => {
    try {
      const { accountId } = req.body;
      if (!accountId || typeof accountId !== "string") {
        return res.status(400).json({ error: "Account ID is required" });
      }
      if (removeAccount(req, accountId)) {
        const accounts = getAllAccounts(req).map(accountToPublic);
        res.json({
          success: true,
          accounts,
          activeAccountId: req.session?.activeAccountId
        });
      } else {
        res.status(404).json({ error: "Account not found" });
      }
    } catch (error) {
      res.status(500).json({ error: "Failed to remove account" });
    }
  });
  app2.post("/api/repositories/clone", async (req, res) => {
    try {
      const { url, options } = req.body;
      const provider = detectProvider(url);
      if (!provider) {
        return res.status(400).json({ error: "Unsupported repository URL" });
      }
      if (!gitProviders[provider]) {
        return res.status(400).json({ error: "Provider not implemented" });
      }
      if (options?.personalAccount && req.session?.auth?.provider === "github") {
        broadcastLog("INFO", "\u{1F680} Personal account repository creation requested");
        const auth = req.session?.auth;
        if (!auth || auth.provider !== "github" || !auth.token) {
          broadcastLog("ERROR", "Personal account creation requires GitHub authentication");
          return res.status(401).json({
            error: "Personal account creation requires GitHub authentication. Please sign in with GitHub."
          });
        }
        const { githubService: githubService2 } = await Promise.resolve().then(() => (init_githubService(), githubService_exports));
        broadcastLog("INFO", `Creating repository in ${auth.username}'s GitHub account`);
        const createResult = await githubService2.createRepositoryInPersonalAccount(
          auth.token,
          url
        );
        if (!createResult.success) {
          broadcastLog("ERROR", `Failed to create personal repository: ${createResult.error}`);
          return res.status(500).json({ error: createResult.error });
        }
        broadcastLog("INFO", "Cloning source repository for technology detection...");
        const analysisCloneResult = await gitProviders[provider].cloneRepository(url, { mirror: false });
        if (!analysisCloneResult.success) {
          broadcastLog("ERROR", `Analysis repository clone failed: ${analysisCloneResult.error}`);
          return res.status(500).json({ error: analysisCloneResult.error });
        }
        broadcastLog("INFO", "Analyzing file structure and detecting technologies...");
        const fileStructure2 = await gitProviders[provider].getFileStructure(analysisCloneResult.localPath);
        const detectedTechnologies2 = await enhancedTechnologyDetectionService.detectTechnologies(analysisCloneResult.localPath);
        broadcastLog("INFO", `Technology detection completed. Found ${detectedTechnologies2.length} technologies`);
        broadcastLog("INFO", "Creating mirror clone for pushing to personal repository...");
        const mirrorCloneResult = await gitProviders[provider].cloneRepository(url, { mirror: true });
        if (!mirrorCloneResult.success) {
          broadcastLog("ERROR", `Mirror repository clone failed: ${mirrorCloneResult.error}`);
          return res.status(500).json({ error: mirrorCloneResult.error });
        }
        broadcastLog("INFO", "Pushing mirror clone to personal repository...");
        const pushResult = await githubService2.pushToPersonalRepository(
          mirrorCloneResult.localPath,
          auth.token,
          auth.username,
          createResult.repoName
        );
        if (!pushResult.success) {
          broadcastLog("ERROR", `Failed to push to personal repository: ${pushResult.error}`);
          return res.status(500).json({ error: pushResult.error });
        }
        const repository2 = await storage.createRepository({
          name: createResult.repoName,
          url,
          provider,
          clonedUrl: createResult.repoUrl,
          // Use the new personal repo URL
          localPath: analysisCloneResult.localPath,
          // Store the analysis clone path
          fileStructure: fileStructure2,
          detectedTechnologies: detectedTechnologies2
        });
        broadcastLog("INFO", `\u{1F389} SUCCESS! Repository created and pushed to: ${createResult.repoUrl}`);
        return res.json({
          success: true,
          repository: repository2,
          fileStructure: fileStructure2,
          detectedTechnologies: detectedTechnologies2,
          personalRepoUrl: createResult.repoUrl,
          // Include the new repo URL in response
          message: `Repository successfully created in your personal account: ${createResult.repoUrl}`
        });
      }
      if (options?.personalAccount && req.session?.auth?.provider === "gitlab") {
        broadcastLog("INFO", "\u{1F680} GitLab personal account repository creation requested");
        const auth = req.session?.auth;
        if (!auth || auth.provider !== "gitlab" || !auth.token) {
          broadcastLog("ERROR", "Personal account creation requires GitLab authentication");
          return res.status(401).json({
            error: "Personal account creation requires GitLab authentication. Please sign in with GitLab."
          });
        }
        const { gitlabService: gitlabService2 } = await Promise.resolve().then(() => (init_gitlabService(), gitlabService_exports));
        broadcastLog("INFO", `Creating repository in ${auth.username}'s GitLab account`);
        const createResult = await gitlabService2.createRepositoryInPersonalAccount(
          auth.token,
          url
        );
        if (!createResult.success) {
          broadcastLog("ERROR", `Failed to create GitLab personal repository: ${createResult.error}`);
          return res.status(500).json({ error: createResult.error });
        }
        broadcastLog("INFO", "Cloning source repository for technology detection...");
        const analysisCloneResult = await gitProviders[provider].cloneRepository(url, { mirror: false });
        if (!analysisCloneResult.success) {
          broadcastLog("ERROR", `Analysis repository clone failed: ${analysisCloneResult.error}`);
          return res.status(500).json({ error: analysisCloneResult.error });
        }
        broadcastLog("INFO", "Analyzing file structure and detecting technologies...");
        const fileStructure2 = await gitProviders[provider].getFileStructure(analysisCloneResult.localPath);
        const detectedTechnologies2 = await enhancedTechnologyDetectionService.detectTechnologies(analysisCloneResult.localPath);
        broadcastLog("INFO", `Technology detection completed. Found ${detectedTechnologies2.length} technologies`);
        broadcastLog("INFO", "Creating mirror clone for pushing to personal repository...");
        const mirrorCloneResult = await gitProviders[provider].cloneRepository(url, { mirror: true });
        if (!mirrorCloneResult.success) {
          broadcastLog("ERROR", `Mirror repository clone failed: ${mirrorCloneResult.error}`);
          return res.status(500).json({ error: mirrorCloneResult.error });
        }
        broadcastLog("INFO", "Pushing mirror clone to GitLab personal repository...");
        const pushResult = await gitlabService2.pushToPersonalRepository(
          mirrorCloneResult.localPath,
          auth.token,
          auth.username,
          createResult.repoName
        );
        if (!pushResult.success) {
          broadcastLog("ERROR", `Failed to push to GitLab personal repository: ${pushResult.error}`);
          return res.status(500).json({ error: pushResult.error });
        }
        const repository2 = await storage.createRepository({
          name: createResult.repoName,
          url,
          provider,
          clonedUrl: createResult.repoUrl,
          // Use the new personal repo URL
          localPath: analysisCloneResult.localPath,
          // Store the analysis clone path
          fileStructure: fileStructure2,
          detectedTechnologies: detectedTechnologies2
        });
        broadcastLog("INFO", `\u{1F389} SUCCESS! GitLab repository created and pushed to: ${createResult.repoUrl}`);
        return res.json({
          success: true,
          repository: repository2,
          fileStructure: fileStructure2,
          detectedTechnologies: detectedTechnologies2,
          personalRepoUrl: createResult.repoUrl,
          // Include the new repo URL in response
          message: `Repository successfully created in your GitLab personal account: ${createResult.repoUrl}`
        });
      }
      const cloneResult = await gitProviders[provider].cloneRepository(url, { mirror: false });
      if (!cloneResult.success) {
        return res.status(500).json({ error: cloneResult.error });
      }
      const fileStructure = await gitProviders[provider].getFileStructure(cloneResult.localPath);
      broadcastLog("INFO", `Starting technology detection for repository: ${url}`);
      const detectedTechnologies = await enhancedTechnologyDetectionService.detectTechnologies(cloneResult.localPath);
      broadcastLog("INFO", `Technology detection completed. Found ${detectedTechnologies.length} technologies`);
      const repository = await storage.createRepository({
        name: url.split("/").pop()?.replace(".git", "") || "Unknown",
        url,
        provider,
        clonedUrl: cloneResult.remoteUrl,
        localPath: cloneResult.localPath,
        // Store the clone path
        fileStructure,
        detectedTechnologies
      });
      res.json({
        success: true,
        repository,
        fileStructure,
        detectedTechnologies
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Clone operation failed"
      });
    }
  });
  app2.get("/api/repositories/:id/files", async (req, res) => {
    try {
      const repository = await storage.getRepository(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      res.json({ fileStructure: repository.fileStructure });
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve file structure" });
    }
  });
  app2.get("/api/repositories", async (req, res) => {
    try {
      const repositories = await storage.getAllRepositories();
      res.json({ repositories });
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve repositories" });
    }
  });
  app2.post("/api/analysis/analyze", async (req, res) => {
    try {
      const analysisRequest = req.body;
      const repository = await storage.getRepository(analysisRequest.repositoryId);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      const repoPath = await storage.getRepositoryPath(analysisRequest.repositoryId);
      if (!repoPath) {
        broadcastLog("ERROR", `Repository path not found for repository ${analysisRequest.repositoryId}`);
        return res.status(404).json({
          error: "Repository files not found. The repository may need to be re-cloned."
        });
      }
      broadcastLog("INFO", `Starting ${analysisRequest.analysisType} analysis for repository ${repository.name}`);
      const analysisResult = await openaiService.analyzeRepository(
        analysisRequest,
        repository.fileStructure || [],
        repoPath
      );
      broadcastLog("INFO", `Analysis completed successfully for repository ${repository.name} - Quality: ${analysisResult.summary.qualityScore}%, Issues: ${analysisResult.issues.length}`);
      const report = await storage.createAnalysisReport({
        repositoryId: analysisRequest.repositoryId,
        analysisType: analysisRequest.analysisType,
        results: analysisResult
      });
      res.json({
        success: true,
        report,
        results: analysisResult
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Analysis failed";
      broadcastLog("ERROR", `Analysis failed for repository ${req.body.repositoryId || "unknown"}: ${errorMessage}`);
      if (errorMessage.includes("ENOENT") || errorMessage.includes("not found")) {
        res.status(404).json({
          error: "Repository files not found. Please try cloning the repository again."
        });
      } else if (errorMessage.includes("EPAM_AI_API_KEY") || errorMessage.includes("API key")) {
        res.status(500).json({
          error: "Analysis service not configured properly. Please contact administrator."
        });
      } else if (errorMessage.includes("rate limit") || errorMessage.includes("quota")) {
        res.status(429).json({
          error: "Analysis service rate limit exceeded. Please try again later."
        });
      } else {
        res.status(500).json({
          error: `Analysis failed: ${errorMessage}`
        });
      }
    }
  });
  app2.get("/api/analysis/reports/:repositoryId", async (req, res) => {
    try {
      const reports = await storage.getAnalysisReportsByRepository(req.params.repositoryId);
      res.json({ reports });
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve analysis reports" });
    }
  });
  app2.post("/api/analysis/generate-report", async (req, res) => {
    try {
      const { repositoryId } = req.body;
      const repository = await storage.getRepository(repositoryId);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      const reports = await storage.getAnalysisReportsByRepository(repositoryId);
      const analysisResults = reports.map((r) => r.results);
      const summaryReport = await openaiService.generateSummaryReport(
        repository.name,
        analysisResults
      );
      res.json({
        success: true,
        report: summaryReport
      });
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Report generation failed"
      });
    }
  });
  app2.get("/api/reports/:id/export", async (req, res) => {
    try {
      const { id } = req.params;
      const { format } = req.query;
      if (!format || typeof format !== "string") {
        return res.status(400).json({ error: "Format parameter is required" });
      }
      const validFormats = ["pdf", "xlsx", "docx"];
      if (!validFormats.includes(format)) {
        return res.status(400).json({
          error: `Invalid format. Supported formats: ${validFormats.join(", ")}`
        });
      }
      const analysisReport = await storage.getAnalysisReport(id);
      if (!analysisReport) {
        return res.status(404).json({ error: "Analysis report not found" });
      }
      if (!analysisReport.repositoryId) {
        return res.status(400).json({ error: "Analysis report has no associated repository" });
      }
      const repository = await storage.getRepository(analysisReport.repositoryId);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      const reportData = {
        repository,
        analysisReport,
        analysisResults: analysisReport.results
      };
      const reportBuffer = await ReportBuilder.generateReport(reportData, format);
      const contentType = ReportBuilder.getContentType(format);
      const fileExtension = ReportBuilder.getFileExtension(format);
      const fileName = `${repository.name}_analysis_report.${fileExtension}`;
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Length", reportBuffer.length);
      res.send(reportBuffer);
    } catch (error) {
      res.status(500).json({
        error: error instanceof Error ? error.message : "Report export failed"
      });
    }
  });
  app2.get("/api/providers/detect", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== "string") {
        return res.status(400).json({ error: "URL is required" });
      }
      const provider = detectProvider(url);
      res.json({ provider });
    } catch (error) {
      res.status(500).json({ error: "Provider detection failed" });
    }
  });
  app2.get("/api/providers", (req, res) => {
    const providers = Object.keys(gitProviders).map((key) => ({
      id: key,
      name: gitProviders[key].name
    }));
    res.json({ providers });
  });
  app2.get("/api/repositories/:id/download/file", async (req, res) => {
    try {
      const { id } = req.params;
      const { filePath } = req.query;
      if (!filePath || typeof filePath !== "string") {
        return res.status(400).json({ error: "File path is required" });
      }
      const repository = await storage.getRepository(id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      const fileContent = await storage.getFileContent(id, filePath);
      if (!fileContent) {
        return res.status(404).json({ error: "File not found or cannot be accessed" });
      }
      const mime = await import("mime-types");
      const path6 = await import("path");
      const fileName = path6.basename(filePath);
      const mimeType = mime.lookup(fileName) || "application/octet-stream";
      res.setHeader("Content-Type", mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
      res.setHeader("Content-Length", fileContent.length.toString());
      broadcastLog("INFO", `File download started: ${fileName} (${fileContent.length} bytes)`);
      res.send(fileContent);
    } catch (error) {
      broadcastLog("ERROR", `File download error: ${error instanceof Error ? error.message : "Unknown error"}`);
      res.status(500).json({ error: "File download failed" });
    }
  });
  app2.all("/api/repositories/:id/download/folder", async (req, res) => {
    try {
      const { id } = req.params;
      const { path: pathParam, folderPath } = req.query;
      const folderPathToUse = pathParam || folderPath;
      if (!folderPathToUse || typeof folderPathToUse !== "string") {
        broadcastLog("ERROR", `Missing folder path parameter. Query params: ${JSON.stringify(req.query)}`);
        return res.status(400).json({ error: "Folder path is required (use 'path' or 'folderPath' query parameter)" });
      }
      const repository = await storage.getRepository(id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      const actualFolderPath = await storage.getFolderPath(id, folderPathToUse);
      if (!actualFolderPath) {
        return res.status(404).json({ error: "Folder not found or cannot be accessed" });
      }
      if (req.method === "HEAD") {
        const path7 = await import("path");
        const folderName2 = path7.basename(folderPathToUse) || "repository";
        const zipFileName2 = `${folderName2}.zip`;
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${zipFileName2}"`);
        return res.status(200).end();
      }
      const archiver = await import("archiver");
      const path6 = await import("path");
      const folderName = path6.basename(folderPathToUse) || "repository";
      const zipFileName = `${folderName}.zip`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);
      broadcastLog("INFO", `Folder download started: ${folderName}`);
      const archive = archiver.default("zip", {
        zlib: { level: 6 }
        // Compression level
      });
      archive.on("error", (err) => {
        broadcastLog("ERROR", `Archive error: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: "Archive creation failed" });
        }
      });
      archive.on("progress", (progress) => {
      });
      archive.pipe(res);
      archive.directory(actualFolderPath, false);
      await archive.finalize();
      broadcastLog("INFO", `Folder download completed: ${zipFileName}`);
    } catch (error) {
      broadcastLog("ERROR", `Folder download error: ${error instanceof Error ? error.message : "Unknown error"}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Folder download failed" });
      }
    }
  });
  app2.all("/api/repositories/:id/download/repository", async (req, res) => {
    try {
      const { id } = req.params;
      const repository = await storage.getRepository(id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }
      const repoPath = await storage.getRepositoryPath(id);
      if (!repoPath) {
        return res.status(404).json({ error: "Repository not found or cannot be accessed" });
      }
      if (req.method === "HEAD") {
        const repoName2 = repository.name.replace(/[^a-zA-Z0-9-_]/g, "_") || "repository";
        const zipFileName2 = `${repoName2}.zip`;
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${zipFileName2}"`);
        return res.status(200).end();
      }
      const archiver = await import("archiver");
      const path6 = await import("path");
      const repoName = repository.name.replace(/[^a-zA-Z0-9-_]/g, "_") || "repository";
      const zipFileName = `${repoName}.zip`;
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Disposition", `attachment; filename="${zipFileName}"`);
      broadcastLog("INFO", `Complete repository download started: ${repository.name}`);
      const archive = archiver.default("zip", {
        zlib: { level: 6 }
        // Compression level
      });
      archive.on("error", (err) => {
        broadcastLog("ERROR", `Archive error: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: "Archive creation failed" });
        }
      });
      archive.on("progress", (progress) => {
      });
      archive.pipe(res);
      archive.directory(repoPath, false, (entry) => {
        if (entry.name.startsWith(".git")) {
          return false;
        }
        return entry;
      });
      await archive.finalize();
      broadcastLog("INFO", `Complete repository download completed: ${zipFileName}`);
    } catch (error) {
      broadcastLog("ERROR", `Repository download error: ${error instanceof Error ? error.message : "Unknown error"}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Repository download failed" });
      }
    }
  });
  const httpServer = createServer(app2);
  broadcastLog("INFO", "Git Repository Analyzer server started");
  return httpServer;
}
var oauthCredentials, getOauthConfig, OAUTH_CONFIG;
var init_routes = __esm({
  "server/routes.ts"() {
    "use strict";
    init_storage();
    init_gitProviders();
    init_openaiService();
    init_reportBuilder();
    init_enhancedTechnologyDetection();
    oauthCredentials = /* @__PURE__ */ new Map();
    getOauthConfig = () => {
      return {
        github: {
          clientId: oauthCredentials.get("github")?.clientId || process.env.GITHUB_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("github")?.clientSecret || process.env.GITHUB_CLIENT_SECRET || "",
          scope: oauthCredentials.get("github")?.scope || "user:email public_repo",
          authorizeUrl: "https://github.com/login/oauth/authorize",
          tokenUrl: "https://github.com/login/oauth/access_token",
          userUrl: "https://api.github.com/user"
        },
        gitlab: {
          clientId: oauthCredentials.get("gitlab")?.clientId || process.env.GITLAB_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("gitlab")?.clientSecret || process.env.GITLAB_CLIENT_SECRET || "",
          scope: (() => {
            const storedScope = oauthCredentials.get("gitlab")?.scope;
            const finalScope = storedScope || "api";
            return finalScope;
          })(),
          authorizeUrl: "https://gitlab.com/oauth/authorize",
          tokenUrl: "https://gitlab.com/oauth/token",
          userUrl: "https://gitlab.com/api/v4/user"
        },
        azure: {
          clientId: oauthCredentials.get("azure")?.clientId || process.env.AZURE_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("azure")?.clientSecret || process.env.AZURE_CLIENT_SECRET || "",
          scope: oauthCredentials.get("azure")?.scope || "vso.code,vso.identity",
          authorizeUrl: "https://app.vssps.visualstudio.com/oauth2/authorize",
          tokenUrl: "https://app.vssps.visualstudio.com/oauth2/token",
          userUrl: "https://app.vssps.visualstudio.com/_apis/profile/profiles/me"
        },
        bitbucket: {
          clientId: oauthCredentials.get("bitbucket")?.clientId || process.env.BITBUCKET_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("bitbucket")?.clientSecret || process.env.BITBUCKET_CLIENT_SECRET || "",
          scope: oauthCredentials.get("bitbucket")?.scope || "repositories:read,account:read",
          authorizeUrl: "https://bitbucket.org/site/oauth2/authorize",
          tokenUrl: "https://bitbucket.org/site/oauth2/access_token",
          userUrl: "https://api.bitbucket.org/2.0/user"
        },
        gitea: {
          clientId: oauthCredentials.get("gitea")?.clientId || process.env.GITEA_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("gitea")?.clientSecret || process.env.GITEA_CLIENT_SECRET || "",
          scope: oauthCredentials.get("gitea")?.scope || "read:user,read:repository",
          authorizeUrl: "https://gitea.instance.com/login/oauth/authorize",
          // Placeholder - needs instance-specific config
          tokenUrl: "https://gitea.instance.com/login/oauth/access_token",
          // Placeholder - needs instance-specific config
          userUrl: "https://gitea.instance.com/api/v1/user"
          // Placeholder - needs instance-specific config
        },
        codeberg: {
          clientId: oauthCredentials.get("codeberg")?.clientId || process.env.CODEBERG_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("codeberg")?.clientSecret || process.env.CODEBERG_CLIENT_SECRET || "",
          scope: oauthCredentials.get("codeberg")?.scope || "read:user,read:repository",
          authorizeUrl: "https://codeberg.org/login/oauth/authorize",
          tokenUrl: "https://codeberg.org/login/oauth/access_token",
          userUrl: "https://codeberg.org/api/v1/user"
        },
        sourcehut: {
          clientId: oauthCredentials.get("sourcehut")?.clientId || process.env.SOURCEHUT_CLIENT_ID || "",
          clientSecret: oauthCredentials.get("sourcehut")?.clientSecret || process.env.SOURCEHUT_CLIENT_SECRET || "",
          scope: oauthCredentials.get("sourcehut")?.scope || "profile,repositories",
          authorizeUrl: "https://meta.sr.ht/oauth/authorize",
          tokenUrl: "https://meta.sr.ht/oauth/token",
          userUrl: "https://meta.sr.ht/api/user/profile"
        }
      };
    };
    OAUTH_CONFIG = getOauthConfig();
  }
});

// server/index.ts
init_routes();
import express2 from "express";

// server/vite.ts
import express from "express";
import fs4 from "fs";
import path5 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path4 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  resolve: {
    alias: {
      "@": path4.resolve(import.meta.dirname, "client", "src"),
      "@shared": path4.resolve(import.meta.dirname, "shared"),
      "@assets": path4.resolve(import.meta.dirname, "attached_assets")
    }
  },
  root: path4.resolve(import.meta.dirname, "client"),
  build: {
    outDir: path4.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path5.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs4.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path5.resolve(import.meta.dirname, "public");
  if (!fs4.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path5.resolve(distPath, "index.html"));
  });
}

// server/index.ts
var app = express2();
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path6 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path6.startsWith("/api")) {
      let logLine = `${req.method} ${path6} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  const host = process.platform === "win32" ? "127.0.0.1" : "0.0.0.0";
  const options = { port, host };
  if (process.platform !== "win32") {
    options.reusePort = true;
  }
  server.listen(options, () => {
    log(`serving on http://${host}:${port}`);
  });
})();
