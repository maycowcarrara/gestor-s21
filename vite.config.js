import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import packageJson from './package.json';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate', // Atualiza o app automaticamente quando você faz deploy
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'Gestor S-21',
        short_name: 'S-21',
        description: 'Gestão de Publicadores e Relatórios',
        theme_color: '#1e293b', // Cor da barra de status (combina com o menu lateral)
        background_color: '#f3f4f6', // Cor de fundo ao abrir
        display: 'standalone', // Remove a barra de URL do navegador (Tela Cheia)
        orientation: 'portrait', // Trava em pé no celular (opcional)
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png', // Vamos criar esse arquivo já já
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png', // E esse também
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable' // Importante para Android modernos
          }
        ]
      }
    })
  ],
  define: {
    '__APP_VERSION__': JSON.stringify(packageJson.version),
  },
});