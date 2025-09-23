import OpenAI from "openai";
import { AnalysisRequest, AnalysisResult, FileNode } from "@shared/schema";
import * as fs from "fs";
import * as path from "path";
import { broadcastLog } from "../utils/logger";

const openai = new OpenAI({ 
  apiKey: process.env.EPAM_AI_API_KEY || "default_key",
  baseURL: "https://ai-proxy.lab.epam.com/openai/deployments/gpt-4o-mini-2024-07-18"
});

export class OpenAIAnalysisService {
  private validateApiKey(): boolean {
    const apiKey = process.env.EPAM_AI_API_KEY || "default_key";
    if (!apiKey || apiKey === "default_key" || apiKey.length < 10) {
      return false;
    }
    return true;
  }

  async analyzeRepository(request: AnalysisRequest, fileStructure: FileNode[], repoPath: string): Promise<AnalysisResult> {
    broadcastLog('INFO', `Starting ${request.analysisType} analysis at ${request.depth} depth level`);
    
    try {
      // Validate API key before making request
      if (!this.validateApiKey()) {
        broadcastLog('WARN', 'EPAM AI API key not configured, returning mock analysis results');
        return this.getMockAnalysisResult();
      }
      
      const codeFiles = await this.extractCodeFiles(fileStructure, repoPath);
      broadcastLog('INFO', `Found ${codeFiles.length} code files for analysis`);
      
      const analysisPrompt = this.buildAnalysisPrompt(request, codeFiles);

      broadcastLog('INFO', 'Sending analysis request to EPAM AI (OpenAI GPT-4o-mini)');
      // Using EPAM AI proxy with gpt-4o-mini model
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
        max_tokens: 4000
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
      
      broadcastLog('INFO', `Code analysis completed successfully: Quality ${result.summary.qualityScore}%, Security ${result.summary.securityScore}%, ${result.issues.length} issues found`);
      return result;

    } catch (error) {
      // Handle specific OpenAI API errors
      if (error instanceof Error) {
        if (error.message.includes('401') || error.message.includes('Incorrect API key')) {
          broadcastLog('ERROR', 'Invalid EPAM AI API key - authentication failed');
          throw new Error("Invalid EPAM AI API key. Please contact your administrator for access.");
        }
        if (error.message.includes('quota') || error.message.includes('billing')) {
          broadcastLog('ERROR', 'EPAM AI API quota exceeded - billing limit reached');
          throw new Error("EPAM AI API quota exceeded. Please contact your administrator.");
        }
        if (error.message.includes('rate limit')) {
          broadcastLog('WARN', 'OpenAI API rate limit exceeded - throttling requests');
          throw new Error("OpenAI API rate limit exceeded. Please try again in a moment.");
        }
      }
      const errorMessage = `Code analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      broadcastLog('ERROR', errorMessage);
      throw new Error(errorMessage);
    }
  }

  private async extractCodeFiles(fileStructure: FileNode[], repoPath: string, maxFiles: number = 20): Promise<Array<{path: string, content: string}>> {
    const codeFiles: Array<{path: string, content: string}> = [];
    const codeExtensions = new Set(['.js', '.ts', '.tsx', '.jsx', '.py', '.java', '.cs', '.cpp', '.c', '.go', '.rs', '.php', '.rb']);

    const extractFiles = async (nodes: FileNode[]) => {
      for (const node of nodes) {
        if (codeFiles.length >= maxFiles) break;

        if (node.type === 'file') {
          const ext = path.extname(node.name);
          if (codeExtensions.has(ext)) {
            try {
              const fullPath = path.join(repoPath, node.path);
              const content = await fs.promises.readFile(fullPath, 'utf-8');
              
              // Skip very large files
              if (content.length < 50000) {
                codeFiles.push({
                  path: node.path,
                  content: content.substring(0, 10000) // Limit content length
                });
              } else {
              }
            } catch (error) {
              broadcastLog('WARN', `Failed to read file ${node.path}: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  private buildAnalysisPrompt(request: AnalysisRequest, codeFiles: Array<{path: string, content: string}>): string {
    const fileContents = codeFiles.map(file => 
      `\n--- File: ${file.path} ---\n${file.content}`
    ).join('\n');

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
${request.analysisType === 'security' ? '- Security vulnerabilities\n- Authentication issues\n- Data exposure risks' : ''}
${request.analysisType === 'quality' ? '- Code maintainability\n- Best practices adherence\n- Design patterns' : ''}
${request.analysisType === 'performance' ? '- Performance bottlenecks\n- Resource usage\n- Optimization opportunities' : ''}
${request.analysisType === 'documentation' ? '- Code documentation quality\n- README completeness\n- API documentation' : ''}
${request.analysisType === 'architecture' ? '- System architecture\n- Component relationships\n- Design patterns usage' : ''}`;
  }

  private getMockAnalysisResult(): AnalysisResult {
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

  async generateSummaryReport(repositoryName: string, analyses: AnalysisResult[]): Promise<string> {
    broadcastLog('INFO', `Generating comprehensive summary report for repository: ${repositoryName}`);
    
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
      // Using EPAM AI proxy with gpt-4o-mini model
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
        max_tokens: 3000
      });

      const reportContent = response.choices[0].message.content || "Report generation failed";
      broadcastLog('INFO', `Summary report generated successfully (${Math.round(reportContent.length/1024)}KB)`);
      return reportContent;
    } catch (error) {
      const errorMessage = `Summary report generation failed: ${error instanceof Error ? error.message : 'Unknown error'}`;
      broadcastLog('ERROR', errorMessage);
      throw new Error(errorMessage);
    }
  }
}

export const openaiService = new OpenAIAnalysisService();
