import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { AlertTriangle, RefreshCw, Home, ArrowLeft, Bug } from 'lucide-react-native';
import { theme } from '../../lib/theme';
import tw from 'twrnc';
import Button from './Button';
import { Card, CardContent, CardHeader, CardTitle } from './Card';
import { logger } from '../../lib/logger';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
  lastErrorTime: number;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: React.ComponentType<{
    error: Error;
    errorInfo?: React.ErrorInfo;
    retryError: () => void;
    resetError: () => void;
  }>;
  maxRetries?: number;
  retryDelay?: number;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  private retryTimeout?: NodeJS.Timeout;

  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      retryCount: 0,
      lastErrorTime: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
      lastErrorTime: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('ErrorBoundary caught an error:', error, errorInfo);

    // Call custom error handler if provided
    this.props.onError?.(error, errorInfo);

    // Log to external service in production
    if (__DEV__ === false) {
      // TODO: Add error reporting service (Sentry, LogRocket, etc.)
      logger.error('Production error:', {
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });
    }
  }

  componentWillUnmount() {
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }
  }

  retryError = () => {
    const { maxRetries = 3, retryDelay = 1000 } = this.props;
    const { retryCount } = this.state;

    if (retryCount >= maxRetries) {
      logger.error('Max retries exceeded');
      return;
    }

    logger.log(`Retrying... Attempt ${retryCount + 1}/${maxRetries}`);

    this.setState((prev) => ({
      retryCount: prev.retryCount + 1,
      hasError: false,
      error: undefined,
      errorInfo: undefined,
    }));

    // Clear any existing timeout
    if (this.retryTimeout) {
      clearTimeout(this.retryTimeout);
    }

    // Add delay before retry
    this.retryTimeout = setTimeout(() => {
      this.forceUpdate();
    }, retryDelay);
  };

  resetError = () => {
    this.setState({
      hasError: false,
      error: undefined,
      errorInfo: undefined,
      retryCount: 0,
      lastErrorTime: 0,
    });
  };

  render() {
    if (this.state.hasError) {
      const { fallback: FallbackComponent } = this.props;

      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={this.state.error!}
            errorInfo={this.state.errorInfo}
            retryError={this.retryError}
            resetError={this.resetError}
          />
        );
      }

      return (
        <DefaultErrorFallback
          error={this.state.error!}
          errorInfo={this.state.errorInfo}
          retryCount={this.state.retryCount}
          maxRetries={this.props.maxRetries || 3}
          onRetry={this.retryError}
          onReset={this.resetError}
        />
      );
    }

    return this.props.children;
  }
}

interface DefaultErrorFallbackProps {
  error: Error;
  errorInfo?: React.ErrorInfo;
  retryCount: number;
  maxRetries: number;
  onRetry: () => void;
  onReset: () => void;
}

function DefaultErrorFallback({
  error,
  errorInfo,
  retryCount,
  maxRetries,
  onRetry,
  onReset,
}: DefaultErrorFallbackProps) {
  return (
    <View style={[tw`flex-1 justify-center items-center p-6`, { backgroundColor: theme.colors.background }]}>
      <Card style={tw`w-full max-w-md`}>
        <CardHeader>
          <View style={tw`flex-row items-center justify-center mb-4`}>
            <AlertTriangle size={48} color={theme.colors.destructive} />
          </View>
          <Text style={[tw`text-lg font-semibold text-center mb-2`, { color: theme.colors.foreground }]}>
            Something went wrong
          </Text>
          <Text style={[tw`text-sm text-center mb-6`, { color: theme.colors.mutedForeground }]}>
            We&apos;re sorry, but something unexpected happened. Please try again.
          </Text>
        </CardHeader>
        <CardContent style={tw`space-y-4`}>
          <Text style={[tw`text-center text-sm`, { color: theme.colors.mutedForeground }]}>
            An unexpected error occurred. We&apos;re sorry for the inconvenience.
          </Text>

          {__DEV__ && (
            <ScrollView style={tw`max-h-32`}>
              <Text style={[tw`text-xs font-mono`, { color: theme.colors.mutedForeground }]}>
                {error.message}
              </Text>
              {errorInfo?.componentStack && (
                <Text style={[tw`text-xs font-mono mt-2`, { color: theme.colors.mutedForeground }]}>
                  {errorInfo.componentStack}
                </Text>
              )}
            </ScrollView>
          )}

          <View style={tw`space-y-2`}>
            {retryCount < maxRetries && (
              <Button onPress={onRetry} style={tw`w-full`}>
                <RefreshCw size={16} style={tw`mr-2`} />
                Try Again ({retryCount + 1}/{maxRetries})
              </Button>
            )}
            <Button variant="outline" onPress={onReset} style={tw`w-full`}>
              Reset
            </Button>
          </View>
        </CardContent>
      </Card>
    </View>
  );
}

export function useErrorHandler() {
  return {
    handleError: (error: Error, errorInfo?: React.ErrorInfo) => {
      logger.error('Error handled by useErrorHandler:', error, errorInfo);
      // Add any additional error handling logic here
    },
  };
} 