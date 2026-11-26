import { Button, Notification } from '@arco-design/web-vue'
import { registerSW } from 'virtual:pwa-register'
import { h } from 'vue'
import { ApiSysLogin } from '@/api/sysApis'

const CHECK_INTERVAL_MS = 2 * 60 * 1000
const CHECK_THROTTLE_MS = 60 * 1000
const VERSION_REQUEST_TIMEOUT_MS = 10 * 1000

interface VersionInfo {
  version?: string | null
  git_sha?: string | null
  build_time?: string | null
}

interface VersionResponse {
  code?: number
  data?: VersionInfo | null
}

let updateServiceWorker: ((reloadPage?: boolean) => Promise<void>) | undefined
let swRegistration: ServiceWorkerRegistration | undefined
let activeCheck: (() => Promise<void>) | undefined
let updateAvailable = false
let serviceWorkerUpdateReady = false
let checking = false
let applying = false
let reloading = false
let lastCheckedAt = 0

export function setupAppUpdate() {
  if (!('serviceWorker' in navigator)) {
    startVersionPolling()
    return
  }

  navigator.serviceWorker.addEventListener('controllerchange', reloadPage)
  updateServiceWorker = registerSW({
    immediate: true,
    onNeedReload: reloadPage,
    onNeedRefresh: markServiceWorkerUpdate,
    onRegisteredSW(_swUrl, registration) {
      if (!registration) {
        startVersionPolling()
        return
      }
      swRegistration = registration
      if (registration.waiting)
        markServiceWorkerUpdate()
      startChecks(checkServiceWorkerUpdate)
    },
    onRegisterError: startVersionPolling,
  })
}

export function recoverFromStaleChunk() {
  // 普通刷新可能再次被旧 SW 导向预缓存的旧首页，必须先激活待命版本。
  if (swRegistration?.waiting)
    serviceWorkerUpdateReady = true
  if (serviceWorkerUpdateReady) {
    void applyAppUpdate()
    return
  }
  reloadPage()
}

function markServiceWorkerUpdate() {
  serviceWorkerUpdateReady = true
  showUpdatePrompt()
}

function showUpdatePrompt() {
  if (updateAvailable)
    return
  updateAvailable = true
  Notification.warning({
    id: 'app-update-available',
    title: '发现新版本',
    content: '平台已发布新版本，请保存当前编辑内容后刷新页面。',
    duration: 0,
    closable: true,
    footer: () => h(Button, {
      type: 'primary',
      size: 'small',
      onClick: () => void applyAppUpdate(),
    }, { default: () => '立即刷新' }),
  })
}

async function applyAppUpdate() {
  if (applying || reloading)
    return
  applying = true
  if (serviceWorkerUpdateReady && updateServiceWorker) {
    try {
      await updateServiceWorker(true)
    }
    catch {
      applying = false
    }
    return
  }
  reloadPage()
}

function reloadPage() {
  if (reloading)
    return
  reloading = true
  window.location.reload()
}

function startChecks(check: () => Promise<void>) {
  if (activeCheck)
    return
  activeCheck = check
  window.setInterval(() => void runUpdateCheck(), CHECK_INTERVAL_MS)
  window.addEventListener('focus', () => void runUpdateCheck())
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible')
      void runUpdateCheck()
  })
  void runUpdateCheck()
}

async function runUpdateCheck() {
  const check = activeCheck
  if (!check || updateAvailable || applying || checking || document.visibilityState === 'hidden')
    return
  const now = Date.now()
  if (now - lastCheckedAt < CHECK_THROTTLE_MS)
    return
  checking = true
  lastCheckedAt = now
  await check().catch(() => undefined)
  checking = false
}

async function checkServiceWorkerUpdate() {
  if (!swRegistration)
    return
  if (swRegistration.waiting) {
    markServiceWorkerUpdate()
    return
  }
  await swRegistration.update()
  if (swRegistration.waiting)
    markServiceWorkerUpdate()
}

function startVersionPolling() {
  if (import.meta.env.VITE_APP_BUILD_ID)
    startChecks(checkVersionUpdate)
}

async function checkVersionUpdate() {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), VERSION_REQUEST_TIMEOUT_MS)
  try {
    // 后台探测不经过业务请求封装，避免触发进度条、鉴权跳转和错误提示。
    const apiBase = import.meta.env.VITE_API_BASE_URL.replace(/\/+$/, '')
    const response = await fetch(`${apiBase}${ApiSysLogin.version}`, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })
    if (!response.ok)
      return
    const payload = await response.json() as VersionResponse
    if (payload.code !== 200 || !payload.data)
      return
    const serverBuildId = getBuildId(payload.data)
    if (serverBuildId && serverBuildId !== import.meta.env.VITE_APP_BUILD_ID)
      showUpdatePrompt()
  }
  finally {
    window.clearTimeout(timeout)
  }
}

function getBuildId(info: VersionInfo) {
  const parts = [info.version, info.git_sha, info.build_time]
  if (!parts.some(Boolean))
    return undefined
  return parts.map(part => part ?? '').join('|')
}
