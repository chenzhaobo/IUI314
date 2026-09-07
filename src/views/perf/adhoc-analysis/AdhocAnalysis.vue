<!--
  临时分析：选维度 → 一次性下载 + 归因，不进调度。

  为什么单独一个页面而不是复用周期任务的编辑页：周期任务要配 cron、推送、
  归因范围等 23 个字段，临时分析只需要「哪个维度 + 哪天」。混在一起的结果是
  人为了跑一次分析要填一堆与它无关的东西，然后把 enabled 关掉 ——
  那正是现在的绕法，也是周期任务列表被污染的原因。
-->
<template>
  <div class="adhoc-page">
    <a-card :bordered="false">
      <template #title>
        <a-space>
          <span>新建临时分析</span>
          <a-tag color="orange" size="small">不进调度，手动触发一次</a-tag>
        </a-space>
      </template>

      <a-alert type="normal" style="margin-bottom: 14px">
        用于分析周期任务没覆盖到的维度。目录由平台分配（<code>_adhoc/&lt;任务id&gt;</code>），
        跑完一次就停，不参与 cron。
        <template v-if="!form.dimensions.length">
          <br />维度可以只填表单标识（如 <code>task_approve</code>）表示该表单的全部操作，
          也可以精确到操作编码。
        </template>
      </a-alert>

      <a-form :model="form" layout="vertical" auto-label-width>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="任务名称" required>
              <a-input v-model="form.task_name" placeholder="例：财务报表刷新慢-补充分析" allow-clear />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="数据日期" required>
              <!-- 用数据日期而不是执行日期：Ops 日志只留 6 天，
                   选太早的日期会下载失败，所以限制可选范围 -->
              <a-date-picker v-model="form.run_date" style="width: 100%" :disabled-date="disabledDate" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="维度值（产品域/客户）" required>
              <a-input v-model="form.dimension_value" placeholder="例：集团财务" allow-clear />
            </a-form-item>
          </a-col>
        </a-row>

        <a-form-item label="分析维度" required>
          <div style="width: 100%">
            <div v-for="(d, idx) in form.dimensions" :key="idx" style="display: flex; gap: 8px; margin-bottom: 8px">
              <a-input v-model="d.form_id" placeholder="表单标识 form_id（必填）" style="flex: 2" allow-clear />
              <a-input v-model="d.event_name" placeholder="操作编码 event_name（留空=该表单全部操作）" style="flex: 2" allow-clear />
              <a-button status="danger" @click="form.dimensions.splice(idx, 1)">删除</a-button>
            </div>
            <a-button type="outline" size="small" @click="form.dimensions.push({ form_id: '', event_name: '' })">
              + 添加维度
            </a-button>
            <div style="margin-top: 6px; color: #86909c; font-size: 12px">
              支持多个 —— 项目组要看的往往是几个相关表单一起，一次只能选一个就得建多个任务。
            </div>
          </div>
        </a-form-item>

        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="每维度下载上限">
              <a-input-number v-model="form.daily_limit_per_group" :min="1" :max="500" style="width: 100%" />
              <template #extra>下载必须串行，条数越多越慢；100 条通常够判断根因</template>
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="慢请求阈值(ms)">
              <a-input-number v-model="form.threshold_ms" :min="1000" :step="500" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="8">
            <a-form-item label="产品线">
              <a-input v-model="form.product_line" placeholder="例：星瀚" allow-clear />
            </a-form-item>
          </a-col>
        </a-row>

        <a-space>
          <a-button type="primary" :loading="submitting" @click="createAndRun">创建并开始</a-button>
          <a-button @click="reset">重置</a-button>
        </a-space>
      </a-form>
    </a-card>

    <a-card :bordered="false" style="margin-top: 16px" title="临时分析记录">
      <a-table :data="tasks" :loading="loading" :pagination="false" size="small" row-key="id">
        <template #columns>
          <a-table-column title="任务名称" data-index="task_name" :width="200" ellipsis tooltip />
          <a-table-column title="维度" :width="200">
            <template #cell="{ record }">
              <a-tag v-for="(d, i) in parseDims(record.target_dimensions)" :key="i" size="small" style="margin: 1px">
                {{ d.form_id }}{{ d.event_name ? '/' + d.event_name : '/*' }}
              </a-tag>
              <span v-if="!parseDims(record.target_dimensions).length" style="color: #c9cdd4">全量</span>
            </template>
          </a-table-column>
          <a-table-column title="维度值" data-index="dimension_value" :width="120" ellipsis />
          <a-table-column title="最近运行" :width="150">
            <template #cell="{ record }">
              <span v-if="record.last_run_date">{{ String(record.last_run_date).slice(0, 10) }}</span>
              <span v-else style="color: #c9cdd4">未运行</span>
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="100">
            <template #cell="{ record }">
              <a-tag :color="runColor(record.last_run_status)" size="small">{{ runText(record.last_run_status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="180">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="rerun(record)">重跑</a-link>
                <a-link @click="openRuns(record)">运行记录</a-link>
                <a-popconfirm content="删除后记录不可恢复，已产出的台账与报告保留。确认？" @ok="remove(record)">
                  <a-link status="danger">删除</a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>
    </a-card>

    <a-drawer v-model:visible="runsVisible" :width="'70vw'" :title="`运行记录 — ${current?.task_name || ''}`">
      <a-table :data="runs" :pagination="false" size="small" row-key="id">
        <template #columns>
          <a-table-column title="数据日期" :width="110">
            <template #cell="{ record }">{{ String(record.run_date || '').slice(0, 10) }}</template>
          </a-table-column>
          <a-table-column title="阶段" data-index="stage" :width="150" />
          <a-table-column title="状态" :width="90">
            <template #cell="{ record }">
              <a-tag :color="runColor(record.status)" size="small">{{ runText(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="进度" :width="100">
            <template #cell="{ record }">{{ record.done_items }}/{{ record.total_items }}</template>
          </a-table-column>
          <a-table-column title="失败原因" data-index="error_message" ellipsis tooltip />
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<script lang="ts" setup>
import { onMounted, reactive, ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfReportTask } from '@/api/perfApis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'adhoc-analysis' })

// 只做「今天减 N 天 → YYYY-MM-DD」这一件事，用原生 Date 就够 ——
// 项目没装 dayjs，为两个日期计算引入一个依赖不值得。
const daysAgo = (n: number) => {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return d.toISOString().slice(0, 10)
}

const blank = () => ({
  task_name: '',
  run_date: daysAgo(1),
  dimension_value: '',
  product_line: '',
  dimensions: [{ form_id: '', event_name: '' }],
  daily_limit_per_group: 100,
  threshold_ms: 3000,
})
const form = reactive(blank())
const submitting = ref(false)

// Ops 日志只留 6 天 —— 选更早的日期下载必然失败，不如直接禁掉。
// 也禁掉今天：当天数据还没同步完，跑出来是不完整的。
// Arco 的 disabled-date 签名是 `(current?: Date) => boolean`（参数可选），
// 标成必填的 `(d: Date)` 类型上不兼容。参数缺失时不禁用，交给组件默认行为。
const disabledDate = (current?: Date) => {
  if (!current)
    return false
  const day = new Date(current).toISOString().slice(0, 10)
  return day > daysAgo(1) || day < daysAgo(6)
}

const reset = () => Object.assign(form, blank())

const parseDims = (v: any): { form_id: string, event_name?: string }[] => {
  if (!v) return []
  try {
    const arr = typeof v === 'string' ? JSON.parse(v) : v
    return Array.isArray(arr) ? arr : []
  } catch {
    return []
  }
}

const runColor = (s?: string) => {
  switch (s) {
    case 'success': return 'green'
    case 'failed': return 'red'
    case 'running': return 'orange'
    case 'skipped': return 'gray'
    default: return 'gray'
  }
}
const runText = (s?: string) => {
  switch (s) {
    case 'success': return '成功'
    case 'failed': return '失败'
    case 'running': return '进行中'
    case 'skipped': return '跳过'
    default: return '--'
  }
}

// ── 列表 ────────────────────────────────────────────────
// 明确传 task_type=adhoc：后端默认**排除** adhoc（不让临时任务混进周期列表）
const tasks = ref<any[]>([])
const loading = ref(false)
const listPayload = ref<any>({ task_type: 'adhoc' })
const { execute: fetchTasks } = useGet<any>(ApiPerfReportTask.list, listPayload, {
  immediate: false,
  onSuccess(d: any) {
    tasks.value = (d?.list ?? d ?? []) as any[]
  },
})
const load = () => {
  loading.value = true
  fetchTasks().finally(() => { loading.value = false })
}

// ── 创建并触发 ──────────────────────────────────────────
const savePayload = ref<any>({})
// 必须取 data ref：execute() 的返回值不是接口 data
// （usePost 也不支持 onSuccess —— 那个回调只在 useGet 上挂载）
const { data: saveResult, execute: doSave } = usePost<any>(ApiPerfReportTask.save, savePayload, { immediate: false })
const triggerPayload = ref<any>({})
const { execute: doTrigger } = usePost<any>(ApiPerfReportTask.trigger, triggerPayload, { immediate: false })

const createAndRun = async () => {
  const dims = form.dimensions
    .map(d => ({ form_id: d.form_id.trim(), event_name: d.event_name.trim() }))
    .filter(d => d.form_id)
  if (!form.task_name.trim()) return Message.warning('请填任务名称')
  if (!form.dimension_value.trim()) return Message.warning('请填维度值')
  if (!dims.length) return Message.warning('至少填一个维度的表单标识')

  savePayload.value = {
    task_name: form.task_name.trim(),
    task_type: 'adhoc',
    dimension_type: 'product_domain',
    dimension_value: form.dimension_value.trim(),
    product_line: form.product_line.trim() || null,
    target_dimensions: dims,
    daily_limit_per_group: form.daily_limit_per_group,
    threshold_ms: form.threshold_ms,
    // 临时任务不进调度：后端 is_task_due 对 adhoc 直接返回 false，
    // 这里的 enabled 只影响列表展示
    enabled: false,
    // work_dir 不传 —— 平台强制分配 _adhoc/<id>，人填的会被忽略
  }
  submitting.value = true
  try {
    await doSave()
    // 后端 save 返回的 data 就是任务 id 字符串
    const taskId = saveResult.value
    if (!taskId || typeof taskId !== 'string') {
      Message.error('创建失败，请检查必填项')
      return
    }
    triggerPayload.value = { task_id: taskId, run_date: form.run_date, force: true }
    await doTrigger()
    Message.success('已创建并开始，下载与归因约几十分钟，可在下方记录里看进度')
    reset()
    load()
  } finally {
    submitting.value = false
  }
}

const rerun = async (record: any) => {
  triggerPayload.value = {
    task_id: record.id,
    run_date: daysAgo(1),
    force: true,
  }
  await doTrigger()
  Message.success('已重新触发')
  load()
}

// ── 运行记录 ────────────────────────────────────────────
const runsVisible = ref(false)
const current = ref<any>(null)
const runs = ref<any[]>([])
const runsPayload = ref<any>({})
const { execute: fetchRuns } = useGet<any>(ApiPerfReportTask.runs, runsPayload, {
  immediate: false,
  onSuccess(d: any) {
    runs.value = (d?.list ?? d ?? []) as any[]
  },
})
const openRuns = (record: any) => {
  current.value = record
  runsVisible.value = true
  runsPayload.value = { task_id: record.id, page_num: 1, page_size: 30 }
  fetchRuns()
}

const delPayload = ref<any>({})
const { execute: doDelete } = usePost<any>(ApiPerfReportTask.delete, delPayload, { immediate: false })
const remove = async (record: any) => {
  delPayload.value = { id: record.id }
  await doDelete()
  Message.success('已删除')
  load()
}

onMounted(load)
</script>

<style scoped lang="less">
.adhoc-page {
  padding: 12px;
}
</style>
