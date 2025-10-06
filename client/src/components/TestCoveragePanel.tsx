import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppContext } from "@/context/AppContext";
import { Play, FileCode, Loader2, AlertCircle } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import TestCoverageViewer from "./TestCoverageViewer";

export default function TestCoveragePanel() {
  const { currentRepository } = useAppContext();
  const queryClient = useQueryClient();
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
      const response = await apiRequest('/api/analysis/test-coverage', 'POST', {
        repositoryId: currentRepository.id
      });
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis/reports', currentRepository?.id] });
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
            <Card className="bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800" data-testid="alert-analysis-error">
              <CardContent className="p-4 flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-800 dark:text-red-200">
                  {runAnalysisMutation.error?.message || 'Test coverage analysis failed'}
                </p>
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

      {reportsLoading ? (
        <Card>
          <CardContent className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
