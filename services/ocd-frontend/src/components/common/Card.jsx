
import PropTypes from 'prop-types';

/**
 * Standardized Card Component
 * Provides consistent card styling across the application
 */
const Card = ({
    title,
    subtitle,
    children,
    className = '',
    variant = 'default',
    padding = 'md',
    shadow = 'md',
    rounded = 'lg',
    hoverable = false,
    header,
    footer,
    ...props
}) => {
    // Shadow classes
    const shadowClasses = {
        none: '',
        sm: 'shadow-sm',
        md: 'shadow-md',
        lg: 'shadow-lg',
        xl: 'shadow-xl',
    };

    // Padding classes
    const paddingClasses = {
        none: '',
        sm: 'p-3',
        md: 'p-4',
        lg: 'p-6',
        xl: 'p-8',
    };

    // Rounded classes
    const roundedClasses = {
        none: '',
        sm: 'rounded-sm',
        md: 'rounded-md',
        lg: 'rounded-lg',
        xl: 'rounded-xl',
        full: 'rounded-2xl',
    };

    // Variant classes
    const variantClasses = {
        default: 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
        elevated: 'bg-white dark:bg-gray-800',
        outlined: 'bg-transparent border-2 border-gray-300 dark:border-gray-600',
        filled: 'bg-gray-100 dark:bg-gray-700',
        gradient: 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-800 dark:to-gray-900',
        // Premium variants
        glass: 'glass rounded-2xl',
        premium: 'card-premium',
    };

    const classes = `
    ${variantClasses[variant]}
    ${shadowClasses[shadow]}
    ${roundedClasses[rounded]}
    ${hoverable ? 'transition-all duration-200 hover:shadow-lg hover:-translate-y-0.5' : ''}
    ${className}
  `.replace(/\s+/g, ' ').trim();

    return (
        <div className={classes} {...props}>
            {/* Header */}
            {(title || subtitle || header) && (
                <div className={`${paddingClasses[padding]} border-b border-gray-200 dark:border-gray-700`}>
                    {header || (
                        <>
                            {title && (
                                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                                    {title}
                                </h3>
                            )}
                            {subtitle && (
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    {subtitle}
                                </p>
                            )}
                        </>
                    )}
                </div>
            )}

            {/* Body */}
            <div className={paddingClasses[padding]}>
                {children}
            </div>

            {/* Footer */}
            {footer && (
                <div className={`${paddingClasses[padding]} border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50`}>
                    {footer}
                </div>
            )}
        </div>
    );
};

Card.propTypes = {
    title: PropTypes.string,
    subtitle: PropTypes.string,
    children: PropTypes.node.isRequired,
    className: PropTypes.string,
    variant: PropTypes.oneOf(['default', 'elevated', 'outlined', 'filled', 'gradient', 'glass', 'premium']),
    padding: PropTypes.oneOf(['none', 'sm', 'md', 'lg', 'xl']),
    shadow: PropTypes.oneOf(['none', 'sm', 'md', 'lg', 'xl']),
    rounded: PropTypes.oneOf(['none', 'sm', 'md', 'lg', 'xl', 'full']),
    hoverable: PropTypes.bool,
    header: PropTypes.node,
    footer: PropTypes.node,
};

export default Card;
