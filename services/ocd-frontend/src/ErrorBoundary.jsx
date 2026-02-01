import { useState, useEffect, useCallback } from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { FiAlertTriangle, FiRefreshCw, FiHome, FiClock } from 'react-icons/fi';

const MAX_RETRY_COUNT = 3;
const AUTO_RETRY_DELAY = 5000; // 5 seconds

/**
 * Classify error type for better user messaging
 */
const classifyError = (error) => {
    const message = error?.message?.toLowerCase() || '';

    if (message.includes('network') || message.includes('fetch')) {
        return {
            type: 'network',
            title: 'Connection Problem',
            description: 'Unable to connect to the server. Please check your internet connection.',
            canAutoRetry: true,
        };
    }

    if (message.includes('timeout')) {
        return {
            type: 'timeout',
            title: 'Request Timed Out',
            description: 'The server took too long to respond. Please try again.',
            canAutoRetry: true,
        };
    }

    if (message.includes('chunk') || message.includes('loading')) {
        return {
            type: 'chunk',
            title: 'Loading Error',
            description: 'Failed to load application resources. This may happen after an update.',
            canAutoRetry: true,
        };
    }

    return {
        type: 'unknown',
        title: 'System Encountered an Error',
        description: 'Something unexpected stopped the application. This has been logged.',
        canAutoRetry: false,
    };
};

const ErrorFallback = ({ error, resetErrorBoundary }) => {
    const [retryCount, setRetryCount] = useState(0);
    const [autoRetryCountdown, setAutoRetryCountdown] = useState(0);

    const errorInfo = classifyError(error);
    const canRetry = retryCount < MAX_RETRY_COUNT;

    // Auto-retry countdown for recoverable errors
    useEffect(() => {
        if (!errorInfo.canAutoRetry || !canRetry) return;

        setAutoRetryCountdown(AUTO_RETRY_DELAY / 1000);

        const interval = setInterval(() => {
            setAutoRetryCountdown(prev => {
                if (prev <= 1) {
                    clearInterval(interval);
                    handleRetry();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [retryCount]); // eslint-disable-line react-hooks/exhaustive-deps

    const handleRetry = useCallback(() => {
        setRetryCount(prev => prev + 1);
        resetErrorBoundary();
    }, [resetErrorBoundary]);

    const handleGoHome = useCallback(() => {
        window.location.href = '/';
    }, []);

    return (
        <div
            className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 text-white"
            role="alert"
            aria-live="assertive"
        >
            {/* Glassmorphic Card */}
            <div className="relative max-w-lg w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl overflow-hidden">

                {/* Glow Effect */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse"></div>

                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className="mb-6 p-4 bg-red-500/20 rounded-full border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        <FiAlertTriangle className="w-12 h-12 text-red-500" aria-hidden="true" />
                    </div>

                    <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-3">
                        {errorInfo.title}
                    </h1>

                    <p className="text-gray-300 mb-4 leading-relaxed">
                        {errorInfo.description}
                    </p>

                    {/* Retry info */}
                    {retryCount > 0 && (
                        <p className="text-yellow-400 text-sm mb-4">
                            Retry attempt {retryCount} of {MAX_RETRY_COUNT}
                        </p>
                    )}

                    {/* Auto-retry countdown */}
                    {autoRetryCountdown > 0 && canRetry && (
                        <div className="flex items-center gap-2 text-blue-400 text-sm mb-4">
                            <FiClock className="w-4 h-4 animate-spin" />
                            <span>Auto-retrying in {autoRetryCountdown}s...</span>
                        </div>
                    )}

                    {/* Error Details (Collapsible) */}
                    <details className="w-full mb-6">
                        <summary className="cursor-pointer text-gray-400 text-sm hover:text-gray-300 transition-colors">
                            Show technical details
                        </summary>
                        <div className="mt-2 bg-black/40 rounded-lg p-4 border border-white/10 text-left overflow-auto max-h-32">
                            <code className="text-red-400 font-mono text-sm break-words">
                                {error.message || "Unknown Error"}
                            </code>
                        </div>
                    </details>

                    {/* Actions */}
                    <div className="flex gap-4 w-full">
                        <button
                            onClick={handleRetry}
                            disabled={!canRetry}
                            className={`
                                flex-1 flex items-center justify-center gap-2 font-semibold py-3 px-6 rounded-xl 
                                transition-all duration-300 transform
                                ${canRetry
                                    ? 'bg-white text-black hover:bg-gray-200 hover:scale-[1.02]'
                                    : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                            `}
                            aria-label={canRetry ? 'Try again' : 'Maximum retries exceeded'}
                        >
                            <FiRefreshCw className={`w-4 h-4 ${autoRetryCountdown > 0 ? 'animate-spin' : ''}`} />
                            {canRetry ? 'Try Again' : 'Max Retries'}
                        </button>
                        <button
                            onClick={handleGoHome}
                            className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white font-semibold py-3 px-6 rounded-xl hover:bg-white/10 transition-all duration-300 transform hover:scale-[1.02]"
                            aria-label="Go to home page"
                        >
                            <FiHome className="w-4 h-4" />
                            Go Home
                        </button>
                    </div>

                    {/* Help text for max retries */}
                    {!canRetry && (
                        <p className="text-gray-400 text-sm mt-4">
                            If the problem persists, please try refreshing the page or contact support.
                        </p>
                    )}
                </div>
            </div>
        </div>
    );
};

const ErrorBoundary = ({ children, onError }) => {
    return (
        <ReactErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
                // Clear any cached state that might be causing the error
                sessionStorage.removeItem('lastError');
            }}
            onError={(error, info) => {
                // Store error info for analytics
                sessionStorage.setItem('lastError', JSON.stringify({
                    message: error.message,
                    stack: error.stack?.substring(0, 500),
                    componentStack: info.componentStack?.substring(0, 500),
                    timestamp: new Date().toISOString(),
                }));

                // Log to console in development
                if (import.meta.env.DEV) {
                    console.error("Critical Application Error:", error, info);
                }

                // Call custom error handler if provided
                if (onError) {
                    onError(error, info);
                }
            }}
        >
            {children}
        </ReactErrorBoundary>
    );
};

export default ErrorBoundary;

