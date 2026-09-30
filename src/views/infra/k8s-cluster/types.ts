/**
 * K8s 集群注册页的 DTO、枚举与展示口径（后端 `K8sClusterVo` / `K8sClusterReq` 的前端镜像）。
 *
 * 分层同 sechub/static-scan 样板：本文件只放类型、常量与纯函数，
 * 取数在 ./service，页面状态在 ./useK8sCluster。
 */
import type { SelectOption } from '@/types/static-scan'

/** 后端 K8sClusterVo 的前端镜像；出参不含任何凭据列，只有 has_* 标记 */
export interface K8sClusterRow {
  id: string
  code: string
  name: string
  api_server: string
  /** token | cert */
  auth_type: string
  default_namespace?: string | null
  status: string
  verified_at?: string | null
  verify_error?: string | null
  remark?: string | null
  create_by: string
  update_by?: string | null
  created_at?: string | null
  updated_at?: string | null
  /** 是否已存访问令牌（凭据内容永不回显） */
  has_credential: boolean
  /** 是否已存 CA 证书 */
  has_ca_cert: boolean
}

/** 列表响应（后端 ListData<T> 的前端视图） */
export interface K8sClusterListPage {
  list: K8sClusterRow[]
  total: number
}

/** 列表筛选条件（空串 = 不过滤，发送前由 service 层剔除） */
export interface K8sClusterListFilter {
  keyword: string
}

/** 完整请求参数：筛选 + 服务端分页 */
export interface K8sClusterListQuery extends K8sClusterListFilter {
  page_num: number
  page_size: number
}

export const K8S_CLUSTER_DEFAULT_FILTER: K8sClusterListFilter = { keyword: '' }

export const K8S_CLUSTER_PAGE_SIZE = 10

/** 测试连接结果（后端 TestResult；失败也是一条正常结果，不是请求错误） */
export interface SourceTestResult {
  ok: boolean
  detail?: string
  error?: string
}

/** 认证方式（后端 auth_type：token | cert，缺省 token） */
export const K8S_AUTH_TYPE_OPTIONS: SelectOption[] = [
  { label: '令牌（Bearer Token）', value: 'token' },
  { label: '客户端证书（CA）', value: 'cert' },
]

export function k8sAuthTypeLabel(authType: string): string {
  return K8S_AUTH_TYPE_OPTIONS.find(option => option.value === authType)?.label ?? authType
}

/** 连通状态：verify_error 优先（最近一次测试失败），其次 verified_at，都没有 = 未测试 */
export function k8sVerifyLabel(row: K8sClusterRow): string {
  if (row.verify_error)
    return '失败'
  if (row.verified_at)
    return '已验证'
  return '未测试'
}

/** 连通状态颜色：失败红 / 成功绿 / 未测试灰 */
export function k8sVerifyColor(row: K8sClusterRow): string {
  if (row.verify_error)
    return 'red'
  if (row.verified_at)
    return 'green'
  return 'gray'
}

/** 新增/编辑表单（凭据明文只存在于表单里，提交后不回读） */
export interface K8sClusterForm {
  id: string
  code: string
  name: string
  api_server: string
  auth_type: string
  credential: string
  ca_cert: string
  default_namespace: string
  remark: string
}

export function emptyK8sClusterForm(): K8sClusterForm {
  return {
    id: '',
    code: '',
    name: '',
    api_server: '',
    auth_type: 'token',
    credential: '',
    ca_cert: '',
    default_namespace: '',
    remark: '',
  }
}

/** 编辑表单：凭据两栏刻意留空 —— 留空 = 不修改（后端按字段缺省保留旧值） */
export function clusterFormOf(row: K8sClusterRow): K8sClusterForm {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    api_server: row.api_server,
    auth_type: row.auth_type || 'token',
    credential: '',
    ca_cert: '',
    default_namespace: row.default_namespace ?? '',
    remark: row.remark ?? '',
  }
}

/** 表单 → 请求体；新增不带 id，凭据留空时不出现该键（后端据此保留旧值） */
export function buildClusterPayload(form: K8sClusterForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    code: form.code.trim(),
    name: form.name.trim(),
    api_server: form.api_server.trim(),
    auth_type: form.auth_type,
    // 后端编辑时整列覆写，必须显式发送（空 = 清空）
    default_namespace: form.default_namespace.trim() || null,
    remark: form.remark.trim() || null,
  }
  if (form.id)
    payload.id = form.id
  if (form.credential)
    payload.credential = form.credential
  if (form.ca_cert.trim())
    payload.ca_cert = form.ca_cert.trim()
  return payload
}
