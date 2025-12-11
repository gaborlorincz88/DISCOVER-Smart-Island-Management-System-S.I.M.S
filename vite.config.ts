import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import fs from 'fs';
import viteCompression from 'vite-plugin-compression';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      plugins: [
        // Enable gzip compression for production builds only
        ...(mode === 'production' ? [
          viteCompression({
            algorithm: 'gzip',
            ext: '.gz',
            threshold: 1024, // Only compress files larger than 1KB
            minRatio: 0.8, // Only compress if compression ratio is better than 0.8
            deleteOriginFile: false // Keep original files
          }),
          // Enable brotli compression for even better compression
          viteCompression({
            algorithm: 'brotliCompress',
            ext: '.br',
            threshold: 1024,
            minRatio: 0.8,
            deleteOriginFile: false
          })
        ] : [])
      ],
      server: {
        host: '0.0.0.0',
        https: {
          key: fs.readFileSync(path.resolve(__dirname, 'backend/certs/key.pem')),
          cert: fs.readFileSync(path.resolve(__dirname, 'backend/certs/cert.pem'))
        },
        // Trust self-signed certs for development
        strictPort: true,
        proxy: {
          // Proxy API requests to the backend server
          '/api': {
            target: env.VITE_API_BASE_URL || 'http://localhost:3003',
            changeOrigin: true,
            secure: false,
          },
        }
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      },
      build: {
        // Optimize build for better compression
        minify: 'terser',
        terserOptions: {
          compress: {
            drop_console: true, // Remove console.log in production
            drop_debugger: true
          }
        },
        // Enable source maps for debugging (optional)
        sourcemap: false,
        // Optimize chunk splitting
        rollupOptions: {
          output: {
            manualChunks: {
              vendor: ['react', 'react-dom'],
              leaflet: ['leaflet']
            }
          }
        }
      }
    };
});
