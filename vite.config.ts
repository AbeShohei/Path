import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  /* Use X-RAPIDAPI-KEY (hyphen or underscore) if available, otherwise fallback to NAVITIME_API_KEY */
  const rapidApiKey = env['X-RAPIDAPI-KEY'] || env['X_RAPIDAPI_KEY'] || env['NAVITIME_API_KEY'] || '';

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      proxy: {
        // Proxy for Navitime Maps (RapidAPI) - for map_script
        '/api/map_script': {
          target: 'https://navitime-maps.p.rapidapi.com',
          changeOrigin: true,
          rewrite: () => '/map_script?host=localhost',
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'navitime-maps.p.rapidapi.com'
          }
        },
        // Proxy for Navitime Route API (RapidAPI) - for route_transit
        '/api/route_transit': {
          target: 'https://navitime-route-totalnavi.p.rapidapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com'
          }
        },
        // Proxy for Navitime Route API (RapidAPI) - for shape_transit
        '/api/shape_transit': {
          target: 'https://navitime-route-totalnavi.p.rapidapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com'
          }
        }
      }
    },
    plugins: [
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['pwa-192x192.png', 'pwa-512x512.png'],
        manifest: {
          name: 'Path - Kyoto Guide',
          short_name: 'Path',
          description: 'Smart navigation guide for Kyoto with AI support',
          theme_color: '#312e81',
          background_color: '#fdfcf8',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable'
            }
          ]
        }
      })
    ],
    envPrefix: ['VITE_'], // Allow accessing VITE_ prefixed envs
    define: {
      'process.env.API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
      'process.env.NAVITIME_API_KEY': JSON.stringify(env.NAVITIME_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 1000,
    }
  };
});
