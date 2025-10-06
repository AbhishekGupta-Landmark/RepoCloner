import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { 
  ChevronDown, 
  ChevronRight, 
  FileCode, 
  TestTube, 
  CheckCircle2, 
  PlusCircle,
  TrendingUp,
  Calendar,
  BarChart3,
  Table as TableIcon,
  Code2,
  FileText,
  Target,
  Microscope,
  Sparkles,
  ArrowRight
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
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

interface TestDetailsDialogData {
  file: string;
  testFile: string;
  type: 'existing' | 'new';
  count: number;
  tests: string;
}

interface ParsedTestData {
  aiAnalysis: string;
  codeBlock: string;
  summary: string;
}

function parseGeneratedTests(text: string): ParsedTestData {
  if (!text) return { aiAnalysis: '', codeBlock: '', summary: '' };
  
  // Extract AI analysis (everything before "using System" or first code marker)
  const codeStartPatterns = [
    /^using System/m,
    /^using Xunit/m,
    /^using Moq/m,
    /^namespace /m,
    /^public class/m
  ];
  
  let aiAnalysis = '';
  let restOfText = text;
  
  for (const pattern of codeStartPatterns) {
    const match = text.match(pattern);
    if (match && match.index) {
      aiAnalysis = text.substring(0, match.index).trim();
      restOfText = text.substring(match.index);
      break;
    }
  }
  
  // Extract code block (everything from "using" until "###" or end)
  const summaryMatch = restOfText.match(/###\s*\*\*Summary\*\*/i);
  let codeBlock = '';
  let summary = '';
  
  if (summaryMatch && summaryMatch.index) {
    codeBlock = restOfText.substring(0, summaryMatch.index).trim();
    summary = restOfText.substring(summaryMatch.index).trim();
  } else {
    codeBlock = restOfText.trim();
  }
  
  return { aiAnalysis, codeBlock, summary };
}

export default function TestCoverageViewer({ report }: TestCoverageViewerProps) {
  const data = report.structuredData || report.results?.testCoverageOutput?.parsedData;
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [dialogData, setDialogData] = useState<TestDetailsDialogData | null>(null);
  
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

  // Prepare chart data
  const chartData = data.fileReports?.map((fileReport: any) => ({
    name: fileReport.file.split('\\').pop() || fileReport.file.split('/').pop() || fileReport.file,
    fullPath: fileReport.file,
    'Test Cases Found': fileReport.testCasesFound,
    'New Test Cases Added': fileReport.newTestCasesAdded,
    testFile: fileReport.testFile,
    generatedTests: fileReport.generatedTests
  })) || [];

  const handleBarClick = (fileName: string) => {
    setSelectedFile(selectedFile === fileName ? null : fileName);
  };

  const handleTestCountClick = (fileReport: any, type: 'existing' | 'new') => {
    const count = type === 'existing' ? fileReport.testCasesFound : fileReport.newTestCasesAdded;
    
    if (count === 0) return;
    
    setDialogData({
      file: fileReport.file,
      testFile: fileReport.testFile || 'No test file specified',
      type,
      count,
      tests: fileReport.generatedTests || 'No test details available'
    });
  };

  return (
    <div className="space-y-6" data-testid="test-coverage-viewer">
      {/* Beautiful Header with Gradient */}
      <Card className="border-2 border-blue-200 dark:border-blue-800 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-950 dark:via-indigo-950 dark:to-purple-950 overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"></div>
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-3 text-3xl">
            <div className="p-2 bg-blue-600 dark:bg-blue-500 rounded-lg">
              <TestTube className="h-7 w-7 text-white" />
            </div>
            {data.title || "Test Coverage Report"}
          </CardTitle>
          <CardDescription className="flex items-center gap-4 text-base mt-2">
            <span className="flex items-center gap-2 bg-white/60 dark:bg-black/30 px-3 py-1 rounded-full">
              <Calendar className="h-4 w-4" />
              {data.generatedAt || new Date(report.createdAt).toLocaleString()}
            </span>
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6 relative">
          {/* Objectives & Methodology */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="bg-white/60 dark:bg-black/30 backdrop-blur border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Target className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  Test Objectives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Assess the coverage, quality, and completeness of automated tests for the codebase, ensuring robust validation of business logic and integration points.
                </p>
              </CardContent>
            </Card>
            
            <Card className="bg-white/60 dark:bg-black/30 backdrop-blur border-0 shadow-sm">
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Microscope className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                  Methodology
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Source code and test files were analyzed using AI-driven static analysis and prompt-based test generation. Test case counts, coverage, and quality metrics were extracted and visualized for each file.
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Key Metrics Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
          <div className="space-y-3 bg-white/60 dark:bg-black/30 backdrop-blur p-4 rounded-lg">
            <div className="flex items-center justify-between">
              <span className="text-sm font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-yellow-500" />
                New Test Coverage
              </span>
              <span className="text-lg font-bold text-blue-600 dark:text-blue-400">
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

      {/* Interactive Bar Chart */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950 dark:to-indigo-950">
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            Test Case Counts per File
          </CardTitle>
          <CardDescription>
            Click on bars to view file details
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          <ResponsiveContainer width="100%" height={350}>
            <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 100 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="name" 
                angle={-45} 
                textAnchor="end" 
                height={100}
                tick={{ fill: 'currentColor', fontSize: 12 }}
              />
              <YAxis tick={{ fill: 'currentColor' }} />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--background))', 
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '8px'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar 
                dataKey="Test Cases Found" 
                fill="#10b981" 
                onClick={(data: any) => handleBarClick(data?.payload?.fullPath)}
                cursor="pointer"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-found-${index}`}
                    fill={selectedFile === entry.fullPath ? '#059669' : '#10b981'}
                  />
                ))}
              </Bar>
              <Bar 
                dataKey="New Test Cases Added" 
                fill="#a855f7"
                onClick={(data: any) => handleBarClick(data?.payload?.fullPath)}
                cursor="pointer"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-new-${index}`}
                    fill={selectedFile === entry.fullPath ? '#7e22ce' : '#a855f7'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Interactive Table */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950">
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            Test Coverage Summary
          </CardTitle>
          <CardDescription>
            Click on test counts or rows to view details
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <ScrollArea className="w-full">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-purple-600 dark:border-purple-400">
                  <th className="text-left p-4 font-semibold bg-purple-50 dark:bg-purple-900/30 whitespace-nowrap">File</th>
                  <th className="text-center p-4 font-semibold bg-purple-50 dark:bg-purple-900/30 whitespace-nowrap">Test Cases Found</th>
                  <th className="text-center p-4 font-semibold bg-purple-50 dark:bg-purple-900/30 whitespace-nowrap">New Tests Added</th>
                  <th className="text-center p-4 font-semibold bg-purple-50 dark:bg-purple-900/30 whitespace-nowrap">Coverage (%)</th>
                  <th className="text-center p-4 font-semibold bg-purple-50 dark:bg-purple-900/30 whitespace-nowrap">New Coverage (%)</th>
                </tr>
              </thead>
              <tbody>
                {data.fileReports?.map((fileReport: any, index: number) => {
                  const totalTests = fileReport.testCasesFound + fileReport.newTestCasesAdded;
                  const newTestPercentage = totalTests > 0 
                    ? Math.round((fileReport.newTestCasesAdded / totalTests) * 100) 
                    : 0;
                  const isSelected = selectedFile === fileReport.file;
                  
                  return (
                    <tr 
                      key={index} 
                      className={`border-b hover:bg-muted/50 transition-colors cursor-pointer ${isSelected ? 'bg-purple-50 dark:bg-purple-900/20' : ''}`}
                      onClick={() => handleBarClick(fileReport.file)}
                    >
                      <td className="p-4 font-mono text-sm">{fileReport.file}</td>
                      <td 
                        className="p-4 text-center hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestCountClick(fileReport, 'existing');
                        }}
                      >
                        <Badge 
                          variant="outline" 
                          className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 cursor-pointer hover:bg-green-100 dark:hover:bg-green-800/30 px-3 py-1"
                        >
                          {fileReport.testCasesFound}
                        </Badge>
                      </td>
                      <td 
                        className="p-4 text-center hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestCountClick(fileReport, 'new');
                        }}
                      >
                        <Badge 
                          variant="outline" 
                          className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30 px-3 py-1"
                        >
                          {fileReport.newTestCasesAdded}
                        </Badge>
                      </td>
                      <td className="p-4 text-center font-semibold">100%</td>
                      <td className="p-4 text-center font-semibold">{newTestPercentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Expandable File Details (when row/bar selected) */}
      {selectedFile && data.fileReports && (
        <Card className="border-2 border-purple-400 dark:border-purple-600 animate-in fade-in slide-in-from-top-2 duration-300 overflow-hidden">
          <CardHeader className="bg-gradient-to-r from-purple-50 to-pink-50 dark:from-purple-950 dark:to-pink-950 pb-3">
            <div className="flex items-start justify-between">
              <div className="space-y-2 flex-1">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <FileCode className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  Source File
                </CardTitle>
                <p className="text-sm font-mono text-muted-foreground">{selectedFile}</p>
              </div>
              <button
                onClick={() => setSelectedFile(null)}
                className="text-muted-foreground hover:text-foreground p-2 hover:bg-muted rounded-lg transition-colors"
              >
                ✕
              </button>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            {data.fileReports
              .filter((fr: any) => fr.file === selectedFile)
              .map((fileReport: any, idx: number) => {
                const parsed = parseGeneratedTests(fileReport.generatedTests || '');
                
                return (
                  <div key={idx} className="space-y-6">
                    {/* File Relationship */}
                    <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-950 dark:to-purple-950 rounded-lg">
                      <div className="flex items-center gap-2 flex-1">
                        <FileCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <p className="text-xs text-muted-foreground">Source File</p>
                          <p className="font-mono text-sm font-semibold">{fileReport.file}</p>
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-muted-foreground" />
                      <div className="flex items-center gap-2 flex-1">
                        <TestTube className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                        <div>
                          <p className="text-xs text-muted-foreground">Test File</p>
                          <p className="font-mono text-sm font-semibold">{fileReport.testFile || 'Not specified'}</p>
                        </div>
                      </div>
                    </div>

                    {/* Test Stats */}
                    <div className="flex items-center gap-3">
                      <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-3 py-1">
                        {fileReport.testCasesFound} existing tests
                      </Badge>
                      <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 px-3 py-1">
                        +{fileReport.newTestCasesAdded} new tests
                      </Badge>
                    </div>

                    {/* AI Analysis */}
                    {parsed.aiAnalysis && (
                      <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <Sparkles className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                            AI Analysis
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                            {parsed.aiAnalysis}
                          </p>
                        </CardContent>
                      </Card>
                    )}
                    
                    {/* Generated Test Code */}
                    {parsed.codeBlock && (
                      <div className="space-y-3">
                        <h4 className="text-sm font-semibold flex items-center gap-2">
                          <Code2 className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          Generated Test Class
                        </h4>
                        <div className="relative rounded-lg overflow-hidden border-2 border-purple-200 dark:border-purple-800 bg-slate-950 dark:bg-slate-900">
                          <div className="bg-slate-900 dark:bg-slate-800 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
                            <div className="flex gap-1.5">
                              <div className="w-3 h-3 rounded-full bg-red-500"></div>
                              <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                              <div className="w-3 h-3 rounded-full bg-green-500"></div>
                            </div>
                            <span className="text-xs text-slate-400 ml-2 font-mono">{fileReport.testFile || 'Test.cs'}</span>
                          </div>
                          <ScrollArea className="max-h-96">
                            <pre className="p-4 text-sm leading-relaxed">
                              <code className="text-slate-100 dark:text-slate-200 font-mono">
                                {parsed.codeBlock}
                              </code>
                            </pre>
                          </ScrollArea>
                        </div>
                      </div>
                    )}

                    {/* Test Summary */}
                    {parsed.summary && (
                      <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-sm flex items-center gap-2">
                            <FileText className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                            Test Coverage Summary
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="prose prose-sm dark:prose-invert max-w-none">
                            <div className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">
                              {parsed.summary}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                );
              })}
          </CardContent>
        </Card>
      )}

      {/* Test Details Dialog */}
      <Dialog open={!!dialogData} onOpenChange={(open) => !open && setDialogData(null)}>
        <DialogContent className="max-w-5xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <TestTube className="h-6 w-6 text-purple-600 dark:text-purple-400" />
              {dialogData?.type === 'existing' ? 'Existing' : 'New'} Test Cases
            </DialogTitle>
            <DialogDescription className="space-y-2">
              <div className="flex items-center gap-2 mt-2">
                <FileCode className="h-4 w-4" />
                <span className="font-mono text-sm">{dialogData?.file}</span>
              </div>
              <div className="flex items-center gap-2">
                <ArrowRight className="h-4 w-4" />
                <TestTube className="h-4 w-4" />
                <span className="font-mono text-sm">{dialogData?.testFile}</span>
              </div>
              <Badge variant="outline" className="mt-2">
                {dialogData?.count} test{dialogData?.count !== 1 ? 's' : ''}
              </Badge>
            </DialogDescription>
          </DialogHeader>
          <Separator className="my-4" />
          <ScrollArea className="flex-1 -mr-4 pr-4">
            {dialogData?.tests && (() => {
              const parsed = parseGeneratedTests(dialogData.tests);
              return (
                <div className="space-y-4">
                  {parsed.aiAnalysis && (
                    <Card className="bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Sparkles className="h-4 w-4" />
                          AI Analysis
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{parsed.aiAnalysis}</p>
                      </CardContent>
                    </Card>
                  )}
                  
                  {parsed.codeBlock && (
                    <div className="relative rounded-lg overflow-hidden border-2 border-purple-200 dark:border-purple-800 bg-slate-950">
                      <div className="bg-slate-900 px-4 py-2 border-b border-slate-700 flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-3 h-3 rounded-full bg-red-500"></div>
                          <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                          <div className="w-3 h-3 rounded-full bg-green-500"></div>
                        </div>
                        <span className="text-xs text-slate-400 ml-2 font-mono">{dialogData.testFile}</span>
                      </div>
                      <pre className="p-4 text-sm leading-relaxed overflow-x-auto">
                        <code className="text-slate-100 font-mono">{parsed.codeBlock}</code>
                      </pre>
                    </div>
                  )}

                  {parsed.summary && (
                    <Card className="bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800">
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm flex items-center gap-2">
                          <FileText className="h-4 w-4" />
                          Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{parsed.summary}</div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              );
            })()}
          </ScrollArea>
        </DialogContent>
      </Dialog>
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
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color as keyof typeof colorClasses]} backdrop-blur transition-all hover:scale-105 hover:shadow-lg`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
