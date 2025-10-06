import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { 
  ChevronDown, 
  ChevronRight, 
  FileCode, 
  TestTube, 
  CheckCircle2, 
  PlusCircle,
  TrendingUp,
  Calendar,
  BarChart3
} from "lucide-react";
import type { TestCoverageReportData } from "@shared/schema";

interface TestCoverageViewerProps {
  report: {
    id: string;
    repositoryId: string;
    analysisType: string;
    results: any;
    structuredData?: TestCoverageReportData;
    createdAt: Date;
  };
}

export default function TestCoverageViewer({ report }: TestCoverageViewerProps) {
  const data = report.structuredData || report.results?.testCoverageOutput?.parsedData;
  
  if (!data) {
    return (
      <Card>
        <CardContent className="p-8">
          <p className="text-muted-foreground">No test coverage data available</p>
        </CardContent>
      </Card>
    );
  }

  const coveragePercentage = data.totalTestCasesAfterImprovements > 0
    ? Math.round((data.totalNewTestCasesAdded / data.totalTestCasesAfterImprovements) * 100)
    : 0;

  return (
    <div className="space-y-6" data-testid="test-coverage-viewer">
      {/* Header Summary Card */}
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-2xl">
            <TestTube className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            {data.title || "Test Coverage Report"}
          </CardTitle>
          <CardDescription className="flex items-center gap-4 text-base">
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {data.generatedAt || new Date(report.createdAt).toLocaleString()}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <MetricCard
              icon={<FileCode className="h-5 w-5" />}
              label="Files Analyzed"
              value={data.totalFilesAnalyzed}
              color="blue"
            />
            <MetricCard
              icon={<CheckCircle2 className="h-5 w-5" />}
              label="Original Tests"
              value={data.totalOriginalTestCases}
              color="green"
            />
            <MetricCard
              icon={<PlusCircle className="h-5 w-5" />}
              label="New Tests Added"
              value={data.totalNewTestCasesAdded}
              color="purple"
            />
            <MetricCard
              icon={<TrendingUp className="h-5 w-5" />}
              label="Total Tests"
              value={data.totalTestCasesAfterImprovements}
              color="indigo"
            />
          </div>

          {/* Coverage Progress */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">New Test Coverage</span>
              <span className="text-sm font-bold text-blue-600 dark:text-blue-400">
                {coveragePercentage}%
              </span>
            </div>
            <Progress value={coveragePercentage} className="h-3" data-testid="progress-coverage" />
            <p className="text-xs text-muted-foreground">
              {data.totalNewTestCasesAdded} new test cases added out of {data.totalTestCasesAfterImprovements} total tests
            </p>
          </div>
        </CardContent>
      </Card>

      {/* File-by-File Coverage */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Detailed File Coverage
          </CardTitle>
          <CardDescription>
            Test coverage breakdown for each source file
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {data.fileReports && data.fileReports.length > 0 ? (
            data.fileReports.map((fileReport: any, index: number) => (
              <FileReportCard key={index} fileReport={fileReport} index={index} />
            ))
          ) : (
            <p className="text-muted-foreground text-center py-8">No file reports available</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Metric Card Component
function MetricCard({ 
  icon, 
  label, 
  value, 
  color 
}: { 
  icon: React.ReactNode; 
  label: string; 
  value: number; 
  color: string;
}) {
  const colorClasses = {
    blue: "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border-blue-300 dark:border-blue-700",
    green: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border-green-300 dark:border-green-700",
    purple: "bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 border-purple-300 dark:border-purple-700",
    indigo: "bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 border-indigo-300 dark:border-indigo-700",
  };

  return (
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}

// File Report Card Component
function FileReportCard({ fileReport, index }: { fileReport: any; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  
  const totalTests = fileReport.testCasesFound + fileReport.newTestCasesAdded;
  const newTestPercentage = totalTests > 0 
    ? Math.round((fileReport.newTestCasesAdded / totalTests) * 100) 
    : 0;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} data-testid={`collapsible-file-${index}`}>
      <Card className={`border ${isOpen ? 'border-blue-400 dark:border-blue-600' : 'border-border'} transition-colors`}>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full p-4 h-auto hover:bg-muted/50"
            data-testid={`button-toggle-file-${index}`}
          >
            <div className="w-full flex items-center justify-between">
              <div className="flex items-center gap-3 text-left flex-1">
                {isOpen ? (
                  <ChevronDown className="h-5 w-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate" title={fileReport.file}>
                    {fileReport.file}
                  </p>
                  <p className="text-xs text-muted-foreground truncate" title={fileReport.testFile}>
                    Test: {fileReport.testFile || 'None'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 flex-shrink-0 ml-4">
                <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                  {fileReport.testCasesFound} existing
                </Badge>
                <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                  +{fileReport.newTestCasesAdded} new
                </Badge>
                <div className="w-24 text-right">
                  <div className="text-xs text-muted-foreground">Coverage</div>
                  <div className="text-sm font-bold">{newTestPercentage}%</div>
                </div>
              </div>
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="p-4 pt-0 space-y-4 border-t">
            {/* Mini Progress Bar */}
            <div className="space-y-1">
              <Progress value={newTestPercentage} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {fileReport.newTestCasesAdded} new tests added to {totalTests} total tests
              </p>
            </div>

            {/* Generated Test Code */}
            {fileReport.generatedTests && (
              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <TestTube className="h-4 w-4" />
                  Generated Test Cases
                </h4>
                <div className="relative rounded-lg overflow-hidden border bg-slate-950 dark:bg-slate-900">
                  <pre className="p-4 overflow-x-auto text-xs leading-relaxed">
                    <code className="text-slate-100 dark:text-slate-200">
                      {fileReport.generatedTests}
                    </code>
                  </pre>
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
