import { useState } from 'react';
import { useQuery, useIsMutating, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { FileText, Code, BarChart3, Loader2, AlertTriangle, GitBranch, Code2, CheckCircle, ChevronDown, RotateCw, Brain, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAnalysis } from '@/hooks/useAnalysis';
import DiffViewer from '@/components/ui/DiffViewer';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useAppContext } from '@/context/AppContext';
import { motion, AnimatePresence } from 'framer-motion';

interface KafkaUsageItem {
  file: string;
  apis_used: string;
  summary: string;
}

interface CodeDiff {
  file: string;
  diff_content: string;
  migrated_code?: string;
  language: string;
  hunks?: any[];
  stats?: any;
  key_changes?: string[];
  notes?: string[];
  description?: string;
}

interface MigrationReportData {
  title: string;
  kafka_inventory: KafkaUsageItem[];
  code_diffs: CodeDiff[];
  sections: Record<string, any>;
  key_changes?: string[];
  notes?: string[];
  analysisTypeLabel?: string;
  stats: {
    total_files_with_kafka: number;
    total_files_with_diffs: number;
    sections_count: number;
  };
}

interface MigrationReportViewerProps {
  repositoryId: string;
  analysisType?: string;
}

export function MigrationReportViewer({ repositoryId, analysisType }: MigrationReportViewerProps) {
  const [keyChangesOpen, setKeyChangesOpen] = useState(true);
  
  // Get analysis functions and loading state
  const { analyzeCode, isLoading } = useAnalysis();
  const queryClient = useQueryClient();
  const { canAccessMigration, enableMigrationAccess, switchToTab } = useAppContext();
  
  // Track global analysis mutations (works across all components)
  const isMutating = useIsMutating({ mutationKey: ['analysis'] });
  const isAnalyzing = isLoading || isMutating > 0;
  
  // Check cache for failed status first
  const cachedData = queryClient.getQueryData(['structured-report', repositoryId, analysisType || 'all']) as any;
  const hasCachedFailure = cachedData?.status === 'failed';
  
  const { data: queryData, isLoading: isQueryLoading, error, refetch } = useQuery({
    queryKey: ['structured-report', repositoryId, analysisType || 'all'],
    queryFn: async () => {
      const url = analysisType 
        ? `/api/reports/${repositoryId}/structured?analysisType=${encodeURIComponent(analysisType)}`
        : `/api/reports/${repositoryId}/structured`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Failed to fetch structured migration data');
      }
      
      // Check content type to ensure we're getting JSON
      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('Expected JSON but got:', contentType, text.substring(0, 200));
        throw new Error(`Server returned ${contentType || 'non-JSON'} instead of JSON`);
      }
      
      return response.json();
    },
    // CRITICAL: Don't fetch if we have a cached failure - this prevents overwriting the error state
    enabled: !!repositoryId && !hasCachedFailure,
    // Only poll when analysis might be in progress, stop when completed OR failed
    refetchInterval: (query) => {
      const currentData = query.state.data as any;
      // Stop polling if we have a ready report, failed status, or if there's no analysis yet
      return currentData?.status === 'ready' || currentData?.status === 'completed' || currentData?.status === 'no_analysis' || currentData?.status === 'failed' ? false : 5000;
    },
    staleTime: 0, // Always consider data stale to ensure fresh fetches
    retry: false // Don't retry to avoid showing stale errors
  });
  
  // Use cached data if we have a failure, otherwise use query data
  const data = hasCachedFailure ? cachedData : queryData;
  
  // Show loading state when initially loading OR when analysis is running
  if ((isQueryLoading && !data) || isAnalyzing) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin mr-2" />
          {isAnalyzing ? 'Running migration analysis...' : 'Loading migration report...'}
        </CardContent>
      </Card>
    );
  }

  // Handle fetch errors - never show HTML parsing errors to user
  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // HTML parsing errors mean no report exists yet - show friendly prompt
    if (errorMessage.includes('<!DOCTYPE') || errorMessage.includes('HTML') || errorMessage.includes('non-JSON')) {
      return (
        <Card>
          <CardContent className="text-center py-12">
            <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
            <p className="text-sm text-muted-foreground">Click the "Analyze Code" button above to start the analysis</p>
          </CardContent>
        </Card>
      );
    }
    
    // Real error - show it
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-red-500 text-center">
            {errorMessage}
          </p>
        </CardContent>
      </Card>
    );
  }

  // Handle different analysis states
  if (!data || !data.structuredData) {
    // Analysis failed - show error message (CHECK THIS FIRST!)
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
                  <li>Check AI settings and ensure AI API credentials are valid</li>
                  <li>Verify the repository contains Kafka-related code</li>
                  <li>Try running the analysis again</li>
                </ul>
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={async () => {
                    await analyzeCode(repositoryId, analysisType);
                    refetch(); // Force refresh the query immediately after analysis
                  }}
                  disabled={isAnalyzing}
                  className="text-white border-white/30 hover:bg-red-600 hover:border-red-500 hover:text-white"
                >
                  <RotateCw className={`h-4 w-4 mr-2 ${isAnalyzing ? 'animate-spin' : ''}`} />
                  {isAnalyzing ? 'Running Analysis...' : 'Check Again'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      );
    }

    // No analysis has been run yet - show simple ready state
    return (
      <Card>
        <CardContent className="text-center py-12">
          <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
          <h3 className="text-lg font-medium mb-2">Ready to Analyze</h3>
          <p className="text-sm text-muted-foreground">Click the "Analyze Code" button above to start the analysis</p>
        </CardContent>
      </Card>
    );
  }

  const reportData: MigrationReportData = data.structuredData;

  // Extract all key changes from report level and code diffs
  const allKeyChanges: string[] = [];
  if (reportData.key_changes) {
    allKeyChanges.push(...reportData.key_changes);
  }
  
  // Also extract key_changes from individual code diffs
  if (reportData.code_diffs && Array.isArray(reportData.code_diffs)) {
    reportData.code_diffs.forEach(diff => {
      if (diff.key_changes) {
        allKeyChanges.push(...diff.key_changes);
      }
    });
  }
  
  // Remove duplicates
  const uniqueKeyChanges = Array.from(new Set(allKeyChanges));
  
  // Extract all notes from code diffs and report level
  const allNotes: string[] = [];
  
  // Add report-level notes if they exist
  if (reportData.notes) {
    allNotes.push(...reportData.notes);
  }
  
  // Extract notes from code diffs
  if (reportData.code_diffs && Array.isArray(reportData.code_diffs)) {
    reportData.code_diffs.forEach(diff => {
      if (diff.notes) {
        allNotes.push(...diff.notes);
      }
    });
  }

  // Get report title with timestamp and iteration suffix
  // Format: Title_YYYY-MM-DDTHH-MM-SS_Iteration[N]
  const timestamp = new Date(data.createdAt).toISOString().replace(/:/g, '-').split('.')[0];
  
  // Calculate iteration number: we need to fetch all reports and count same-type reports before this one
  // For now, use a placeholder - this should be passed from parent or calculated from context
  const iterationNumber = 1; // TODO: Calculate from all reports of same type
  
  const suffix = `_${timestamp}_Iteration${iterationNumber}`;
  const reportTitle = `Kafka → Azure Service Bus Migration Report${suffix}`;
  const reportSubtitle = `Generated on ${new Date(data.createdAt).toLocaleDateString()}`;

  // Check if this specific report has been accessed for migration
  const hasAccessedThisReport = canAccessMigration(data.id);

  return (
    <div className="space-y-6" data-testid="migration-report-viewer">
      {/* Proceed to Code Migration Button - Only shown if not already accessed for THIS report */}
      {!hasAccessedThisReport && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
        >
          <Card className="border-2 border-primary/50 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5">
            <CardContent className="py-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <motion.div
                    animate={{ 
                      scale: [1, 1.1, 1],
                    }}
                    transition={{ 
                      duration: 2,
                      repeat: Infinity,
                      ease: "easeInOut"
                    }}
                    className="flex-shrink-0"
                  >
                    <Sparkles className="h-8 w-8 text-primary" />
                  </motion.div>
                  <div className="text-left min-w-0">
                    <h3 className="text-base font-semibold">Analysis Complete!</h3>
                    <p className="text-sm text-muted-foreground">
                      Your migration analysis is ready. Review the insights above, and when you're satisfied, proceed to the Code Migration tab where you can review AI-generated changes, modify them if needed, and push approved updates to your Git repository.
                    </p>
                  </div>
                </div>
                <Button
                  onClick={() => {
                    enableMigrationAccess(data.id);
                    switchToTab('migration');
                  }}
                  className="group relative overflow-hidden bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-white font-medium flex-shrink-0 w-full sm:w-auto"
                  data-testid="button-proceed-to-migration"
                >
                  <motion.div
                    className="flex items-center gap-2"
                    whileHover={{ scale: 1.05 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <span>Proceed to Code Migration</span>
                    <ArrowRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                  </motion.div>
                  
                  {/* Animated background shimmer */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: '200%' }}
                    transition={{ 
                      duration: 3,
                      repeat: Infinity,
                      ease: "linear"
                    }}
                  />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Header */}
      <Card>
        <CardHeader>
          <div>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              {reportTitle}
            </CardTitle>
            <CardDescription>
              {reportSubtitle}
            </CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {reportData.stats?.total_files_with_kafka || 0}
              </div>
              <p className="text-sm text-muted-foreground">Files with Kafka</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {reportData.stats?.total_files_with_diffs || 0}
              </div>
              <p className="text-sm text-muted-foreground">Code Migrations</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-primary">
                {(reportData.kafka_inventory?.length > 0 ? 1 : 0) + (reportData.code_diffs?.length > 0 ? 1 : 0)}
              </div>
              <p className="text-sm text-muted-foreground">Report Sections</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Changes Section */}
      {uniqueKeyChanges.length > 0 && (
        <Collapsible open={keyChangesOpen} onOpenChange={setKeyChangesOpen}>
          <Card className="border-yellow-200 dark:border-yellow-800" data-testid="section-key-changes">
            <CardHeader>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between cursor-pointer">
                  <div>
                    <CardTitle className="flex items-center gap-2 text-yellow-600 dark:text-yellow-400">
                      <CheckCircle className="h-5 w-5" />
                      Key Changes{suffix}
                      <Badge variant="secondary" className="ml-2">{uniqueKeyChanges.length}</Badge>
                    </CardTitle>
                    <CardDescription>
                      Critical modifications required for Kafka to Azure Service Bus migration
                    </CardDescription>
                  </div>
                  <ChevronDown className={`h-5 w-5 text-yellow-600 dark:text-yellow-400 transition-transform duration-200 ${keyChangesOpen ? 'rotate-180' : ''}`} />
                </div>
              </CollapsibleTrigger>
            </CardHeader>
            <CollapsibleContent>
              <CardContent>
                <div className="space-y-3">
                  {uniqueKeyChanges.map((change, index) => (
                    <div key={index} className="flex items-start gap-3 p-3 bg-yellow-50 dark:bg-yellow-950/30 rounded-lg border border-yellow-200 dark:border-yellow-800" data-testid={`text-key-change-${index}`}>
                      <div className="w-2 h-2 bg-yellow-500 rounded-full mt-2 flex-shrink-0"></div>
                      <p className="text-sm text-yellow-800 dark:text-yellow-200 leading-relaxed">
                        {change}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Notes Section */}
      {allNotes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Important Notes
            </CardTitle>
            <CardDescription>
              Key observations and recommendations from the migration analysis
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {allNotes.map((note, index) => (
                <div key={index} className="flex items-start gap-3 p-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800">
                  <div className="w-2 h-2 bg-amber-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-amber-800 dark:text-amber-200 leading-relaxed">
                    {note}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs defaultValue="inventory" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="inventory" className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            Kafka Inventory{suffix}
          </TabsTrigger>
          <TabsTrigger value="diffs" className="flex items-center gap-2">
            <Code className="h-4 w-4" />
            Code Migrations{suffix}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="inventory" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Kafka Usage Analysis{suffix}</CardTitle>
              <CardDescription>
                Files in your repository that use Kafka APIs
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!reportData.kafka_inventory || reportData.kafka_inventory.length === 0 ? (
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
                            {(item.apis_used || '').split(',').filter(api => api.trim()).map((api, apiIndex) => (
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
          {/* Code Diffs */}
          {reportData.code_diffs && reportData.code_diffs.length > 0 ? (
            <DiffViewer diffs={reportData.code_diffs} />
          ) : (
            <Card>
              <CardContent className="py-8">
                <p className="text-muted-foreground text-center">
                  No code migrations found in this analysis.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}