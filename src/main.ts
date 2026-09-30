import { Notification } from '@arco-design/web-vue'

import { registerSW } from 'virtual:pwa-register'
import { createApp } from 'vue'
import { loadMessages, useSetupI18n } from '@/i18n'
import { applyArcoDefaults } from '@/plugins/arco-defaults'
import { setupRoutes } from '@/router'
import { setupStores } from '@/stores'
import App from './App.vue'

import 'nprogress/nprogress.css'
import './assets/css/main.scss'
import 'uno.css'
import 'virtual:svg-icons-register'

// ── 发版自更新 ────────────────────────────────────────────────
// PWA 是 registerType=autoUpdate：新 SW 激活时运行时会自动 reload 页面。
// 但浏览器只在**导航**（或 24h 启发式）时去查 sw.js —— 长期挂着的标签页永远
// 查不到新版，用户不手动刷新就一直是旧页面。这里强制定期（+ 切回标签页时）
// 主动 update()，配合 onNeedReload 做「先提示、再刷新」，不必再提醒用户刷新。
const SW_UPDATE_CHECK_INTERVAL_MS = 3 * 60 * 1000
const UPDATE_RELOAD_DELAY_MS = 3 * 1000

let reloadingForUpdate = false
function reloadForNewVersion() {
  if (reloadingForUpdate)
    return
  reloadingForUpdate = true
  try {
    Notification.info({
      title: '平台已更新',
      content: '检测到新版本，正在自动刷新…',
      duration: UPDATE_RELOAD_DELAY_MS,
    })
  }
  catch {
    // 提示失败不影响刷新本身
  }
  setTimeout(() => window.location.reload(), UPDATE_RELOAD_DELAY_MS)
}

registerSW({
  immediate: true,
  onNeedReload: reloadForNewVersion,
  onRegisteredSW(_swUrl, registration) {
    if (!registration)
      return
    const checkUpdate = () => {
      // 离线/网络抖动失败无需打扰：下一轮再试
      registration.update().catch(() => { /* 静默等下一次检查 */ })
    }
    setInterval(checkUpdate, SW_UPDATE_CHECK_INTERVAL_MS)
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible')
        checkUpdate()
    })
    window.addEventListener('focus', checkUpdate)
  },
})

async function bootApp() {
  // 必须在任何表格渲染之前：改的是组件 props 声明，已渲染的表不会回溯
  applyArcoDefaults()
  const app = createApp(App)
  setupStores(app)
  useSetupI18n().setupI18n(app)
  await loadMessages()
  await setupRoutes(app)
  app.mount('#app')
}

void bootApp()
