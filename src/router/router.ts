import type { App } from 'vue'
import {
  type RouteRecordRaw,
  createRouter,
  createWebHashHistory,
} from 'vue-router'

import { FixedRoutes, InnerLink, Layout, REDIRECT_ROUTE_NAME } from './constant'
import { useRouterGuard } from '@/hooks'
import type { AppRouteRecordRaw } from '@/types/base/router'

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
  routes: [...constantRoutes, ...FixedRoutes] as Readonly<RouteRecordRaw[]>,
  scrollBehavior() {
    return { top: 0 }
  },
})

export async function setupRoutes(app: App) {
  app.use(router)
  setupChunkReloadOnStaleBuild()
  await useRouterGuard(router)
  await router.isReady()
}

/**
 * 发版后旧页面加载不到新 chunk 时，自动刷新一次。
 *
 * 现象（生产实测）：
 *   GET /assets/TaskManage-D9ev2A-x.js  404
 *   GET /assets/css-CtzW9YGa.js         404
 * 然后点「报告任务」菜单页面卡死、没有任何提示。
 *
 * 原因：浏览器里跑的是上一版的入口 JS，它按旧哈希去 import 分包；新版发布后那些
 * 文件名已经变了，服务器上不存在。动态 import 失败 → router 的导航 Promise
 * 一直悬着 → 界面停在原地，看起来像"卡死"。此前没有任何兜底。
 *
 * 两处都要接：vite 的 preloadError 事件覆盖预加载失败，router.onError 覆盖
 * 真正 import 时抛错的情况。用 sessionStorage 打标，确保只刷一次 —— 否则
 * 真正的资源缺失（部署不完整）会变成无限刷新。
 */
function setupChunkReloadOnStaleBuild() {
  const FLAG = 'ttp:chunk-reloaded'

  const reloadOnce = (reason: string) => {
    if (sessionStorage.getItem(FLAG)) {
      // 刷过一次仍然失败，说明不是缓存问题而是产物真的缺文件，不再刷
      console.error(`[chunk] 刷新后依然加载失败，请检查前端产物是否完整：${reason}`)
      return
    }
    sessionStorage.setItem(FLAG, '1')
    console.warn(`[chunk] 检测到前端已发新版本，自动刷新以加载新产物：${reason}`)
    window.location.reload()
  }

  window.addEventListener('vite:preloadError', (event) => {
    event.preventDefault()
    reloadOnce('vite:preloadError')
  })

  router.onError((error) => {
    const message = String((error as Error)?.message ?? error)
    if (/Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module/i.test(message))
      reloadOnce(message)
  })

  // 成功进入页面就清掉标记，让下一次发版仍能自动恢复
  router.afterEach(() => sessionStorage.removeItem(FLAG))
}
