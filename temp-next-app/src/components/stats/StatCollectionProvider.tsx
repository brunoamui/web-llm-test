'use client';

import { createContext, useContext, useState, useCallback, ReactNode, useEffect } from 'react';
import { ModelStats } from '@/hooks/useModelStats';
import { Logger } from '@/lib/logger';

// Create a component logger
const logger = Logger.getLogger('StatCollection');

// Define session statistics interface
export interface SessionStats {
  // Basic session info
  sessionId: string;
  startTime: number;
  endTime: number | null;
  
  // Message counts
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  
  // Token usage for this session
  totalPromptTokens: number;
  totalCompletionTokens: number;
  
  // Performance metrics
  averageResponseTime: number;
  firstTokenLatencies: number[];
}

// Context interface
interface StatCollectionContextType {
  // Current session
  currentSession: SessionStats | null;
  startNewSession: () => void;
  endCurrentSession: () => void;
  
  // Session event tracking
  recordUserMessage: (length: number) => void;
  recordAssistantMessage: (length: number, responseTimeMs: number, firstTokenLatencyMs: number) => void;
  recordTokenUsage: (promptTokens: number, completionTokens: number) => void;
  
  // Historical data
  sessionHistory: SessionStats[];
  clearSessionHistory: () => void;
  
  // Statistics aggregation
  aggregatedStats: {
    totalSessions: number;
    totalMessages: number;
    totalPromptTokens: number;
    totalCompletionTokens: number;
    averageResponseTime: number;
    averageFirstTokenLatency: number;
  };
}

// Create a context with a default value
const StatCollectionContext = createContext<StatCollectionContextType | undefined>(undefined);

// Provider component
export function StatCollectionProvider({ 
  children,
  modelStats
}: { 
  children: ReactNode;
  modelStats: ModelStats | null;
}) {
  // Session state
  const [currentSession, setCurrentSession] = useState<SessionStats | null>(null);
  const [sessionHistory, setSessionHistory] = useState<SessionStats[]>([]);
  
  // Create a new session
  const startNewSession = useCallback(() => {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    // Save current session to history if it exists
    if (currentSession && currentSession.endTime === null) {
      const completedSession = {
        ...currentSession,
        endTime: Date.now()
      };
      
      setSessionHistory(prev => [...prev, completedSession]);
    }
    
    // Create new session
    setCurrentSession({
      sessionId,
      startTime: Date.now(),
      endTime: null,
      messageCount: 0,
      userMessageCount: 0,
      assistantMessageCount: 0,
      totalPromptTokens: 0,
      totalCompletionTokens: 0,
      averageResponseTime: 0,
      firstTokenLatencies: []
    });
    
    logger.info("Started new session", { sessionId });
  }, [currentSession]);
  
  // End current session
  const endCurrentSession = useCallback(() => {
    if (!currentSession) return;
    
    const completedSession = {
      ...currentSession,
      endTime: Date.now()
    };
    
    setCurrentSession(null);
    setSessionHistory(prev => [...prev, completedSession]);
    
    logger.info("Ended session", { sessionId: completedSession.sessionId });
  }, [currentSession]);
  
  // Record a user message
  const recordUserMessage = useCallback((length: number) => {
    if (!currentSession) {
      // Auto-start a session if one doesn't exist
      startNewSession();
      // We'll need to update the new session in the next render cycle
      return;
    }
    
    setCurrentSession(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        messageCount: prev.messageCount + 1,
        userMessageCount: prev.userMessageCount + 1
      };
    });
    
    logger.debug("Recorded user message", { length, sessionId: currentSession.sessionId });
  }, [currentSession, startNewSession]);
  
  // Record an assistant message
  const recordAssistantMessage = useCallback((
    length: number, 
    responseTimeMs: number, 
    firstTokenLatencyMs: number
  ) => {
    if (!currentSession) return;
    
    setCurrentSession(prev => {
      if (!prev) return null;
      
      // Calculate new average response time
      const totalResponseTime = prev.averageResponseTime * prev.assistantMessageCount + responseTimeMs;
      const newAssistantMessageCount = prev.assistantMessageCount + 1;
      const newAverageResponseTime = totalResponseTime / newAssistantMessageCount;
      
      return {
        ...prev,
        messageCount: prev.messageCount + 1,
        assistantMessageCount: newAssistantMessageCount,
        averageResponseTime: newAverageResponseTime,
        firstTokenLatencies: [...prev.firstTokenLatencies, firstTokenLatencyMs]
      };
    });
    
    logger.debug("Recorded assistant message", { 
      length, 
      responseTimeMs, 
      firstTokenLatencyMs,
      sessionId: currentSession.sessionId
    });
  }, [currentSession]);
  
  // Record token usage
  const recordTokenUsage = useCallback((promptTokens: number, completionTokens: number) => {
    if (!currentSession) return;
    
    setCurrentSession(prev => {
      if (!prev) return null;
      
      return {
        ...prev,
        totalPromptTokens: prev.totalPromptTokens + promptTokens,
        totalCompletionTokens: prev.totalCompletionTokens + completionTokens
      };
    });
    
    logger.debug("Recorded token usage", {
      promptTokens,
      completionTokens,
      sessionId: currentSession.sessionId,
      total: promptTokens + completionTokens
    });
  }, [currentSession]);
  
  // Clear session history
  const clearSessionHistory = useCallback(() => {
    setSessionHistory([]);
    logger.info("Cleared session history", { 
      sessionsCleared: sessionHistory.length 
    });
  }, [sessionHistory.length]);
  
  // Monitor modelStats for token usage updates
  useEffect(() => {
    // Only proceed if we have model stats and an active session
    if (!modelStats || !currentSession) return;
    
    // Get token counts from model stats
    const { prefillTokens, decodingTokens } = modelStats.tokenStats;
    
    // Only update if values are meaningful AND different from current values
    if ((prefillTokens > 0 || decodingTokens > 0) && 
        (prefillTokens > currentSession.totalPromptTokens || 
         decodingTokens > currentSession.totalCompletionTokens)) {
      
      logger.debug("Updating from model stats", { 
        prefillTokens, 
        decodingTokens,
        sessionId: currentSession.sessionId
      });
      
      // Update current session with latest token counts
      setCurrentSession(prev => {
        if (!prev) return null;
        
        // Only update if the new values are actually different
        if (prefillTokens <= prev.totalPromptTokens && 
            decodingTokens <= prev.totalCompletionTokens) {
          return prev; // Return the same object to prevent re-render
        }
        
        return {
          ...prev,
          totalPromptTokens: Math.max(prev.totalPromptTokens, prefillTokens),
          totalCompletionTokens: Math.max(prev.totalCompletionTokens, decodingTokens)
        };
      });
    }
  }, [currentSession, modelStats]);
  
  // Calculate aggregated statistics
  const aggregatedStats = {
    totalSessions: sessionHistory.length + (currentSession ? 1 : 0),
    totalMessages: sessionHistory.reduce((sum, session) => sum + session.messageCount, 0) + 
                  (currentSession?.messageCount || 0),
    totalPromptTokens: sessionHistory.reduce((sum, session) => sum + session.totalPromptTokens, 0) + 
                      (currentSession?.totalPromptTokens || 0),
    totalCompletionTokens: sessionHistory.reduce((sum, session) => sum + session.totalCompletionTokens, 0) + 
                          (currentSession?.totalCompletionTokens || 0),
    averageResponseTime: calculateAverageResponseTime(sessionHistory, currentSession),
    averageFirstTokenLatency: calculateAverageFirstTokenLatency(sessionHistory, currentSession)
  };
  
  // Context value
  const contextValue: StatCollectionContextType = {
    currentSession,
    startNewSession,
    endCurrentSession,
    recordUserMessage,
    recordAssistantMessage,
    recordTokenUsage,
    sessionHistory,
    clearSessionHistory,
    aggregatedStats
  };

  return (
    <StatCollectionContext.Provider value={contextValue}>
      {children}
    </StatCollectionContext.Provider>
  );
}

// Helper function to calculate average response time
function calculateAverageResponseTime(sessions: SessionStats[], current: SessionStats | null): number {
  const allSessions = [...sessions];
  if (current) allSessions.push(current);
  
  if (allSessions.length === 0) return 0;
  
  const totalResponseTimes = allSessions.reduce(
    (sum, session) => sum + session.averageResponseTime * session.assistantMessageCount, 
    0
  );
  
  const totalMessages = allSessions.reduce(
    (sum, session) => sum + session.assistantMessageCount, 
    0
  );
  
  if (totalMessages === 0) return 0;
  
  return totalResponseTimes / totalMessages;
}

// Helper function to calculate average first token latency
function calculateAverageFirstTokenLatency(sessions: SessionStats[], current: SessionStats | null): number {
  const allSessions = [...sessions];
  if (current) allSessions.push(current);
  
  if (allSessions.length === 0) return 0;
  
  // Collect all latencies
  const allLatencies: number[] = [];
  
  for (const session of allSessions) {
    allLatencies.push(...session.firstTokenLatencies);
  }
  
  if (allLatencies.length === 0) return 0;
  
  const sum = allLatencies.reduce((total, latency) => total + latency, 0);
  return sum / allLatencies.length;
}

// Custom hook for using the context
export function useStatCollection() {
  const context = useContext(StatCollectionContext);
  
  if (context === undefined) {
    throw new Error('useStatCollection must be used within a StatCollectionProvider');
  }
  
  return context;
}