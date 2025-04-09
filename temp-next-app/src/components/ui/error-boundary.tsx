'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { Logger } from '@/lib/logger';

// Create component logger
const logger = Logger.getLogger('ErrorBoundary');

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onReset?: () => void;
  componentName?: string; // For better error reporting
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * ErrorBoundary component that catches JavaScript errors in its child component tree,
 * logs those errors, and displays a fallback UI.
 */
class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error to our logging service
    const componentName = this.props.componentName || 'Unknown';
    logger.error(`Error in ${componentName}:`, { 
      error, 
      componentStack: errorInfo.componentStack 
    });
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback, componentName } = this.props;

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <Card className="w-full border-destructive/50 bg-destructive/5">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Error in {componentName || 'Component'}</span>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={this.handleReset}
                className="flex items-center gap-1"
              >
                <RefreshCw className="h-4 w-4" />
                <span>Retry</span>
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-destructive text-sm">
              <p>Something went wrong while loading this component.</p>
              {error && (
                <p className="font-mono bg-muted p-2 rounded-md overflow-auto">
                  {error.message}
                </p>
              )}
              <p>Try refreshing the page or clicking the retry button.</p>
            </div>
          </CardContent>
        </Card>
      );
    }

    return children;
  }
}

export { ErrorBoundary };