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
}

interface Option {
  value: string
  label: string
}

/** 操作展示名：中文名优先，没有就用操作编码 */
export function operationLabel(file: SlowLogFile): string {
  return file.control_name || file.event_name || '—'
}

/** 文件大小展示 */
export function formatSize(bytes: number): string {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(2)} MB`
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
  const filters = reactive<SlowLogFilters>({ date: '', control: '', tenant: '' })
  const { downloadWithTip } = useDownload()

  const files = computed<SlowLogFile[]>(() => result.value?.files ?? [])

  const filteredFiles = computed(() => files.value.filter(f =>
    (!filters.date || f.date === filters.date)
    && (!filters.control || operationLabel(f) === filters.control)
    && (!filters.tenant || f.tenant_key === filters.tenant),
  ))

  const dateOptions = computed(() => distinctOptions(files.value, f => ({ value: f.date, label: f.date })))
  const controlOptions = computed(() => distinctOptions(files.value, f => ({ value: operationLabel(f), label: operationLabel(f) })))
  const tenantOptions = computed(() => distinctOptions(files.value, f => ({
    value: f.tenant_key,
    label: f.customer_name ? `${f.customer_name}（${f.tenant_key}）` : f.tenant_key,
  })))

  async function load(next: SlowLogQuery) {
    query.value = next
    Object.assign(filters, { date: '', control: '', tenant: '' })
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

  /** 按当前筛选打包；后端 control_name 同时匹配中文名与操作编码 */
  async function downloadZip() {
    if (!query.value)
      return
    const zipQuery: SlowLogQuery = {
      ...query.value,
      date: filters.date,
      control_name: filters.control === '—' ? '' : filters.control,
      tenant_key: filters.tenant,
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
    tenantOptions,
    load,
    downloadFile,
    downloadZip,
  }
}
