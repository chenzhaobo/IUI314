/**
 * 护栏：禁止在页面里写死 `calc(100vh - Npx)` 之类的视口偏移。
 *
 * ## 为什么要拦
 * 这种写法算出的底边是 `元素实际顶边 + (100vh - N)`。只要顶边不正好等于 N，
 * 底边就超出视口 → 整页多出一条滚动条；而顶边会随面包屑有无、筛选区展开收起、
 * 浏览器缩放而变化，所以**它必然在某些状态下是错的**，不是调 N 能修好的。
 *
 * 这个问题已经反复出现（「规则版本」「问题台账」两页的页面滚动条、
 * 「达标率趋势」底部空白都是它），逐页排查成本高且会持续复发，所以用护栏一次性拦住。
 *
 * ## 正确做法
 * 用 `@/hooks` 的 `useAutoHeight`（面板/树/图表）或 `useTableAutoHeight`（表格），
 * 它们实测容器顶边再反推高度。
 *
 * ## 为什么放行弹窗与抽屉
 * `<a-modal>` / `<a-drawer>` 是**视口锚定**的 —— 它们 teleport 到 body、
 * 从视口边缘展开，高度本来就该按视口算，`calc(100vh - 120px)` 在那里是正确写法。
 *
 * 判定用**区域扫描**而不是「往上回看 N 行」：抽屉里的表格可能嵌在几十行之下
 * （`script.vue` 的事务明细表就是），回看窗口再大也不可靠。
 * 这里从头扫一遍，按 `<a-drawer` / `<a-modal` 与其闭合标签维护一个深度计数，
 * 深度大于 0 的行就在弹窗区域内。
 */

import { globSync, readFileSync } from 'node:fs'
import process from 'node:process'

const PATTERN = /calc\(\s*100vh\s*[-+]/

/** 允许写死视口高度的文件：本身就是视口级布局容器 */
const ALLOWLIST = new Set([
  'src/components/layout/app-main.vue',
])

/**
 * 标出每一行是否位于 `<a-drawer>` / `<a-modal>` 区域内。
 * 自闭合写法（`<a-modal ... />`）不进入区域。
 */
function markViewportAnchoredLines(lines) {
  const inAnchored = new Array(lines.length).fill(false)
  let depth = 0
  lines.forEach((line, idx) => {
    const opens = line.match(/<a-(?:drawer|modal)\b/g)?.length ?? 0
    const selfClosing = line.match(/<a-(?:drawer|modal)\b[^>]*\/>/g)?.length ?? 0
    const closes = line.match(/<\/a-(?:drawer|modal)>/g)?.length ?? 0
    depth += opens - selfClosing
    // 本行是否算在区域内：开标签所在行起算，闭标签所在行也算
    inAnchored[idx] = depth > 0 || closes > 0
    depth -= closes
    if (depth < 0)
      depth = 0
  })
  return inAnchored
}

/**
 * 标出注释行。文档里会引用这个写法本身（正如本文件所做），
 * 不跳过注释会把说明文字当成违规。
 * 只做行级近似：HTML 注释按 `<!-- -->` 配对，JS/CSS 按 `//` 与 `/* *​/`。
 */
function markCommentLines(lines) {
  const isComment = new Array(lines.length).fill(false)
  let inHtml = false
  let inBlock = false
  lines.forEach((line, idx) => {
    const t = line.trim()
    if (inHtml || inBlock) {
      isComment[idx] = true
      if (inHtml && t.includes('-->'))
        inHtml = false
      if (inBlock && t.includes('*/'))
        inBlock = false
      return
    }
    if (t.startsWith('//') || t.startsWith('*')) {
      isComment[idx] = true
      return
    }
    if (t.startsWith('<!--')) {
      isComment[idx] = true
      if (!t.includes('-->'))
        inHtml = true
      return
    }
    if (t.startsWith('/*')) {
      isComment[idx] = true
      if (!t.includes('*/'))
        inBlock = true
    }
  })
  return isComment
}

const files = globSync('src/**/*.vue')
const offenders = []

for (const file of files) {
  const rel = file.replace(/\\/g, '/')
  if (ALLOWLIST.has(rel))
    continue
  const lines = readFileSync(file, 'utf-8').split(/\r?\n/)
  const anchored = markViewportAnchoredLines(lines)
  const comments = markCommentLines(lines)
  lines.forEach((line, idx) => {
    if (!PATTERN.test(line) || anchored[idx] || comments[idx])
      return
    offenders.push(`${rel}:${idx + 1}\n    ${line.trim()}`)
  })
}

if (offenders.length) {
  console.error(
    `\n✗ 发现 ${offenders.length} 处写死的视口高度偏移：\n\n${offenders.map(o => `  ${o}`).join('\n\n')}\n`
    + '\n  这种写法算出的底边 = 元素实际顶边 + (100vh - N)，顶边不等于 N 时就超出视口，'
    + '\n  表现为整页多一条滚动条或底部留白，且随面包屑/筛选区/缩放而变化。'
    + '\n\n  改用 @/hooks 的 useAutoHeight（面板、树、图表）或 useTableAutoHeight（表格），'
    + '\n  它们实测容器顶边再反推。弹窗/抽屉内的视口锚定写法本护栏会自动放行。\n',
  )
  process.exit(1)
}

console.log('✔ 未发现写死的视口高度偏移')
