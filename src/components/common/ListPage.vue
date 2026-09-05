<script lang="ts" setup>
/**
 * 列表页骨架：筛选区 / 左侧栏 / 工具行 / 表格，四块的高度与滚动全部由本组件负责。
 *
 * ## 为什么要有这个组件
 * 这套骨架在本项目里被手写了 10 次，每次都漏掉一两个细节，而且每个细节都会
 * 变成一条用户反馈：
 *
 * | 漏掉的东西 | 用户看到的现象 |
 * |---|---|
 * | 布局行没有**确定高度**（只写 `flex:1` 而父级不是 flex，或用 `a-row/a-col`） | 左树越展开页面越长，整页出现滚动条 |
 * | flex 子项没写 `min-height: 0` | 内部 `overflow` 永不触发，表格把父级顶高 |
 * | 只写 `overflow-y: auto` | 横向被 CSS 规范计算成 auto，`a-row` 的 gutter 负外边距探出容器 → 多一条横向滚动条 |
 * | 滚动容器套在**整栏**上 | 统计行/工具行跟着滚走，表头也离开视口 |
 * | 高度 `ref` 挂在含工具行的外层 | 可用高度多算工具行，表格溢出、分页条被顶出视口 |
 * | 写死 `calc(100vh - Npx)` | 偏移与实际顶边不符，超出视口或底部留白 |
 * | 忘记 `@page-size-change` | 每页条数改了没反应（见 [`usePagedQuery`]） |
 *
 * 这些都不是"想不到"，而是"每次都要记全"。做成组件后页面只管填内容。
 *
 * ## 用法
 * ```vue
 * <ListPage aside-title="扫描点分类" :aside-width="240" aside-resizable>
 *   <template #filter>
 *     <a-space wrap> …筛选控件… </a-space>
 *   </template>
 *   <template #aside>
 *     <a-tree :data="treeData" />
 *   </template>
 *   <template #toolbar>
 *     <a-button type="primary">新增</a-button>
 *   </template>
 *   <template #default="{ tableHeight }">
 *     <a-table :data="rows" :pagination="pagination" :scroll="{ minWidth: 1600, y: tableHeight }"
 *              @page-change="onPageChange" @page-size-change="onPageSizeChange" />
 *   </template>
 * </ListPage>
 * ```
 *
 * 四个插槽都是可选的：没有左树就不写 `#aside`，没有工具行就不写 `#toolbar`，
 * 组件不会为它们留出空白。
 *
 * ## 关于 `:scroll` 里的 `minWidth`
 * 用 `minWidth` 而不是 `x`：Arco 把 `scroll.x` 直接当成表格的 `width`
 * （`es/table/table.js` 的 `headerStyle`/`contentStyle`），容器更宽时表格会停在那个宽度、
 * 右边留白。`minWidth` 则保持 `width: auto`（跟着容器拉伸），只在容器更窄时才滚动，
 * 而 `fixed: 'right'` 的固定列定位照样有效（`isScroll.x` 同时接受两者）。
 */
import { computed, ref } from 'vue'

import { useAutoHeight, useTableAutoHeight } from '@/hooks'

defineOptions({ name: 'ListPage' })

const props = withDefaults(defineProps<{
  /** 左侧栏标题；不传且没有 `#aside-title` 插槽时不渲染标题条 */
  asideTitle?: string
  /** 左侧栏宽度（px） */
  asideWidth?: number
  /** 允许拖动分栏改变左侧栏宽度 */
  asideResizable?: boolean
  /** 左侧栏可拖动的宽度范围 */
  asideMinWidth?: number
  asideMaxWidth?: number
  /** 主体区最小高度，防止极小窗口下压成一条 */
  minBodyHeight?: number
}>(), {
  asideWidth: 260,
  asideResizable: false,
  asideMinWidth: 180,
  asideMaxWidth: 520,
  minBodyHeight: 320,
})

const bodyRef = ref<HTMLElement>()
const tableRef = ref<HTMLElement>()

/**
 * 主体区高度：实测本组件主体的顶边再反推，绝不写死 `calc(100vh - Npx)`
 * —— 写死值只要与实际顶边不符就会超出视口或留白，而顶边随面包屑、
 * 筛选区展开收起、浏览器缩放而变。
 */
const { height: bodyH } = useAutoHeight(bodyRef, { min: props.minBodyHeight })

/**
 * 表格体高度：`fillParent` 直接取容器高度。
 *
 * 这里**必须**用 fillParent 而不是从视口反推：`.lp-table` 是定高主体里的
 * `flex: 1` 子项，高度已经确定；再从视口算一遍会与这块空间差出一截
 * （两者各减不同余量），表格溢出后就会把分页条顶出视口。
 */
const { tableHeight } = useTableAutoHeight(tableRef, { fillParent: true })

// ── 分栏拖动 ────────────────────────────────────────────────
const innerAsideWidth = ref(props.asideWidth)
const dragging = ref(false)

const asideStyle = computed(() => ({ width: `${innerAsideWidth.value}px` }))

function onHandleDown(e: PointerEvent) {
  if (!props.asideResizable)
    return
  const startX = e.clientX
  const startW = innerAsideWidth.value
  dragging.value = true
  // 用 Pointer Events 而不是 mouse+touch 两套；setPointerCapture 保证指针移出手柄后
  // 仍持续收到 move，不会"拖一半丢失"
  const el = e.currentTarget as HTMLElement
  el.setPointerCapture(e.pointerId)

  const move = (ev: PointerEvent) => {
    const next = startW + (ev.clientX - startX)
    innerAsideWidth.value = Math.min(props.asideMaxWidth, Math.max(props.asideMinWidth, next))
  }
  const up = (ev: PointerEvent) => {
    dragging.value = false
    el.releasePointerCapture?.(ev.pointerId)
    el.removeEventListener('pointermove', move)
    el.removeEventListener('pointerup', up)
    el.removeEventListener('pointercancel', up)
  }
  el.addEventListener('pointermove', move)
  el.addEventListener('pointerup', up)
  el.addEventListener('pointercancel', up)
}

defineExpose({ tableHeight, bodyHeight: bodyH })
</script>

<template>
  <!-- 单根：路由视图护栏要求（多根会让 app-main 的 transition 卡死整个路由出口） -->
  <div class="list-page">
    <!-- 筛选区：固定不滚 -->
    <a-card v-if="$slots.filter" :bordered="false" class="lp-filter">
      <slot name="filter" />
    </a-card>

    <!--
      主体：唯一有确定高度的一层。左右两栏都从它派生高度，
      于是各自在内部滚动，页面本身不会被顶长。
    -->
    <div ref="bodyRef" class="lp-body" :class="{ dragging }" :style="{ height: bodyH ? `${bodyH}px` : undefined }">
      <template v-if="$slots.aside">
        <aside class="lp-aside" :style="asideStyle">
          <div v-if="asideTitle || $slots['aside-title']" class="lp-aside-title">
            <slot name="aside-title">{{ asideTitle }}</slot>
          </div>
          <!-- 只有这一层滚：标题条留在原位，不会跟着滚走 -->
          <div class="lp-aside-body">
            <slot name="aside" />
          </div>
        </aside>

        <!-- 拖动手柄；不可拖时仍渲染成一条分隔线，避免开关拖动导致布局跳动 -->
        <div
          class="lp-handle"
          :class="{ resizable: asideResizable }"
          @pointerdown="onHandleDown"
        />
      </template>

      <div class="lp-main">
        <!-- 工具行：固定，不参与滚动 -->
        <div v-if="$slots.toolbar" class="lp-toolbar">
          <slot name="toolbar" />
        </div>

        <!--
          表格区：吃掉主体剩余高度。高度 ref 挂在**只包表格**的这一层 ——
          挂到含工具行的外层会把工具行高度也算进可用高度，表格就会溢出。
        -->
        <div ref="tableRef" class="lp-table">
          <slot :table-height="tableHeight" />
        </div>
      </div>
    </div>
  </div>
</template>

<style lang="scss" scoped>
.list-page {
  display: flex;
  flex-direction: column;
  /* min-height:0 是子项能被压缩到内容以下的前提；缺了它内部 overflow 永不触发 */
  min-height: 0;
}

.lp-filter {
  flex-shrink: 0;
  margin-bottom: 12px;
}

.lp-body {
  display: flex;
  gap: 0;
  align-items: stretch;
  min-height: 0;
}

.lp-body.dragging {
  cursor: col-resize;
  user-select: none;
}

.lp-aside {
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
  min-height: 0;
}

.lp-aside-title {
  flex-shrink: 0;
  padding: 0 0 8px;
  color: var(--color-text-1);
  font-weight: 600;
  font-size: 14px;
}

.lp-aside-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  /*
    必须显式写 overflow-x。CSS 规范：overflow 两轴一个是 auto/scroll、
    另一个是 visible 时，visible 会被**计算成 auto** —— 只写纵向等于同时开了横向滚动。
    而 Arco 的 `<a-row :gutter="N">` 靠负外边距做列间距，天生探出容器，
    会因此凭空长出一条横向滚动条。
  */
  overflow-x: hidden;
  /* 滚到底不要把滚动传给页面，否则滚树会意外把整页滚走 */
  overscroll-behavior: contain;
}

.lp-handle {
  flex-shrink: 0;
  width: 9px;
  margin: 0 3px;
  background: var(--color-border-2);
  border-radius: 2px;
}

.lp-handle.resizable {
  cursor: col-resize;
  transition: background-color 0.15s;

  &:hover {
    background: rgb(var(--primary-6));
  }
}

.lp-main {
  display: flex;
  flex-direction: column;
  flex: 1;
  /* min-width:0 让主区能被压缩，否则宽表格会把左栏挤没 */
  min-width: 0;
  min-height: 0;
}

.lp-toolbar {
  display: flex;
  flex-wrap: wrap;
  flex-shrink: 0;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.lp-table {
  flex: 1;
  min-height: 0;
}
</style>
