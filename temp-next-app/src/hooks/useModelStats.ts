import { useState, useEffect, useRef, useCallback } from 'react';
// Import specific types from web-llm, removing unused Chat import
import type { MLCEngine } from '@mlc-ai/web-llm';
import { Logger } from '@/lib/logger';
import { logObjectProperties } from '@/lib/objectExplorer';

// Create component logger
const logger = Logger.getLogger('ModelStats');

// Extended interface for MLCEngine with additional properties
interface ExtendedMLCEngineProperties {
  chatModel?: Record<string, unknown>;
  model?: Record<string, unknown>;
  getMemoryUsage?: () => number | { peak: number };
  prepare?: () => Promise<void>;
  _debug?: {
    getMetrics: () => Promise<Record<string, unknown>>;
  };
  _pipelineState?: {
    model: Record<string, unknown>;
  };
}

// Use intersection type for the engine
type EngineWithPossibleExtensions = MLCEngine & ExtendedMLCEngineProperties;

// Type Guard to check if the engine has the getMemoryUsage method
function isEngineWithMemoryUsage(
  engine: MLCEngine | null | undefined
): engine is MLCEngine & { getMemoryUsage: () => number | { peak: number } } {
  return (
    !!engine &&
    typeof (engine as EngineWithPossibleExtensions).getMemoryUsage === 'function'
  );
}

// Define the structure for usage stats based on observed properties
// Export this type
export interface ChatCompletionUsageStats {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  // Use a generic type for system_info since the specific type isn't exported
  system_info?: Record<string, unknown> & { peak_memory?: number };
}

// Add a new state to track usage stats from chat completions
interface UsageStats extends ChatCompletionUsageStats {
  timestamp: number;
}

export interface ModelStats {
  // Download stats
  downloadStats: {
    totalSize: number;
    downloadedSize: number;
    downloadSpeed: number;
    cacheHitRate: number;
    startTime: number;
    endTime: number | null;
  };

  // Token stats
  tokenStats: {
    contextSize: number;
    maxContextSize: number;
    prefillTokens: number;
    decodingTokens: number;
    tokenRate: {
      prefill: number;
      decoding: number;
    };
  };

  // Performance stats
  performanceStats: {
    loadingTime: number;
    inferenceStartTime: number | null;
    lastUpdateTime: number;
    gpuMemoryUsage: number | null;
  };

  // Model metadata (enhanced)
  modelMetadata: {
    modelId: string;
    vocabSize: number | null;
    hiddenSize: number | null;
    attentionHeads: number | null;
    modelParameters: number | null;
    quantization: string | null;
    cacheFormat: string | null;
  };
}

export function useModelStats(engine: MLCEngine | null) {
  const [stats, setStats] = useState<ModelStats>({
    downloadStats: {
      totalSize: 0,
      downloadedSize: 0,
      downloadSpeed: 0,
      cacheHitRate: 0,
      startTime: Date.now(),
      endTime: null,
    },
    tokenStats: {
      contextSize: 0,
      maxContextSize: 0,
      prefillTokens: 0,
      decodingTokens: 0,
      tokenRate: {
        prefill: 0,
        decoding: 0,
      },
    },
    performanceStats: {
      loadingTime: 0,
      inferenceStartTime: null,
      lastUpdateTime: Date.now(),
      gpuMemoryUsage: null,
    },
    modelMetadata: {
      modelId: '',
      vocabSize: null,
      hiddenSize: null,
      attentionHeads: null,
      modelParameters: null,
      quantization: null,
      cacheFormat: null,
    },
  });

  // Track if the engine is ready for operations
  const [engineReady, setEngineReady] = useState<boolean>(false);
  const engineReadyRef = useRef<boolean>(false);

  // Keep references to avoid closure issues
  const statsRef = useRef(stats);
  statsRef.current = stats;
  const engineRef = useRef<MLCEngine | null>(null);
  engineRef.current = engine;

  // Discovery flag to run deep exploration only once
  const explorationRun = useRef(false);

  // Track if stats collection has started to implement delay
  const statsCollectionStarted = useRef<boolean>(false);

  // Add state to track the last usage stats from chat completions
  const lastUsageStatsRef = useRef<UsageStats | null>(null);

  // Enhanced update download progress handler
  const handleProgressUpdate = useCallback(
    (progress: { loaded: number; total: number; progress: number }) => {
      logger.debug('Progress update', progress);
      setStats((prev) => {
        const now = Date.now();
        const timeDiff = (now - prev.downloadStats.startTime) / 1000;
        const downloadSpeed = timeDiff > 0 ? progress.loaded / timeDiff : 0;

        return {
          ...prev,
          downloadStats: {
            ...prev.downloadStats,
            downloadedSize: progress.loaded,
            totalSize: progress.total,
            downloadSpeed,
          },
        };
      });
    },
    []
  );

  // Helper to check if engine is valid and ready for operations
  const isEngineValid = useCallback((currentEngine: MLCEngine | null): boolean => {
    if (!currentEngine) return false;

    // Use safer type assertion
    const engineAny = currentEngine as unknown as Record<string, unknown>;

    // Check if engine has key properties we expect
    const hasRequiredProps =
      typeof engineAny === 'object' &&
      engineAny !== null &&
      (engineAny.chat || engineAny.chatModel || engineAny.model);

    try {
      // If engine has a isReady method, use it
      if (typeof (engineAny as { isReady?: unknown }).isReady === 'function') {
        return (engineAny as { isReady: () => boolean }).isReady();
      }

      // Otherwise just check for basic structure
      return !!hasRequiredProps;
    } catch (e: unknown) {
      logger.warn('Error checking engine validity', { error: e });
      return false;
    }
  }, []);

  // Reset stats when engine changes
  useEffect(() => {
    setEngineReady(false);
    engineReadyRef.current = false;

    if (!engine) return;

    setStats((prev) => ({
      ...prev,
      downloadStats: {
        ...prev.downloadStats,
        startTime: Date.now(),
        endTime: null,
        downloadedSize: 0,
        totalSize: 0,
        downloadSpeed: 0,
      },
    }));

    explorationRun.current = false;

    const checkEngineValidity = async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 100));

        if (isEngineValid(engine)) {
          setEngineReady(true);
          engineReadyRef.current = true;
          logger.info('Engine is ready for statistics collection');
        } else {
          logger.debug('Engine not ready yet, will retry');
          setTimeout(checkEngineValidity, 500);
        }
      } catch (e) {
        logger.warn('Error in engine validity check', { error: e });
      }
    };

    checkEngineValidity();
  }, [engine, isEngineValid]);

  // Update engine stats periodically
  useEffect(() => {
    if (!engine) return;

    const getEngineStats = async () => {
      if (!engineReadyRef.current) {
        logger.debug('Skipping stats collection as engine is not ready');
        return;
      }

      if (!statsCollectionStarted.current) {
        statsCollectionStarted.current = true;
        logger.debug('Delaying initial stats collection to ensure model is ready');
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }

      const currentEngine = engineRef.current as EngineWithPossibleExtensions | null;
      if (!currentEngine || !isEngineValid(currentEngine as MLCEngine)) {
        logger.debug('Engine is no longer valid, skipping stats collection');
        return;
      }

      try {
        if (!explorationRun.current) {
          logger.info('Running deep exploration of engine object');
          explorationRun.current = true;

          logObjectProperties(currentEngine, {
            maxDepth: 3,
            includeFunctions: true,
          });
        }

        let contextSize = 0;
        const maxContextSize = 4096;
        let prefillTokens = 0;
        let decodingTokens = 0;
        let gpuMemoryUsage: number | null = null;

        if (lastUsageStatsRef.current) {
          const usage = lastUsageStatsRef.current;
          logger.debug('Using ChatCompletion usage stats from callback');

          if (usage.prompt_tokens !== undefined) prefillTokens = usage.prompt_tokens;
          if (usage.completion_tokens !== undefined) decodingTokens = usage.completion_tokens;
          if (usage.total_tokens !== undefined) contextSize = usage.total_tokens;

          if (usage.system_info?.peak_memory !== undefined) {
            gpuMemoryUsage = usage.system_info.peak_memory;
          }
        }

        try {
          // Use the type guard to safely check and access getMemoryUsage
          if (isEngineWithMemoryUsage(currentEngine)) {
            const memoryUsage = currentEngine.getMemoryUsage(); // Now type-safe
            if (typeof memoryUsage === 'number') {
              gpuMemoryUsage = memoryUsage;
            } else if (
              typeof memoryUsage === 'object' &&
              memoryUsage !== null &&
              'peak' in memoryUsage &&
              typeof (memoryUsage as { peak: unknown }).peak === 'number'
            ) {
              gpuMemoryUsage = (memoryUsage as { peak: number }).peak;
            }
          } else {
            logger.debug('getMemoryUsage method not found on engine');
          }
        } catch (e: unknown) {
          logger.warn('Error getting memory usage from engine', { error: e });
        }

        setStats((prev) => ({
          ...prev,
          tokenStats: {
            contextSize: contextSize || prev.tokenStats.contextSize,
            maxContextSize: maxContextSize || prev.tokenStats.maxContextSize,
            prefillTokens: prefillTokens || prev.tokenStats.prefillTokens,
            decodingTokens: decodingTokens || prev.tokenStats.decodingTokens,
            tokenRate: prev.tokenStats.tokenRate, // Include tokenRate to match the type
          },
          performanceStats: {
            ...prev.performanceStats,
            lastUpdateTime: Date.now(),
            gpuMemoryUsage: gpuMemoryUsage !== null ? gpuMemoryUsage : prev.performanceStats.gpuMemoryUsage,
          },
        }));
      } catch (error) {
        logger.error('Failed to extract model stats', { error });
      }
    };

    const initialDelay = setTimeout(() => {
      getEngineStats();

      const interval = setInterval(() => {
        getEngineStats();
      }, 2000);

      return () => {
        clearInterval(interval);
      };
    }, 500);

    return () => {
      clearTimeout(initialDelay);
    };
  }, [engine, isEngineValid, lastUsageStatsRef]);

  const updateModelLoadStart = useCallback(() => {
    setStats((prev) => ({
      ...prev,
      downloadStats: {
        ...prev.downloadStats,
        startTime: Date.now(),
        endTime: null,
      },
    }));
  }, []);

  const updateModelLoadComplete = useCallback((loadTimeMs: number, modelId?: string) => {
    setEngineReady(true);
    engineReadyRef.current = true;

    setStats((prev) => ({
      ...prev,
      downloadStats: {
        ...prev.downloadStats,
        endTime: Date.now(),
      },
      performanceStats: {
        ...prev.performanceStats,
        loadingTime: loadTimeMs / 1000,
      },
      modelMetadata: {
        ...prev.modelMetadata,
        modelId: modelId || prev.modelMetadata.modelId,
      },
    }));
  }, []);

  const updateInferenceStart = useCallback(() => {
    setStats((prev) => ({
      ...prev,
      performanceStats: {
        ...prev.performanceStats,
        inferenceStartTime: Date.now(),
      },
      tokenStats: {
        ...prev.tokenStats,
        prefillTokens: 0,
        decodingTokens: 0,
      },
    }));
  }, []);

  const updateModelMetadata = useCallback((metadata: Partial<ModelStats['modelMetadata']>) => {
    setStats((prev) => ({
      ...prev,
      modelMetadata: {
        ...prev.modelMetadata,
        ...metadata,
      },
    }));
  }, []);

  const trackChatCompletion = useCallback((usage: ChatCompletionUsageStats | undefined | null) => {
    if (!usage) return;

    logger.debug('Tracking chat completion usage', { usage });

    const usageWithTimestamp: UsageStats = {
      ...usage,
      timestamp: Date.now(),
    };

    lastUsageStatsRef.current = usageWithTimestamp;

    setStats((prev) => ({
      ...prev,
      tokenStats: {
        ...prev.tokenStats,
        prefillTokens: usage.prompt_tokens ?? prev.tokenStats.prefillTokens,
        decodingTokens: usage.completion_tokens ?? prev.tokenStats.decodingTokens,
        contextSize: usage.total_tokens ?? prev.tokenStats.contextSize,
      },
      performanceStats: {
        ...prev.performanceStats,
        gpuMemoryUsage: usage.system_info?.peak_memory ?? prev.performanceStats.gpuMemoryUsage,
      },
    }));
  }, []);

  return {
    stats,
    engineReady,
    updateModelLoadStart,
    updateModelLoadComplete,
    updateInferenceStart,
    handleProgressUpdate,
    updateModelMetadata,
    trackChatCompletion,
  };
}