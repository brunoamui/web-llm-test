'use client';

import { Card, CardContent, CardDescription } from '@/components/ui/card';
import { ModelStatus as ModelStatusType } from '@/types/llm';

export default function ModelStatus({ status }: { status: ModelStatusType }) {
  if (!status.isLoading && !status.error) {
    return null;
  }

  return (
    <Card className={`w-full ${status.error ? 'bg-destructive/10' : 'bg-primary/10'}`}>
      <CardContent className="pt-6">
        {status.isLoading && (
          <div className="flex flex-col items-center gap-2">
            <div className="flex items-center gap-2">
              <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary"></div>
              <p className="text-sm font-medium">
                Loading model...
              </p>
            </div>
            {status.progress !== undefined && (
              <div className="w-full bg-secondary rounded-full h-2.5">
                <div 
                  className="bg-primary h-2.5 rounded-full" 
                  style={{ width: `${Math.max(5, Math.min(100, status.progress * 100))}%` }}
                ></div>
              </div>
            )}
            <CardDescription>
              This may take a while on first load as the model is being downloaded
            </CardDescription>
          </div>
        )}
        
        {status.error && (
          <div className="flex flex-col gap-2">
            <p className="font-semibold text-destructive">Error</p>
            <p className="text-sm">{status.error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}