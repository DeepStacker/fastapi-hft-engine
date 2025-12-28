/**
 * Production-safe logger utility
 * Disables console.log in production, keeps console.error/warn
 */

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';

export const logger = {
    log: (...args) => {
        if (isDev) {
            console.log(...args);
        }
    },
    warn: (...args) => {
        // Keep warnings in production for debugging
        console.warn(...args);
    },
    error: (...args) => {
        // Keep errors in production
        console.error(...args);
    },
    debug: (...args) => {
        if (isDev) {
            console.log('[DEBUG]', ...args);
        }
    }
};

// Disable all console.log in production by overriding
if (!isDev) {
    console.log = () => { };
}

export default logger;
