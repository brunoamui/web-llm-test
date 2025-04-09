'use client';

import { useState, useRef, useEffect, memo } from 'react';
import * as webllm from '@mlc-ai/web-llm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatMessage, ModelConfig, ModelStatus } from '@/types/llm';
import { useModelStats, ModelStats } from '@/hooks/useModelStats';
import { useStatCollection } from '@/components/stats/StatCollectionProvider';
import { Logger } from '@/lib/logger';
import type { ChatCompletionUsageStats } from '@/hooks/useModelStats';
import { ErrorBoundary } from '@/components/ui/error-boundary';

// Create component logger
const logger = Logger.getLogger('ChatInterface');

// Create a memoized MessageItem component
const MessageItem = memo(({ message }: { message: ChatMessage }) => (
  <div 
    className={`p-3 md:p-4 rounded-lg ${
      message.role === 'user' 
        ? 'bg-primary text-primary-foreground ml-2 md:ml-10' 
        : 'bg-secondary text-secondary-foreground mr-2 md:mr-10'
    }`}
  >
    <p className="font-semibold capitalize mb-1 text-sm md:text-base">{message.role}:</p>
    <div className="whitespace-pre-wrap text-sm md:text-base">{message.content}</div>
  </div>
));

// Add display name for better debugging
MessageItem.displayName = 'MessageItem';

const ChatInterface = ({
  config,
  onStatusChange,
  onStatsUpdate,
  retryCount = 0
}: {
  config: ModelConfig;
  onStatusChange: (status: ModelStatus) => void;
  onStatsUpdate: (stats: ModelStats) => void;
  retryCount?: number;
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [engine, setEngine] = useState<webllm.MLCEngine | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Flag to track if we can use the model (simpler than before)
  const [modelReady, setModelReady] = useState(false);
  
  // Track loading progress for UI feedback
  const [loadingProgress, setLoadingProgress] = useState(0);
  
  // Use refs to track previous state/props without triggering re-renders
  const prevModelIdRef = useRef<string>(config.modelId);
  const engineRef = useRef<webllm.MLCEngine | null>(null);
  const configRef = useRef<ModelConfig>(config);
  
  // Initialize model stats tracking
  const { 
    stats, 
    updateModelLoadStart, 
    updateModelLoadComplete, 
    updateInferenceStart, 
    handleProgressUpdate,
    updateModelMetadata,
    trackChatCompletion
  } = useModelStats(engine);
  
  // Get session tracking capabilities from the StatCollectionProvider
  const {
    startNewSession,
    endCurrentSession,
    recordUserMessage,
    recordAssistantMessage,
    recordTokenUsage
  } = useStatCollection();
  
  // Pass stats to parent component when they change
  useEffect(() => {
    onStatsUpdate(stats);
  }, [stats, onStatsUpdate]);
  
  // Update refs when their values change
  useEffect(() => {
    engineRef.current = engine;
    configRef.current = config;
  }, [engine, config]);

  // Safe unload function that handles errors
  const safeUnloadEngine = async (engineToUnload: webllm.MLCEngine | null) => {
    if (!engineToUnload) return;
    
    try {
      logger.info("Unloading engine...");
      await engineToUnload.unload();
    } catch (error: unknown) {
      logger.warn("Error unloading engine", { error });
    }
  };
  
  // Engine initialization effect - fix cleanup issue
  useEffect(() => {
    let isMounted = true;
    let downloadTimeout: NodeJS.Timeout | null = null;
    
    // Only initialize engine if model ID has changed or on retry
    if (prevModelIdRef.current !== config.modelId || retryCount > 0) {
      const initEngine = async () => {
        try {
          // Report loading status
          onStatusChange({ isLoading: true });
          
          // Start tracking model loading
          updateModelLoadStart();
          
          // Reset engine state
          setEngine(null);
          setModelReady(false);
          
          // Cleanup the previous engine if it exists
          if (engineRef.current) {
            await safeUnloadEngine(engineRef.current);
            engineRef.current = null;
          }
          
          const startTime = performance.now();
          
          // Set timeout to detect stalled downloads (2 minutes)
          downloadTimeout = setTimeout(() => {
            if (isMounted) {
              logger.warn("Download timeout reached");
              onStatusChange({
                isLoading: false,
                error: "Download timed out. Please try again or check your network connection."
              });
            }
          }, 120000);
          
          // Check WebGPU support
          if (typeof navigator !== 'undefined' && !('gpu' in navigator)) {
            throw new Error("WebGPU is not supported in this browser. Please try a browser that supports WebGPU, such as Chrome 113+.");
          }

          // Create a new engine with the selected model - remove webgpuOptions
          const engineConfig: webllm.MLCEngineConfig = {
            initProgressCallback: (report: webllm.InitProgressReport) => {
              if (isMounted) {
                // Update loading progress for UI using available properties
                const progress = report.progress || 0;
                setLoadingProgress(progress * 100);
                
                // Pass to stats tracker - use available properties
                handleProgressUpdate({
                  loaded: 0, // Placeholder - adjust if hook needs it differently
                  total: 0,  // Placeholder - adjust if hook needs it differently
                  progress: report.progress || 0
                });
              }
            },
          };
          
          logger.info(`Creating engine for model: ${config.modelId}`);
          
          // Create the engine according to WebLLM docs
          const newEngine = await webllm.CreateMLCEngine(
            config.modelId, 
            engineConfig
          );
          
          // Clear the timeout now that download is complete
          if (downloadTimeout) {
            clearTimeout(downloadTimeout);
            downloadTimeout = null;
          }
          
          if (!isMounted) {
            // If component unmounted during download, clean up and return
            try {
              await newEngine.unload();
            } catch (e: unknown) {
              logger.error("Error unloading engine after unmount", { error: e });
            }
            return;
          }
          
          const endTime = performance.now();
          logger.info("Model loaded successfully", { 
            timeSeconds: (endTime - startTime) / 1000,
            modelId: config.modelId 
          });
          
          // Extract model metadata if available
          try {
            const engineAsRecord = newEngine as unknown as Record<string, unknown>;
            // Check if loadedModelIdToPipeline exists, and then access it safely
            const pipelineMap = engineAsRecord.loadedModelIdToPipeline as Record<string, unknown> | undefined;
            const pipeline = pipelineMap?.[config.modelId] as Record<string, unknown> | undefined;
            
            if (pipeline?.model) {
              const modelInfo = pipeline.model as Record<string, unknown>;
              updateModelMetadata({
                modelId: config.modelId,
                vocabSize: modelInfo.vocabSize as number || null,
                hiddenSize: modelInfo.hiddenSize as number || null,
                attentionHeads: modelInfo.numAttentionHeads as number || null,
                quantization: modelInfo.quantization as string || null
              });
            }
          } catch (e: unknown) {
            logger.warn("Error extracting model metadata", { error: e });
          }
          
          // Start a new session for tracking
          startNewSession();
          
          // Update state and refs - IMMEDIATELY mark as ready
          engineRef.current = newEngine;
          setEngine(newEngine);
          setModelReady(true); // Mark as ready immediately
          
          // Update UI status - mark as ready immediately
          onStatusChange({ 
            isLoading: false,
            isReady: true // Mark as ready immediately
          });
          
          // Clear previous messages when changing models
          setMessages([{ role: 'system', content: 'You are a helpful AI assistant.' }]);
          
          // Update stats
          updateModelLoadComplete(endTime - startTime, config.modelId);
          
          logger.info("Model marked as ready immediately after loading");
          
        } catch (error: unknown) {
          logger.error("Error initializing WebLLM", { error });
          if (isMounted) {
            // Clear the timeout if it exists
            if (downloadTimeout) {
              clearTimeout(downloadTimeout);
              downloadTimeout = null;
            }
            
            setEngine(null);
            engineRef.current = null;
            setModelReady(false);
            
            onStatusChange({
              isLoading: false,
              error: `Error initializing model: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }
      };
      
      initEngine();
      prevModelIdRef.current = config.modelId;
    }
    
    // IMPORTANT: Only clean up the model when this specific effect is unmounting
    // Not on every re-render
    return () => {
      isMounted = false;
      if (downloadTimeout) {
        clearTimeout(downloadTimeout);
      }
      // DO NOT unload the engine here - this creates the premature unloading issue
      // The engine should only be unloaded in the component unmount effect or when switching models
    };
  }, [config.modelId, onStatusChange, updateModelLoadStart, updateModelLoadComplete, handleProgressUpdate, updateModelMetadata, startNewSession, retryCount]); 
  
  // Separate cleanup effect that runs only on unmount or when explicitly switching models
  useEffect(() => {
    // Flag to track if this is a legitimate component unmount rather than a re-render
    const unmountHandler = () => {
      logger.info("Component unmounting, cleaning up resources");
      
      // End the current session
      endCurrentSession();
      
      // Cleanup engine on component unmount
      if (engineRef.current) {
        safeUnloadEngine(engineRef.current);
      }
    };
    
    // We don't want to do anything on mount/update, only on unmount
    return unmountHandler;
    
    // Empty dependency array ensures this only runs on mount and unmount,
    // not on every endCurrentSession change which may be causing re-execution
  }, []); // Remove endCurrentSession from dependency array to prevent re-execution
  
  // Scroll to bottom of messages
  useEffect(() => {
    // Ensure dependencies are properly managed
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Reset chat
  const handleResetChat = async () => {
    if (isGenerating) return;
    
    endCurrentSession();
    startNewSession();
    setMessages([{ role: 'system', content: 'You are a helpful AI assistant.' }]);
    
    try {
      // Cast safely by first going through unknown
      const engineAsUnknown = engineRef.current as unknown;
      const engineAsRecord = engineAsUnknown as Record<string, unknown>;
      
      // Type the chat object with the expected reset method
      type ChatWithReset = { reset: () => Promise<void> };
      
      // Check if chat exists and looks like it has a reset method
      if (engineAsRecord.chat && 
          typeof (engineAsRecord.chat as Record<string, unknown>).reset === 'function') {
        // Safe to call reset now
        await (engineAsRecord.chat as ChatWithReset).reset();
      }
    } catch (error: unknown) {
      logger.warn("Error resetting chat history", { error });
    }
  };

  // Handle error
  const handleError = (error: unknown): void => {
    logger.error("Error occurred", { error });
  };

  // Submit handler - simplified with recommended WebLLM approach
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentEngine = engineRef.current;
    if (!input.trim() || !currentEngine || isGenerating || !modelReady) {
      return;
    }
    
    const userMessage: ChatMessage = { role: 'user', content: input };
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    
    recordUserMessage(input.length);
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsGenerating(true);
    
    const inferenceStartTime = performance.now();
    let firstTokenTime: number | null = null;
    
    try {
      // Track inference start
      updateInferenceStart();
      
      // Format messages for the API
      const chatMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // Updated type for chatOptions
      const chatOptions: webllm.ChatCompletionRequestStreaming = {
        messages: chatMessages,
        stream: true,
        temperature: configRef.current.temperature,
        max_tokens: configRef.current.maxTokens,
        top_p: configRef.current.topP,
        stream_options: {
          include_usage: true,
        }
      };
      
      logger.debug("Sending chat request with options", {
        temperature: configRef.current.temperature,
        max_tokens: configRef.current.maxTokens,
        messageCount: chatMessages.length
      });
      
      // Generate response with streaming
      // Add a retry mechanism for the ModelNotLoadedError case
      let response: AsyncIterable<webllm.ChatCompletionChunk>;
      try {
        response = await currentEngine.chat.completions.create(chatOptions);
      } catch (error: unknown) { // Type the error
        const errorObj = error as Record<string, unknown>;
        if (error && 
            (errorObj.name === "ModelNotLoadedError" || 
             (errorObj.error && (errorObj.error as Record<string, unknown>).name === "ModelNotLoadedError"))) {
          
          logger.warn("ModelNotLoadedError on first attempt, waiting and retrying once");
          
          // Show a waiting message to the user
          setMessages(prev => {
            const updatedMessages = [...prev];
            if (updatedMessages.length > 0) {
              updatedMessages[updatedMessages.length - 1] = {
                ...updatedMessages[updatedMessages.length - 1],
                content: "Model is warming up, please wait..."
              };
            }
            return updatedMessages;
          });
          
          // Wait 5 seconds and retry once
          await new Promise(resolve => setTimeout(resolve, 5000));
          
          // Retry the request
          response = await currentEngine.chat.completions.create(chatOptions);
          logger.info("Retry successful after ModelNotLoadedError");
        } else {
          // Re-throw if it's not a ModelNotLoadedError
          throw error;
        }
      }
      
      // Process streaming response
      const chunks = response;
      let fullResponse = '';
      let usageStats: ChatCompletionUsageStats | null = null;
      
      for await (const chunk of chunks) {
        const content = chunk.choices?.[0]?.delta?.content || '';
        
        // Track first token time
        if (content && fullResponse === '' && !firstTokenTime) {
          firstTokenTime = performance.now();
        }
        
        fullResponse += content;
        
        // Get usage statistics from chunks (recommended approach)
        if (chunk.usage) {
          usageStats = chunk.usage;
        }
        
        // Update UI
        setMessages(prev => {
          const updatedMessages = [...prev];
          if (updatedMessages.length > 0) {
            updatedMessages[updatedMessages.length - 1] = {
              ...updatedMessages[updatedMessages.length - 1],
              content: fullResponse
            };
          }
          return updatedMessages;
        });
      }
      
      // Calculate timings
      const inferenceEndTime = performance.now();
      const totalInferenceTime = inferenceEndTime - inferenceStartTime;
      const tokenLatency = firstTokenTime ? firstTokenTime - inferenceStartTime : 0;
      
      // Record assistant message in stats
      recordAssistantMessage(
        fullResponse.length,
        totalInferenceTime,
        tokenLatency
      );
      
      // Record token usage from streaming stats (recommended approach)
      if (usageStats) {
        trackChatCompletion(usageStats);
        recordTokenUsage(
          usageStats.prompt_tokens || 0,
          usageStats.completion_tokens || 0
        );
      }
      
    } catch (error: unknown) { // Type the error
      // Handle errors with specific attention to ModelNotLoadedError
      handleError(error);
      
      // Determine if this is a ModelNotLoadedError
      const errorObj = error as Record<string, unknown>;
      const isModelNotLoadedError = 
        (error && errorObj.name === 'ModelNotLoadedError') ||
        (typeof error === 'object' && error && (errorObj.error as Record<string, unknown>)?.name === 'ModelNotLoadedError') ||
        (typeof error === 'string' && error.includes('ModelNotLoadedError'));
      
      // Update message with error
      setMessages(prev => {
        if (prev.length < 2) return prev;
        
        const errorMessage = isModelNotLoadedError
          ? "The model is still initializing. Please wait about 10 seconds and try again."
          : `Error: ${error instanceof Error ? error.message : String(error)}`;
        
        return [
          ...prev.slice(0, -1),
          { role: 'assistant', content: errorMessage }
        ];
      });
      
    } finally {
      setIsGenerating(false);
    }
  };

  // Simplified UI with loading progress
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Chat</CardTitle>
          <CardDescription>
            {!engine ? 
              `Loading model (${loadingProgress.toFixed(0)}%)...` : 
              !modelReady ? 
              "Initializing chat interface..." : 
              `Chat with ${config.modelId}`}
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleResetChat}
          disabled={!engine || isGenerating || messages.length <= 1}
        >
          Clear Chat
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col h-[40vh] md:h-[50vh]">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            <ErrorBoundary>
              {messages.slice(1).map((message, i) => (
                <MessageItem key={`${message.role}-${i}`} message={message} />
              ))}
            </ErrorBoundary>
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <Textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={modelReady ? "Type your message..." : "Waiting for model to initialize..."}
              className="resize-none min-h-24 sm:min-h-0"
              disabled={!engine || !modelReady || isGenerating}
            />
            <Button 
              type="submit" 
              disabled={!engine || !modelReady || isGenerating || !input.trim()}
              className="sm:self-end sm:w-24"
            >
              {isGenerating ? "..." : "Send"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(ChatInterface);