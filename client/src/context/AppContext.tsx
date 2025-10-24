import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Repository } from '@shared/schema';
import { useQuery } from '@tanstack/react-query';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR';
  message: string;
  source?: string;
}

interface LogService {
  logs: LogEntry[];
  addLog: (level: LogEntry['level'], message: string, source?: string) => void;
  clearLogs: () => void;
  getLogsByLevel: (level: LogEntry['level']) => LogEntry[];
}

interface RepositoryStatus {
  repositoryId: string;
  cloneStatus: 'pending' | 'cloned' | 'failed';
  localPath?: string;
  lastAnalysisAt?: string;
  lastReportId?: string;
}

interface AppContextType {
  currentRepository: Repository | null;
  setCurrentRepository: (repo: Repository | null) => void;
  isRepositoryLoading: boolean;
  repositoryStatus: RepositoryStatus | null;
  refreshRepositoryStatus: (repositoryId: string) => Promise<void>;
  isCodeAnalysisEnabled: boolean;
  isTestCoverageComplete: boolean;
  canAccessMigration: (reportId: string) => boolean;
  enableMigrationAccess: (reportId: string) => void;
  hasMigrationAccess: boolean;
  switchToTab: (tab: string) => void;
  logService: LogService;
  showRepoPanel: boolean;
  toggleRepoPanel: () => void;
  lastExpandedWidth: number;
  setLastExpandedWidth: (width: number) => void;
  handleToggleRepoPanel: (getCurrentSize?: () => number) => void;
}

interface RepositoriesResponse {
  repositories: Repository[];
}

const AppContext = createContext<AppContextType | undefined>(undefined);

interface AppProviderProps {
  children: ReactNode;
}

export function AppProvider({ children }: AppProviderProps) {
  const [currentRepository, setCurrentRepository] = useState<Repository | null>(null);
  const [repositoryStatus, setRepositoryStatus] = useState<RepositoryStatus | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [accessedReports, setAccessedReports] = useState<Set<string>>(new Set());
  
  // Sidebar visibility state with localStorage persistence
  const [showRepoPanel, setShowRepoPanel] = useState<boolean>(() => {
    try {
      const savedState = localStorage.getItem('git-analyzer-show-repo-panel');
      return savedState ? JSON.parse(savedState) : true; // Default to showing the panel
    } catch (error) {
      console.warn('Failed to parse localStorage data for showRepoPanel:', error);
      return true; // Default fallback
    }
  });

  // Last expanded width state with localStorage persistence
  const [lastExpandedWidth, setLastExpandedWidthState] = useState<number>(() => {
    try {
      const savedWidth = localStorage.getItem('git-analyzer-last-expanded-width');
      const parsed = savedWidth ? parseFloat(savedWidth) : 22;
      return isNaN(parsed) ? 22 : parsed; // Default to 22% width if NaN
    } catch (error) {
      console.warn('Failed to parse localStorage data for lastExpandedWidth:', error);
      return 22; // Default fallback
    }
  });

  // Toggle repository panel visibility
  const toggleRepoPanel = () => {
    setShowRepoPanel(prev => {
      const newValue = !prev;
      logService.addLog('INFO', `Repository panel ${newValue ? 'shown' : 'hidden'}`, 'AppContext');
      return newValue;
    });
  };

  // Set last expanded width with localStorage persistence
  const setLastExpandedWidth = (width: number) => {
    // Validate width (should be between 12 and 45 as per the component constraints)
    const validWidth = Math.max(12, Math.min(45, width));
    setLastExpandedWidthState(validWidth);
    try {
      localStorage.setItem('git-analyzer-last-expanded-width', validWidth.toString());
    } catch (error) {
      console.warn('Failed to save lastExpandedWidth to localStorage:', error);
    }
  };

  // Custom toggle function that saves current panel size before collapsing
  const handleToggleRepoPanel = (getCurrentSize?: () => number) => {
    if (showRepoPanel && getCurrentSize) {
      // Before hiding, save the current panel size
      const currentSize = getCurrentSize();
      if (currentSize && currentSize > 12) {
        setLastExpandedWidth(currentSize);
      }
    } else if (!showRepoPanel) {
      // When expanding, we'll log that we should restore width (actual resizing happens in MainPage)
    }
    toggleRepoPanel();
  };

  // Persist showRepoPanel state to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('git-analyzer-show-repo-panel', JSON.stringify(showRepoPanel));
    } catch (error) {
      console.warn('Failed to save showRepoPanel to localStorage:', error);
    }
  }, [showRepoPanel]);

  // Check for existing repositories on load
  const { data: repositoriesData, isLoading } = useQuery<RepositoriesResponse>({
    queryKey: ['/api/repositories'],
    staleTime: 0,
    retry: false, // Prevent retries that might cause context issues
  });

  // Function to refresh repository status
  const refreshRepositoryStatus = async (repositoryId: string) => {
    try {
      const response = await fetch(`/api/repositories/${repositoryId}/status`);
      if (response.ok) {
        const status = await response.json();
        setRepositoryStatus(status);
      }
    } catch (error) {
      console.error('Failed to fetch repository status:', error);
    }
  };

  // Set the most recent repository as current on load, or clear when empty
  useEffect(() => {
    if (repositoriesData?.repositories && Array.isArray(repositoriesData.repositories)) {
      if (repositoriesData.repositories.length > 0 && !currentRepository) {
        // Set most recent repository if none is selected
        const mostRecent = repositoriesData.repositories.sort((a: Repository, b: Repository) => 
          new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
        )[0];
        setCurrentRepository(mostRecent);
      } else if (repositoriesData.repositories.length === 0 && currentRepository) {
        // Clear repository when list becomes empty
        setCurrentRepository(null);
      }
    }
  }, [repositoriesData, currentRepository]);

  // Query reports to watch for new migration analyses
  const { data: migrationReportsData } = useQuery<{ reports: any[] }>({
    queryKey: ['/api/analysis/reports', currentRepository?.id],
    enabled: !!currentRepository?.id,
    staleTime: 0,
  });

  // Refresh repository status when current repository changes
  useEffect(() => {
    if (currentRepository?.id) {
      refreshRepositoryStatus(currentRepository.id);
    } else {
      setRepositoryStatus(null);
    }
    // Reset migration access when repository changes (clear all accessed reports)
    setAccessedReports(new Set());
  }, [currentRepository]);

  // Clear accessed reports when new migration reports are generated
  useEffect(() => {
    if (migrationReportsData?.reports) {
      const migrationReports = migrationReportsData.reports.filter((r: any) => 
        r.analysisType?.includes('migration') || r.analysisType === 'default'
      );
      
      if (migrationReports.length > 0) {
        // Get the most recent migration report
        const mostRecentReport = migrationReports.sort((a: any, b: any) => 
          new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        )[0];
        
        // Clear accessed reports so the "Proceed" button shows for new analyses
        setAccessedReports(new Set());
      }
    }
  }, [migrationReportsData?.reports?.length, migrationReportsData?.reports?.[0]?.createdAt]);

  // Check if a specific report has migration access enabled
  const canAccessMigration = (reportId: string): boolean => {
    return accessedReports.has(reportId);
  };

  // Enable migration access for a specific report (called from Code Analysis proceed button)
  const enableMigrationAccess = (reportId: string) => {
    setAccessedReports(prev => {
      const next = new Set(prev);
      next.add(reportId);
      return next;
    });
    logService.addLog('INFO', `Code Migration access enabled for report: ${reportId}`, 'AppContext');
  };

  // Switch to a specific tab (called from Proceed button)
  const switchToTab = (tab: string) => {
    // Access setActiveTab from window (set by MainPage)
    const setActiveTab = (window as any).__setActiveTab;
    if (setActiveTab) {
      setActiveTab(tab);
      logService.addLog('INFO', `Switched to ${tab} tab`, 'AppContext');
    }
  };

  // LogService implementation
  const logService: LogService = {
    logs,
    addLog: (level: LogEntry['level'], message: string, source?: string) => {
      const newLog: LogEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: new Date().toISOString(),
        level,
        message,
        source
      };
      
      setLogs(prevLogs => {
        // Keep last 1000 logs to prevent memory issues
        const updatedLogs = [...prevLogs, newLog];
        if (updatedLogs.length > 1000) {
          return updatedLogs.slice(-1000);
        }
        return updatedLogs;
      });
    },
    clearLogs: () => {
      setLogs([]);
    },
    getLogsByLevel: (level: LogEntry['level']) => {
      return logs.filter(log => log.level === level);
    }
  };

  // Initialize logging
  useEffect(() => {
    logService.addLog('INFO', 'Activity logging system initialized', 'AppContext');
  }, []);

  // Fetch test coverage reports to check if test coverage is complete
  const { data: reportsData } = useQuery<{ reports: any[] }>({
    queryKey: ['/api/analysis/reports', currentRepository?.id],
    enabled: !!currentRepository?.id,
    staleTime: 5000,
  });

  // Check if test coverage analysis is complete
  // Test coverage reports have structuredData (parsed JSON) instead of generatedFiles
  const isTestCoverageComplete = !!reportsData?.reports?.some(
    (r: any) => r.analysisType === 'test-coverage' && r.structuredData
  );

  // Compute if Code Analysis is enabled based on repository clone status AND test coverage completion
  const isCodeAnalysisEnabled = currentRepository !== null && 
    repositoryStatus !== null && 
    repositoryStatus.cloneStatus === 'cloned' &&
    isTestCoverageComplete;

  // Compute if any migration report exists (for Code Migration tab)
  // The tab should be enabled if there's ANY migration report, regardless of "Proceed to Migration" button
  const hasMigrationAccess = !!(reportsData?.reports?.some(r => 
    r.analysisType?.includes('migration') || r.analysisType === 'default'
  ));

  const value = {
    currentRepository,
    setCurrentRepository,
    isRepositoryLoading: isLoading,
    repositoryStatus,
    refreshRepositoryStatus,
    isCodeAnalysisEnabled,
    isTestCoverageComplete,
    canAccessMigration,
    enableMigrationAccess,
    hasMigrationAccess,
    switchToTab,
    logService,
    showRepoPanel,
    toggleRepoPanel,
    lastExpandedWidth,
    setLastExpandedWidth,
    handleToggleRepoPanel
  };

  return (
    <AppContext.Provider value={value}>
      {children}
    </AppContext.Provider>
  );
}

// Export the hook in a way that's compatible with Fast Refresh
export const useAppContext = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    // In development, provide a safe fallback instead of throwing
    // This prevents crashes during hot module replacement
    const fallback = {
      currentRepository: null,
      setCurrentRepository: () => {},
      isRepositoryLoading: false,
      repositoryStatus: null,
      refreshRepositoryStatus: async () => {},
      isCodeAnalysisEnabled: false,
      isTestCoverageComplete: false,
      canAccessMigration: () => false,
      enableMigrationAccess: () => {},
      hasMigrationAccess: false,
      switchToTab: () => {},
      logService: {
        logs: [],
        addLog: () => {},
        clearLogs: () => {},
        getLogsByLevel: () => []
      },
      showRepoPanel: true,
      toggleRepoPanel: () => {},
      lastExpandedWidth: 22,
      setLastExpandedWidth: () => {},
      handleToggleRepoPanel: () => {}
    };
    
    if (import.meta.env.DEV) {
      return fallback;
    }
    
    // Only throw in production if context is genuinely missing
    throw new Error('useAppContext must be used within an AppProvider');
  }
  return context;
};