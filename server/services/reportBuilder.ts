import type { Repository, AnalysisReport, AnalysisResult, AnalysisIssue, TechnologyDetection } from '@shared/schema';

export type ExportFormat = 'pdf' | 'xlsx' | 'docx';

export interface ReportData {
  repository: Repository;
  analysisReport: AnalysisReport;
  analysisResults: AnalysisResult;
}

export class ReportBuilder {
  
  static async generateReport(data: ReportData, format: ExportFormat): Promise<Buffer> {
    switch (format) {
      case 'pdf':
        return this.generatePDF(data);
      case 'xlsx':
        return this.generateExcel(data);
      case 'docx':
        return this.generateWord(data);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  private static async generatePDF(data: ReportData): Promise<Buffer> {
    // Generate simple text-based report for PDF
    let content = '';
    
    // Header
    content += '='.repeat(60) + '\n';
    content += '           REPOSITORY ANALYSIS REPORT\n';
    content += '='.repeat(60) + '\n\n';

    // Repository Information
    content += 'REPOSITORY INFORMATION\n';
    content += '-'.repeat(30) + '\n';
    content += `Name: ${data.repository.name}\n`;
    content += `URL: ${data.repository.url}\n`;
    content += `Provider: ${data.repository.provider}\n`;
    content += `Analysis Date: ${new Date(data.analysisReport.createdAt || '').toLocaleDateString()}\n`;
    content += `Analysis Type: ${data.analysisReport.analysisType}\n\n`;

    // Summary Scores
    if (data.analysisResults.summary) {
      content += 'SUMMARY SCORES\n';
      content += '-'.repeat(20) + '\n';
      const summary = data.analysisResults.summary;
      if (summary.qualityScore !== undefined) {
        content += `Quality Score: ${summary.qualityScore}%\n`;
      }
      if (summary.securityScore !== undefined) {
        content += `Security Score: ${summary.securityScore}%\n`;
      }
      if (summary.maintainabilityScore !== undefined) {
        content += `Maintainability Score: ${summary.maintainabilityScore}%\n`;
      }
      content += '\n';
    }

    // Technologies Detected
    if (data.analysisResults.technologies && data.analysisResults.technologies.length > 0) {
      content += 'TECHNOLOGIES DETECTED\n';
      content += '-'.repeat(25) + '\n';
      data.analysisResults.technologies.forEach((tech: TechnologyDetection) => {
        content += `• ${tech.name} (${tech.category}) - Confidence: ${(tech.confidence * 100).toFixed(1)}%\n`;
      });
      content += '\n';
    }

    // Issues Found
    if (data.analysisResults.issues && data.analysisResults.issues.length > 0) {
      content += 'ISSUES FOUND\n';
      content += '-'.repeat(15) + '\n';
      
      const groupedIssues = data.analysisResults.issues.reduce((acc, issue) => {
        if (!acc[issue.severity]) acc[issue.severity] = [];
        acc[issue.severity].push(issue);
        return acc;
      }, {} as Record<string, AnalysisIssue[]>);

      Object.entries(groupedIssues).forEach(([severity, issues]) => {
        content += `\n${severity.toUpperCase()} (${issues.length})\n`;
        content += '~'.repeat(severity.length + 10) + '\n';
        issues.forEach((issue, index) => {
          content += `${index + 1}. ${issue.description}\n`;
          if (issue.file) content += `   File: ${issue.file}${issue.line ? `:${issue.line}` : ''}\n`;
          if (issue.suggestion) content += `   Suggestion: ${issue.suggestion}\n`;
          content += '\n';
        });
      });
    }

    // Recommendations
    if (data.analysisResults.recommendations && data.analysisResults.recommendations.length > 0) {
      content += 'RECOMMENDATIONS\n';
      content += '-'.repeat(20) + '\n';
      data.analysisResults.recommendations.forEach((rec, index) => {
        content += `${index + 1}. ${rec}\n`;
      });
      content += '\n';
    }

    // Metrics
    if (data.analysisResults.metrics && Object.keys(data.analysisResults.metrics).length > 0) {
      content += 'DETAILED METRICS\n';
      content += '-'.repeat(20) + '\n';
      Object.entries(data.analysisResults.metrics).forEach(([key, value]) => {
        content += `${key}: ${JSON.stringify(value)}\n`;
      });
    }

    return Buffer.from(content, 'utf8');
  }

  private static async generateExcel(data: ReportData): Promise<Buffer> {
    // Generate CSV-like format for Excel
    let csvContent = '';
    
    // Summary Sheet
    csvContent += 'REPOSITORY SUMMARY\n';
    csvContent += 'Property,Value\n';
    csvContent += `Repository Name,"${data.repository.name}"\n`;
    csvContent += `Repository URL,"${data.repository.url}"\n`;
    csvContent += `Provider,"${data.repository.provider}"\n`;
    csvContent += `Analysis Date,"${new Date(data.analysisReport.createdAt || '').toLocaleDateString()}"\n`;
    csvContent += `Analysis Type,"${data.analysisReport.analysisType}"\n`;
    csvContent += '\n';

    // Summary Scores
    if (data.analysisResults.summary) {
      const summary = data.analysisResults.summary;
      if (summary.qualityScore !== undefined) {
        csvContent += `Quality Score,"${summary.qualityScore}%"\n`;
      }
      if (summary.securityScore !== undefined) {
        csvContent += `Security Score,"${summary.securityScore}%"\n`;
      }
      if (summary.maintainabilityScore !== undefined) {
        csvContent += `Maintainability Score,"${summary.maintainabilityScore}%"\n`;
      }
    }

    // Technologies Sheet
    if (data.analysisResults.technologies && data.analysisResults.technologies.length > 0) {
      csvContent += '\nTECHNOLOGIES\n';
      csvContent += 'Technology,Category,Version,Confidence\n';
      data.analysisResults.technologies.forEach((tech) => {
        csvContent += `"${tech.name}","${tech.category}","${tech.version || 'N/A'}","${(tech.confidence * 100).toFixed(1)}%"\n`;
      });
    }

    // Issues Sheet
    if (data.analysisResults.issues && data.analysisResults.issues.length > 0) {
      csvContent += '\nISSUES\n';
      csvContent += 'Severity,Type,Description,File,Line,Suggestion\n';
      data.analysisResults.issues.forEach((issue) => {
        csvContent += `"${issue.severity}","${issue.type}","${issue.description}","${issue.file || 'N/A'}","${issue.line || 'N/A'}","${issue.suggestion || 'N/A'}"\n`;
      });
    }

    // Recommendations Sheet
    if (data.analysisResults.recommendations && data.analysisResults.recommendations.length > 0) {
      csvContent += '\nRECOMMENDATIONS\n';
      csvContent += '#,Recommendation\n';
      data.analysisResults.recommendations.forEach((rec, index) => {
        csvContent += `"${index + 1}","${rec}"\n`;
      });
    }

    return Buffer.from(csvContent, 'utf8');
  }

  private static async generateWord(data: ReportData): Promise<Buffer> {
    // Generate plain text format for Word
    let content = '';

    // Title
    content += 'REPOSITORY ANALYSIS REPORT\n';
    content += '==========================\n\n';

    // Repository Information
    content += 'Repository Information\n';
    content += '---------------------\n';
    content += `Name: ${data.repository.name}\n`;
    content += `URL: ${data.repository.url}\n`;
    content += `Provider: ${data.repository.provider}\n`;
    content += `Analysis Date: ${new Date(data.analysisReport.createdAt || '').toLocaleDateString()}\n`;
    content += `Analysis Type: ${data.analysisReport.analysisType}\n\n`;

    // Summary Scores
    if (data.analysisResults.summary) {
      content += 'Summary Scores\n';
      content += '--------------\n';
      const summary = data.analysisResults.summary;
      if (summary.qualityScore !== undefined) {
        content += `Quality Score: ${summary.qualityScore}%\n`;
      }
      if (summary.securityScore !== undefined) {
        content += `Security Score: ${summary.securityScore}%\n`;
      }
      if (summary.maintainabilityScore !== undefined) {
        content += `Maintainability Score: ${summary.maintainabilityScore}%\n`;
      }
      content += '\n';
    }

    // Technologies
    if (data.analysisResults.technologies && data.analysisResults.technologies.length > 0) {
      content += 'Technologies Detected\n';
      content += '--------------------\n';
      data.analysisResults.technologies.forEach((tech) => {
        content += `• ${tech.name} (${tech.category}) - Confidence: ${(tech.confidence * 100).toFixed(1)}%\n`;
      });
      content += '\n';
    }

    // Issues
    if (data.analysisResults.issues && data.analysisResults.issues.length > 0) {
      content += 'Issues Found\n';
      content += '------------\n';

      const groupedIssues = data.analysisResults.issues.reduce((acc, issue) => {
        if (!acc[issue.severity]) acc[issue.severity] = [];
        acc[issue.severity].push(issue);
        return acc;
      }, {} as Record<string, AnalysisIssue[]>);

      Object.entries(groupedIssues).forEach(([severity, issues]) => {
        content += `\n${severity.toUpperCase()} (${issues.length})\n`;
        content += '-'.repeat(severity.length + 10) + '\n';

        issues.forEach((issue, index) => {
          content += `${index + 1}. ${issue.description}\n`;
          if (issue.file) {
            content += `   File: ${issue.file}${issue.line ? `:${issue.line}` : ''}\n`;
          }
          if (issue.suggestion) {
            content += `   Suggestion: ${issue.suggestion}\n`;
          }
          content += '\n';
        });
      });
    }

    // Recommendations
    if (data.analysisResults.recommendations && data.analysisResults.recommendations.length > 0) {
      content += 'Recommendations\n';
      content += '---------------\n';
      data.analysisResults.recommendations.forEach((rec, index) => {
        content += `${index + 1}. ${rec}\n`;
      });
      content += '\n';
    }

    // Metrics
    if (data.analysisResults.metrics && Object.keys(data.analysisResults.metrics).length > 0) {
      content += 'Detailed Metrics\n';
      content += '----------------\n';
      Object.entries(data.analysisResults.metrics).forEach(([key, value]) => {
        content += `${key}: ${JSON.stringify(value)}\n`;
      });
    }

    return Buffer.from(content, 'utf8');
  }

  static getContentType(format: ExportFormat): string {
    switch (format) {
      case 'pdf':
        return 'text/plain'; // Changed to text/plain since we're generating text
      case 'xlsx':
        return 'text/csv'; // Changed to text/csv since we're generating CSV
      case 'docx':
        return 'text/plain'; // Changed to text/plain since we're generating text
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  static getFileExtension(format: ExportFormat): string {
    switch (format) {
      case 'pdf':
        return 'txt'; // Changed to txt since we're generating text
      case 'xlsx':
        return 'csv'; // Changed to csv since we're generating CSV
      case 'docx':
        return 'txt'; // Changed to txt since we're generating text
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }
}