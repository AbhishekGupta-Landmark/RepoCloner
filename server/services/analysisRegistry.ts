import * as fs from 'fs';
import * as path from 'path';
import { AnalysisType } from '@shared/schema';
import { broadcastLog } from '../utils/logger';

/**
 * AnalysisRegistry - Discovers and manages available analysis types from scripts/*.py
 * 
 * Features:
 * - Auto-discovers Python scripts in scripts/ directory
 * - Parses metadata from script headers (ANALYSIS_ID, ANALYSIS_LABEL)
 * - Provides type-safe access to analysis types
 * - Caches results for performance
 */
export class AnalysisRegistry {
  private registry: Map<string, AnalysisType> = new Map();
  private scriptsDir: string;
  private lastScanTime: number = 0;
  private cacheTTL: number = 60000; // Cache for 1 minute

  constructor(scriptsDirectory?: string) {
    this.scriptsDir = scriptsDirectory || path.join(process.cwd(), 'scripts');
  }

  /**
   * Scan scripts directory and build registry
   */
  async scanScripts(): Promise<void> {
    const now = Date.now();
    
    // Use cache if still valid
    if (this.registry.size > 0 && (now - this.lastScanTime) < this.cacheTTL) {
      broadcastLog('INFO', `Using cached analysis registry (${this.registry.size} types)`);
      return;
    }

    broadcastLog('INFO', `Scanning scripts directory: ${this.scriptsDir}`);
    this.registry.clear();

    try {
      if (!fs.existsSync(this.scriptsDir)) {
        broadcastLog('ERROR', `Scripts directory not found: ${this.scriptsDir}`);
        return;
      }

      const files = fs.readdirSync(this.scriptsDir);
      const pythonFiles = files.filter(f => f.endsWith('.py'));

      for (const filename of pythonFiles) {
        const scriptPath = path.join(this.scriptsDir, filename);
        const analysisType = await this.parseScriptMetadata(scriptPath, filename);
        
        if (analysisType) {
          this.registry.set(analysisType.id, analysisType);
          broadcastLog('INFO', `Registered analysis type: ${analysisType.id} - ${analysisType.label}`);
        }
      }

      this.lastScanTime = now;
      broadcastLog('INFO', `Analysis registry scan complete: ${this.registry.size} types registered`);

    } catch (error) {
      broadcastLog('ERROR', `Failed to scan scripts directory: ${error}`);
    }
  }

  /**
   * Parse metadata from Python script headers
   * Supports:
   *   # ANALYSIS_ID: my-analysis
   *   # ANALYSIS_LABEL: My Analysis Label
   */
  private async parseScriptMetadata(scriptPath: string, filename: string): Promise<AnalysisType | null> {
    try {
      // Read first 20 lines to find metadata
      const content = fs.readFileSync(scriptPath, 'utf-8');
      const lines = content.split('\n').slice(0, 20);

      let id: string | null = null;
      let label: string | null = null;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Parse ANALYSIS_ID
        const idMatch = trimmed.match(/^#\s*ANALYSIS_ID:\s*(.+)$/i);
        if (idMatch) {
          id = idMatch[1].trim();
        }

        // Parse ANALYSIS_LABEL
        const labelMatch = trimmed.match(/^#\s*ANALYSIS_LABEL:\s*(.+)$/i);
        if (labelMatch) {
          label = labelMatch[1].trim();
        }
      }

      // Use defaults if metadata not found
      if (!id) {
        const basename = path.basename(filename, '.py');
        id = basename;
      }

      if (!label) {
        // Humanize filename: default2 -> Default 2
        const basename = path.basename(filename, '.py');
        label = this.humanizeFilename(basename);
      }

      return {
        id,
        label,
        scriptPath,
      };

    } catch (error) {
      broadcastLog('ERROR', `Failed to parse metadata from ${filename}: ${error}`);
      return null;
    }
  }

  /**
   * Convert filename to human-readable label
   * Examples: default2 -> Default 2, quick-migration -> Quick Migration
   */
  private humanizeFilename(filename: string): string {
    return filename
      .replace(/[-_]/g, ' ')
      .replace(/([a-z])([A-Z])/g, '$1 $2')
      .replace(/\b\w/g, c => c.toUpperCase())
      .replace(/(\d+)/g, ' $1')
      .trim();
  }

  /**
   * Get all registered analysis types
   */
  async getAllTypes(): Promise<AnalysisType[]> {
    await this.scanScripts();
    return Array.from(this.registry.values()).sort((a, b) => a.label.localeCompare(b.label));
  }

  /**
   * Get analysis type by ID
   */
  async getTypeById(id: string): Promise<AnalysisType | null> {
    await this.scanScripts();
    return this.registry.get(id) || null;
  }

  /**
   * Check if analysis type exists
   */
  async hasType(id: string): Promise<boolean> {
    await this.scanScripts();
    return this.registry.has(id);
  }

  /**
   * Refresh the registry cache (force rescan)
   */
  async refresh(): Promise<void> {
    this.lastScanTime = 0;
    await this.scanScripts();
  }
}

// Singleton instance
export const analysisRegistry = new AnalysisRegistry();
