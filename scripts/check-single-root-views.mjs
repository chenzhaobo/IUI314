#!/usr/bin/env node
/**
 * 护栏：路由视图不得使用多根模板（fragment 根）。
 *
 * ## 为什么要钉住
 * `app-main.vue` 用 `<transition>` + `<keep-alive>` 包路由组件，并把
 * `class="app-main-content p-l-15px ..."` 传给它。多根模板会带来两个后果：
 *
 * 1. **class 被静默丢弃** —— Vue 只能把非 prop 属性自动继承到单个根元素上。
 *    页面因此没有内边距和背景，而控制台只是一条容易被忽略的告警。
 * 2. 曾经更严重：配 `mode="out-in"` 时，fragment 根的 `vnode.el` 是文本锚点，
 *    `Transition` 的 leave 钩子对它做 `classList.add` 会抛 TypeError，
 *    `afterLeave` 永不触发 → `state.isLeaving` 永久为 true →
 *    **之后每次导航都只渲染空占位符**，整个应用白屏且刷新前不可恢复。
 *    （已去掉 out-in，所以现在最坏只是第 1 条；但仍不该放任。）
 *
 * 注意"多根"比直觉宽：顶层多一个 `<a-modal>` 算多根，**根上留一段注释也算**。
 * 上一次修复就是因为把说明注释写在根 `<div>` 之外而没真正生效 ——
 * 所以这里用 Vue 编译器的产物判定，而不是数标签。
 *
 * 用法：node scripts/check-single-root-views.mjs
 * 退出码非 0 表示存在多根路由视图。
 */
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
// 走 vue 自带的 compiler-sfc 导出：@vue/compiler-sfc 不是本项目的直接依赖，
// pnpm 严格 node_modules 下 require 不到。
const { parse, compileTemplate } = require('vue/compiler-sfc')

const VIEWS = 'src/views'

/** 递归收集 .vue 文件 */
function walk(dir) {
  const out = []
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory())
      out.push(...walk(p))
    else if (e.name.endsWith('.vue'))
      out.push(p)
  }
  return out
}

/**
 * 只检查**被路由的**视图。
 *
 * 判据两条，都要满足：
 * 1. 声明了 `defineOptions({ name })` —— 路由视图必须声明（keep-alive 的
 *    `:include` 按它匹配）。
 * 2. 路径里**不含** `pages/` 或 `components/` 段 —— 这是本项目的既有约定：
 *    路由视图是 `system/auth/dept-manage.vue`，而它的子表放在
 *    `system/auth/pages/dept/dept-manage-table.vue`。子组件多根是**合法**的，
 *    它们不由 app-main 直接渲染，不会丢 class、也不参与路由过渡。
 *
 * 权威来源本应是 `sys_menu.component`（路由名与组件路径都存在库里），
 * 但构建期脚本不连库，所以用目录约定近似。代价：新写的路由视图若放进
 * `pages/` 目录会被漏检 —— 那本身就违反约定，评审时应该拦住。
 */
function isRoutedView(file, src) {
  if (!/defineOptions\(\s*\{[^}]*\bname\s*:/.test(src))
    return false
  const segs = file.split(path.sep)
  return !segs.includes('pages') && !segs.includes('components')
}

const offenders = []
for (const file of walk(VIEWS)) {
  const src = fs.readFileSync(file, 'utf8')
  if (!isRoutedView(file, src))
    continue
  const { descriptor } = parse(src, { filename: file })
  if (!descriptor.template)
    continue
  let code
  try {
    code = compileTemplate({ id: 'guard', filename: file, source: descriptor.template.content }).code
  }
  catch {
    continue // 编译不过是另一个问题，交给 vue-tsc/build 报
  }
  if (/return\s*\(?\s*_openBlock\(\),\s*_createElementBlock\(_Fragment/.test(code))
    offenders.push(file)
}

if (offenders.length > 0) {
  console.error('✘ 以下路由视图是多根模板（fragment 根），会让 app-main 传的 class 被静默丢弃：')
  for (const f of offenders)
    console.error(`    ${f}`)
  console.error('\n  修法：把整个 template 包进**一个**根元素。注意根上不要留注释 ——')
  console.error('  注释也算一个根节点，会让"包了 div"的修复失效（踩过）。')
  process.exit(1)
}

console.log('✔ 所有路由视图均为单根模板')
