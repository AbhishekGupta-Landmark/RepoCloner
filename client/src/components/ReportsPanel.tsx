import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Clock, Loader2, Download, Eye, Maximize2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "@/context/AppContext";
import { AnalysisReport, AnalysisResult } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";


export default function ReportsPanel() {
  const { currentRepository } = useAppContext();
  const { toast } = useToast();
  const [downloadingReports, setDownloadingReports] = useState<Set<string>>(new Set());
  const [viewingReport, setViewingReport] = useState<{ id: string, fileName: string } | null>(null);
  const [reportContent, setReportContent] = useState<string>('');

  // Fetch actual reports from the API
  const { data: reports, isLoading } = useQuery<{ reports: AnalysisReport[], generatedReports?: Array<{id: string, fileName: string, type: string, createdAt: Date, size: number}> }>({
    queryKey: ['/api/analysis/reports', currentRepository?.id],
    enabled: !!currentRepository?.id // Only fetch when we have a repository
  });

  // Helper function to get report title and description based on analysis type
  const getReportInfo = (analysisType: string, results?: any) => {
    switch (analysisType) {
      case 'migration':
        // Use analysisTypeLabel from results if available
        const analysisLabel = results?.pythonScriptOutput?.analysisTypeLabel;
        if (analysisLabel) {
          return {
            title: `${analysisLabel} Report`,
            description: 'Kafka to Azure Service Bus migration analysis'
          };
        }
        return {
          title: 'Migration Analysis Report',
          description: 'Kafka to Azure Service Bus migration analysis'
        };
      case 'python-script':
        // Extract filename from generated files
        if (results?.pythonScriptOutput?.generatedFiles?.length > 0) {
          const filename = results.pythonScriptOutput.generatedFiles[0].name;
          const reportName = filename.replace(/\.(md|pdf|xlsx|docx)$/, '').replace(/-\d+$/, '');
          return {
            title: reportName.split('-').map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)).join(' '),
            description: `Generated ${filename.split('.').pop()?.toUpperCase()} file`
          };
        }
        return {
          title: 'Generated Report',
          description: 'Python script generated analysis'
        };
      case 'security':
        return {
          title: 'Security Analysis Report',
          description: 'Comprehensive security vulnerability assessment'
        };
      case 'quality':
        return {
          title: 'Code Quality Report', 
          description: 'Detailed analysis of code maintainability and best practices'
        };
      case 'performance':
        return {
          title: 'Performance Analysis Report',
          description: 'Performance bottlenecks and optimization recommendations'
        };
      case 'documentation':
        return {
          title: 'Documentation Report',
          description: 'Code documentation coverage and quality assessment'
        };
      case 'architecture':
        return {
          title: 'Architecture Analysis Report',
          description: 'Software architecture patterns and design quality'
        };
      case 'test-coverage-report':
        return {
          title: 'Test Coverage and Validation Report',
          description: 'AI-powered test coverage analysis and recommendations'
        };
      case 'migration-report':
        return {
          title: 'Migration Analysis Report',
          description: 'Kafka to Azure Service Bus migration analysis'
        };
      case 'quick-migration-report':
        return {
          title: 'Quick Migration Analysis Report',
          description: 'Kafka to Azure Service Bus migration analysis'
        };
      case 'default':
        return {
          title: 'Migration Analysis Report',
          description: 'Kafka to Azure Service Bus migration analysis'
        };
      case 'quick-migration-1':
        return {
          title: 'Quick Migration Analysis Report',
          description: 'Kafka to Azure Service Bus migration analysis'
        };
      default:
        // Don't show unrecognized report types - they might be internal/duplicate entries
        return null;
    }
  };

  // Helper function to extract metrics from analysis results
  const getMetrics = (results: AnalysisResult) => {
    const metrics: any = {};
    
    if (results.summary?.qualityScore !== undefined) {
      metrics.qualityScore = results.summary.qualityScore;
    }
    if (results.summary?.securityScore !== undefined) {
      metrics.securityScore = results.summary.securityScore;
    }
    if (results.issues) {
      metrics.criticalIssues = results.issues.filter(i => i.severity === 'critical').length;
      metrics.highIssues = results.issues.filter(i => i.severity === 'high').length;
      metrics.mediumIssues = results.issues.filter(i => i.severity === 'medium').length;
      metrics.lowIssues = results.issues.filter(i => i.severity === 'low').length;
    }
    if (results.recommendations) {
      metrics.recommendations = results.recommendations.length;
    }
    
    return metrics;
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return "Just now";
    if (diffInMinutes < 60) return `${diffInMinutes} minutes ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hours ago`;
    return `${Math.floor(diffInMinutes / 1440)} days ago`;
  };

  const handleViewReport = async (reportId: string, fileName: string) => {
    if (!currentRepository?.id) return;
    
    try {
      const viewUrl = `/api/analysis/reports/${encodeURIComponent(currentRepository.id)}/download/${encodeURIComponent(fileName)}`;
      const response = await fetch(viewUrl);
      
      if (!response.ok) {
        toast({
          title: "Failed to load report",
          description: "Could not retrieve report content",
          variant: "destructive",
        });
        return;
      }
      
      const content = await response.text();
      setReportContent(content);
      setViewingReport({ id: reportId, fileName });
    } catch (error) {
      toast({
        title: "Error loading report",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
    }
  };



  // Combine database reports and generated reports (from filesystem)
  const dbReports = reports?.reports || [];
  const generatedReportsFromFS = reports?.generatedReports || [];
  
  const genReports = generatedReportsFromFS.map(gr => ({
    id: gr.id,
    repositoryId: currentRepository?.id || '',
    analysisType: gr.type,
    results: { fileName: gr.fileName, fileSize: gr.size },
    createdAt: gr.createdAt,
    isGeneratedReport: true,
    fileName: gr.fileName
  }));
  
  // Filter out database reports that have matching generated report files to avoid duplicates
  // Match based on timestamp proximity (within 5 seconds) to be more precise
  const filteredDbReports = dbReports.filter(dbReport => {
    if (dbReport.analysisType === 'migration' || dbReport.analysisType === 'python-script') {
      const dbTime = dbReport.createdAt ? new Date(dbReport.createdAt).getTime() : 0;
      
      // Check if there's a generated file created around the same time
      const hasMatchingGenFile = genReports.some(genReport => {
        const genTime = genReport.createdAt ? new Date(genReport.createdAt).getTime() : 0;
        const timeDiff = Math.abs(dbTime - genTime);
        return timeDiff < 5000; // Within 5 seconds = same analysis
      });
      
      if (hasMatchingGenFile) {
        return false; // Filter out - this DB entry has a matching file
      }
    }
    return true;
  });
  
  // CRITICAL: Only show reports that have actual files (prevent empty entries)
  const reportsWithFiles = [...genReports, ...filteredDbReports].filter(report => {
    // Generated reports always have files (they come from filesystem)
    if ('isGeneratedReport' in report && report.isGeneratedReport) {
      return true;
    }
    
    // For DB reports, check if file exists in generatedReports OR has downloadUrl
    const results = report.results as any;
    if (results?.fileName) {
      const hasFile = generatedReportsFromFS.some(gr => gr.fileName === results.fileName);
      if (hasFile) return true;
    }
    
    // Check for downloadUrl or other file indicators
    if (results?.downloadUrl || results?.reportPath) {
      return true;
    }
    
    // No file found - don't show this entry
    return false;
  });
  
  const displayReports = reportsWithFiles.sort((a, b) => {
    const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return dateB - dateA;
  });

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold text-foreground">Analysis Reports</h2>
      </div>
      
      <Tabs defaultValue="reports" className="h-full flex flex-col">
        <TabsList className="mb-4 grid w-fit grid-cols-1">
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            All Reports
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reports" className="flex-1">
          <ScrollArea className="h-full">
        {isLoading ? (
          <motion.div 
            className="space-y-4" 
            data-testid="reports-loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3 }}
          >
            {[1, 2, 3].map((i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: i * 0.1 }}
              >
                <Card className="border-border/50 shadow-soft hover:shadow-medium transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-4 w-48 loading-pulse" />
                      <Skeleton className="h-3 w-20 loading-pulse" style={{ animationDelay: '0.2s' }} />
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <Skeleton className="h-3 w-full mb-3 loading-pulse" style={{ animationDelay: '0.4s' }} />
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <Skeleton className="h-5 w-16 loading-pulse" style={{ animationDelay: '0.6s' }} />
                        <Skeleton className="h-5 w-20 loading-pulse" style={{ animationDelay: '0.8s' }} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-8 w-20 loading-pulse" style={{ animationDelay: '1s' }} />
                        <Skeleton className="h-8 w-24 loading-pulse" style={{ animationDelay: '1.2s' }} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
            <motion.div 
              className="flex items-center justify-center pt-6"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.5 }}
            >
              <div className="flex items-center gap-3 text-sm text-muted-foreground px-4 py-2 bg-muted/30 rounded-lg border border-border/50">
                <motion.div 
                  className="h-3 w-3 rounded-full bg-blue-500"
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                />
                <span className="loading-dots">Loading reports</span>
              </div>
            </motion.div>
          </motion.div>
        ) : displayReports.length === 0 ? (
          <motion.div 
            className="text-center py-12 text-muted-foreground" 
            data-testid="reports-empty-state"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
            >
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
            </motion.div>
            <motion.h3 
              className="text-lg font-medium mb-2"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              {currentRepository ? "No Reports Generated" : "No Repository Selected"}
            </motion.h3>
            <motion.p 
              className="text-sm"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              {currentRepository 
                ? "Run code analysis to generate reports" 
                : "Select a repository to view analysis reports"}
            </motion.p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {displayReports.map((report) => {
              const results = report.results as any;
              const reportInfo = getReportInfo(report.analysisType, results);
              const metrics = getMetrics(results as AnalysisResult);
              const createdAt = report.createdAt ? new Date(report.createdAt).toISOString() : new Date().toISOString();
              
              // Skip reports with unrecognized types (reportInfo is null)
              if (!reportInfo) return null;
              
              return (
                <Card key={report.id} data-testid={`report-${report.id}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base">{reportInfo.title}</CardTitle>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span data-testid={`report-time-${report.id}`}>
                          {formatTimeAgo(createdAt)}
                        </span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="text-sm text-muted-foreground mb-3">
                      {reportInfo.description}
                    </p>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs">
                        {metrics.criticalIssues > 0 && (
                          <Badge variant="secondary" className="bg-red-500/20 text-red-400">
                            {metrics.criticalIssues} Critical
                          </Badge>
                        )}
                        {metrics.highIssues > 0 && (
                          <Badge variant="secondary" className="bg-orange-500/20 text-orange-400">
                            {metrics.highIssues} High
                          </Badge>
                        )}
                        {metrics.mediumIssues > 0 && (
                          <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-400">
                            {metrics.mediumIssues} Medium
                          </Badge>
                        )}
                        {metrics.qualityScore !== undefined && (
                          <Badge variant="secondary" className="bg-blue-500/20 text-blue-400">
                            {metrics.qualityScore}% Quality
                          </Badge>
                        )}
                        {metrics.securityScore !== undefined && (
                          <Badge variant="secondary" className="bg-purple-500/20 text-purple-400">
                            {metrics.securityScore}% Security
                          </Badge>
                        )}
                      </div>
                      
                      {/* View and Download buttons for reports with generated files or generated reports */}
                      {((((report.analysisType === 'python-script' || report.analysisType === 'migration') && 
                       results?.pythonScriptOutput?.generatedFiles?.length > 0) ||
                       ((report.analysisType === 'migration-report' || report.analysisType === 'test-coverage-report' || report.analysisType === 'quick-migration-report') && (report as any).fileName)) && 
                       currentRepository?.id) && (
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="!text-white !border-white/30 hover:!bg-blue-600 hover:!border-blue-500 hover:!text-white bg-transparent"
                            onClick={() => {
                              const fileName = (report as any).fileName || 
                                             results.pythonScriptOutput?.generatedFiles?.[0]?.name;
                              if (fileName) {
                                handleViewReport(report.id, fileName);
                              }
                            }}
                            data-testid={`view-report-${report.id}`}
                          >
                            <Eye className="h-3 w-3 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={downloadingReports.has(report.id)}
                            className="!text-white !border-white/30 hover:!bg-blue-600 hover:!border-blue-500 hover:!text-white bg-transparent"
                            onClick={async () => {
                            // Determine filename based on report type
                            const fileName = (report as any).fileName || 
                                           results.pythonScriptOutput?.generatedFiles?.[0]?.name;
                            
                            if (!fileName) return;
                            
                            setDownloadingReports(prev => new Set(prev).add(report.id));
                            
                            try {
                              const downloadUrl = `/api/analysis/reports/${encodeURIComponent(currentRepository.id)}/download/${encodeURIComponent(fileName)}`;
                              
                              // Fetch the file
                              const response = await fetch(downloadUrl);
                              
                              if (!response.ok) {
                                let errorMessage = 'Download failed';
                                if (response.status === 404) {
                                  errorMessage = 'Report file not found';
                                } else if (response.status === 403) {
                                  errorMessage = 'Access denied to report file';
                                } else {
                                  errorMessage = `Server error: ${response.status}`;
                                }
                                
                                toast({
                                  title: "Download failed",
                                  description: errorMessage,
                                  variant: "destructive",
                                });
                                return;
                              }
                              
                              // Get the file content as blob
                              const blob = await response.blob();
                              
                              // Create download link
                              const link = document.createElement('a');
                              link.href = URL.createObjectURL(blob);
                              link.download = fileName;
                              document.body.appendChild(link);
                              link.click();
                              document.body.removeChild(link);
                              
                              // Clean up blob URL
                              URL.revokeObjectURL(link.href);
                              
                              toast({
                                title: "Download completed",
                                description: `Successfully downloaded ${fileName}`,
                              });
                            } catch (error) {
                              toast({
                                title: "Download failed",
                                description: error instanceof Error ? error.message : 'Network error occurred',
                                variant: "destructive",
                              });
                            } finally {
                              setDownloadingReports(prev => {
                                const newSet = new Set(prev);
                                newSet.delete(report.id);
                                return newSet;
                              });
                            }
                          }}
                          data-testid={`download-report-${report.id}`}
                        >
                          {downloadingReports.has(report.id) ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3 mr-1" />
                          )}
                          {downloadingReports.has(report.id) ? 'Downloading...' : 'Download'}
                        </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
          </ScrollArea>
        </TabsContent>

      </Tabs>

      {/* Report Viewer Dialog */}
      <Dialog open={!!viewingReport} onOpenChange={(open) => !open && setViewingReport(null)}>
        <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
          <DialogHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <DialogTitle className="text-foreground">
                {viewingReport?.fileName || 'Report'}
              </DialogTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const elem = document.querySelector('[role="dialog"]') as HTMLElement;
                  if (elem && document.fullscreenElement !== elem) {
                    elem.requestFullscreen();
                  } else if (document.fullscreenElement) {
                    document.exitFullscreen();
                  }
                }}
                className="!text-foreground !border-border hover:!bg-accent"
                data-testid="maximize-dialog"
              >
                <Maximize2 className="h-4 w-4" />
              </Button>
            </div>
          </DialogHeader>
          <div className="flex-1 mt-4 overflow-hidden">
            <ScrollArea className="h-full">
              <pre className="text-sm text-foreground font-mono whitespace-pre-wrap break-words p-4 bg-muted rounded-lg">
                {reportContent}
              </pre>
            </ScrollArea>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
