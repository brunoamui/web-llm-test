'use client';

import { useState, useCallback } from 'react';
import ModelConfigForm from '@/components/llm/ModelConfigForm';
import ChatInterface from '@/components/llm/ChatInterface';
import ModelStatus from '@/components/llm/ModelStatus';
import { StatsDashboard } from '@/components/stats/StatsDashboard';
import { StatCollectionProvider } from '@/components/stats/StatCollectionProvider';
import { ModelConfig, defaultModelConfig, ModelStatus as ModelStatusType } from '@/types/llm';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { Logger } from '@/lib/logger';
import { ErrorBoundary } from '@/components/ui/error-boundary';
import type { ModelStats } from '@/hooks/useModelStats'; // Import ModelStats type

// Create a logger for the page component
const logger = Logger.getLogger('Page');

export default function Home() {
  const [config, setConfig] = useState<ModelConfig>(defaultModelConfig);
  const [status, setStatus] = useState<ModelStatusType>({ isLoading: false });
  const [showStats, setShowStats] = useState<boolean>(false);
  const [modelStats, setModelStats] = useState<ModelStats | null>(null); // Use ModelStats type
  const [retryCount, setRetryCount] = useState<number>(0);

  // Memoize callback functions to prevent recreation on each render
  const handleConfigChange = useCallback((newConfig: ModelConfig) => {
    setConfig(newConfig);
  }, []);

  const handleStatusChange = useCallback((newStatus: ModelStatusType) => {
    setStatus(newStatus);
    
    // Log errors when they occur for debugging
    if (newStatus.error) {
      logger.error("Model status error", { error: newStatus.error });
    }
  }, []);

  const handleStatsUpdate = useCallback((stats: ModelStats) => { // Update parameter type
    logger.debug("Received stats update");
    setModelStats(stats);
  }, []);

  // Function to handle retry attempts for WebGPU errors
  const handleRetry = useCallback(() => {
    setRetryCount(count => count + 1);
    
    // Force clear any error state
    setStatus(prev => ({ 
      ...prev, 
      error: undefined, 
      isLoading: true 
    }));
    
    logger.info("Retrying model initialization", { attempt: retryCount + 1 });
    
    // The retry is triggered by creating a new config object with the same model
    // This causes ChatInterface to reinitialize the model
    setConfig(prevConfig => ({
      ...prevConfig,
      _retryTimestamp: Date.now() // Adding this causes the effect to trigger again
    }));
  }, [retryCount]);

  return (
    // Wrap the entire app with StatCollectionProvider to enable session-based statistics
    <StatCollectionProvider modelStats={modelStats}>
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <ErrorBoundary componentName="ModelConfigForm">
              <ModelConfigForm onConfigChange={handleConfigChange} />
            </ErrorBoundary>
          </div>
          <div className="flex flex-col gap-4 order-1 lg:order-2">
            <ModelStatus 
              status={status} 
              onRetry={handleRetry}
            />
            <ErrorBoundary 
              componentName="ChatInterface"
              onReset={handleRetry}
            >
              <ChatInterface 
                config={config} 
                onStatusChange={handleStatusChange}
                onStatsUpdate={handleStatsUpdate}
                retryCount={retryCount}
              />
            </ErrorBoundary>
          </div>
        </div>
        
        <div className="mt-8">
          <Button 
            variant="outline" 
            onClick={() => setShowStats(!showStats)}
            className="flex items-center w-full justify-between"
          >
            Model Statistics
            {showStats ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </Button>
          
          {modelStats && (
            <ErrorBoundary componentName="StatsDashboard">
              <StatsDashboard 
                isVisible={showStats}
                stats={modelStats}
                modelId={config.modelId}
              />
            </ErrorBoundary>
          )}
        </div>
        
        <div className="p-4 bg-secondary/50 rounded-lg text-sm md:text-base">
          <h2 className="text-base md:text-lg font-semibold mb-2">About Web-LLM</h2>
          <p className="mb-2">
            Web-LLM runs large language models directly in your browser with WebGPU acceleration. 
            All processing happens locally on your device, providing privacy and eliminating the need for server-side processing.
          </p>
          <p>
            The first time you use a model, it will be downloaded to your browser cache. 
            This may take some time depending on your internet connection speed.
          </p>
          {status.error && status.error.includes("WebGPU") && (
            <div className="mt-4 p-3 bg-yellow-100 border border-yellow-300 rounded-md text-yellow-800">
              <p className="font-semibold">WebGPU Compatibility Issue Detected</p>
              <p className="mt-1">
                Your browser or GPU may have limited WebGPU support. Try using a smaller model, updating your drivers, or using Chrome 113+.
              </p>
            </div>
          )}
        </div>
      </div>
    </StatCollectionProvider>
  );
}
