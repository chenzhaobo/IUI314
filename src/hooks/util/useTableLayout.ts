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

import { computed, onActivated, onMounted, onUnmounted, ref, unref, watch } from 'vue'
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
 * 让**滚动条出现在表格内部**、表头固定不动。
 *
 * ## 为什么不用 ResizeObserver 观察 body（踩过）
 * 第一版是 `new ResizeObserver(measure).observe(document.body)`，想让上方筛选区
 * 展开/收起时自动跟随。但这构成**反馈回路**：
 *   measure → tableHeight 变 → 表格体高度变 → body 高度变 → observer 再触发 → …
 * Chrome 会报 `ResizeObserver loop completed with undelivered notifications`
 * 并丢帧；而本应用的内容还嵌在 `<a-scrollbar>` 里、外面又套了两层 Arco 的
 * `ResizeObserver` 组件（在 Vue 警告的组件栈里能看到），叠起来足以把渲染卡死。
 *
 * 现在只在**确定的时机**测量：挂载后、窗口尺寸变化、keep-alive 重新激活，
 * 外加一个 2px 阈值 —— 高度没有实质变化就不写 ref，从根上断掉自激。
 * 筛选区展开这类布局变化不再自动跟随，需要时由页面自己调返回的 `measure()`。
 *
 * ## 为什么用 rect.top 而不是 offsetTop
 * 容器可能嵌在若干层布局里，逐层累加 offsetTop 容易漏掉滚动容器。
 * 但 `getBoundingClientRect().top` 是**视口相对**的，页面滚动时会变 ——
 * 所以只在上述离散时机取值，不跟随滚动，否则滚动时表格高度会跳。
 *
 * ## 为什么还要写一个 CSS 变量（表格「填不满」的根因）
 * `:scroll.y` 在 Arco 里落到的是 **`max-height`**（`es/table/table.js`：
 * `maxHeight: isNumber(scroll.y) ? `${scroll.y}px` : '100%'`），不是 `height`。
 * 也就是说它只**限制上界**：数据多了在表格内滚（这是我们要的），
 * 但数据只有三五行时表格就只有三五行那么高，下方露出一大片空白 ——
 * 用户反馈的「好多表格还是很小」就是这个。
 *
 * 补 `min-height` 才能填满，可高度是每张表算出来的、写不进静态 CSS。
 * 所以这里把算出的值以 CSS 变量 `--ttp-table-body-h` **直接写到容器元素上**，
 * 由 `assets/css/arco.scss` 里的一条全局规则消费。
 *
 * 这么做的好处是**已经接入过的页面一行都不用改**就同时获得填满行为；
 * 代价是耦合了一个变量名，故两处注释互相指明。
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
    const el = unref(container)
    const nextTop = el ? el.getBoundingClientRect().top : 0
    const nextVh = window.innerHeight
    // 2px 阈值：高度没有实质变化就不写 ref。这是断开
    // 「改高度 → 触发布局变化 → 又来测量」自激回路的关键一环。
    if (Math.abs(nextVh - viewportHeight.value) > 2)
      viewportHeight.value = nextVh
    if (Math.abs(nextTop - containerTop.value) > 2)
      containerTop.value = nextTop
  }

  const tableHeight = computed<number | undefined>(() => {
    if (options?.disabled)
      return undefined
    const available = viewportHeight.value - containerTop.value - reserve
    return Math.max(min, Math.round(available))
  })

  onMounted(() => {
    // 等一帧再测：挂载瞬间上方的筛选卡片可能还没渲染完，此时 top 偏小、
    // 会算出过高的表格高度，导致首屏出现一次多余的整页滚动条。
    requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
  })

  // 页面被 keep-alive 缓存后，再次进入不会走 onMounted，但窗口尺寸/布局可能已变，
  // 不重测就会用上次的旧高度。
  onActivated(() => {
    requestAnimationFrame(measure)
  })

  onUnmounted(() => {
    window.removeEventListener('resize', measure)
  })

  // 把算出的高度以 CSS 变量写到容器上，供 arco.scss 里的
  // `.arco-table-body { min-height: var(--ttp-table-body-h) }` 消费，
  // 让数据少的表格也填满可用高度（详见上方文档「表格填不满」一节）。
  // 用 watch 而不是在 measure() 里写：measure 只更新测量源，
  // tableHeight 是 computed，中间还有 min 下限与取整。
  watch(tableHeight, (h) => {
    const el = unref(container)
    if (!el)
      return
    if (h == null)
      el.style.removeProperty('--ttp-table-body-h')
    else
      el.style.setProperty('--ttp-table-body-h', `${h}px`)
  }, { immediate: true, flush: 'post' })

  return { tableHeight, measure }
}

/**
 * 通用「量出可用高度」——[`useTableAutoHeight`] 的非表格版本，给左树、侧栏、图表用。
 *
 * ## 为什么需要它（写死 `calc(100vh - Npx)` 为什么必然出错）
 * 这些面板此前一律写 `max-height: calc(100vh - 220px)` 之类的**写死偏移**。
 * 只要面板实际顶边不在 220px 处，高度就是错的：
 *
 *     面板底边 = 顶边 + (100vh - 220)
 *
 * 顶边 > 220 时底边就超出视口 → **整页多出一条滚动条**，而这正是
 * 「规则版本」「问题台账」两页反馈的现象。写死值还会随面包屑有无、
 * 筛选区展开收起、浏览器缩放而失准 —— 属于必然出错的写法，不是调参数能修好的。
 *
 * 这里改成和表格一样**实测顶边**再反推，从根上消掉这一类问题。
 *
 * @example
 * const treePanel = ref<HTMLElement>()
 * const { style: treeStyle } = useAutoHeight(treePanel)
 * // <div ref="treePanel" class="panel-scroll-y" :style="treeStyle">…树…</div>
 */
export function useAutoHeight(
  container: Ref<HTMLElement | undefined | null>,
  options?: TableAutoHeightOptions,
) {
  // 复用表格那套测量：同样只在挂载后 / resize / keep-alive 激活时取值，
  // 同样带 2px 阈值断开自激回路（原因见 useTableAutoHeight 的文档）。
  const { tableHeight: height, measure } = useTableAutoHeight(container, {
    // 面板下方一般没有分页条，留白比表格少
    reserve: options?.reserve ?? 24,
    min: options?.min ?? 160,
    disabled: options?.disabled,
  })

  // 给 maxHeight 而不是 height：内容不足时面板按内容收缩，不会撑出一大片空白。
  // 配合 `.panel-scroll-y`（内含 min-height:0 + overflow-y:auto）即可内部滚动。
  const style = computed(() => (height.value == null ? {} : { maxHeight: `${height.value}px` }))

  return { height, style, measure }
}
