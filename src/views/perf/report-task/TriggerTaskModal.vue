<script setup lang="ts">
/**
 * 手动触发弹窗。
 *
 * 归因任务用「归因日期范围」代替原来的「数据日期 + 归因起始日期」两个字段：
 * 两个字段其实就是区间的终点和起点，分开填既难懂又容易填反。选了范围后直接列出
 * 范围内每天的状态（待归因 / 已归因 / 无数据），让人知道这次会分析哪些天。
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
const force = ref(false)
const submitting = ref(false)
const attrDays = ref<AttrDayStatus[]>([])
const attrLoading = ref(false)

const isAttrTask = computed(() => props.task?.task_type === 'attribute')
/** 用日期范围的场景：单个任务的归因（归因任务的全流程就是归因） */
const useRange = computed(() => Boolean(props.task) && (stage.value === 'defect_attribution' || (isAttrTask.value && !stage.value)))
const rangeDays = computed(() => daysInRange(attrDays.value, range.value[0], range.value[1]))
const summary = computed(() => summarizeAttrDays(rangeDays.value))

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
  if (useRange.value)
    void loadAttrDays()
})
watch(useRange, (on) => {
  if (on && visible.value && !attrDays.value.length)
    void loadAttrDays()
})

// 会拉明细的阶段不能选今天及以后：明细次日才完整，选当天会 0 维度空跑（后端同样拦截）
function isDateDisabled(current?: Date): boolean {
  if (!current || (stage.value && !['preflight', 'download'].includes(stage.value)))
    return false
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  return current.getTime() >= today.getTime()
}

function buildPayload(): TriggerPayload | null {
  const base: TriggerPayload = { task_id: props.task?.id, stage: stage.value || undefined, force: force.value || undefined }
  if (!useRange.value)
    return { ...base, run_date: runDate.value || undefined }
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
          <a-option value="preflight">
            预检（不调用 Ops）
          </a-option>
          <a-option value="download">
            下载
          </a-option>
          <a-option value="extract">
            结构化提取
          </a-option>
          <a-option value="defect_attribution">
            AI 逐维度归因
          </a-option>
          <a-option value="weekly">
            周报（取日期所在那一周）
          </a-option>
          <a-option value="monthly">
            月报（取日期所在那一月）
          </a-option>
        </a-select>
      </a-form-item>

      <template v-if="useRange">
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
      <a-form-item v-else label="数据日期（默认昨天）">
        <a-date-picker v-model="runDate" value-format="YYYY-MM-DD" style="width: 100%" :disabled-date="isDateDisabled" />
        <template #extra>
          <span v-if="stage === 'weekly' || stage === 'monthly'">以这个日期为锚点，取它所在的整{{ stage === 'weekly' ? '周' : '月' }}；同区间重复生成会复用既有报告。</span>
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
