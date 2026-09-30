/**
 * 指标模板页的取数（View → Composable → Service → Api）。
 *
 * `list` 不分页（后端返回 `Vec<perf_metric_template::Model>`），已按 sort、id 升序；
 * `edit` / `add` 都返回**提示语字符串**（"保存成功" / 模板 id），不是布尔。
 */
import type { MetricTemplateRow, TemplateAddPayload, TemplateEditPayload } from './types'
import { ApiPerfObserveTemplate } from '@/api/perfObserveApis'
import { getAction, postAction } from '@/hooks'

export function fetchTemplates(): Promise<MetricTemplateRow[] | null> {
  return getAction<MetricTemplateRow[]>(ApiPerfObserveTemplate.list, {})
}

/** 保存编辑（`deleted=true` 时是删除；内置模板会被后端拒绝） */
export function editTemplate(payload: TemplateEditPayload): Promise<string | null> {
  return postAction<string>(ApiPerfObserveTemplate.edit, payload)
}

/** 新增自定义模板，返回新模板 id */
export function addTemplate(payload: TemplateAddPayload): Promise<string | null> {
  return postAction<string>(ApiPerfObserveTemplate.add, payload)
}
