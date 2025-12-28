
import PropTypes from 'prop-types';

/**
 * Standardized Button Component
 * Provides consistent styling across the application
 */
const Button = ({
    variant = 'primary',
    size = 'md',
    children,
    className = '',
    disabled = false,
    loading = false,
    icon: Icon,
    iconPosition = 'left',
    fullWidth = false,
    type = 'button',
    ...props
}) => {
    // Base classes
    const baseClasses = `
    inline-flex items-center justify-center font-medium rounded-lg
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-2
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

    // Variant classes
    const variantClasses = {
        primary: `
      bg-blue-600 text-white hover:bg-blue-700 
      focus:ring-blue-500 dark:bg-blue-500 dark:hover:bg-blue-600
    `,
        secondary: `
      bg-gray-200 text-gray-900 hover:bg-gray-300 
      focus:ring-gray-500 dark:bg-gray-700 dark:text-gray-100 dark:hover:bg-gray-600
    `,
        success: `
      bg-green-600 text-white hover:bg-green-700 
      focus:ring-green-500 dark:bg-green-500 dark:hover:bg-green-600
    `,
        danger: `
      bg-red-600 text-white hover:bg-red-700 
      focus:ring-red-500 dark:bg-red-500 dark:hover:bg-red-600
    `,
        warning: `
      bg-yellow-500 text-white hover:bg-yellow-600 
      focus:ring-yellow-500 dark:bg-yellow-400 dark:hover:bg-yellow-500
    `,
        ghost: `
      bg-transparent text-gray-700 hover:bg-gray-100 
      focus:ring-gray-500 dark:text-gray-300 dark:hover:bg-gray-800
    `,
        outline: `
      border-2 border-blue-600 text-blue-600 bg-transparent
      hover:bg-blue-50 focus:ring-blue-500
      dark:border-blue-400 dark:text-blue-400 dark:hover:bg-blue-900/20
    `,
        // Premium variants
        premium: `
      bg-gradient-to-r from-blue-600 to-indigo-600 text-white 
      hover:from-blue-500 hover:to-indigo-500 hover:shadow-lg hover:shadow-blue-500/25
      active:scale-[0.98] focus:ring-blue-500
    `,
        gradient: `
      bg-gradient-to-r from-emerald-500 to-teal-600 text-white 
      hover:from-emerald-400 hover:to-teal-500 hover:shadow-lg hover:shadow-emerald-500/25
      active:scale-[0.98] focus:ring-emerald-500
    `,
    };

    // Size classes
    const sizeClasses = {
        xs: 'px-2 py-1 text-xs',
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-5 py-2.5 text-base',
        xl: 'px-6 py-3 text-lg',
    };

    // Icon size classes
    const iconSizeClasses = {
        xs: 'h-3 w-3',
        sm: 'h-4 w-4',
        md: 'h-4 w-4',
        lg: 'h-5 w-5',
        xl: 'h-6 w-6',
    };

    const classes = `
    ${baseClasses}
    ${variantClasses[variant] || variantClasses.primary}
    ${sizeClasses[size] || sizeClasses.md}
    ${fullWidth ? 'w-full' : ''}
    ${className}
  `.replace(/\s+/g, ' ').trim();

    return (
        <button
            type={type}
            className={classes}
            disabled={disabled || loading}
            {...props}
        >
            {loading ? (
                <>
                    <svg
                        className={`animate-spin ${iconSizeClasses[size]} ${iconPosition === 'left' ? 'mr-2' : 'ml-2'}`}
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
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
                    {children}
                </>
            ) : (
                <>
                    {Icon && iconPosition === 'left' && (
                        <Icon className={`${iconSizeClasses[size]} mr-2`} />
                    )}
                    {children}
                    {Icon && iconPosition === 'right' && (
                        <Icon className={`${iconSizeClasses[size]} ml-2`} />
                    )}
                </>
            )}
        </button>
    );
};

Button.propTypes = {
    variant: PropTypes.oneOf(['primary', 'secondary', 'success', 'danger', 'warning', 'ghost', 'outline']),
    size: PropTypes.oneOf(['xs', 'sm', 'md', 'lg', 'xl']),
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    disabled: PropTypes.bool,
    loading: PropTypes.bool,
    icon: PropTypes.elementType,
    iconPosition: PropTypes.oneOf(['left', 'right']),
    fullWidth: PropTypes.bool,
    type: PropTypes.oneOf(['button', 'submit', 'reset']),
};

export default Button;
