import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronRight, ChevronDown, Folder, File, FolderOpen, Plus, Minus, RotateCcw, FileText, Code2, Image, Settings, Package, Download, FolderDown, Archive } from "lucide-react";
import { FileNode, TechnologyDetection } from "@shared/schema";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAppContext } from "../context/AppContext";
import { motion, AnimatePresence } from "framer-motion";
import TechnologyDisplay from "./TechnologyDisplay";
import { useToast } from "@/hooks/use-toast";

interface FileTreeItemProps {
  node: FileNode;
  level: number;
  expandedItems: Set<string>;
  onToggle: (path: string) => void;
  repositoryId?: string;
}

interface RepositoryDownloadButtonProps {
  repositoryId: string;
  repositoryName: string;
}

function RepositoryDownloadButton({ repositoryId, repositoryName }: RepositoryDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    if (isDownloading) return;

    setIsDownloading(true);
    
    try {
      const endpoint = `/api/repositories/${repositoryId}/download/repository`;

      // Show loading toast
      toast({
        title: "Preparing repository download...",
        description: `Repository: ${repositoryName}`,
      });

      // Fetch to check if the download is available
      const response = await fetch(endpoint, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = endpoint;
      link.target = '_blank';
      link.download = `${repositoryName.replace(/[^a-zA-Z0-9-_]/g, '_')}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Success toast
      toast({
        title: "Repository download started",
        description: `Complete repository: ${repositoryName}`,
      });

    } catch (error) {
      toast({
        title: "Repository download failed",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDownload}
      disabled={isDownloading}
      title="Download Complete Repository as ZIP"
      data-testid="button-download-repository"
      className="hover-lift transition-fast hover:bg-purple-500/10 hover:text-purple-500 disabled:opacity-50"
    >
      {isDownloading ? (
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="h-3 w-3 border border-current border-t-transparent rounded-full"
        />
      ) : (
        <Archive className="h-3 w-3" />
      )}
    </Button>
  );
}

function FileTreeItem({ node, level, expandedItems, onToggle, repositoryId }: FileTreeItemProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const { toast } = useToast();
  const isExpanded = expandedItems.has(node.path);
  const hasChildren = node.children && node.children.length > 0;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!repositoryId || isDownloading) return;

    setIsDownloading(true);
    
    try {
      const endpoint = node.type === 'file' 
        ? `/api/repositories/${repositoryId}/download/file?filePath=${encodeURIComponent(node.path)}`
        : `/api/repositories/${repositoryId}/download/folder?folderPath=${encodeURIComponent(node.path)}`;

      // Show loading toast
      const loadingToast = toast({
        title: "Preparing download...",
        description: `${node.type === 'file' ? 'File' : 'Folder'}: ${node.name}`,
      });

      // Fetch to check if the download is available
      const response = await fetch(endpoint, { method: 'HEAD' });
      
      if (!response.ok) {
        throw new Error(`Download failed: ${response.status} ${response.statusText}`);
      }

      // Create a temporary anchor element to trigger download
      const link = document.createElement('a');
      link.href = endpoint;
      link.target = '_blank';
      link.download = node.name; // Suggest filename
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Success toast
      toast({
        title: "Download started",
        description: `${node.type === 'file' ? 'File' : 'Folder'}: ${node.name}`,
      });

    } catch (error) {
      toast({
        title: "Download failed",
        description: error instanceof Error ? error.message : 'An unknown error occurred',
        variant: "destructive",
      });
    } finally {
      setIsDownloading(false);
    }
  };

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "";
    const kb = bytes / 1024;
    if (kb < 1) return `${bytes} B`;
    if (kb < 1024) return `${kb.toFixed(1)} KB`;
    return `${(kb / 1024).toFixed(1)} MB`;
  };

  const getFileIcon = (name: string, type: string) => {
    if (type === 'directory') {
      return isExpanded ? 
        <FolderOpen className="h-4 w-4 text-yellow-500 drop-shadow-sm" /> : 
        <Folder className="h-4 w-4 text-yellow-500 drop-shadow-sm" />;
    }
    
    const ext = name.split('.').pop()?.toLowerCase();
    
    // More specific file type icons
    if (ext) {
      if (['js', 'ts', 'tsx', 'jsx'].includes(ext)) {
        return <Code2 className="h-4 w-4 text-blue-400" />;
      }
      if (['py', 'java', 'cs', 'cpp', 'c', 'go', 'rs'].includes(ext)) {
        return <FileText className="h-4 w-4 text-green-400" />;
      }
      if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp'].includes(ext)) {
        return <Image className="h-4 w-4 text-purple-400" />;
      }
      if (['json', 'yml', 'yaml', 'toml', 'ini', 'conf'].includes(ext)) {
        return <Settings className="h-4 w-4 text-orange-400" />;
      }
      if (['md', 'txt', 'rtf'].includes(ext)) {
        return <FileText className="h-4 w-4 text-gray-400" />;
      }
      if (['zip', 'tar', 'gz', 'rar', '7z'].includes(ext)) {
        return <Package className="h-4 w-4 text-red-400" />;
      }
    }
    
    return <File className="h-4 w-4 text-gray-400" />;
  };

  const getFileTypeClass = (name: string, type: string) => {
    if (type === 'directory') return 'text-yellow-300';
    
    const ext = name.split('.').pop()?.toLowerCase();
    if (ext) {
      if (['js', 'ts', 'tsx', 'jsx'].includes(ext)) return 'text-blue-300';
      if (['py', 'java', 'cs', 'cpp', 'c'].includes(ext)) return 'text-green-300';
      if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(ext)) return 'text-purple-300';
      if (['json', 'yml', 'yaml'].includes(ext)) return 'text-orange-300';
    }
    return 'text-gray-300';
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className="flex items-center gap-2 py-2 px-2 hover:bg-muted rounded-lg cursor-pointer group transition-smooth hover-lift border border-transparent hover:border-primary/10 relative"
        style={{ paddingLeft: `${level * 20 + 8}px` }}
        onClick={() => hasChildren && onToggle(node.path)}
        data-testid={`tree-item-${node.path}`}
        whileHover={{ scale: 1.01, x: 2 }}
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}
      >
        {/* Tree lines for visual hierarchy */}
        {level > 0 && (
          <div 
            className="absolute left-0 top-0 bottom-0 w-px bg-border/30"
            style={{ left: `${(level - 1) * 20 + 18}px` }}
          />
        )}
        
        {hasChildren ? (
          <motion.div
            animate={{ rotate: isExpanded ? 90 : 0 }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className="flex-shrink-0"
          >
            <ChevronRight className="h-3 w-3 text-muted-foreground group-hover:text-primary transition-smooth" />
          </motion.div>
        ) : (
          <div className="w-3 flex-shrink-0" />
        )}
        
        <motion.div
          whileHover={{ scale: 1.1, rotate: node.type === 'directory' ? 5 : 0 }}
          transition={{ type: "spring", stiffness: 400, damping: 10 }}
          className="flex-shrink-0"
        >
          {getFileIcon(node.name, node.type)}
        </motion.div>
        
        <span className={`text-sm font-medium group-hover:text-foreground transition-smooth ${getFileTypeClass(node.name, node.type)} truncate max-w-[140px] sm:max-w-[160px] md:max-w-[180px] lg:max-w-[200px]`}>
          {node.name}
        </span>
        
        <div className="flex-1" />
        
        <motion.div
          className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-smooth shrink-0 ml-1"
          initial={{ opacity: 0, x: 5 }}
          whileHover={{ opacity: 1, x: 0 }}
        >
          {node.type === 'file' && node.size && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md">
              {formatFileSize(node.size)}
            </span>
          )}
          
          {node.type === 'directory' && node.children && (
            <span className="text-xs text-muted-foreground px-2 py-1 bg-muted/50 rounded-md">
              {node.children.length} items
            </span>
          )}

          {repositoryId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleDownload}
              disabled={isDownloading}
              title={`Download ${node.type === 'file' ? 'file' : 'folder as ZIP'}`}
              data-testid={`button-download-${node.type}-${node.path}`}
              className="h-6 w-6 p-0 hover-lift transition-fast hover:bg-blue-500/10 hover:text-blue-500 disabled:opacity-50 flex-shrink-0"
            >
              {isDownloading ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="h-3 w-3 border border-current border-t-transparent rounded-full"
                />
              ) : node.type === 'file' ? (
                <Download className="h-3 w-3" />
              ) : (
                <FolderDown className="h-3 w-3" />
              )}
            </Button>
          )}
        </motion.div>
      </motion.div>
      
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <motion.div
              initial={{ y: -10 }}
              animate={{ y: 0 }}
              transition={{ duration: 0.2, delay: 0.1 }}
            >
              {node.children!.map((child, index) => (
                <motion.div
                  key={child.path}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                >
                  <FileTreeItem
                    node={child}
                    level={level + 1}
                    expandedItems={expandedItems}
                    onToggle={onToggle}
                    repositoryId={repositoryId}
                  />
                </motion.div>
              ))}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// Type guard to check if detectedTechnologies is a valid array
const isTechnologyDetectionArray = (value: unknown): value is TechnologyDetection[] => {
  if (!Array.isArray(value)) return false;
  return value.every(item => 
    typeof item === 'object' && 
    item !== null && 
    typeof item.name === 'string' && 
    typeof item.category === 'string' &&
    typeof item.confidence === 'number'
  );
};

export default function FileTreePanel() {
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const { currentRepository } = useAppContext();
  const queryClient = useQueryClient();

  // Fetch repository files when we have a current repository
  const { data: fileStructure, isLoading } = useQuery<{ fileStructure: FileNode[] }>({
    queryKey: ['/api/repositories', currentRepository?.id, 'files'],
    enabled: !!currentRepository?.id
  });

  // Use file structure from current repository if available, with safe fallback
  const files = Array.isArray(fileStructure?.fileStructure) ? fileStructure.fileStructure : 
    (Array.isArray(currentRepository?.fileStructure) ? currentRepository.fileStructure : []);

  // Enhanced loading skeleton component with animations
  const FileTreeSkeleton = () => (
    <motion.div 
      className="space-y-2 p-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {[...Array(8)].map((_, i) => (
        <motion.div 
          key={i} 
          className="flex items-center gap-2" 
          style={{ paddingLeft: `${(i % 3) * 20 + 8}px` }}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3, delay: i * 0.05 }}
        >
          <Skeleton className="h-3 w-3 loading-pulse" />
          <Skeleton className="h-4 w-4 loading-pulse" style={{ animationDelay: `${i * 0.1}s` }} />
          <Skeleton className="h-4 flex-1 max-w-32 loading-pulse" style={{ animationDelay: `${i * 0.15}s` }} />
        </motion.div>
      ))}
      <motion.div 
        className="flex items-center justify-center pt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <motion.div 
            className="h-2 w-2 rounded-full bg-primary"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity, ease: "easeInOut" }}
          />
          <span className="loading-dots">Loading file tree</span>
        </div>
      </motion.div>
    </motion.div>
  );

  const getFileStats = (nodes: FileNode[]): { files: number; directories: number } => {
    let stats = { files: 0, directories: 0 };
    nodes.forEach(node => {
      if (node.type === 'directory') {
        stats.directories++;
        if (node.children) {
          const childStats = getFileStats(node.children);
          stats.files += childStats.files;
          stats.directories += childStats.directories;
        }
      } else {
        stats.files++;
      }
    });
    return stats;
  };

  // Safe access to detected technologies with type guard
  const detectedTechnologies = isTechnologyDetectionArray(currentRepository?.detectedTechnologies) 
    ? currentRepository.detectedTechnologies 
    : [];

  const toggleItem = (path: string) => {
    const newExpanded = new Set(expandedItems);
    if (newExpanded.has(path)) {
      newExpanded.delete(path);
    } else {
      newExpanded.add(path);
    }
    setExpandedItems(newExpanded);
  };

  const expandAll = () => {
    if (!files || !Array.isArray(files)) return;
    
    const getAllPaths = (nodes: FileNode[]): string[] => {
      const paths: string[] = [];
      for (const node of nodes) {
        if (node.type === 'directory') {
          paths.push(node.path);
          if (node.children) {
            paths.push(...getAllPaths(node.children));
          }
        }
      }
      return paths;
    };
    
    setExpandedItems(new Set(getAllPaths(files)));
  };

  const collapseAll = () => {
    setExpandedItems(new Set());
  };

  const refreshTree = () => {
    // Refresh the file tree data for current repository
    if (currentRepository?.id) {
      queryClient.invalidateQueries({ queryKey: ['/api/repositories', currentRepository.id, 'files'] });
    }
    // Also refresh the repository data to update technology detection
    queryClient.invalidateQueries({ queryKey: ['/api/repositories'] });
  };

  const fileStats = Array.isArray(files) && files.length > 0 ? getFileStats(files) : { files: 0, directories: 0 };

  return (
    <motion.div 
      className="flex-1 flex flex-col"
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Technology Detection Results */}
      {detectedTechnologies.length > 0 && (
        <motion.div 
          className="p-3 border-b border-border"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <TechnologyDisplay 
            technologies={detectedTechnologies} 
            isCompact={true} 
          />
        </motion.div>
      )}
      
      <motion.div 
        className="p-3 border-b border-border bg-card/50 backdrop-blur-sm"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-3">
          <motion.h3 
            className="font-semibold text-lg bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            File Structure
          </motion.h3>
          <motion.div 
            className="flex gap-1"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, duration: 0.3 }}
          >
            {currentRepository?.id && (
              <RepositoryDownloadButton repositoryId={currentRepository.id} repositoryName={currentRepository.name} />
            )}
            <Button 
              variant="ghost" 
              size="sm"
              onClick={expandAll}
              title="Expand All"
              data-testid="button-expand-all"
              className="hover-lift transition-fast hover:bg-green-500/10 hover:text-green-500"
            >
              <Plus className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={collapseAll}
              title="Collapse All"
              data-testid="button-collapse-all"
              className="hover-lift transition-fast hover:bg-red-500/10 hover:text-red-500"
            >
              <Minus className="h-3 w-3" />
            </Button>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={refreshTree}
              title="Refresh"
              data-testid="button-refresh-tree"
              className="hover-lift transition-fast hover:bg-blue-500/10 hover:text-blue-500"
            >
              <motion.div
                whileTap={{ rotate: 360 }}
                transition={{ duration: 0.5 }}
              >
                <RotateCcw className="h-3 w-3" />
              </motion.div>
            </Button>
          </motion.div>
        </div>
        
        {/* File Statistics */}
        {Array.isArray(files) && files.length > 0 && (
          <motion.div 
            className="flex gap-4 text-xs text-muted-foreground"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.3 }}
          >
            <span className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded-md">
              <File className="h-3 w-3" />
              {fileStats.files} files
            </span>
            <span className="flex items-center gap-1 px-2 py-1 bg-muted/30 rounded-md">
              <Folder className="h-3 w-3" />
              {fileStats.directories} folders
            </span>
          </motion.div>
        )}
      </motion.div>
      
      <ScrollArea className="flex-1">
        <AnimatePresence mode="wait">
          {isLoading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <FileTreeSkeleton />
            </motion.div>
          ) : !files || !Array.isArray(files) || files.length === 0 ? (
            <motion.div 
              key="empty"
              className="text-center py-12 text-muted-foreground p-8" 
              data-testid="tree-empty-state"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.3 }}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                <FolderOpen className="h-16 w-16 mx-auto mb-4 opacity-30" />
              </motion.div>
              <motion.p 
                className="text-sm mb-2"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 }}
              >
                No repository cloned yet
              </motion.p>
              <motion.p 
                className="text-xs"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                Clone a repository to view its structure
              </motion.p>
            </motion.div>
          ) : (
            <motion.div 
              key="files"
              className="p-1"
              data-testid="tree-content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.3 }}
            >
              {files.map((node: FileNode, index) => (
                <motion.div
                  key={node.path}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05, duration: 0.2 }}
                >
                  <FileTreeItem
                    node={node}
                    level={0}
                    expandedItems={expandedItems}
                    onToggle={toggleItem}
                    repositoryId={currentRepository?.id}
                  />
                </motion.div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </ScrollArea>
    </motion.div>
  );
}
