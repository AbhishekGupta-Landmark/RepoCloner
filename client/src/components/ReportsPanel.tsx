import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Download, Share, FileText, Clock, ChevronDown, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";
import { AnalysisReport, AnalysisResult } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";


export default function ReportsPanel() {
  const [downloadingReports, setDownloadingReports] = useState<Record<string, boolean>>({});
  const { toast } = useToast();
  const { currentRepository } = useAppContext();

  // Fetch actual reports from the API
  const { data: reports, isLoading } = useQuery<{ reports: AnalysisReport[] }>({
    queryKey: ['/api/analysis/reports', currentRepository?.id],
    enabled: !!currentRepository?.id // Only fetch when we have a repository
  });

  // Helper function to get report title and description based on analysis type
  const getReportInfo = (analysisType: string) => {
    switch (analysisType) {
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

  const downloadReport = async (reportId: string, format: 'pdf' | 'xlsx' | 'docx') => {
    try {
      setDownloadingReports(prev => ({ ...prev, [reportId]: true }));

      const response = await fetch(`/api/reports/${reportId}/export?format=${format}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Download failed' }));
        throw new Error(errorData.error || 'Download failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      
      // Get filename from Content-Disposition header or generate one
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `report.${format}`;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
        if (filenameMatch) {
          filename = filenameMatch[1];
        }
      }

      // Create temporary link and trigger download
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      
      // Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      toast({
        title: "Download Successful",
        description: `Report downloaded as ${format.toUpperCase()} format`,
      });

    } catch (error) {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to download report",
        variant: "destructive",
      });
    } finally {
      setDownloadingReports(prev => ({ ...prev, [reportId]: false }));
    }
  };

  const shareReports = () => {
    toast({
      title: "Coming Soon",
      description: "Report sharing feature will be available in a future update",
    });
  };

  const displayReports = reports?.reports || [];

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-semibold">Generated Reports</h2>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={shareReports}
            data-testid="button-share-reports"
          >
            <Share className="mr-2 h-4 w-4" />
            Share
          </Button>
        </div>
      </div>
      
      <ScrollArea className="flex-1">
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
              const reportInfo = getReportInfo(report.analysisType);
              const metrics = getMetrics(report.results as AnalysisResult);
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
                        {metrics.recommendations > 0 && (
                          <Badge variant="secondary" className="bg-green-500/20 text-green-400">
                            {metrics.recommendations} Recommendations
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="link" 
                          size="sm" 
                          className="h-auto p-0 text-primary hover:underline"
                          data-testid={`button-view-details-${report.id}`}
                        >
                          View Details
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button 
                              variant="outline" 
                              size="sm"
                              disabled={downloadingReports[report.id]}
                              data-testid={`button-download-${report.id}`}
                            >
                              {downloadingReports[report.id] ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="mr-2 h-4 w-4" />
                              )}
                              Download
                              <ChevronDown className="ml-2 h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem 
                              onClick={() => downloadReport(report.id, 'pdf')}
                              data-testid={`download-pdf-${report.id}`}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Download PDF
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => downloadReport(report.id, 'xlsx')}
                              data-testid={`download-excel-${report.id}`}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Download Excel
                            </DropdownMenuItem>
                            <DropdownMenuItem 
                              onClick={() => downloadReport(report.id, 'docx')}
                              data-testid={`download-word-${report.id}`}
                            >
                              <FileText className="mr-2 h-4 w-4" />
                              Download Word
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
