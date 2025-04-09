import { memo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card"
import { Progress } from "../ui/progress"

interface ModelStatsProps {
  modelId: string
  downloadStats: {
    totalSize: number
    downloadedSize: number
    downloadSpeed: number
    cacheHitRate: number
  }
  loadingTime: number
  initComplete: boolean
}

export const ModelStats = memo(function ModelStats({ 
  modelId, downloadStats, loadingTime, initComplete 
}: ModelStatsProps) {
  // Ensure we don't divide by zero and handle empty values
  const totalSize = downloadStats.totalSize || 1;
  const downloadProgress = Math.round((downloadStats.downloadedSize / totalSize) * 100);
  const downloadedMb = (downloadStats.downloadedSize / (1024 * 1024)).toFixed(2);
  const totalMb = (totalSize / (1024 * 1024)).toFixed(2);
  const speedMbps = (downloadStats.downloadSpeed / (1024 * 1024)).toFixed(2);
  
  // Ensure we have a valid modeling showing and avoid showing "0MB / 0MB"
  const showSizes = downloadStats.totalSize > 0;
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Model Statistics</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Download Progress</span>
            <span>{downloadProgress}%</span>
          </div>
          <Progress value={downloadProgress} />
          <div className="text-xs text-muted-foreground">
            {showSizes ? 
              `${downloadedMb}MB / ${totalMb}MB (${speedMbps}MB/s)` : 
              initComplete ? "Download complete" : "Waiting for download info..."}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>Model ID</div>
          <div className="text-right truncate max-w-[200px]" title={modelId}>
            {modelId || "Loading..."}
          </div>
          {initComplete && (
            <>
              <div>Initial Load Time</div>
              <div className="text-right">{loadingTime > 0 ? `${loadingTime.toFixed(2)}s` : "Calculating..."}</div>
              <div>Cache Hit Rate</div>
              <div className="text-right">{(downloadStats.cacheHitRate * 100).toFixed(1)}%</div>
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
})

ModelStats.displayName = 'ModelStats'