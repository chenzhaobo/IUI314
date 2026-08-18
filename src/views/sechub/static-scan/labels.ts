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
