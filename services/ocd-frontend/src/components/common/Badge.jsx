
import PropTypes from 'prop-types';

/**
 * Standardized Badge Component
 * For status indicators, labels, and tags
 */
const Badge = ({
    children,
    variant = 'default',
    size = 'md',
    rounded = 'full',
    dot = false,
    removable = false,
    onRemove,
    className = '',
}) => {
    // Variant classes
    const variantClasses = {
        default: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
        primary: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
        success: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
        warning: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
        danger: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
        info: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300',
    };

    // Size classes
    const sizeClasses = {
        sm: 'px-2 py-0.5 text-xs',
        md: 'px-2.5 py-0.5 text-sm',
        lg: 'px-3 py-1 text-sm',
    };

    // Rounded classes
    const roundedClasses = {
        none: 'rounded-none',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        full: 'rounded-full',
    };

    // Dot colors
    const dotColors = {
        default: 'bg-gray-400',
        primary: 'bg-blue-400',
        success: 'bg-green-400',
        warning: 'bg-yellow-400',
        danger: 'bg-red-400',
        info: 'bg-indigo-400',
    };

    return (
        <span
            className={`
        inline-flex items-center font-medium
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${roundedClasses[rounded]}
        ${className}
      `}
        >
            {dot && (
                <span
                    className={`
            w-1.5 h-1.5 rounded-full mr-1.5
            ${dotColors[variant]}
          `}
                />
            )}
            {children}
            {removable && (
                <button
                    type="button"
                    onClick={onRemove}
                    className="
            ml-1 -mr-0.5 inline-flex items-center justify-center
            h-4 w-4 rounded-full hover:bg-black/10 dark:hover:bg-white/10
            focus:outline-none transition-colors
          "
                    aria-label="Remove"
                >
                    <svg className="h-2 w-2" fill="currentColor" viewBox="0 0 8 8">
                        <path d="M1.41 0L0 1.41l2.59 2.59L0 6.59 1.41 8l2.59-2.59L6.59 8 8 6.59 5.41 4 8 1.41 6.59 0 4 2.59 1.41 0z" />
                    </svg>
                </button>
            )}
        </span>
    );
};

Badge.propTypes = {
    children: PropTypes.node.isRequired,
    variant: PropTypes.oneOf(['default', 'primary', 'success', 'warning', 'danger', 'info']),
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    rounded: PropTypes.oneOf(['none', 'sm', 'md', 'lg', 'full']),
    dot: PropTypes.bool,
    removable: PropTypes.bool,
    onRemove: PropTypes.func,
    className: PropTypes.string,
};

export default Badge;
