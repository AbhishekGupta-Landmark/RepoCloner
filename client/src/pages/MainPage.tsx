import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { motion, AnimatePresence } from "framer-motion";
import AuthModal from "@/components/AuthModal";
import FileTreePanel from "@/components/FileTreePanel";
import AnalysisPanel from "@/components/AnalysisPanel";
import ReportsPanel from "@/components/ReportsPanel";
import LogsPanel from "@/components/LogsPanel";
import SettingsPanel from "@/components/SettingsPanel";
import RepositoryInput from "@/components/RepositoryInput";
import TechnologyShowcase from "@/components/TechnologyShowcase";
import { useAuth } from "@/hooks/useAuth";
import { useAppContext } from "@/context/AppContext";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Code, Settings, PanelLeftClose, PanelLeftOpen, Monitor, Shield, FileText, Sparkles, Zap, User, LogOut, ChevronDown, Plus, Github, GitlabIcon as Gitlab, Users, GitBranch, Server, Globe, Check, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Helper function to get provider icons
const getProviderIcon = (provider: string) => {
  const iconMap = {
    github: Github,
    gitlab: Gitlab,
    azure: Users,
    bitbucket: GitBranch,
    gitea: Server,
    codeberg: Globe,
    sourcehut: Server
  };
  return iconMap[provider as keyof typeof iconMap] || Github;
};

export default function MainPage() {
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("technology");
  const settingsAppliedRef = useRef(false);
  const { 
    user, 
    isAuthenticated, 
    signOut, 
    switchAccount, 
    accounts, 
    activeAccount, 
    activeAccountId, 
    hasMultipleAccounts,
    isSwitchingAccount 
  } = useAuth();
  const { 
    currentRepository, 
    showRepoPanel, 
    toggleRepoPanel, 
    lastExpandedWidth, 
    setLastExpandedWidth, 
    handleToggleRepoPanel,
    isCodeAnalysisEnabled
  } = useAppContext();
  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  
  // Ref for accessing the ResizablePanel API
  const repoPanelRef = useRef<any>(null);
  
  // Get current panel size function
  const getCurrentPanelSize = () => {
    if (repoPanelRef.current) {
      const size = repoPanelRef.current.getSize();
      return size;
    }
    return null;
  };
  
  // Handle panel resize to save width continuously
  const handlePanelResize = (size: number) => {
    if (showRepoPanel && size > 12) {
      setLastExpandedWidth(size);
    }
  };
  
  // Fetch OAuth configuration to show available providers for multi-account sign-in
  const { data: oauthData } = useQuery<{
    config: Record<string, any>,
    status: Record<string, boolean>,
    enabled: Record<string, boolean>
  }>({
    queryKey: ['/api/admin/oauth-config'],
    // Always fetch OAuth config so we can show available providers for PAT auth
  });

  // Switch to Technology Stack tab when repository is cloned (only once per repository change)
  useEffect(() => {
    if (currentRepository) {
      setActiveTab("technology");
    } else {
      // Keep Technology Stack as default even when no repository is present
      // Analysis tab should be disabled anyway without a repository
      setActiveTab("technology");
    }
  }, [currentRepository]);

  // Handle panel resize when showRepoPanel changes from false to true (expansion)
  useEffect(() => {
    if (showRepoPanel && repoPanelRef.current && repoPanelRef.current.resize) {
      // Small delay to ensure the panel is fully rendered and visible
      const timeoutId = setTimeout(() => {
        if (repoPanelRef.current && repoPanelRef.current.resize) {
          repoPanelRef.current.resize(lastExpandedWidth);
        }
      }, 150);
      
      return () => clearTimeout(timeoutId);
    }
  }, [showRepoPanel, lastExpandedWidth]);

  // Callback for when settings are successfully applied
  const onSettingsApplied = () => {
    settingsAppliedRef.current = true;
  };

  // Handle settings modal close with auto-refresh functionality
  const handleSettingsModalClose = (open: boolean) => {
    setSettingsModalOpen(open);
    
    // If modal is being closed (open = false) and settings were applied
    if (!open && settingsAppliedRef.current) {
      
      // Refresh all relevant data that might be affected by settings changes
      setTimeout(() => {
        // Refresh OAuth configuration data
        queryClient.invalidateQueries({ queryKey: ['/api/admin/oauth-config'] });
        
        // Refresh authentication status in case OAuth settings changed
        queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
        queryClient.invalidateQueries({ queryKey: ['/api/auth/accounts'] });
        
        // Refresh repositories list in case provider settings changed
        queryClient.invalidateQueries({ queryKey: ['/api/repositories'] });
        
        // Refresh technologies list in case provider settings changed
        queryClient.invalidateQueries({ queryKey: ['/api/technologies'] });
        
        // Reset the settings applied flag
        settingsAppliedRef.current = false;
        
      }, 100); // Small delay to ensure modal has fully closed
    }
  };

  // Reset settings applied flag when modal opens
  useEffect(() => {
    if (settingsModalOpen) {
      settingsAppliedRef.current = false;
    }
  }, [settingsModalOpen]);

  return (
    <motion.div 
      className="mobile-viewport-height flex flex-col bg-background text-foreground"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Header */}
      <motion.header 
        className="bg-card border-b border-border/50 px-4 py-2 flex items-center justify-between shadow-sm"
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
      >
        <motion.div 
          className="flex items-center gap-3"
          initial={{ x: -20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.2 }}
        >
          <motion.div
            whileHover={{ rotate: 15, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400, damping: 10 }}
          >
            <Code className="text-2xl text-primary drop-shadow-sm" />
          </motion.div>
          <h1 className="text-xl font-semibold bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
            Git Repository Cloner & Analyzer
          </h1>
          <motion.div
            animate={{ rotate: [0, 10, -10, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Sparkles className="h-4 w-4 text-yellow-500" />
          </motion.div>
        </motion.div>
        
        <motion.div 
          className="flex items-center gap-4"
          initial={{ x: 20, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.3 }}
        >
          <AnimatePresence mode="wait">
            {!isAuthenticated ? (
              <motion.div 
                key="unauthenticated"
                className="flex items-center gap-3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <span className="text-muted-foreground text-sm">Not authenticated</span>
                <Button 
                  onClick={() => setAuthModalOpen(true)}
                  data-testid="button-sign-in"
                  className="bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 shadow-md hover:shadow-lg transition-all duration-200 font-medium border border-blue-500/20 focus:ring-2 focus:ring-blue-500/50 focus:ring-offset-2 focus:ring-offset-background"
                >
                  <Zap className="mr-2 h-4 w-4" />
                  Sign In
                </Button>
              </motion.div>
            ) : (
              <motion.div 
                key="authenticated"
                className="flex items-center gap-3"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
              >
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      className="flex items-center gap-2 px-3 py-2 h-auto hover:bg-muted/50 transition-colors"
                      data-testid="button-user-menu"
                    >
                      <motion.img 
                        src={`https://github.com/${user?.username}.png`} 
                        alt="User avatar" 
                        className="w-6 h-6 rounded-full ring-2 ring-primary/20"
                        data-testid="img-avatar"
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      />
                      <span 
                        className="text-sm font-medium" 
                        data-testid="text-username"
                      >
                        {user?.username}
                      </span>
                      <motion.div
                        animate={{ rotate: 0 }}
                        whileHover={{ rotate: 180 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      </motion.div>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-80" data-testid="dropdown-user-menu">
                    {/* Gmail-style Multi-Account Section */}
                    {hasMultipleAccounts ? (
                      <>
                        <DropdownMenuLabel className="text-xs text-muted-foreground font-normal px-2 py-1">
                          {accounts.length} account{accounts.length > 1 ? 's' : ''}
                        </DropdownMenuLabel>
                        {accounts.map((account) => {
                          const isActive = account.id === activeAccountId;
                          const ProviderIcon = getProviderIcon(account.provider);
                          
                          return (
                            <DropdownMenuItem 
                              key={account.id}
                              onClick={() => !isActive && switchAccount(account.id)}
                              className={`flex items-center gap-3 p-3 cursor-pointer ${
                                isActive ? 'bg-primary/10 border-l-2 border-l-primary' : 'hover:bg-muted/50'
                              }`}
                              data-testid={`dropdown-account-${account.id}`}
                            >
                              {isSwitchingAccount ? (
                                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                              ) : (
                                <img 
                                  src={account.avatarUrl || `https://github.com/${account.username}.png`} 
                                  alt={`${account.username} avatar`} 
                                  className="w-5 h-5 rounded-full ring-1 ring-border"
                                />
                              )}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium truncate">{account.displayName || account.username}</span>
                                  {isActive && <Check className="h-4 w-4 text-primary flex-shrink-0" />}
                                </div>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <ProviderIcon className="h-3 w-3" />
                                  <span>{account.provider}</span>
                                  <span>•</span>
                                  <span className="truncate">{account.email || account.username}</span>
                                </div>
                              </div>
                            </DropdownMenuItem>
                          );
                        })}
                        <DropdownMenuSeparator />
                      </>
                    ) : (
                      /* Single Account Display */
                      <>
                        <DropdownMenuLabel className="font-normal px-3 py-2" data-testid="dropdown-user-info">
                          <div className="flex items-center gap-3">
                            <img 
                              src={activeAccount?.avatarUrl || `https://github.com/${user?.username}.png`} 
                              alt="User avatar" 
                              className="w-8 h-8 rounded-full ring-2 ring-primary/20"
                            />
                            <div className="flex flex-col">
                              <p className="text-sm font-medium leading-none" data-testid="text-dropdown-username">
                                {activeAccount?.displayName || user?.username}
                              </p>
                              <p className="text-xs leading-none text-muted-foreground mt-1" data-testid="text-dropdown-provider">
                                {activeAccount?.email || `via ${user?.provider}`}
                              </p>
                            </div>
                          </div>
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator />
                      </>
                    )}

                    {/* Add Another Account Section - Always available for PAT authentication */}
                    <DropdownMenuItem 
                      onClick={() => setAuthModalOpen(true)}
                      className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/50" 
                      data-testid="dropdown-item-add-account"
                    >
                      <div className="w-5 h-5 rounded-full border-2 border-dashed border-muted-foreground/50 flex items-center justify-center">
                        <Plus className="h-3 w-3 text-muted-foreground" />
                      </div>
                      <div>
                        <span className="text-sm font-medium">Add another account</span>
                        <p className="text-xs text-muted-foreground">Sign in to more providers (PAT always available)</p>
                      </div>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {/* Account Management */}
                    {hasMultipleAccounts && (
                      <>
                        <DropdownMenuItem 
                          onClick={() => signOut(activeAccountId)}
                          className="flex items-center gap-2 cursor-pointer text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-950/50 px-3 py-2"
                          data-testid="dropdown-item-remove-account"
                        >
                          <LogOut className="h-4 w-4" />
                          <span>Remove current account</span>
                        </DropdownMenuItem>
                      </>
                    )}

                    <DropdownMenuItem 
                      onClick={() => signOut()}
                      className="flex items-center gap-2 cursor-pointer text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 px-3 py-2"
                      data-testid="dropdown-item-logout-all"
                    >
                      <LogOut className="h-4 w-4" />
                      <span>{hasMultipleAccounts ? 'Sign out of all accounts' : 'Sign Out'}</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </motion.div>
            )}
          </AnimatePresence>
          
          
          <Button 
            variant="ghost" 
            size="icon" 
            onClick={() => setSettingsModalOpen(true)}
            data-testid="button-settings"
            title="Open Settings"
            className="hover-lift transition-smooth hover:bg-blue-500/10 hover:text-blue-500"
          >
            <motion.div
              whileHover={{ rotate: 90 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              <Settings className="h-4 w-4" />
            </motion.div>
          </Button>
        </motion.div>
      </motion.header>

      {/* Main Content - Enhanced Resizable Layout */}
      <div className="flex-1 min-h-0 overflow-hidden relative">

        <ResizablePanelGroup 
          direction="horizontal" 
          className="h-full min-h-0"
        >
          {/* Left Panel - Repository & File Tree - Always present, collapses when hidden */}
          <ResizablePanel 
            ref={repoPanelRef}
            id="repository-panel"
            order={1}
            defaultSize={showRepoPanel ? lastExpandedWidth : (isMobile ? 16 : 6)}
            minSize={showRepoPanel ? 12 : (isMobile ? 14 : 6)}
            maxSize={showRepoPanel ? 45 : (isMobile ? 16 : 6)}
            className="transition-all duration-300"
            onResize={handlePanelResize}
          >
            <motion.div 
              className="h-full bg-card border-r border-border/50 flex flex-col shadow-sm"
              initial={{ x: -20, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -20, opacity: 0 }}
              transition={{ duration: 0.4 }}
            >
              {showRepoPanel ? (
                <>
                  {/* Panel Header - Full view */}
                  <motion.div 
                    className="p-3 border-b border-border/50 flex items-center justify-between bg-muted/20"
                    initial={{ y: -10, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                  >
                    <h3 className="font-semibold text-sm flex items-center gap-2">
                      <motion.div
                        whileHover={{ scale: 1.1, rotate: 10 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      >
                        <Code className="h-4 w-4 text-primary" />
                      </motion.div>
                      Repository Explorer
                    </h3>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => handleToggleRepoPanel(getCurrentPanelSize)}
                      data-testid="button-close-panel"
                      title="Hide Repository Panel"
                      className="hover-lift transition-smooth hover:bg-red-500/10 hover:text-red-500 h-6 w-6"
                    >
                      <motion.div
                        whileHover={{ scale: 1.1 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      >
                        <PanelLeftClose className="h-3 w-3" />
                      </motion.div>
                    </Button>
                  </motion.div>
                  
                  <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-4">
                    <RepositoryInput />
                    <FileTreePanel />
                  </div>
                </>
              ) : (
                /* Collapsed Panel - Show only expand button */
                <motion.div 
                  className="h-full flex items-center justify-center"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                >
                  <Button
                    variant="default"
                    size="icon"
                    onClick={() => handleToggleRepoPanel()}
                    data-testid="button-show-panel"
                    title="Show Repository Panel"
                    className="h-10 w-8 shadow-lg hover:shadow-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-200"
                  >
                    <motion.div
                      whileHover={{ scale: 1.1 }}
                      transition={{ type: "spring", stiffness: 400, damping: 10 }}
                    >
                      <PanelLeftOpen className="h-4 w-4" />
                    </motion.div>
                  </Button>
                </motion.div>
              )}
            </motion.div>
          </ResizablePanel>
          
          {/* Always render handle but hide visually when collapsed */}
          <ResizableHandle 
            withHandle 
            className={!showRepoPanel ? "opacity-0 pointer-events-none w-0 overflow-hidden" : ""}
          />

          {/* Right Panel - Analysis & Outputs */}
          <ResizablePanel 
            id="content-panel"
            order={2}
            defaultSize={showRepoPanel ? 78 : (isMobile ? 84 : 94)}
            minSize={45}
            className="w-full"
          >
            <ResizablePanelGroup direction="vertical" className="h-full min-h-0">
              {/* Main Analysis Panel */}
              <ResizablePanel defaultSize={100} minSize={30}>
                <div className="h-full flex flex-col">
                  <Tabs defaultValue="technology" value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: 0.6 }}
                    >
                      <TabsList className="bg-card border-b border-border/50 justify-start rounded-none h-auto p-0 flex-shrink-0 shadow-sm">
                        <TabsTrigger 
                          value="technology" 
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary flex items-center gap-2 hover-lift transition-smooth hover:bg-emerald-500/10 hover:text-emerald-500 relative overflow-hidden"
                          data-testid="tab-technology"
                        >
                          <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            <Zap className="h-4 w-4" />
                          </motion.div>
                          Technology Stack
                          {activeTab === "technology" && (
                            <motion.div
                              className="absolute inset-0 bg-primary/5 -z-10"
                              layoutId="activeMainTab"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                        </TabsTrigger>
                        <TabsTrigger 
                          value="analysis" 
                          disabled={!isCodeAnalysisEnabled}
                          className={`rounded-none border-b-2 border-transparent data-[state=active]:border-primary flex items-center gap-2 hover-lift transition-smooth relative overflow-hidden ${
                            !isCodeAnalysisEnabled 
                              ? 'opacity-50 cursor-not-allowed' 
                              : 'hover:bg-blue-500/10 hover:text-blue-500'
                          }`}
                          data-testid="tab-analysis"
                        >
                          <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            <Monitor className="h-4 w-4" />
                          </motion.div>
                          Code Analysis
                          {activeTab === "analysis" && (
                            <motion.div
                              className="absolute inset-0 bg-primary/5 -z-10"
                              layoutId="activeMainTab"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                        </TabsTrigger>
                        <TabsTrigger 
                          value="reports" 
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary flex items-center gap-2 hover-lift transition-smooth hover:bg-green-500/10 hover:text-green-500 relative overflow-hidden"
                          data-testid="tab-reports"
                        >
                          <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            <FileText className="h-4 w-4" />
                          </motion.div>
                          Reports
                          {activeTab === "reports" && (
                            <motion.div
                              className="absolute inset-0 bg-primary/5 -z-10"
                              layoutId="activeMainTab"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                        </TabsTrigger>
                        <TabsTrigger 
                          value="logs" 
                          className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary flex items-center gap-2 hover-lift transition-smooth hover:bg-purple-500/10 hover:text-purple-500 relative overflow-hidden"
                          data-testid="tab-logs"
                        >
                          <motion.div
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            <Monitor className="h-4 w-4" />
                          </motion.div>
                          Activity Logs
                          {activeTab === "logs" && (
                            <motion.div
                              className="absolute inset-0 bg-primary/5 -z-10"
                              layoutId="activeMainTab"
                              transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                            />
                          )}
                        </TabsTrigger>
                      </TabsList>
                    </motion.div>

                    <div className="flex-1 overflow-hidden">
                      <AnimatePresence mode="wait">
                        <motion.div
                          key={activeTab}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.3, ease: "easeInOut" }}
                          className="h-full"
                        >
                          <TabsContent value="technology" className="h-full m-0 overflow-y-auto">
                            <TechnologyShowcase 
                              repositoryName={currentRepository?.name}
                              key={currentRepository?.id || 'no-repo'}
                            />
                          </TabsContent>
                          
                          <TabsContent value="analysis" className="h-full m-0">
                            <AnalysisPanel />
                          </TabsContent>
                          
                          <TabsContent value="reports" className="h-full m-0">
                            <ReportsPanel />
                          </TabsContent>
                          
                          <TabsContent value="logs" className="h-full m-0">
                            <LogsPanel />
                          </TabsContent>
                        </motion.div>
                      </AnimatePresence>
                    </div>
                  </Tabs>
                </div>
              </ResizablePanel>

            </ResizablePanelGroup>
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>

      {/* Modals with Enhanced Animations */}
      <AuthModal 
        open={authModalOpen} 
        onOpenChange={setAuthModalOpen} 
      />
      
      <AnimatePresence>
        {settingsModalOpen && (
          <Dialog open={settingsModalOpen} onOpenChange={handleSettingsModalClose}>
            <DialogContent className="max-w-7xl h-[95vh] flex flex-col shadow-strong border-border/50 p-0">
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="flex flex-col h-full"
              >
                <DialogHeader className="flex-shrink-0 px-6 pt-6 pb-4 border-b border-border/50">
                  <DialogTitle className="flex items-center gap-2">
                    <motion.div
                      whileHover={{ rotate: 180 }}
                      transition={{ duration: 0.3 }}
                    >
                      <Settings className="h-5 w-5 text-primary" />
                    </motion.div>
                    Settings
                  </DialogTitle>
                </DialogHeader>
                <div className="flex-1 overflow-hidden min-h-0">
                  <SettingsPanel onApplied={onSettingsApplied} />
                </div>
              </motion.div>
            </DialogContent>
          </Dialog>
        )}
      </AnimatePresence>
      
      {/* Version Footer for Debugging */}
      <footer className="fixed bottom-2 right-2 text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded border">
        Build: {new Date().toISOString().slice(0,16)} | Replit-bcf7c59
      </footer>
    </motion.div>
  );
}
