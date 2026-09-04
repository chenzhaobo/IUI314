import { onMounted, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * 把页面的筛选条件暂存起来，页内往返时自动恢复。
 *
 * ## 为什么需要
 *
 * 布局的 keep-alive 是 `<component :key="route.fullPath">` —— key 里带 query。
 * 所以只要 URL 上的 query 变一下（从别处跳进来带 ?run_id=xxx、或页面自己同步 URL），
 * Vue 就认为是新组件、重建实例，ref 全部回到初始值，用户刚设好的筛选条件被清空。
 *
 * 直接把 key 改成 route.path 能一劳永逸，但全站有 12 个页面读 route.query、
 * 其中只有一个自己 watch 处理变化，改全局 key 会让另外 11 个页面在 query 变化时
 * 不再刷新 —— 影响面太大。所以这里只给需要的页面做局部持久化。
 *
 * ## 什么时候该恢复、什么时候该重置
 *
 * - **页内往返**（点进详情再返回、切页签回来）→ 恢复上次的筛选，这是本工具的目的。
 * - **带参数跳转进入**（从别的页面点「查看明细」，URL 带 run_id 等）→ 不恢复，
 *   因为用户的意图是"看这个特定对象"，套用上次的筛选会看不到预期数据。
 * - **新页签/刷新** → sessionStorage 天然按标签页隔离，新标签页读不到，等于重置。
 *
 * 用 sessionStorage 而不是 localStorage：筛选条件是"这次操作期间"的临时状态，
 * 关掉标签页就该忘掉；localStorage 会让下次打开系统还带着上周的筛选，更困扰。
 */
export function useFilterPersistence(
  storageKey: string,
  /** 要持久化的响应式条件，键名任意，恢复时按键回填 */
  refs: Record<string, Ref<any>>,
  options?: {
    /** 返回 true 时跳过恢复（例如检测到是带参数跳转进入） */
    skipRestore?: () => boolean
  },
) {
  const key = `ttp:filters:${storageKey}`

  function save() {
    try {
      const snapshot: Record<string, any> = {}
      for (const [k, r] of Object.entries(refs))
        snapshot[k] = r.value
      sessionStorage.setItem(key, JSON.stringify(snapshot))
    }
    catch {
      // 存不下就算了（隐私模式/超配额），筛选丢失不影响功能
    }
  }

  function restore() {
    try {
      const raw = sessionStorage.getItem(key)
      if (!raw)
        return
      const snapshot = JSON.parse(raw) as Record<string, any>
      for (const [k, r] of Object.entries(refs)) {
        if (k in snapshot && snapshot[k] !== undefined)
          r.value = snapshot[k]
      }
    }
    catch {
      // 数据格式变了（改过字段）就忽略，按默认值走
      sessionStorage.removeItem(key)
    }
  }

  onMounted(() => {
    if (options?.skipRestore?.())
      return
    restore()
  })

  // 任一条件变化就存。deep 是必要的：columnFilters 是嵌套对象，
  // 改的是里面的 op/value，浅监听收不到。
  watch(
    () => Object.fromEntries(Object.entries(refs).map(([k, r]) => [k, r.value])),
    save,
    { deep: true },
  )

  return { save, restore, clear: () => sessionStorage.removeItem(key) }
}
