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
      const { repositoryId } = variables;
      // Store the full Python result for structured data access
      setAnalysisResult(data.pythonResult);
      
      // Immediate cache update for successful analysis (only when success is true)
      if (data.success !== false && data.structuredData) {
        queryClient.setQueryData(['structured-report', repositoryId], {
          status: 'completed',
          structuredData: data.structuredData,
          reportId: data.reportId,
          createdAt: new Date().toISOString()
        });
      }
      
      // Then refetch to ensure data consistency
      await queryClient.refetchQueries({ 
        queryKey: ['structured-report', repositoryId], 
        type: 'active', 
        exact: true 
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/reports'] });
      
      toast({
        title: "Migration Analysis Complete",
        description: data.message || "Migration analysis completed successfully"
      });
    },
    onError: async (error: any, variables: { repositoryId: string; analysisTypeId?: string }) => {
      const { repositoryId } = variables;
      // Immediate cache update for failed analysis - this will trigger the main screen error display
      queryClient.setQueryData(['structured-report', repositoryId], {
        status: 'failed',
        error: error.message || "Analysis failed",
        structuredData: null,
        reportId: null,
        createdAt: new Date().toISOString()
      });
      
      // Then refetch to get actual server response
      await queryClient.refetchQueries({ 
        queryKey: ['structured-report', repositoryId], 
        type: 'active', 
        exact: true 
      });
      
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/reports'] });
      
      // Error is displayed on main screen - no toast needed
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
      await analysisMutation.mutateAsync({ repositoryId, analysisTypeId });
      // CRITICAL FIX: Always invalidate cache after successful analysis
      queryClient.invalidateQueries({ queryKey: ['structured-report', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/reports'] });
      return true;
    } catch (error) {
      // CRITICAL FIX: Also invalidate cache on failure
      queryClient.invalidateQueries({ queryKey: ['structured-report', repositoryId] });
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/reports'] });
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
