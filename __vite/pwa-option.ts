import type { VitePWAOptions } from 'vite-plugin-pwa'

export const getPwaOptions: Partial<VitePWAOptions> = {
  registerType: 'autoUpdate',
  devOptions: {
    enabled: true,
    type: 'module',
  },
  includeAssets: ['favicon.svg', 'safari-pinned-tab.svg'],
  manifest: {
    name: '技术测试平台',
    short_name: '技术测试',
    theme_color: '#FAFAFA',
    id: '/',
    display: 'standalone',
    icons: [
      {
        src: 'logo.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    screenshots: [
      {
        src: 'logo.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
      },
      {
        src: 'logo.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        form_factor: 'wide',
      },
    ],

  },
}
