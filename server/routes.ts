import type { Express } from "express";
import type { Application, Request } from 'express';
import { createServer, type Server } from "http";
import session from "express-session";
import { Provider, OAuthAccountPublic, AccountsResponse } from "@shared/schema";
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const scriptPath = path.join(__dirname, '../scripts/default.py');

// Multi-account session types
interface OAuthAccount {
  id: string;
  provider: Provider;
  providerUserId: string;
  username: string;
  displayName: string;
  email?: string;
  avatarUrl?: string;
  accessToken: string;
  refreshToken?: string;
  scopes: string[];
  connectedAt: Date;
}

// Legacy auth format for backward compatibility
interface LegacyAuth {
  username: string;
  provider: string;
  token: string;
}

// Extend session data to include our custom fields
declare module 'express-session' {
  interface SessionData {
    // OAuth flow state
    oauthProvider?: string;
    oauthState?: string;
    
    // Multi-account data
    accounts?: Record<string, OAuthAccount>;
    activeAccountId?: string;
    
    // Legacy auth data for backward compatibility
    auth?: LegacyAuth;
  }
}

// Helper functions for multi-account support
function getActiveAccount(req: Express['request']): OAuthAccount | null {
  if (!req.session?.accounts || !req.session.activeAccountId) {
    return null;
  }
  return req.session.accounts[req.session.activeAccountId] || null;
}

function getAllAccounts(req: Express['request']): OAuthAccount[] {
  if (!req.session?.accounts) {
    return [];
  }
  return Object.values(req.session.accounts);
}

function addAccount(req: Express['request'], account: OAuthAccount): void {
  if (!req.session) {
    // Session should exist at this point due to express-session middleware
    // If it doesn't exist, something is wrong with the setup
    throw new Error('Session not available - ensure express-session middleware is configured');
  }
  if (!req.session.accounts) {
    req.session.accounts = {};
  }
  
  // Check for existing account with same provider and providerUserId
  const existingAccountId = Object.keys(req.session.accounts).find(id => {
    const existingAccount = req.session.accounts![id];
    return existingAccount.provider === account.provider && 
           existingAccount.providerUserId === account.providerUserId;
  });
  
  if (existingAccountId) {
    // Update existing account with fresh tokens and info
    req.session.accounts[existingAccountId] = {
      ...req.session.accounts[existingAccountId],
      ...account,
      id: existingAccountId, // Keep the original ID
      connectedAt: new Date() // Update connection time
    };
    
    // Set as active account since user just signed in
    req.session.activeAccountId = existingAccountId;
  } else {
    // Add new account
    req.session.accounts[account.id] = account;
    
    // Set as active if it's the first account
    if (!req.session.activeAccountId) {
      req.session.activeAccountId = account.id;
    }
  }
}

function removeAccount(req: Express['request'], accountId: string): boolean {
  if (!req.session?.accounts || !req.session.accounts[accountId]) {
    return false;
  }
  
  delete req.session.accounts[accountId];
  
  // If this was the active account, switch to another one or clear
  if (req.session.activeAccountId === accountId) {
    const remainingAccounts = Object.keys(req.session.accounts);
    req.session.activeAccountId = remainingAccounts.length > 0 ? remainingAccounts[0] : undefined;
  }
  
  return true;
}

function switchActiveAccount(req: Express['request'], accountId: string): boolean {
  if (!req.session?.accounts || !req.session.accounts[accountId]) {
    return false;
  }
  
  req.session.activeAccountId = accountId;
  return true;
}

function accountToPublic(account: OAuthAccount): OAuthAccountPublic {
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
import { storage } from "./storage";
import { gitProviders, detectProvider } from "./services/gitProviders";
import { openaiService } from "./services/openaiService";
import { ReportBuilder, type ExportFormat } from "./services/reportBuilder";
import { pythonScriptService } from "./services/pythonScriptService";
import { enhancedTechnologyDetectionService } from "./services/enhancedTechnologyDetection";
import { insertRepositorySchema, insertAnalysisReportSchema, insertAISettingsSchema, AuthCredentials, AnalysisRequest } from "@shared/schema";
import { z } from "zod";
import { randomUUID } from "crypto";
import { url } from "inspector";

// In-memory OAuth credential storage
const oauthCredentials = new Map<string, { clientId: string; clientSecret: string; scope?: string; enabled?: boolean }>();

// Function to get OAuth config with fallback to environment variables
const getOauthConfig = () => {
  return {
    github: {
      clientId: oauthCredentials.get('github')?.clientId || process.env.GITHUB_CLIENT_ID || '',
      clientSecret: oauthCredentials.get('github')?.clientSecret || process.env.GITHUB_CLIENT_SECRET || '',
      scope: oauthCredentials.get('github')?.scope || 'user:email public_repo',
      authorizeUrl: 'https://github.com/login/oauth/authorize',
      tokenUrl: 'https://github.com/login/oauth/access_token',
      userUrl: 'https://api.github.com/user'
    },
    gitlab: {
      clientId: oauthCredentials.get('gitlab')?.clientId || process.env.GITLAB_CLIENT_ID || '',
      clientSecret: oauthCredentials.get('gitlab')?.clientSecret || process.env.GITLAB_CLIENT_SECRET || '',
      scope: (() => {
        const storedScope = oauthCredentials.get('gitlab')?.scope;
        const finalScope = storedScope || 'api';
        return finalScope;
      })(),
      authorizeUrl: 'https://gitlab.com/oauth/authorize',
      tokenUrl: 'https://gitlab.com/oauth/token',
      userUrl: 'https://gitlab.com/api/v4/user'
    },
    azure: {
      clientId: oauthCredentials.get('azure')?.clientId || process.env.AZURE_CLIENT_ID || '',
      clientSecret: oauthCredentials.get('azure')?.clientSecret || process.env.AZURE_CLIENT_SECRET || '',
      scope: oauthCredentials.get('azure')?.scope || 'vso.code,vso.identity',
      authorizeUrl: 'https://app.vssps.visualstudio.com/oauth2/authorize',
      tokenUrl: 'https://app.vssps.visualstudio.com/oauth2/token',
      userUrl: 'https://app.vssps.visualstudio.com/_apis/profile/profiles/me'
    },
    bitbucket: {
      clientId: oauthCredentials.get('bitbucket')?.clientId || process.env.BITBUCKET_CLIENT_ID || '',
      clientSecret: oauthCredentials.get('bitbucket')?.clientSecret || process.env.BITBUCKET_CLIENT_SECRET || '',
      scope: oauthCredentials.get('bitbucket')?.scope || 'repositories:read,account:read',
      authorizeUrl: 'https://bitbucket.org/site/oauth2/authorize',
      tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
      userUrl: 'https://api.bitbucket.org/2.0/user'
    },
    gitea: {
      clientId: oauthCredentials.get('gitea')?.clientId || process.env.GITEA_CLIENT_ID || '',
      clientSecret: oauthCredentials.get('gitea')?.clientSecret || process.env.GITEA_CLIENT_SECRET || '',
      scope: oauthCredentials.get('gitea')?.scope || 'read:user,read:repository',
      authorizeUrl: 'https://gitea.instance.com/login/oauth/authorize', // Placeholder - needs instance-specific config
      tokenUrl: 'https://gitea.instance.com/login/oauth/access_token', // Placeholder - needs instance-specific config
      userUrl: 'https://gitea.instance.com/api/v1/user' // Placeholder - needs instance-specific config
    },
    codeberg: {
      clientId: oauthCredentials.get('codeberg')?.clientId || process.env.CODEBERG_CLIENT_ID || '',
      clientSecret: oauthCredentials.get('codeberg')?.clientSecret || process.env.CODEBERG_CLIENT_SECRET || '',
      scope: oauthCredentials.get('codeberg')?.scope || 'read:user,read:repository',
      authorizeUrl: 'https://codeberg.org/login/oauth/authorize',
      tokenUrl: 'https://codeberg.org/login/oauth/access_token',
      userUrl: 'https://codeberg.org/api/v1/user'
    },
    sourcehut: {
      clientId: oauthCredentials.get('sourcehut')?.clientId || process.env.SOURCEHUT_CLIENT_ID || '',
      clientSecret: oauthCredentials.get('sourcehut')?.clientSecret || process.env.SOURCEHUT_CLIENT_SECRET || '',
      scope: oauthCredentials.get('sourcehut')?.scope || 'profile,repositories',
      authorizeUrl: 'https://meta.sr.ht/oauth/authorize',
      tokenUrl: 'https://meta.sr.ht/oauth/token',
      userUrl: 'https://meta.sr.ht/api/user/profile'
    }
  };
};

// OAuth Configuration (now dynamically generated)
const OAUTH_CONFIG = getOauthConfig();

// Logging service
export interface LogMessage {
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
}

export function broadcastLog(level: LogMessage['level'], message: string) {
  // Production logging would go here - console.log removed for production
}

export async function registerRoutes(app: Application): Promise<Server> {
  
  // Trust proxy for proper cookie handling
  app.set('trust proxy', 1);
  
  // Configure express-session middleware
  // WARNING: Using MemoryStore for development only - not suitable for production
  if (process.env.NODE_ENV === 'production') {
    console.warn('[WARNING] Using MemoryStore in production is not recommended. Consider using Redis or another persistent session store.');
  }
  
  app.use(session({
    secret: process.env.SESSION_SECRET || 'dev-secret-change-in-production',
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 24 * 60 * 60 * 1000 // 24 hours
    }
  }));

  // Dev-only mock authentication for testing
  if (process.env.NODE_ENV === 'development') {
    app.post("/api/auth/dev-login", (req, res) => {
      try {
        const { provider = 'github', username = 'TestUser' } = req.body;
        
        const mockAccount: OAuthAccount = {
          id: randomUUID(),
          provider: provider as any,
          providerUserId: 'mock-123',
          username,
          displayName: username,
          email: `${username}@example.com`,
          avatarUrl: '',
          accessToken: 'mock-token',
          refreshToken: undefined,
          scopes: ['read'],
          connectedAt: new Date()
        };
        
        addAccount(req, mockAccount);
        
        res.json({
          success: true,
          accountId: mockAccount.id,
          username: mockAccount.username,
          provider: mockAccount.provider,
          accounts: getAllAccounts(req).map(accountToPublic),
          activeAccountId: req.session?.activeAccountId
        });
      } catch (error) {
        console.error('[Dev Login] Error:', error);
        res.status(500).json({ error: 'Dev login failed' });
      }
    });
  }

  // Admin OAuth configuration endpoints
  app.post("/api/admin/oauth-config", (req, res) => {
    try {
      // Disable caching to prevent 304 responses
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      
      const { github, gitlab, azure, bitbucket, gitea, codeberg, sourcehut } = req.body;
      
      // Store credentials in memory
      if (github?.clientId && github?.clientSecret) {
        // Don't store masked secrets  
        if (github.clientSecret !== '••••••••') {
          oauthCredentials.set('github', { 
            clientId: github.clientId, 
            clientSecret: github.clientSecret,
            scope: github.scope || 'user:email public_repo',
            enabled: github.enabled !== undefined ? github.enabled : true
          });
        } else {
          // Keep existing secret, only update other fields
          const existing = oauthCredentials.get('github');
          if (existing) {
            oauthCredentials.set('github', { 
              ...existing,
              clientId: github.clientId,
              scope: github.scope || 'user:email public_repo',
              enabled: github.enabled !== undefined ? github.enabled : true
            });
          }
        }
      }
      
      if (gitlab?.clientId && gitlab?.clientSecret) {
        // Don't store masked secrets
        if (gitlab.clientSecret !== '••••••••') {
          oauthCredentials.set('gitlab', { 
            clientId: gitlab.clientId, 
            clientSecret: gitlab.clientSecret,
            scope: gitlab.scope || 'api',
            enabled: gitlab.enabled !== undefined ? gitlab.enabled : true
          });
        } else {
          // Keep existing secret, only update other fields
          const existing = oauthCredentials.get('gitlab');
          if (existing) {
            oauthCredentials.set('gitlab', { 
              ...existing,
              clientId: gitlab.clientId,
              scope: gitlab.scope || 'api',
              enabled: gitlab.enabled !== undefined ? gitlab.enabled : true
            });
          }
        }
      }
      
      if (azure?.clientId && azure?.clientSecret) {
        oauthCredentials.set('azure', { 
          clientId: azure.clientId, 
          clientSecret: azure.clientSecret,
          scope: azure.scope || 'vso.code,vso.identity',
          enabled: azure.enabled !== undefined ? azure.enabled : true
        });
      }
      
      if (bitbucket?.clientId && bitbucket?.clientSecret) {
        oauthCredentials.set('bitbucket', { 
          clientId: bitbucket.clientId, 
          clientSecret: bitbucket.clientSecret,
          scope: bitbucket.scope || 'repositories:read,account:read',
          enabled: bitbucket.enabled !== undefined ? bitbucket.enabled : true
        });
      }
      
      if (gitea?.clientId && gitea?.clientSecret) {
        oauthCredentials.set('gitea', { 
          clientId: gitea.clientId, 
          clientSecret: gitea.clientSecret,
          scope: gitea.scope || 'read:user,read:repository',
          enabled: gitea.enabled !== undefined ? gitea.enabled : true
        });
      }
      
      if (codeberg?.clientId && codeberg?.clientSecret) {
        oauthCredentials.set('codeberg', { 
          clientId: codeberg.clientId, 
          clientSecret: codeberg.clientSecret,
          scope: codeberg.scope || 'read:user,read:repository',
          enabled: codeberg.enabled !== undefined ? codeberg.enabled : true
        });
      }
      
      if (sourcehut?.clientId && sourcehut?.clientSecret) {
        oauthCredentials.set('sourcehut', { 
          clientId: sourcehut.clientId, 
          clientSecret: sourcehut.clientSecret,
          scope: sourcehut.scope || 'profile,repositories',
          enabled: sourcehut.enabled !== undefined ? sourcehut.enabled : true
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

  app.get("/api/admin/oauth-config", (req, res) => {
    try {
      // Disable caching to prevent 304 responses and JSON parsing errors
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('ETag', ''); // Remove etag
      
      // Return current config without exposing secrets
      const config = {
        github: {
          clientId: oauthCredentials.get('github')?.clientId || process.env.GITHUB_CLIENT_ID || '',
          clientSecret: oauthCredentials.get('github')?.clientSecret ? '••••••••' : '',
          scope: oauthCredentials.get('github')?.scope || 'user:email public_repo',
          enabled: oauthCredentials.get('github')?.enabled !== undefined ? oauthCredentials.get('github')?.enabled : true
        },
        gitlab: {
          clientId: oauthCredentials.get('gitlab')?.clientId || process.env.GITLAB_CLIENT_ID || '',
          clientSecret: oauthCredentials.get('gitlab')?.clientSecret ? '••••••••' : '',
          scope: oauthCredentials.get('gitlab')?.scope || 'api',
          enabled: oauthCredentials.get('gitlab')?.enabled !== undefined ? oauthCredentials.get('gitlab')?.enabled : true
        },
        azure: {
          clientId: oauthCredentials.get('azure')?.clientId || process.env.AZURE_CLIENT_ID || '',
          clientSecret: oauthCredentials.get('azure')?.clientSecret ? '••••••••' : '',
          scope: oauthCredentials.get('azure')?.scope || 'vso.code,vso.identity',
          enabled: oauthCredentials.get('azure')?.enabled !== undefined ? oauthCredentials.get('azure')?.enabled : true
        },
        bitbucket: {
          clientId: oauthCredentials.get('bitbucket')?.clientId || process.env.BITBUCKET_CLIENT_ID || '',
          clientSecret: oauthCredentials.get('bitbucket')?.clientSecret ? '••••••••' : '',
          scope: oauthCredentials.get('bitbucket')?.scope || 'repositories:read,account:read',
          enabled: oauthCredentials.get('bitbucket')?.enabled !== undefined ? oauthCredentials.get('bitbucket')?.enabled : true
        },
        gitea: {
          clientId: oauthCredentials.get('gitea')?.clientId || process.env.GITEA_CLIENT_ID || '',
          clientSecret: oauthCredentials.get('gitea')?.clientSecret ? '••••••••' : '',
          scope: oauthCredentials.get('gitea')?.scope || 'read:user,read:repository',
          enabled: oauthCredentials.get('gitea')?.enabled !== undefined ? oauthCredentials.get('gitea')?.enabled : true
        },
        codeberg: {
          clientId: oauthCredentials.get('codeberg')?.clientId || process.env.CODEBERG_CLIENT_ID || '',
          clientSecret: oauthCredentials.get('codeberg')?.clientSecret ? '••••••••' : '',
          scope: oauthCredentials.get('codeberg')?.scope || 'read:user,read:repository',
          enabled: oauthCredentials.get('codeberg')?.enabled !== undefined ? oauthCredentials.get('codeberg')?.enabled : true
        },
        sourcehut: {
          clientId: oauthCredentials.get('sourcehut')?.clientId || process.env.SOURCEHUT_CLIENT_ID || '',
          clientSecret: oauthCredentials.get('sourcehut')?.clientSecret ? '••••••••' : '',
          scope: oauthCredentials.get('sourcehut')?.scope || 'profile,repositories',
          enabled: oauthCredentials.get('sourcehut')?.enabled !== undefined ? oauthCredentials.get('sourcehut')?.enabled : true
        }
      };
      
      // Determine status (configured or not)
      const status = {
        github: !!(config.github.clientId && config.github.clientSecret),
        gitlab: !!(config.gitlab.clientId && config.gitlab.clientSecret),
        azure: !!(config.azure.clientId && config.azure.clientSecret),
        bitbucket: !!(config.bitbucket.clientId && config.bitbucket.clientSecret),
        gitea: !!(config.gitea.clientId && config.gitea.clientSecret),
        codeberg: !!(config.codeberg.clientId && config.codeberg.clientSecret),
        sourcehut: !!(config.sourcehut.clientId && config.sourcehut.clientSecret)
      };
      
      // Determine enabled status (configured AND enabled)
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

  // AI Settings configuration endpoints
  app.post("/api/admin/ai-settings", async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      
      // Validate using Zod schema - allow partial input with defaults
      const validationResult = insertAISettingsSchema.omit({}).partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid AI settings data',
          details: validationResult.error.errors
        });
      }
      
      const { apiKey, ...otherSettings } = validationResult.data;
      
      // Ensure apiKey is provided (required field)
      if (!apiKey) {
        return res.status(400).json({ error: 'API key is required' });
      }
      
      const settingsData = { apiKey, ...otherSettings };
      
      // Check if settings exist, update or create accordingly
      const existingSettings = await storage.getAISettings();
      let savedSettings;
      
      if (existingSettings) {
        savedSettings = await storage.updateAISettings(settingsData);
      } else {
        savedSettings = await storage.createAISettings(settingsData);
      }
      
      res.json({ 
        success: true, 
        message: "AI settings saved successfully",
        settings: {
          model: savedSettings?.model,
          apiVersion: savedSettings?.apiVersion,
          apiEndpointUrl: savedSettings?.apiEndpointUrl,
          isEnabled: savedSettings?.isEnabled
        }
      });
    } catch (error) {
      console.error('AI Settings save error:', error);
      res.status(500).json({ 
        error: "Failed to save AI settings" 
      });
    }
  });

  // AI Settings update/toggle endpoint
  app.patch("/api/admin/ai-settings", async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      
      const validationResult = insertAISettingsSchema.omit({}).partial().safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: 'Invalid AI settings data',
          details: validationResult.error.errors
        });
      }
      
      const updatedSettings = await storage.updateAISettings(validationResult.data);
      
      if (!updatedSettings) {
        return res.status(404).json({ error: 'No AI settings found to update' });
      }
      
      res.json({ 
        success: true, 
        message: "AI settings updated successfully",
        settings: {
          model: updatedSettings.model,
          apiVersion: updatedSettings.apiVersion,
          apiEndpointUrl: updatedSettings.apiEndpointUrl,
          isEnabled: updatedSettings.isEnabled
        }
      });
    } catch (error) {
      console.error('AI Settings update error:', error);
      res.status(500).json({ 
        error: "Failed to update AI settings" 
      });
    }
  });

  // AI Settings delete endpoint  
  app.delete("/api/admin/ai-settings", async (req, res) => {
    try {
      const deleted = await storage.deleteAISettings();
      
      if (!deleted) {
        return res.status(404).json({ error: 'No AI settings found to delete' });
      }
      
      res.json({ 
        success: true, 
        message: "AI settings deleted successfully"
      });
    } catch (error) {
      console.error('AI Settings delete error:', error);
      res.status(500).json({ 
        error: "Failed to delete AI settings" 
      });
    }
  });

  app.get("/api/admin/ai-settings", async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.setHeader('ETag', '');
      
      const settings = await storage.getAISettings();
      
      const response = {
        configured: !!settings,
        hasApiKey: !!(settings?.apiKey),
        settings: settings ? {
          model: settings.model,
          apiVersion: settings.apiVersion,
          apiEndpointUrl: settings.apiEndpointUrl,
          isEnabled: settings.isEnabled
        } : {
          model: 'gpt-4',
          apiVersion: '2024-02-15-preview',
          apiEndpointUrl: 'https://api.openai.com/v1/chat/completions',
          isEnabled: false
        }
      };
      
      res.json(response);
    } catch (error) {
      console.error('AI Settings load error:', error);
      res.status(500).json({ 
        error: "Failed to load AI settings" 
      });
    }
  });

  // New endpoint to get only enabled and configured providers
  app.get("/api/auth/providers", (req, res) => {
    try {
      const enabledProviders: string[] = [];
      
      // Check each provider - must be both configured (clientId + clientSecret) and enabled
      const providers = ['github', 'gitlab', 'azure', 'bitbucket', 'gitea', 'codeberg', 'sourcehut'];
      
      for (const provider of providers) {
        const creds = oauthCredentials.get(provider);
        const envClientId = process.env[`${provider.toUpperCase()}_CLIENT_ID`];
        const envClientSecret = process.env[`${provider.toUpperCase()}_CLIENT_SECRET`];
        
        // Check if configured (either from credentials map or environment)
        const clientId = creds?.clientId || envClientId;
        const clientSecret = creds?.clientSecret || envClientSecret;
        const isConfigured = !!(clientId && clientSecret);
        
        // Check if enabled (defaults to true if not explicitly set)
        const isEnabled = creds?.enabled !== undefined ? creds.enabled : true;
        
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

  // Endpoint to get the current dynamic redirect URI for OAuth configuration
  app.get("/api/auth/redirect-uri/:provider", (req, res) => {
    const { provider } = req.params;
    const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
    const host = replitDomain || req.get('host');
    // Use HTTPS for Replit domains, otherwise respect the original protocol
    const protocol = (host && (host.includes('replit.dev') || host.includes('replit.app'))) ? 'https' : req.protocol;
    const redirectUri = `${protocol}://${host}/api/auth/callback/${provider}`;
    
    res.json({
      provider,
      redirectUri,
      currentDomain: replitDomain,
      instructions: `Add this URL to your ${provider} OAuth app's Authorization callback URL field`,
      note: "This URL is now dynamically generated and will update automatically"
    });
  });

  // OAuth redirect endpoints - renamed for multi-account support
  app.get("/api/auth/:provider/start", (req, res) => {
    const { provider } = req.params;
    
    const config = getOauthConfig()[provider as keyof ReturnType<typeof getOauthConfig>];
    
    if (!config) {
      return res.status(400).json({ error: "Unsupported OAuth provider" });
    }

    // Check for missing OAuth configuration components
    const missing = [];
    if (!config.clientId) missing.push('client ID');
    if (!config.clientSecret) missing.push('client secret');  
    if (!config.scope) missing.push('scope');

    if (missing.length > 0) {
      const missingItems = missing.join(', ');
      return res.status(500).json({ 
        error: `${provider.charAt(0).toUpperCase() + provider.slice(1)} OAuth not configured - missing ${missingItems}. Please configure these in Settings.` 
      });
    }

    // Store provider in session for callback
    req.session = req.session || {};
    req.session.oauthProvider = provider;

    // Generate state parameter for security
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    req.session.oauthState = state;

    // Build redirect URI dynamically using Replit environment
    const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
    const host = replitDomain || req.get('host');
    // Use HTTPS for Replit domains, otherwise respect the original protocol
    const protocol = (host && (host.includes('replit.dev') || host.includes('replit.app'))) ? 'https' : req.protocol;
    const redirectUri = `${protocol}://${host}/api/auth/callback/${provider}`;
    
    // Build OAuth URL
    const params = new URLSearchParams({
      client_id: config.clientId,
      redirect_uri: redirectUri,
      scope: config.scope,
      state: state,
      response_type: 'code'
    });

    const authUrl = `${config.authorizeUrl}?${params.toString()}`;
    res.redirect(authUrl);
  });

  // Backward compatibility route - redirect to new endpoint
  app.get("/api/auth/oauth/:provider", (req, res) => {
    const { provider } = req.params;
    // Redirect to new multi-account endpoint
    res.redirect(`/api/auth/${provider}/start`);
  });

  // OAuth callback endpoints
  app.get("/api/auth/callback/:provider", async (req, res) => {
    
    const { provider } = req.params;
    const { code, state } = req.query;
    const config = getOauthConfig()[provider as keyof ReturnType<typeof getOauthConfig>];

    if (!config) {
      console.error(`[OAuth Error] Unsupported provider: ${provider}`);
      return res.status(400).json({ error: "Unsupported OAuth provider" });
    }

    // Verify state parameter
    if (state !== req.session?.oauthState) {
      console.error(`[OAuth Error] State mismatch for ${provider}. Expected: ${req.session?.oauthState}, Got: ${state}`);
      return res.status(400).json({ error: "Invalid state parameter" });
    }

    if (!code) {
      console.error(`[OAuth Error] No authorization code received for ${provider}`);
      return res.status(400).json({ error: "No authorization code received" });
    }

    try {
      // Exchange code for access token
      const replitDomain = process.env.REPLIT_DEV_DOMAIN || process.env.REPLIT_DOMAINS;
      const host = replitDomain || req.get('host');
      // Use HTTPS for Replit domains, otherwise respect the original protocol
      const protocol = (host && (host.includes('replit.dev') || host.includes('replit.app'))) ? 'https' : req.protocol;
      const redirectUri = `${protocol}://${host}/api/auth/callback/${provider}`;
      
      const tokenParams = new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code: code as string,
        redirect_uri: redirectUri
      });

      // GitLab requires grant_type
      if (provider === "gitlab") {
        tokenParams.set("grant_type", "authorization_code");
      }

      const tokenResponse = await fetch(config.tokenUrl, {
        method: 'POST',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: tokenParams.toString()
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok || !tokenData.access_token) {
        throw new Error(tokenData.error_description || `Token exchange failed: ${JSON.stringify(tokenData)}`);
      }

      // Get user info
      const authHeaderValue = provider === "gitlab" ? `Bearer ${tokenData.access_token}` : `token ${tokenData.access_token}`;
      const userResponse = await fetch(config.userUrl, {
        headers: {
          'Authorization': authHeaderValue,
          'Accept': 'application/json',
          'User-Agent': 'Git-Cloner-App'
        }
      });

      const userData = await userResponse.json();

      if (!userResponse.ok) {
        throw new Error('Failed to fetch user data');
      }

      // Create new account for multi-account system
      const accountId = randomUUID();
      const newAccount: OAuthAccount = {
        id: accountId,
        provider: provider as Provider,
        providerUserId: userData.id?.toString() || userData.login || userData.username,
        username: userData.login || userData.username,
        displayName: userData.name || userData.display_name || userData.login || userData.username,
        email: userData.email,
        avatarUrl: userData.avatar_url,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        scopes: config.scope.split(',').map(s => s.trim()),
        connectedAt: new Date()
      };
      
      // Add account to session
      addAccount(req, newAccount);


      // Clean up OAuth session data
      if (req.session) {
        delete req.session.oauthProvider;
        delete req.session.oauthState;
      }

      // Redirect to frontend with success
      res.redirect(`/?auth=success&provider=${provider}&username=${encodeURIComponent(newAccount.username)}&accountId=${accountId}`);

    } catch (error) {
      console.error(`[OAuth Error] Token exchange failed for ${provider}: ${error instanceof Error ? error.message : 'Unknown error'}`, error);
      res.redirect(`/?auth=error&message=${encodeURIComponent(error instanceof Error ? error.message : 'Authentication failed')}`);
    }
  });
  
  // Authentication routes - updated for multi-account support
  app.post("/api/auth/authenticate", async (req, res) => {
    try {
      const { provider, credentials } = req.body;
      
      if (!gitProviders[provider]) {
        return res.status(400).json({ error: "Unsupported provider" });
      }

      const result = await gitProviders[provider].authenticate(credentials as AuthCredentials);
      
      if (result.success) {
        // Create new account for multi-account system
        const accountId = randomUUID();
        const newAccount: OAuthAccount = {
          id: accountId,
          provider: provider as Provider,
          providerUserId: result.username || 'unknown',
          username: result.username || 'unknown',
          displayName: result.username || 'unknown',
          email: undefined,
          avatarUrl: undefined,
          accessToken: result.token || '',
          refreshToken: undefined,
          scopes: ['basic'],
          connectedAt: new Date()
        };
        
        // Add account to session
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

  app.post("/api/auth/logout", (req, res) => {
    try {
      const { accountId } = req.body;
      
      if (accountId) {
        // Logout specific account
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
        // Logout all accounts (full logout)
        if (req.session) {
          req.session.destroy((err: any) => {
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

  app.get("/api/auth/status", (req, res) => {

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
      // Backward compatibility: check old auth format
      const auth = (req.session as any)?.auth;
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

  // New multi-account authentication routes
  app.get("/api/auth/accounts", (req, res) => {
    try {
      const accounts = getAllAccounts(req).map(accountToPublic);
      const response: AccountsResponse = {
        accounts,
        activeAccountId: req.session?.activeAccountId
      };
      res.json(response);
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve accounts" });
    }
  });

  app.post("/api/auth/switch", (req, res) => {
    try {
      const { accountId } = req.body;
      
      if (!accountId || typeof accountId !== 'string') {
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

  app.post("/api/auth/remove", (req, res) => {
    try {
      const { accountId } = req.body;
      
      if (!accountId || typeof accountId !== 'string') {
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

  let repository: any = null; // Declare early
  // Repository routes - CLONE ONLY (separated from analysis)
  app.post("/api/repositories/clone", async (req, res) => {
    try {
      const { url, options } = req.body;
      const provider = detectProvider(url);
      
      if (!provider) {
        return res.status(400).json({ error: "Unsupported repository URL" });
      }

      if (!gitProviders[provider]) {
        return res.status(400).json({ error: "Provider not implemented" });
      }

      // Handle personal account creation for GitHub
      if (options?.personalAccount && req.session?.auth?.provider === 'github') {
        broadcastLog('INFO', '🚀 Personal account repository creation requested');
        
        // Check authentication
        const auth = req.session?.auth;
        if (!auth || auth.provider !== 'github' || !auth.token) {
          broadcastLog('ERROR', 'Personal account creation requires GitHub authentication');
          return res.status(401).json({ 
            error: "Personal account creation requires GitHub authentication. Please sign in with GitHub." 
          });
        }

        // Import GitHub service
        const { githubService } = await import('./services/githubService');
        
        // Create repository in user's personal account
        broadcastLog('INFO', `Creating repository in ${auth.username}'s GitHub account`);
        const createResult = await githubService.createRepositoryInPersonalAccount(
          auth.token,
          url
        );
        
        if (!createResult.success) {
          broadcastLog('ERROR', `Failed to create personal repository: ${createResult.error}`);
          return res.status(500).json({ error: createResult.error });
        }

        // STEP 1: Clone source repository for analysis (regular clone)
        broadcastLog('INFO', 'Cloning source repository for technology detection...');
        const analysisCloneResult = await gitProviders[provider].cloneRepository(url, { mirror: false });
        
        if (!analysisCloneResult.success) {
          broadcastLog('ERROR', `Analysis repository clone failed: ${analysisCloneResult.error}`);
          return res.status(500).json({ error: analysisCloneResult.error });
        }

        // Get file structure and detect technologies from regular clone
        broadcastLog('INFO', 'Analyzing file structure and detecting technologies...');
        const fileStructure = await gitProviders[provider].getFileStructure(analysisCloneResult.localPath!);
        const detectedTechnologies = await enhancedTechnologyDetectionService.detectTechnologies(analysisCloneResult.localPath!);
        broadcastLog('INFO', `Technology detection completed. Found ${detectedTechnologies.length} technologies`);

        // STEP 2: Clone source repository for pushing (mirror clone)
        broadcastLog('INFO', 'Creating mirror clone for pushing to personal repository...');
        const mirrorCloneResult = await gitProviders[provider].cloneRepository(url, { mirror: true });
        
        if (!mirrorCloneResult.success) {
          broadcastLog('ERROR', `Mirror repository clone failed: ${mirrorCloneResult.error}`);
          return res.status(500).json({ error: mirrorCloneResult.error });
        }

        // Push mirror clone to new personal repository  
        broadcastLog('INFO', 'Pushing mirror clone to personal repository...');
        const pushResult = await githubService.pushToPersonalRepository(
          mirrorCloneResult.localPath!,
          auth.token,
          auth.username,
          createResult.repoName!
        );

        if (!pushResult.success) {
          broadcastLog('ERROR', `Failed to push to personal repository: ${pushResult.error}`);
          return res.status(500).json({ error: pushResult.error });
        }

        // Create repository record with new URL - CLONE STATUS = CLONED
        repository = await storage.createRepository({
          name: createResult.repoName!,
          url,
          provider,
          clonedUrl: createResult.repoUrl!, // Use the new personal repo URL
          localPath: analysisCloneResult.localPath!, // Store the analysis clone path
          cloneStatus: 'cloned', // Set status to cloned
          fileStructure,
          detectedTechnologies
        });

        broadcastLog('INFO', `🎉 SUCCESS! Repository created and pushed to: ${createResult.repoUrl}`);

        return res.json({
          success: true,
          repository,
          fileStructure,
          detectedTechnologies,
          personalRepoUrl: createResult.repoUrl, // Include the new repo URL in response
          message: `Repository successfully created in your personal account: ${createResult.repoUrl}`
        });
      }

      // Handle personal account creation for GitLab
      if (options?.personalAccount && req.session?.auth?.provider === 'gitlab') {
        broadcastLog('INFO', '🚀 GitLab personal account repository creation requested');
        
        // Check authentication
        const auth = req.session?.auth;
        if (!auth || auth.provider !== 'gitlab' || !auth.token) {
          broadcastLog('ERROR', 'Personal account creation requires GitLab authentication');
          return res.status(401).json({ 
            error: "Personal account creation requires GitLab authentication. Please sign in with GitLab." 
          });
        }

        // Import GitLab service
        const { gitlabService } = await import('./services/gitlabService');
        
        // Create repository in user's personal account
        broadcastLog('INFO', `Creating repository in ${auth.username}'s GitLab account`);
        const createResult = await gitlabService.createRepositoryInPersonalAccount(
          auth.token,
          url
        );
        
        if (!createResult.success) {
          broadcastLog('ERROR', `Failed to create GitLab personal repository: ${createResult.error}`);
          return res.status(500).json({ error: createResult.error });
        }

        // STEP 1: Clone source repository for analysis (regular clone)
        broadcastLog('INFO', 'Cloning source repository for technology detection...');
        const analysisCloneResult = await gitProviders[provider].cloneRepository(url, { mirror: false });
        
        if (!analysisCloneResult.success) {
          broadcastLog('ERROR', `Analysis repository clone failed: ${analysisCloneResult.error}`);
          return res.status(500).json({ error: analysisCloneResult.error });
        }

        // Get file structure and detect technologies from regular clone
        broadcastLog('INFO', 'Analyzing file structure and detecting technologies...');
        const fileStructure = await gitProviders[provider].getFileStructure(analysisCloneResult.localPath!);
        const detectedTechnologies = await enhancedTechnologyDetectionService.detectTechnologies(analysisCloneResult.localPath!);
        broadcastLog('INFO', `Technology detection completed. Found ${detectedTechnologies.length} technologies`);

        // STEP 2: Clone source repository for pushing (mirror clone)
        broadcastLog('INFO', 'Creating mirror clone for pushing to personal repository...');
        const mirrorCloneResult = await gitProviders[provider].cloneRepository(url, { mirror: true });
        
        if (!mirrorCloneResult.success) {
          broadcastLog('ERROR', `Mirror repository clone failed: ${mirrorCloneResult.error}`);
          return res.status(500).json({ error: mirrorCloneResult.error });
        }

        // Push mirror clone to new personal repository  
        broadcastLog('INFO', 'Pushing mirror clone to GitLab personal repository...');
        const pushResult = await gitlabService.pushToPersonalRepository(
          mirrorCloneResult.localPath!,
          auth.token,
          auth.username,
          createResult.repoName!
        );

        if (!pushResult.success) {
          broadcastLog('ERROR', `Failed to push to GitLab personal repository: ${pushResult.error}`);
          return res.status(500).json({ error: pushResult.error });
        }

        // Create repository record with new URL - CLONE STATUS = CLONED
        repository = await storage.createRepository({
          name: createResult.repoName!,
          url,
          provider,
          clonedUrl: createResult.repoUrl!, // Use the new personal repo URL
          localPath: analysisCloneResult.localPath!, // Store the analysis clone path
          cloneStatus: 'cloned', // Set status to cloned
          fileStructure,
          detectedTechnologies
        });

        broadcastLog('INFO', `🎉 SUCCESS! GitLab repository created and pushed to: ${createResult.repoUrl}`);

        return res.json({
          success: true,
          repository,
          fileStructure,
          detectedTechnologies,
          personalRepoUrl: createResult.repoUrl, // Include the new repo URL in response
          message: `Repository successfully created in your GitLab personal account: ${createResult.repoUrl}`
        });
      }

      // Standard cloning (existing logic) - force non-mirror mode for technology detection
      const cloneResult = await gitProviders[provider].cloneRepository(url, { mirror: false });
      
      if (!cloneResult.success) {
        return res.status(500).json({ error: cloneResult.error });
      }

      // Get file structure
      const fileStructure = await gitProviders[provider].getFileStructure(cloneResult.localPath!);

      // Detect technologies immediately after cloning
      broadcastLog('INFO', `Starting technology detection for repository: ${url}`);
      const detectedTechnologies = await enhancedTechnologyDetectionService.detectTechnologies(cloneResult.localPath!);
      broadcastLog('INFO', `Technology detection completed. Found ${detectedTechnologies.length} technologies`);

      // Create repository record - CLONE STATUS = CLONED (no Python script execution)
      repository = await storage.createRepository({
        name: url.split('/').pop()?.replace('.git', '') || 'Unknown',
        url,
        provider,
        clonedUrl: cloneResult.remoteUrl,
        localPath: cloneResult.localPath!, // Store the clone path
        cloneStatus: 'cloned', // Set status to cloned
        fileStructure,
        detectedTechnologies
      });

      // Return response to React frontend - NO PYTHON SCRIPT EXECUTION
      res.json({
        success: true,
        repository,
        fileStructure,
        detectedTechnologies,
        message: "Repository cloned successfully. You can now run analysis from the Code Analysis tab."
      });

    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Clone operation failed" 
      });
    }
  });

  // NEW: Repository status endpoint
  app.get("/api/repositories/:id/status", async (req, res) => {
    try {
      const repository = await storage.getRepository(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      res.json({
        repositoryId: repository.id,
        cloneStatus: repository.cloneStatus || 'pending',
        localPath: repository.localPath,
        lastAnalysisAt: repository.lastAnalysisAt,
        lastReportId: repository.lastReportId
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get repository status" });
    }
  });

  // NEW: Analysis run endpoint (PYTHON SCRIPT ONLY)
  app.post("/api/analysis/run", async (req, res) => {
    try {
      const { repositoryId } = req.body;
      
      if (!repositoryId) {
        return res.status(400).json({ error: "Repository ID is required" });
      }

      const repository = await storage.getRepository(repositoryId);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      // Check if repository is cloned
      if (repository.cloneStatus !== 'cloned') {
        return res.status(400).json({ 
          error: "Repository must be cloned before running analysis. Please clone the repository first." 
        });
      }

      // Check if local path exists
      if (!repository.localPath) {
        return res.status(400).json({ 
          error: "Repository local path not found. Please re-clone the repository." 
        });
      }

      // Execute Python script for migration analysis
      console.log("🔄 Starting Python script execution for migration analysis...");
      broadcastLog('INFO', `Executing Python script for migration analysis: ${repository.name}`);

      try {
        // Fetch AI settings from storage to pass to Python script
        let aiSettings = await storage.getAISettingsForScript();
        
        // CRITICAL FIX: If no AI settings configured, use environment variables
        if (!aiSettings || !aiSettings.apiKey) {
          const epamApiKey = process.env.EPAM_AI_API_KEY;
          if (epamApiKey) {
            broadcastLog('INFO', 'Using EPAM AI API key from environment variable');
            aiSettings = {
              apiKey: epamApiKey,
              model: 'claude-3-5-haiku@20241022', // Default EPAM model
              apiEndpointUrl: 'https://ai-proxy.lab.epam.com/openai/deployments/claude-3-5-haiku@20241022/chat/completions',
              apiVersion: '2024-02-15-preview'
            } as any;
          } else {
            broadcastLog('WARN', 'No EPAM_AI_API_KEY environment variable found');
          }
        }
        
        // Execute Python script
        const pythonResult = await pythonScriptService.executePostCloneScript(
          repository.localPath,
          repository.url,
          repository.id,
          aiSettings
        );

        console.log("🐍 Python script result:", pythonResult);

        // CRITICAL FIX: Check if Python script actually succeeded
        if (!pythonResult.success) {
          console.error("❌ Python script failed:", pythonResult.error);
          
          // CRITICAL FIX: Store the failed analysis attempt for error display
          let failedReportId = undefined;
          try {
            const failedReport = await storage.createAnalysisReport({
              repositoryId: repository.id,
              analysisType: 'migration' as any,
              results: {
                pythonScriptOutput: {
                  exitCode: pythonResult.exitCode || -1,
                  error: pythonResult.error || 'Python script execution failed',
                  stderr: pythonResult.error || 'Migration analysis failed',
                  generatedFiles: [],
                  parsedMigrationData: null
                }
              }
            });
            failedReportId = failedReport.id;
            console.log(`✅ Failed analysis report stored with ID: ${failedReport.id}`);
          } catch (reportError) {
            console.error("❌ Failed to create failure report:", reportError);
          }
          
          // CRITICAL FIX: Update repository with the failed report ID
          await storage.updateRepositoryAnalysis(repository.id, new Date(), failedReportId);
          console.log(`✅ Repository updated with failed report ID: ${failedReportId}`);

          return res.status(500).json({
            success: false,
            error: pythonResult.error || 'Python script execution failed',
            repositoryId: repository.id,
            pythonResult
          });
        }

        // Create Python script report if migration-report.md was generated
        let reportId = undefined;
        if (pythonResult.generatedFiles && pythonResult.generatedFiles.length > 0) {
          console.log("💾 Creating Python script report...");
          
          try {
            await pythonScriptService.createPythonScriptReport(
              repository.id,
              repository.url,
              repository.localPath,
              pythonResult,
              path.join(__dirname, '../scripts/default.py')
            );
            // Note: createPythonScriptReport doesn't return a report ID
            // The report is created and stored internally
          } catch (reportError) {
            console.warn("Failed to create Python script report:", reportError);
          }
          console.log("📊 Python script report created - will appear in Reports tab");
        }

        // Update repository with analysis timestamp and report ID
        await storage.updateRepositoryAnalysis(repository.id, new Date(), reportId);

        // Return structured migration data AND success info
        res.json({
          success: true,
          repositoryId: repository.id,
          pythonResult,
          reportId,
          message: "Migration analysis completed successfully",
          structuredData: (pythonResult as any).parsedMigrationData // Include parsed structured data
        });

      } catch (pythonError) {
        console.error("❌ Python script execution failed:", pythonError);
        const errorMessage = pythonError instanceof Error ? pythonError.message : 'Migration analysis failed';
        
        // CRITICAL FIX: Always persist failed analysis attempts
        try {
          const failedReport = await storage.createAnalysisReport({
            repositoryId: repository.id,
            analysisType: 'migration' as any,
            results: {
              pythonScriptOutput: {
                exitCode: -1,
                error: errorMessage,
                stderr: `Python script execution failed: ${errorMessage}`,
                generatedFiles: [],
                parsedMigrationData: null
              }
            }
          });
          
          // Update repository to point to this failed report
          await storage.updateRepositoryAnalysis(repository.id, new Date(), failedReport.id);
          
          broadcastLog('INFO', `Failed analysis report stored with ID: ${failedReport.id}`);
        } catch (storageError) {
          broadcastLog('ERROR', `Failed to store error report: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`);
        }
        
        res.status(500).json({
          error: errorMessage
        });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Analysis operation failed";
      
      // CRITICAL FIX: Store failed analysis for general route errors too
      if (req.body.repositoryId) {
        try {
          const failedReport = await storage.createAnalysisReport({
            repositoryId: req.body.repositoryId,
            analysisType: 'migration' as any,
            results: {
              pythonScriptOutput: {
                exitCode: -1,
                error: errorMessage,
                stderr: `Analysis route failed: ${errorMessage}`,
                generatedFiles: [],
                parsedMigrationData: null
              }
            }
          });
          
          // Update repository to point to this failed report
          await storage.updateRepositoryAnalysis(req.body.repositoryId, new Date(), failedReport.id);
          
          broadcastLog('INFO', `Failed analysis report stored for route error with ID: ${failedReport.id}`);
        } catch (storageError) {
          broadcastLog('ERROR', `Failed to store route error report: ${storageError instanceof Error ? storageError.message : 'Unknown error'}`);
        }
      }
      
      res.status(500).json({ 
        error: errorMessage
      });
    }
  });

  app.get("/api/repositories/:id/files", async (req, res) => {
    try {
      repository = await storage.getRepository(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      res.json({ fileStructure: repository.fileStructure });
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve file structure" });
    }
  });

  // Get repository technologies
  app.get("/api/technologies/:id", async (req, res) => {
    try {
      repository = await storage.getRepository(req.params.id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      res.json(repository.detectedTechnologies || []);
    } catch (error) {
      console.error('Error fetching repository technologies:', error);
      res.status(500).json({ error: "Failed to fetch repository technologies" });
    }
  });

  app.get("/api/repositories", async (req, res) => {
    try {
      const repositories = await storage.getAllRepositories();
      res.json({ repositories });
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve repositories" });
    }
  });

  // Analysis routes
  app.post("/api/analysis/analyze", async (req, res) => {
    try {
      const analysisRequest = req.body as AnalysisRequest;
      
      repository = await storage.getRepository(analysisRequest.repositoryId);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      // Get the actual repository path from storage
      const repoPath = await storage.getRepositoryPath(analysisRequest.repositoryId);
      if (!repoPath) {
        broadcastLog('ERROR', `Repository path not found for repository ${analysisRequest.repositoryId}`);
        return res.status(404).json({ 
          error: "Repository files not found. The repository may need to be re-cloned." 
        });
      }

      broadcastLog('INFO', `Starting ${analysisRequest.analysisType} analysis for repository ${repository.name}`);
      
      const analysisResult = await openaiService.analyzeRepository(
        analysisRequest, 
        repository.fileStructure as any || [], 
        repoPath
      );

      broadcastLog('INFO', `Analysis completed successfully for repository ${repository.name} - Quality: ${analysisResult.summary.qualityScore}%, Issues: ${analysisResult.issues.length}`);

      // Store analysis result
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
      broadcastLog('ERROR', `Analysis failed for repository ${req.body.repositoryId || 'unknown'}: ${errorMessage}`);
      
      // Provide more specific error messages based on the error type
      if (errorMessage.includes('ENOENT') || errorMessage.includes('not found')) {
        res.status(404).json({ 
          error: "Repository files not found. Please try cloning the repository again." 
        });
      } else if (errorMessage.includes('EPAM_AI_API_KEY') || errorMessage.includes('API key')) {
        res.status(500).json({ 
          error: "Analysis service not configured properly. Please contact administrator." 
        });
      } else if (errorMessage.includes('rate limit') || errorMessage.includes('quota')) {
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

  app.get("/api/analysis/reports/:repositoryId", async (req, res) => {
    try {
      const reports = await storage.getAnalysisReportsByRepository(req.params.repositoryId);
      
      // Also check for generated migration reports in the repository directory
      const repoPath = await storage.getRepositoryPath(req.params.repositoryId);
      const generatedReports: any[] = [];
      
      if (repoPath) {
        try {
          const fs = await import('fs');
          const path = await import('path');
          
          // Look for migration report files
          const files = await fs.promises.readdir(repoPath);
          const migrationReports = files.filter(file => file.startsWith('migration-report-') && file.endsWith('.md'));
          
          for (const reportFile of migrationReports) {
            const filePath = path.join(repoPath, reportFile);
            const stats = await fs.promises.stat(filePath);
            generatedReports.push({
              id: reportFile.replace('.md', ''),
              fileName: reportFile,
              type: 'migration-report',
              createdAt: stats.birthtime,
              size: stats.size
            });
          }
        } catch (error) {
          // Silent fail - if we can't read directory, just return database reports
          console.log('Could not scan for generated reports:', error);
        }
      }
      
      res.json({ 
        reports,
        generatedReports: generatedReports.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to retrieve analysis reports" });
    }
  });

  // Helper function to resolve report file path (shared by download and structured endpoints)
  async function resolveReportFilePath(repositoryId: string, fileName: string): Promise<string | null> {
    const fs = await import('fs');
    const path = await import('path');
    
    const repoPath = await storage.getRepositoryPath(repositoryId);
    if (!repoPath) {
      return null;
    }
    
    const filePath = path.join(repoPath, fileName);
    
    // Ensure file exists and is within the repository directory (security check)
    if (!filePath.startsWith(repoPath) || !await fs.promises.access(filePath).then(() => true).catch(() => false)) {
      return null;
    }
    
    return filePath;
  }

  // Download generated migration report endpoint
  app.get("/api/analysis/reports/:repositoryId/download/:fileName", async (req, res) => {
    try {
      const { repositoryId, fileName } = req.params;
      
      // Validate filename - allow all markdown files for now to debug
      broadcastLog('DEBUG', `Attempting to download file: ${fileName}`);
      if (!fileName.endsWith('.md')) {
        return res.status(400).json({ error: "Only markdown files are allowed" });
      }
      
      const filePath = await resolveReportFilePath(repositoryId, fileName);
      if (!filePath) {
        return res.status(404).json({ error: "Report file not found" });
      }
      
      const fs = await import('fs');
      
      // Read file content
      const fileContent = await fs.promises.readFile(filePath, 'utf-8');
      const stats = await fs.promises.stat(filePath);
      
      // Set download headers
      res.setHeader('Content-Type', 'text/markdown');
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', Buffer.byteLength(fileContent, 'utf-8').toString());
      
      broadcastLog('INFO', `Migration report download: ${fileName} (${stats.size} bytes)`);
      res.send(fileContent);
      
    } catch (error) {
      broadcastLog('ERROR', `Migration report download error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      res.status(500).json({ error: "Report download failed" });
    }
  });

  app.post("/api/analysis/generate-report", async (req, res) => {
    try {
      const { repositoryId } = req.body;
      
      repository = await storage.getRepository(repositoryId);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      const reports = await storage.getAnalysisReportsByRepository(repositoryId);
      const analysisResults = reports.map((r: any) => r.results) as any[];

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

  // Get structured migration data for a repository
  app.get('/api/reports/:repositoryId/structured', async (req, res) => {
    try {
      const { repositoryId } = req.params;
      
      // CRITICAL FIX: First check repository's lastReportId
      const repository = await storage.getRepository(repositoryId);
      
      if (repository?.lastReportId) {
        try {
          const latestReport = await storage.getAnalysisReport(repository.lastReportId);
          if (latestReport) {
            broadcastLog('INFO', `Using repository's lastReportId: ${repository.lastReportId}`);
            
            // Check if it's a failed report
            const pythonOutput = (latestReport.results as any)?.pythonScriptOutput;
            if (pythonOutput?.error || pythonOutput?.exitCode !== 0 || !pythonOutput?.parsedMigrationData) {
              const errorMessage = pythonOutput?.error || 'Analysis failed to generate migration data';
              
              res.json({ 
                structuredData: null,
                status: 'failed',
                error: errorMessage,
                reportId: latestReport.id,
                createdAt: latestReport.createdAt
              });
              return;
            }
            
            // It's a successful report with structured data
            if (pythonOutput?.parsedMigrationData) {
              res.json({
                structuredData: pythonOutput.parsedMigrationData,
                status: 'ready',
                reportId: latestReport.id,
                createdAt: latestReport.createdAt
              });
              return;
            }
          }
        } catch (reportError) {
          broadcastLog('WARN', `Could not fetch report ${repository.lastReportId}: ${reportError instanceof Error ? reportError.message : 'Unknown error'}`);
        }
      }
      
      // Fallback: Get all analysis reports for this repository
      const reports = await storage.getAnalysisReportsByRepository(repositoryId);
      
      if (reports.length === 0) {
        res.json({ structuredData: null, status: 'no_analysis' });
        return;
      }
      
      // Find the most recent successful report with structured data
      const successfulReport = reports
        .filter(report => report.results && (report.results as any).pythonScriptOutput?.generatedFiles && (report.results as any).pythonScriptOutput.parsedMigrationData)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
      
      // Find the most recent report with pythonScriptOutput (successful or failed)
      const latestReportWithPythonOutput = reports
        .filter(report => report.results && (report.results as any).pythonScriptOutput)
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
        
      // Find the most recent report overall  
      const latestReport = reports
        .sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime())[0];
      
      // If we have a successful report, return its data
      if (successfulReport) {
        const pythonOutput = (successfulReport.results as any).pythonScriptOutput;
        const markdownFile = pythonOutput.generatedFiles.find((file: any) => file.name.endsWith('.md'));
        
        if (markdownFile) {
          // Use same path resolution as download route
          const filePath = await resolveReportFilePath(repositoryId, markdownFile.name);
          if (filePath) {
            // Get structured data from Python script output (already parsed during analysis)
            const structuredData = pythonOutput.parsedMigrationData;
            
            // CRITICAL FIX: Don't return success if no structured data was parsed
            if (!structuredData) {
              broadcastLog('WARN', `Analysis completed but no structured data was parsed for repository ${repositoryId}`);
              
              res.json({ 
                structuredData: null,
                status: 'failed',
                error: 'Analysis completed but failed to parse migration data from generated report',
                reportId: successfulReport.id,
                createdAt: successfulReport.createdAt
              });
              return;
            }
            
            broadcastLog('INFO', `Serving structured migration data for repository ${repositoryId}: Data found`);
            
            res.json({ 
              structuredData,
              reportId: successfulReport.id,
              createdAt: successfulReport.createdAt,
              status: 'success'
            });
            return;
          }
        }
        
        // If we reach here, successful report exists but files are missing - this is a failure
        broadcastLog('WARN', `Report exists but files are missing for repository ${repositoryId}`);
        res.json({ 
          structuredData: null,
          status: 'failed',
          error: 'Report files are missing or inaccessible',
          reportId: successfulReport.id,
          createdAt: successfulReport.createdAt
        });
        return;
      }
      
      // If no successful report, check if we have failed attempts
      if (!successfulReport) {
        // Check the latest report with Python output first (most specific failure)
        if (latestReportWithPythonOutput) {
          const pythonOutput = (latestReportWithPythonOutput.results as any).pythonScriptOutput;
          let errorMessage = 'Analysis failed';
          
          // Use Python script error if available
          if (pythonOutput.error) {
            errorMessage = `Python script execution failed: ${pythonOutput.error}`;
          }
          // Check for AI/analysis failure (pythonScriptOutput exists but no parsedMigrationData)
          else if (!pythonOutput.parsedMigrationData) {
            errorMessage = 'AI analysis failed to generate migration data';
          }
          // Check for file generation failure (no generated files)
          else if (!pythonOutput.generatedFiles?.length) {
            errorMessage = 'Failed to generate migration report files';
          }
          
          broadcastLog('WARN', `Analysis failure detected for repository ${repositoryId}: ${errorMessage}`);
          
          res.json({ 
            structuredData: null,
            status: 'failed',
            error: errorMessage,
            reportId: latestReportWithPythonOutput.id,
            createdAt: latestReportWithPythonOutput.createdAt
          });
          return;
        }
        
        // Check if we have any reports at all but no Python output (generic failure)
        if (latestReport) {
          broadcastLog('WARN', `Analysis attempt without Python output for repository ${repositoryId}`);
          
          res.json({ 
            structuredData: null,
            status: 'failed',
            error: 'Analysis failed - Python script did not execute properly',
            reportId: latestReport.id,
            createdAt: latestReport.createdAt
          });
          return;
        }
      }
      
      // No reports at all
      res.json({ structuredData: null, status: 'no_analysis' });
      
    } catch (error) {
      console.error('Error fetching structured migration data:', error);
      res.status(500).json({ error: 'Failed to fetch structured migration data' });
    }
  });

  // Export report in various formats
  app.get("/api/reports/:id/export", async (req, res) => {
    try {
      const { id } = req.params;
      const { format } = req.query;
      
      // Validate format
      if (!format || typeof format !== 'string') {
        return res.status(400).json({ error: "Format parameter is required" });
      }
      
      const validFormats: ExportFormat[] = ['pdf', 'xlsx', 'docx'];
      if (!validFormats.includes(format as ExportFormat)) {
        return res.status(400).json({ 
          error: `Invalid format. Supported formats: ${validFormats.join(', ')}` 
        });
      }

      // Get analysis report
      const analysisReport = await storage.getAnalysisReport(id);
      if (!analysisReport) {
        return res.status(404).json({ error: "Analysis report not found" });
      }

      // Get repository information
      if (!analysisReport.repositoryId) {
        return res.status(400).json({ error: "Analysis report has no associated repository" });
      }
      
      repository = await storage.getRepository(analysisReport.repositoryId);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      // Prepare report data
      const reportData = {
        repository,
        analysisReport,
        analysisResults: analysisReport.results as any
      };

      // Generate report
      const reportBuffer = await ReportBuilder.generateReport(reportData, format as ExportFormat);
      
      // Set response headers
      const contentType = ReportBuilder.getContentType(format as ExportFormat);
      const fileExtension = ReportBuilder.getFileExtension(format as ExportFormat);
      const fileName = `${repository.name}_analysis_report.${fileExtension}`;
      
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', reportBuffer.length);
      
      // Send the report
      res.send(reportBuffer);
      
    } catch (error) {
      res.status(500).json({ 
        error: error instanceof Error ? error.message : "Report export failed" 
      });
    }
  });

  // Provider validation
  app.get("/api/providers/detect", async (req, res) => {
    try {
      const { url } = req.query;
      if (!url || typeof url !== 'string') {
        return res.status(400).json({ error: "URL is required" });
      }

      const provider = detectProvider(url);
      res.json({ provider });
    } catch (error) {
      res.status(500).json({ error: "Provider detection failed" });
    }
  });

  app.get("/api/providers", (req, res) => {
    const providers = Object.keys(gitProviders).map(key => ({
      id: key,
      name: gitProviders[key].name
    }));
    res.json({ providers });
  });

  // Download routes
  app.get("/api/repositories/:id/download/file", async (req, res) => {
    try {
      const { id } = req.params;
      const { filePath } = req.query;

      if (!filePath || typeof filePath !== 'string') {
        return res.status(400).json({ error: "File path is required" });
      }

      // Get repository
      repository = await storage.getRepository(id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      // Get file content
      const fileContent = await storage.getFileContent(id, filePath);
      if (!fileContent) {
        return res.status(404).json({ error: "File not found or cannot be accessed" });
      }

      // Import mime-types for proper content type detection
      const mime = await import('mime-types');
      const path = await import('path');
      
      const fileName = path.basename(filePath);
      const mimeType = mime.lookup(fileName) || 'application/octet-stream';

      // Set appropriate headers for file download
      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
      res.setHeader('Content-Length', fileContent.length.toString());

      broadcastLog('INFO', `File download started: ${fileName} (${fileContent.length} bytes)`);
      res.send(fileContent);
      
    } catch (error) {
      broadcastLog('ERROR', `File download error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      res.status(500).json({ error: "File download failed" });
    }
  });

  // Support both GET and HEAD requests for folder download
  app.all("/api/repositories/:id/download/folder", async (req, res) => {
    try {
      const { id } = req.params;
      // Support both 'path' and 'folderPath' query parameters for compatibility
      const { path: pathParam, folderPath } = req.query;
      const folderPathToUse = pathParam || folderPath;


      if (!folderPathToUse || typeof folderPathToUse !== 'string') {
        broadcastLog('ERROR', `Missing folder path parameter. Query params: ${JSON.stringify(req.query)}`);
        return res.status(400).json({ error: "Folder path is required (use 'path' or 'folderPath' query parameter)" });
      }

      // Get repository
      repository = await storage.getRepository(id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      // Get folder path
      const actualFolderPath = await storage.getFolderPath(id, folderPathToUse);
      if (!actualFolderPath) {
        return res.status(404).json({ error: "Folder not found or cannot be accessed" });
      }

      // For HEAD requests, only return headers (no body)
      if (req.method === 'HEAD') {
        const path = await import('path');
        const folderName = path.basename(folderPathToUse) || 'repository';
        const zipFileName = `${folderName}.zip`;
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        return res.status(200).end();
      }

      // Import required modules
      const archiver = await import('archiver');
      const path = await import('path');
      
      const folderName = path.basename(folderPathToUse) || 'repository';
      const zipFileName = `${folderName}.zip`;

      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

      broadcastLog('INFO', `Folder download started: ${folderName}`);

      // Create archive
      const archive = archiver.default('zip', {
        zlib: { level: 6 } // Compression level
      });

      // Handle archive errors
      archive.on('error', (err: Error) => {
        broadcastLog('ERROR', `Archive error: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Archive creation failed' });
        }
      });

      // Track progress
      archive.on('progress', (progress: any) => {
      });

      // Pipe archive to response
      archive.pipe(res);

      // Add folder contents to archive
      archive.directory(actualFolderPath, false);

      // Finalize the archive
      await archive.finalize();

      broadcastLog('INFO', `Folder download completed: ${zipFileName}`);
      
    } catch (error) {
      broadcastLog('ERROR', `Folder download error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Folder download failed" });
      }
    }
  });

  // Complete repository download endpoint - support both GET and HEAD
  app.all("/api/repositories/:id/download/repository", async (req, res) => {
    try {
      const { id } = req.params;

      // Get repository
      repository = await storage.getRepository(id);
      if (!repository) {
        return res.status(404).json({ error: "Repository not found" });
      }

      // Get repository path
      const repoPath = await storage.getRepositoryPath(id);
      if (!repoPath) {
        return res.status(404).json({ error: "Repository not found or cannot be accessed" });
      }

      // For HEAD requests, only return headers (no body)
      if (req.method === 'HEAD') {
        const repoName = repository.name.replace(/[^a-zA-Z0-9-_]/g, '_') || 'repository';
        const zipFileName = `${repoName}.zip`;
        
        res.setHeader('Content-Type', 'application/zip');
        res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);
        return res.status(200).end();
      }

      // Import required modules
      const archiver = await import('archiver');
      const path = await import('path');
      
      // Create filename based on repository name
      const repoName = repository.name.replace(/[^a-zA-Z0-9-_]/g, '_') || 'repository';
      const zipFileName = `${repoName}.zip`;

      // Set headers for ZIP download
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader('Content-Disposition', `attachment; filename="${zipFileName}"`);

      broadcastLog('INFO', `Complete repository download started: ${repository.name}`);

      // Create archive
      const archive = archiver.default('zip', {
        zlib: { level: 6 } // Compression level
      });

      // Handle archive errors
      archive.on('error', (err: Error) => {
        broadcastLog('ERROR', `Archive error: ${err.message}`);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Archive creation failed' });
        }
      });

      // Track progress
      archive.on('progress', (progress: any) => {
      });

      // Pipe archive to response
      archive.pipe(res);

      // Add entire repository to archive (excluding .git directory for cleaner download)
      archive.directory(repoPath, false, (entry: any) => {
        // Skip .git directory and other hidden files/folders for cleaner download
        if (entry.name.startsWith('.git')) {
          return false;
        }
        return entry;
      });

      // Finalize the archive
      await archive.finalize();

      broadcastLog('INFO', `Complete repository download completed: ${zipFileName}`);
      
    } catch (error) {
      broadcastLog('ERROR', `Repository download error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      if (!res.headersSent) {
        res.status(500).json({ error: "Repository download failed" });
      }
    }
  });

  const httpServer = createServer(app);
  
  // Initial log when server starts
  broadcastLog('INFO', 'Git Repository Analyzer server started');
  
  return httpServer;
}