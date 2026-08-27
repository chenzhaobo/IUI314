/**
 * 静态扫描领域 / 分类中文标签映射（多页面共用）
 */

/** 领域 domain → 中文 */
export const domainLabels: Record<string, string> = {
  security: '安全',
  performance: '性能',
}

/** 安全检测分类 category → 中文 */
export const securityCategoryLabels: Record<string, string> = {
  'access-control': '访问控制',
  'cosmic-platform': '苍穹平台专项',
  'cryptography': '密码学',
  'deserialization': '反序列化',
  'file-upload': '文件上传',
  'idor': 'IDOR越权',
  'insecure-crypto': '弱密码学',
  'jndi-injection': 'JNDI注入',
  'ldap-injection': 'LDAP注入',
  'open-redirect': '开放重定向',
  'path-traversal': '路径穿越',
  'race-condition': '竞态条件',
  'rce': '远程命令执行',
  'sensitive-info': '敏感信息泄露',
  'sql-injection': 'SQL注入',
  'ssrf': 'SSRF请求伪造',
  'template-injection': '模板注入',
  'third-party': '第三方组件',
  'xpath-injection': 'XPath注入',
  'xss': 'XSS跨站脚本',
  'xxe': 'XXE实体注入',
}

/** 根据领域与分类 key 获取中文标签 */
export function categoryZhLabel(domain: string, category: string): string {
  if (domain === 'security')
    return securityCategoryLabels[category] ?? category
  return category
}

/** Run 运行状态 → 中文标签 + 色值 */
export const runStatusLabels: Record<string, { label: string, color: string }> = {
  succeeded: { label: '已完成', color: 'green' },
  pending: { label: '排队中', color: 'gray' },
  running: { label: '进行中', color: 'blue' },
  failed: { label: '失败', color: 'red' },
}

/** AI 候选状态 → 中文标签 + 色值（与 results.vue 保持一致） */
export const aiStatusLabels: Record<string, { label: string, color: string }> = {
  pending: { label: '待确认', color: 'gray' },
  confirmed: { label: '确认问题', color: 'red' },
  rejected: { label: '已排除', color: 'green' },
  error: { label: '错误', color: 'orange' },
  review_needed: { label: '需人工', color: 'orangered' },
}

/**
 * 确认状态子标签文案。
 * 优先级：error > review_needed > pending > 全部已确认。
 * 只有三者全为 0 时才返回"全部已确认"（绿色语义）。
 *
 * @param runStatus - run.status 字段
 * @param pendingCount - 待 AI 确认数量
 * @param errorCount - AI 确认出错数量（可选，旧调用方不传默认 0）
 * @param reviewNeededCount - 待人工复核数量（可选，旧调用方不传默认 0）
 */
export function pendingSubLabel(
  runStatus: string,
  pendingCount: number,
  errorCount = 0,
  reviewNeededCount = 0,
): string {
  // 三者全为 0 → 全部已确认
  if (pendingCount === 0 && errorCount === 0 && reviewNeededCount === 0)
    return '全部已确认'
  // error 优先
  if (errorCount > 0)
    return `有错误（${errorCount} 条）`
  // 仅 review_needed
  if (reviewNeededCount > 0 && pendingCount === 0)
    return `待人工复核（${reviewNeededCount} 条）`
  // pending > 0（可能同时有 review_needed）
  if (runStatus === 'pending')
    return `排队中（${pendingCount} 条待确认）`
  if (runStatus === 'running')
    return `确认中（${pendingCount} 条待确认）`
  // succeeded / failed：run 已结束但仍有 pending 候选
  return `${pendingCount} 条待确认`
}

/**
 * 确认状态列 tooltip 文案，列出各维度数量便于用户判断。
 *
 * @param pendingCount - 待 AI 确认数量
 * @param errorCount - AI 确认出错数量（可选，默认 0）
 * @param reviewNeededCount - 待人工复核数量（可选，默认 0）
 */
export function pendingTooltip(
  pendingCount: number,
  errorCount = 0,
  reviewNeededCount = 0,
): string {
  if (pendingCount === 0 && errorCount === 0 && reviewNeededCount === 0)
    return 'AI 确认已全部完成，无待处理项。'
  const parts: string[] = []
  if (pendingCount > 0)
    parts.push(`待 AI 确认：${pendingCount} 条`)
  if (errorCount > 0)
    parts.push(`AI 确认出错：${errorCount} 条`)
  if (reviewNeededCount > 0)
    parts.push(`待人工复核：${reviewNeededCount} 条`)
  return `${parts.join('，')}。点击"重扫未完成"可批量重试。`
}
