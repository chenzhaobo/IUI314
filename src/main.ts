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

// ── 发版自更新（空闲 30 分钟后应用）─────────────────────────────
// PWA 用 registerType='prompt'：新版本先「待命」（不抢控制权，避免新旧资源混用），
// 由我们挑切换时机 —— 时机 = 用户 30 分钟没有任何操作。此刻刷新不会打断工作、
// 也不会丢未保存的输入；用户回来就是新版本。
// 不做高频轮询：平时只有一条「空闲闹钟」，任何操作都会重置它；到点才查一次 SW。
const IDLE_APPLY_AFTER_MS = 30 * 60 * 1000
const ACTIVITY_THROTTLE_MS = 5 * 1000
const ACTIVITY_EVENTS = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart', 'scroll'] as const

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined
let swRegistration: ServiceWorkerRegistration | undefined
let pendingUpdate = false
let idleTimer: ReturnType<typeof setTimeout> | undefined
let lastActivityRecordedAt = 0

/** 重置空闲闹钟：用户任何操作都重新开始计时 */
function armIdleTimer() {
  if (idleTimer)
    clearTimeout(idleTimer)
  idleTimer = setTimeout(() => void applyUpdateWhenIdle(), IDLE_APPLY_AFTER_MS)
}

/** 发起切换：发 SKIP_WAITING 让新版接管（接管会触发下面的 controllerchange 刷新） */
function requestUpdateApply() {
  void updateServiceWorker?.(true)
}

/** 空闲到点：查一次有没有新版本；有待命的新版就切换（接管后自动刷新），没有就继续等 */
async function applyUpdateWhenIdle() {
  if (!swRegistration || !updateServiceWorker) {
    armIdleTimer()
    return
  }
  if (pendingUpdate || swRegistration.waiting) {
    requestUpdateApply()
    return
  }
  // 本地还没有待命的新版：主动查一次（网络抖动就当这轮没查到，等下一个空闲窗口）
  await swRegistration.update().catch(() => undefined)
  // 更新检查是异步落定的：给 5 秒宽限，等 onNeedRefresh 触发
  await new Promise(resolve => setTimeout(resolve, 5_000))
  if (pendingUpdate || swRegistration.waiting)
    requestUpdateApply()
  else
    armIdleTimer()
}

// SW 接管即刷新：本页自己切换、或别的标签页触发了切换（跨标签页一致性），
// 都立刻刷新 —— 否则旧页面配新 SW，懒加载分包可能拉不到（新部署已换哈希文件名）。
navigator.serviceWorker?.addEventListener('controllerchange', () => window.location.reload())

function markActivity() {
  const now = Date.now()
  if (now - lastActivityRecordedAt < ACTIVITY_THROTTLE_MS)
    return
  lastActivityRecordedAt = now
  armIdleTimer()
}

for (const event of ACTIVITY_EVENTS)
  window.addEventListener(event, markActivity, { passive: true, capture: true })
armIdleTimer()

updateServiceWorker = registerSW({
  immediate: true,
  onNeedRefresh() {
    // 新版本已就绪（等待接管）：留给空闲窗口应用
    pendingUpdate = true
  },
  onRegisteredSW(_swUrl, registration) {
    swRegistration = registration
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
