import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import packageJson from './package.json';

export default defineConfig({
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
  },

  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'pwa-192x192.png', 'pwa-512x512.png'],

      devOptions: {
        enabled: true,
      },

      manifest: {
        name: 'Gestor S-21',
        short_name: 'S-21',
        description: 'Gestão de Publicadores e Relatórios',
        theme_color: '#1e293b',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',

        // CORREÇÃO 1: Ícones separados para 'any' e 'maskable' para sumir o aviso
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any' // Usado em PC/iPhone (quadrado padrão)
          },
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'maskable' // Usado no Android (arredondado/adaptável)
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable'
          }
        ],

        // CORREÇÃO 2: Screenshots para a "Richer Install UI"
        // Se você não tiver as imagens agora, o aviso continuará, mas o app instala igual.
        // Coloque arquivos reais na pasta public para o aviso sumir de vez.
        screenshots: [
          {
            src: 'screenshot-mobile.png', // Crie este arquivo na pasta public (ex: 360x640px)
            sizes: '360x640',
            type: 'image/png',
            label: 'Visão Geral no Celular'
          },
          {
            src: 'screenshot-desktop.png', // Crie este arquivo na pasta public (ex: 1280x720px)
            sizes: '1280x720',
            type: 'image/png',
            form_factor: 'wide', // Isso resolve o aviso de desktop
            label: 'Painel de Controle'
          }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
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