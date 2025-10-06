import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  Table as TableIcon
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
  type: 'existing' | 'new';
  count: number;
  tests: string;
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
      type,
      count,
      tests: fileReport.generatedTests || 'No test details available'
    });
  };

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

      {/* Interactive Bar Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Test Case Counts per File
          </CardTitle>
          <CardDescription>
            Click on bars to view file details
          </CardDescription>
        </CardHeader>
        <CardContent>
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
                  borderRadius: '6px'
                }}
              />
              <Legend wrapperStyle={{ paddingTop: '20px' }} />
              <Bar 
                dataKey="Test Cases Found" 
                fill="#10b981" 
                onClick={(data) => handleBarClick(data.fullPath)}
                cursor="pointer"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={selectedFile === entry.fullPath ? '#059669' : '#10b981'}
                  />
                ))}
              </Bar>
              <Bar 
                dataKey="New Test Cases Added" 
                fill="#a855f7"
                onClick={(data) => handleBarClick(data.fullPath)}
                cursor="pointer"
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell 
                    key={`cell-${index}`}
                    fill={selectedFile === entry.fullPath ? '#7e22ce' : '#a855f7'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Interactive Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TableIcon className="h-5 w-5" />
            Test Coverage Summary
          </CardTitle>
          <CardDescription>
            Click on test counts to view details
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b-2 border-blue-600 dark:border-blue-400">
                  <th className="text-left p-3 font-semibold bg-blue-50 dark:bg-blue-900/30">File</th>
                  <th className="text-center p-3 font-semibold bg-blue-50 dark:bg-blue-900/30">Test Cases Found</th>
                  <th className="text-center p-3 font-semibold bg-blue-50 dark:bg-blue-900/30">New Test Cases Added</th>
                  <th className="text-center p-3 font-semibold bg-blue-50 dark:bg-blue-900/30">Coverage (%)</th>
                  <th className="text-center p-3 font-semibold bg-blue-50 dark:bg-blue-900/30">New Test Coverage (%)</th>
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
                      className={`border-b hover:bg-muted/50 transition-colors ${isSelected ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}
                      onClick={() => handleBarClick(fileReport.file)}
                    >
                      <td className="p-3 font-mono text-sm cursor-pointer">{fileReport.file}</td>
                      <td 
                        className="p-3 text-center cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestCountClick(fileReport, 'existing');
                        }}
                      >
                        <Badge 
                          variant="outline" 
                          className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 cursor-pointer hover:bg-green-100 dark:hover:bg-green-800/30"
                        >
                          {fileReport.testCasesFound}
                        </Badge>
                      </td>
                      <td 
                        className="p-3 text-center cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestCountClick(fileReport, 'new');
                        }}
                      >
                        <Badge 
                          variant="outline" 
                          className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-800/30"
                        >
                          {fileReport.newTestCasesAdded}
                        </Badge>
                      </td>
                      <td className="p-3 text-center font-semibold">100%</td>
                      <td className="p-3 text-center font-semibold">{newTestPercentage}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Expandable File Details (when row/bar selected) */}
      {selectedFile && data.fileReports && (
        <Card className="border-2 border-blue-400 dark:border-blue-600 animate-in fade-in slide-in-from-top-2 duration-300">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <FileCode className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              {selectedFile}
            </CardTitle>
            <button
              onClick={() => setSelectedFile(null)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground"
            >
              ×
            </button>
          </CardHeader>
          <CardContent>
            {data.fileReports
              .filter((fr: any) => fr.file === selectedFile)
              .map((fileReport: any, idx: number) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-4">
                    <Badge variant="outline" className="bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300">
                      {fileReport.testCasesFound} existing tests
                    </Badge>
                    <Badge variant="outline" className="bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300">
                      +{fileReport.newTestCasesAdded} new tests
                    </Badge>
                  </div>
                  
                  {fileReport.generatedTests && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-semibold flex items-center gap-2">
                        <TestTube className="h-4 w-4" />
                        Generated Test Cases
                      </h4>
                      <div className="relative rounded-lg overflow-hidden border bg-slate-950 dark:bg-slate-900">
                        <pre className="p-4 overflow-x-auto text-xs leading-relaxed max-h-96">
                          <code className="text-slate-100 dark:text-slate-200">
                            {fileReport.generatedTests}
                          </code>
                        </pre>
                      </div>
                    </div>
                  )}
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Test Details Dialog */}
      <Dialog open={!!dialogData} onOpenChange={(open) => !open && setDialogData(null)}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <TestTube className="h-5 w-5" />
              {dialogData?.type === 'existing' ? 'Existing' : 'New'} Test Cases
            </DialogTitle>
            <DialogDescription>
              {dialogData?.file} - {dialogData?.count} {dialogData?.type === 'existing' ? 'existing' : 'new'} test{dialogData?.count !== 1 ? 's' : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4">
            {dialogData?.tests && (
              <div className="relative rounded-lg overflow-hidden border bg-slate-950 dark:bg-slate-900">
                <pre className="p-4 overflow-x-auto text-xs leading-relaxed">
                  <code className="text-slate-100 dark:text-slate-200">
                    {dialogData.tests}
                  </code>
                </pre>
              </div>
            )}
          </div>
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
    <div className={`p-4 rounded-lg border-2 ${colorClasses[color as keyof typeof colorClasses]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="text-3xl font-bold">{value}</p>
    </div>
  );
}
