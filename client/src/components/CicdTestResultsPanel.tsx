import { useState, useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RefreshCw, ExternalLink, CheckCircle2, XCircle, Clock, GitBranch, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { queryClient, apiRequest } from '@/lib/queryClient';

interface CicdTestResult {
  id: string;
  provider: string;
  pipelineId: string;
  branchName: string;
  commitSha: string;
  status: string;
  conclusion: string | null;
  testsPassed: string | null;
  testsFailed: string | null;
  testsTotal: string | null;
  coveragePercent: string | null;
  pipelineUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CicdTestResultsPanelProps {
  repositoryId: string;
  provider?: string;
}

export default function CicdTestResultsPanel({ repositoryId, provider }: CicdTestResultsPanelProps) {
  const { toast } = useToast();
  const [hasAutoFetched, setHasAutoFetched] = useState(false);

  // Fetch test results
  const { data, isLoading } = useQuery<{ testResults: CicdTestResult[], provider: string }>({
    queryKey: [`/api/cicd/test-results/${repositoryId}`],
    refetchInterval: 30000, // Auto-refresh every 30 seconds
  });

  // Refresh test results mutation
  const refreshMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest(`/api/cicd/refresh/${repositoryId}`, 'POST');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [`/api/cicd/test-results/${repositoryId}`] });
      toast({
        title: "Refreshed successfully",
        description: "CI/CD test results have been updated",
      });
    },
    onError: (error) => {
      toast({
        title: "Refresh failed",
        description: (error as Error).message || "Failed to refresh test results",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    refreshMutation.mutate();
  };

  // Reset auto-fetch flag when repository changes
  useEffect(() => {
    setHasAutoFetched(false);
  }, [repositoryId]);

  // Auto-fetch CI/CD results when panel first loads
  useEffect(() => {
    if (repositoryId && !hasAutoFetched && !isLoading) {
      // Wait a bit for the repository to be set up, then auto-fetch
      const timer = setTimeout(() => {
        refreshMutation.mutate();
        setHasAutoFetched(true);
      }, 2000); // 2 second delay to allow push operations to complete
      
      return () => clearTimeout(timer);
    }
  }, [repositoryId, hasAutoFetched, isLoading]);

  const getConclusionBadge = (conclusion: string | null) => {
    switch (conclusion) {
      case 'success':
        return (
          <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100" data-testid="badge-success">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Success
          </Badge>
        );
      case 'failure':
        return (
          <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100" data-testid="badge-failure">
            <XCircle className="h-3 w-3 mr-1" />
            Failed
          </Badge>
        );
      case 'cancelled':
        return (
          <Badge className="bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-100" data-testid="badge-cancelled">
            <AlertCircle className="h-3 w-3 mr-1" />
            Cancelled
          </Badge>
        );
      default:
        return (
          <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100" data-testid="badge-pending">
            <Clock className="h-3 w-3 mr-1" />
            Pending
          </Badge>
        );
    }
  };

  const testResults = data?.testResults || [];
  const currentProvider = data?.provider || provider || 'github';
  
  // Generate provider-specific labels
  const getProviderLabel = (prov: string) => {
    switch (prov) {
      case 'github':
        return 'GitHub Actions';
      case 'gitlab':
        return 'GitLab CI/CD';
      case 'azure':
        return 'Azure Pipelines';
      case 'bitbucket':
        return 'Bitbucket Pipelines';
      default:
        return 'CI/CD';
    }
  };
  
  const providerLabel = getProviderLabel(currentProvider);

  return (
    <div className="space-y-4" data-testid="cicd-panel">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-2xl font-bold text-white dark:text-slate-100">{providerLabel} Test Results</h2>
          {testResults.length > 0 && (
            <Badge variant="outline" className="text-white dark:text-slate-300">
              {testResults.length} runs
            </Badge>
          )}
        </div>
        <Button
          onClick={handleRefresh}
          disabled={refreshMutation.isPending || isLoading}
          className="bg-blue-600 hover:bg-blue-700 text-white"
          data-testid="button-refresh"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <RefreshCw className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
            <p className="text-white dark:text-slate-300">Loading test results...</p>
          </div>
        </div>
      ) : testResults.length === 0 ? (
        <Card className="border-slate-700 bg-slate-800/50">
          <CardContent className="py-12">
            <div className="text-center">
              <GitBranch className="h-12 w-12 text-slate-500 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white dark:text-slate-200 mb-2">
                No Test Results Yet
              </h3>
              <p className="text-slate-400 dark:text-slate-500 mb-4">
                Push code to a feature branch to trigger {providerLabel} tests
              </p>
              <Button
                onClick={handleRefresh}
                variant="outline"
                className="text-white border-white/30"
                data-testid="button-refresh-empty"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Check for Results
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <ScrollArea className="h-[600px] pr-4">
          <div className="space-y-4">
            {testResults.map((result) => (
              <Card
                key={result.id}
                className="border-slate-700 bg-slate-800/50 hover:bg-slate-800/70 transition-colors"
                data-testid={`test-result-${result.pipelineId}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2">
                        {getConclusionBadge(result.conclusion)}
                        <Badge variant="outline" className="text-white dark:text-slate-300">
                          <GitBranch className="h-3 w-3 mr-1" />
                          {result.branchName}
                        </Badge>
                      </div>
                      <CardTitle className="text-lg text-white dark:text-slate-100">
                        {currentProvider === 'gitlab' ? 'Pipeline' : 'Workflow Run'} #{result.pipelineId}
                      </CardTitle>
                      <p className="text-sm text-slate-400 dark:text-slate-500 font-mono">
                        {result.commitSha.substring(0, 7)}
                      </p>
                    </div>
                    {result.pipelineUrl && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(result.pipelineUrl!, '_blank')}
                        className="text-white border-white/30"
                        data-testid={`button-view-${result.pipelineId}`}
                      >
                        <ExternalLink className="h-4 w-4 mr-1" />
                        View on {currentProvider === 'github' ? 'GitHub' : currentProvider === 'gitlab' ? 'GitLab' : 'Provider'}
                      </Button>
                    )}
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {result.testsTotal && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Total Tests</p>
                        <p className="text-lg font-semibold text-white dark:text-slate-100">
                          {result.testsTotal}
                        </p>
                      </div>
                    )}
                    {result.testsPassed && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Passed</p>
                        <p className="text-lg font-semibold text-green-500">
                          {result.testsPassed}
                        </p>
                      </div>
                    )}
                    {result.testsFailed && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Failed</p>
                        <p className="text-lg font-semibold text-red-500">
                          {result.testsFailed}
                        </p>
                      </div>
                    )}
                    {result.coveragePercent && (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-500 dark:text-slate-400">Coverage</p>
                        <p className="text-lg font-semibold text-blue-500">
                          {result.coveragePercent}%
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                    Updated: {new Date(result.updatedAt).toLocaleString()}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
