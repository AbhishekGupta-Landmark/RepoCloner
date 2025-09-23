import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Settings, 
  Bot, 
  GitBranch, 
  Zap,
  Eye,
  EyeOff,
  Save,
  CheckCircle,
  AlertCircle,
  Github,
  Server,
  Globe,
  GitlabIcon as Gitlab,
  Users
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { apiRequest } from "@/lib/queryClient";

// Comprehensive Git provider definitions
const GIT_PROVIDERS = {
  github: {
    name: "GitHub",
    icon: Github,
    clientIdLabel: "Client ID",
    secretLabel: "Client Secret",
    scopes: "user:email public_repo",
    setupUrl: "https://github.com/settings/applications/new"
  },
  gitlab: {
    name: "GitLab",
    icon: Gitlab,
    clientIdLabel: "Application ID", 
    secretLabel: "Secret",
    scopes: "api",
    setupUrl: "https://gitlab.com/-/profile/applications"
  },
  azure: {
    name: "Azure DevOps",
    icon: Users,
    clientIdLabel: "Application ID",
    secretLabel: "Client Secret",
    scopes: "vso.code,vso.identity", 
    setupUrl: "https://aex.dev.azure.com/app/register"
  },
  bitbucket: {
    name: "Bitbucket",
    icon: GitBranch,
    clientIdLabel: "Consumer Key",
    secretLabel: "Consumer Secret",
    scopes: "repositories:read,account:read",
    setupUrl: "https://bitbucket.org/workspace/settings/oauth-consumers"
  },
  gitea: {
    name: "Gitea",
    icon: Server,
    clientIdLabel: "Client ID",
    secretLabel: "Client Secret",
    scopes: "read:user,read:repository",
    setupUrl: "https://gitea.io/en-us/configure-oauth/"
  },
  codeberg: {
    name: "Codeberg",
    icon: Globe,
    clientIdLabel: "Client ID",
    secretLabel: "Client Secret",
    scopes: "read:user,read:repository",
    setupUrl: "https://codeberg.org/user/settings/applications"
  },
  sourcehut: {
    name: "SourceHut",
    icon: Server,
    clientIdLabel: "Client ID",
    secretLabel: "Client Secret",
    scopes: "profile,repositories",
    setupUrl: "https://meta.sr.ht/oauth/register"
  }
} as const;

interface SettingsPanelProps {
  onApplied?: () => void;
}

export default function SettingsPanel({ onApplied }: SettingsPanelProps) {
  const [activeTab, setActiveTab] = useState("ai");
  const [settings, setSettings] = useState({
    openai: {
      apiKey: "",
      model: "gpt-4"
    },
    gitProvider: {
      defaultProvider: "github" as keyof typeof GIT_PROVIDERS,
      autoDetect: true,
      rememberTokens: false
    },
    analysis: {
      autoAnalyze: true,
      includeSecurity: true,
      generateReports: false
    }
  });
  
  const [oauthConfig, setOauthConfig] = useState({
    github: { clientId: "", clientSecret: "", scopes: "" },
    gitlab: { clientId: "", clientSecret: "", scopes: "" },
    azure: { clientId: "", clientSecret: "", scopes: "" },
    bitbucket: { clientId: "", clientSecret: "", scopes: "" },
    gitea: { clientId: "", clientSecret: "", scopes: "" },
    codeberg: { clientId: "", clientSecret: "", scopes: "" },
    sourcehut: { clientId: "", clientSecret: "", scopes: "" }
  });
  
  const [oauthStatus, setOauthStatus] = useState({
    github: false,
    gitlab: false,
    azure: false,
    bitbucket: false,
    gitea: false,
    codeberg: false,
    sourcehut: false
  });

  const [selectedOauthProvider, setSelectedOauthProvider] = useState<keyof typeof GIT_PROVIDERS>("github");
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasUnsavedOauthChanges, setHasUnsavedOauthChanges] = useState(false);

  const { toast } = useToast();

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  const loadConfiguration = async () => {
    try {
      setIsLoading(true);
      const response = await apiRequest('GET', '/api/admin/oauth-config');
      const data = await response.json();
      
      if (data.config) {
        setOauthConfig(data.config);
      }
      if (data.status) {
        setOauthStatus(data.status);
      }
      setHasUnsavedOauthChanges(false);
    } catch (error) {
      toast({
        title: "Load Error",
        description: "Failed to load configuration. Using defaults.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      setIsLoading(true);
      await apiRequest('POST', '/api/admin/oauth-config', oauthConfig);
      await loadConfiguration();

      // Notify parent component that settings were successfully applied
      onApplied?.();

      toast({
        title: "Settings Saved",
        description: "Configuration has been updated successfully."
      });
    } catch (error) {
      toast({
        title: "Save Error", 
        description: "Failed to save settings. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = (section: string, key: string, value: any) => {
    setSettings(prev => ({
      ...prev,
      [section]: {
        ...prev[section as keyof typeof prev],
        [key]: value
      }
    }));
    // Note: OpenAI and Analysis settings are stored locally in browser
  };

  const updateOauthSetting = (provider: string, key: string, value: string) => {
    setOauthConfig(prev => ({
      ...prev,
      [provider]: {
        ...prev[provider as keyof typeof prev],
        [key]: value
      }
    }));
    setHasUnsavedOauthChanges(true);
  };

  const toggleSecretVisibility = (field: string) => {
    setShowSecrets(prev => ({
      ...prev,
      [field]: !prev[field]
    }));
  };

  const isOauthConfigured = (provider: keyof typeof GIT_PROVIDERS) => {
    const config = oauthConfig[provider];
    return !!(config?.clientId && config?.clientSecret);
  };

  const getOverallStatus = () => {
    const hasOpenAI = !!settings.openai.apiKey;
    const hasOAuth = Object.keys(GIT_PROVIDERS).some(provider => 
      isOauthConfigured(provider as keyof typeof GIT_PROVIDERS)
    );
    
    return { hasOpenAI, hasOAuth };
  };

  const status = getOverallStatus();

  return (
    <div className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 max-w-4xl mx-auto">
          {/* Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-2"
          >
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-semibold flex items-center gap-3">
                  <Settings className="w-6 h-6 text-primary" />
                  Settings
                </h2>
                <p className="text-muted-foreground mt-1">
                  Configure AI analysis and Git provider authentication
                </p>
              </div>
            </div>
          </motion.div>

          <Separator />

          {/* Tabbed Interface */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="ai" className="flex items-center gap-2" data-testid="tab-ai-configuration">
                <Bot className="w-4 h-4" />
                AI Configuration
              </TabsTrigger>
              <TabsTrigger value="git" className="flex items-center gap-2" data-testid="tab-git-authentication">
                <GitBranch className="w-4 h-4" />
                Git Authentication
              </TabsTrigger>
              <TabsTrigger value="analysis" className="flex items-center gap-2" data-testid="tab-analysis-settings">
                <Zap className="w-4 h-4" />
                Analysis Settings
              </TabsTrigger>
            </TabsList>

            {/* AI Configuration Tab */}
            <TabsContent value="ai" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <Bot className="w-5 h-5" />
                    AI Configuration
                    <span className="text-xs bg-muted px-2 py-1 rounded-md font-normal">Local Settings</span>
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Configure OpenAI integration for intelligent code analysis and insights. Settings are stored locally in your browser.
                  </p>
                </div>

                <div className="space-y-4 border border-border rounded-lg p-4 bg-card">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="api-key" className="text-sm font-medium">
                        OpenAI API Key
                      </Label>
                      <div className="flex items-center gap-1 text-xs">
                        {status.hasOpenAI ? (
                          <>
                            <CheckCircle className="w-3 h-3 text-green-500" />
                            <span className="text-green-500">Configured</span>
                          </>
                    ) : (
                      <>
                        <AlertCircle className="w-3 h-3 text-amber-500" />
                        <span className="text-amber-500">Required</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <Input
                    id="api-key"
                    type={showSecrets.apiKey ? "text" : "password"}
                    placeholder="sk-..."
                    value={settings.openai.apiKey}
                    onChange={(e) => updateSetting('openai', 'apiKey', e.target.value)}
                    data-testid="input-openai-api-key"
                    className="pr-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3"
                    onClick={() => toggleSecretVisibility('apiKey')}
                  >
                    {showSecrets.apiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Enables AI-powered code analysis, technology detection, and insights generation
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="openai-model" className="text-sm font-medium">
                  AI Model
                </Label>
                <Select 
                  value={settings.openai.model} 
                  onValueChange={(value) => updateSetting('openai', 'model', value)}
                >
                  <SelectTrigger data-testid="select-openai-model">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="gpt-4">GPT-4 (Recommended)</SelectItem>
                    <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo (Faster)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </motion.div>
        </TabsContent>

            {/* Git Authentication Tab */}
            <TabsContent value="git" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-4"
              >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <GitBranch className="w-5 h-5" />
                Git Authentication
                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded-md font-normal">Server Settings</span>
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure OAuth applications for secure repository access and user sign-in. Changes are saved to the server.
              </p>
            </div>

            <div className="space-y-4 border border-border rounded-lg p-4 bg-card">
              {/* Provider Selection */}
              <div className="space-y-2">
                <Label htmlFor="oauth-provider" className="text-sm font-medium">
                  Configure OAuth Provider
                </Label>
                <Select 
                  value={selectedOauthProvider} 
                  onValueChange={(value: keyof typeof GIT_PROVIDERS) => setSelectedOauthProvider(value)}
                >
                  <SelectTrigger data-testid="select-oauth-provider">
                    <div className="flex items-center gap-2">
                      {(() => {
                        const Provider = GIT_PROVIDERS[selectedOauthProvider];
                        const Icon = Provider.icon;
                        return (
                          <>
                            <Icon className="h-4 w-4" />
                            <SelectValue />
                          </>
                        );
                      })()}
                    </div>
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(GIT_PROVIDERS).map(([key, provider]) => {
                      const Icon = provider.icon;
                      return (
                        <SelectItem key={key} value={key}>
                          <div className="flex items-center gap-2">
                            <Icon className="h-4 w-4" />
                            <span>{provider.name}</span>
                            {isOauthConfigured(key as keyof typeof GIT_PROVIDERS) && (
                              <CheckCircle className="w-3 h-3 text-green-500 ml-auto" />
                            )}
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              {/* OAuth Configuration for Selected Provider */}
              <div className="space-y-4 bg-muted/20 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {(() => {
                      const Provider = GIT_PROVIDERS[selectedOauthProvider];
                      const Icon = Provider.icon;
                      return (
                        <>
                          <Icon className="h-4 w-4" />
                          <span className="font-medium">{Provider.name} OAuth App</span>
                        </>
                      );
                    })()}
                  </div>
                  <div className="flex items-center gap-2">
                    {isOauthConfigured(selectedOauthProvider) ? (
                      <>
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-500">Configured</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="w-4 h-4 text-amber-500" />
                        <span className="text-sm text-amber-500">Setup Required</span>
                      </>
                    )}
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  Enables user authentication and access to private repositories.{" "}
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 h-auto text-xs text-primary"
                    onClick={() => window.open(GIT_PROVIDERS[selectedOauthProvider].setupUrl, '_blank')}
                  >
                    Setup guide →
                  </Button>
                </p>

                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        {GIT_PROVIDERS[selectedOauthProvider].clientIdLabel}
                      </Label>
                      <Input
                        placeholder={`Your ${GIT_PROVIDERS[selectedOauthProvider].name} client ID`}
                        value={oauthConfig[selectedOauthProvider].clientId}
                        onChange={(e) => updateOauthSetting(selectedOauthProvider, 'clientId', e.target.value)}
                        data-testid={`input-${selectedOauthProvider}-client-id`}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        {GIT_PROVIDERS[selectedOauthProvider].secretLabel}
                      </Label>
                      <div className="relative">
                        <Input
                          type={showSecrets[`${selectedOauthProvider}-secret`] ? "text" : "password"}
                          placeholder={`Your ${GIT_PROVIDERS[selectedOauthProvider].name} client secret`}
                          value={oauthConfig[selectedOauthProvider].clientSecret}
                          onChange={(e) => updateOauthSetting(selectedOauthProvider, 'clientSecret', e.target.value)}
                          data-testid={`input-${selectedOauthProvider}-client-secret`}
                          className="pr-10"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => toggleSecretVisibility(`${selectedOauthProvider}-secret`)}
                        >
                          {showSecrets[`${selectedOauthProvider}-secret`] ? 
                            <EyeOff className="w-4 h-4" /> : 
                            <Eye className="w-4 h-4" />
                          }
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* OAuth Scopes */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">
                      OAuth Scopes
                    </Label>
                    <Input
                      placeholder={GIT_PROVIDERS[selectedOauthProvider].scopes}
                      value={oauthConfig[selectedOauthProvider].scopes || GIT_PROVIDERS[selectedOauthProvider].scopes}
                      onChange={(e) => updateOauthSetting(selectedOauthProvider, 'scopes', e.target.value)}
                      data-testid={`input-${selectedOauthProvider}-scopes`}
                    />
                    <p className="text-xs text-muted-foreground">
                      Space-separated list of OAuth scopes. Default: {GIT_PROVIDERS[selectedOauthProvider].scopes}
                    </p>
                  </div>
                </div>

                {/* OAuth Save Button */}
                {hasUnsavedOauthChanges && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex justify-end pt-2"
                  >
                    <Button 
                      onClick={handleSaveSettings}
                      disabled={isLoading}
                      className="bg-primary hover:bg-primary/90 text-primary-foreground"
                      data-testid="button-save-oauth-settings"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      {isLoading ? "Saving OAuth..." : "Save OAuth Configuration"}
                    </Button>
                  </motion.div>
                )}
              </div>

              {/* Git Provider Settings */}
              <div className="space-y-3 pt-2">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="auto-detect"
                    checked={settings.gitProvider.autoDetect}
                    onCheckedChange={(checked) => updateSetting('gitProvider', 'autoDetect', !!checked)}
                    data-testid="checkbox-auto-detect"
                  />
                  <Label htmlFor="auto-detect" className="text-sm cursor-pointer">
                    Auto-detect provider from repository URL
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="remember-tokens"
                    checked={settings.gitProvider.rememberTokens}
                    onCheckedChange={(checked) => updateSetting('gitProvider', 'rememberTokens', !!checked)}
                    data-testid="checkbox-remember-tokens"
                  />
                  <Label htmlFor="remember-tokens" className="text-sm cursor-pointer">
                    Remember authentication tokens across sessions
                  </Label>
                </div>
              </div>
            </div>
              </motion.div>
            </TabsContent>

            {/* Analysis Settings Tab */}
            <TabsContent value="analysis" className="space-y-4">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="space-y-4"
              >
            <div className="space-y-2">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Zap className="w-5 h-5" />
                Analysis Preferences
                <span className="text-xs bg-muted px-2 py-1 rounded-md font-normal">Local Settings</span>
              </h3>
              <p className="text-sm text-muted-foreground">
                Configure how repositories are analyzed and what insights are generated. Settings are stored locally in your browser.
              </p>
            </div>

            <div className="space-y-4 border border-border rounded-lg p-4 bg-card">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="auto-analyze" className="text-sm font-medium cursor-pointer">
                      Auto-analyze repositories
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Automatically start analysis when a repository is cloned
                    </p>
                  </div>
                  <Checkbox
                    id="auto-analyze"
                    checked={settings.analysis.autoAnalyze}
                    onCheckedChange={(checked) => updateSetting('analysis', 'autoAnalyze', !!checked)}
                    data-testid="checkbox-auto-analyze"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="include-security" className="text-sm font-medium cursor-pointer">
                      Include security scanning
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Check for common security vulnerabilities and best practices
                    </p>
                  </div>
                  <Checkbox
                    id="include-security"
                    checked={settings.analysis.includeSecurity}
                    onCheckedChange={(checked) => updateSetting('analysis', 'includeSecurity', !!checked)}
                    data-testid="checkbox-include-security"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <Label htmlFor="generate-reports" className="text-sm font-medium cursor-pointer">
                      Generate detailed reports
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      Create comprehensive reports with recommendations and insights
                    </p>
                  </div>
                  <Checkbox
                    id="generate-reports"
                    checked={settings.analysis.generateReports}
                    onCheckedChange={(checked) => updateSetting('analysis', 'generateReports', !!checked)}
                    data-testid="checkbox-generate-reports"
                  />
                </div>
              </div>
            </div>
              </motion.div>
            </TabsContent>
          </Tabs>

        </div>
      </ScrollArea>
    </div>
  );
}