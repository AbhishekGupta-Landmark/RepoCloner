import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAppContext } from "../context/AppContext";
import { Brain, CheckCircle, Shield, Wrench, AlertTriangle, Lightbulb, FileText, Code, ArrowRight, GitCompare, Sparkles, ChevronDown } from "lucide-react";
import { MigrationReportViewer } from "./MigrationReportViewer";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface AnalysisType {
  id: string;
  label: string;
  scriptPath: string;
}

// Migration type configuration
const MIGRATION_TYPES = [
  {
    id: 'kafka-to-service-bus',
    label: 'Kafka to Azure Service Bus',
    description: 'Migrate Kafka producers and consumers to Azure Service Bus',
    isImplemented: true
  },
  {
    id: 'kafka-to-event-hub',
    label: 'Kafka to Azure Event Hub',
    description: 'Migrate Kafka producers and consumers to Azure Event Hub',
    isImplemented: false
  },
  {
    id: 'mq-to-service-bus',
    label: 'MQ to Azure Service Bus',
    description: 'Migrate IBM MQ or other message queues to Azure Service Bus',
    isImplemented: false
  },
  {
    id: 'rabbitmq-to-service-bus',
    label: 'RabbitMQ to Azure Service Bus',
    description: 'Migrate RabbitMQ queues and exchanges to Azure Service Bus',
    isImplemented: false
  }
];

export default function AnalysisPanel() {
  const [selectedAnalysisTypeId, setSelectedAnalysisTypeId] = useState<string>("");
  const [selectedMigrationTypes, setSelectedMigrationTypes] = useState<string[]>(['kafka-to-service-bus']);
  const [migrationTypesOpen, setMigrationTypesOpen] = useState(true);
  const { currentRepository, isCodeAnalysisEnabled, unlockTab, switchToTab } = useAppContext();
  const { toast } = useToast();
  
  // Load analysis types from API
  const { data: analysisTypesData, isLoading: isLoadingTypes } = useQuery<{ types: AnalysisType[] }>({
    queryKey: ['/api/analysis/types'],
  });
  
  const analysisTypes = analysisTypesData?.types || [];
  
  // Check if report exists for selected analysis type (for button text)
  const { data: existingReport } = useQuery<{ structuredData?: any; status?: string; createdAt?: string; id?: string }>({
    queryKey: ['structured-report', currentRepository?.id, selectedAnalysisTypeId],
    enabled: !!currentRepository?.id && !!selectedAnalysisTypeId,
    staleTime: 0, // Always check for latest
  });
  
  const hasExistingReport = !!(existingReport?.structuredData);
  
  // Fetch all reports for iteration number calculation
  const { data: allReportsData } = useQuery<{ reports: Array<{ id: string; analysisType: string; createdAt: string }> }>({
    queryKey: ['/api/analysis/reports', currentRepository?.id],
    enabled: !!currentRepository?.id,
    staleTime: 0,
  });
  
  // Calculate iteration number for current report
  const calculateIterationNumber = () => {
    if (!allReportsData?.reports || !existingReport?.createdAt || !selectedAnalysisTypeId) {
      return 1;
    }
    
    const currentReportTime = new Date(existingReport.createdAt).getTime();
    const iterationNumber = allReportsData.reports
      .filter(r => r.analysisType === selectedAnalysisTypeId)
      .filter(r => {
        const rTime = new Date(r.createdAt).getTime();
        return rTime <= currentReportTime;
      })
      .length;
    
    return iterationNumber || 1;
  };
  
  const iterationNumber = calculateIterationNumber();
  
  // Reset selection when repository changes
  useEffect(() => {
    setSelectedAnalysisTypeId("");
  }, [currentRepository?.id]);
  
  // Auto-select first available analysis type if none is selected
  useEffect(() => {
    if (!selectedAnalysisTypeId && analysisTypes.length > 0 && currentRepository) {
      // Default to Quick Migration Analysis if available, otherwise first type
      const defaultType = analysisTypes.find(t => t.id === 'quick-migration-1') || analysisTypes[0];
      if (defaultType) {
        setSelectedAnalysisTypeId(defaultType.id);
      }
    }
  }, [analysisTypes, currentRepository, selectedAnalysisTypeId]);
  
  const handleAnalysisTypeChange = (typeId: string) => {
    setSelectedAnalysisTypeId(typeId);
  };
  
  const { analyzeCode, analysisResult, isLoading } = useAnalysis();
  
  // Track global analysis mutations (works across all components)
  const isMutating = useIsMutating({ mutationKey: ['analysis'] });
  const isAnalyzing = isLoading || isMutating > 0;

  const handleAnalysis = async () => {
    if (!currentRepository?.id || !selectedAnalysisTypeId) {
      return;
    }
    
    // No need to set hasRunAnalysis - it's derived from cached data now
    await analyzeCode(currentRepository.id, selectedAnalysisTypeId);
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'destructive';
      case 'high': return 'destructive';
      case 'medium': return 'warning';
      case 'low': return 'secondary';
      default: return 'secondary';
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-500';
    if (score >= 60) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-lg font-semibold text-foreground mb-4">AI Code Analysis</h2>
        
        {/* Horizontal button layout: Analyze Code (left) + Proceed to Migration (right, only when complete) */}
        <div className="flex items-center justify-between gap-4 mb-4">
          <Button 
            onClick={handleAnalysis}
            disabled={
              isAnalyzing || 
              !currentRepository || 
              !isCodeAnalysisEnabled || 
              !selectedAnalysisTypeId ||
              // Disable if migration analysis is selected but no migration types are chosen
              ((selectedAnalysisTypeId === 'default' || selectedAnalysisTypeId === 'quick-migration-1') && selectedMigrationTypes.length === 0)
            }
            data-testid="button-analyze-code"
            variant="default"
            className="hover-lift transition-smooth group relative overflow-hidden text-white font-medium"
          >
            <AnimatePresence mode="wait">
              {isAnalyzing ? (
                <motion.div
                  key="analyzing"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                    transition={{ 
                      rotate: { duration: 2, repeat: Infinity, ease: "linear" },
                      scale: { duration: 1, repeat: Infinity, ease: "easeInOut" }
                    }}
                  >
                    <Brain className="h-4 w-4" />
                  </motion.div>
                  <span className="loading-dots">Analyzing code</span>
                </motion.div>
              ) : (
                <motion.div
                  key="idle"
                  className="flex items-center gap-2"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 15 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <Brain className="h-4 w-4" />
                  </motion.div>
                  {hasExistingReport ? 'Re-Analyze Code' : 'Analyze Code'}
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Pulse effect when analyzing */}
            {isAnalyzing && (
              <motion.div
                className="absolute inset-0 bg-primary/20 rounded"
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
          </Button>
        </div>
        
        <div className="flex gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium mb-2 text-foreground">Analysis Type</label>
            <Select 
              value={selectedAnalysisTypeId || undefined} 
              onValueChange={handleAnalysisTypeChange}
              disabled={isLoadingTypes || analysisTypes.length === 0}
            >
              <SelectTrigger data-testid="select-analysis-type">
                <SelectValue placeholder={isLoadingTypes ? "Loading..." : "Choose analysis type..."} />
              </SelectTrigger>
              <SelectContent>
                {analysisTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id} data-testid={`option-analysis-${type.id}`}>
                    {type.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Migration Type Checkboxes - Show when migration analysis is selected */}
        {selectedAnalysisTypeId && (selectedAnalysisTypeId === 'default' || selectedAnalysisTypeId === 'quick-migration-1') && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="mt-4"
          >
            <Collapsible open={migrationTypesOpen} onOpenChange={setMigrationTypesOpen}>
              <Card className="border-2 border-primary/20">
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between cursor-pointer">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <CardTitle className="text-base">Select Migration Type(s)</CardTitle>
                      </div>
                      <ChevronDown className={`h-5 w-5 text-primary transition-transform duration-200 ${migrationTypesOpen ? 'rotate-180' : ''}`} />
                    </div>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {MIGRATION_TYPES.map((type) => (
                        <div 
                          key={type.id}
                          className={`flex items-start space-x-3 p-3 rounded-lg border-2 transition-all ${
                            selectedMigrationTypes.includes(type.id)
                              ? 'border-primary bg-primary/5'
                              : 'border-border hover:border-primary/30 hover:bg-muted/50'
                          } ${!type.isImplemented ? 'opacity-60' : ''}`}
                        >
                          <Checkbox
                            id={type.id}
                            checked={selectedMigrationTypes.includes(type.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setSelectedMigrationTypes([...selectedMigrationTypes, type.id]);
                              } else {
                                setSelectedMigrationTypes(selectedMigrationTypes.filter(id => id !== type.id));
                              }
                            }}
                            disabled={!type.isImplemented}
                            data-testid={`checkbox-migration-${type.id}`}
                            className="mt-0.5"
                          />
                          <div className="flex-1">
                            <Label 
                              htmlFor={type.id} 
                              className={`font-medium text-sm cursor-pointer ${!type.isImplemented ? 'cursor-not-allowed' : ''}`}
                            >
                              {type.label}
                              {!type.isImplemented && (
                                <Badge variant="secondary" className="ml-2 text-xs">Coming Soon</Badge>
                              )}
                            </Label>
                            <p className="text-xs text-muted-foreground mt-1">
                              {type.description}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                    {selectedMigrationTypes.length === 0 && (
                      <p className="text-sm text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4" />
                        Please select at least one migration type to proceed
                      </p>
                    )}
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>
          </motion.div>
        )}
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {!currentRepository ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="analysis-no-repo">
            <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">No Repository Selected</h3>
            <p className="text-sm mb-4">Clone a repository to start code analysis</p>
          </div>
        ) : !selectedAnalysisTypeId ? (
          <div className="text-center py-12 text-muted-foreground" data-testid="analysis-no-type">
            <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Select Analysis Type</h3>
            <p className="text-sm mb-4">Choose an analysis type from the dropdown above, then click "Analyze Code"</p>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto mt-6">
              <Card className="p-3">
                <GitCompare className="h-6 w-6 text-primary mb-2" />
                <p className="text-xs font-medium">Migration Analysis</p>
              </Card>
              <Card className="p-3">
                <Code className="h-6 w-6 text-green-500 mb-2" />
                <p className="text-xs font-medium">Code Quality</p>
              </Card>
              <Card className="p-3">
                <Shield className="h-6 w-6 text-yellow-500 mb-2" />
                <p className="text-xs font-medium">Security Scan</p>
              </Card>
              <Card className="p-3">
                <Brain className="h-6 w-6 text-purple-500 mb-2" />
                <p className="text-xs font-medium">Quick Analysis</p>
              </Card>
            </div>
          </div>
        ) : selectedAnalysisTypeId && currentRepository?.id ? (
          // Show MigrationReportViewer when analysis type is selected
          // It handles its own loading/error/no-data states
          <>
            <MigrationReportViewer 
              key={`${currentRepository.id}-${selectedAnalysisTypeId}`}
              repositoryId={currentRepository.id}
              analysisType={selectedAnalysisTypeId}
              iterationNumber={iterationNumber}
            />
            
            {/* Workflow Progression Button - Show after analysis is complete */}
            {hasExistingReport && (
              <div className="flex justify-center py-6 px-4">
                <Button
                  onClick={() => {
                    unlockTab('code-migration');
                    switchToTab('code-migration');
                    toast({
                      title: "Code Migration Unlocked",
                      description: "Navigating to Code Migration tab",
                    });
                  }}
                  className="flex items-center gap-2"
                  data-testid="button-proceed-to-migration"
                >
                  Proceed to Migration
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </>
        ) : null}
      </ScrollArea>
    </div>
  );
}
