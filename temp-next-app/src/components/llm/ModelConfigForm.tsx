'use client';

import { useState, useEffect } from 'react';
import * as webllm from '@mlc-ai/web-llm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { ModelConfig, defaultModelConfig } from '@/types/llm';
import { useForm } from 'react-hook-form';

// Using a more general type that doesn't require an index signature
interface ModelRecord {
  model_id: string;
}

export default function ModelConfigForm({ 
  onConfigChange 
}: { 
  onConfigChange: (config: ModelConfig) => void 
}) {
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [storedConfig, setStoredConfig] = useLocalStorage<ModelConfig>(
    'web-llm-config',
    defaultModelConfig
  );

  const form = useForm<ModelConfig>({
    defaultValues: storedConfig,
  });

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
        console.error('Error fetching models:', error);
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

  const onSubmit = (data: ModelConfig) => {
    setIsLoading(true);
    
    // Save to local storage
    setStoredConfig(data);
    
    // Notify parent component
    onConfigChange(data);
    
    setIsLoading(false);
  };

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
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger className="text-sm md:text-base">
                        <SelectValue placeholder="Select a model" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {availableModels.map((model) => (
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
            
            <Button type="submit" className="w-full mt-6" disabled={isLoading}>
              {isLoading ? 'Applying...' : 'Apply Configuration'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}