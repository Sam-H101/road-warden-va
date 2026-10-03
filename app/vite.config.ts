import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

const contentDir = fileURLToPath(new URL('../content', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-180.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      manifest: {
        name: 'Road Warden: Virginia',
        short_name: 'Road Warden',
        description: 'Learn the Virginia Driver Manual by playing. Pass the DMV knowledge exam.',
        theme_color: '#0b1020',
        background_color: '#0b1020',
        display: 'standalone',
        orientation: 'any',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,woff,woff2,png}'],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: { '@content': contentDir },
  },
  server: {
    host: true,
    fs: { allow: ['..'] },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
