import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { motion, AnimatePresence } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Github, GitlabIcon as Gitlab, Users, GitBranch, Server, Globe, Lock, Zap, Key, AlertCircle } from "lucide-react";
import { AuthCredentials } from "@shared/schema";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function AuthModal({ open, onOpenChange }: AuthModalProps) {
  const [selectedProvider, setSelectedProvider] = useState("github");
  const [authMethod, setAuthMethod] = useState("oauth");
  const [credentials, setCredentials] = useState({
    token: "",
    username: "",
    password: ""
  });
  const [oauthConfigStatus, setOauthConfigStatus] = useState<Record<string, boolean>>({});
  const [configCheckLoading, setConfigCheckLoading] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  
  const { authenticate, isLoading } = useAuth();
  const { toast } = useToast();

  // Check OAuth configuration for all providers
  const checkOauthConfig = async () => {
    if (authMethod !== "oauth") return;
    
    setConfigCheckLoading(true);
    setConfigError(null);
    
    try {
      const configResponse = await fetch('/api/admin/oauth-config');
      const configData = await configResponse.json();
      
      if (configData.status) {
        setOauthConfigStatus(configData.status);
      } else {
        setConfigError("Failed to load OAuth configuration");
      }
    } catch (error) {
      setConfigError("Failed to verify OAuth configuration");
    } finally {
      setConfigCheckLoading(false);
    }
  };

  // Check configuration when modal opens or provider changes
  useEffect(() => {
    if (open && authMethod === "oauth") {
      checkOauthConfig();
    }
  }, [open, authMethod]);

  // Check configuration when provider changes (for OAuth method)
  useEffect(() => {
    if (authMethod === "oauth") {
      checkOauthConfig();
    }
  }, [selectedProvider, authMethod]);

  const handleAuthenticate = async () => {
    if (authMethod === "oauth") {
      // For OAuth, configuration is checked upfront, so proceed with redirect
      window.location.href = `/api/auth/oauth/${selectedProvider}`;
      return;
    }

    // For PAT and credentials, use the existing authentication flow
    const authCredentials: AuthCredentials = {
      type: authMethod as any,
      token: credentials.token || undefined,
      username: credentials.username || undefined,
      password: credentials.password || undefined
    };

    const success = await authenticate(selectedProvider, authCredentials);
    if (success) {
      onOpenChange(false);
      setCredentials({ token: "", username: "", password: "" });
    }
  };

  const providerButtons = [
    { id: "github", name: "GitHub", icon: Github, color: "bg-[#24292e] hover:bg-[#2c3237]" },
    { id: "gitlab", name: "GitLab", icon: Gitlab, color: "bg-[#6b46c1] hover:bg-[#7c3aed]" },
    { id: "azure", name: "Azure DevOps", icon: Users, color: "bg-[#0078d4] hover:bg-[#106ebe]" },
    { id: "bitbucket", name: "Bitbucket", icon: GitBranch, color: "bg-[#0052cc] hover:bg-[#0065ff]" },
    { id: "gitea", name: "Gitea", icon: Server, color: "bg-[#609926] hover:bg-[#7cb342]" },
    { id: "codeberg", name: "Codeberg", icon: Globe, color: "bg-[#2185d0] hover:bg-[#1678c2]" },
    { id: "sourcehut", name: "SourceHut", icon: Server, color: "bg-[#ff6900] hover:bg-[#e55a00]" }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md shadow-strong border-border/50">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.2, ease: "easeOut" }}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <motion.div
                whileHover={{ rotate: 15, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Lock className="h-5 w-5 text-primary" />
              </motion.div>
              Authenticate with Git Provider
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Enhanced Provider Selection */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
            >
              <Label className="text-sm font-medium mb-2 block">Select Provider</Label>
              <div className="space-y-2">
                {providerButtons.map((provider, index) => {
                  const Icon = provider.icon;
                  return (
                    <motion.div
                      key={provider.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2, delay: 0.1 + index * 0.05 }}
                    >
                      <Button
                        variant="outline"
                        className={`w-full justify-start gap-3 hover-lift transition-smooth group relative overflow-hidden ${
                          selectedProvider === provider.id 
                            ? "border-primary bg-primary/10 text-primary" 
                            : "hover:bg-muted hover:border-muted-foreground/20"
                        }`}
                        onClick={() => setSelectedProvider(provider.id)}
                        data-testid={`button-provider-${provider.id}`}
                      >
                        <motion.div
                          whileHover={{ scale: 1.1, rotate: 5 }}
                          transition={{ type: "spring", stiffness: 400, damping: 10 }}
                        >
                          <Icon className="h-5 w-5" />
                        </motion.div>
                        {provider.name}
                        {selectedProvider === provider.id && (
                          <motion.div
                            className="absolute right-2"
                            initial={{ opacity: 0, scale: 0.5 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ type: "spring", stiffness: 400, damping: 10 }}
                          >
                            <div className="h-2 w-2 rounded-full bg-primary" />
                          </motion.div>
                        )}
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            {/* Enhanced Authentication Method */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.2 }}
            >
              <Label htmlFor="auth-method" className="text-sm font-medium mb-2 block">
                Authentication Method
              </Label>
              <motion.div
                whileHover={{ scale: 1.01 }}
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              >
                <Select value={authMethod} onValueChange={setAuthMethod}>
                  <SelectTrigger data-testid="select-auth-method" className="hover:border-primary/50 transition-colors">
                    <div className="flex items-center gap-2">
                      {authMethod === "oauth" && <Zap className="h-4 w-4 text-primary" />}
                      {authMethod === "pat" && <Key className="h-4 w-4 text-primary" />}
                      {authMethod === "credentials" && <Lock className="h-4 w-4 text-primary" />}
                      <SelectValue placeholder="Select method" />
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="oauth">
                      <div className="flex items-center gap-2">
                        <Zap className="h-4 w-4 text-green-500" />
                        <div>
                          <div className="font-medium">OAuth (Recommended)</div>
                          <div className="text-xs text-muted-foreground">Secure browser authentication</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="pat">
                      <div className="flex items-center gap-2">
                        <Key className="h-4 w-4 text-blue-500" />
                        <div>
                          <div className="font-medium">Personal Access Token</div>
                          <div className="text-xs text-muted-foreground">Use your personal token</div>
                        </div>
                      </div>
                    </SelectItem>
                    <SelectItem value="credentials">
                      <div className="flex items-center gap-2">
                        <Lock className="h-4 w-4 text-orange-500" />
                        <div>
                          <div className="font-medium">Username & Password</div>
                          <div className="text-xs text-muted-foreground">Traditional credentials</div>
                        </div>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </motion.div>
            </motion.div>

          {/* OAuth Method */}
          {authMethod === "oauth" && (
            <div className="space-y-3">
              {configCheckLoading ? (
                <div className="p-3 border rounded-md bg-muted/50">
                  <div className="flex items-center gap-2 text-sm">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    >
                      <Zap className="h-4 w-4" />
                    </motion.div>
                    Checking OAuth configuration...
                  </div>
                </div>
              ) : configError ? (
                <div className="p-3 border rounded-md bg-destructive/10 border-destructive/20">
                  <div className="flex items-center gap-2 text-sm text-destructive mb-2">
                    <AlertCircle className="h-4 w-4" />
                    Configuration Check Failed
                  </div>
                  <p className="text-sm text-muted-foreground">{configError}</p>
                </div>
              ) : !oauthConfigStatus[selectedProvider] ? (
                <div className="p-3 border rounded-md bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800">
                  <div className="flex items-center gap-2 text-sm text-orange-700 dark:text-orange-300 mb-2">
                    <AlertCircle className="h-4 w-4" />
                    OAuth Configuration Required
                  </div>
                  <p className="text-sm text-orange-600 dark:text-orange-400">
                    Please configure OAuth Credentials in the Environment Variables for {selectedProvider} to enable sign in
                  </p>
                </div>
              ) : (
                <div className="p-3 border rounded-md bg-card">
                  <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-green-500" />
                    OAuth Ready
                  </h4>
                  <p className="text-sm text-muted-foreground">
                    Click below to sign in with {selectedProvider}. You'll be redirected to {selectedProvider}'s official login page.
                  </p>
                </div>
              )}
              <Button 
                className="w-full" 
                onClick={handleAuthenticate}
                disabled={isLoading || configCheckLoading || !!configError || !oauthConfigStatus[selectedProvider]}
                data-testid="button-oauth-authenticate"
              >
                {isLoading ? "Redirecting..." : 
                 configCheckLoading ? "Checking configuration..." :
                 !oauthConfigStatus[selectedProvider] ? "Configuration Required" :
                 `Sign in with ${selectedProvider}`}
              </Button>
            </div>
          )}

          {/* PAT Method */}
          {authMethod === "pat" && (
            <div className="space-y-3">
              {/* Show username field for Bitbucket */}
              {selectedProvider === "bitbucket" && (
                <div>
                  <Label htmlFor="username" className="text-sm font-medium mb-2 block">
                    Username (Required for Bitbucket)
                  </Label>
                  <Input
                    id="username"
                    type="text"
                    placeholder="your-username"
                    value={credentials.username}
                    onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                    data-testid="input-username"
                  />
                </div>
              )}
              <div>
                <Label htmlFor="pat-token" className="text-sm font-medium mb-2 block">
                  {selectedProvider === "bitbucket" ? "App Password" : "Personal Access Token"}
                </Label>
                <Input
                  id="pat-token"
                  type="password"
                  placeholder={selectedProvider === "bitbucket" ? "app-password-here" : "token-here"}
                  value={credentials.token}
                  onChange={(e) => setCredentials(prev => ({ ...prev, token: e.target.value }))}
                  data-testid="input-pat-token"
                />
                {selectedProvider === "bitbucket" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Use App Password instead of your account password
                  </p>
                )}
                {selectedProvider === "gitea" && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Works with self-hosted Gitea instances
                  </p>
                )}
              </div>
              <Button 
                className="w-full" 
                onClick={handleAuthenticate}
                disabled={isLoading || !credentials.token || (selectedProvider === "bitbucket" && !credentials.username)}
                data-testid="button-pat-authenticate"
              >
                {isLoading ? "Authenticating..." : "Authenticate with Token"}
              </Button>
            </div>
          )}

          {/* Credentials Method */}
          {authMethod === "credentials" && (
            <div className="space-y-3">
              <div>
                <Label htmlFor="username" className="text-sm font-medium mb-2 block">
                  Username
                </Label>
                <Input
                  id="username"
                  type="text"
                  placeholder="username"
                  value={credentials.username}
                  onChange={(e) => setCredentials(prev => ({ ...prev, username: e.target.value }))}
                  data-testid="input-username"
                />
              </div>
              <div>
                <Label htmlFor="password" className="text-sm font-medium mb-2 block">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="password"
                  value={credentials.password}
                  onChange={(e) => setCredentials(prev => ({ ...prev, password: e.target.value }))}
                  data-testid="input-password"
                />
              </div>
              <Button 
                className="w-full" 
                onClick={handleAuthenticate}
                disabled={isLoading || !credentials.username || !credentials.password}
                data-testid="button-credentials-authenticate"
              >
                {isLoading ? "Authenticating..." : "Sign In"}
              </Button>
            </div>
          )}
        </div>
        </motion.div>
      </DialogContent>
    </Dialog>
  );
}
