/**
 * Form Validation Utilities
 * 
 * Lightweight validation system without external dependencies.
 * Provides schema-based validation with clear error messages.
 * 
 * @example
 * const schema = {
 *   email: [required(), email()],
 *   password: [required(), minLength(8), hasUppercase()],
 * };
 * 
 * const { values, errors, handleChange, handleSubmit, isValid } = useForm(schema, initialValues);
 */
import { useState, useCallback, useMemo } from 'react';

// ============ VALIDATORS ============

/**
 * Required field validator
 */
export const required = (message = 'This field is required') => (value) => {
    if (value === undefined || value === null || value === '') {
        return message;
    }
    if (Array.isArray(value) && value.length === 0) {
        return message;
    }
    return null;
};

/**
 * Email format validator
 */
export const email = (message = 'Please enter a valid email') => (value) => {
    if (!value) return null; // Let required handle empty
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(value) ? null : message;
};

/**
 * Minimum length validator
 */
export const minLength = (min, message) => (value) => {
    if (!value) return null;
    const msg = message || `Must be at least ${min} characters`;
    return String(value).length >= min ? null : msg;
};

/**
 * Maximum length validator
 */
export const maxLength = (max, message) => (value) => {
    if (!value) return null;
    const msg = message || `Must be no more than ${max} characters`;
    return String(value).length <= max ? null : msg;
};

/**
 * Minimum number validator
 */
export const minValue = (min, message) => (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const msg = message || `Must be at least ${min}`;
    return Number(value) >= min ? null : msg;
};

/**
 * Maximum number validator
 */
export const maxValue = (max, message) => (value) => {
    if (value === '' || value === null || value === undefined) return null;
    const msg = message || `Must be no more than ${max}`;
    return Number(value) <= max ? null : msg;
};

/**
 * Pattern/regex validator
 */
export const pattern = (regex, message = 'Invalid format') => (value) => {
    if (!value) return null;
    return regex.test(value) ? null : message;
};

/**
 * Must contain uppercase letter
 */
export const hasUppercase = (message = 'Must contain at least one uppercase letter') => (value) => {
    if (!value) return null;
    return /[A-Z]/.test(value) ? null : message;
};

/**
 * Must contain lowercase letter
 */
export const hasLowercase = (message = 'Must contain at least one lowercase letter') => (value) => {
    if (!value) return null;
    return /[a-z]/.test(value) ? null : message;
};

/**
 * Must contain number
 */
export const hasNumber = (message = 'Must contain at least one number') => (value) => {
    if (!value) return null;
    return /[0-9]/.test(value) ? null : message;
};

/**
 * Must contain special character
 */
export const hasSpecialChar = (message = 'Must contain at least one special character') => (value) => {
    if (!value) return null;
    return /[!@#$%^&*(),.?":{}|<>]/.test(value) ? null : message;
};

/**
 * Match another field (e.g., password confirmation)
 */
export const matches = (fieldName, message) => (value, allValues) => {
    if (!value) return null;
    const msg = message || `Must match ${fieldName}`;
    return value === allValues[fieldName] ? null : msg;
};

/**
 * Custom validator
 */
export const custom = (validateFn, message = 'Invalid value') => (value, allValues) => {
    return validateFn(value, allValues) ? null : message;
};

// ============ VALIDATION RUNNER ============

/**
 * Run all validators for a single field
 */
const validateField = (value, validators, allValues) => {
    for (const validator of validators) {
        const error = validator(value, allValues);
        if (error) return error;
    }
    return null;
};

/**
 * Validate entire form
 */
export const validateForm = (values, schema) => {
    const errors = {};
    let isValid = true;

    for (const [field, validators] of Object.entries(schema)) {
        const error = validateField(values[field], validators, values);
        if (error) {
            errors[field] = error;
            isValid = false;
        }
    }

    return { errors, isValid };
};

// ============ USE FORM HOOK ============

/**
 * Form state management hook with validation
 * 
 * @param {Object} schema - Validation schema { fieldName: [validators] }
 * @param {Object} initialValues - Initial form values
 * @param {Object} options - Options { validateOnChange, validateOnBlur }
 */
export function useForm(schema, initialValues = {}, options = {}) {
    const {
        validateOnChange = false,
        validateOnBlur = true,
    } = options;

    const [values, setValues] = useState(initialValues);
    const [errors, setErrors] = useState({});
    const [touched, setTouched] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Validate single field
    const validateSingleField = useCallback((name, value) => {
        if (!schema[name]) return null;
        return validateField(value, schema[name], { ...values, [name]: value });
    }, [schema, values]);

    // Handle input change
    const handleChange = useCallback((e) => {
        const { name, value, type, checked } = e.target;
        const newValue = type === 'checkbox' ? checked : value;

        setValues(prev => ({ ...prev, [name]: newValue }));

        if (validateOnChange && touched[name]) {
            const error = validateSingleField(name, newValue);
            setErrors(prev => ({ ...prev, [name]: error }));
        }
    }, [validateOnChange, touched, validateSingleField]);

    // Handle blur
    const handleBlur = useCallback((e) => {
        const { name, value } = e.target;
        setTouched(prev => ({ ...prev, [name]: true }));

        if (validateOnBlur) {
            const error = validateSingleField(name, value);
            setErrors(prev => ({ ...prev, [name]: error }));
        }
    }, [validateOnBlur, validateSingleField]);

    // Set field value programmatically
    const setFieldValue = useCallback((name, value) => {
        setValues(prev => ({ ...prev, [name]: value }));
    }, []);

    // Set field error programmatically
    const setFieldError = useCallback((name, error) => {
        setErrors(prev => ({ ...prev, [name]: error }));
    }, []);

    // Clear all errors
    const clearErrors = useCallback(() => {
        setErrors({});
    }, []);

    // Reset form
    const resetForm = useCallback(() => {
        setValues(initialValues);
        setErrors({});
        setTouched({});
        setIsSubmitting(false);
    }, [initialValues]);

    // Validate all fields
    const validate = useCallback(() => {
        const { errors: newErrors, isValid } = validateForm(values, schema);
        setErrors(newErrors);
        // Mark all fields as touched
        const allTouched = Object.keys(schema).reduce((acc, key) => {
            acc[key] = true;
            return acc;
        }, {});
        setTouched(allTouched);
        return isValid;
    }, [values, schema]);

    // Handle form submit
    const handleSubmit = useCallback((onSubmit) => async (e) => {
        e?.preventDefault();

        const isValid = validate();
        if (!isValid) return false;

        setIsSubmitting(true);
        try {
            await onSubmit(values);
            return true;
        } finally {
            setIsSubmitting(false);
        }
    }, [validate, values]);

    // Computed: is form valid
    const isValid = useMemo(() => {
        return Object.values(errors).every(error => !error);
    }, [errors]);

    // Computed: has been touched
    const isDirty = useMemo(() => {
        return Object.values(touched).some(t => t);
    }, [touched]);

    return {
        values,
        errors,
        touched,
        isSubmitting,
        isValid,
        isDirty,
        handleChange,
        handleBlur,
        handleSubmit,
        setFieldValue,
        setFieldError,
        clearErrors,
        resetForm,
        validate,
    };
}

// ============ UTILITY EXPORTS ============

/**
 * Common validation schemas
 */
export const commonSchemas = {
    email: [required(), email()],
    password: [required(), minLength(8), hasUppercase(), hasNumber()],
    strongPassword: [
        required(),
        minLength(12),
        hasUppercase(),
        hasLowercase(),
        hasNumber(),
        hasSpecialChar(),
    ],
    username: [required(), minLength(3), maxLength(30)],
    phone: [pattern(/^\+?[1-9]\d{9,14}$/, 'Please enter a valid phone number')],
};

export default useForm;
