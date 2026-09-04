import { createApp } from 'vue'

import { registerSW } from 'virtual:pwa-register'
import App from './App.vue'
import { loadMessages, useSetupI18n } from '@/i18n'
import { setupRoutes } from '@/router'
import { setupStores } from '@/stores'
import { applyArcoDefaults } from '@/plugins/arco-defaults'

import 'nprogress/nprogress.css'
import './assets/css/main.scss'
import 'uno.css'
import 'virtual:svg-icons-register'

registerSW({ immediate: true })

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
