/**
 * 表格通用能力：列默认值（不换行 + hover 看全）与自适应高度（表格内滚动）。
 *
 * 这两件事全站 77 个表格都需要，但都是 Arco 的 opt-in 能力，逐页写必然漏：
 *
 * - **行高不齐**：长内容默认折行，同一张表里有的行 1 行高有的 5 行高。
 *   全站 716 个列声明只有 252 个（35%）设了 `ellipsis`。行高统一已在
 *   `assets/css/arco.scss` 用全局 CSS 兜住，但 CSS **做不到 hover 出提示** ——
 *   那需要列级 `tooltip: true`，所以有了 [`withTableDefaults`]。
 * - **整页滚动**：77 个表格里只有 11 个设了 `:scroll.y`，其余 66 个数据一多
 *   就得拖整个页面的滚动条，表头也跟着滚出视口，看到第 30 行时已经不知道哪列是哪列。
 *   固定 `y: 400` 之类的写法在大屏上又浪费半屏，所以有了 [`useTableAutoHeight`]。
 */

import { computed, onMounted, onUnmounted, ref, unref } from 'vue'
import type { Ref } from 'vue'

/** Arco 列配置里我们会批量补的字段（只列用到的，避免引入 Arco 类型依赖） */
interface ColumnLike {
  dataIndex?: string
  slotName?: string
  ellipsis?: boolean
  tooltip?: boolean | Record<string, any>
  width?: number
  [key: string]: any
}

/**
 * 给列批量补上「不换行 + 溢出省略 + hover 显示完整内容」。
 *
 * 只处理**纯文本列**（有 `dataIndex` 且没有 `slotName`）：带插槽的列渲染的是标签、
 * 按钮组、进度条，截断会把按钮切掉，交给页面自己决定。
 *
 * 已显式写了 `ellipsis` / `tooltip` 的列不覆盖 —— 页面可能故意要让某列换行
 * （例如唯一一列长文本描述），显式意图优先于默认值。
 *
 * @example
 * const columns = computed(() => withTableDefaults([
 *   { title: '名称', dataIndex: 'name', width: 160 },
 *   { title: '操作', slotName: 'ops', width: 120 },   // 插槽列不动
 * ]))
 */
export function withTableDefaults<T extends ColumnLike>(columns: T[]): T[] {
  return columns.map((col) => {
    const isTextColumn = Boolean(col.dataIndex) && !col.slotName
    if (!isTextColumn)
      return col
    return {
      ...col,
      ellipsis: col.ellipsis ?? true,
      tooltip: col.tooltip ?? true,
    }
  })
}

/** [`useTableAutoHeight`] 的可调项 */
export interface TableAutoHeightOptions {
  /**
   * 表格下方还要留出的高度（分页条、卡片内边距、页面底部留白等）。
   * 默认 96：Arco 分页条约 56px + 卡片下内边距 20px + 余量 20px。
   */
  reserve?: number
  /** 高度下限，防止在小窗口/短视口下算出负值或只剩一两行 */
  min?: number
  /** 关掉自适应（返回 undefined，表格退回不限高、整页滚动） */
  disabled?: boolean
}

/**
 * 算出表格体的可用高度，喂给 `:scroll="{ y: tableHeight }"`，
 * 让**滚动条出现在表格内部**、表头固定不动，页面本身不再产生长滚动条。
 *
 * 算法：视口高度 − 表格容器距视口顶部的距离 − `reserve`。
 * 用容器的实时 `getBoundingClientRect().top` 而不是写死的偏移量，
 * 这样上方的筛选卡片展开/收起、面包屑换行都能自动跟随，不用为每个页面调参。
 *
 * @example
 * const tableWrap = ref<HTMLElement>()
 * const { tableHeight } = useTableAutoHeight(tableWrap)
 * // <div ref="tableWrap"><a-table :scroll="{ x: 1400, y: tableHeight }" /></div>
 */
export function useTableAutoHeight(
  /** 表格外层容器的 ref；用它的位置反推可用高度 */
  container: Ref<HTMLElement | undefined | null>,
  options?: TableAutoHeightOptions,
) {
  const reserve = options?.reserve ?? 96
  const min = options?.min ?? 200

  const viewportHeight = ref(typeof window === 'undefined' ? 0 : window.innerHeight)
  const containerTop = ref(0)

  function measure() {
    if (typeof window === 'undefined')
      return
    viewportHeight.value = window.innerHeight
    const el = unref(container)
    containerTop.value = el ? el.getBoundingClientRect().top : 0
  }

  const tableHeight = computed<number | undefined>(() => {
    if (options?.disabled)
      return undefined
    const available = viewportHeight.value - containerTop.value - reserve
    return Math.max(min, Math.round(available))
  })

  let observer: ResizeObserver | undefined

  onMounted(() => {
    measure()
    window.addEventListener('resize', measure)
    // 上方筛选区展开/收起不会触发 window resize，但会改变容器的 top，
    // 所以还要观察 body 尺寸变化。ResizeObserver 在目标环境（Chrome/Edge）均可用；
    // 兜底判断是为了 SSR/单测里没有该 API 时不炸。
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(measure)
      observer.observe(document.body)
    }
  })

  onUnmounted(() => {
    window.removeEventListener('resize', measure)
    observer?.disconnect()
  })

  return { tableHeight, measure }
}
