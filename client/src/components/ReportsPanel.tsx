import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileText, Clock, Loader2, Download } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useAppContext } from "@/context/AppContext";
import { AnalysisReport, AnalysisResult } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";


export default function ReportsPanel() {
  const { currentRepository } = useAppContext();
  const { toast } = useToast();
  const [downloadingReports, setDownloadingReports] = useState<Set<string>>(new Set());

  // Fetch actual reports from the API
  const { data: reports, isLoading } = useQuery<{ reports: AnalysisReport[] }>({
    queryKey: ['/api/analysis/reports', currentRepository?.id],
    enabled: !!currentRepository?.id // Only fetch when we have a repository
  });

  // Helper function to get report title and description based on analysis type
  const getReportInfo = (analysisType: string, results?: any) => {
    switch (analysisType) {
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
      default:
        return {
          title: 'Analysis Report',
          description: 'Code analysis results'
        };
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



  const displayReports = reports?.reports || [];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Analysis Reports</h2>
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
                      
                      {/* Download button for python-script reports with generated files */}
                      {(report.analysisType === 'python-script' || report.analysisType === 'migration') && 
                       results?.pythonScriptOutput?.generatedFiles?.length > 0 && 
                       currentRepository?.id && (
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={downloadingReports.has(report.id)}
                          onClick={async () => {
                            const generatedFile = results.pythonScriptOutput.generatedFiles[0];
                            const fileName = generatedFile.name;
                            
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
                          className="ml-2"
                          data-testid={`download-report-${report.id}`}
                        >
                          {downloadingReports.has(report.id) ? (
                            <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          ) : (
                            <Download className="h-3 w-3 mr-1" />
                          )}
                          {downloadingReports.has(report.id) ? 'Downloading...' : 'Download'}
                        </Button>
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
    </div>
  );
}
