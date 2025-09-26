import { CheckCircle, ArrowRight, Code2, ChevronDown, ChevronRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';
import { useState } from 'react';

interface KeyChangesProps {
  changes: string[];
  title?: string;
  className?: string;
}

const KeyChanges = ({ changes, title = "Key Migration Changes", className }: KeyChangesProps) => {
  const [isOpen, setIsOpen] = useState(true); // Open by default
  
  if (!changes || changes.length === 0) {
    return null;
  }

  const formatChange = (change: string) => {
    // Detect if the change mentions specific technologies or patterns
    const technologies = ['Kafka', 'Azure Service Bus', 'Confluent', 'ServiceBus', 'Producer', 'Consumer'];
    const hasFromTo = change.toLowerCase().includes('replaced') || change.toLowerCase().includes('with');
    
    return {
      text: change,
      isReplacement: hasFromTo,
      mentionsTech: technologies.some(tech => change.includes(tech))
    };
  };

  const getChangeIcon = (change: string) => {
    if (change.toLowerCase().includes('replaced') || change.toLowerCase().includes('added')) {
      return <ArrowRight className="h-4 w-4 text-blue-600" />;
    }
    return <CheckCircle className="h-4 w-4 text-green-600" />;
  };

  return (
    <Card className={cn('border-l-4 border-l-blue-500', className)} data-testid="key-changes">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="pb-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
            <div className="flex items-center gap-2">
              {isOpen ? (
                <ChevronDown className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              ) : (
                <ChevronRight className="h-4 w-4 text-slate-600 dark:text-slate-300" />
              )}
              <Code2 className="h-5 w-5 text-blue-600" />
              <CardTitle className="text-lg">{title}</CardTitle>
            </div>
            <CardDescription>
              Summary of the main code transformations in this migration
            </CardDescription>
          </CardHeader>
        </CollapsibleTrigger>
      
        <CollapsibleContent>
          <CardContent className="space-y-3">
        {changes.map((change, index) => {
          const formattedChange = formatChange(change);
          
          return (
            <div
              key={index}
              className="flex items-start gap-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 transition-colors"
              data-testid={`key-change-${index}`}
            >
              <div className="flex-shrink-0 mt-0.5">
                {getChangeIcon(change)}
              </div>
              
              <div className="flex-1">
                <p className="text-sm text-slate-800 dark:text-slate-100 leading-relaxed font-medium">
                  {formattedChange.text}
                </p>
                
                {formattedChange.isReplacement && (
                  <Badge variant="secondary" className="mt-2 text-xs">
                    Migration
                  </Badge>
                )}
                
                {formattedChange.mentionsTech && (
                  <Badge variant="outline" className="mt-2 ml-1 text-xs">
                    Technology Update
                  </Badge>
                )}
              </div>
            </div>
          );
        })}
        
        <div className="mt-4 pt-3 border-t border-blue-200 dark:border-blue-700">
          <div className="flex items-center justify-between text-xs text-blue-600 dark:text-blue-300">
            <span>{changes.length} change{changes.length !== 1 ? 's' : ''} identified</span>
            <span className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Migration Summary
            </span>
          </div>
        </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default KeyChanges;