import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Code, BarChart3, Loader2, RefreshCw, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysis } from '@/hooks/useAnalysis';

interface KafkaUsageItem {
  file: string;
  apis_used: string;
  summary: string;
}

interface CodeDiff {
  file: string;
  diff_content: string;
  language: string;
}

interface MigrationReportData {
  title: string;
  kafka_inventory: KafkaUsageItem[];
  code_diffs: CodeDiff[];
  sections: Record<string, any>;
  stats: {
    total_files_with_kafka: number;
    total_files_with_diffs: number;
    sections_count: number;
  };
}

interface MigrationReportViewerProps {
  repositoryId: string;
}

export function MigrationReportViewer({ repositoryId }: MigrationReportViewerProps) {
  // Get analysis functions and loading state
  const { analyzeCode, isLoading: isAnalyzing } = useAnalysis();
  
  const { data, isLoading: isQueryLoading, error, refetch } = useQuery({
    queryKey: ['structured-report', repositoryId],
    queryFn: async () => {
      const response = await fetch(`/api/reports/${repositoryId}/structured`);
      if (!response.ok) {
        throw new Error('Failed to fetch structured migration data');
      }
      return response.json();
    },
    enabled: !!repositoryId,
    refetchInterval: 30000 // Auto-refresh every 30 seconds
  });
  
  // Only show loading card when initially loading data (not during analysis)
  if (isQueryLoading && !data) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          Loading migration report...
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-red-500 text-center">
            Failed to load migration report: {error instanceof Error ? error.message : 'Unknown error'}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Handle different analysis states
  if (!data?.structuredData) {
    // Analysis failed - show error message
    if (data?.status === 'failed') {
      return (
        <div className="space-y-4">
          <Card className="border-red-200 dark:border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
                Migration Analysis Failed
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm mb-4 text-red-600 dark:text-red-400">
                Migration Analysis failed due to: {data.error}
              </p>
              <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-md">
                <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                  <strong>Common solutions:</strong>
                </p>
                <ul className="list-disc list-inside text-sm space-y-1 text-red-600 dark:text-red-400">
                  <li>Check AI settings and ensure EPAM Claude API credentials are valid</li>
                  <li>Verify the repository contains Kafka-related code</li>
                  <li>Try running the analysis again</li>
                </ul>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => {
                    await analyzeCode(repositoryId);
                  }}
                  disabled={isAnalyzing}
                  className="border-red-200 text-red-600 hover:bg-red-50"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  {isAnalyzing ? 'Running Analysis...' : 'Check Again'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // No analysis has been run yet - show setup instructions
    return (
      <div className="space-y-4">
        <Card className="border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <FileText className="h-5 w-5" />
              Migration Analysis Setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-3">
              No structured migration report available yet. To generate one:
            </p>
            <ol className="list-decimal list-inside text-sm space-y-1 text-muted-foreground">
              <li>Configure AI settings with your EPAM Claude API credentials</li>
              <li>Clone a repository containing Kafka code</li>
              <li>The AI will automatically analyze and generate a migration report</li>
            </ol>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="py-8">
            <div className="text-center">
              <BarChart3 className="mx-auto h-12 w-12 text-muted-foreground/50 mb-4" />
              <h3 className="text-lg font-medium mb-2">Migration Analysis Setup</h3>
              <p className="text-muted-foreground">
                Once you run AI analysis on a Kafka repository, the structured migration data will appear here.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const reportData: MigrationReportData = data.structuredData;

  return (
    <div className="space-y-6" data-testid="migration-report-viewer">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                {reportData.title}
              </CardTitle>
              <CardDescription>
                Generated on {new Date(data.createdAt).toLocaleDateString()}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => refetch()}
                disabled={isQueryLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isQueryLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {reportData.stats.total_files_with_kafka}
              </div>
              <p className="text-sm text-muted-foreground">Files with Kafka</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {reportData.stats.total_files_with_diffs}
              </div>
              <p className="text-sm text-muted-foreground">Code Migrations</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {reportData.stats.sections_count}
              </div>
              <p className="text-sm text-muted-foreground">Report Sections</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Kafka Inventory
          </TabsTrigger>
          <TabsTrigger value="diffs" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Code Migrations
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kafka Usage Analysis</CardTitle>
              <CardDescription>
                Files in your repository that use Kafka APIs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.kafka_inventory.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No Kafka usage detected in this repository.
                </p>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-4">
                    {reportData.kafka_inventory.map((item, index) => (
                      <Card key={index} className="border-l-4 border-l-blue-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-medium">
                            {item.file}
                          </CardTitle>
                          <div className="flex flex-wrap gap-1">
                            {item.apis_used.split(',').map((api, apiIndex) => (
                              <Badge key={apiIndex} variant="secondary" className="text-xs">
                                {api.trim()}
                              </Badge>
                            ))}
                          </div>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">
                            {item.summary}
                          </p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="diffs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Code Migration Diffs</CardTitle>
              <CardDescription>
                File-by-file migration changes from Kafka to Azure Service Bus
              </CardDescription>
            </CardHeader>
            <CardContent>
              {reportData.code_diffs.length === 0 ? (
                <p className="text-muted-foreground text-center py-8">
                  No code migration diffs available.
                </p>
              ) : (
                <ScrollArea className="h-[600px]">
                  <div className="space-y-6">
                    {reportData.code_diffs.map((diff, index) => (
                      <Card key={index} className="border-l-4 border-l-green-500">
                        <CardHeader className="pb-2">
                          <CardTitle className="text-base font-medium flex items-center gap-2">
                            <Code className="h-4 w-4" />
                            {diff.file}
                          </CardTitle>
                          <Badge variant="outline" className="w-fit">
                            {diff.language}
                          </Badge>
                        </CardHeader>
                        <CardContent>
                          <pre className="bg-muted p-4 rounded-md overflow-x-auto text-sm">
                            <code className="whitespace-pre-wrap break-words">
                              {diff.diff_content}
                            </code>
                          </pre>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}