import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"

interface TokenStatsProps {
  contextSize: number
  maxContextSize: number
  prefillTokens: number
  decodingTokens: number
  tokenRate: {
    prefill: number // tokens per second
    decoding: number // tokens per second
  }
}

export const TokenStats = memo(function TokenStats({
  contextSize, maxContextSize, prefillTokens, decodingTokens, tokenRate
}: TokenStatsProps) {
  // Ensure we don't divide by zero
  const safeMaxContextSize = maxContextSize || 4096; // Default to 4096 if not provided
  const contextUsagePercent = Math.round((contextSize / safeMaxContextSize) * 100);
  const totalTokens = prefillTokens + decodingTokens;
  
  // Format token rates with proper handling of small/null values
  const formatTokenRate = (rate: number) => {
    if (rate === null || rate === undefined) return "0.00";
    if (rate < 0.01) return "<0.01";
    return rate.toFixed(2);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Token Usage</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Context Window Usage</span>
            <span>{contextUsagePercent}%</span>
          </div>
          <Progress value={contextUsagePercent} />
          <div className="text-xs text-muted-foreground">
            {contextSize} / {safeMaxContextSize} tokens
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Prefill Tokens</div>
          <div className="text-right">{prefillTokens || 0}</div>
          <div>Generated Tokens</div>
          <div className="text-right">{decodingTokens || 0}</div>
          <div>Prefill Speed</div>
          <div className="text-right">{formatTokenRate(tokenRate.prefill)} t/s</div>
          <div>Decode Speed</div>
          <div className="text-right">{formatTokenRate(tokenRate.decoding)} t/s</div>
          <div className="font-medium">Total Tokens</div>
          <div className="text-right font-medium">{totalTokens}</div>
        </div>
      </CardContent>
    </Card>
  )
})

TokenStats.displayName = 'TokenStats'