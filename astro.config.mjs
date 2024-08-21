import { defineConfig } from 'astro/config'
import unocss from 'unocss/astro'
import solidJs from '@astrojs/solid-js'

import node from '@astrojs/node'
import AstroPWA from '@vite-pwa/astro'
import vercel from '@astrojs/vercel/edge'
import netlify from '@astrojs/netlify/edge-functions'
import disableBlocks from './plugins/disableBlocks'

const envAdapter = () => {
  switch (process.env.OUTPUT) {
    case 'vercel': return vercel()
    case 'netlify': return netlify()
    default: return node({ mode: 'standalone' })
  }
}

// https://astro.build/config
export default defineConfig({
  integrations: [
    unocss(),
    solidJs(),
    AstroPWA({
      registerType: 'autoUpdate',
      injectRegister: 'inline',
      manifest: {
        name: 'AIMeow Chat Demo',
        short_name: 'AIMeow Chat',
        description: 'A repo for AIMeow Chat',
        theme_color: '#212129',
        background_color: '#ffffff',
        icons: [
          {
            src: 'Chat_Head.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'Chat_Head.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'Chat_Head.svg',
            sizes: '32x32',
            type: 'image/svg',
            purpose: 'any maskable',
          },
        ],
      },
      client: {
        installPrompt: true,
        periodicSyncForUpdates: 20,
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  output: 'server',
  adapter: envAdapter(),
  vite: {
    plugins: [
      process.env.OUTPUT === 'vercel' && disableBlocks(),
      process.env.OUTPUT === 'netlify' && disableBlocks(),
    ],
  },
})
