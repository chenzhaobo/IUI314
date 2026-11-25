export interface CustomApiReportSections {
  callChain: string
  findings: string
  excluded: string
  fixSuggestions: string
}

export interface CustomApiReportIndex {
  byMethodPath: Record<string, CustomApiReportSections>
  byPath: Record<string, CustomApiReportSections>
}

interface ApiReportBlock {
  method: string
  path: string
  lines: string[]
}

const HTTP_METHODS = /^(GET|POST|PUT|DELETE|PATCH|HEAD|OPTIONS)\s+/i

function normalizePath(value: string): string {
  return value.replace(/[`*]/g, '').replace(/（.*$/, '').trim()
}

interface ReportHeading {
  title: string
  /** `###` 一定是顶级小节；粗体还需结合标题白名单判断 */
  alwaysBoundary: boolean
}

function sectionHeading(line: string): ReportHeading | null {
  const markdownHeading = line.match(/^###\s+/)
  if (markdownHeading)
    return { title: line.slice(markdownHeading[0].length).trim(), alwaysBoundary: true }
  const boldHeading = line.match(/^\*\*([^*]+)\*\*\s*$/)
  return boldHeading?.[1] ? { title: boldHeading[1].trim(), alwaysBoundary: false } : null
}

function isTopLevelSection(title: string): boolean {
  const normalized = title.replace(/^\d+[.、]\s*/, '')
  return ['实现定位', '调用链', '发现的问题', '证据代码与排除依据', '证据与排除依据', '已排除', '修复建议', '结论']
    .some(prefix => normalized.startsWith(prefix))
}

function parseApiHeading(line: string): { method: string, path: string } | null {
  const match = line.match(/^##\s+A\d+\s*[·:：-]\s*/i)
  if (!match)
    return null
  const descriptor = line.slice(match[0].length).trim()
  const method = descriptor.match(HTTP_METHODS)?.[1]?.toUpperCase() ?? ''
  const path = normalizePath(method ? descriptor.slice(method.length).trim() : descriptor).split(/\s+/)[0] ?? ''
  return path ? { method, path } : null
}

function sectionContent(lines: string[], predicate: (title: string) => boolean): string {
  const sections: string[] = []
  let collecting = false
  let current: string[] = []
  const flush = () => {
    const content = current.join('\n').trim()
    if (content)
      sections.push(content)
    current = []
  }

  for (const line of lines) {
    const heading = sectionHeading(line)
    if (heading) {
      const matches = predicate(heading.title)
      // `**证据 1**`、`**利用方式**` 是问题正文，不是新小节，不能截断 F1/F2。
      if (heading.alwaysBoundary || matches || isTopLevelSection(heading.title)) {
        if (collecting)
          flush()
        collecting = matches
        continue
      }
    }
    if (collecting)
      current.push(line)
  }
  if (collecting)
    flush()
  return sections.join('\n\n')
}

function parseSections(lines: string[]): CustomApiReportSections {
  return {
    callChain: sectionContent(lines, title => title.includes('调用链')),
    findings: sectionContent(lines, title => title.includes('发现的问题') || title.includes('证据代码与排除依据') || title.includes('证据与排除依据') || title.startsWith('结论')),
    excluded: sectionContent(lines, title => title.includes('已排除')),
    fixSuggestions: sectionContent(lines, title => title.includes('修复建议')),
  }
}

function methodPathKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${normalizePath(path)}`
}

/** 按 AI 报告中的 `## A1 · GET /path` 分节，并提取详情所需的三个小节。 */
export function buildCustomApiReportIndex(markdown?: string | null): CustomApiReportIndex {
  const index: CustomApiReportIndex = { byMethodPath: {}, byPath: {} }
  if (!markdown)
    return index

  const blocks: ApiReportBlock[] = []
  let current: ApiReportBlock | null = null
  for (const line of markdown.replace(/\r\n?/g, '\n').split('\n')) {
    const heading = parseApiHeading(line)
    if (heading) {
      current = { ...heading, lines: [] }
      blocks.push(current)
      continue
    }
    if (/^##\s+/.test(line))
      current = null
    if (current)
      current.lines.push(line)
  }

  for (const block of blocks) {
    const sections = parseSections(block.lines)
    if (block.method)
      index.byMethodPath[methodPathKey(block.method, block.path)] = sections
    index.byPath[normalizePath(block.path)] = sections
  }
  return index
}

/** 同路径多方法时优先精确匹配 HTTP 方法；方法缺失时退回路径匹配。 */
export function reportSectionsForItem(index: CustomApiReportIndex, item: { call_path: string, http_method?: string | null }): CustomApiReportSections | null {
  const path = normalizePath(item.call_path)
  if (item.http_method) {
    const exact = index.byMethodPath[methodPathKey(item.http_method, path)]
    if (exact)
      return exact
  }
  return index.byPath[path] ?? null
}

/** 报告弹窗只显示平台总览；完整 Markdown 仍保留给逐接口详情解析。 */
export function customApiReportOverview(markdown?: string | null): string {
  if (!markdown)
    return ''
  const lines = markdown.replace(/\r\n?/g, '\n').split('\n')
  const overview = lines.findIndex(line => /^##\s+检测结果总览\s*$/.test(line))
  if (overview >= 0) {
    let end = lines.length
    for (let i = overview + 1; i < lines.length; i++) {
      if (/^---\s*$/.test(lines[i]) || /^##\s+AI 扫描报告/.test(lines[i])) {
        end = i
        break
      }
    }
    return lines.slice(0, end).join('\n').trimEnd()
  }
  const firstApi = lines.findIndex(line => /^#{2,3}\s+A\d+\s*[·:：-]/.test(line))
  return (firstApi >= 0 ? lines.slice(0, firstApi) : lines).join('\n').trimEnd()
}
