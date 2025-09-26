import { useState } from 'react';
import { ChevronDown, ChevronRight, Copy, FileText, Plus, Minus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

interface DiffLine {
  type: 'addition' | 'deletion' | 'context';
  content: string;
  old_line: number | null;
  new_line: number | null;
}

interface DiffHunk {
  header: string;
  old_start: number;
  old_count: number;
  new_start: number;
  new_count: number;
  lines: DiffLine[];
}

interface DiffStats {
  additions: number;
  deletions: number;
  context: number;
  total_changes: number;
}

interface StructuredDiff {
  file: string;
  diff_content: string;
  language: string;
  hunks?: DiffHunk[];
  stats?: DiffStats;
}

interface DiffViewerProps {
  diffs: StructuredDiff[];
  className?: string;
}

const DiffViewer = ({ diffs, className }: DiffViewerProps) => {
  const [expandedFiles, setExpandedFiles] = useState<Set<string>>(new Set(diffs.slice(0, 2).map(d => d.file)));
  const { toast } = useToast();

  const toggleFile = (fileName: string) => {
    const newExpanded = new Set(expandedFiles);
    if (newExpanded.has(fileName)) {
      newExpanded.delete(fileName);
    } else {
      newExpanded.add(fileName);
    }
    setExpandedFiles(newExpanded);
  };

  const copyDiff = async (content: string, fileName: string) => {
    try {
      await navigator.clipboard.writeText(content);
      toast({
        title: "Copied to clipboard",
        description: `Diff for ${fileName} copied successfully`,
      });
    } catch (error) {
      toast({
        title: "Copy failed",
        description: "Could not copy diff to clipboard",
        variant: "destructive",
      });
    }
  };

  const getLineTypeIcon = (type: string) => {
    switch (type) {
      case 'addition':
        return <Plus className="h-3 w-3 text-green-600" />;
      case 'deletion':
        return <Minus className="h-3 w-3 text-red-600" />;
      default:
        return null;
    }
  };

  const getLineTypeClass = (type: string) => {
    switch (type) {
      case 'addition':
        return 'bg-green-50 dark:bg-green-950/20 border-l-2 border-green-500';
      case 'deletion':
        return 'bg-red-50 dark:bg-red-950/20 border-l-2 border-red-500';
      case 'context':
        return 'bg-gray-50 dark:bg-gray-900/50';
      default:
        return '';
    }
  };

  if (!diffs || diffs.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p>No code diffs available</p>
      </div>
    );
  }

  return (
    <div className={cn('space-y-4', className)} data-testid="diff-viewer">
      {diffs.map((diff, index) => {
        const isExpanded = expandedFiles.has(diff.file);
        const stats = diff.stats;
        
        return (
          <Card key={index} className="border border-gray-200 dark:border-gray-700">
            <Collapsible 
              open={isExpanded}
              onOpenChange={() => toggleFile(diff.file)}
            >
              <CollapsibleTrigger asChild>
                <CardHeader 
                  className="cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors py-3"
                  data-testid={`diff-header-${index}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-gray-500" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-500" />
                      )}
                      <FileText className="h-4 w-4 text-blue-600" />
                      <span className="font-mono font-medium text-sm">
                        {diff.file}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-4">
                      {stats && (
                        <div className="flex items-center gap-2 text-xs">
                          {stats.additions > 0 && (
                            <span className="text-green-600 font-medium">
                              +{stats.additions}
                            </span>
                          )}
                          {stats.deletions > 0 && (
                            <span className="text-red-600 font-medium">
                              -{stats.deletions}
                            </span>
                          )}
                        </div>
                      )}
                      
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyDiff(diff.diff_content, diff.file);
                        }}
                        data-testid={`copy-diff-${index}`}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
              </CollapsibleTrigger>

              <CollapsibleContent>
                <CardContent className="p-0">
                  <div className="bg-gray-50 dark:bg-gray-900 border-t">
                    {diff.hunks && diff.hunks.length > 0 ? (
                      // Structured diff view
                      <div className="font-mono text-sm">
                        {diff.hunks.map((hunk, hunkIndex) => (
                          <div key={hunkIndex} className="border-b last:border-b-0">
                            {hunk.header && (
                              <div className="bg-blue-50 dark:bg-blue-950/20 px-4 py-2 text-blue-800 dark:text-blue-200 font-medium text-xs border-b">
                                {hunk.header}
                              </div>
                            )}
                            
                            <div data-testid={`hunk-lines-${index}-${hunkIndex}`}>
                              {hunk.lines.map((line, lineIndex) => (
                                <div
                                  key={lineIndex}
                                  className={cn(
                                    'flex items-start gap-2 px-4 py-1 hover:bg-gray-100 dark:hover:bg-gray-800',
                                    getLineTypeClass(line.type)
                                  )}
                                  data-testid={`diff-line-${line.type}`}
                                >
                                  <div className="flex items-center gap-2 min-w-16 text-xs text-gray-500 select-none">
                                    {getLineTypeIcon(line.type)}
                                    <span className="w-8 text-right">
                                      {line.old_line || ''}
                                    </span>
                                    <span className="w-8 text-right">
                                      {line.new_line || ''}
                                    </span>
                                  </div>
                                  
                                  <div className="flex-1 whitespace-pre-wrap break-words">
                                    <span className={cn(
                                      line.type === 'addition' && 'text-green-800 dark:text-green-200',
                                      line.type === 'deletion' && 'text-red-800 dark:text-red-200',
                                      line.type === 'context' && 'text-gray-700 dark:text-gray-300'
                                    )}>
                                      {line.content}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      // Fallback simple diff view
                      <div className="font-mono text-sm">
                        <pre className="p-4 whitespace-pre-wrap break-words text-gray-700 dark:text-gray-300">
                          {diff.diff_content}
                        </pre>
                      </div>
                    )}
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Collapsible>
          </Card>
        );
      })}
    </div>
  );
};

export default DiffViewer;