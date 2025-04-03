'use client';

import { useState, useCallback } from 'react';
import ModelConfigForm from '@/components/llm/ModelConfigForm';
import ChatInterface from '@/components/llm/ChatInterface';
import ModelStatus from '@/components/llm/ModelStatus';
import { ModelConfig, defaultModelConfig, ModelStatus as ModelStatusType } from '@/types/llm';

export default function Home() {
  const [config, setConfig] = useState<ModelConfig>(defaultModelConfig);
  const [status, setStatus] = useState<ModelStatusType>({ isLoading: false });

  // Memoize callback functions to prevent recreation on each render
  const handleConfigChange = useCallback((newConfig: ModelConfig) => {
    setConfig(newConfig);
  }, []);

  const handleStatusChange = useCallback((newStatus: ModelStatusType) => {
    setStatus(newStatus);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="order-2 lg:order-1">
          <ModelConfigForm onConfigChange={handleConfigChange} />
        </div>
        <div className="flex flex-col gap-4 order-1 lg:order-2">
          <ModelStatus status={status} />
          <ChatInterface 
            config={config} 
            onStatusChange={handleStatusChange} 
          />
        </div>
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
      </div>
    </div>
  );
}
