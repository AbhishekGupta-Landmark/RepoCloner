import { sql } from "drizzle-orm";
import { pgTable, text, varchar, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Multi-account authentication types
export const ProviderEnum = z.enum(['github', 'gitlab', 'azure', 'bitbucket', 'gitea', 'codeberg', 'sourcehut']);
export type Provider = z.infer<typeof ProviderEnum>;

export interface OAuthAccountPublic {
  id: string;
  provider: Provider;
  providerUserId: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  scopes: string[];
  connectedAt: Date;
}

export interface AccountsResponse {
  accounts: OAuthAccountPublic[];
  activeAccountId?: string;
}

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const repositories = pgTable("repositories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  url: text("url").notNull(),
  provider: text("provider").notNull(), // github, gitlab, azure
  clonedUrl: text("cloned_url"),
  localPath: text("local_path"), // Local clone directory path
  cloneStatus: text("clone_status").default("pending"), // pending, cloned, failed
  fileStructure: jsonb("file_structure"),
  detectedTechnologies: jsonb("detected_technologies"), // Technology detection results
  lastAnalysisAt: timestamp("last_analysis_at"),
  lastReportId: varchar("last_report_id"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const analysisReports = pgTable("analysis_reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  repositoryId: varchar("repository_id").references(() => repositories.id),
  analysisType: text("analysis_type").notNull(),
  results: jsonb("results").notNull(),
  structuredData: jsonb("structured_data"), // Parsed structured data from reports
  createdAt: timestamp("created_at").defaultNow(),
});

export const authTokens = pgTable("auth_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token"),
  expiresAt: timestamp("expires_at"),
  userId: varchar("user_id"),
});

export const oauthConfigs = pgTable("oauth_configs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  provider: text("provider").notNull().unique(), // github, gitlab, azure, bitbucket
  clientId: text("client_id").notNull(),
  clientSecret: text("client_secret").notNull(), // Will be encrypted
  scope: text("scope").notNull(),
  authorizeUrl: text("authorize_url").notNull(),
  tokenUrl: text("token_url").notNull(),
  userUrl: text("user_url").notNull(),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// AI configuration settings table
export const aiSettings = pgTable("ai_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  apiKey: text("api_key").notNull(), // Will be encrypted
  model: text("model").notNull().default("gpt-4"),
  apiVersion: text("api_version").notNull().default("2024-02-15-preview"),
  apiEndpointUrl: text("api_endpoint_url").notNull().default("https://api.openai.com/v1/chat/completions"),
  isEnabled: boolean("is_enabled").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Migration report structured data types
export interface KafkaUsageItem {
  file: string;
  apis_used: string;
  summary: string;
}

export interface CodeDiff {
  file: string;
  diff_content: string;
  language: string;
}

export interface MigrationReportData {
  title: string;
  kafka_inventory: KafkaUsageItem[];
  code_diffs: CodeDiff[];
  notes: string[];
  sections: Record<string, any>;
  stats: {
    total_files_with_kafka: number;
    total_files_with_diffs: number;
    notes_count: number;
    sections_count: number;
  };
}

// Insert schemas
export const insertRepositorySchema = createInsertSchema(repositories).omit({
  id: true,
  createdAt: true,
});

export const insertAnalysisReportSchema = createInsertSchema(analysisReports).omit({
  id: true,
  createdAt: true,
});

export const insertAuthTokenSchema = createInsertSchema(authTokens).omit({
  id: true,
});

export const insertOAuthConfigSchema = createInsertSchema(oauthConfigs).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertAISettingsSchema = createInsertSchema(aiSettings).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

// Types
export type InsertRepository = z.infer<typeof insertRepositorySchema>;
export type Repository = typeof repositories.$inferSelect;
export type InsertAnalysisReport = z.infer<typeof insertAnalysisReportSchema>;
export type AnalysisReport = typeof analysisReports.$inferSelect;
export type InsertAuthToken = z.infer<typeof insertAuthTokenSchema>;
export type AuthToken = typeof authTokens.$inferSelect;
export type InsertOAuthConfig = z.infer<typeof insertOAuthConfigSchema>;
export type OAuthConfig = typeof oauthConfigs.$inferSelect;
export type InsertAISettings = z.infer<typeof insertAISettingsSchema>;
export type AISettings = typeof aiSettings.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Git provider types
export interface GitProvider {
  name: string;
  authenticate(credentials: AuthCredentials): Promise<AuthResult>;
  cloneRepository(url: string, options: CloneOptions): Promise<CloneResult>;
  getFileStructure(repoPath: string): Promise<FileNode[]>;
  validateUrl(url: string): boolean;
}

export interface AuthCredentials {
  type: 'oauth' | 'pat';
  token?: string;
  redirectUri?: string;
}

export interface AuthResult {
  success: boolean;
  token?: string;
  username?: string;
  error?: string;
}

export interface CloneOptions {
  mirror?: boolean;
  lfs?: boolean;
  personalAccount?: boolean;
  targetAccount?: string;
}

export interface CloneResult {
  success: boolean;
  localPath?: string;
  remoteUrl?: string;
  error?: string;
}

export interface FileNode {
  name: string;
  type: 'file' | 'directory';
  path: string;
  size?: number;
  children?: FileNode[];
}

export interface AnalysisRequest {
  repositoryId: string;
  analysisType: 'quality' | 'security' | 'performance' | 'documentation' | 'architecture' | 'migration';
  depth: 'surface' | 'detailed' | 'deep';
  migrationDepth?: 'basic'; // Only available for migration analysis
}

// Technology detection types
export type TechnologyCategory = 
  | 'frontend' 
  | 'backend' 
  | 'database' 
  | 'cloud' 
  | 'testing' 
  | 'devops' 
  | 'security' 
  | 'monitoring' 
  | 'utilities' 
  | 'documentation';

export interface TechnologyDetection {
  category: TechnologyCategory;
  name: string;
  version?: string;
  confidence: number;
  icon?: string;
  description?: string;
  metadata?: any;
  // Evidence fields for detailed technology information
  evidenceFiles?: string[]; // File paths where technology was detected
  manifest?: { // Package.json/requirements.txt/etc info
    file: string;
    dependency?: string;
    versionSpec?: string;
  };
  configFiles?: string[]; // Actual config files found like tsconfig.json, tailwind.config.js
  scripts?: { // Package.json scripts mentioning the tech
    file: string;
    names: string[];
  }[];
  lockfile?: 'npm' | 'yarn' | 'pnpm' | null; // Package manager detected
  ciFiles?: string[]; // CI/CD files like .github/workflows/*.yml
}

export interface AnalysisResult {
  summary: {
    qualityScore?: number;
    securityScore?: number;
    maintainabilityScore?: number;
  };
  issues: AnalysisIssue[];
  recommendations: string[];
  metrics: Record<string, any>;
  technologies: TechnologyDetection[];
}

export interface AnalysisIssue {
  severity: 'low' | 'medium' | 'high' | 'critical';
  type: string;
  description: string;
  file?: string;
  line?: number;
  suggestion?: string;
}

export interface GeneratedFile {
  name: string;
  path: string;
  size: number;
  relativePath: string;
  content?: string;
  type?: string;
  mimeType?: string;
  createdAt: Date | string;
}

export interface PythonScriptResult {
  success: boolean;
  output: string;
  error?: string;
  exitCode: number;
  executionTime: number;
  executedAt: string;           // Add this
  scriptPath: string;           // Add this
  repositoryUrl: string;        // Add this
  repositoryPath: string;
  generatedFiles: GeneratedFile[];
  pythonScriptOutput?: {
    stdout: string;
    stderr: string;
    generatedFiles: GeneratedFile[];
  };
  parsedMigrationData?: ParsedMigrationReport; // For migration analysis type
}

// Migration report parsing types
export interface ParsedMigrationReport {
  title: string;
  kafkaInventory: KafkaUsageItem[];
  codeDiffs: CodeDiff[];
  sections: Record<string, any>;
  stats: {
    totalFilesWithKafka: number;
    totalFilesWithDiffs: number;
    sectionsCount: number;
  };
}

export interface KafkaUsageItem {
  file: string;
  apisUsed: string;
  summary: string;
}

export interface CodeDiff {
  file: string;
  diffContent: string;
  language: string;
}
