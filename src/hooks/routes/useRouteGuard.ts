import { Message } from '@arco-design/web-vue'
import NProgress from 'nprogress'
import type { RouteRecordRaw, Router } from 'vue-router'

import { isHttp, setRouteEmitter, useToken } from '@/hooks'
import {
  ErrorPageRoute,
  NotFoundRoute,
} from '@/router/constant'
import { useAppStore, usePermissionStore, useUserStore } from '@/stores'

const whiteList = ['/login']

NProgress.configure({ showSpinner: false })

/**
 * 全局路由守卫。
 *
 * ## 为什么改成 return 而不是 next()
 * vue-router 4 已弃用 `next()` 回调，每次导航都会打一条
 * `The next() callback in navigation guards is deprecated`。
 * 一次登录会刷出十几条，把真正有用的告警埋掉。
 *
 * 语义等价关系：
 *   `next()`        → `return true`（或 `return undefined`）
 *   `next(false)`   → `return false`
 *   `next('/x')`    → `return '/x'`
 *   `next({ ... })` → `return { ... }`
 *
 * 改造时特别注意 **`NProgress.done()` 必须在 return 之前执行** ——
 * 原实现有几处是 `next(...)` 之后再 `NProgress.done()`，换成 return 后
 * 那一行就成了死代码，进度条会一直转。这里统一用一个 `finish()` 辅助函数
 * 把「收尾 + 返回值」绑在一起，避免漏掉。
 * （`afterEach` 里也有 `NProgress.done()`，但被拦截/重定向的导航不一定走到
 *   afterEach，所以每个分支仍要自己收尾。）
 */
export async function useRouterGuard(router: Router) {
  const permissionStore = usePermissionStore()

  /** 收尾并返回导航结果：把 NProgress.done() 和 return 绑在一起，防止漏掉 */
  function finish<T>(result: T): T {
    NProgress.done()
    return result
  }

  router.beforeEach(async (to) => {
    permissionStore.setRouteIsDone(false)
    NProgress.start()
    setRouteEmitter(to) // 监听路由变化
    to.meta.title && useAppStore().setAppTitle(to.meta.title, to.meta.i18n!) // 设置浏览器标题
    const { valid } = useToken()

    // ── 没有 token ────────────────────────────────────────────────
    if (!valid) {
      if (whiteList.includes(to.path))
        return finish(true) // 在免登录白名单，直接进入
      return finish(`/login?redirect=${to.fullPath}`) // 否则全部重定向到登录页
    }

    // ── token 有效 ────────────────────────────────────────────────
    if (to.path === '/login') {
      // serverError 时允许停留在登录页，避免 token 仍有效导致
      // /login → / → getUserInfo 死循环
      if (permissionStore.serverError)
        return finish(true)
      return finish({ path: '/' })
    }

    if (!permissionStore.isReloading)
      return finish(true)

    // 首次进入 / 刷新后：拉用户信息并动态注册路由
    const userStore = useUserStore()
    if (!(await userStore.getUserInfo())) {
      // 后端不可达：标记 serverError 并重置 isReloading，跳转登录页。
      // 不清除 token，用户刷新后若后端恢复可正常登录。
      permissionStore.setServerError(true)
      permissionStore.setIsReloading(false)
      Message.error('无法连接服务器，请检查后端服务是否正常')
      return finish('/login')
    }

    permissionStore.setServerError(false)
    const aRoutes = await permissionStore.generateRoutes()
    aRoutes.forEach((aRoute) => {
      if (!isHttp(aRoute.path))
        router.addRoute(aRoute as RouteRecordRaw)
    })
    router.addRoute(NotFoundRoute as RouteRecordRaw)
    router.addRoute(ErrorPageRoute as RouteRecordRaw)
    permissionStore.setIsReloading(false)
    // 路由刚注册好，重新走一遍当前目标才能匹配到它
    return finish({ ...to, replace: true })
  })

  router.afterEach(() => {
    NProgress.done()
    permissionStore.setRouteIsDone(true)
  })
}
