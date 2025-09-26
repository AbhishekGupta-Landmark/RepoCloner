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
    mutationFn: async (repositoryId: string) => {
      const response = await apiRequest('POST', '/api/analysis/run', { repositoryId });
      return await response.json();
    },
    onSuccess: async (data, repositoryId: string) => {
      // Store the full Python result for structured data access
      setAnalysisResult(data.pythonResult);
      
      // Immediate cache update for successful analysis
      queryClient.setQueryData(['structured-report', repositoryId], {
        status: 'completed',
        structuredData: data.structuredData,
        reportId: data.reportId,
        createdAt: new Date().toISOString()
      });
      
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
    onError: async (error: any, repositoryId: string) => {
      // Immediate cache update for failed analysis
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
      
      toast({
        title: "Migration Analysis Failed",
        description: error.message || "Failed to run migration analysis",
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

  const analyzeCode = async (repositoryId: string): Promise<boolean> => {
    try {
      await analysisMutation.mutateAsync(repositoryId);
      return true;
    } catch (error) {
      // CRITICAL FIX: Always invalidate structured report cache after analysis attempt
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
