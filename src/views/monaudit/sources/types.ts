/**
 * 同步源配置页 DTO（后端 source.rs SourceVo / SourceReq、monitor_client.rs LoginOutcome 的前端镜像）。
 *
 * 凭据只进不出：出参只有 has_app_secret / has_monitor_credential 标记；编辑时留空 = 保留旧值。
 */

export interface SourceRow {
  id: string
  code: string
  name: string
  env_name: string
  datacenter_name: string
  base_url: string
  account_id: string
  tenant_id?: string | null
  app_id: string
  secret_field: string
  auth_mode: string
  login_user: string
  login_user_type: string
  query_api_path: string
  query_extra_params?: string | null
  since_param?: string | null
  page_size: number
  monitor_base_url?: string | null
  monitor_username?: string | null
  status: string
  verified_at?: string | null
  verify_error?: string | null
  monitor_verified_at?: string | null
  monitor_verify_error?: string | null
  remark?: string | null
  created_at?: string | null
  updated_at?: string | null
  has_app_secret: boolean
  has_monitor_credential: boolean
  /** Monitor 会话当前是否可用（服务进程内） */
  monitor_logged_in: boolean
}

export interface SourceListFilter {
  keyword: string
  status: string
}

/** 测试 OpenAPI 结果（后端 TestResult） */
export interface SourceTestResult {
  ok: boolean
  detail?: string | null
  error?: string | null
}

/** Monitor 登录结果（serde tag = "state"） */
export interface MonitorLoggedIn {
  state: 'logged_in'
  detail: string
}

export interface MonitorNeedCaptcha {
  state: 'need_captcha'
  /** dataURL */
  image: string
  reason: string
}

export type LoginOutcome = MonitorLoggedIn | MonitorNeedCaptcha

export interface SourceForm {
  id: string
  code: string
  name: string
  env_name: string
  datacenter_name: string
  base_url: string
  account_id: string
  tenant_id: string
  app_id: string
  app_secret: string
  secret_field: string
  auth_mode: string
  login_user: string
  login_user_type: string
  query_api_path: string
  query_extra_params: string
  since_param: string
  page_size: number
  monitor_base_url: string
  monitor_username: string
  monitor_password: string
  status: string
  remark: string
}

export const SECRET_FIELD_OPTIONS = [
  { value: 'appSecuret', label: 'appSecuret（苍穹拼写）' },
  { value: 'appSecret', label: 'appSecret' },
]

export const AUTH_MODE_OPTIONS = [
  { value: 'app_token', label: 'app_token（getAppToken + login）' },
  { value: 'oauth2', label: 'oauth2' },
]

export const LOGIN_USER_TYPE_OPTIONS = [
  { value: 'Mobile', label: '手机号（Mobile）' },
  { value: 'UserName', label: '用户名（UserName）' },
]

export function emptySourceForm(): SourceForm {
  return {
    id: '',
    code: '',
    name: '',
    env_name: '',
    datacenter_name: '',
    base_url: '',
    account_id: '',
    tenant_id: '',
    app_id: '',
    app_secret: '',
    secret_field: 'appSecuret',
    auth_mode: 'app_token',
    login_user: '',
    login_user_type: 'Mobile',
    query_api_path: '',
    query_extra_params: '',
    since_param: '',
    page_size: 200,
    monitor_base_url: '',
    monitor_username: '',
    monitor_password: '',
    status: '1',
    remark: '',
  }
}

/** 编辑表单：两个口令留空（= 保留旧值） */
export function sourceFormOf(row: SourceRow): SourceForm {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    env_name: row.env_name,
    datacenter_name: row.datacenter_name,
    base_url: row.base_url,
    account_id: row.account_id,
    tenant_id: row.tenant_id ?? '',
    app_id: row.app_id,
    app_secret: '',
    secret_field: row.secret_field,
    auth_mode: row.auth_mode,
    login_user: row.login_user,
    login_user_type: row.login_user_type,
    query_api_path: row.query_api_path,
    query_extra_params: row.query_extra_params ?? '',
    since_param: row.since_param ?? '',
    page_size: row.page_size,
    monitor_base_url: row.monitor_base_url ?? '',
    monitor_username: row.monitor_username ?? '',
    monitor_password: '',
    status: row.status,
    remark: row.remark ?? '',
  }
}

/** 追加查询参数必须是 JSON 对象（后端同样校验，这里提前给出位置更明确的提示） */
export function extraParamsError(text: string): string {
  const trimmed = text.trim()
  if (!trimmed)
    return ''
  try {
    const value: unknown = JSON.parse(trimmed)
    return value && typeof value === 'object' && !Array.isArray(value) ? '' : '追加查询参数必须是 JSON 对象'
  }
  catch {
    return '追加查询参数不是合法 JSON'
  }
}

/** 表单 → SourceReq；口令留空时不出现该键（后端保留旧值） */
export function buildSourcePayload(form: SourceForm): Record<string, unknown> {
  const text = (v: string) => v.trim()
  const optional = (v: string) => v.trim() || null
  const payload: Record<string, unknown> = {
    code: text(form.code),
    name: text(form.name),
    env_name: text(form.env_name),
    datacenter_name: text(form.datacenter_name),
    base_url: text(form.base_url),
    account_id: text(form.account_id),
    tenant_id: optional(form.tenant_id),
    app_id: text(form.app_id),
    secret_field: form.secret_field,
    auth_mode: form.auth_mode,
    login_user: text(form.login_user),
    login_user_type: form.login_user_type,
    query_api_path: text(form.query_api_path),
    query_extra_params: optional(form.query_extra_params),
    since_param: optional(form.since_param),
    page_size: form.page_size,
    monitor_base_url: optional(form.monitor_base_url),
    monitor_username: optional(form.monitor_username),
    status: form.status,
    remark: optional(form.remark),
  }
  if (form.id)
    payload.id = form.id
  if (form.app_secret)
    payload.app_secret = form.app_secret
  if (form.monitor_password)
    payload.monitor_password = form.monitor_password
  return payload
}

/** 状态标签：错误优先，其次验证时间，都没有 = 未测试 */
export function verifyMeta(error: string | null | undefined, at: string | null | undefined): { label: string, color: string } {
  if (error)
    return { label: '失败', color: 'red' }
  if (at)
    return { label: '已验证', color: 'green' }
  return { label: '未测试', color: 'gray' }
}
