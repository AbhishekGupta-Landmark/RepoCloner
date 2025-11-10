import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AnalysisRequest, AnalysisResult, AnalysisReport } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

export function useAnalysis() {
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Logging is handled by proper toast notifications

  const analysisMutation = useMutation({
    mutationKey: ['analysis'],
    mutationFn: async ({ repositoryId, analysisTypeId }: { repositoryId: string; analysisTypeId?: string }) => {
      const response = await apiRequest('POST', '/api/analysis/run', { 
        repositoryId,
        analysisTypeId 
      });
      const data = await response.json();
      
      // Check if the response indicates success
      if (!response.ok || (data.success === false)) {
        throw new Error(data.error || data.message || 'Analysis failed');
      }
      
      return data;
    },
    onSuccess: async (data, variables: { repositoryId: string; analysisTypeId?: string }) => {
      const { repositoryId, analysisTypeId } = variables;
      // Store the full Python result for structured data access
      setAnalysisResult(data.pythonResult);
      
      // Build cache key with analysisType included
      const cacheKey = ['structured-report', repositoryId, analysisTypeId || 'all'];
      
      // CRITICAL FIX: First REMOVE any old failed cache to avoid stale data
      queryClient.removeQueries({ queryKey: cacheKey });
      
      // Store successful analysis result in cache (only when success is true)
      if (data.success !== false && data.structuredData) {
        queryClient.setQueryData(cacheKey, {
          status: 'ready',
          structuredData: data.structuredData,
          reportId: data.reportId,
          createdAt: new Date().toISOString(),
          analysisType: analysisTypeId
        });
      }
      
      // Force refetch of the structured report to get fresh data
      queryClient.invalidateQueries({ queryKey: cacheKey });
      
      // Invalidate reports list to refresh
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repositories'] });
      
      // Invalidate migration changes to refresh Code Migration tab
      queryClient.invalidateQueries({ queryKey: ['/api/migration/changes'] });
      
      toast({
        title: "Migration Analysis Complete",
        description: data.message || "Migration analysis completed successfully"
      });
    },
    onError: async (error: any, variables: { repositoryId: string; analysisTypeId?: string }) => {
      const { repositoryId, analysisTypeId } = variables;
      
      // Build cache key with analysisType included
      const cacheKey = ['structured-report', repositoryId, analysisTypeId || 'all'];
      
      // Store failed analysis in cache - this will trigger the main screen error display
      queryClient.setQueryData(cacheKey, {
        status: 'failed',
        error: error.message || "Analysis failed",
        structuredData: null,
        reportId: null,
        createdAt: new Date().toISOString(),
        analysisType: analysisTypeId
      });
      
      // Invalidate reports list
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/reports'] });
      queryClient.invalidateQueries({ queryKey: ['/api/repositories'] });
      
      // Show error toast to user
      toast({
        title: "Analysis Failed",
        description: error.message || "Failed to run code analysis",
        variant: "destructive"
      });
    }
  });

  // Generate summary report mutation
  const generateReportMutation = useMutation({
    mutationFn: async (repositoryId: string) => {
      const response = await apiRequest('POST', '/api/analysis/generate-report', {
        repositoryId
      });
      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Report Generated",
        description: "Comprehensive analysis report has been created"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Report Generation Failed",
        description: error.message || "Failed to generate report",
        variant: "destructive"
      });
    }
  });

  // Get analysis reports for a repository
  const { data: reports } = useQuery<{ reports: AnalysisReport[] }>({
    queryKey: ['/api/analysis/reports', 'current'], // This would use actual repo ID
    enabled: false // Only fetch when we have a repository
  });

  const analyzeCode = async (repositoryId: string, analysisTypeId?: string): Promise<boolean> => {
    try {
      // DON'T reset/invalidate before analysis - let mutation handle cache updates
      // Resetting triggers refetches that overwrite the failed status
      await analysisMutation.mutateAsync({ repositoryId, analysisTypeId });
      return true;
    } catch (error) {
      // Error handling is done in mutation's onError
      return false;
    }
  };

  const generateSummaryReport = async (repositoryId: string): Promise<boolean> => {
    try {
      await generateReportMutation.mutateAsync(repositoryId);
      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    analyzeCode,
    generateSummaryReport,
    analysisResult,
    reports: reports?.reports || [],
    isLoading: analysisMutation.isPending || generateReportMutation.isPending
  };
}
