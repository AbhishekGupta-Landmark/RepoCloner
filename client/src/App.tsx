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
        
        // Cache version check
        const requiredVersion = "v1.0";
        const lastVersion = sessionStorage.getItem('ui-version');
        
        if (lastVersion !== requiredVersion) {
          // Clear ALL storage
          sessionStorage.clear();
          localStorage.clear();
          
          // Clear ALL caches aggressively
          if ('caches' in window) {
            try {
              const cacheNames = await caches.keys();
              await Promise.all(cacheNames.map(name => caches.delete(name)));
            } catch (e) {
              console.warn('Cache clearing failed:', e);
            }
          }
          
          // Set new version
          sessionStorage.setItem('ui-version', requiredVersion);
          sessionStorage.setItem('cache-cleared', new Date().toISOString());
          
          // Force reload with timestamp if URL doesn't have fresh timestamp
          const urlParams = new URLSearchParams(window.location.search);
          const currentTimestamp = urlParams.get('fresh');
          const freshTimestamp = Date.now().toString();
          
          if (currentTimestamp !== freshTimestamp) {
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.set('fresh', freshTimestamp);
            newUrl.searchParams.set('v', requiredVersion);
            
            window.location.replace(newUrl.toString());
            return;
          }
        }
        
        // Verify UI components loaded correctly
        setTimeout(() => {
          const setupText = document.querySelector('[title*="Migration Analysis Setup"], [aria-label*="Migration Analysis Setup"]');
          const bodyText = document.body.textContent || '';
          const hasOldKafkaText = bodyText.includes('Kafka → Azure Service Bus');
          
          if (!setupText && hasOldKafkaText && window.location.search.includes('fresh=')) {
            window.location.reload();
          }
        }, 3000);
        
        // Periodic check for updates (every 2 minutes)
        const checkInterval = setInterval(async () => {
          try {
            const healthCheck = await fetch(`/api/admin/oauth-config?t=${Date.now()}`, {
              method: 'GET',
              cache: 'no-cache',
              headers: { 'Cache-Control': 'no-cache, no-store' }
            });
          } catch (error) {
            // Silently handle network errors
          }
        }, 120000); // 2 minutes
        
        return () => clearInterval(checkInterval);
      } catch (error) {
        // Cache busting failed silently
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
