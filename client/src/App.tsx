import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProvider } from "./context/AppContext";
import MainPage from "@/pages/MainPage";
import NotFound from "@/pages/not-found";
import { Component, ErrorInfo, ReactNode, useEffect } from "react";

// Cache busting component - prevents browser caching issues
function CacheBuster() {
  useEffect(() => {
    const performCacheBuster = async () => {
      try {
        // Set initial cache control on document
        if (document.documentElement) {
          document.documentElement.style.setProperty('--cache-bust', Date.now().toString());
        }
        
        // Force clear any existing caches
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(name => caches.delete(name)));
        }
        
        // Version checking mechanism
        const currentBuild = Date.now().toString();
        const storedBuild = sessionStorage.getItem('app-build');
        
        // Smart cache busting - only clear if build actually changed
        if (!storedBuild || storedBuild !== currentBuild) {
          console.log('🔄 Cache busting: Clearing cached data for new build');
          
          // Clear session storage
          sessionStorage.clear();
          
          // Clear service worker caches if available
          if ('caches' in window) {
            try {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (e) {
              console.warn('Cache clearing failed:', e);
            }
          }
          
          // Set new build version
          sessionStorage.setItem('app-build', currentBuild);
          sessionStorage.setItem('cache-cleared', 'true');
        }
        
        // Periodic check for updates (every 2 minutes)
        const checkInterval = setInterval(async () => {
          try {
            const healthCheck = await fetch(`/api/admin/oauth-config?t=${Date.now()}`, {
              method: 'GET',
              cache: 'no-cache',
              headers: { 'Cache-Control': 'no-cache, no-store' }
            });
            
            // If server is unreachable or returns different response, might be updated
            if (!healthCheck.ok) {
              console.log('🔄 Server response changed, considering refresh...');
            }
          } catch (error) {
            // Silently handle network errors
            console.debug('Health check failed:', error);
          }
        }, 120000); // 2 minutes
        
        return () => clearInterval(checkInterval);
      } catch (error) {
        console.debug('Cache busting failed:', error);
      }
    };
    
    performCacheBuster();
  }, []);
  
  return null;
}

// ErrorBoundary to catch and log the real error
class ErrorBoundary extends Component<{children: ReactNode}, {hasError: boolean; error?: Error}> {
  constructor(props: {children: ReactNode}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red', fontFamily: 'monospace' }}>
          <h2>React Error Caught:</h2>
          <pre>{this.state.error?.message}</pre>
          <pre>{this.state.error?.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={MainPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

// CRITICAL: Ensure QueryClientProvider is ALWAYS above AppProvider
function App() {
  return (
    <ErrorBoundary>
      <CacheBuster />
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </AppProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
