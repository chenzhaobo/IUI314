/** 自动化源配置 DTO；应用密钥和访问 Token 只进不出。 */

export type AutomationAuthMode = 'app_token' | 'token'

export interface AutomationSourceRow {
  id: string
  code: string
  name: string
  base_url: string
  token_path: string
  auth_mode: AutomationAuthMode
  app_id: string
  account_id: string
  task_id: string
  task_name: string
  page_size: number
  status: string
  remark?: string | null
  created_at?: string | null
  updated_at?: string | null
  has_app_secret: boolean
}

export interface AutomationSourceForm {
  id: string
  code: string
  name: string
  base_url: string
  token_path: string
  auth_mode: AutomationAuthMode
  app_id: string
  app_secret: string
  account_id: string
  task_id: string
  task_name: string
  page_size: number
  status: string
  remark: string
}

export interface AutomationSourceListFilter {
  keyword: string
  status: string
}

export interface AutomationTestResult {
  ok: boolean
  detail?: string | null
  error?: string | null
}

export function emptyAutomationSourceForm(): AutomationSourceForm {
  return {
    id: '',
    code: '',
    name: '',
    base_url: '',
    token_path: '/open/getAppToken',
    auth_mode: 'token',
    app_id: '',
    app_secret: '',
    account_id: '',
    task_id: '',
    task_name: '',
    page_size: 200,
    status: '0',
    remark: '',
  }
}

export function automationSourceFormOf(row: AutomationSourceRow): AutomationSourceForm {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    base_url: row.base_url,
    token_path: row.token_path,
    auth_mode: row.auth_mode,
    app_id: row.app_id,
    app_secret: '',
    account_id: row.account_id,
    task_id: row.task_id,
    task_name: row.task_name,
    page_size: row.page_size,
    status: row.status,
    remark: row.remark ?? '',
  }
}

export function buildAutomationSourcePayload(form: AutomationSourceForm): Record<string, unknown> {
  const text = (value: string) => value.trim()
  const payload: Record<string, unknown> = {
    code: text(form.code),
    name: text(form.name),
    base_url: text(form.base_url),
    token_path: text(form.token_path) || '/open/getAppToken',
    auth_mode: form.auth_mode,
    app_id: text(form.app_id),
    account_id: text(form.account_id),
    task_id: text(form.task_id),
    task_name: text(form.task_name),
    page_size: form.page_size,
    status: form.status,
    remark: text(form.remark) || null,
  }
  if (form.id)
    payload.id = form.id
  if (form.app_secret)
    payload.app_secret = form.app_secret
  return payload
}
