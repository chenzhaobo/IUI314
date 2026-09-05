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

/**
 * 第二项检查：只写 `overflow-y: auto/scroll` 而不写 `overflow-x`。
 *
 * CSS 规范规定，`overflow` 两轴中一个是 auto/scroll 而另一个是 visible 时，
 * **visible 会被计算成 auto**。所以只写纵向等于同时开了横向滚动。
 *
 * 而 Arco 的 `<a-row :gutter="N">` 靠**负外边距**（左右各 -N/2）做列间距，
 * 天生探出容器 —— 于是这类容器普遍多出一条横向滚动条。
 * 这个坑在本项目里出现了十几处、被用户反复反馈，所以一并拦住。
 *
 * 弹窗/抽屉的 body-style 放行：它们有内边距，gutter 的负外边距探不出去。
 */
const OVERFLOW_Y = /overflow-y:\s*(auto|scroll)|overflowY:\s*['"](auto|scroll)['"]/
const HAS_OVERFLOW_X = /overflow-x|overflowX/

// 也扫 scss —— 共享工具类里同样栽过这个坑（`.panel-scroll-y` 只写了 overflow-y）
/**
 * 第三项检查：`<style scoped>` 里定义了但模板/脚本里没用到的类（孤儿规则）。
 *
 * ## 为什么要拦
 * 改类名时很容易只改一处。真实案例：问题列表的工具行模板改成了
 * `class="table-toolbar"`，样式里却还是 `.toolbar` —— 于是
 * **工具行完全没有 flex 布局**（按钮紧贴、导出/新增没被推到右端），
 * 而 `vue-tsc` 和 `vite build` 都不会报错，只有用户看到。
 *
 * 孤儿规则就是这种脱节的可检测信号：类名改了，旧规则留在原地没人用。
 *
 * ## 为什么噪音可控
 * `<style scoped>` 是**页面局部**的，里面的类本就应该在同一个文件里用到。
 * 需要排除的只有几类"不由本文件模板写出"的类名，列在 CLASS_ALLOW 里。
 */
const CLASS_ALLOW = [
  /^arco-/, // Arco 内部类（嵌套选择器里直接写、不一定套 :deep）
  /^router-link/, // vue-router 自动加的
  /-(enter|leave)(-(from|to|active))?$/, // <transition name="x"> 自动生成的 x-enter-from 等
  /^markdown-body$/, // md 渲染库的类
]

/**
 * 动态类名：`:class="[\`side-${x}\`]"` 这种拼出来的，静态搜不到。
 * 只要模板里出现过同前缀的模板字符串，就认为该类可能被用到。
 */
function usedDynamically(rest, cls) {
  const parts = cls.split('-')
  for (let i = parts.length - 1; i > 0; i--) {
    if (rest.includes(`\`${parts.slice(0, i).join('-')}-$`))
      return true
  }
  return false
}

const files = [...globSync('src/**/*.vue'), ...globSync('src/**/*.scss')]
const offenders = []
const overflowOffenders = []
const orphanOffenders = []

for (const file of files) {
  const rel = file.replace(/\\/g, '/')
  if (ALLOWLIST.has(rel))
    continue
  const raw = readFileSync(file, 'utf-8')
  const lines = raw.split(/\r?\n/)
  // 孤儿 scoped 类
  if (rel.endsWith('.vue')) {
    const styleMatch = raw.match(/<style[^>]*\bscoped\b[^>]*>([\s\S]*?)<\/style>/)
    if (styleMatch) {
      // :deep(...) 内部是子组件的类，不该出现在本文件模板里
      const own = styleMatch[1].replace(/:deep\([^)]*\)/g, ' ')
      const defined = new Set([...own.matchAll(/(?:^|[\s,>+~])\.([a-zA-Z][\w-]*)/g)].map(x => x[1]))
      const rest = raw.slice(0, raw.indexOf(styleMatch[0]))
      for (const cls of defined) {
        if (CLASS_ALLOW.some(re => re.test(cls)))
          continue
        if (usedDynamically(rest, cls))
          continue
        const used = new RegExp(`["'\\s.]${cls.replace(/-/g, '\\-')}["'\\s.$]`).test(rest)
        if (!used)
          orphanOffenders.push(`${rel}  →  .${cls}`)
      }
    }
  }

  const anchored = markViewportAnchoredLines(lines)
  const comments = markCommentLines(lines)
  lines.forEach((line, idx) => {
    if (comments[idx])
      return
    if (PATTERN.test(line) && !anchored[idx])
      offenders.push(`${rel}:${idx + 1}\n    ${line.trim()}`)
    if (OVERFLOW_Y.test(line) && !anchored[idx]) {
      // overflow-x 可能写在相邻行（多行 CSS 块），前后各看 3 行
      const near = lines.slice(Math.max(0, idx - 3), idx + 4).join('\n')
      if (!HAS_OVERFLOW_X.test(near))
        overflowOffenders.push(`${rel}:${idx + 1}\n    ${line.trim()}`)
    }
  })
}

if (orphanOffenders.length) {
  console.error(
    `\n✗ 发现 ${orphanOffenders.length} 处 <style scoped> 里定义了但没用到的类：\n\n${orphanOffenders.map(o => `  ${o}`).join('\n')}\n`
    + '\n  这通常意味着**类名改了一半**：模板换了新名字，旧样式规则留在原地。'
    + '\n  真实案例：模板改成 class="table-toolbar" 而样式里还是 .toolbar，'
    + '\n  结果工具行完全没有 flex 布局，而 vue-tsc 与 vite build 都不报错。'
    + '\n\n  要么删掉没用的规则，要么把模板/样式改成同一个名字。'
    + '\n  确实由外部写入的类名（Arco 内部、路由、过场动画）请加进 CLASS_ALLOW。\n',
  )
  process.exit(1)
}

if (overflowOffenders.length) {
  console.error(
    `\n✗ 发现 ${overflowOffenders.length} 处只写了纵向 overflow：\n\n${overflowOffenders.map(o => `  ${o}`).join('\n\n')}\n`
    + '\n  CSS 规范：overflow 两轴一个是 auto/scroll、另一个是 visible 时，'
    + '\n  visible 会被**计算成 auto** —— 只写 overflow-y 等于同时开了横向滚动。'
    + '\n  而 Arco 的 <a-row :gutter="N"> 用负外边距做列间距，天生探出容器，'
    + '\n  于是这类容器会凭空多一条横向滚动条。'
    + '\n\n  显式补上 `overflow-x: hidden`（容器内真需要横向滚动的表格自己有滚动容器）。'
    + '\n  弹窗/抽屉的 body-style 本护栏自动放行。\n',
  )
  process.exit(1)
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

console.log('✔ 视口高度、overflow 轴向、孤儿 scoped 类三项检查均通过')
