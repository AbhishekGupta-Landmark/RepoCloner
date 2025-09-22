import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { AuthCredentials, OAuthAccountPublic, AccountsResponse } from "@shared/schema";
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

interface MultiAuthState {
  accounts: OAuthAccountPublic[];
  activeAccountId?: string;
  activeAccount?: OAuthAccountPublic;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [multiAuthState, setMultiAuthState] = useState<MultiAuthState>({ accounts: [] });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Check authentication status
  const { data: authStatus, isLoading } = useQuery<AuthStatus>({
    queryKey: ['/api/auth/status'],
    staleTime: 0
  });

  // Fetch all accounts for multi-account support
  const { data: accountsData, isLoading: accountsLoading } = useQuery<AccountsResponse>({
    queryKey: ['/api/auth/accounts'],
    enabled: authStatus?.authenticated || false,
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

  // Update multi-auth state when accounts data changes
  useEffect(() => {
    if (accountsData) {
      const activeAccount = accountsData.accounts.find(acc => acc.id === accountsData.activeAccountId);
      setMultiAuthState({
        accounts: accountsData.accounts,
        activeAccountId: accountsData.activeAccountId,
        activeAccount
      });
    } else {
      setMultiAuthState({ accounts: [] });
    }
  }, [accountsData]);

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

  // Account switching mutation
  const switchAccountMutation = useMutation({
    mutationFn: async (accountId: string) => {
      const response = await apiRequest('POST', '/api/auth/switch', { accountId });
      return await response.json();
    },
    onSuccess: () => {
      // Refresh both auth status and accounts data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/accounts'] });
      toast({
        title: "Account Switched",
        description: "Successfully switched to the selected account"
      });
    },
    onError: (error: any) => {
      toast({
        title: "Switch Failed",
        description: error.message || "Failed to switch accounts",
        variant: "destructive"
      });
    }
  });

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
      // Refresh both auth status and accounts data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/accounts'] });
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

  // Sign out mutation (supports both single account and full logout)
  const signOutMutation = useMutation({
    mutationFn: async (accountId?: string) => {
      const response = await apiRequest('POST', '/api/auth/logout', accountId ? { accountId } : {});
      return await response.json();
    },
    onSuccess: (data) => {
      // Refresh both auth status and accounts data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/status'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/accounts'] });
      
      if (data.accountsRemaining === 0) {
        setUser(null);
        setMultiAuthState({ accounts: [] });
        toast({
          title: "Signed Out",
          description: "You have been signed out of all accounts"
        });
      } else {
        toast({
          title: "Account Removed",
          description: "Account removed successfully"
        });
      }
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

  const signOut = async (accountId?: string): Promise<void> => {
    await signOutMutation.mutateAsync(accountId);
  };

  const switchAccount = async (accountId: string): Promise<void> => {
    await switchAccountMutation.mutateAsync(accountId);
  };

  return {
    user,
    isAuthenticated: authStatus?.authenticated || false,
    isLoading: isLoading || accountsLoading,
    authenticate,
    signOut,
    switchAccount,
    isAuthenticating: authenticateMutation.isPending,
    isSigningOut: signOutMutation.isPending,
    isSwitchingAccount: switchAccountMutation.isPending,
    // Multi-account data
    accounts: multiAuthState.accounts,
    activeAccount: multiAuthState.activeAccount,
    activeAccountId: multiAuthState.activeAccountId,
    hasMultipleAccounts: multiAuthState.accounts.length > 1
  };
}
