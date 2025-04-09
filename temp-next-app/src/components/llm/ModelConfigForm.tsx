'use client';

import { useState, useEffect, memo, useMemo, useCallback } from 'react';
import * as webllm from '@mlc-ai/web-llm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ModelConfig, defaultModelConfig } from '@/types/llm';
import { useForm } from 'react-hook-form';
import { Logger, LogLevel } from '@/lib/logger';

// Using a more general type that doesn't require an index signature
interface ModelRecord {
  model_id: string;
}

// Log level options for the selector
const logLevelOptions = [
  { value: LogLevel.ERROR.toString(), label: 'Error Only' },
  { value: LogLevel.WARN.toString(), label: 'Warning' },
  { value: LogLevel.INFO.toString(), label: 'Info' },
  { value: LogLevel.DEBUG.toString(), label: 'Debug' },
  { value: LogLevel.TRACE.toString(), label: 'Trace' }
];

// Create a component logger
const logger = Logger.getLogger('ModelConfigForm');

const ModelConfigForm = ({ 
  onConfigChange 
}: { 
  onConfigChange: (config: ModelConfig) => void 
}) => {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storedConfig, setStoredConfig] = useLocalStorage<ModelConfig>(
    'web-llm-config',
    defaultModelConfig
  );

  // Memoize form default values to prevent re-render triggers
  const defaultValues = useMemo(() => storedConfig, [storedConfig]);
  
  const form = useForm<ModelConfig>({
    defaultValues,
  });

  // Update form when storedConfig changes, but without causing re-renders
  useEffect(() => {
    form.reset(storedConfig);
  }, [storedConfig, form]);

  // Configure logger when log level changes
  useEffect(() => {
    if (storedConfig.logLevel) {
      const numLevel = parseInt(storedConfig.logLevel);
      if (!isNaN(numLevel)) {
        // We don't need to use LogLevel[numLevel] since it's already a numeric enum
        logger.debug(`Setting client log level to ${numLevel}`);
        Logger.configure({
          minLevel: numLevel as LogLevel,
          componentLevels: {}
        });
      }
    }
  }, [storedConfig.logLevel]);

  // Memoize model list for performance
  const sortedAvailableModels = useMemo(() => {
    return [...availableModels].sort();
  }, [availableModels]);

  useEffect(() => {
    // On mount, get available models from web-llm
    const fetchModels = async () => {
      try {
        // In a real app, you might want to get this from the web-llm API
        // For now, we'll use a subset of known supported models
        const modelList = webllm?.prebuiltAppConfig?.model_list || [];
        // Using type assertion to avoid TypeScript error
        const modelIds = (modelList as ModelRecord[]).map(model => model.model_id);
        
        if (modelIds.length === 0) {
          // Fallback to known models if we can't get the list
          setAvailableModels([
            'Llama-3.1-8B-Instruct-q4f32_1-MLC',
            'Phi-3-mini-4k-instruct-q4f32_1-MLC',
            'Gemma-2B-it-q4f32_1-MLC',
            'Mistral-7B-v0.3-q4f32_1-MLC',
            'Qwen2-1.5B-instruct-q4f32_1-MLC'
          ]);
        } else {
          setAvailableModels(modelIds);
        }
      } catch (error) {
        logger.error('Error fetching models', { error });
        // Fallback to default models
        setAvailableModels([
          'Llama-3.1-8B-Instruct-q4f32_1-MLC',
          'Phi-3-mini-4k-instruct-q4f32_1-MLC',
          'Gemma-2B-it-q4f32_1-MLC',
          'Mistral-7B-v0.3-q4f32_1-MLC',
          'Qwen2-1.5B-instruct-q4f32_1-MLC'
        ]);
      }
    };

    fetchModels();
  }, []);

  // Memoize onSubmit function to prevent unnecessary re-renders
  const onSubmit = useCallback((data: ModelConfig) => {
    setIsLoading(true);
    
    // Save to local storage
    setStoredConfig(data);
    
    // Notify parent component
    onConfigChange(data);
    
    setIsLoading(false);
    
    // Log the new configuration
    logger.info('Model configuration updated', { 
      modelId: data.modelId,
      temperature: data.temperature,
      logLevel: data.logLevel
    });
  }, [onConfigChange, setStoredConfig]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-xl md:text-2xl">Model Configuration</CardTitle>
        <CardDescription className="text-sm md:text-base">
          Choose a model and configure its parameters
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="modelId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm md:text-base">Model</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger className="text-sm md:text-base">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {sortedAvailableModels.map((model) => (
                        <SelectItem key={model} value={model} className="text-sm md:text-base">
                          {model}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs md:text-sm">
                    Select the Hugging Face model to use
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="temperature"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm md:text-base">Temperature</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.1"
                        min="0"
                        max="2"
                        className="text-sm md:text-base"
                        disabled={isLoading}
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-xs md:text-sm">
                      Controls randomness (0-2)
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="maxTokens"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm md:text-base">Max Tokens</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="100"
                        min="100"
                        max="4096"
                        className="text-sm md:text-base"
                        disabled={isLoading}
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-xs md:text-sm">
                      Maximum response length
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="topP"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm md:text-base">Top P</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.05"
                        min="0"
                        max="1"
                        className="text-sm md:text-base"
                        disabled={isLoading}
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-xs md:text-sm">
                      Nucleus sampling
                    </FormDescription>
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="repetitionPenalty"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm md:text-base">Repetition Penalty</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        step="0.05"
                        min="1"
                        max="2"
                        className="text-sm md:text-base"
                        disabled={isLoading}
                        {...field}
                        onChange={e => field.onChange(parseFloat(e.target.value))}
                      />
                    </FormControl>
                    <FormDescription className="text-xs md:text-sm">
                      Penalize repetition (1-2)
                    </FormDescription>
                  </FormItem>
                )}
              />
            </div>
            
            {/* Add Log Level Selector */}
            <FormField
              control={form.control}
              name="logLevel"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-sm md:text-base">Log Level</FormLabel>
                  <Select 
                    onValueChange={field.onChange} 
                    value={field.value}
                    disabled={isLoading}
                  >
                    <FormControl>
                      <SelectTrigger className="text-sm md:text-base">
                        <SelectValue placeholder="Select log level" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {logLevelOptions.map((option) => (
                        <SelectItem key={option.value} value={option.value} className="text-sm md:text-base">
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormDescription className="text-xs md:text-sm">
                    Control the detail level of application logs
                  </FormDescription>
                </FormItem>
              )}
            />
            
            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? 'Applying...' : 'Apply Configuration'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};

export default memo(ModelConfigForm);