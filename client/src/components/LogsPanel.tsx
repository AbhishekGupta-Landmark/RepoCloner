import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Trash2, Download, Wifi } from "lucide-react";
import { useAppContext } from "@/context/AppContext";

export default function LogsPanel() {
  const { logService } = useAppContext();
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new logs are added
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [logService.logs]);

  const clearLogs = () => {
    logService.clearLogs();
  };

  const downloadLogs = () => {
    const logContent = logService.logs.map(log => 
      `[${formatTimestamp(log.timestamp)}] ${log.level}: ${log.message}`
    ).join('\n');
    
    const blob = new Blob([logContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs-${new Date().toISOString().split('T')[0]}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('en-US', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    });
  };


  // Clean 5-color logging scheme

  const getLogTextColor = () => {
    // Log text content - Gray
    return 'text-gray-100 dark:text-gray-200';
  };

  const getTimestampColor = () => {
    // Date/Time stamps - Pink
    return 'text-pink-500 dark:text-pink-400 font-medium';
  };

  const getRightLabelsColor = () => {
    // Right-side action labels - Teal
    return 'text-teal-500 dark:text-teal-300 font-bold';
  };

  const getUrlsColor = () => {
    // URLs - Cyan with underlines
    return 'text-cyan-400 dark:text-cyan-300 underline hover:text-cyan-300 dark:hover:text-cyan-200';
  };

  const getApiRequestsColor = () => {
    // API requests - Violet
    return 'text-violet-500 dark:text-violet-300 font-medium';
  };

  const colorizeLogMessage = (message: string) => {
    // Type definitions for match objects
    interface MatchResult {
      start: number;
      end: number;
      text: string;
      type: string;
      capture: string;
    }

    interface ParsedPart {
      text: string;
      type: string;
      capture?: string;
    }

    // Clean 5-color regex patterns
    const patterns = [
      // Right-side labels - comprehensive pattern for all action/category labels
      { regex: /\[(Clone Operation|Clone Configuration|Clone Complete|Clone Request|Clone Result|Clone Error|Clone Initiation|Network|Data Processing|Debug|Repository Info|Personal Account|State Management|File Analysis|Technology Detection|User Action|UI Update|Repository|Analysis|File Operation|System|AppContext|Input Validation|URL Validation|Clipboard|Clipboard Error|Error Details|Network Error|Auth Error|Repository Error|Timeout Error|General Error|Operation Summary|User Input|Clipboard)\]/g, type: 'rightLabels' },
      // URLs (http/https)
      { regex: /(https?:\/\/[^\s]+)/g, type: 'urls' },
      // API requests - precise pattern for actual API endpoints
      { regex: /(\/api\/[a-zA-Z0-9\/_-]+|\bapi\/[a-zA-Z0-9\/_-]+)/g, type: 'apiRequests' }
    ];

    const parts: ParsedPart[] = [];
    let currentIndex = 0;
    const matches: MatchResult[] = [];

    // Collect all matches with their positions
    patterns.forEach(pattern => {
      let match;
      const regex = new RegExp(pattern.regex.source, pattern.regex.flags);
      while ((match = regex.exec(message)) !== null) {
        matches.push({
          start: match.index,
          end: match.index + match[0].length,
          text: match[0],
          type: pattern.type,
          capture: match[1] || match[0]
        });
      }
    });

    // Sort matches by position
    matches.sort((a, b) => a.start - b.start);

    // Remove overlapping matches (keep the first one)
    const filteredMatches: MatchResult[] = [];
    for (const match of matches) {
      const hasOverlap = filteredMatches.some(existing => 
        (match.start >= existing.start && match.start < existing.end) ||
        (match.end > existing.start && match.end <= existing.end)
      );
      if (!hasOverlap) {
        filteredMatches.push(match);
      }
    }

    // Build parts array
    for (const match of filteredMatches) {
      // Add text before the match
      if (match.start > currentIndex) {
        parts.push({
          text: message.substring(currentIndex, match.start),
          type: 'text'
        });
      }

      // Add the match
      parts.push({
        text: match.text,
        type: match.type,
        capture: match.capture
      });

      currentIndex = match.end;
    }

    // Add remaining text
    if (currentIndex < message.length) {
      parts.push({
        text: message.substring(currentIndex),
        type: 'text'
      });
    }

    // If no matches found, return the whole message as regular text
    if (parts.length === 0) {
      return <span className={getLogTextColor()}>{message}</span>;
    }

    return (
      <span>
        {parts.map((part, index) => {
          switch (part.type) {
            case 'rightLabels':
              return (
                <span key={index} className={getRightLabelsColor()}>
                  {part.text}
                </span>
              );
            case 'urls':
              return (
                <span key={index} className={getUrlsColor()}>
                  {part.text}
                </span>
              );
            case 'apiRequests':
              return (
                <span key={index} className={getApiRequestsColor()}>
                  {part.text}
                </span>
              );
            case 'text':
            default:
              return (
                <span key={index} className={getLogTextColor()}>
                  {part.text}
                </span>
              );
          }
        })}
      </span>
    );
  };

  return (
    <div className="p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold">Activity Logs</h2>
          <div className="flex items-center gap-2">
            <Wifi className="h-4 w-4 text-green-500" data-testid="icon-connected" />
            <span className="text-xs text-green-600" data-testid="text-connection-status">
              Real-time Logging
            </span>
          </div>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary" 
            size="sm"
            onClick={clearLogs}
            data-testid="button-clear-logs"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            Clear
          </Button>
          <Button 
            variant="secondary" 
            size="sm"
            onClick={downloadLogs}
            data-testid="button-download-logs"
          >
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>
        </div>
      </div>
      
      <ScrollArea 
        ref={scrollAreaRef}
        className="flex-1 bg-black rounded-lg p-4 font-mono text-sm"
        data-testid="logs-container"
      >
        {logService.logs.length === 0 ? (
          <div className="text-gray-100 dark:text-gray-200 text-center py-8" data-testid="logs-empty-state">
            No logs available
          </div>
        ) : (
          <div className="space-y-1">
            {logService.logs.map((log, index) => (
              <div 
                key={log.id || index} 
                className="text-white"
                data-testid={`log-entry-${index}`}
              >
                <span className={getTimestampColor()}>[{formatTimestamp(log.timestamp)}]</span>{' '}
                {colorizeLogMessage(log.message)}
              </div>
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
