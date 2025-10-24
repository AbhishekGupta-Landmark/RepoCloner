import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAppContext } from "@/context/AppContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { 
  GitBranch, 
  CheckCircle, 
  Edit3, 
  FileCode, 
  ArrowRight, 
  Calendar,
  Hash,
  Loader2,
  Shield,
  AlertCircle,
  Sparkles,
  GitPullRequest,
  Code2,
  RefreshCw,
  GitCompareArrows
} from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface MigrationChange {
  filePath: string;
  oldCode: string;
  newCode: string;
  description: string;
}

interface CoverageData {
  overall: number;
  files: Array<{
    path: string;
    coverage: number;
  }>;
}

// Helper function to construct GitHub branch URL from the cloned repository
const constructGitHubBranchUrl = (repositoryUrl: string, branchName: string): string | null => {
  try {
    // Extract owner and repo from the cloned repository URL
    let owner = '';
    let repo = '';
    
    if (repositoryUrl.startsWith('https://github.com/')) {
      // HTTPS: https://github.com/owner/repo.git or https://github.com/owner/repo
      const path = repositoryUrl.replace('https://github.com/', '').replace(/\.git$/, '');
      const parts = path.split('/');
      if (parts.length >= 2) {
        owner = parts[0];
        repo = parts[1];
      }
    } else if (repositoryUrl.startsWith('git@github.com:')) {
      // SSH: git@github.com:owner/repo.git or git@github.com:owner/repo
      const path = repositoryUrl.replace('git@github.com:', '').replace(/\.git$/, '');
      const parts = path.split('/');
      if (parts.length >= 2) {
        owner = parts[0];
        repo = parts[1];
      }
    }
    
    if (owner && repo) {
      return `https://github.com/${owner}/${repo}/tree/${branchName}`;
    }
    return null;
  } catch (error) {
    console.error('Error parsing GitHub URL:', error);
    return null;
  }
};

export default function CodeMigrationPanel() {
  const { currentRepository } = useAppContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [editMode, setEditMode] = useState(false);
  const [editedChanges, setEditedChanges] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [approvalSuccess, setApprovalSuccess] = useState<{ branchName: string; branchUrl: string | null } | null>(null);

  // Fetch migration changes
  const { data: migrationData, isLoading: isLoadingChanges, error: queryError } = useQuery<{
    changes: MigrationChange[];
    migrationType: string;
    oldCoverage: CoverageData;
    newCoverage: CoverageData;
    iterationNumber: number;
  }>({
    queryKey: ['/api/migration/changes', currentRepository?.id],
    enabled: !!currentRepository?.id,
  });

  // Debug logging
  console.log('[CodeMigrationPanel] currentRepository:', currentRepository?.id);
  console.log('[CodeMigrationPanel] Query enabled:', !!currentRepository?.id);
  console.log('[CodeMigrationPanel] isLoading:', isLoadingChanges);
  console.log('[CodeMigrationPanel] data:', migrationData);
  console.log('[CodeMigrationPanel] error:', queryError);

  // Approve and push mutation
  const approveMutation = useMutation({
    mutationFn: async (approvalData: { 
      repositoryId: string; 
      changes: Record<string, string>;
      migrationType: string;
      iterationNumber: number;
    }) => {
      const response = await apiRequest('POST', '/api/migration/approve', approvalData);
      return response.json();
    },
    onSuccess: (data) => {
      // Use the branch URL from backend response (already points to correct repo - fork or original)
      const branchUrl = data.branchUrl || null;
      
      // Store approval success state with branch info
      setApprovalSuccess({
        branchName: data.branchName,
        branchUrl
      });
      
      toast({
        title: "✅ Migration Approved!",
        description: branchUrl 
          ? `Changes pushed successfully!` 
          : `Changes pushed to branch: ${data.branchName}`,
      });
      
      // Clear the migration changes from cache
      queryClient.invalidateQueries({ queryKey: ['/api/migration/changes'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Approval Failed",
        description: error.message || "Failed to push changes",
        variant: "destructive",
      });
    },
  });

  const handleApproveAll = () => {
    if (!currentRepository || !migrationData) return;
    
    const changesToApprove = migrationData.changes.reduce((acc, change) => {
      acc[change.filePath] = editedChanges[change.filePath] || change.newCode;
      return acc;
    }, {} as Record<string, string>);

    approveMutation.mutate({
      repositoryId: currentRepository.id,
      changes: changesToApprove,
      migrationType: migrationData.migrationType,
      iterationNumber: migrationData.iterationNumber,
    });
  };

  const handleModifyAndApprove = () => {
    setEditMode(true);
  };

  const handleSaveAndApprove = () => {
    setEditMode(false);
    handleApproveAll();
  };

  const handleCodeEdit = (filePath: string, newCode: string) => {
    setEditedChanges(prev => ({
      ...prev,
      [filePath]: newCode,
    }));
  };

  const generateBranchName = () => {
    if (!migrationData) return "";
    const now = new Date();
    const dateTime = now.toISOString().replace(/[:.]/g, '-').slice(0, -5);
    return `${migrationData.migrationType}${dateTime}Iteration${migrationData.iterationNumber}`;
  };

  if (!currentRepository) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500" />
              No Repository Selected
            </CardTitle>
            <CardDescription>
              Please clone a repository first to start code migration
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (isLoadingChanges) {
    return (
      <div className="flex items-center justify-center h-full">
        <Card className="w-[400px]">
          <CardContent className="flex flex-col items-center justify-center py-12 gap-4">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
            <p className="text-muted-foreground">Loading migration changes...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!migrationData || !migrationData.changes || migrationData.changes.length === 0) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <Card className="w-full max-w-2xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-primary" />
              No Migration Changes Available
            </CardTitle>
            <CardDescription>
              Run a Code Analysis migration first to generate migration changes for approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col gap-4 p-6 border border-dashed border-border rounded-lg bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">1</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Go to <span className="font-semibold text-foreground">Code Analysis</span> tab
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">2</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Select a migration analysis type and run the analysis
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-primary font-semibold">3</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Return here to review and approve the generated changes
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show success card after approval
  if (approvalSuccess) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-2xl"
        >
          <Card className="border-2 border-green-500/50 bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
            <CardHeader>
              <div className="flex flex-col items-center text-center gap-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ 
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    delay: 0.2
                  }}
                >
                  <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center">
                    <CheckCircle className="h-12 w-12 text-white" />
                  </div>
                </motion.div>
                <div>
                  <CardTitle className="text-3xl text-green-600 dark:text-green-400 mb-2">
                    Migration Approved!
                  </CardTitle>
                  <CardDescription className="text-base">
                    Your changes have been successfully pushed to the repository
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="p-4 rounded-lg bg-card border border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="h-5 w-5 text-primary" />
                    <p className="font-semibold">Branch Created</p>
                  </div>
                  <p className="text-sm text-muted-foreground font-mono">
                    {approvalSuccess.branchName}
                  </p>
                </div>

                {approvalSuccess.branchUrl && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                  >
                    <a
                      href={approvalSuccess.branchUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block"
                    >
                      <Button
                        size="lg"
                        className="w-full group relative overflow-hidden bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 text-white font-semibold"
                        data-testid="button-view-branch"
                      >
                        <motion.div
                          className="flex items-center gap-2"
                          whileHover={{ scale: 1.05 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <GitPullRequest className="h-5 w-5" />
                          <span>View Branch on GitHub</span>
                          <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
                        </motion.div>
                      </Button>
                    </a>
                  </motion.div>
                )}

                <Separator />

                <div className="flex justify-center">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setApprovalSuccess(null);
                      setEditMode(false);
                      setEditedChanges({});
                    }}
                    data-testid="button-new-migration"
                    className="gap-2"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Start New Migration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const currentChange = migrationData.changes.find(c => c.filePath === selectedFile) || migrationData.changes[0];
  const displayCode = editedChanges[currentChange.filePath] || currentChange.newCode;

  return (
    <div className="h-full flex flex-col p-6 gap-6 overflow-hidden">
      {/* Header Section with Branch Preview */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  initial={{ rotate: 0 }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  className="flex-shrink-0"
                >
                  <Sparkles className="h-6 w-6 text-primary" />
                </motion.div>
                <div>
                  <CardTitle className="text-2xl">Code Migration Approval</CardTitle>
                  <CardDescription className="mt-1">
                    Review and approve AI-generated migration changes
                  </CardDescription>
                </div>
              </div>
              <Badge variant="outline" className="text-lg px-4 py-2">
                <Hash className="h-4 w-4 mr-1" />
                Iteration {migrationData.iterationNumber}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3 p-4 rounded-lg bg-card border border-border">
              <GitBranch className="h-5 w-5 text-primary flex-shrink-0" />
              <div className="flex-1">
                <p className="text-xs text-muted-foreground mb-1">Target Branch Name</p>
                <code className="text-sm font-mono bg-muted px-2 py-1 rounded">
                  {generateBranchName()}
                </code>
              </div>
              <Calendar className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Area */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
        {/* Left: File List & Coverage */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="lg:col-span-1 flex flex-col gap-4 overflow-hidden"
        >
          {/* Files to Change */}
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <CardTitle className="flex items-center gap-2 text-lg">
                <FileCode className="h-5 w-5" />
                Files to Migrate ({migrationData.changes.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <ScrollArea className="h-full">
                <div className="p-4 space-y-2">
                  {migrationData.changes.map((change, idx) => (
                    <motion.button
                      key={change.filePath}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.05 }}
                      onClick={() => setSelectedFile(change.filePath)}
                      className={`w-full text-left p-3 rounded-lg border transition-all ${
                        (selectedFile === change.filePath || (!selectedFile && idx === 0))
                          ? 'border-primary bg-primary/10'
                          : 'border-border hover:border-primary/50 hover:bg-muted'
                      }`}
                      data-testid={`file-item-${idx}`}
                    >
                      <div className="flex items-center gap-2">
                        <Code2 className="h-4 w-4 flex-shrink-0" />
                        <span className="text-sm font-mono truncate">{change.filePath}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                        {change.description}
                      </p>
                    </motion.button>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Coverage Comparison */}
          <Card className="flex-shrink-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Shield className="h-5 w-5" />
                Coverage Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                  <span className="text-sm font-medium">Old Coverage</span>
                  <span className="text-2xl font-bold text-red-500">
                    {migrationData.oldCoverage.overall}%
                  </span>
                </div>
                <div className="flex items-center justify-center">
                  <ArrowRight className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <span className="text-sm font-medium">New Coverage</span>
                  <span className="text-2xl font-bold text-green-500">
                    {migrationData.newCoverage.overall}%
                  </span>
                </div>
                <div className="flex items-center justify-center gap-2 pt-2">
                  <Badge variant={migrationData.newCoverage.overall > migrationData.oldCoverage.overall ? "default" : "destructive"}>
                    {migrationData.newCoverage.overall > migrationData.oldCoverage.overall ? "+" : ""}
                    {(migrationData.newCoverage.overall - migrationData.oldCoverage.overall).toFixed(1)}%
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Right: Code Diff Viewer */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.2 }}
          className="lg:col-span-2 flex flex-col overflow-hidden"
        >
          <Card className="flex-1 flex flex-col overflow-hidden">
            <CardHeader className="flex-shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <GitPullRequest className="h-5 w-5" />
                  {currentChange.filePath}
                </CardTitle>
                <Badge variant="outline">
                  {editMode ? "Edit Mode" : "Review Mode"}
                </Badge>
              </div>
              <CardDescription>{currentChange.description}</CardDescription>
            </CardHeader>
            <CardContent className="flex-1 overflow-hidden p-0">
              <Tabs defaultValue="diff" className="h-full flex flex-col">
                <TabsList className="flex-shrink-0 mx-4 mt-4">
                  <TabsTrigger value="diff" data-testid="tab-diff">
                    <GitCompareArrows className="h-4 w-4 mr-2" />
                    Side-by-Side Diff
                  </TabsTrigger>
                  <TabsTrigger value="new" data-testid="tab-new">
                    <Code2 className="h-4 w-4 mr-2" />
                    New Code {editMode && "(Editable)"}
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="diff" className="flex-1 overflow-hidden m-0 p-4">
                  <div className="grid grid-cols-2 gap-4 h-full">
                    {/* Old Code */}
                    <div className="flex flex-col overflow-hidden border border-red-500/20 rounded-lg">
                      <div className="flex-shrink-0 bg-red-500/10 px-3 py-2 border-b border-red-500/20">
                        <span className="text-sm font-medium text-red-500">Old Code</span>
                      </div>
                      <ScrollArea className="flex-1">
                        <pre className="p-4 text-xs font-mono">
                          <code>{currentChange.oldCode}</code>
                        </pre>
                      </ScrollArea>
                    </div>

                    {/* New Code */}
                    <div className="flex flex-col overflow-hidden border border-green-500/20 rounded-lg">
                      <div className="flex-shrink-0 bg-green-500/10 px-3 py-2 border-b border-green-500/20">
                        <span className="text-sm font-medium text-green-500">New Code</span>
                      </div>
                      <ScrollArea className="flex-1">
                        <pre className="p-4 text-xs font-mono">
                          <code>{displayCode}</code>
                        </pre>
                      </ScrollArea>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="new" className="flex-1 overflow-hidden m-0 p-4">
                  {editMode ? (
                    <textarea
                      value={displayCode}
                      onChange={(e) => handleCodeEdit(currentChange.filePath, e.target.value)}
                      className="w-full h-full p-4 text-xs font-mono bg-muted border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                      data-testid="code-editor"
                    />
                  ) : (
                    <ScrollArea className="h-full border border-border rounded-lg">
                      <pre className="p-4 text-xs font-mono">
                        <code>{displayCode}</code>
                      </pre>
                    </ScrollArea>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Action Buttons */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.3 }}
      >
        <Card className="border-2 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <RefreshCw className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Ready to approve?</p>
                  <p className="text-xs text-muted-foreground">
                    Changes will be pushed to {migrationData.migrationType} branch
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3">
                {editMode ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setEditMode(false);
                        setEditedChanges({});
                      }}
                      data-testid="button-cancel-edit"
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSaveAndApprove}
                      disabled={approveMutation.isPending}
                      className="gap-2"
                      data-testid="button-save-approve"
                    >
                      {approveMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Pushing...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Save & Approve
                        </>
                      )}
                    </Button>
                  </>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      onClick={handleModifyAndApprove}
                      className="gap-2 text-primary hover:bg-primary/10 border-primary/30 hover:border-primary"
                      data-testid="button-modify"
                    >
                      <Edit3 className="h-4 w-4" />
                      Modify Changes
                    </Button>
                    <Button
                      onClick={handleApproveAll}
                      disabled={approveMutation.isPending}
                      className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                      data-testid="button-approve-all"
                    >
                      {approveMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Pushing to Git...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="h-4 w-4" />
                          Approve All & Push
                        </>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
