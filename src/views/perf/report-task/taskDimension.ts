/**
 * 报告任务「分析范围」相关的纯函数：维度下拉选项归一化、指定表单的编解码。
 *
 * 从 TaskManage.vue 拆出来：该页面已超千行，且这些逻辑与界面无关、便于单测。
 */

/** 后端 /perf/compliance/dimension-options 的返回项 */
export interface DimensionOptionItem {
  code: string
  name: string
}

/** 下拉选项：value 是写入任务的维度值，label 是界面显示 */
export interface DimensionSelectOption {
  value: string
  label: string
}

/** perf_report_task.target_dimensions 的元素；event_name 省略 = 该表单全部操作 */
export interface TargetDimension {
  form_id: string
  event_name?: string
}

/**
 * 把后端选项转成下拉项。
 *
 * 原来模板里写的是 `v.value ?? v`，而后端字段叫 code/name —— 于是整个对象被当成
 * 选项值，界面上显示成一段 JSON 串。项目组的值必须是**编码**（下载阶段按
 * perf_app.project_group_code 精确匹配），名称只用于显示。
 */
export function toDimensionSelectOptions(list: unknown, dimensionType: string): DimensionSelectOption[] {
  if (!Array.isArray(list))
    return []
  const options: DimensionSelectOption[] = []
  for (const raw of list) {
    if (!raw || typeof raw !== 'object')
      continue
    const item = raw as Partial<DimensionOptionItem>
    const code = String(item.code ?? '').trim()
    if (!code)
      continue
    const name = String(item.name ?? '').trim()
    const label = dimensionType === 'project_group' && name && name !== code ? `${name}（${code}）` : name || code
    options.push({ value: code, label })
  }
  return options.sort((a, b) => a.label.localeCompare(b.label, 'zh-CN'))
}

/** target_dimensions → 输入标签。带操作的写成 `form_id/event_name`。 */
export function targetDimensionsToTags(value: unknown): string[] {
  if (!Array.isArray(value))
    return []
  return value
    .map((raw) => {
      if (!raw || typeof raw !== 'object')
        return ''
      const item = raw as Partial<TargetDimension>
      const form = String(item.form_id ?? '').trim()
      const event = String(item.event_name ?? '').trim()
      return form && event ? `${form}/${event}` : form
    })
    .filter(tag => tag.length > 0)
}

/** 输入标签 → target_dimensions。空列表返回 null（= 不限表单，按覆盖率规则选）。 */
export function tagsToTargetDimensions(tags: string[]): TargetDimension[] | null {
  const seen = new Set<string>()
  const result: TargetDimension[] = []
  for (const raw of tags) {
    const [formPart, ...rest] = raw.trim().split('/')
    const form_id = (formPart ?? '').trim()
    const event_name = rest.join('/').trim()
    if (!form_id)
      continue
    const key = `${form_id}/${event_name}`
    if (seen.has(key))
      continue
    seen.add(key)
    result.push(event_name ? { form_id, event_name } : { form_id })
  }
  return result.length ? result : null
}
