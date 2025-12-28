import { forwardRef } from 'react';
import PropTypes from 'prop-types';

/**
 * Standardized Input Component
 * Provides consistent input styling with validation states
 */
const Input = forwardRef(({
    label,
    error,
    helperText,
    type = 'text',
    size = 'md',
    variant: _variant = 'default',
    className = '',
    containerClassName = '',
    icon: Icon,
    iconPosition = 'left',
    required = false,
    disabled = false,
    fullWidth = true,
    ...props
}, ref) => {
    // Size classes
    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-sm',
        lg: 'px-4 py-3 text-base',
    };

    // Icon padding classes
    const iconPaddingClasses = {
        sm: { left: 'pl-9', right: 'pr-9' },
        md: { left: 'pl-10', right: 'pr-10' },
        lg: { left: 'pl-11', right: 'pr-11' },
    };

    // Icon size classes
    const iconSizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-5 w-5',
        lg: 'h-5 w-5',
    };

    // Variant/state classes
    const getVariantClasses = () => {
        if (error) {
            return `
        border-red-500 text-red-900 placeholder-red-300
        focus:ring-red-500 focus:border-red-500
        dark:border-red-500 dark:text-red-400
      `;
        }

        if (disabled) {
            return `
        bg-gray-100 border-gray-200 text-gray-500 cursor-not-allowed
        dark:bg-gray-800 dark:border-gray-700 dark:text-gray-500
      `;
        }

        return `
      border-gray-300 text-gray-900 placeholder-gray-400
      focus:ring-blue-500 focus:border-blue-500
      dark:bg-gray-700 dark:border-gray-600 dark:text-white
      dark:placeholder-gray-400 dark:focus:ring-blue-500 dark:focus:border-blue-500
    `;
    };

    const inputClasses = `
    block rounded-lg border
    transition-colors duration-200
    focus:outline-none focus:ring-2
    ${sizeClasses[size]}
    ${Icon ? iconPaddingClasses[size][iconPosition] : ''}
    ${fullWidth ? 'w-full' : ''}
    ${getVariantClasses()}
    ${className}
  `.replace(/\s+/g, ' ').trim();

    return (
        <div className={`${fullWidth ? 'w-full' : ''} ${containerClassName}`}>
            {/* Label */}
            {label && (
                <label className="block mb-1.5 text-sm font-medium text-gray-700 dark:text-gray-300">
                    {label}
                    {required && <span className="ml-1 text-red-500">*</span>}
                </label>
            )}

            {/* Input wrapper */}
            <div className="relative">
                {/* Left Icon */}
                {Icon && iconPosition === 'left' && (
                    <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                        <Icon className={`${iconSizeClasses[size]} text-gray-400`} />
                    </div>
                )}

                <input
                    ref={ref}
                    type={type}
                    className={inputClasses}
                    disabled={disabled}
                    required={required}
                    aria-invalid={error ? 'true' : 'false'}
                    aria-describedby={error ? `${props.id}-error` : helperText ? `${props.id}-helper` : undefined}
                    {...props}
                />

                {/* Right Icon */}
                {Icon && iconPosition === 'right' && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                        <Icon className={`${iconSizeClasses[size]} text-gray-400`} />
                    </div>
                )}
            </div>

            {/* Error message */}
            {error && (
                <p id={`${props.id}-error`} className="mt-1.5 text-sm text-red-600 dark:text-red-400">
                    {error}
                </p>
            )}

            {/* Helper text */}
            {helperText && !error && (
                <p id={`${props.id}-helper`} className="mt-1.5 text-sm text-gray-500 dark:text-gray-400">
                    {helperText}
                </p>
            )}
        </div>
    );
});

Input.displayName = 'Input';

Input.propTypes = {
    label: PropTypes.string,
    error: PropTypes.string,
    helperText: PropTypes.string,
    type: PropTypes.string,
    size: PropTypes.oneOf(['sm', 'md', 'lg']),
    variant: PropTypes.oneOf(['default', 'filled']),
    className: PropTypes.string,
    containerClassName: PropTypes.string,
    icon: PropTypes.elementType,
    iconPosition: PropTypes.oneOf(['left', 'right']),
    required: PropTypes.bool,
    disabled: PropTypes.bool,
    fullWidth: PropTypes.bool,
};

export default Input;
