import { broadcastLog } from '../utils/logger';
import { GeneratedFile, PythonScriptResult } from '@shared/schema';

export interface ApiAnalysisResult {
  success: boolean;
  output?: string;
  error?: string;
  exitCode?: number;
  generatedFiles?: GeneratedFile[];
  executionStartTime?: number;
  executionEndTime?: number;
  parsedMigrationData?: any;
}

export interface ApiAnalysisOptions {
  repositoryUrl: string;
  repositoryPath: string;
  repositoryId?: string;
  analysisType?: string;
  timeout?: number;
}

// Simple in-memory cache with TTL
interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class ApiAnalysisCache {
  private cache = new Map<string, CacheEntry>();
  private readonly defaultTTL = 60 * 60 * 1000; // 1 hour in milliseconds

  private generateKey(repositoryUrl: string, analysisType: string): string {
    return `${repositoryUrl}:${analysisType}`;
  }

  get(repositoryUrl: string, analysisType: string = 'default'): any | null {
    const key = this.generateKey(repositoryUrl, analysisType);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    // Check if entry has expired
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    broadcastLog('INFO', `📦 Cache HIT for ${repositoryUrl} (${analysisType})`);
    return entry.data;
  }

  set(repositoryUrl: string, analysisType: string = 'default', data: any, ttl?: number): void {
    const key = this.generateKey(repositoryUrl, analysisType);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL
    });
    broadcastLog('INFO', `📦 Cache SET for ${repositoryUrl} (${analysisType})`);
  }

  clear(): void {
    this.cache.clear();
    broadcastLog('INFO', '📦 Cache cleared');
  }

  size(): number {
    return this.cache.size;
  }
}

export class ApiAnalysisService {
  private readonly apiBaseUrl: string;
  private readonly timeout: number;
  private readonly cache: ApiAnalysisCache;

  constructor(apiBaseUrl: string = 'https://accel2-fastapi2-kar-aga4c5cpgteffheq.eastus-01.azurewebsites.net') {
    this.apiBaseUrl = apiBaseUrl.replace(/\/$/, ''); // Remove trailing slash
    this.timeout = 10 * 60 * 1000; // 10 minutes in milliseconds
    this.cache = new ApiAnalysisCache();
  }

  /**
   * Execute analysis via FastAPI - main method that replaces Python script execution
   */
  async executeAnalysis(options: ApiAnalysisOptions): Promise<ApiAnalysisResult> {
    const { repositoryUrl, repositoryPath, repositoryId, analysisType = 'default' } = options;
    
    broadcastLog('INFO', `� Starting API analysis for repository: ${repositoryUrl}`);
    broadcastLog('INFO', `📊 Analysis type: ${analysisType}`);
    broadcastLog('INFO', `� API endpoint: ${this.apiBaseUrl}`);
    
    broadcastLog('INFO', `🚀 Starting API analysis for repository: ${repositoryUrl}`);
    broadcastLog('INFO', `📊 Analysis type: ${analysisType}`);
    broadcastLog('INFO', `🔗 API endpoint: ${this.apiBaseUrl}`);

    // Clear any old cached failures and check cache
    this.cache.clear(); // Clear any old 405 errors from cache
    
    const cachedResult = this.cache.get(repositoryUrl, analysisType);
    if (cachedResult) {
      broadcastLog('INFO', '📦 Returning cached analysis result');
      return {
        success: true,
        ...cachedResult,
        executionStartTime: Date.now() - 1000, // Simulate fast execution
        executionEndTime: Date.now()
      };
    }

    const executionStartTime = Date.now();

    try {
      // Prepare API request payload with cleaned URL
      const cleanedRepoUrl = repositoryUrl?.trim();
      
      // TEMPORARY DEBUG: Force use of known working URL to test if issue is with the URL
      const testWorkingUrl = 'https://github.com/srigumm/dotnetcore-kafka-integration.git';
      broadcastLog('WARN', `🧪 TEMP DEBUG: Forcing use of known working URL: ${testWorkingUrl}`);
      broadcastLog('WARN', `🧪 Original URL was: ${cleanedRepoUrl}`);
      
      const payload = {
        repo_url: testWorkingUrl  // Temporarily use known working URL
      };

      // Log the exact URL being used with detailed inspection
      broadcastLog('INFO', `🔍 Repository URL type: ${typeof repositoryUrl}`);
      broadcastLog('INFO', `🔍 Repository URL length: ${repositoryUrl?.length}`);
      broadcastLog('INFO', `🔍 Repository URL value: "${repositoryUrl}"`);
      broadcastLog('INFO', `🔍 Repository URL encoded: ${JSON.stringify(repositoryUrl)}`);
      
      // Check for common URL issues
      if (repositoryUrl?.includes(' ')) {
        broadcastLog('WARN', `⚠️ Repository URL contains spaces!`);
      }
      if (repositoryUrl?.includes('\n') || repositoryUrl?.includes('\r')) {
        broadcastLog('WARN', `⚠️ Repository URL contains newlines!`);
      }
      
      // Validate URL format
      try {
        const parsedUrl = new URL(repositoryUrl);
        broadcastLog('INFO', `✅ Repository URL is valid - protocol: ${parsedUrl.protocol}, host: ${parsedUrl.host}`);
      } catch (urlError: any) {
        broadcastLog('ERROR', `❌ Invalid repository URL: ${urlError.message}`);
        throw new Error(`Invalid repository URL: ${repositoryUrl}`);
      }
      
      // For debugging, let's also test with a known working URL
      broadcastLog('INFO', `🔄 For comparison, our test URL was: "https://github.com/srigumm/dotnetcore-kafka-integration.git"`);
      broadcastLog('INFO', `🔄 URLs match: ${repositoryUrl === 'https://github.com/srigumm/dotnetcore-kafka-integration.git'}`);
      
      // Clean the URL just in case
      const cleanedUrl = repositoryUrl?.trim();
      if (cleanedUrl !== repositoryUrl) {
        broadcastLog('WARN', `⚠️ Repository URL had whitespace, cleaned: "${cleanedUrl}"`);
      }

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'RepoCloner/1.0 Node.js'
      };

      // Use the correct FastAPI endpoint
      // DEBUGGING: Let's try different endpoint paths
      const analyzeEndpoint = `${this.apiBaseUrl}/analyze`;
      
      broadcastLog('INFO', `🔍 Testing multiple endpoint variations...`);
      
      // Let's try the root endpoint first to see what methods it supports
      const rootEndpoint = this.apiBaseUrl;
      broadcastLog('INFO', `📍 Root endpoint: ${rootEndpoint}`);
      broadcastLog('INFO', `📍 Analyze endpoint: ${analyzeEndpoint}`);
      
      broadcastLog('INFO', `📤 Making API request to ${analyzeEndpoint}`);
      broadcastLog('INFO', `📤 Method: POST`);
      broadcastLog('INFO', `📤 Headers: ${JSON.stringify(headers)}`);
      broadcastLog('INFO', `📤 Payload: ${JSON.stringify(payload)}`);

      // Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      let response: Response;
      try {
        broadcastLog('INFO', `🔄 Sending simplified fetch request...`);
        broadcastLog('INFO', `📍 Final endpoint: ${analyzeEndpoint}`);
        broadcastLog('INFO', `� Final payload: ${JSON.stringify(payload)}`);
        
        // Make real FastAPI call
        broadcastLog('INFO', `🌐 Making FastAPI call...`);
        response = await fetch(analyzeEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: controller.signal
        });
        
        broadcastLog('INFO', `📡 FastAPI response: ${response.status} ${response.statusText}`);
      } catch (fetchError: any) {
        broadcastLog('ERROR', `❌ Fetch request failed: ${fetchError.message}`);
        broadcastLog('ERROR', `❌ Fetch error type: ${fetchError.name}`);
        if (fetchError.code) broadcastLog('ERROR', `❌ Fetch error code: ${fetchError.code}`);
        throw fetchError;
      } finally {
        clearTimeout(timeoutId);
      }

      const executionEndTime = Date.now();
      const duration = executionEndTime - executionStartTime;

      broadcastLog('INFO', `📥 API response received (${duration}ms)`);
      broadcastLog('INFO', `📊 Response status: ${response.status} ${response.statusText}`);
      broadcastLog('INFO', `📊 Response headers: ${JSON.stringify(Object.fromEntries(response.headers))}`);

      // Check if request was successful
      if (!response.ok) {
        const errorText = await response.text();
        broadcastLog('ERROR', `❌ API request failed with status ${response.status}`);
        broadcastLog('ERROR', `❌ Error response: ${errorText}`);
        throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
      }

      // Parse JSON response
      const apiResponse = await response.json();
      broadcastLog('INFO', `✅ API response parsed successfully`);

      // Transform API response to match expected format
      const result = this.transformApiResponse(apiResponse, executionStartTime, executionEndTime);

      // Cache successful results
      if (result.success) {
        this.cache.set(repositoryUrl, analysisType, result);
      }

      return result;

    } catch (error: any) {
      const executionEndTime = Date.now();
      const duration = executionEndTime - executionStartTime;

      let errorMessage = 'API analysis failed';
      let isTimeout = false;

      if (error.name === 'AbortError') {
        errorMessage = `API request timed out after ${this.timeout / 1000} seconds`;
        isTimeout = true;
        broadcastLog('ERROR', `⏰ API request timeout (${duration}ms)`);
      } else if (error.message?.includes('fetch')) {
        errorMessage = `Network error: ${error.message}`;
        broadcastLog('ERROR', `🌐 Network error: ${error.message}`);
      } else {
        errorMessage = error.message || 'Unknown API error';
        broadcastLog('ERROR', `❌ API error: ${errorMessage}`);
      }

      return {
        success: false,
        error: errorMessage,
        exitCode: isTimeout ? -2 : -1,
        executionStartTime,
        executionEndTime
      };
    }
  }

  /**
   * Transform FastAPI response to match the expected PythonScriptResult format
   */
  private transformApiResponse(apiResponse: any, startTime: number, endTime: number): ApiAnalysisResult {
    try {
      broadcastLog('INFO', '🔄 Transforming API response to match Python script format');
      broadcastLog('INFO', `🔍 API Response keys: ${Object.keys(apiResponse).join(', ')}`);
      broadcastLog('INFO', `🔍 API Response structure: ${JSON.stringify(apiResponse, null, 2).substring(0, 500)}...`);

      // Check if API response indicates success
      if (apiResponse.status !== 'success') {
        return {
          success: false,
          error: apiResponse.message || apiResponse.error || 'API analysis failed',
          exitCode: -1,
          executionStartTime: startTime,
          executionEndTime: endTime
        };
      }

      // Transform the structured data to match expected format
      // Ensure code_diffs have required diff_content field
      const safeDiffs = (apiResponse.code_diffs || []).map((diff: any) => ({
        ...diff,
        diff_content: diff.diff_content || diff.diff || diff.content || '// No diff content available',
        file_path: diff.file_path || diff.file || diff.path || 'unknown',
        change_type: diff.change_type || diff.type || 'modification'
      }));

      const transformedData = {
        title: 'Kafka to Azure Service Bus Migration Analysis',
        kafka_inventory: apiResponse.kafka_inventory || [],
        code_diffs: safeDiffs,
        sections: {},
        stats: {
          total_files_with_kafka: (apiResponse.kafka_inventory || []).length,
          total_files_with_diffs: safeDiffs.length,
          sections_count: 0
        },
        analysisTypeLabel: 'API Migration Analysis'
      };

      // Create mock generated files (since API doesn't generate local files)
      const generatedFiles: GeneratedFile[] = [
        {
          name: 'api_migration_report.md',
          path: '/tmp/api_migration_report.md',
          size: JSON.stringify(apiResponse).length,
          relativePath: 'api_migration_report.md',
          createdAt: new Date()
        }
      ];

      broadcastLog('INFO', `✅ Transformed API response: ${transformedData.kafka_inventory.length} inventory items, ${transformedData.code_diffs.length} diffs`);

      return {
        success: true,
        output: apiResponse.analysis || 'Analysis completed via API',
        exitCode: 0,
        executionStartTime: startTime,
        executionEndTime: endTime,
        generatedFiles,
        parsedMigrationData: transformedData
      };

    } catch (error) {
      broadcastLog('ERROR', `Failed to transform API response: ${error}`);
      return {
        success: false,
        error: `Failed to process API response: ${error}`,
        exitCode: -1,
        executionStartTime: startTime,
        executionEndTime: endTime
      };
    }
  }

  /**
   * Legacy method name for compatibility with existing code
   */
  async executePostCloneScript(
    repositoryPath: string, 
    repositoryUrl: string, 
    repositoryId?: string, 
    aiSettings?: any, 
    analysisType: string = 'default'
  ): Promise<ApiAnalysisResult> {
    broadcastLog('INFO', `🔄 executePostCloneScript called - redirecting to API analysis`);
    
    return this.executeAnalysis({
      repositoryUrl,
      repositoryPath,
      repositoryId,
      analysisType
    });
  }

  /**
   * Create structured report from API results (maintains compatibility)
   */
  async createPythonScriptReport(
    repositoryId: string,
    repositoryUrl: string,
    repositoryPath: string,
    apiResult: ApiAnalysisResult,
    scriptPath: string,
    storage: any,
    analysisTypeLabel?: string,
    analysisTypeId?: string
  ): Promise<string | undefined> {
    try {
      broadcastLog('INFO', `📊 Creating analysis report from API results...`);
      
      if (!apiResult.success || !apiResult.parsedMigrationData) {
        broadcastLog('WARN', `⚠️ No valid API results to create report for repository ${repositoryId}`);
        return undefined;
      }

      // Add analysis type label to parsed data
      if (analysisTypeLabel) {
        apiResult.parsedMigrationData.analysisTypeLabel = analysisTypeLabel;
      }

      broadcastLog('INFO', `✅ API analysis data ready: ${apiResult.parsedMigrationData.code_diffs?.length || 0} diffs, ${apiResult.parsedMigrationData.kafka_inventory?.length || 0} files with Kafka`);
      
      const reportAnalysisType = analysisTypeId || 'default';
      broadcastLog('INFO', `📝 Storing API report with analysisType: ${reportAnalysisType}`);
      
      // Create analysis report in database
      const report = await storage.createAnalysisReport({
        repositoryId,
        analysisType: reportAnalysisType as any,
        results: {
          pythonScriptOutput: {
            ...apiResult,
            analysisTypeLabel: analysisTypeLabel || 'API Migration Analysis'
          }
        },
        structuredData: apiResult.parsedMigrationData
      });
      
      broadcastLog('INFO', `🎉 API analysis report created with ID: ${report.id}`);
      return report.id;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      broadcastLog('ERROR', `❌ Failed to create API analysis report: ${errorMessage}`);
      throw new Error(`Failed to create API analysis report: ${errorMessage}`);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; enabled: boolean } {
    return {
      size: this.cache.size(),
      enabled: true
    };
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export singleton instance
export const apiAnalysisService = new ApiAnalysisService();