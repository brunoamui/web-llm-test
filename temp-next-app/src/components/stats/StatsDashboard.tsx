import { memo, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "../ui/card"
import { Button } from "../ui/button"
import { ModelStats } from './ModelStats'
import { TokenStats } from './TokenStats'
import { useStatCollection } from './StatCollectionProvider'
import type { ModelStats as ModelStatsType } from '../../hooks/useModelStats'
import { Logger } from '@/lib/logger'

// Create component logger
const logger = Logger.getLogger('StatsDashboard');

interface StatsDashboardProps {
  isVisible: boolean
  stats: ModelStatsType
  modelId: string
}

export const StatsDashboard = memo(function StatsDashboard({
  isVisible, stats, modelId
}: StatsDashboardProps) {
  // Get session statistics from the StatCollectionProvider
  const { 
    currentSession, 
    aggregatedStats, 
    sessionHistory, 
    clearSessionHistory,
    startNewSession
  } = useStatCollection();

  // Add logging to see when dashboard renders and with what props
  useEffect(() => {
    logger.debug("Rendering dashboard", { isVisible, modelId });
    logger.debug("Stats data", { stats });
    logger.debug("Session stats", { currentSession });
    logger.debug("Aggregated stats", { aggregatedStats });
  }, [isVisible, stats, modelId, currentSession, aggregatedStats]);

  if (!isVisible) return null;
  
  const { downloadStats, tokenStats, performanceStats, modelMetadata } = stats
  
  // Calculate memory usage in MB
  const memoryUsage = performanceStats.gpuMemoryUsage || 0
  
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
      <ModelStats 
        modelId={modelId}
        downloadStats={downloadStats}
        loadingTime={performanceStats.loadingTime}
        initComplete={downloadStats.endTime !== null}
      />
      
      <TokenStats
        contextSize={tokenStats.contextSize}
        maxContextSize={tokenStats.maxContextSize}
        prefillTokens={tokenStats.prefillTokens}
        decodingTokens={tokenStats.decodingTokens}
        tokenRate={tokenStats.tokenRate}
      />

      {/* Session Statistics Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Current Session</CardTitle>
            <CardDescription>Statistics for your current chat session</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={startNewSession}
          >
            New Session
          </Button>
        </CardHeader>
        <CardContent>
          {currentSession ? (
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>Total Messages</div>
              <div className="text-right">{currentSession.messageCount}</div>
              <div>User Messages</div>
              <div className="text-right">{currentSession.userMessageCount}</div>
              <div>Assistant Messages</div>
              <div className="text-right">{currentSession.assistantMessageCount}</div>
              <div>Prompt Tokens</div>
              <div className="text-right">{currentSession.totalPromptTokens}</div>
              <div>Completion Tokens</div>
              <div className="text-right">{currentSession.totalCompletionTokens}</div>
              <div>Average Response Time</div>
              <div className="text-right">{currentSession.averageResponseTime.toFixed(2)} ms</div>
              <div>Avg. First Token Latency</div>
              <div className="text-right">
                {currentSession.firstTokenLatencies.length > 0
                  ? (currentSession.firstTokenLatencies.reduce((a, b) => a + b, 0) / 
                     currentSession.firstTokenLatencies.length).toFixed(2)
                  : '0'} ms
              </div>
              <div>Session Duration</div>
              <div className="text-right">
                {currentSession.endTime 
                  ? ((currentSession.endTime - currentSession.startTime) / 1000).toFixed(1)
                  : ((Date.now() - currentSession.startTime) / 1000).toFixed(1)} seconds
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              No active session. Start chatting to begin a new session.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Aggregated Statistics Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <div>
            <CardTitle>Historical Stats</CardTitle>
            <CardDescription>Aggregated across all sessions</CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={clearSessionHistory}
            disabled={sessionHistory.length === 0}
          >
            Clear History
          </Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>Total Sessions</div>
            <div className="text-right">{aggregatedStats.totalSessions}</div>
            <div>Total Messages</div>
            <div className="text-right">{aggregatedStats.totalMessages}</div>
            <div>Total Prompt Tokens</div>
            <div className="text-right">{aggregatedStats.totalPromptTokens}</div>
            <div>Total Completion Tokens</div>
            <div className="text-right">{aggregatedStats.totalCompletionTokens}</div>
            <div>Average Response Time</div>
            <div className="text-right">{aggregatedStats.averageResponseTime.toFixed(2)} ms</div>
            <div>Avg. First Token Latency</div>
            <div className="text-right">{aggregatedStats.averageFirstTokenLatency.toFixed(2)} ms</div>
          </div>
        </CardContent>
      </Card>
      
      {/* System Performance Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>System Performance</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <div>GPU Memory Usage</div>
            <div className="text-right">{memoryUsage} MB</div>
            <div>Last Refreshed</div>
            <div className="text-right">
              {new Date(performanceStats.lastUpdateTime).toLocaleTimeString()}
            </div>
            <div>Browser</div>
            <div className="text-right">{typeof navigator !== 'undefined' ? navigator.userAgent.split(' ').slice(-1)[0] : 'Unknown'}</div>
            <div>Platform</div>
            <div className="text-right">{typeof navigator !== 'undefined' ? navigator.platform || 'Unknown' : 'Unknown'}</div>
          </div>
        </CardContent>
      </Card>

      {/* Model Metadata Card */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Model Metadata</CardTitle>
          <CardDescription>Details about the loaded model architecture</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm">
            <div>Model ID</div>
            <div className="text-right md:text-left">{modelMetadata.modelId}</div>
            <div>Vocabulary Size</div>
            <div className="text-right">{modelMetadata.vocabSize || 'Unknown'}</div>
            <div>Hidden Size</div>
            <div className="text-right md:text-left">{modelMetadata.hiddenSize || 'Unknown'}</div>
            <div>Attention Heads</div>
            <div className="text-right">{modelMetadata.attentionHeads || 'Unknown'}</div>
            <div>Parameters</div>
            <div className="text-right md:text-left">
              {modelMetadata.modelParameters 
                ? `${(modelMetadata.modelParameters / 1e9).toFixed(2)}B`
                : 'Unknown'}
            </div>
            <div>Quantization</div>
            <div className="text-right">{modelMetadata.quantization || 'Unknown'}</div>
            <div>Cache Format</div>
            <div className="text-right md:text-left">{modelMetadata.cacheFormat || 'Unknown'}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
})

StatsDashboard.displayName = 'StatsDashboard'