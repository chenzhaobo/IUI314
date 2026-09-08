import { defineStore } from 'pinia'

import { unref } from 'vue'
import {
  ErrorPageRoute,
  InnerLink,
  Layout,
  NotFound,
  NotFoundRoute,
} from '@/router/constant'
import { constantRoutes } from '@/router/router'
import type { AppRouteRecordRaw, Component } from '@/types/base/router'
import { MenuType } from '@/types/base/router'
import { useGet } from '@/hooks'
import { ApiSysLogin } from '@/api/sysApis'

const views: Record<string, Component> = import.meta.glob('@/views/**/*.vue')

export const usePermissionStore = defineStore('permission', {
  state: () => ({
    routes: new Array<AppRouteRecordRaw>(),
    addRoutes: new Array<AppRouteRecordRaw>(),
    isReloading: true,
    routeIsDone: false,
    serverError: false,
  }),
  getters: {
    getPermissionRoutes(): AppRouteRecordRaw[] {
      return this.routes
    },
  },
  actions: {
    setRoutes(routes: AppRouteRecordRaw[]) {
      this.addRoutes = routes
      this.routes = [
        ...constantRoutes,
        ...routes,
        NotFoundRoute,
        ErrorPageRoute,
      ]
    },
    async generateRoutes(): Promise<AppRouteRecordRaw[] | null> {
      const { data, execute } = useGet<AppRouteRecordRaw[]>(ApiSysLogin.getRouters)
      await execute()
      const routes = unref(data)
      // 请求失败时 useRequest 会把 data 换成 ErrorFlag 哨兵（字符串 '__________'）。
      // 这里原来直接 `as AppRouteRecordRaw[]` 强转往下走，后果是白屏 + 控制台
      // "e.filter is not a function"：
      //   · generateFlatRoutes 收到字符串**不会报错** —— 字符串可迭代，for...of 会
      //     遍历出 10 个 '_' 字符，返回一个垃圾数组，问题被藏过去；
      //   · 真正抛错的是下一行 filterAsyncRouter(routes, false)，字符串没有 .filter。
      // 更糟的是这个异常在路由守卫里同步抛出，会**打断 401 的自愈路径**：
      // afterFetch 已经调过 log_out()，但它的 router.push('/login') 延迟 500ms，
      // 崩溃正好落在这个窗口内，用户看到白屏而不是「登录已过期」+ 登录页。
      // 全仓其余 30 多处调用都判了 ErrorFlag，只有这里漏了。
      //
      // 返回 null 而不是 []：两者语义不同 —— [] 是「拉到了但这个角色没有菜单」
      // （合法状态，扫码新建号分到空菜单角色时就是这样），null 是「没拉到」。
      if (!Array.isArray(routes)) {
        this.setRoutes([])
        return null
      }
      // routers 生成正常的路由数据，用于菜单生成等
      // AccessRouters  将正常路由转换为二级扁平路由，用于keep-live和生成路由表
      // 注意：generateFlatRoutes 必须在 filterAsyncRouter 之前执行，
      // 因为 filterAsyncRouter 会原地修改路由对象（component 字符串→函数），
      // 若先执行会导致扁平路由的 component 已是函数，loadView 无法匹配→NotFound。
      const AccessRouters = filterAsyncRouter(generateFlatRoutes(routes))
      const routers = filterAsyncRouter(routes, false)
      //  设置菜单路由
      this.setRoutes(routers)
      // 返回扁平路由
      return AccessRouters
      // return routers
    },
    setIsReloading(isReloading: boolean) {
      this.isReloading = isReloading
    },
    setRouteIsDone(v: boolean) {
      this.routeIsDone = v
    },
    setServerError(v: boolean) {
      this.serverError = v
    },
  },
})

function filterAsyncRouter(
  asyncRouterMap: AppRouteRecordRaw[],
  type = true,
) {
  return asyncRouterMap.filter((route) => {
    if (type && route.children)
      route.children = filterChildren(route.children)

    if (route.menu_type === MenuType.M && route.pid === '0')
      route.component = 'Layout'

    if (route.component) {
      if (route.component === 'Layout')
        route.component = Layout
      else if (route.component === 'InnerLink')
        route.component = InnerLink
      else
        route.component = loadView(route.component)
    }
    if (route.children && route.children.length > 0) {
      route.children = filterAsyncRouter(route.children, type)
    }
    else {
      delete route.children
      delete route.redirect
    }
    return true
  })
}

function loadView(view: string) {
  // 幂等保护：若 component 已被加载为函数（非字符串），直接返回
  if (typeof view !== 'string')
    return view as unknown as Component
  let res = NotFound
  for (const path in views) {
    const dir = path.split('views/')[1].split('.vue')[0]
    if (dir === view)
      res = () => views[path]()
  }
  return res
}

function filterChildren(childrenMap: AppRouteRecordRaw[]) {
  let children = new Array<AppRouteRecordRaw>()
  childrenMap.forEach((el) => {
    if (el.children && el.children.length) {
      // ParentView 或嵌套目录型菜单(M 且非顶级)：将其子级提升并拼接路径前缀
      if (el.component === 'ParentView' || (el.menu_type === MenuType.M && el.pid !== '0')) {
        el.children.forEach((c) => {
          c.path = c.path ? `${el.path}/${c.path}` : c.path
          if (c.children && c.children.length) {
            children = children.concat(filterChildren(c.children))
            return
          }
          children.push(c)
        })
        return
      }
    }
    children = children.concat(el)
  })
  return children
}

/**
 * vue router 无法keep-live 三级及其以上的路由数据  需要将路由数据拍平成两级
 * @param {AppRouteRecordRaw[]} accessRoutes
 * @return {AppRouteRecordRaw[]}  flatRoutes
 */
function generateFlatRoutes(
  accessRoutes: AppRouteRecordRaw[],
): AppRouteRecordRaw[] {
  const flatRoutes: AppRouteRecordRaw[] = []

  for (const item of accessRoutes) {
    let childrenFlatRoutes: AppRouteRecordRaw[] = []
    const r = { ...item }

    if (item.children && item.children.length > 0)
      childrenFlatRoutes = castToFlatRoute(item.children, '')

    // 一级路由是布局路由,需要处理的只是其子路由数据
    r.children = childrenFlatRoutes
    flatRoutes.push(r)
  }

  return flatRoutes
}

/**
 * 将子路由转换为扁平化路由数组（仅一级）
 * @param {AppRouteRecordRaw[]} routes
 * @param {string} parentPath
 * @param flatRoutes
 */
function castToFlatRoute(
  routes: AppRouteRecordRaw[],
  parentPath: string,
  flatRoutes: AppRouteRecordRaw[] = [],
): AppRouteRecordRaw[] {
  for (const item of routes) {
    if (item.children && item.children.length > 0) {
      if (item.redirect && item.redirect !== 'noRedirect') {
        const r = { ...item }
        r.path = (`${parentPath}/${item.path}`).substring(1)
        flatRoutes.push(r)
      }
      castToFlatRoute(item.children, `${parentPath}/${item.path}`, flatRoutes)
    }
    else {
      const r = { ...item }
      r.path = (`${parentPath}/${item.path}`).substring(1)
      flatRoutes.push(r)
    }
  }
  return flatRoutes
}
