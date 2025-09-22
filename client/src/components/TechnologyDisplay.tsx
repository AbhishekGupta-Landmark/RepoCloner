import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TechnologyDetection, TechnologyCategory } from "@shared/schema";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Monitor, 
  Server, 
  Database, 
  Code, 
  Globe, 
  Zap, 
  Shield, 
  Wrench, 
  Layers,
  Cpu,
  Sparkles
} from "lucide-react";

interface TechnologyDisplayProps {
  technologies: TechnologyDetection[];
  isCompact?: boolean;
}

export default function TechnologyDisplay({ technologies, isCompact = true }: TechnologyDisplayProps) {
  if (!technologies || technologies.length === 0) {
    return null;
  }

  // Group technologies by category
  const groupedTechnologies = technologies.reduce((acc, tech) => {
    if (!acc[tech.category]) {
      acc[tech.category] = [];
    }
    acc[tech.category].push(tech);
    return acc;
  }, {} as Record<TechnologyCategory, TechnologyDetection[]>);

  // Sort technologies within each category by confidence
  Object.values(groupedTechnologies).forEach(categoryTechs => {
    categoryTechs.sort((a, b) => b.confidence - a.confidence);
  });

  const getCategoryIcon = (category: TechnologyCategory) => {
    switch (category) {
      case 'frontend':
        return Monitor;
      case 'backend':
        return Server;
      case 'database':
        return Database;
      case 'cloud':
        return Globe;
      case 'testing':
        return Shield;
      case 'devops':
        return Wrench;
      case 'security':
        return Shield;
      case 'monitoring':
        return Cpu;
      case 'utilities':
        return Code;
      case 'documentation':
        return Layers;
      default:
        return Code;
    }
  };

  const getCategoryColor = (category: TechnologyCategory) => {
    switch (category) {
      case 'frontend':
        return 'text-blue-500';
      case 'backend':
        return 'text-green-500';
      case 'database':
        return 'text-purple-500';
      case 'cloud':
        return 'text-cyan-500';
      case 'testing':
        return 'text-yellow-500';
      case 'devops':
        return 'text-orange-500';
      case 'security':
        return 'text-red-500';
      case 'monitoring':
        return 'text-indigo-500';
      case 'utilities':
        return 'text-gray-500';
      case 'documentation':
        return 'text-emerald-500';
      default:
        return 'text-gray-500';
    }
  };

  const getCategoryClass = (category: TechnologyCategory) => {
    switch (category) {
      case 'frontend':
        return 'tech-frontend';
      case 'backend':
        return 'tech-backend';
      case 'database':
        return 'tech-database';
      case 'cloud':
        return 'tech-cloud';
      case 'testing':
        return 'tech-testing';
      case 'devops':
        return 'tech-devops';
      case 'security':
        return 'tech-security';
      case 'monitoring':
        return 'tech-monitoring';
      case 'utilities':
        return 'tech-utilities';
      case 'documentation':
        return 'tech-documentation';
      default:
        return 'tech-utilities';
    }
  };

  const getCategoryLabel = (category: TechnologyCategory) => {
    switch (category) {
      case 'frontend':
        return 'Frontend';
      case 'backend':
        return 'Backend';
      case 'database':
        return 'Database';
      case 'cloud':
        return 'Cloud';
      case 'testing':
        return 'Testing';
      case 'devops':
        return 'DevOps';
      case 'security':
        return 'Security';
      case 'monitoring':
        return 'Monitoring';
      case 'utilities':
        return 'Utilities';
      case 'documentation':
        return 'Documentation';
      default:
        return 'Utilities';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getConfidenceClass = (confidence: number) => {
    if (confidence >= 0.9) return 'confidence-high';
    if (confidence >= 0.7) return 'confidence-medium';
    return 'confidence-low';
  };

  if (isCompact) {
    return (
      <motion.div 
        className="space-y-3" 
        data-testid="technology-display-compact"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <AnimatePresence>
          {Object.entries(groupedTechnologies).map(([category, techs], categoryIndex) => {
            const Icon = getCategoryIcon(category as TechnologyCategory);
            const colorClass = getCategoryColor(category as TechnologyCategory);
            const categoryClass = getCategoryClass(category as TechnologyCategory);
            const label = getCategoryLabel(category as TechnologyCategory);
            
            return (
              <motion.div 
                key={category} 
                className="flex items-center gap-2 flex-wrap"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: categoryIndex * 0.1, duration: 0.3 }}
              >
                <div className="flex items-center gap-1 min-w-0">
                  <motion.div
                    whileHover={{ scale: 1.1, rotate: 5 }}
                    transition={{ type: "spring", stiffness: 400, damping: 10 }}
                  >
                    <Icon className={`h-4 w-4 ${colorClass} flex-shrink-0`} />
                  </motion.div>
                  <span className="text-sm font-medium text-muted-foreground">{label}:</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {techs.slice(0, 4).map((tech, index) => (
                    <motion.div
                      key={`${tech.name}-${index}`}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: (categoryIndex * 4 + index) * 0.05, duration: 0.2 }}
                      whileHover={{ scale: 1.05 }}
                      className="transition-fast"
                    >
                      <Badge 
                        variant="secondary" 
                        className={`text-xs hover-lift transition-smooth ${getConfidenceClass(tech.confidence)}`}
                        data-testid={`technology-badge-${tech.name.toLowerCase().replace(/\s+/g, '-')}`}
                      >
                        {tech.name}
                        {tech.version && (
                          <span className="ml-1 opacity-70">v{tech.version}</span>
                        )}
                      </Badge>
                    </motion.div>
                  ))}
                  {techs.length > 4 && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.3, duration: 0.2 }}
                    >
                      <Badge variant="outline" className="text-xs hover-scale transition-fast">
                        +{techs.length - 4} more
                      </Badge>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>
    );
  }

  return (
    <motion.div 
      className="space-y-4" 
      data-testid="technology-display-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <motion.div 
        className="flex items-center gap-2 mb-4"
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
      >
        <motion.div
          whileHover={{ rotate: 360 }}
          transition={{ duration: 0.6 }}
        >
          <Layers className="h-5 w-5 text-primary" />
        </motion.div>
        <h3 className="text-lg font-semibold gradient-text">Detected Technologies</h3>
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
          className="ml-auto"
        >
          <Badge variant="outline" className="hover-scale transition-bounce shadow-soft">
            <Sparkles className="h-3 w-3 mr-1" />
            {technologies.length} found
          </Badge>
        </motion.div>
      </motion.div>

      <div className="grid gap-4">
        <AnimatePresence>
          {Object.entries(groupedTechnologies).map(([category, techs], categoryIndex) => {
            const Icon = getCategoryIcon(category as TechnologyCategory);
            const colorClass = getCategoryColor(category as TechnologyCategory);
            const categoryClass = getCategoryClass(category as TechnologyCategory);
            const label = getCategoryLabel(category as TechnologyCategory);
            
            return (
              <motion.div
                key={category}
                initial={{ opacity: 0, y: 20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ delay: categoryIndex * 0.1, duration: 0.3 }}
              >
                <Card className="relative hover-lift shadow-medium transition-smooth border hover:border-primary/20 group">
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <motion.div
                        whileHover={{ scale: 1.2, rotate: 10 }}
                        transition={{ type: "spring", stiffness: 400, damping: 10 }}
                      >
                        <Icon className={`h-5 w-5 ${colorClass} group-hover:drop-shadow-glow transition-smooth`} />
                      </motion.div>
                      <span className="group-hover:text-primary transition-smooth">{label}</span>
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: categoryIndex * 0.1 + 0.2, type: "spring" }}
                        className="ml-auto"
                      >
                        <Badge variant="secondary" className={`${categoryClass} transition-smooth group-hover:scale-105`}>
                          {techs.length}
                        </Badge>
                      </motion.div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="grid gap-3">
                      <AnimatePresence>
                        {techs.map((tech, index) => (
                          <motion.div 
                            key={`${tech.name}-${index}`} 
                            className="flex items-center justify-between p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-smooth hover-lift border border-transparent hover:border-primary/10"
                            data-testid={`technology-item-${tech.name.toLowerCase().replace(/\s+/g, '-')}`}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: (categoryIndex * techs.length + index) * 0.05, duration: 0.2 }}
                            whileHover={{ scale: 1.02 }}
                          >
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{tech.name}</span>
                              {tech.version && (
                                <motion.div
                                  initial={{ opacity: 0, scale: 0 }}
                                  animate={{ opacity: 1, scale: 1 }}
                                  transition={{ delay: (categoryIndex * techs.length + index) * 0.05 + 0.1 }}
                                >
                                  <Badge variant="outline" className="text-xs hover-scale transition-fast">
                                    v{tech.version}
                                  </Badge>
                                </motion.div>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1">
                                <div className="relative">
                                  <Progress 
                                    value={tech.confidence * 100} 
                                    className="w-16 h-2 progress-animate"
                                  />
                                  <motion.div
                                    className="absolute inset-0 rounded-full bg-gradient-to-r from-primary/20 to-primary/40"
                                    initial={{ scaleX: 0 }}
                                    animate={{ scaleX: tech.confidence }}
                                    transition={{ delay: (categoryIndex * techs.length + index) * 0.05 + 0.2, duration: 0.6, ease: "easeOut" }}
                                    style={{ transformOrigin: 'left' }}
                                  />
                                </div>
                                <motion.span 
                                  className={`text-xs font-medium px-2 py-1 rounded-full ${getConfidenceClass(tech.confidence)} transition-smooth`}
                                  initial={{ opacity: 0 }}
                                  animate={{ opacity: 1 }}
                                  transition={{ delay: (categoryIndex * techs.length + index) * 0.05 + 0.3 }}
                                >
                                  {Math.round(tech.confidence * 100)}%
                                </motion.span>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      {technologies.length === 0 && (
        <motion.div 
          className="text-center py-12 text-muted-foreground"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            animate={{ y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Code className="h-16 w-16 mx-auto mb-4 opacity-30" />
          </motion.div>
          <motion.p 
            className="text-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            No technologies detected
          </motion.p>
        </motion.div>
      )}
    </motion.div>
  );
}