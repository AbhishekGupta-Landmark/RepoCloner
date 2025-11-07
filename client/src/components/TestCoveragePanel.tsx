import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppContext } from "@/context/AppContext";
import { Play, FileCode, Loader2, AlertCircle, ArrowRight } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import TestCoverageViewer from "./TestCoverageViewer";

export default function TestCoveragePanel() {
  const { currentRepository, unlockTab, switchToTab } = useAppContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Fetch latest test coverage report
  const { data: reports, isLoading: reportsLoading } = useQuery<any>({
    queryKey: ['/api/analysis/reports', currentRepository?.id],
    enabled: !!currentRepository?.id,
  });

  const latestTestCoverageReport = reports?.reports?.find(
    (r: any) => r.analysisType === 'test-coverage'
  );

  // Run test coverage analysis mutation
  const runAnalysisMutation = useMutation({
    mutationFn: async () => {
      if (!currentRepository) throw new Error("No repository selected");
      
      setIsAnalyzing(true);
      
      try {
        const response = await apiRequest('POST', '/api/analysis/test-coverage', {
          repositoryId: currentRepository.id
        });
        const data = await response.json();
        
        // Check if the response indicates failure
        if (!data.success && data.error) {
          throw new Error(data.error);
        }
        
        return data;
      } catch (error: any) {
        setIsAnalyzing(false);
        // Extract error message from different error formats
        if (error.message?.includes('500:') || error.message?.includes('400:')) {
          try {
            const errorJson = JSON.parse(error.message.split(': ')[1]);
            throw new Error(errorJson.error || errorJson.message || 'Test coverage analysis failed');
          } catch {
            throw new Error(error.message.split(': ').slice(1).join(': ') || 'Test coverage analysis failed');
          }
        }
        throw error;
      }
    },
    onSuccess: async () => {
      // Wait for the query to refetch before clearing the analyzing state
      await queryClient.invalidateQueries({ queryKey: ['/api/analysis/reports', currentRepository?.id] });
      await queryClient.refetchQueries({ queryKey: ['/api/analysis/reports', currentRepository?.id] });
      setIsAnalyzing(false);
    },
    onError: (error: any) => {
      console.error('Test coverage analysis failed:', error);
      setIsAnalyzing(false);
    }
  });

  const handleRunAnalysis = () => {
    runAnalysisMutation.mutate();
  };

  if (!currentRepository) {
    return (
      <Card className="border-2 border-dashed" data-testid="card-no-repository">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <FileCode className="h-16 w-16 text-muted-foreground mb-4" />
          <p className="text-muted-foreground text-center">
            Please select a repository to run test coverage analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  if (currentRepository.cloneStatus !== 'cloned') {
    return (
      <Card className="border-2 border-dashed" data-testid="card-not-cloned">
        <CardContent className="flex flex-col items-center justify-center p-12">
          <AlertCircle className="h-16 w-16 text-yellow-500 mb-4" />
          <p className="text-muted-foreground text-center">
            Repository must be cloned before running test coverage analysis
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6" data-testid="test-coverage-panel">
      {/* Workflow Progression Button - Show at top when test coverage is complete */}
      {latestTestCoverageReport && (
        <div className="flex justify-center pt-2 pb-4">
          <Button
            onClick={() => {
              unlockTab('code-analysis');
              switchToTab('code-analysis');
              toast({
                title: "Code Analysis Unlocked",
                description: "Navigating to Code Analysis tab",
              });
            }}
            size="lg"
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            data-testid="button-goto-code-analysis"
          >
            Go to Code Analysis
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileCode className="h-5 w-5" />
            Initial Test Coverage & Validation
          </CardTitle>
          <CardDescription>
            AI-powered comprehensive test coverage analysis for your codebase.
            Identifies missing tests, generates test cases, and provides coverage metrics.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Button
              onClick={handleRunAnalysis}
              disabled={isAnalyzing || runAnalysisMutation.isPending}
              className="flex items-center gap-2"
              data-testid="button-run-analysis"
            >
              {isAnalyzing || runAnalysisMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Analyzing Test Coverage...
                </>
              ) : (
                <>
                  <Play className="h-4 w-4" />
                  Run Test Coverage Analysis
                </>
              )}
            </Button>
          </div>

          {runAnalysisMutation.isError && (
            <Card className="border-red-200 dark:border-red-800" data-testid="alert-analysis-error">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                  <AlertCircle className="h-5 w-5" />
                  Test Coverage Analysis Failed
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm mb-4 text-red-600 dark:text-red-400">
                  {runAnalysisMutation.error?.message || 'Test coverage analysis failed'}
                </p>
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                  <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                    <strong>Common solutions:</strong>
                  </p>
                  <ul className="list-disc list-inside text-sm space-y-1 text-red-600 dark:text-red-400">
                    <li>Check AI settings and ensure API credentials are configured</li>
                    <li>If using EPAM AI API, verify VPN connection is active</li>
                    <li>Ensure the repository contains C# source files</li>
                    <li>Check network connectivity and try again</li>
                  </ul>
                </div>
              </CardContent>
            </Card>
          )}

          {isAnalyzing && (
            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800" data-testid="alert-analyzing">
              <CardContent className="p-4 flex items-start gap-3">
                <Loader2 className="h-5 w-5 text-blue-600 dark:text-blue-400 animate-spin flex-shrink-0 mt-0.5" />
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  Analyzing test coverage... This may take several minutes depending on repository size.
                </p>
              </CardContent>
            </Card>
          )}
        </CardContent>
      </Card>

      {/* Show loading state when initially loading OR when analysis is running (includes refetch wait) */}
      {(reportsLoading && !latestTestCoverageReport) || isAnalyzing ? (
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            {isAnalyzing ? 'Running test coverage analysis...' : 'Loading test coverage report...'}
          </CardContent>
        </Card>
      ) : latestTestCoverageReport ? (
        <TestCoverageViewer report={latestTestCoverageReport} />
      ) : (
        <Card className="border-2 border-dashed" data-testid="card-no-reports">
          <CardContent className="flex flex-col items-center justify-center p-12">
            <FileCode className="h-16 w-16 text-muted-foreground mb-4" />
            <p className="text-lg font-medium mb-2">No Test Coverage Reports</p>
            <p className="text-muted-foreground text-center">
              Run test coverage analysis to generate your first report
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
