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
   * 容器下方**固定**留白（卡片下内边距、页面底部留白）。
   *
   * 默认 32，比早期的 96 小很多 —— 因为分页条等**下方兄弟节点的高度现在是实测的**
   * （见 measureBelow），不再需要靠这个常量去猜。常量猜大了表格填不满、
   * 猜小了表格越过视口撑出页面滚动条，两种症状都出现过。
   */
  reserve?: number
  /** 高度下限，防止在小窗口/短视口下算出负值或只剩一两行 */
  min?: number
  /** 关掉自适应（返回 undefined，表格退回不限高、整页滚动） */
  disabled?: boolean
  /**
   * 容器**已经有确定高度**时改用容器自身高度，而不是从视口反推。
   *
   * 适用于容器处在一条完整的高度链里 —— 例如外层 flex 行已经有实测的 `height`，
   * 容器是它的 `flex: 1` 子项。这种情况下视口反推必然与父级实际剩余空间有偏差
   * （两者各自减去不同的余量），表现为表格下方留一段空白。
   *
   * 用容器自身高度是**安全**的，前提正是"高度确定"：此时容器高度**不随表格高度变化**，
   * 所以可以直接 ResizeObserver 观察容器而不会形成自激回路。
   * 若容器高度其实是内容驱动的（auto），打开这个选项会造成回路 —— 别这么用。
   */
  fillParent?: boolean
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
  const reserve = options?.reserve ?? 32
  const min = options?.min ?? 200

  const viewportHeight = ref(typeof window === 'undefined' ? 0 : window.innerHeight)
  const containerTop = ref(0)
  /** 容器下方兄弟节点的总高度（分页条等），实测而非用常量猜 */
  const belowHeight = ref(0)
  /** fillParent 模式下容器自身的高度 */
  const containerHeight = ref(0)

  /**
   * 元素下方还有多少内容（分页条、底部说明、额外按钮行……）。
   *
   * 原来这部分靠常量 `reserve` 猜（默认 96 = 分页条 56 + 内边距 20 + 余量 20）。
   * 猜小了表格底边就越过视口 → **整页多出滚动条**；猜大了表格就填不满、
   * 下方留白 —— 用户同时反馈了这两种相反的症状，正是因为不同页面下方内容不同，
   * 一个常量不可能同时对。
   *
   * 这里改成**实测**：把容器之后的所有兄弟节点高度加起来。
   * 只看兄弟节点是有意的 —— 它们的高度不随表格高度变化，不会形成反馈回路。
   */
  /** 元素高度 + 上下外边距；元素不存在或隐藏时返回 0 */
  function outerHeight(node: Element | null) {
    if (!node)
      return 0
    const r = node.getBoundingClientRect()
    if (r.height === 0)
      return 0
    const cs = window.getComputedStyle(node)
    return r.height + Number.parseFloat(cs.marginTop || '0') + Number.parseFloat(cs.marginBottom || '0')
  }

  function measureBelow(el: HTMLElement) {
    let total = 0
    let sib = el.nextElementSibling
    while (sib) {
      const r = sib.getBoundingClientRect()
      // 隐藏元素 rect 为 0，天然不计入
      total += r.height
      sib = sib.nextElementSibling
    }
    if (total > 0)
      total += 12 // 兄弟之间与容器底部的间距无法逐一测量，留一点余量

    /*
      分页条要单独找：Arco 把它渲染在 `<a-table>` **内部**
      （`.arco-table-pagination` 与 `.arco-table-container` 同级），
      所以它不是本容器的兄弟节点，上面那圈遍历看不到它。

      漏掉它的后果是可用高度多算一个分页条的高度（约 56px + 16px 上外边距），
      表格体撑到分页条被顶出视口 —— 翻页按钮就点不到了。
      早期版本靠 `reserve = 96` 这个常量把它包含进去，但常量对"没有分页的表"
      又会多减，所以这里改成按实际存在与否去测。
    */
    total += outerHeight(el.querySelector('.arco-table-pagination'))

    /*
      表头同样要减掉。

      关键是 `scroll.y` 在 Arco 里落到的是**表格体**（`.arco-table-body`）的
      max-height，**不含表头**。所以：

          表格总高 = 表头 + 表格体 + 分页条

      只减分页条时，整张表就比可用空间高出一个表头（约 40~48px），
      页面因此还是要滚一小段 —— 现象是"看起来快对了，但还得往下滚一点"。
      早期 `reserve = 96` 的常量里混着表头这份，改成实测后一度漏掉了它。

      表头高度取实测而非常量：`size="mini|small|medium"`、多级表头、
      带筛选图标的表头高度都不一样。
    */
    /*
      `.arco-table-header` 这个独立元素**只在表头与表体分离时才存在** ——
      Arco 的判定是 `isScroll.y || stickyHeader || 虚拟列表 || (isScroll.x && 无数据)`
      （`table.js` 的 `splitTable`）。

      而 `scroll.y` 恰好是我们**算出来才会设上**的，于是首帧还没有它，
      测不到表头就会把高度算大一点，等表头出现后第二次测量才修正 ——
      用户能看到表格加载后轻微收缩一次。
      所以拿不到独立表头时退回量 `thead`（单表格形态下的表头行），一次就准。
    */
    total += outerHeight(el.querySelector('.arco-table-header') ?? el.querySelector('thead'))

    return total
  }

  function measure() {
    if (typeof window === 'undefined')
      return
    const el = unref(container)
    if (!el)
      return
    const rect = el.getBoundingClientRect()
    // top <= 0 说明还没真正参与布局（挂载瞬间、或在隐藏的 tab 里）。
    // 此时若照算，得到的高度接近整个视口 —— 而现在高度还会作为 min-height
    // 强制生效，直接把页面顶出一条滚动条。所以宁可先不出高度。
    if (rect.top <= 0)
      return
    const nextVh = window.innerHeight
    if (Math.abs(nextVh - viewportHeight.value) > 2)
      viewportHeight.value = nextVh
    if (Math.abs(rect.top - containerTop.value) > 2)
      containerTop.value = rect.top
    const nextBelow = measureBelow(el)
    if (Math.abs(nextBelow - belowHeight.value) > 2)
      belowHeight.value = nextBelow
    if (options?.fillParent) {
      const own = el.clientHeight
      if (own > 0 && Math.abs(own - containerHeight.value) > 2)
        containerHeight.value = own
    }
  }

  const tableHeight = computed<number | undefined>(() => {
    if (options?.disabled)
      return undefined
    // 还没测到有效位置时不给高度：让表格先按内容渲染，
    // 比给一个错的高度（撑出页面滚动条）好
    if (options?.fillParent) {
      if (containerHeight.value <= 0)
        return undefined
      return Math.max(min, Math.round(containerHeight.value - belowHeight.value))
    }
    if (containerTop.value <= 0)
      return undefined
    const available = viewportHeight.value - containerTop.value - reserve - belowHeight.value
    return Math.max(min, Math.round(available))
  })

  /**
   * 观察容器**上方**兄弟节点的尺寸变化。
   *
   * 上方内容（筛选区展开收起、统计卡片异步加载出来）一变，容器顶边就变，
   * 不重测高度就是错的 —— 这是"表格填不满"最常见的成因：挂载那一刻统计卡片
   * 还没渲染，顶边偏小；等它出来后顶边下移，但高度没跟着改。
   *
   * 只观察上方兄弟是关键：它们的高度**不依赖**表格高度，所以不会出现
   * 「改高度 → 布局变 → 又来测量」的自激回路（第一版观察 document.body 就踩了这个，
   * Chrome 直接报 ResizeObserver loop 并丢帧）。
   */
  let observer: ResizeObserver | null = null

  function observeSiblingsAbove() {
    if (typeof ResizeObserver === 'undefined')
      return
    const el = unref(container)
    if (!el)
      return
    observer?.disconnect()
    observer = new ResizeObserver(() => measure())
    let sib = el.previousElementSibling
    while (sib) {
      observer.observe(sib)
      sib = sib.previousElementSibling
    }
    // 下方兄弟同样要观察：分页条在数据加载后才出现，出现前后可用高度不同
    let next = el.nextElementSibling
    while (next) {
      observer.observe(next)
      next = next.nextElementSibling
    }
    // fillParent 模式下容器高度由外层 flex 决定、不随表格变化，观察它是安全的
    if (options?.fillParent)
      observer.observe(el)
    // 分页条在数据回来后才渲染，出现/消失都会改变可用高度。
    // 观察它是安全的：分页条高度固定，不随表格体高度变化。
    // 分页条在数据回来后才渲染；表头在列变化时高度会变。
    // 两者高度都**不随表格体高度变化**，所以观察它们不会形成自激回路。
    for (const sel of ['.arco-table-pagination', '.arco-table-header']) {
      const node = el.querySelector(sel)
      if (node)
        observer.observe(node)
    }
  }

  /**
   * 分几个时机复测。
   *
   * 单次 `requestAnimationFrame` 不够：页面数据是异步来的，首帧时筛选区上方的
   * 统计卡片、分页条往往还没渲染，测出的顶边偏小。这里按 0 / 1 帧 / 120ms / 400ms
   * 各测一次，覆盖"接口回来后才渲染"的常见情形；有 2px 阈值兜着，
   * 重复测量不会造成多余的响应式写入。
   */
  const timers: number[] = []
  function scheduleMeasures() {
    measure()
    requestAnimationFrame(() => {
      measure()
      observeSiblingsAbove()
    })
    timers.push(window.setTimeout(measure, 120), window.setTimeout(() => {
      measure()
      // 上方内容可能整块换掉（v-if 切换），重新挂观察者
      observeSiblingsAbove()
    }, 400))
  }

  onMounted(() => {
    scheduleMeasures()
    window.addEventListener('resize', measure)
  })

  // 页面被 keep-alive 缓存后，再次进入不会走 onMounted，但窗口尺寸/布局可能已变，
  // 不重测就会用上次的旧高度。
  onActivated(() => {
    scheduleMeasures()
  })

  onUnmounted(() => {
    window.removeEventListener('resize', measure)
    observer?.disconnect()
    timers.forEach(t => window.clearTimeout(t))
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
    reserve: options?.reserve ?? 16,
    min: options?.min ?? 160,
    disabled: options?.disabled,
  })

  // 给 maxHeight 而不是 height：内容不足时面板按内容收缩，不会撑出一大片空白。
  // 配合 `.panel-scroll-y`（内含 min-height:0 + overflow-y:auto）即可内部滚动。
  const style = computed(() => (height.value == null ? {} : { maxHeight: `${height.value}px` }))

  return { height, style, measure }
}
