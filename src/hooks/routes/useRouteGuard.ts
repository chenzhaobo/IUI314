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
// routerGuard
export async function useRouterGuard(router: Router) {
  const permissionStore = usePermissionStore()
  router.beforeEach(async (to, _from, next) => {
    permissionStore.setRouteIsDone(false)
    NProgress.start()
    setRouteEmitter(to) // 监听路由变化
    to.meta.title && useAppStore().setAppTitle(to.meta.title, to.meta.i18n!) // 设置浏览器标题
    const { valid } = useToken()
    //  token 有效
    if (valid) {
      if (to.path === '/login') {
        // serverError 时允许停留在登录页，避免 token 仍有效导致 /login → / → getUserInfo 死循环
        if (permissionStore.serverError) {
          next()
          NProgress.done()
        }
        else {
          next({ path: '/' })
          NProgress.done()
        }
      }
      else {
        const userStore = useUserStore()

        if (permissionStore.isReloading) {
          if (!(await userStore.getUserInfo())) {
            // 后端不可达：标记 serverError 并重置 isReloading，跳转登录页
            // 不清除 token，用户刷新后若后端恢复可正常登录
            permissionStore.setServerError(true)
            permissionStore.setIsReloading(false)
            Message.error('无法连接服务器，请检查后端服务是否正常')
            next('/login')
          }
          else {
            permissionStore.setServerError(false)
            const aRoutes = await permissionStore.generateRoutes()
            aRoutes.forEach((aRoute) => {
              if (!isHttp(aRoute.path))
                router.addRoute(aRoute as RouteRecordRaw)
            })
            router.addRoute(NotFoundRoute as RouteRecordRaw)
            router.addRoute(ErrorPageRoute as RouteRecordRaw)
            permissionStore.setIsReloading(false)
            next({ ...to, replace: true })
          }
        }
        else {
          next()
        }
        NProgress.done()
      }
    }
    else {
      // 没有token
      if (whiteList.includes(to.path)) {
        // 在免登录白名单，直接进入
        next()
        NProgress.done()
      }
      else {
        next(`/login?redirect=${to.fullPath}`) // 否则全部重定向到登录页
        NProgress.done()
      }
      // next()
    }
  })

  router.afterEach(() => {
    NProgress.done()
    permissionStore.setRouteIsDone(true)
  })
}
