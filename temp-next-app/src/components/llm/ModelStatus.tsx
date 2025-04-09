import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ModelStatus as ModelStatusType } from "@/types/llm";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

interface ModelStatusProps {
  status: ModelStatusType;
  onRetry?: () => void;
}

const ModelStatus = ({ status, onRetry }: ModelStatusProps) => {
  const { isLoading, error, progress } = status;
  
  const formatProgress = (progress?: number): number => {
    if (progress === undefined) return 0;
    // Ensure progress is between 0-100 and rounded to 2 decimal places
    return Math.min(100, Math.max(0, Math.round(progress * 100 * 100) / 100));
  };
  
  const formattedProgress = formatProgress(progress);
  
  // Helper function to display appropriate message based on progress
  const getStatusMessage = (): string => {
    if (error) {
      return `Error: ${error}`;
    }
    
    if (!isLoading) {
      // Check for specific isReady flag for accurate messaging
      if (status.isReady === false) {
        return "Model loaded, initializing chat capabilities...";
      }
      return "Model loaded and ready";
    }
    
    if (formattedProgress <= 0) {
      return "Initializing...";
    }
    
    if (formattedProgress < 10) {
      return "Preparing download...";
    }
    
    if (formattedProgress < 90) {
      return `Downloading model: ${formattedProgress.toFixed(1)}%`;
    }
    
    return "Finalizing model setup...";
  };
  
  // Different background color based on status
  const getCardClassName = (): string => {
    if (error) return "border-red-500 bg-red-50";
    if (!isLoading && status.isReady === true) return "border-green-500 bg-green-50";
    if (!isLoading) return "border-yellow-500 bg-yellow-50"; // Model loaded but not ready
    return "border-yellow-500 bg-yellow-50";
  };

  // Handle WebGPU-specific errors to show more helpful messages
  const isWebGPUError = error && (
    error.includes("WebGPU") || 
    error.includes("Program terminated") ||
    error.includes("ExitStatus") ||
    error.includes("GPU")
  );

  const errorMessage = isWebGPUError 
    ? "WebGPU initialization error. This might be due to GPU compatibility issues or browser limitations." 
    : error;

  const errorTips = isWebGPUError ? [
    "Try reloading the page",
    "Update your graphics drivers",
    "Try a different browser (Chrome 113+ recommended)",
    "Check if WebGPU is enabled in your browser flags",
    "Try a smaller model which requires less GPU memory"
  ] : [];

  return (
    <Card className={`w-full ${getCardClassName()}`}>
      <CardHeader className="pb-2">
        <CardTitle className="flex justify-between items-center text-lg">
          Model Status
          {isWebGPUError && onRetry && (
            <Button 
              onClick={onRetry} 
              size="sm" 
              variant="outline" 
              className="flex items-center gap-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Retry</span>
            </Button>
          )}
        </CardTitle>
        <CardDescription>
          {getStatusMessage()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading && !error && (
          <Progress value={formattedProgress} max={100} className="h-2 w-full" />
        )}
        
        {!isLoading && !error && (
          <div className="flex items-center space-x-2">
            {status.isReady === false ? (
              <>
                <div className="h-2 w-2 rounded-full bg-yellow-500 animate-pulse"></div>
                <span className="text-sm font-medium text-yellow-700">Initializing chat capabilities</span>
              </>
            ) : (
              <>
                <div className="h-2 w-2 rounded-full bg-green-500"></div>
                <span className="text-sm font-medium text-green-700">Ready</span>
              </>
            )}
          </div>
        )}
        
        {error && (
          <div className="space-y-2 text-destructive text-sm">
            <p>{errorMessage}</p>
            
            {isWebGPUError && (
              <>
                <p className="font-semibold mt-2">Try these steps:</p>
                <ul className="list-disc pl-5 space-y-1">
                  {errorTips.map((tip, i) => (
                    <li key={i}>{tip}</li>
                  ))}
                </ul>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ModelStatus;