'use client';

import { useState, useRef, useEffect, memo } from 'react';
import * as webllm from '@mlc-ai/web-llm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatMessage, ModelConfig, ModelStatus } from '@/types/llm';
import { useModelStats } from '@/hooks/useModelStats';
import { logObjectProperties } from '@/lib/objectExplorer';
import { useStatCollection } from '@/components/stats/StatCollectionProvider';
import { Logger } from '@/lib/logger';

type MLCEngine = webllm.MLCEngine;
type InitProgressReport = webllm.InitProgressReport;

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
  onStatsUpdate
}: {
  config: ModelConfig;
  onStatusChange: (status: ModelStatus) => void;
  onStatsUpdate: (stats: any) => void;
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Flag to track engine disposal
  const engineDisposingRef = useRef<boolean>(false);
  
  // New: Track if the engine is fully initialized and ready for chat
  const [engineInitialized, setEngineInitialized] = useState<boolean>(false);
  
  // Use refs to track previous state/props without triggering re-renders
  const prevModelIdRef = useRef<string>(config.modelId);
  const engineRef = useRef<MLCEngine | null>(null);
  const configRef = useRef<ModelConfig>(config);
  
  // Initialize model stats tracking with enhanced capabilities
  const { 
    stats, 
    engineReady,  // From the updated hook
    updateModelLoadStart, 
    updateModelLoadComplete, 
    updateInferenceStart, 
    handleProgressUpdate,
    updateModelMetadata,
    trackChatCompletion
  } = useModelStats(engine);
  
  // Get session tracking capabilities from the StatCollectionProvider
  const {
    currentSession,
    startNewSession,
    endCurrentSession,
    recordUserMessage,
    recordAssistantMessage,
    recordTokenUsage
  } = useStatCollection();
  
  // Pass stats to parent component when they change
  useEffect(() => {
    logger.info("Stats updated", { stats });
    onStatsUpdate(stats);
  }, [stats, onStatsUpdate]);
  
  // Update refs when their values change
  useEffect(() => {
    engineRef.current = engine;
    configRef.current = config;
  }, [engine, config]);

  // Safe unload function that handles errors and sets flags
  const safeUnloadEngine = async (engineToUnload: MLCEngine | null) => {
    if (!engineToUnload) return;
    
    try {
      logger.info("Safely unloading engine...");
      engineDisposingRef.current = true;
      await engineToUnload.unload();
    } catch (error) {
      logger.error("Error unloading engine", { error });
    } finally {
      engineDisposingRef.current = false;
    }
  };
  
  // New: Track when engine is initialized and ready
  useEffect(() => {
    if (engine && engineReady) {
      setEngineInitialized(true);
      
      // Test that the engine is truly ready by calling a simple API
      const verifyEngine = async () => {
        try {
          logger.debug("Verifying engine initialization...");
          
          // Test if chat completions API is available
          if (engine.chat && engine.chat.completions) {
            logger.debug("Engine chat completions API is available");
            
            // Try getting engine information if possible
            try {
              if (typeof engine.info === 'function') {
                const info = await engine.info();
                logger.debug("Engine info", { info });
              }
            } catch (e) {
              logger.warn("Engine info not available", { error: e });
            }
          } else {
            logger.warn("Engine ready but chat completions API not found");
          }
        } catch (e) {
          logger.error("Engine verification failed", { error: e });
          setEngineInitialized(false);
        }
      };
      
      verifyEngine();
    } else {
      setEngineInitialized(false);
    }
  }, [engine, engineReady]);

  // Start a new session when the model changes
  useEffect(() => {
    if (prevModelIdRef.current !== config.modelId) {
      // End the current session if it exists
      endCurrentSession();
    }
  }, [config.modelId, endCurrentSession]);

  // Split engine initialization effect to reduce dependencies
  useEffect(() => {
    let isMounted = true;
    let downloadTimeout: NodeJS.Timeout | null = null;
    
    // Only initialize engine if model ID has changed
    if (prevModelIdRef.current !== config.modelId) {
      const initEngine = async () => {
        try {
          // Report loading status
          onStatusChange({ isLoading: true });
          
          // Start tracking model loading
          updateModelLoadStart();
          
          // Reset engine state
          setEngine(null);
          setEngineInitialized(false);
          
          // Cleanup the previous engine if it exists
          // Important: await this operation to ensure complete cleanup before creating a new engine
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
          
          // Verify WebGPU support
          if (typeof navigator !== 'undefined' && !('gpu' in navigator)) {
            throw new Error("WebGPU is not supported in this browser. Please try a browser that supports WebGPU, such as Chrome 113+.");
          }

          logger.info(`Creating engine for model: ${config.modelId}`);
          
          // Create a new engine with the selected model
          const newEngine = await webllm.CreateMLCEngine(
            config.modelId,
            {
              // Progress callback with enhanced logging
              initProgressCallback: (report: InitProgressReport) => {
                if (isMounted) {
                  // Log detailed progress information
                  logger.debug("Download progress", {
                    progress: report.progress,
                    loaded: report.loaded,
                    total: report.total,
                    text: report.text,
                    timeStamp: new Date().toISOString()
                  });
                  
                  // If we're getting progress updates, the download isn't stalled
                  if (downloadTimeout) {
                    clearTimeout(downloadTimeout);
                    // Reset the timeout to give more time
                    downloadTimeout = setTimeout(() => {
                      if (isMounted) {
                        logger.warn("Download timeout reached after progress");
                        onStatusChange({
                          isLoading: false,
                          error: "Download stalled. Please try again or check your network connection."
                        });
                      }
                    }, 120000);
                  }
                  
                  onStatusChange({
                    isLoading: true,
                    progress: report.progress,
                  });
                  
                  // Update download progress stats with enhanced data
                  handleProgressUpdate({
                    loaded: report.loaded || 0,
                    total: report.total || 0,
                    progress: report.progress || 0
                  });
                }
              },
              // Enable cache if available - this helps with download statistics
              useCache: true,
            }
          );
          
          // Clear the timeout now that download is complete
          if (downloadTimeout) {
            clearTimeout(downloadTimeout);
            downloadTimeout = null;
          }
          
          const endTime = performance.now();
          
          if (isMounted) {
            logger.info("Model loaded successfully", { 
              timeSeconds: (endTime - startTime) / 1000, 
              modelId: config.modelId
            });
            
            // Explore the engine object for available metadata right after loading
            logger.debug("Exploring newly created engine");
            logObjectProperties(newEngine, { maxDepth: 2 });
            
            // Add explicit initialization check to confirm chat API is ready
            const initializeChat = async () => {
              try {
                // Explicitly initialize the chat module if needed
                if (newEngine.chat && typeof newEngine.chat.initialize === 'function') {
                  await newEngine.chat.initialize();
                  logger.debug("Chat interface explicitly initialized");
                }
                
                // Some models need to be 'prepared' before use
                if (typeof newEngine.prepare === 'function') {
                  await newEngine.prepare();
                  logger.debug("Engine prepared for use");
                }
                
                // Try to extract model info directly after loading
                try {
                  // Check if model info is available in the engine
                  if (newEngine.chat && newEngine.chat.model) {
                    const modelInfo = newEngine.chat.model;
                    logger.debug("Model info from chat.model", { modelInfo });
                    
                    // Extract metadata if available
                    if (typeof modelInfo === 'object') {
                      updateModelMetadata({
                        modelId: config.modelId,
                        vocabSize: modelInfo.vocabSize || null,
                        hiddenSize: modelInfo.hiddenSize || null,
                        attentionHeads: modelInfo.numAttentionHeads || null,
                        quantization: modelInfo.quantization || null
                      });
                    }
                  }
                  
                  // Try accessing model info through pipeline (alternative path)
                  if (newEngine.loadedModelIdToPipeline && newEngine.loadedModelIdToPipeline[config.modelId]) {
                    const pipeline = newEngine.loadedModelIdToPipeline[config.modelId];
                    if (pipeline.model) {
                      logger.debug("Model info from pipeline", { model: pipeline.model });
                      
                      updateModelMetadata({
                        modelId: config.modelId,
                        vocabSize: pipeline.model.vocabSize || null, 
                        hiddenSize: pipeline.model.hiddenSize || null,
                        attentionHeads: pipeline.model.numAttentionHeads || null,
                        modelParameters: pipeline.model.numParameters || null,
                        quantization: pipeline.model.quantization || null,
                        cacheFormat: pipeline.model.cacheFormat || null
                      });
                    }
                  }
                } catch (metadataError) {
                  logger.error("Error extracting model metadata", { error: metadataError });
                }
                
                // Start a new session
                startNewSession();
                
                // Important: Store the engine reference before setting state
                // This ensures the ref is updated before any re-renders that might use it
                engineRef.current = newEngine;
                setEngine(newEngine);
                onStatusChange({ isLoading: false });
                
                // Clear previous messages when changing models
                setMessages([{ role: 'system', content: 'You are a helpful AI assistant.' }]);
                
                // Update model load complete stats with model ID
                updateModelLoadComplete(endTime - startTime, config.modelId);
              } catch (initError) {
                logger.error("Error initializing chat interface", { error: initError });
                onStatusChange({ 
                  isLoading: false,
                  error: `Error initializing chat interface: ${initError instanceof Error ? initError.message : String(initError)}`
                });
                
                // Clean up the engine if initialization fails
                if (newEngine) {
                  try {
                    await newEngine.unload();
                  } catch (e) {
                    logger.error("Error unloading after initialization failure", { error: e });
                  }
                }
              }
            };
            
            // Start initialization
            initializeChat();
          }
        } catch (error) {
          logger.error("Error initializing Web-LLM", { error });
          if (isMounted) {
            // Clear the timeout if it exists
            if (downloadTimeout) {
              clearTimeout(downloadTimeout);
              downloadTimeout = null;
            }
            
            // Make sure engine is null on error
            setEngine(null);
            engineRef.current = null;
            setEngineInitialized(false);
            
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
    
    // Cleanup function for mounting/unmounting, not for every dependency change
    return () => {
      isMounted = false;
      if (downloadTimeout) {
        clearTimeout(downloadTimeout);
      }
    };
  }, [config.modelId, onStatusChange, updateModelLoadStart, updateModelLoadComplete, handleProgressUpdate, updateModelMetadata, startNewSession, endCurrentSession]); 
  
  // Separate cleanup effect that runs only on unmount
  useEffect(() => {
    return () => {
      // End the current session
      endCurrentSession();
      
      // Cleanup engine on component unmount
      if (engineRef.current) {
        safeUnloadEngine(engineRef.current);
      }
    };
  }, [endCurrentSession]); // Add endCurrentSession to dependencies
  
  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Function to clear chat and reset session
  const handleResetChat = async () => {
    // Prevent clearing chat while generating
    if (isGenerating) return;
    
    // End the current session
    endCurrentSession();
    
    // Start a new session
    startNewSession();
    
    // Reset messages
    setMessages([{ role: 'system', content: 'You are a helpful AI assistant.' }]);
    
    // Manually clear conversation history in the engine if possible
    // This helps prevent the "Module has already been disposed" error
    try {
      const currentEngine = engineRef.current;
      if (currentEngine && currentEngine.chat && typeof currentEngine.chat.reset === 'function') {
        await currentEngine.chat.reset();
        logger.info("Successfully reset chat history in engine");
      }
    } catch (error) {
      logger.warn("Error resetting chat history in engine", { error });
      // No need to throw - this is just an optimization attempt
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Get the current engine from ref to avoid any race conditions
    const currentEngine = engineRef.current;
    
    // Add check for engine initialized state
    if (!input.trim() || !currentEngine || isGenerating || engineDisposingRef.current || !engineInitialized) {
      logger.debug("Cannot generate", {
        inputEmpty: !input.trim(),
        engineMissing: !currentEngine,
        alreadyGenerating: isGenerating,
        engineDisposing: engineDisposingRef.current,
        engineNotInitialized: !engineInitialized
      });
      return;
    }
    
    const userMessage: ChatMessage = { role: 'user', content: input };
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    
    // Record user message in session stats
    recordUserMessage(input.length);
    
    // Batch state updates together
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsGenerating(true);
    
    // Track timestamps for performance measurement
    const inferenceStartTime = performance.now();
    let firstTokenTime: number | null = null;
    
    try {
      // Verify engine is still valid before proceeding
      if (!currentEngine || engineDisposingRef.current) {
        throw new Error("Engine is no longer available");
      }
      
      // Track inference start time
      updateInferenceStart();
      
      // Prepare chat messages in the format expected by web-llm
      const chatMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Check if completions API exists
      if (!currentEngine.chat || !currentEngine.chat.completions) {
        throw new Error("Chat completions API not available on this engine");
      }
      
      logger.info("Sending chat request", { 
        messageCount: chatMessages.length,
        modelId: config.modelId 
      });

      // Use streaming API with correct property names for the web-llm API
      // Include usage statistics in the request options
      const chunks = await currentEngine.chat.completions.create({
        messages: chatMessages,
        stream: true,
        temperature: configRef.current.temperature,
        max_tokens: configRef.current.maxTokens,
        top_p: configRef.current.topP,
        repetition_penalty: configRef.current.repetitionPenalty, // Add this even if not supported by all models
        stream_options: {
          include_usage: true, // Request usage statistics if supported
          include_timestamps: true // Request timing information if supported
        }
      });

      // Process the streaming response
      let fullResponse = '';
      let usageStats = null;
      
      for await (const chunk of chunks) {
        // Verify engine is still valid during streaming
        if (engineDisposingRef.current) {
          logger.warn("Engine is being disposed, stopping stream processing");
          break;
        }
        
        const content = chunk.choices[0]?.delta?.content || '';
        
        // Record time to first token
        if (content && fullResponse === '' && !firstTokenTime) {
          firstTokenTime = performance.now();
          logger.debug("Time to first token", { 
            milliseconds: firstTokenTime - inferenceStartTime 
          });
        }
        
        fullResponse += content;
        
        // Capture usage statistics if available in the chunk
        if (chunk.usage) {
          usageStats = chunk.usage;
          logger.debug("Usage stats from chunk", { usage: usageStats });
        }
        
        // Use functional updates for state that depends on previous state
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
      
      // Calculate total inference time
      const inferenceEndTime = performance.now();
      const totalInferenceTime = inferenceEndTime - inferenceStartTime;
      const firstTokenLatency = firstTokenTime ? firstTokenTime - inferenceStartTime : 0;
      
      logger.debug("Total inference time", { 
        milliseconds: totalInferenceTime,
        firstTokenLatency: firstTokenLatency
      });
      
      // Record assistant message in session stats
      recordAssistantMessage(
        fullResponse.length,
        totalInferenceTime,
        firstTokenLatency
      );
      
      // Try to get final usage statistics from the engine
      try {
        // Skip stats collection if engine is being disposed
        if (engineDisposingRef.current) return;
        
        // If we don't have usage stats from chunks, try to get them from the engine
        if (!usageStats && currentEngine.chat && currentEngine.chat.usage) {
          usageStats = currentEngine.chat.usage;
          logger.debug("Usage stats from engine.chat.usage", { usage: usageStats });
        }
        
        // Get runtime stats for additional information - only if engine is still valid
        if (currentEngine.runtimeStatsText && typeof currentEngine.runtimeStatsText === 'function' && engineInitialized) {
          try {
            let runtimeStats = await currentEngine.runtimeStatsText();
            logger.debug("Runtime stats after completion", { stats: runtimeStats });
          } catch (e) {
            logger.warn("Error getting runtime stats", { error: e });
          }
        }
        
        // Update the usage statistics in our stats tracker
        if (usageStats) {
          trackChatCompletion(usageStats);
          
          // Update session token usage stats
          recordTokenUsage(
            usageStats.prompt_tokens || 0,
            usageStats.completion_tokens || 0
          );
        }
      } catch (statsError) {
        logger.warn("Error getting usage statistics", { error: statsError });
      }
      
    } catch (error) {
      logger.error("Error generating response", { error });
      // Use functional update
      setMessages(prev => {
        // Make sure we have at least the user's message
        if (prev.length < 2) return prev;
        
        return [
          ...prev.slice(0, -1), // Remove the empty assistant message
          {
            role: 'assistant',
            content: `Error generating response: ${error instanceof Error ? error.message : String(error)}`
          }
        ];
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Update the JSX to show engine status
  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div>
          <CardTitle>Chat</CardTitle>
          <CardDescription>
            {engineInitialized 
              ? `Interact with ${stats.modelMetadata.modelId || config.modelId}` 
              : "Initializing model..."}
          </CardDescription>
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleResetChat}
          disabled={!engine || !engineInitialized || isGenerating || messages.length <= 1}
        >
          Clear Chat
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col h-[40vh] md:h-[50vh]">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.slice(1).map((message, i) => (
              <MessageItem key={`${message.role}-${i}`} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <Textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={engineInitialized 
                ? "Type your message..." 
                : "Waiting for model to initialize..."}
              className="resize-none min-h-24 sm:min-h-0"
              disabled={!engine || !engineInitialized || isGenerating}
            />
            <Button 
              type="submit" 
              disabled={!engine || !engineInitialized || isGenerating || !input.trim() || engineDisposingRef.current}
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