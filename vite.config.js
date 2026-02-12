import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import packageJson from './package.json'; // 1. Importe o package.json aqui

// https://vitejs.dev/config/
export default defineConfig({
  // 2. Defina a variável global aqui
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],
      manifest: {
        name: 'Gestor S-21',
        short_name: 'S-21',
        description: 'Gestão de Publicadores e Relatórios',
        theme_color: '#4a6da7',
        background_color: '#f5f5f5',
        display: 'standalone',
        scope: '/',
        start_url: '/',
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
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('exceljs') || id.includes('jszip')) {
              return 'heavy-libs';
            }
            if (id.includes('firebase')) {
              return 'firebase-core';
            }
            return 'vendor';
          }
        }
      }
    }
  }
});