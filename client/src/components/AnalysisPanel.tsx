import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useAnalysis } from "@/hooks/useAnalysis";
import { useAppContext } from "../context/AppContext";
import { Brain, CheckCircle, Shield, Wrench, AlertTriangle, Lightbulb, FileText, Code, ArrowRight, GitCompare } from "lucide-react";
import { MigrationReportViewer } from "./MigrationReportViewer";

export default function AnalysisPanel() {
  const [analysisType, setAnalysisType] = useState("migration");
  const { currentRepository, isCodeAnalysisEnabled } = useAppContext();
  
  const handleAnalysisTypeChange = (type: string) => {
    setAnalysisType(type);
  };
  
  const { analyzeCode, analysisResult, isLoading } = useAnalysis();

  const handleAnalysis = async () => {
    if (!currentRepository?.id) {
      return;
    }
    
    await analyzeCode(currentRepository.id);
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
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">OpenAI Code Analysis</h2>
          <Button 
            onClick={handleAnalysis}
            disabled={isLoading || !currentRepository || !isCodeAnalysisEnabled}
            data-testid="button-analyze-code"
            className="hover-lift transition-smooth group relative overflow-hidden gradient-primary"
          >
            <AnimatePresence mode="wait">
              {isLoading ? (
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
                  Analyze Code
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Pulse effect when analyzing */}
            {isLoading && (
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
            <label className="block text-sm font-medium mb-2">Analysis Type</label>
            <Select value={analysisType} onValueChange={handleAnalysisTypeChange}>
              <SelectTrigger data-testid="select-analysis-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="migration">Migration Analysis</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
      
      <ScrollArea className="flex-1 p-4">
        {analysisType === 'migration' ? (
          // Always show MigrationReportViewer for migration analysis
          <MigrationReportViewer 
            key={currentRepository?.id || 'default'} 
            repositoryId={currentRepository?.id || 'default'} 
          />
        ) : (
          <div className="text-center py-12 text-muted-foreground" data-testid="analysis-empty-state">
            <Brain className="h-16 w-16 mx-auto mb-4 opacity-30" />
            <h3 className="text-lg font-medium mb-2">Ready for Analysis</h3>
            <p className="text-sm mb-4">Clone a repository and click "Analyze Code" to get AI-powered insights</p>
            <div className="grid grid-cols-2 gap-4 max-w-md mx-auto">
              <Card className="p-3">
                <CheckCircle className="h-6 w-6 text-primary mb-2" />
                <p className="text-xs font-medium">Code Quality</p>
              </Card>
              <Card className="p-3">
                <Shield className="h-6 w-6 text-green-500 mb-2" />
                <p className="text-xs font-medium">Security Scan</p>
              </Card>
              <Card className="p-3">
                <Wrench className="h-6 w-6 text-yellow-500 mb-2" />
                <p className="text-xs font-medium">Performance</p>
              </Card>
              <Card className="p-3">
                <Brain className="h-6 w-6 text-purple-500 mb-2" />
                <p className="text-xs font-medium">Architecture</p>
              </Card>
            </div>
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
