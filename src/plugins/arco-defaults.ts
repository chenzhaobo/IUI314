/**
 * 全站 Arco 组件默认值补丁。
 *
 * ## 为什么改默认值而不是逐页加属性
 * 「列宽可拖动」是表级属性 `column-resizable`，Arco 默认关闭。全站有 77 张表，
 * 逐页去加已经反复漏（用户逐个页面反馈"这张表不能拖"），而且新增页面还会继续漏 ——
 * 这类「本该是默认行为」的能力应该一次性改默认值，而不是靠纪律。
 *
 * 判据是 Arco 的 props 声明里 `columnResizable` **没有写 default**：
 *
 *     columnResizable: { type: Boolean },     // es/table/table.js
 *
 * Vue 对 Boolean 类型的 prop 在无 default 时按 `false` 处理，所以补一个
 * `default: true` 就把全站默认翻过来了；页面若显式写 `:column-resizable="false"`
 * 仍然优先，不会被这里覆盖。
 *
 * ## 为什么这样是安全的
 * Arco 内部只对**有 `dataIndex` 且不是最后一列**的表头生成拖动手柄
 * （`table.js`：`props.columnResizable && Boolean(column.dataIndex) && index < row.length - 1`），
 * 所以纯插槽列（操作列、复选框列）不会长出手柄，也不会因此改变布局。
 *
 * ## 必须在挂载前调用
 * 改的是组件定义上的 props 声明，一旦某个表已经渲染过，它的 props 已解析完毕，
 * 再改不会回溯。所以在 `main.ts` 里 `app.mount()` 之前调用。
 */
import { Table } from '@arco-design/web-vue'

export function applyArcoDefaults() {
  const tableProps = (Table as unknown as { props?: Record<string, any> }).props
  // 防御性判断：Arco 升级后若 props 形态变化（改成数组式声明、或字段改名），
  // 这里静默跳过而不是抛错崩掉整个应用 —— 代价只是回到"要逐页写"的状态。
  const prop = tableProps?.columnResizable
  if (prop && typeof prop === 'object' && !('default' in prop))
    prop.default = true
}
