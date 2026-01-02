import React from 'react';
import { ErrorBoundary as ReactErrorBoundary } from 'react-error-boundary';
import { FiAlertTriangle, FiRefreshCw, FiHome } from 'react-icons/fi';

const ErrorFallback = ({ error, resetErrorBoundary }) => {
    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-black p-4 text-white">
            {/* Glassmorphic Card */}
            <div className="relative max-w-lg w-full bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-8 shadow-2xl overflow-hidden">

                {/* Glow Effect */}
                <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-red-500 via-orange-500 to-red-500 animate-pulse"></div>

                <div className="flex flex-col items-center text-center">
                    {/* Icon */}
                    <div className="mb-6 p-4 bg-red-500/20 rounded-full border border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.5)]">
                        <FiAlertTriangle className="w-12 h-12 text-red-500" />
                    </div>

                    <h2 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-gray-400 mb-3">
                        System Encountered an Error
                    </h2>

                    <p className="text-gray-300 mb-6 leading-relaxed">
                        Something unexpected stopped the application. This has been logged and we are notified.
                    </p>

                    {/* Error Details (Collapsible/Scrollable if needed, mostly hidden for users) */}
                    <div className="w-full bg-black/40 rounded-lg p-4 mb-8 border border-white/10 text-left overflow-auto max-h-32">
                        <code className="text-red-400 font-mono text-sm break-words">
                            {error.message || "Unknown Error"}
                        </code>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-4 w-full">
                        <button
                            onClick={resetErrorBoundary}
                            className="flex-1 flex items-center justify-center gap-2 bg-white text-black font-semibold py-3 px-6 rounded-xl hover:bg-gray-200 transition-all duration-300 transform hover:scale-[1.02]"
                        >
                            <FiRefreshCw className="w-4 h-4" />
                            Try Again
                        </button>
                        <button
                            onClick={() => window.location.href = '/'}
                            className="flex-1 flex items-center justify-center gap-2 bg-white/5 border border-white/10 text-white font-semibold py-3 px-6 rounded-xl hover:bg-white/10 transition-all duration-300 transform hover:scale-[1.02]"
                        >
                            <FiHome className="w-4 h-4" />
                            Go Home
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const ErrorBoundary = ({ children }) => {
    return (
        <ReactErrorBoundary
            FallbackComponent={ErrorFallback}
            onReset={() => {
                // Reset logic (e.g., clear session storge if needed, or simply reload)
                window.location.reload();
            }}
            onError={(error, info) => {
                // Log to external service here
                console.error("Critical Application Error:", error, info);
            }}
        >
            {children}
        </ReactErrorBoundary>
    );
};

export default ErrorBoundary;
