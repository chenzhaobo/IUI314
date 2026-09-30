import type { VitePWAOptions } from 'vite-plugin-pwa'

export const getPwaOptions: Partial<VitePWAOptions> = {
  // prompt：新版本先「待命」不抢控制权（autoUpdate 会在安装后立刻接管并强制刷新，
  // 无法推迟到用户空闲时）。切换时机由 src/main.ts 的「空闲 30 分钟」逻辑决定。
  registerType: 'prompt',
  devOptions: {
    enabled: false,
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
