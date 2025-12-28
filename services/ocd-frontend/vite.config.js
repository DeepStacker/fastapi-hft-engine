import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    }
  },

  optimizeDeps: {
    include: [
      'firebase/app',
      'firebase/auth',
      'react',
      'react-dom',
      'react-router-dom',
    ]
  },

  // Server configuration for Docker hot reload
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    hmr: {
      clientPort: 5173,
      host: 'localhost',
    },
  },

  // Enable compression in preview mode
  preview: {
    headers: {
      'Cache-Control': 'public, max-age=31536000',
    }
  },

  build: {
    // Generate sourcemaps only in development
    sourcemap: mode === 'development',

    // Target modern browsers for smaller bundles
    target: 'es2020',

    // Minification settings
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: mode === 'production',
        drop_debugger: mode === 'production',
      },
    },

    // CSS optimization
    cssCodeSplit: true,
    cssMinify: true,

    // Chunk size warning limit
    chunkSizeWarningLimit: 500,

    rollupOptions: {
      output: {
        // Optimize asset file names with hash for caching
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/css/i.test(ext)) {
            return `assets/css/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
        chunkFileNames: 'assets/js/[name]-[hash].js',
        entryFileNames: 'assets/js/[name]-[hash].js',

        // Manual chunks for optimal code splitting
        manualChunks: (id) => {
          // Firebase in its own chunk (large, lazy-loaded)
          if (id.includes('node_modules/firebase')) {
            return 'firebase';
          }

          // Chart libraries (heavy, lazy-loaded pages only)
          if (id.includes('node_modules/chart.js') ||
            id.includes('node_modules/lightweight-charts') ||
            id.includes('node_modules/recharts')) {
            return 'charts';
          }

          // Animation libraries
          if (id.includes('node_modules/framer-motion')) {
            return 'animations';
          }

          // UI components and icons (can be lazy loaded)
          if (id.includes('node_modules/@heroicons') ||
            id.includes('node_modules/react-icons')) {
            return 'ui-icons';
          }

          // All other vendor code (including React, React-DOM, router, redux)
          // IMPORTANT: React must NOT be split into separate chunk - causes runtime errors
          if (id.includes('node_modules')) {
            return 'vendor';
          }
        }
      }
    },

    // Report compressed sizes
    reportCompressedSize: true,
  },

  // Optimize for production
  esbuild: {
    // Drop console.log in production
    drop: mode === 'production' ? ['console', 'debugger'] : [],
  },
}));
