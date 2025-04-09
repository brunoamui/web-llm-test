/**
 * Utility functions for exploring JavaScript objects deeply,
 * particularly useful for discovering properties in complex objects
 * like the web-llm engine.
 */

import { Logger } from '@/lib/logger';

// Create a dedicated logger for object exploration
const logger = Logger.getLogger('ObjectExplorer');

export interface LogOptions {
  maxDepth?: number;
  currentDepth?: number;
  includeFunctions?: boolean;
  showSymbols?: boolean;
  indentSize?: number;
  visited?: Set<unknown>;
  filter?: string[];
}

export interface FindOptions {
  maxDepth?: number;
  includeValues?: boolean;
  regex?: boolean;
}

/**
 * Log all properties of an object to the console with customizable depth
 */
export function logObjectProperties(
  obj: unknown,
  options: LogOptions = {}
): void {
  const { filter = [], maxDepth = 2, includeFunctions = false } = options;

  if (obj === null || obj === undefined) {
    logger.info(`Object is ${obj === null ? 'null' : 'undefined'}`);
    return;
  }

  try {
    const visited = new Set<unknown>();

    function makeSafeCopy(value: unknown, depth = 0): unknown {
      if (depth > maxDepth) {
        return '[Max Depth Reached]';
      }

      if (value === null || value === undefined) {
        return value;
      }

      if (typeof value !== 'object' && typeof value !== 'function') {
        return value;
      }
      
      // Skip functions if not explicitly included
      if (typeof value === 'function' && !includeFunctions) {
        return '[Function]';
      }

      if (visited.has(value)) {
        return '[Circular Reference]';
      }

      visited.add(value);

      if (Array.isArray(value)) {
        return value.map(item => makeSafeCopy(item, depth + 1));
      }
      
      // Handle functions that we want to include
      if (typeof value === 'function' && includeFunctions) {
        try {
          const fnProps: Record<string, unknown> = {};
          
          // Add function name and properties
          fnProps['__name'] = value.name || '[Anonymous function]';
          
          // Add function properties
          for (const prop of Object.getOwnPropertyNames(value)) {
            try {
              // Skip some internal properties
              if (['arguments', 'caller', 'prototype', 'length'].includes(prop)) continue;
              
              // First cast to unknown, then to Record<string, unknown> for type safety
              const funcAsUnknown = value as unknown;
              fnProps[prop] = makeSafeCopy((funcAsUnknown as Record<string, unknown>)[prop], depth + 1);
            } catch {
              fnProps[prop] = '[Error accessing function property]';
            }
          }
          
          return fnProps;
        } catch {
          return '[Function with inaccessible properties]';
        }
      }

      const result: Record<string, unknown> = {};
      
      try {
        // First try Object.keys which is safer
        const keys = Object.getOwnPropertyNames(value);
        
        for (const key of keys) {
          // Skip properties that don't match filter if filter is provided
          if (filter.length > 0 && !filter.some(f => key.includes(f))) {
            continue;
          }
          
          try {
            const descriptor = Object.getOwnPropertyDescriptor(value, key);
            
            // Skip non-accessible properties
            if (!descriptor?.enumerable && !includeFunctions) {
              continue;
            }
            
            const val = (value as Record<string, unknown>)[key];
            result[key] = makeSafeCopy(val, depth + 1);
          } catch {
            result[key] = '[Error accessing property]';
          }
        }
      } catch {
        // Fallback for objects where getOwnPropertyNames fails
        try {
          for (const key in value as Record<string, unknown>) {
            if (filter.length > 0 && !filter.some(f => key.includes(f))) {
              continue;
            }
            
            try {
              result[key] = makeSafeCopy((value as Record<string, unknown>)[key], depth + 1);
            } catch {
              result[key] = '[Error accessing property]';
            }
          }
        } catch {
          return '[Object with inaccessible properties]';
        }
      }

      return result;
    }

    const safeOutput = makeSafeCopy(obj);
    logger.debug('Object properties', { properties: safeOutput });
    
  } catch (error) {
    logger.error('Error exploring object', {
      errorType: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Find properties in an object that match a given pattern
 */
export function findProperties(
  obj: unknown,
  pattern: RegExp | string,
  options: FindOptions = {}
): Record<string, unknown> {
  const { maxDepth = 3, includeValues = true, regex = false } = options;
  const results: Record<string, unknown> = {};
  const visited = new Set<unknown>();
  
  const searchPattern = regex 
    ? (typeof pattern === 'string' ? new RegExp(pattern) : pattern)
    : pattern;

  function search(value: unknown, path: string, depth: number): void {
    if (value === null || value === undefined || depth > maxDepth) {
      return;
    }

    if (visited.has(value)) {
      return; // Avoid circular references
    }

    if (typeof value !== 'object' && typeof value !== 'function') {
      return;
    }

    visited.add(value);

    try {
      const keys = typeof value === 'object' 
        ? Object.getOwnPropertyNames(value)
        : [];
      
      for (const key of keys) {
        const newPath = path ? `${path}.${key}` : key;
        const matches = regex
          ? (searchPattern as RegExp).test(key)
          : key.includes(searchPattern as string);
        
        if (matches) {
          if (includeValues) {
            try {
              results[newPath] = (value as Record<string, unknown>)[key];
            } catch {
              results[newPath] = '[Error accessing value]';
            }
          } else {
            results[newPath] = '[Found]';
          }
        }
        
        // Continue recursion
        try {
          if (typeof (value as Record<string, unknown>)[key] === 'object') {
            search((value as Record<string, unknown>)[key], newPath, depth + 1);
          }
        } catch {
          // Skip if we can't access the property
        }
      }
    } catch (err: unknown) { // Specify type for catch clause
      // Skip if we can't enumerate properties
      logger.warn("Could not enumerate properties", { error: err });
    }
  }

  search(obj, '', 0);
  return results;
}

/**
 * Log all properties that match a given pattern with their values
 */
export function logMatchingProperties(
  obj: unknown,
  pattern: string | RegExp,
  options: FindOptions = {}
): void {
  try {
    const matches = findProperties(obj, pattern, options);
    const count = Object.keys(matches).length;
    
    logger.info(`Found ${count} properties matching "${pattern}"`, { matches });
  } catch (error) {
    logger.error('Error searching properties', {
      errorType: error instanceof Error ? error.name : typeof error,
      errorMessage: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

/**
 * Get a property from an object by path safely
 */
export function getPropertyByPath<T = unknown>(obj: unknown, path: string): T | null {
  if (!obj || !path) return null;
  
  try {
    const parts = path.split('.');
    let value: unknown = obj; // Use unknown type initially
    
    for (const part of parts) {
      if (value === null || value === undefined) return null;
      // Use type assertion to access property
      value = (value as Record<string, unknown>)[part];
    }
    
    return value as T;
  } catch (error: unknown) { // Specify type for catch clause
    logger.error(`Error accessing property path ${path}`, { error });
    return null;
  }
}

/**
 * Specialized explorer for web-llm engine objects
 * This focuses only on the most relevant properties for debugging
 */
export function exploreWebLLMEngine(engine: unknown): void { // Use unknown type
  if (!engine) {
    logger.warn("Engine is null or undefined");
    return;
  }
  
  // Use type assertions carefully when accessing properties
  const engineObj = engine as Record<string, unknown>; // Use Record<string, unknown>

  logger.info("=== Web-LLM Engine Explorer ===");
  
  // Check if engine has basic expected interfaces
  const chat = engineObj.chat as Record<string, unknown> | undefined;
  const embeddings = engineObj.embeddings;
  const runtimeStatsText = engineObj.runtimeStatsText;
  
  const hasChatAPI = Boolean(chat && chat.completions);
  const hasEmbeddingAPI = Boolean(embeddings);
  const hasRuntimeStats = typeof runtimeStatsText === 'function';
  
  const apiStatus = {
    chatApi: hasChatAPI,
    embeddingApi: hasEmbeddingAPI,
    runtimeStats: hasRuntimeStats
  };
  
  logger.info("Basic API availability", apiStatus);
  
  // Extract model information directly
  try {
    const loadedPipelines = engineObj.loadedModelIdToPipeline as Record<string, Record<string, unknown>> | undefined;
    if (loadedPipelines && Object.keys(loadedPipelines).length > 0) {
      const modelId = Object.keys(loadedPipelines)[0];
      const pipeline = loadedPipelines[modelId];
      
      logger.info(`Loaded Model: ${modelId}`);
      
      if (pipeline && pipeline.model) {
        const model = pipeline.model as Record<string, unknown>; // Use Record<string, unknown>
        const modelMetadata = {
          vocabularySize: model.vocabSize || 'Unknown',
          hiddenSize: model.hiddenSize || 'Unknown',
          attentionHeads: model.numAttentionHeads || 'Unknown',
          parameters: model.numParameters ? ((model.numParameters as number) / 1000000).toFixed(2) + 'M' : 'Unknown',
          quantization: model.quantization || 'Unknown',
          contextLength: model.contextLength || 'Unknown',
          cacheFormat: model.cacheFormat || 'Unknown'
        };
        
        logger.info("Model Metadata", modelMetadata);
      }
    }
  } catch (e: unknown) { // Specify type for catch clause
    logger.error("Error extracting model information", { error: e });
  }
  
  // Extract chat configuration
  try {
    if (chat && chat.config) {
      // Cast config to Record<string, unknown> for type safety
      const configAsRecord = chat.config as unknown as Record<string, unknown>;
      logger.debug("Chat Configuration", configAsRecord);
    }
  } catch (e: unknown) { // Specify type for catch clause
    logger.error("Error extracting chat configuration", { error: e });
  }
  
  // List available public methods
  try {
    const methods = {
      // Engine methods
      'engine.unload': typeof engineObj.unload === 'function',
      'engine.runtimeStatsText': typeof engineObj.runtimeStatsText === 'function',
      'engine.info': typeof engineObj.info === 'function',
      'engine.prepare': typeof engineObj.prepare === 'function',
      
      // Chat methods
      'engine.chat.completions.create': hasChatAPI && typeof (chat?.completions as Record<string, unknown>)?.create === 'function', // Safe navigation
      'engine.chat.reset': chat && typeof chat.reset === 'function',
      'engine.chat.initialize': chat && typeof chat.initialize === 'function'
    };
    
    logger.debug("Available Public Methods", methods);
  } catch (e: unknown) { // Specify type for catch clause
    logger.error("Error listing methods", { error: e });
  }
  
  // Check for active conversations or state
  try {
    if (chat && chat.history) {
      const historyInfo: Record<string, unknown> = { // Use Record<string, unknown>
        available: Boolean(chat.history)
      };
      
      // Try to get message count if possible
      if (Array.isArray(chat.history)) {
        historyInfo.messageCount = chat.history.length;
      } else if (typeof chat.history === 'object' && chat.history !== null) {
        historyInfo.historyKeys = Object.keys(chat.history);
      }
      
      logger.debug("Chat History", historyInfo);
    }
  } catch (e: unknown) { // Specify type for catch clause
    logger.error("Error checking chat history", { error: e });
  }
}

/**
 * Call this method to get runtime stats from the engine safely
 */
export async function safeGetRuntimeStats(engine: unknown): Promise<string | null> { // Use unknown type
  if (!engine) return null;
  
  const engineObj = engine as Record<string, unknown>; // Use Record<string, unknown>
  
  try {
    // Check if function exists and is callable
    if (typeof engineObj.runtimeStatsText !== 'function') {
      return null;
    }
    
    const stats = await engineObj.runtimeStatsText();
    // Ensure stats is a string before returning
    return typeof stats === 'string' ? stats : null;
  } catch (e: unknown) { // Specify type for catch clause
    logger.error("Error getting runtime stats", { error: e });
    return null;
  }
}