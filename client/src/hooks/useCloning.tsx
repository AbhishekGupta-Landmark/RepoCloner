import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { CloneOptions } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useAppContext } from "@/context/AppContext";

export function useCloning() {
  const { setCurrentRepository, logService } = useAppContext();
  const queryClient = useQueryClient();
  const { toast } = useToast();


  const cloneMutation = useMutation({
    mutationFn: async ({ url, options }: { url: string; options: CloneOptions }) => {
      const response = await apiRequest('POST', '/api/repositories/clone', {
        url,
        options
      });
      return await response.json();
    },
    onSuccess: (data) => {
      logService.addLog('INFO', `Repository "${data.repository.name}" cloned successfully`, 'Clone Operation');
      
      // Update app state
      setCurrentRepository(data.repository);
      queryClient.invalidateQueries({ queryKey: ['/api/repositories'] });
      
      // Show success notification
      toast({
        title: "Clone Successful",
        description: `Repository "${data.repository.name}" has been cloned successfully`
      });
    },
    onError: (error: any) => {
      logService.addLog('ERROR', `Clone operation failed: ${error.message}`, 'Clone Operation');
      
      toast({
        title: "Clone Failed",
        description: error.message || "Failed to clone repository",
        variant: "destructive"
      });
    }
  });

  const cloneRepository = async (url: string, options: CloneOptions): Promise<boolean> => {
    try {
      await cloneMutation.mutateAsync({ url, options });
      return true;
    } catch (error) {
      return false;
    }
  };

  return {
    cloneRepository,
    isLoading: cloneMutation.isPending
  };
}
