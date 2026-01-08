/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in child components and displays a fallback UI
 */
import React, { Component } from 'react';
import { ExclamationTriangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

class ErrorBoundary extends Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        this.setState({ error, errorInfo });
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleReset = () => {
        this.setState({ hasError: false, error: null, errorInfo: null });
    };

    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-[400px] flex items-center justify-center p-8">
                    <div className="text-center max-w-md">
                        <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/10 flex items-center justify-center">
                            <ExclamationTriangleIcon className="w-8 h-8 text-red-500" />
                        </div>
                        <h2 className="text-xl font-bold text-white mb-2">Something went wrong</h2>
                        <p className="text-gray-400 text-sm mb-6">
                            {this.props.fallbackMessage || 'An unexpected error occurred. Please try again.'}
                        </p>
                        <div className="flex gap-3 justify-center">
                            <button
                                onClick={this.handleReset}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition-colors text-sm font-medium"
                            >
                                <ArrowPathIcon className="w-4 h-4" />
                                Try Again
                            </button>
                            <button
                                onClick={() => window.location.reload()}
                                className="px-4 py-2 bg-gray-800 text-gray-300 rounded-lg hover:bg-gray-700 transition-colors text-sm font-medium"
                            >
                                Reload Page
                            </button>
                        </div>
                        {process.env.NODE_ENV === 'development' && this.state.error && (
                            <details className="mt-6 text-left bg-gray-900 rounded-lg p-4 text-xs">
                                <summary className="cursor-pointer text-gray-400 hover:text-gray-300">
                                    Error Details
                                </summary>
                                <pre className="mt-2 text-red-400 overflow-auto max-h-48">
                                    {this.state.error.toString()}
                                    {this.state.errorInfo?.componentStack}
                                </pre>
                            </details>
                        )}
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
