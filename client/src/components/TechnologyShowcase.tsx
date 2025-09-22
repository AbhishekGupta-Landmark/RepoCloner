import { useState, useEffect, useRef, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { TechnologyDetection, TechnologyCategory } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Monitor, 
  Server, 
  Database, 
  Cloud, 
  TestTube, 
  Wrench, 
  Shield, 
  Activity, 
  Package,
  FileText,
  Code,
  Zap,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCircle,
  File,
  Settings,
  Terminal,
  GitBranch,
  Percent,
  ArrowRight,
  FolderOpen
} from "lucide-react";
import {
  SiReact, SiVuedotjs, SiAngular, SiSvelte, SiNextdotjs, SiNuxtdotjs,
  SiTailwindcss, SiBootstrap, SiExpress, SiFastify, SiNestjs,
  SiDjango, SiFlask, SiFastapi, SiSpring, SiPostgresql, SiMysql,
  SiMongodb, SiRedis, SiPrisma, SiDocker, SiKubernetes, SiAmazons3,
  SiJest, SiCypress, SiGithubactions,
  SiGitlab, SiTypescript, SiJavascript, SiPython, SiSharp,
  SiGo, SiRust, SiNodedotjs, SiVite, SiWebpack, SiYarn, SiNpm,
  SiAmazon, SiGooglecloud
} from "react-icons/si";

interface TechnologyShowcaseProps {
  technologies: TechnologyDetection[];
  repositoryName?: string;
}

// Technology icons mapping
const getTechnologyIcon = (iconName: string, size: number = 16) => {
  const iconStyle = { fontSize: size };
  
  switch (iconName) {
    case 'react': return <SiReact style={iconStyle} className="text-[#61DAFB]" />;
    case 'vue': return <SiVuedotjs style={iconStyle} className="text-[#4FC08D]" />;
    case 'angular': return <SiAngular style={iconStyle} className="text-[#DD0031]" />;
    case 'svelte': return <SiSvelte style={iconStyle} className="text-[#FF3E00]" />;
    case 'nextjs': return <SiNextdotjs style={iconStyle} className="text-black dark:text-white" />;
    case 'nuxtjs': return <SiNuxtdotjs style={iconStyle} className="text-[#00DC82]" />;
    case 'tailwindcss': return <SiTailwindcss style={iconStyle} className="text-[#06B6D4]" />;
    case 'bootstrap': return <SiBootstrap style={iconStyle} className="text-[#7952B3]" />;
    case 'express': return <SiExpress style={iconStyle} className="text-black dark:text-white" />;
    case 'fastify': return <SiFastify style={iconStyle} className="text-black dark:text-white" />;
    case 'nestjs': return <SiNestjs style={iconStyle} className="text-[#E0234E]" />;
    case 'django': return <SiDjango style={iconStyle} className="text-[#092E20]" />;
    case 'flask': return <SiFlask style={iconStyle} className="text-black dark:text-white" />;
    case 'fastapi': return <SiFastapi style={iconStyle} className="text-[#009688]" />;
    case 'spring': return <SiSpring style={iconStyle} className="text-[#6DB33F]" />;
    case 'postgresql': return <SiPostgresql style={iconStyle} className="text-[#336791]" />;
    case 'mysql': return <SiMysql style={iconStyle} className="text-[#4479A1]" />;
    case 'mongodb': return <SiMongodb style={iconStyle} className="text-[#47A248]" />;
    case 'redis': return <SiRedis style={iconStyle} className="text-[#DC382D]" />;
    case 'prisma': return <SiPrisma style={iconStyle} className="text-[#2D3748]" />;
    case 'docker': return <SiDocker style={iconStyle} className="text-[#2496ED]" />;
    case 'kubernetes': return <SiKubernetes style={iconStyle} className="text-[#326CE5]" />;
    case 'aws': return <SiAmazon style={iconStyle} className="text-[#FF9900]" />;
    case 'azure': return <div className="w-4 h-4 bg-[#0078D4] rounded text-white flex items-center justify-center text-[10px] font-bold">AZ</div>;
    case 'jest': return <SiJest style={iconStyle} className="text-[#C21325]" />;
    case 'cypress': return <SiCypress style={iconStyle} className="text-[#17202C]" />;
    case 'playwright': return <div className="w-4 h-4 bg-[#2EAD33] rounded text-white flex items-center justify-center text-[10px] font-bold">PW</div>;
    case 'github-actions': return <SiGithubactions style={iconStyle} className="text-[#2088FF]" />;
    case 'gitlab': return <SiGitlab style={iconStyle} className="text-[#FC6D26]" />;
    case 'typescript': return <SiTypescript style={iconStyle} className="text-[#3178C6]" />;
    case 'javascript': return <SiJavascript style={iconStyle} className="text-[#F7DF1E]" />;
    case 'python': return <SiPython style={iconStyle} className="text-[#3776AB]" />;
    case 'csharp': return <SiSharp style={iconStyle} className="text-[#239120]" />;
    case 'java': return <div className="w-4 h-4 bg-[#ED8B00] rounded text-white flex items-center justify-center text-[10px] font-bold">J</div>;
    case 'go': return <SiGo style={iconStyle} className="text-[#00ADD8]" />;
    case 'rust': return <SiRust style={iconStyle} className="text-[#000000]" />;
    case 'nodejs': return <SiNodedotjs style={iconStyle} className="text-[#339933]" />;
    case 'vite': return <SiVite style={iconStyle} className="text-[#646CFF]" />;
    case 'webpack': return <SiWebpack style={iconStyle} className="text-[#8DD6F9]" />;
    case 'yarn': return <SiYarn style={iconStyle} className="text-[#2C8EBB]" />;
    case 'npm': return <SiNpm style={iconStyle} className="text-[#CB3837]" />;
    case 'dotnet': return <div className="w-4 h-4 bg-[#512BD4] rounded text-white flex items-center justify-center text-[9px] font-bold">.NET</div>;
    default: return <Code style={iconStyle} className="text-muted-foreground" />;
  }
};

const getCategoryInfo = (category: TechnologyCategory) => {
  switch (category) {
    case 'frontend':
      return {
        name: 'Frontend',
        icon: <Monitor className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-blue-500 to-cyan-500',
        textColor: 'text-white',
        description: 'User interface and client-side technologies'
      };
    case 'backend':
      return {
        name: 'Backend',
        icon: <Server className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-green-500 to-emerald-500',
        textColor: 'text-white',
        description: 'Server-side frameworks and APIs'
      };
    case 'database':
      return {
        name: 'Database',
        icon: <Database className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-purple-500 to-violet-500',
        textColor: 'text-white',
        description: 'Data persistence and storage'
      };
    case 'cloud':
      return {
        name: 'Cloud',
        icon: <Cloud className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-orange-500 to-red-500',
        textColor: 'text-white',
        description: 'Cloud platforms and infrastructure'
      };
    case 'testing':
      return {
        name: 'Testing',
        icon: <TestTube className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-pink-500 to-rose-500',
        textColor: 'text-white',
        description: 'Unit, integration, and E2E testing'
      };
    case 'devops':
      return {
        name: 'DevOps',
        icon: <Wrench className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-indigo-500 to-blue-500',
        textColor: 'text-white',
        description: 'Build tools and deployment'
      };
    case 'security':
      return {
        name: 'Security',
        icon: <Shield className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-red-500 to-pink-500',
        textColor: 'text-white',
        description: 'Authentication and security'
      };
    case 'monitoring':
      return {
        name: 'Monitoring',
        icon: <Activity className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-yellow-500 to-orange-500',
        textColor: 'text-white',
        description: 'Observability and logging'
      };
    case 'utilities':
      return {
        name: 'Utilities',
        icon: <Package className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-gray-500 to-slate-500',
        textColor: 'text-white',
        description: 'Package managers and tools'
      };
    case 'documentation':
      return {
        name: 'Documentation',
        icon: <FileText className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-teal-500 to-green-500',
        textColor: 'text-white',
        description: 'Documentation and API tools'
      };
    default:
      return {
        name: 'Other',
        icon: <Code className="w-4 h-4" />,
        color: 'bg-gradient-to-br from-gray-500 to-slate-500',
        textColor: 'text-white',
        description: 'Miscellaneous technologies'
      };
  }
};

// Fixed 4-4-2 layout: Row 1 (4 categories), Row 2 (4 categories), Row 3 (2 categories)
const GRID_LAYOUT: TechnologyCategory[][] = [
  ['frontend', 'backend', 'database', 'cloud'],           // Row 1: 4 categories
  ['testing', 'devops', 'security', 'monitoring'],        // Row 2: 4 categories  
  ['utilities', 'documentation']                          // Row 3: 2 categories
];

// Category-specific empty messages
const getCategoryEmptyMessage = (category: TechnologyCategory): string => {
  switch (category) {
    case 'frontend':
      return 'No Frontend frameworks found';
    case 'backend':
      return 'No Backend frameworks found';
    case 'database':
      return 'No Database technologies found';
    case 'cloud':
      return 'No Cloud platforms found';
    case 'testing':
      return 'No Testing frameworks found';
    case 'devops':
      return 'No DevOps tools found';
    case 'security':
      return 'No Security tools found';
    case 'monitoring':
      return 'No Monitoring tools found';
    case 'utilities':
      return 'No Package managers found';
    case 'documentation':
      return 'No Documentation or Readme files found';
    default:
      return 'No technologies detected';
  }
};

// Copy to clipboard component
function CopyButton({ text, testId }: { text: string; testId: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      // Copy failed silently
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleCopy}
      className="h-6 px-1.5 text-xs"
      data-testid={testId}
    >
      {copied ? (
        <CheckCircle className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3" />
      )}
    </Button>
  );
}

// Evidence section components
function EvidenceSection({ 
  title, 
  icon, 
  items, 
  showPaths = true, 
  emptyMessage = "No data available",
  testIdPrefix
}: { 
  title: string; 
  icon: React.ReactNode; 
  items: string[] | undefined; 
  showPaths?: boolean; 
  emptyMessage?: string;
  testIdPrefix: string;
}) {
  const [showAll, setShowAll] = useState(false);
  const hasItems = items && items.length > 0;
  const displayItems = showAll ? items : items?.slice(0, 10);
  const hasMore = items && items.length > 10;

  // Return null instead of showing "No evidence" messages
  if (!hasItems) {
    return null;
  }

  return (
    <div className="space-y-2" data-testid={`${testIdPrefix}-section`}>
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm font-medium text-foreground">{title}</span>
        <Badge variant="outline" className="text-xs h-5" data-testid={`${testIdPrefix}-count`}>
          {items.length}
        </Badge>
      </div>
      <div className="ml-6 space-y-1">
        {displayItems?.map((item, index) => (
          <div 
            key={index} 
            className="flex items-center justify-between bg-muted/30 rounded px-2 py-1 group"
            data-testid={`${testIdPrefix}-item-${index}`}
          >
            <span className="text-xs font-mono text-foreground truncate flex-1">
              {item}
            </span>
            {showPaths && (
              <CopyButton 
                text={item} 
                testId={`${testIdPrefix}-copy-${index}`}
              />
            )}
          </div>
        ))}
        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowAll(!showAll)}
            className="h-6 text-xs text-muted-foreground hover:text-foreground"
            data-testid={`${testIdPrefix}-show-more`}
          >
            {showAll ? 'Show less' : `Show ${items.length - 10} more`}
            {showAll ? <ChevronUp className="ml-1 h-3 w-3" /> : <ChevronDown className="ml-1 h-3 w-3" />}
          </Button>
        )}
      </div>
    </div>
  );
}

// Technology detail component
function TechnologyDetail({ tech, testId }: { tech: TechnologyDetection; testId: string }) {
  return (
    <div className="space-y-4 pt-3 border-t border-border/50" data-testid={`${testId}-details`}>
      {/* Version Information */}
      {tech.manifest?.versionSpec && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <GitBranch className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Version</span>
          </div>
          <div className="ml-6 bg-muted/30 rounded px-2 py-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono text-foreground" data-testid={`${testId}-version`}>
                {tech.manifest.versionSpec}
              </span>
              <CopyButton 
                text={tech.manifest.versionSpec} 
                testId={`${testId}-version-copy`}
              />
            </div>
            {tech.manifest.file && (
              <p className="text-[10px] text-muted-foreground mt-1">
                From: {tech.manifest.file}
              </p>
            )}
          </div>
        </div>
      )}

      {/* Evidence */}
      <EvidenceSection
        title="Evidence"
        icon={<File className="h-4 w-4 text-blue-500" />}
        items={[...(tech.evidenceFiles || []), ...(tech.configFiles || []), ...(tech.ciFiles || [])]}
        testIdPrefix={`${testId}-evidence`}
        emptyMessage="No evidence files found"
      />

      {/* Package Manager */}
      {tech.lockfile && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-orange-500" />
            <span className="text-sm font-medium text-foreground">Package manager</span>
          </div>
          <div className="ml-6">
            <Badge variant="outline" className="text-xs" data-testid={`${testId}-lockfile`}>
              {tech.lockfile}
            </Badge>
          </div>
        </div>
      )}

      {/* Scripts */}
      {tech.scripts && tech.scripts.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Terminal className="h-4 w-4 text-purple-500" />
            <span className="text-sm font-medium text-foreground">Scripts</span>
            <Badge variant="outline" className="text-xs">
              {tech.scripts.reduce((acc, script) => acc + script.names.length, 0)}
            </Badge>
          </div>
          <div className="ml-6 space-y-2">
            {tech.scripts.map((script, index) => (
              <div key={index} className="space-y-1" data-testid={`${testId}-script-${index}`}>
                <p className="text-xs text-muted-foreground">{script.file}</p>
                <div className="flex flex-wrap gap-1">
                  {script.names.map((name, nameIndex) => (
                    <Badge 
                      key={nameIndex} 
                      variant="secondary" 
                      className="text-[10px] h-5"
                      data-testid={`${testId}-script-name-${index}-${nameIndex}`}
                    >
                      {name}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
}

// Simple technology card for simple view
function SimpleTechnologyCard({ tech, testId }: { tech: TechnologyDetection; testId: string }) {
  return (
    <div className="bg-muted/30 rounded-lg border border-border/30 p-3" data-testid={`${testId}-simple`}>
      <div className="flex items-center gap-3">
        <div className="flex-shrink-0">
          {getTechnologyIcon(tech.icon || 'default', 18)}
        </div>
        <div className="text-left min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">
            {tech.name}
          </p>
          {tech.version && (
            <p className="text-xs text-muted-foreground truncate">
              v{tech.version}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Detailed technology card component
function TechnologyCard({ tech, testId }: { tech: TechnologyDetection; testId: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Collapsible 
      open={isExpanded} 
      onOpenChange={setIsExpanded}
      data-testid={`${testId}-collapsible`}
    >
      <div className="bg-muted/30 rounded-lg border border-border/30 overflow-hidden">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full p-3 justify-between hover:bg-muted/50 h-auto"
            data-testid={`${testId}-trigger`}
          >
            <div className="flex items-center gap-3">
              <div className="flex-shrink-0">
                {getTechnologyIcon(tech.icon || 'default', 18)}
              </div>
              <div className="text-left">
                <p className="text-sm font-medium text-foreground">
                  {tech.name}
                </p>
                {tech.version && (
                  <p className="text-xs text-muted-foreground">
                    v{tech.version}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {isExpanded ? (
                <ChevronUp className="h-4 w-4 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
          </Button>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <div className="px-3 pb-3">
            <TechnologyDetail tech={tech} testId={testId} />
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Debounce utility
const debounce = (func: Function, wait: number) => {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export default function TechnologyShowcase({ technologies, repositoryName }: TechnologyShowcaseProps) {
  const [viewMode, setViewMode] = useState<'simple' | 'details'>('simple');
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [rowHeights, setRowHeights] = useState<number[]>([]);
  
  // Measure heights of cards and calculate max height per row
  const measureHeights = useCallback(() => {
    const newRowHeights: number[] = [];
    
    GRID_LAYOUT.forEach((row, rowIndex) => {
      const heights = row.map(category => cardRefs.current[category]?.offsetHeight || 0);
      const maxHeight = Math.max(...heights);
      newRowHeights[rowIndex] = maxHeight;
    });
    
    setRowHeights(newRowHeights);
  }, [technologies, viewMode]);
  
  // Debounced version of measure function
  const debouncedMeasure = useCallback(debounce(measureHeights, 100), [measureHeights]);
  
  // Setup ResizeObserver and measurement
  useEffect(() => {
    // Initial measurement after content loads
    const timer = setTimeout(measureHeights, 100);
    
    // Create ResizeObserver for each card
    const observers: ResizeObserver[] = [];
    Object.keys(cardRefs.current).forEach(category => {
      const element = cardRefs.current[category];
      if (element) {
        const observer = new ResizeObserver(debouncedMeasure);
        observer.observe(element);
        observers.push(observer);
      }
    });
    
    // Window resize listener
    const handleResize = () => debouncedMeasure();
    window.addEventListener('resize', handleResize);
    
    return () => {
      clearTimeout(timer);
      observers.forEach(observer => observer.disconnect());
      window.removeEventListener('resize', handleResize);
    };
  }, [measureHeights, debouncedMeasure]);
  
  // Show empty state if no repository or no technologies
  if (!repositoryName || !technologies || technologies.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="w-full h-full flex items-center justify-center p-6"
        data-testid="technology-showcase-empty"
      >
        <div className="text-center space-y-4 max-w-md">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Zap className="w-16 h-16 text-muted-foreground/50 mx-auto" />
          </motion.div>
          <h3 className="text-xl font-semibold text-muted-foreground">No Technology Stack Data</h3>
          <p className="text-sm text-muted-foreground/80">
            Clone a repository to analyze its technology stack and see detailed breakdowns by category.
          </p>
        </div>
      </motion.div>
    );
  }

  // Group technologies by category
  const groupedTechnologies = technologies.reduce((acc, tech) => {
    if (!acc[tech.category]) {
      acc[tech.category] = [];
    }
    acc[tech.category].push(tech);
    return acc;
  }, {} as Record<TechnologyCategory, TechnologyDetection[]>);

  // Sort technologies within each category alphabetically
  Object.values(groupedTechnologies).forEach(categoryTechs => {
    categoryTechs.sort((a, b) => a.name.localeCompare(b.name));
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6 }}
      className="w-full h-full p-6 overflow-auto bg-gradient-to-br from-background via-background to-muted/20"
      data-testid="technology-showcase"
    >
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center space-y-3"
          data-testid="technology-showcase-header"
        >
          <div className="flex items-center justify-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <Zap className="w-6 h-6 text-primary" />
            </motion.div>
            <h2 className="text-2xl font-bold text-foreground">
              Technology Stack Analysis
            </h2>
          </div>
          
          {repositoryName && (
            <p className="text-sm text-muted-foreground">
              Repository: <span className="font-medium text-foreground">{repositoryName}</span>
            </p>
          )}
          
          {/* View Toggle */}
          <div className="flex items-center justify-center gap-2">
            <span className="text-xs text-muted-foreground">View:</span>
            <div className="flex border border-border rounded-md overflow-hidden">
              <Button
                variant={viewMode === 'simple' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('simple')}
                className="h-7 px-3 text-xs rounded-none border-0"
                data-testid="view-toggle-simple"
              >
                Simple
              </Button>
              <Button
                variant={viewMode === 'details' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('details')}
                className="h-7 px-3 text-xs rounded-none border-0"
                data-testid="view-toggle-details"
              >
                Details
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Technology Grid - 4-4-2 Layout */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.7, delay: 0.3 }}
          className="space-y-6"
          data-testid="technology-grid"
        >
          {GRID_LAYOUT.map((row, rowIndex) => (
            <motion.div
              key={rowIndex}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.2 + rowIndex * 0.1 }}
              className={`grid gap-6 ${
                row.length === 4 
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4' 
                  : 'grid-cols-1 sm:grid-cols-2 max-w-4xl mx-auto'
              }`}
              data-testid={`technology-row-${rowIndex}`}
            >
              {row.map((category, categoryIndex) => {
                const categoryInfo = getCategoryInfo(category);
                const categoryTechs = groupedTechnologies[category] || [];
                
                return (
                  <motion.div
                    key={category}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ 
                      duration: 0.3, 
                      delay: categoryIndex * 0.05,
                      type: "spring",
                      stiffness: 200,
                      damping: 20
                    }}
                    className="group"
                    data-testid={`category-${category}`}
                  >
                    <Card 
                      ref={(el) => (cardRefs.current[category] = el)}
                      className="border border-border/50 bg-card shadow-sm hover:shadow-md transition-all duration-300 flex flex-col"
                      style={{ minHeight: rowHeights[rowIndex] || undefined }}
                      data-testid={`card-${category}`}
                    >
                      {/* Category Header */}
                      <CardHeader className="pb-3">
                        <CardTitle className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${categoryInfo.color} ${categoryInfo.textColor} shadow-sm`}>
                            {categoryInfo.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="text-lg font-semibold truncate">{categoryInfo.name}</h3>
                            <p className="text-xs text-muted-foreground truncate">{categoryInfo.description}</p>
                          </div>
                          <Badge variant="secondary" className="text-sm px-2 py-1">
                            {categoryTechs.length}
                          </Badge>
                        </CardTitle>
                      </CardHeader>
                      
                      {/* Technology List */}
                      <CardContent className="pt-0 flex-1 flex flex-col">
                        {categoryTechs.length === 0 ? (
                          <div className="flex items-center justify-center flex-1 text-center">
                            <div className="text-muted-foreground">
                              <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-40" />
                              <p className="text-sm">{getCategoryEmptyMessage(category)}</p>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <AnimatePresence>
                              {categoryTechs.map((tech, techIndex) => (
                                <motion.div
                                  key={`${tech.name}-${techIndex}`}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: techIndex * 0.05, duration: 0.2 }}
                                >
                                  {viewMode === 'simple' ? (
                                    <SimpleTechnologyCard 
                                      tech={tech} 
                                      testId={`${category}-tech-${techIndex}`}
                                    />
                                  ) : (
                                    <TechnologyCard 
                                      tech={tech} 
                                      testId={`${category}-tech-${techIndex}`}
                                    />
                                  )}
                                </motion.div>
                              ))}
                            </AnimatePresence>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.div>
  );
}