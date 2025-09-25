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

  // Refresh repository status when current repository changes
  useEffect(() => {
    if (currentRepository?.id) {
      refreshRepositoryStatus(currentRepository.id);
    } else {
      setRepositoryStatus(null);
    }
  }, [currentRepository]);

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

  // Compute if Code Analysis is enabled based on repository clone status
  const isCodeAnalysisEnabled = currentRepository !== null && 
    repositoryStatus !== null && 
    repositoryStatus.cloneStatus === 'cloned';

  const value = {
    currentRepository,
    setCurrentRepository,
    isRepositoryLoading: isLoading,
    repositoryStatus,
    refreshRepositoryStatus,
    isCodeAnalysisEnabled,
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