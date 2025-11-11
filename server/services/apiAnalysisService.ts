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
    
    broadcastLog('INFO', `🚀 Starting API analysis for repository: ${repositoryUrl}`);
    broadcastLog('INFO', `📊 Analysis type: ${analysisType}`);
    broadcastLog('INFO', `🔗 API endpoint: ${this.apiBaseUrl}`);

    // Check cache first
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
      // Prepare API request payload
      const payload = {
        repo_url: repositoryUrl
      };

      const headers = {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      };

      broadcastLog('INFO', `📤 Making API request to ${this.apiBaseUrl}`);
      broadcastLog('INFO', `📤 Payload: ${JSON.stringify(payload)}`);

      // Make API call with timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.timeout);

      let response: Response;
      try {
        response = await fetch(this.apiBaseUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify(payload),
          signal: controller.signal
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const executionEndTime = Date.now();
      const duration = executionEndTime - executionStartTime;

      broadcastLog('INFO', `📥 API response received (${duration}ms)`);
      broadcastLog('INFO', `📊 Response status: ${response.status} ${response.statusText}`);

      // Check if request was successful
      if (!response.ok) {
        const errorText = await response.text();
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
      const transformedData = {
        title: 'Kafka to Azure Service Bus Migration Analysis',
        kafka_inventory: apiResponse.kafka_inventory || [],
        code_diffs: apiResponse.code_diffs || [],
        sections: {},
        stats: {
          total_files_with_kafka: (apiResponse.kafka_inventory || []).length,
          total_files_with_diffs: (apiResponse.code_diffs || []).length,
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