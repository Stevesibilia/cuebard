// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  devtools: { enabled: process.env.NODE_ENV !== 'production' },
  ssr: false,

  // Workaround for Nuxt 4.4.5 bug with ssr:false (nuxt/nuxt#35033)
  experimental: {
    viteEnvironmentApi: true,
  },
  
  app: {
    head: {
      title: 'CueBard',
      meta: [
        { charset: 'utf-8' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' }
      ]
    },
    // Use relative paths for Electron
    baseURL: process.env.NODE_ENV === 'production' ? './' : '/',
    buildAssetsDir: '_nuxt/',
    cdnURL: process.env.NODE_ENV === 'production' ? './' : ''
  },

  // Fonts come from @fontsource packages so Vite bundles the woff2 files:
  // the packaged app runs offline from file://
  css: [
    '@fontsource/ibm-plex-mono/400.css',
    '@fontsource/ibm-plex-mono/500.css',
    '@fontsource/ibm-plex-mono/600.css',
    '@fontsource-variable/bricolage-grotesque',
    '~/assets/styles/main.scss'
  ],

  vite: {
    css: {
      preprocessorOptions: {
        scss: {
          additionalData: '@use "~/assets/styles/variables.scss" as *;'
        }
      }
    }
  },

  modules: [],

  compatibilityDate: '2025-10-31'
})
