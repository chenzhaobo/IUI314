/**
 * 领域映射页 DTO（后端 mapping.rs MappingVo / MappingReq / UnmappedDomain 的前端镜像）。
 */

export type MatchType = 'domain_exact' | 'domain_prefix' | 'class_prefix'

export interface MappingRow {
  id: string
  match_type: string
  pattern: string
  project_group_id: string
  project_group_name: string
  project_group_code: string
  default_handler_id?: string | null
  default_handler_name?: string | null
  priority: number
  status: string
  remark?: string | null
  updated_at?: string | null
}

export interface UnmappedDomain {
  domain?: string | null
  issue_count: number
  open_count: number
  /** 该领域下一个调用类样例（领域为空时按调用类包建映射） */
  sample_class?: string | null
}

export interface MappingListFilter {
  keyword: string
  match_type: string
  project_group_id: string
}

export interface MappingForm {
  id: string
  match_type: MatchType
  pattern: string
  project_group_id: string
  default_handler_id: string
  priority: number
  status: string
  remark: string
}

export function emptyMappingForm(): MappingForm {
  return {
    id: '',
    match_type: 'domain_exact',
    pattern: '',
    project_group_id: '',
    default_handler_id: '',
    priority: 100,
    status: '1',
    remark: '',
  }
}

function asMatchType(value: string): MatchType {
  return value === 'domain_prefix' || value === 'class_prefix' ? value : 'domain_exact'
}

export function mappingFormOf(row: MappingRow): MappingForm {
  return {
    id: row.id,
    match_type: asMatchType(row.match_type),
    pattern: row.pattern,
    project_group_id: row.project_group_id,
    default_handler_id: row.default_handler_id ?? '',
    priority: row.priority,
    status: row.status,
    remark: row.remark ?? '',
  }
}

/** 调用类取前 3 段包名：`kd.hr.hspm.x.Y` → `kd.hr.hspm`（与后端 class_package 一致） */
export function classPackage(className: string): string {
  return className.split('.').slice(0, 3).join('.')
}

/** 未匹配领域 → 预填表单：有领域按领域精确，无领域按调用类包前缀 */
export function mappingFormFromUnmapped(row: UnmappedDomain): MappingForm {
  const form = emptyMappingForm()
  const domain = (row.domain ?? '').trim()
  if (domain) {
    form.match_type = 'domain_exact'
    form.pattern = domain
  }
  else {
    form.match_type = 'class_prefix'
    form.pattern = classPackage(row.sample_class ?? '')
  }
  return form
}

export function buildMappingPayload(form: MappingForm): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    match_type: form.match_type,
    pattern: form.pattern.trim(),
    project_group_id: form.project_group_id,
    default_handler_id: form.default_handler_id || null,
    priority: form.priority,
    status: form.status,
    remark: form.remark.trim() || null,
  }
  if (form.id)
    payload.id = form.id
  return payload
}
