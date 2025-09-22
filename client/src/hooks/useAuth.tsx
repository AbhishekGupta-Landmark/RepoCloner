import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AuthCredentials } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";

interface User {
  username: string;
  provider: string;
}

interface AuthStatus {
  authenticated: boolean;
  username?: string;
  provider?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check authentication status
  const { data: authStatus, isLoading } = useQuery<AuthStatus>({
    queryKey: ['/api/auth/status'],
    staleTime: 0
  });

  useEffect(() => {
    if (authStatus?.authenticated && authStatus.username && authStatus.provider) {
      setUser({
        username: authStatus.username,
        provider: authStatus.provider
      });
    } else {
      setUser(null);
    }
  }, [authStatus]);

  // Handle OAuth callback parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const authResult = urlParams.get('auth');
    const provider = urlParams.get('provider');
    const username = urlParams.get('username');
    const errorMessage = urlParams.get('message');

    if (authResult === 'success' && provider && username) {
      toast({
        title: "Authentication Successful",
        description: `Signed in as ${decodeURIComponent(username)} via ${provider}`
      });
      // Invalidate auth status to refresh user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (authResult === 'error' && errorMessage) {
      toast({
        title: "Authentication Failed",
        description: decodeURIComponent(errorMessage),
        variant: "destructive"
      });
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [toast, queryClient]);

  // Authentication mutation
  const authenticateMutation = useMutation({
    mutationFn: async ({ provider, credentials }: { provider: string; credentials: AuthCredentials }) => {
      const response = await apiRequest('POST', '/api/auth/authenticate', {
        provider,
        credentials
      });
      return await response.json();
    },
    onSuccess: (data) => {
      setUser({
        username: data.username,
        provider: data.provider
      });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
      toast({
        title: "Authentication Successful",
        description: `Signed in as ${data.username} via ${data.provider}`
      });
    },
    onError: (error: any) => {
      toast({
        title: "Authentication Failed",
        description: error.message || "Failed to authenticate",
        variant: "destructive"
      });
    }
  });

  // Sign out mutation
  const signOutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/logout', {});
      return await response.json();
    },
    onSuccess: () => {
      setUser(null);
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
      toast({
        title: "Signed Out",
        description: "You have been successfully signed out"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Sign Out Failed",
        description: error.message || "Failed to sign out",
        variant: "destructive"
      });
    }
  });

  const authenticate = async (provider: string, credentials: AuthCredentials): Promise<boolean> => {
    try {
      await authenticateMutation.mutateAsync({ provider, credentials });
      return true;
    } catch (error) {
      return false;
    }
  };

  const signOut = async (): Promise<void> => {
    await signOutMutation.mutateAsync();
  };

  return {
    user,
    isAuthenticated: !!user,
    isLoading: isLoading || authenticateMutation.isPending || signOutMutation.isPending,
    authenticate,
    signOut
  };
}
