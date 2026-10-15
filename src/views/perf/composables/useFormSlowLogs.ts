/**
 * 达标率看板「查看慢日志」：表单在看板周期（按月 / 按周）内，报告任务已下载的原始天梯日志。
 *
 * 分层 View → Composable → Service → Api：页面只管渲染与交互，状态、筛选与下载在这里。
 * 列表一次取回（后端上限 5000 条），日期 / 操作 / 客户筛选在内存里做；
 * 「打包下载」把同一组筛选下发给后端，保证打包内容与页面所见一致。
 */
import type { SlowLogFile, SlowLogList, SlowLogQuery } from '@/types/perf-slow-logs'
import { computed, reactive, ref } from 'vue'
import { useDownload } from '@/hooks'
import { fetchSlowLogs, slowLogFilePath, slowLogZipPath } from '@/views/perf/compliance/slowLogService'

export interface SlowLogFilters {
  date: string
  control: string
  tenant: string
  /** trace id 过滤（支持报告里的缩写形态，见 traceIdMatches） */
  trace: string
}

interface Option {
  value: string
  label: string
}

/** 看板「未归因操作」行：请求本身没有按钮名。与后端 form_slow_logs::UNATTRIBUTED_LABEL 一致 */
export const UNATTRIBUTED_LABEL = '未归因操作'

/** 是否记录了这条请求自己的按钮名（旧日志只有分组级的按钮名） */
export function hasRequestControl(file: SlowLogFile): boolean {
  return file.request_control !== null && file.request_control !== undefined
}

/**
 * 操作筛选键（也是下发给打包接口的 control_name）。
 *
 * 下载按「表单 + 事件编码」分组，一个 click 分组里混着刷新/提交/保存等多个按钮，
 * 分组的按钮名只是第一条请求的。有逐条按钮名时用它；旧日志没有，只能退回分组名。
 */
export function operationKey(file: SlowLogFile): string {
  if (hasRequestControl(file))
    return file.request_control || UNATTRIBUTED_LABEL
  return file.control_name || file.event_name || ''
}

/** 操作展示名：旧日志标出「分组」，避免把分组名误读成这条请求的按钮 */
export function operationLabel(file: SlowLogFile): string {
  const key = operationKey(file)
  return hasRequestControl(file) ? key : `${key || '—'}（分组）`
}

/** 文件大小展示 */
export function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
}

/** 去掉文件名唯一化追加的 `-<序号>` 后缀（与后端 trace_ids::strip_seq_suffix 同口径） */
function stripSeqSuffix(value: string): string {
  return value.replace(/-\d+$/, '')
}

/**
 * trace id 匹配：完整 id 精确比对；`3eab…6028` 这类缩写按「前缀命中」比对
 * （尾段对不上也认 —— 实测报告里的缩写尾段会抄错，P-12167：2028 写成 6028，
 * 按尾段卡会让项目组怎么搜都搜不到）。与后端 `trace_ids::matches_wanted` 同口径。
 */
export function traceIdMatches(wanted: string, actual: string): boolean {
  const w = stripSeqSuffix(wanted.trim())
  const a = stripSeqSuffix(actual.trim())
  if (!w || !a)
    return false
  const marker = w.search(/…|\.\./)
  if (marker < 0)
    return w.toLowerCase() === a.toLowerCase()
  const head = w.slice(0, marker).replace(/[.…]+$/, '').toLowerCase()
  const tail = w.slice(marker).replace(/^[.…]+/, '').toLowerCase()
  if (!/^[0-9a-f]+$/.test(head) || !a.toLowerCase().startsWith(head))
    return false
  if (!tail || !/^[0-9a-f]+$/.test(tail))
    return true
  return a.toLowerCase().endsWith(tail) || head.length >= 4
}

function distinctOptions(files: SlowLogFile[], pick: (f: SlowLogFile) => Option): Option[] {
  const seen = new Map<string, Option>()
  for (const f of files) {
    const opt = pick(f)
    if (opt.value && !seen.has(opt.value))
      seen.set(opt.value, opt)
  }
  return [...seen.values()]
}

export function useFormSlowLogs() {
  const loading = ref(false)
  const zipping = ref(false)
  const result = ref<SlowLogList | null>(null)
  const query = ref<SlowLogQuery | null>(null)
  const filters = reactive<SlowLogFilters>({ date: '', control: '', tenant: '', trace: '' })
  const { downloadWithTip } = useDownload()

  const files = computed<SlowLogFile[]>(() => result.value?.files ?? [])

  const filteredFiles = computed(() => files.value.filter(f =>
    (!filters.date || f.date === filters.date)
    && (!filters.control || operationKey(f) === filters.control)
    && (!filters.tenant || f.tenant_key === filters.tenant)
    && (!filters.trace.trim() || traceIdMatches(filters.trace, f.trace_id)),
  ))

  const dateOptions = computed(() => distinctOptions(files.value, f => ({ value: f.date, label: f.date })))
  const controlOptions = computed(() => distinctOptions(files.value, f => ({ value: operationKey(f), label: operationLabel(f) })))
  /** 是否全部是记录了逐条按钮名的新日志 */
  const allHaveRequestControl = computed(() => files.value.every(hasRequestControl))
  const tenantOptions = computed(() => distinctOptions(files.value, f => ({
    value: f.tenant_key,
    label: f.customer_name ? `${f.customer_name}（${f.tenant_key}）` : f.tenant_key,
  })))

  async function load(next: SlowLogQuery) {
    query.value = next
    Object.assign(filters, { date: '', control: '', tenant: '', trace: '' })
    loading.value = true
    try {
      result.value = await fetchSlowLogs(next)
    }
    finally {
      loading.value = false
    }
  }

  async function downloadFile(file: SlowLogFile) {
    await downloadWithTip(slowLogFilePath(file), file.file_name, '日志下载失败')
  }

  /** 按当前筛选打包；后端 control_name 同时匹配中文名与操作编码，trace_id 支持缩写形态 */
  async function downloadZip() {
    if (!query.value)
      return
    const zipQuery: SlowLogQuery = {
      ...query.value,
      date: filters.date,
      control_name: filters.control,
      tenant_key: filters.tenant,
      trace_id: filters.trace.trim(),
    }
    const suffix = filters.date || `${result.value?.period_start ?? ''}~${result.value?.period_end ?? ''}`
    zipping.value = true
    try {
      await downloadWithTip(slowLogZipPath(zipQuery), `${query.value.form_id}_${suffix}_慢日志.zip`, '慢日志打包失败')
    }
    finally {
      zipping.value = false
    }
  }

  return {
    loading,
    zipping,
    result,
    filters,
    filteredFiles,
    dateOptions,
    controlOptions,
    allHaveRequestControl,
    tenantOptions,
    load,
    downloadFile,
    downloadZip,
  }
}
