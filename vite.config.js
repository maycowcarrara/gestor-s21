import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
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
        // SOLUÇÃO 1: Aumentar o limite para 4 MiB (Suficiente para seus 2.68 MB)
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,

        // Garante que o SW limpe caches antigos
        cleanupOutdatedCaches: true,
      }
    })
  ],
  build: {
    // Aumenta o limite de aviso do chunk para não poluir o terminal
    chunkSizeWarningLimit: 1000,

    rollupOptions: {
      output: {
        // SOLUÇÃO 2: Code Splitting (Divide o arquivo gigante em pedaços menores)
        manualChunks(id) {
          if (id.includes('node_modules')) {
            // Separa bibliotecas pesadas de PDF e Excel em um arquivo separado
            if (id.includes('jspdf') || id.includes('html2canvas') || id.includes('exceljs') || id.includes('jszip')) {
              return 'heavy-libs'; // Nome do arquivo chunk
            }
            // Separa o Firebase (que é grande)
            if (id.includes('firebase')) {
              return 'firebase-core';
            }
            // O resto das libs (React, etc) fica no vendor
            return 'vendor';
          }
        }
      }
    }
  }
});