import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/icon-maskable.png'],
      manifest: {
        id: "printlabel-pro-app",
        name: "PrintLabel Pro - Generador e Impresor de Etiquetas",
        short_name: "PrintLabel Pro",
        description: "Generador y gestor de etiquetas de código de barras y QR optimizado para impresoras térmicas y Bluetooth.",
        start_url: "./",
        scope: "./",
        display: "standalone",
        display_override: ["standalone", "minimal-ui", "browser"],
        orientation: "any",
        background_color: "#0f172a",
        theme_color: "#4f46e5",
        categories: ["business", "productivity", "utilities"],
        icons: [
          {
            src: "icons/icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icons/icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icons/icon-maskable.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "icons/icon.svg",
            sizes: "any",
            type: "image/svg+xml",
            purpose: "any"
          }
        ],
        shortcuts: [
          {
            name: "Etiqueta Única",
            short_name: "Etiqueta",
            description: "Diseñar e imprimir una etiqueta individual",
            url: "./#single",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          },
          {
            name: "Impresión por Lote",
            short_name: "Lote",
            description: "Gestionar e imprimir lista de productos",
            url: "./#batch",
            icons: [{ src: "icons/icon-192.png", sizes: "192x192" }]
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']
      }
    })
  ]
});
