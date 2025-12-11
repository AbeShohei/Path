import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
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
            'x-rapidapi-key': env['X-RAPIDAPI-KEY'] || '',
            'x-rapidapi-host': 'navitime-maps.p.rapidapi.com'
          }
        },
        // Proxy for Navitime Route API (RapidAPI) - for route_transit
        '/api/route_transit': {
          target: 'https://navitime-route-totalnavi.p.rapidapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          headers: {
            'x-rapidapi-key': env['X-RAPIDAPI-KEY'] || '',
            'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com'
          }
        },
        // Proxy for Navitime Route API (RapidAPI) - for shape_transit
        '/api/shape_transit': {
          target: 'https://navitime-route-totalnavi.p.rapidapi.com',
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
          headers: {
            'x-rapidapi-key': env['X-RAPIDAPI-KEY'] || '',
            'x-rapidapi-host': 'navitime-route-totalnavi.p.rapidapi.com'
          }
        }
      }
    },
    plugins: [react()],
    envPrefix: ['VITE_', 'GOOGLE_MAPS_API_KEY'], // Allow accessing GOOGLE_MAPS_API_KEY via import.meta.env
    define: {
      'process.env.API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GOOGLE_MAPS_API_KEY': JSON.stringify(env.GOOGLE_MAPS_API_KEY),
      'process.env.OPENROUTER_API_KEY': JSON.stringify(env.OPENROUTER_API_KEY),
      'process.env.NAVITIME_API_KEY': JSON.stringify(env.NAVITIME_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    }
  };
});
