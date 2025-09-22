import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { useCloning } from "@/hooks/useCloning";
import { useAuth } from "@/hooks/useAuth";
import { useAppContext } from "@/context/AppContext";
import { Github, GitlabIcon as Gitlab, Users, Download, Clipboard, Lock, Globe, Server } from "lucide-react";
import { SiBitbucket, SiGitea } from "react-icons/si";
import { useToast } from "@/hooks/use-toast";

export default function RepositoryInput() {
  const [selectedProvider, setSelectedProvider] = useState("github");
  const [repoUrl, setRepoUrl] = useState("");
  const [cloneOptions, setCloneOptions] = useState({
    mirror: true,
    personalAccount: true
  });

  const { cloneRepository, isLoading } = useCloning();
  const { user, isAuthenticated } = useAuth();
  const { logService } = useAppContext();
  const { toast } = useToast();

  // Logging helper
  const addLogEntry = (level: 'INFO' | 'DEBUG' | 'WARN' | 'ERROR', message: string, source?: string) => {
    logService.addLog(level, message, source || 'RepositoryInput');
  };

  const providerButtons = [
    { id: "github", name: "GitHub", icon: Github },
    { id: "gitlab", name: "GitLab", icon: Gitlab },
    { id: "azure", name: "Azure DevOps", icon: Users },
    { id: "bitbucket", name: "Bitbucket", icon: SiBitbucket },
    { id: "gitea", name: "Gitea", icon: SiGitea },
    { id: "codeberg", name: "Codeberg", icon: Globe },
    { id: "sourcehut", name: "SourceHut", icon: Server }
  ];

  const validateUrlForProvider = (url: string, provider: string): boolean => {
    
    const urlPatterns: Record<string, RegExp> = {
      github: /^https?:\/\/(www\.)?github\.com\/[^\/]+\/[^\/]+(\.git)?$/,
      gitlab: /^https?:\/\/(www\.)?gitlab\.com\/[^\/]+\/[^\/]+(\.git)?$/,
      bitbucket: /^https?:\/\/(www\.)?bitbucket\.org\/[^\/]+\/[^\/]+(\.git)?$/,
      azure: /^https?:\/\/dev\.azure\.com\/[^\/]+\/[^\/]+\/_git\/[^\/]+$/,
      gitea: /^https?:\/\/[^\/]+\/[^\/]+\/[^\/]+(\.git)?$/,
      codeberg: /^https?:\/\/(www\.)?codeberg\.org\/[^\/]+\/[^\/]+(\.git)?$/,
      sourcehut: /^https?:\/\/(www\.)?sr\.ht\/~[^\/]+\/[^\/]+(\.git)?$/
    };

    const pattern = urlPatterns[provider];
    if (!pattern) {
      addLogEntry('WARN', `No URL pattern defined for provider: ${provider}`, 'URL Validation');
      return true; // Allow if no pattern defined
    }

    const isValid = pattern.test(url);
    addLogEntry(isValid ? 'INFO' : 'WARN', `URL validation ${isValid ? 'passed' : 'failed'} for ${provider}`, 'URL Validation');
    return isValid;
  };

  const handleClone = async () => {
    addLogEntry('INFO', 'User initiated clone request', 'User Action');
    
    if (!repoUrl.trim()) {
      addLogEntry('ERROR', 'Clone request failed: No repository URL provided', 'Input Validation');
      toast({
        title: "Error",
        description: "Please enter a repository URL",
        variant: "destructive"
      });
      return;
    }

    addLogEntry('INFO', `Validating repository URL: ${repoUrl.trim()}`, 'Input Validation');
    
    // Validate URL matches selected provider
    if (!validateUrlForProvider(repoUrl.trim(), selectedProvider)) {
      const providerName = providerButtons.find(p => p.id === selectedProvider)?.name || selectedProvider;
      addLogEntry('ERROR', `URL validation failed for ${providerName} provider`, 'Input Validation');
      addLogEntry('ERROR', 'Clone request rejected due to invalid URL format', 'Clone Request');
      
      toast({
        title: "Invalid URL",
        description: `The URL doesn't match the selected provider (${providerName}). Please check the URL or select the correct provider.`,
        variant: "destructive"
      });
      return;
    }

    addLogEntry('INFO', 'URL validation passed, proceeding with clone...', 'Input Validation');
    addLogEntry('INFO', `Initiating clone for repository: ${repoUrl}`, 'Clone Request');
    
    const success = await cloneRepository(repoUrl, cloneOptions);
    if (success) {
      addLogEntry('INFO', 'Clone request completed successfully', 'Clone Complete');
      toast({
        title: "Success",
        description: "Repository cloned successfully"
      });
    } else {
      addLogEntry('ERROR', 'Clone request failed to complete', 'Clone Error');
    }
  };

  const pasteFromClipboard = async () => {
    addLogEntry('INFO', 'User requested clipboard paste', 'User Action');
    try {
      const text = await navigator.clipboard.readText();
      addLogEntry('INFO', `Successfully read ${text.length} characters from clipboard`, 'Clipboard');
      setRepoUrl(text);
      addLogEntry('INFO', 'Repository URL field updated from clipboard', 'UI Update');
    } catch (error: any) {
      addLogEntry('ERROR', `Failed to read from clipboard: ${error.message}`, 'Clipboard Error');
      toast({
        title: "Error", 
        description: "Failed to read from clipboard",
        variant: "destructive"
      });
    }
  };

  // Enhanced provider change handler with logging
  const handleProviderChange = (provider: string) => {
    addLogEntry('INFO', `User changed provider from ${selectedProvider} to ${provider}`, 'User Action');
    setSelectedProvider(provider);
  };

  // Enhanced URL input handler with logging
  const handleUrlChange = (url: string) => {
    if (url !== repoUrl) {
      setRepoUrl(url);
    }
  };

  return (
    <div className="p-4 border-b border-border">
      <h2 className="text-lg font-semibold mb-4">Clone Repository</h2>
      
      {/* Provider Selection */}
      <div className="mb-4">
        <Label className="block text-sm font-medium mb-2">Git Provider</Label>
        <Select value={selectedProvider} onValueChange={handleProviderChange}>
          <SelectTrigger className="w-full" data-testid="select-provider">
            <SelectValue>
              {(() => {
                const currentProvider = providerButtons.find(p => p.id === selectedProvider);
                if (!currentProvider) return "Select a provider";
                const Icon = currentProvider.icon;
                return (
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{currentProvider.name}</span>
                  </div>
                );
              })()}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {providerButtons.map((provider) => {
              const Icon = provider.icon;
              return (
                <SelectItem key={provider.id} value={provider.id} data-testid={`option-provider-${provider.id}`}>
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    <span>{provider.name}</span>
                  </div>
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      </div>
      
      {/* Repository URL Input */}
      <div className="mb-4">
        <Label htmlFor="repo-url" className="block text-sm font-medium mb-2">
          Repository URL
        </Label>
        <div className="relative">
          <Input
            id="repo-url"
            type="url"
            placeholder="Repository URL (e.g., https://github.com/username/repo.git)"
            value={repoUrl}
            onChange={(e) => handleUrlChange(e.target.value)}
            data-testid="input-repo-url"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="absolute right-2 top-1/2 -translate-y-1/2 h-auto p-1"
            onClick={pasteFromClipboard}
            data-testid="button-paste-clipboard"
          >
            <Clipboard className="h-4 w-4" />
          </Button>
        </div>
      </div>
      
      {/* Clone Options */}
      <div className="mb-4">
        <Label className="block text-sm font-medium mb-2">Clone Options</Label>
        <div className="space-y-2">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="mirror"
              checked={cloneOptions.mirror}
              onCheckedChange={(checked) => 
                setCloneOptions(prev => ({ ...prev, mirror: !!checked }))
              }
              data-testid="checkbox-mirror"
            />
            <Label htmlFor="mirror" className="text-sm">
              Clone with history (--mirror)
            </Label>
          </div>
          <TooltipProvider>
            <div className="flex items-center space-x-2">
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="personal"
                      checked={cloneOptions.personalAccount && isAuthenticated}
                      onCheckedChange={(checked) => {
                        if (isAuthenticated) {
                          setCloneOptions(prev => ({ ...prev, personalAccount: !!checked }))
                        }
                      }}
                      disabled={!isAuthenticated}
                      data-testid="checkbox-personal-account"
                    />
                    <Label htmlFor="personal" className={`text-sm flex items-center gap-2 ${!isAuthenticated ? 'text-muted-foreground' : ''}`}>
                      Clone in Personal Account
                      {!isAuthenticated && <Lock className="h-3 w-3" />}
                    </Label>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {isAuthenticated 
                    ? `Create repository in ${user?.username}'s ${user?.provider} account`
                    : "Sign in first to create repository in your personal account"
                  }
                </TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>
        </div>
      </div>
      
      {/* Enhanced Clone Button with Loading Animation */}
      <Button
        className="w-full hover-lift transition-smooth group relative overflow-hidden"
        onClick={handleClone}
        disabled={isLoading || !repoUrl.trim()}
        data-testid="button-clone-repository"
      >
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              className="flex items-center gap-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="h-4 w-4 border-2 border-current border-t-transparent rounded-full"
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              />
              <span className="loading-dots">Cloning repository</span>
            </motion.div>
          ) : (
            <motion.div
              key="idle"
              className="flex items-center gap-2"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                whileHover={{ scale: 1.1, y: -1 }}
                transition={{ type: "spring", stiffness: 400, damping: 10 }}
              >
                <Download className="h-4 w-4" />
              </motion.div>
              Clone Repository
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Button shine effect */}
        {!isLoading && (
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full"
            animate={{ translateX: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
          />
        )}
      </Button>
    </div>
  );
}
