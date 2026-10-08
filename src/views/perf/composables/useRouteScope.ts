/**
 * 从路由 query 读取外部带入的范围（如达标率看板「联查问题」：product_line + 云/应用/表单），
 * 供左侧范围树（IssueScopeTree 的 initialScope）首次定位与右表预过滤。
 *
 * 页面可能被 keep-alive 复用：再次从看板跳入、query 变了时 setup 不会重跑，
 * 所以监听 fullPath，落在本路由且带范围参数时回调 `onApply`（页面借此重挂左树）。
 */
import { ref, watch } from 'vue'
import { useRoute } from 'vue-router'

export interface RouteScope {
  product_line: string
  cloud_number?: string
  app_number?: string
  form_id?: string
}

const SCOPE_KEYS = ['cloud_number', 'app_number', 'form_id'] as const

export function useRouteScope(routeName: string, onApply: (scope: RouteScope) => void) {
  const route = useRoute()

  function readScope(): RouteScope | null {
    const text = (key: string) => {
      const v = route.query[key]
      return typeof v === 'string' ? v.trim() : ''
    }
    const scope: RouteScope = { product_line: text('product_line') || '星瀚' }
    for (const key of SCOPE_KEYS) {
      const v = text(key)
      if (v)
        scope[key] = v
    }
    return SCOPE_KEYS.some(key => scope[key]) ? scope : null
  }

  /** 首次定位用的范围；页面「重置」时应清空，避免重挂左树又回到带入的范围 */
  const initialScope = ref<RouteScope | null>(readScope())

  watch(() => route.fullPath, (now, prev) => {
    if (now === prev || route.name !== routeName)
      return
    const next = readScope()
    if (!next)
      return
    initialScope.value = next
    onApply(next)
  })

  return { initialScope }
}
