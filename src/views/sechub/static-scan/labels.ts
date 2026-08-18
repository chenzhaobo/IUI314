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
 * pending 子状态文案：根据 run.status + pending 候选数量推导可读描述。
 * 后端不返回细分子状态字段，仅用 status + 数量组合推导。
 */
export function pendingSubLabel(runStatus: string, pendingCount: number): string {
  if (pendingCount === 0)
    return '全部已确认'
  if (runStatus === 'pending')
    return `排队中（${pendingCount} 条待确认）`
  if (runStatus === 'running')
    return `确认中（${pendingCount} 条待确认）`
  // succeeded / failed：run 已结束但仍有 pending 候选
  return `${pendingCount} 条待确认`
}

/** pending 列 tooltip 文案 */
export const pendingTooltip = '这是同一次 Run 的 AI 确认进度，不是多个任务。待确认数会随 AI 逐条处理而递减。'
