import type { App } from 'vue'
import { createI18n } from 'vue-i18n'

import { ApiSysI18n } from '@/api/sysApis'
import { useAppStore } from '@/stores'

export type MessageSchema = Record<string, any>

const STORAGE_KEY = 'i18n_messages'

const messages = {
  'zh-CN': {},
  'en-US': {},
}

interface langInfo {
  k: string
  v: string
}

export const langList: langInfo[] = [
  {
    k: 'zh-CN',
    v: '简体中文',
  },
  {
    k: 'en-US',
    v: 'English',
  },
]

const i18n: any = createI18n<MessageSchema>({
  legacy: false,
  globalInjection: true,
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  silentTranslationWarn: true,
  messages,
})

/**
 * 从后端加载翻译并合并到 vue-i18n
 * 先用 localStorage 缓存秒加载，再后台拉最新
 */
export async function loadMessages() {
  // 设置当前语言
  const appStore = useAppStore()
  const lang = appStore.app.lang || 'zh-CN'
  i18n.global.locale.value = lang

  // 1. 先用 localStorage 缓存（秒加载，避免白屏）
  try {
    const cached = localStorage.getItem(STORAGE_KEY)
    if (cached) {
      const msgs = JSON.parse(cached)
      if (msgs['zh-CN'])
        i18n.global.mergeLocaleMessage('zh-CN', msgs['zh-CN'])
      if (msgs['en-US'])
        i18n.global.mergeLocaleMessage('en-US', msgs['en-US'])
    }
  }
  catch {
    // 缓存损坏，忽略
  }

  // 2. 从后端拉取最新翻译
  try {
    const baseUrl = import.meta.env.VITE_API_BASE_URL
    const resp = await fetch(`${baseUrl}${ApiSysI18n.messages}`)
    const json = await resp.json()
    if (json.code === 200 && json.data) {
      const data = json.data
      if (data['zh-CN'])
        i18n.global.mergeLocaleMessage('zh-CN', data['zh-CN'])
      if (data['en-US'])
        i18n.global.mergeLocaleMessage('en-US', data['en-US'])
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
    }
  }
  catch {
    // 后端不可用，使用缓存兜底
  }
}

export function useSetupI18n() {
  const setupI18n = (app: App) => {
    app.use(i18n)
  }

  return { i18n, setupI18n }
}
