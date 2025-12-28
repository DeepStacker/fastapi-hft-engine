
import PropTypes from 'prop-types';

/**
 * Standardized Spinner Component
 * Loading indicator with size and color options
 */
const Spinner = ({
    size = 'md',
    color = 'primary',
    label = 'Loading...',
    showLabel = false,
    className = '',
}) => {
    // Size classes
    const sizeClasses = {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-6 w-6',
        lg: 'h-8 w-8',
        xl: 'h-12 w-12',
    };

    // Color classes
    const colorClasses = {
        primary: 'text-blue-600 dark:text-blue-400',
        secondary: 'text-gray-600 dark:text-gray-400',
        success: 'text-green-600 dark:text-green-400',
        danger: 'text-red-600 dark:text-red-400',
        warning: 'text-yellow-600 dark:text-yellow-400',
        white: 'text-white',
    };

    return (
        <div className={`inline-flex items-center ${className}`} role="status">
            <svg
                className={`animate-spin ${sizeClasses[size]} ${colorClasses[color]}`}
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
            >
                <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                />
                <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
            </svg>
            {showLabel && (
                <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    {label}
                </span>
            )}
            <span className="sr-only">{label}</span>
        </div>
    );
};

/**
 * Full page loading overlay
 */
export const LoadingOverlay = ({ message = 'Loading...', show = true }) => {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-xl flex flex-col items-center">
                <Spinner size="xl" />
                <p className="mt-4 text-gray-700 dark:text-gray-300 font-medium">
                    {message}
                </p>
            </div>
        </div>
    );
};

LoadingOverlay.propTypes = {
    message: PropTypes.string,
    show: PropTypes.bool,
};

Spinner.propTypes = {
    size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
    color: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'white']),
    label: PropTypes.string,
    showLabel: PropTypes.bool,
    className: PropTypes.string,
};

export default Spinner;
