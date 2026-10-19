<script setup lang="ts">
/**
 * 手动触发弹窗。
 *
 * 日期控件按执行内容切换：
 * - 下载/预检/结构化提取：数据日期范围，后端按日期串行补跑；
 * - collect 的全流程（下载+提取）：同样按范围跑；
 * - 归因：归因日期范围，选完直接列出每天状态（待归因 / 已归因 / 无数据）；
 * - pipeline 全流程 / 周报 / 月报：单日（全流程的归因阶段会自己合并未归因日期）。
 * 执行内容选项也按任务类型收窄，避免在归因任务上选到下载这类无意义的阶段。
 */
import type { AttrDayStatus, TriggerPayload } from './taskTrigger'
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { ApiPerfReportTask } from '@/api/perfApis'
import { getAction, postAction } from '@/hooks'
import { ATTR_STATUS_COLOR, ATTR_STATUS_TEXT, daysInRange, defaultAttrRange, isSkippedResult, summarizeAttrDays } from './taskTrigger'

interface TriggerTarget {
  id: string
  task_name: string
  task_type?: string
}

const props = defineProps<{ task: TriggerTarget | null }>()
const emit = defineEmits<{ triggered: [] }>()
const visible = defineModel<boolean>('visible', { required: true })

const stage = ref<string>()
const runDate = ref('')
const range = ref<string[]>([])
const dataRange = ref<string[]>([])
const force = ref(false)
const submitting = ref(false)
const attrDays = ref<AttrDayStatus[]>([])
const attrLoading = ref(false)

interface StageOption {
  value: string
  label: string
}

const DATA_RANGE_STAGES = new Set(['preflight', 'download', 'extract'])
const MAX_PULL_RANGE_DAYS = 7
const MAX_EXTRACT_RANGE_DAYS = 31

const isAttrTask = computed(() => props.task?.task_type === 'attribute')
/** 不同任务类型只显示该类型实际会跑的执行内容，与编辑页的类型字段一致 */
const stageOptions = computed<StageOption[]>(() => {
  switch (props.task?.task_type) {
    case 'attribute':
      return [{ value: 'defect_attribution', label: 'AI 逐维度归因' }]
    case 'period':
      return [
        { value: 'weekly', label: '周报（取日期所在那一周）' },
        { value: 'monthly', label: '月报（取日期所在那一月）' },
      ]
    case 'collect':
      return [
        { value: 'preflight', label: '预检（不调用 Ops）' },
        { value: 'download', label: '下载' },
        { value: 'extract', label: '结构化提取' },
      ]
    default:
      return [
        { value: 'preflight', label: '预检（不调用 Ops）' },
        { value: 'download', label: '下载' },
        { value: 'extract', label: '结构化提取' },
        { value: 'defect_attribution', label: 'AI 逐维度归因' },
      ]
  }
})
/** 用归因日期范围的场景：单个任务的归因（归因任务的全流程就是归因） */
const useAttrRange = computed(() => Boolean(props.task) && (stage.value === 'defect_attribution' || (isAttrTask.value && !stage.value)))
/** 下载/提取按日期范围补跑；后端会按日期串行执行，避免 Ops 下载并发冲突。
 *  collect 的全流程就是下载+提取，也按范围跑。 */
const useDataRange = computed(() => Boolean(props.task)
  && ((!!stage.value && DATA_RANGE_STAGES.has(stage.value)) || (!stage.value && props.task?.task_type === 'collect')))
const rangeDays = computed(() => daysInRange(attrDays.value, range.value[0], range.value[1]))
const summary = computed(() => summarizeAttrDays(rangeDays.value))

function formatLocalDate(value: Date): string {
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

function daysAgoIso(days: number): string {
  const value = new Date()
  value.setDate(value.getDate() - days)
  return formatLocalDate(value)
}

function startOfToday(): Date {
  const value = new Date()
  value.setHours(0, 0, 0, 0)
  return value
}

function spanDays(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  return Math.round((end - start) / 86_400_000) + 1
}

async function loadAttrDays() {
  if (!props.task)
    return
  attrLoading.value = true
  try {
    const data = await getAction<AttrDayStatus[]>(ApiPerfReportTask.attrDays, { task_id: props.task.id })
    attrDays.value = Array.isArray(data) ? data : []
    const preset = defaultAttrRange(attrDays.value)
    range.value = preset.length ? [...preset] : []
  }
  finally {
    attrLoading.value = false
  }
}

watch(visible, (open) => {
  if (!open)
    return
  stage.value = undefined
  runDate.value = ''
  force.value = false
  attrDays.value = []
  range.value = []
  dataRange.value = []
  if (useDataRange.value) {
    const yesterday = daysAgoIso(1)
    dataRange.value = [yesterday, yesterday]
  }
  if (useAttrRange.value)
    void loadAttrDays()
})
watch(useAttrRange, (on) => {
  if (on && visible.value && !attrDays.value.length)
    void loadAttrDays()
})
watch(stage, (value) => {
  if (value && DATA_RANGE_STAGES.has(value) && !dataRange.value.length) {
    const yesterday = daysAgoIso(1)
    dataRange.value = [yesterday, yesterday]
  }
})

// 会拉明细的阶段不能选今天及以后：明细次日才完整，选当天会 0 维度空跑（后端同样拦截）
function isDateDisabled(current?: Date): boolean {
  if (!current || (stage.value && !['preflight', 'download'].includes(stage.value)))
    return false
  return current.getTime() >= startOfToday().getTime()
}

// 下载/预检的范围还要落在 Ops 5~7 天留存窗口内；提取只读本地文件，允许更早的日期
function isRangeDateDisabled(current?: Date): boolean {
  if (!current)
    return false
  const today = startOfToday()
  if (current.getTime() >= today.getTime())
    return true
  if (stage.value === 'extract')
    return false
  const earliest = new Date(today)
  earliest.setDate(earliest.getDate() - MAX_PULL_RANGE_DAYS)
  return current.getTime() < earliest.getTime()
}

function buildPayload(): TriggerPayload | null {
  const base: TriggerPayload = { task_id: props.task?.id, stage: stage.value || undefined, force: force.value || undefined }
  if (useAttrRange.value) {
    const [from, to] = range.value
    if (!from || !to) {
      Message.warning('请选择归因日期范围')
      return null
    }
    if (!summary.value.pending && !summary.value.failed && !force.value) {
      Message.warning('所选范围内没有待归因的日期；要重做已归因的日期请打开「强制重跑」')
      return null
    }
    return { ...base, stage: stage.value || 'defect_attribution', run_date: to, attr_from: from }
  }
  if (useDataRange.value) {
    const [from, to] = dataRange.value
    if (!from || !to) {
      Message.warning('请选择数据日期范围')
      return null
    }
    if (from > to) {
      Message.warning('数据日期范围起点不能晚于终点')
      return null
    }
    const maxDays = stage.value === 'extract' ? MAX_EXTRACT_RANGE_DAYS : MAX_PULL_RANGE_DAYS
    if (spanDays(from, to) > maxDays) {
      Message.warning(stage.value === 'extract'
        ? `结构化提取一次最多补 ${maxDays} 天`
        : `下载/预检/采集全流程一次最多补 ${maxDays} 天（Ops 日志只留 5~7 天）`)
      return null
    }
    return { ...base, run_date_from: from, run_date_to: to }
  }
  return { ...base, run_date: runDate.value || undefined }
}

/** 返回 true 时弹窗关闭（arco before-ok 语义）；失败或校验不过保持打开 */
async function submit(): Promise<boolean> {
  const payload = buildPayload()
  if (!payload)
    return false
  submitting.value = true
  try {
    const result = await postAction<string>(ApiPerfReportTask.trigger, payload)
    if (result === null)
      return false
    const text = String(result || '已触发')
    if (isSkippedResult(text))
      Message.warning({ content: text, duration: 8000 })
    else
      Message.success({ content: text, duration: 5000 })
    emit('triggered')
    return true
  }
  finally {
    submitting.value = false
  }
}

const layoutOnlyModel = {}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="task ? `手动触发 — ${task.task_name}` : '手动触发（全部启用任务）'"
    :width="560"
    :ok-loading="submitting"
    :on-before-ok="submit"
  >
    <a-alert v-if="task" type="info" style="margin-bottom: 12px">
      只跑这一个任务。<b>不受启用开关影响</b> —— 停用只影响定时调度，这里是人工补跑。
    </a-alert>
    <a-form layout="vertical" :model="layoutOnlyModel">
      <a-form-item label="执行内容">
        <a-select v-model="stage" allow-clear :placeholder="isAttrTask ? '归因（默认）' : '全流程（按任务类型）'">
          <a-option v-for="option in stageOptions" :key="option.value" :value="option.value">
            {{ option.label }}
          </a-option>
        </a-select>
      </a-form-item>

      <template v-if="useAttrRange">
        <a-form-item label="归因日期范围">
          <a-range-picker v-model="range" value-format="YYYY-MM-DD" style="width: 100%" />
          <template #extra>
            <span>只分析范围内<b>还没归因</b>的日期，合并成一轮；已归因的跳过（打开强制重跑才重做）。积压很多天时建议分几次，每次一两周。</span>
          </template>
        </a-form-item>
        <a-spin :loading="attrLoading" style="display: block; margin-bottom: 12px">
          <div v-if="rangeDays.length" class="attr-summary">
            范围内 {{ summary.total }} 个有数据的日期：
            <b>待归因 {{ summary.pending + summary.failed }}</b>（其中上次失败 {{ summary.failed }}）、
            已归因 {{ summary.attributed }}、归因中 {{ summary.running }}、无数据 {{ summary.noData }}
          </div>
          <div v-else-if="!attrLoading" class="attr-summary">
            范围内没有已提取的日期（采集任务还没下载/提取这些天）。
          </div>
          <div class="attr-days">
            <a-tooltip v-for="d in rangeDays" :key="d.date" :content="d.round ? `${ATTR_STATUS_TEXT[d.status]}，属于 ${d.round} 那一轮` : ATTR_STATUS_TEXT[d.status]" mini>
              <a-tag :color="ATTR_STATUS_COLOR[d.status]" size="small">
                {{ d.date.slice(5) }}
              </a-tag>
            </a-tooltip>
          </div>
        </a-spin>
      </template>
      <a-form-item v-else-if="useDataRange" label="数据日期范围">
        <a-range-picker v-model="dataRange" value-format="YYYY-MM-DD" style="width: 100%" :disabled-date="isRangeDateDisabled" />
        <template #extra>
          <span>
            会按日期从早到晚<b>串行</b>执行，避免多个 Ops 下载并发冲突。
            <template v-if="stage === 'extract'">提取一次最多补 {{ MAX_EXTRACT_RANGE_DAYS }} 天。</template>
            <template v-else>下载/预检/采集全流程一次最多补 {{ MAX_PULL_RANGE_DAYS }} 天（Ops 日志只留 5~7 天）。</template>
          </span>
        </template>
      </a-form-item>
      <a-form-item v-else label="数据日期（默认昨天）">
        <a-date-picker v-model="runDate" value-format="YYYY-MM-DD" style="width: 100%" :disabled-date="isDateDisabled" />
        <template #extra>
          <span v-if="stage === 'weekly' || stage === 'monthly'">以这个日期为锚点，取它所在的整{{ stage === 'weekly' ? '周' : '月' }}；同区间重复生成会复用既有报告。</span>
          <span v-else-if="!stage && task?.task_type === 'period'">按任务配置的「报告区间」生成；这个日期仅作为锚点。</span>
          <span v-else-if="!stage">全流程按单日执行；要补多天下载/提取，请把「执行内容」切到对应阶段。</span>
          <span v-else>全流程的归因阶段会把这一天及之前所有未归因的日期合并分析。</span>
        </template>
      </a-form-item>

      <a-form-item label="强制重跑">
        <a-switch v-model="force" />
        <span class="hint">默认断点续跑：已成功的阶段 / 已归因的日期会跳过。改了配置或要用同样的数据复验时打开。</span>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.attr-summary { color: var(--color-text-2); font-size: 13px; margin-bottom: 8px; }
.attr-days { display: flex; flex-wrap: wrap; gap: 4px; max-height: 120px; overflow-x: hidden; overflow-y: auto; }
.hint { margin-left: 8px; color: var(--color-text-3); font-size: 12px; }
</style>
