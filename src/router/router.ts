import type { App } from 'vue'
import type { RouteRecordRaw } from 'vue-router'

import type { AppRouteRecordRaw } from '@/types/base/router'
import {
  createRouter,
  createWebHashHistory,
} from 'vue-router'
import { useRouterGuard } from '@/hooks'
import { recoverFromStaleChunk } from '@/utils/app-update'
import { FixedRoutes, InnerLink, Layout, REDIRECT_ROUTE_NAME } from './constant'
import { PerfStaticRoutes } from './perfStaticRoutes'

//  固定路由
export const constantRoutes: AppRouteRecordRaw[] = [
  // ── 首页 ──
  {
    path: '',
    component: Layout,
    redirect: 'index',
    name: 'index',
    meta: { title: '首页', icon: 'dashboard', i18n: 'home' },
    children: [
      {
        path: '/index',
        component: () => import('@/views/AboutView.vue'),
        name: 'dashboard',
        meta: { title: '首页', icon: 'dashboard', i18n: 'home' },
      },
      {
        path: 'vue',
        component: InnerLink,
        name: 'vue',
        meta: {
          title: 'vue',
          icon: 'dashboard',
          link: 'https://cn.vuejs.org/',
          i18n: 'vue',
        },
      },
    ],
  },
  {
    path: '/redirect',
    component: Layout,
    hidden: true,
    name: REDIRECT_ROUTE_NAME,
    children: [
      {
        path: '/redirect/:path(.*)',
        component: () => import('@/components/layout/redirect.vue'),
      },
    ],
  },
  // login
  {
    path: '/login',
    component: () => import('@/components/login/index.vue'),
    hidden: true,
    name: 'Login',
  },
]

export const router = createRouter({
  // history: createWebHistory(),
  history: createWebHashHistory(import.meta.env.BASE_URL),
  routes: [...constantRoutes, ...FixedRoutes, ...PerfStaticRoutes] as Readonly<RouteRecordRaw[]>,
  scrollBehavior() {
    return { top: 0 }
  },
})

export async function setupRoutes(app: App) {
  setupChunkRecoveryOnStaleBuild()
  app.use(router)
  await useRouterGuard(router)
  await router.isReady()
}

// 同时覆盖 Vite 预加载和路由动态 import；标记防止产物缺文件时无限刷新。
function setupChunkRecoveryOnStaleBuild() {
  const FLAG = 'ttp:chunk-reloaded'

  const recoverOnce = (reason: string) => {
    if (sessionStorage.getItem(FLAG)) {
      console.error(`[chunk] 刷新后依然加载失败，请检查前端产物是否完整：${reason}`)
      return
    }
    sessionStorage.setItem(FLAG, '1')
    console.warn(`[chunk] 检测到前端已发新版本，开始恢复：${reason}`)
    recoverFromStaleChunk()
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    recoverOnce('vite:preloadError')
  })

  router.onError((error) => {
    const message = String((error as Error)?.message ?? error)
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message))
      recoverOnce(message)
  })

  // 成功进入页面就清掉标记，让下一次发版仍能自动恢复
  router.afterEach(() => sessionStorage.removeItem(FLAG))
}
