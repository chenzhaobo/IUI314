<template>
  <div class="container">
    <a-card title="周期报告任务" :bordered="false">
      <template #extra>
        <a-space>
          <a-input v-model="keyword" placeholder="任务名称" allow-clear style="width: 180px" @change="fetchTasks" />
          <a-select v-model="filterDimType" placeholder="维度类型" allow-clear style="width: 140px" @change="fetchTasks">
            <a-option value="product_domain">产品领域</a-option>
            <a-option value="business_area">业务领域</a-option>
            <a-option value="project_group">项目组</a-option>
          </a-select>
          <a-button type="primary" @click="openAddModal">新增任务</a-button>
        </a-space>
      </template>

      <a-table :data="taskList" :loading="loading" :pagination="false" row-key="id">
        <template #columns>
          <a-table-column title="任务名称" :width="180">
            <template #cell="{ record }">
              <span>{{ record.task_name }}</span>
              <a-tag v-if="!record.enabled" color="gray" size="small" style="margin-left: 6px">停用</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="维度" :width="170">
            <template #cell="{ record }">
              <a-tag :color="dimTypeColor(record.dimension_type)" size="small">{{ dimTypeText(record.dimension_type) }}</a-tag>
              <span style="margin-left: 4px">{{ record.dimension_value }}</span>
            </template>
          </a-table-column>
          <a-table-column title="产品线" :width="80">
            <template #cell="{ record }">
              <a-tag :color="record.product_line === '星空' ? 'purple' : 'blue'" size="small">{{ record.product_line || '星瀚' }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="量控" :width="200">
            <template #cell="{ record }">
              <a-tooltip :content="`超${record.threshold_ms || 3000}ms · 每组合≤${record.daily_limit_per_group || 100}条/天 · 覆盖超量${record.group_top_pct || 80}% · ≤${record.group_max || 200}组合`">
                <span>{{ record.threshold_ms || 3000 }}ms / {{ record.daily_limit_per_group || 100 }}条 / {{ record.group_top_pct || 80 }}% / {{ record.group_max || 200 }}组</span>
              </a-tooltip>
            </template>
          </a-table-column>
          <a-table-column title="执行时间" data-index="run_time" :width="90" />
          <a-table-column title="工作目录" data-index="work_dir" ellipsis :width="180" />
          <a-table-column title="最近运行" :width="150">
            <template #cell="{ record }">
              <template v-if="record.last_run_date">
                <a-tag :color="runStatusColor(record.last_run_status)" size="small">{{ runStatusText(record.last_run_status) }}</a-tag>
                <span style="margin-left: 4px; color: #666">{{ record.last_run_date }}</span>
              </template>
              <span v-else style="color: #999">未运行</span>
            </template>
          </a-table-column>
          <a-table-column title="启用" :width="70">
            <template #cell="{ record }">
              <a-switch :model-value="!!record.enabled" size="small" @change="(v: boolean | string | number) => toggleEnabled(record, !!v)" />
            </template>
          </a-table-column>
          <a-table-column title="操作" :width="200" fixed="right">
            <template #cell="{ record }">
              <a-space>
                <a-link @click="openEditModal(record)">编辑</a-link>
                <a-link @click="openRuns(record)">记录</a-link>
                <a-popconfirm content="确认删除该任务？" @ok="handleDelete(record)">
                  <a-link status="danger">删除</a-link>
                </a-popconfirm>
              </a-space>
            </template>
          </a-table-column>
        </template>
      </a-table>

      <a-alert style="margin-top: 12px" type="info">
        手动触发对全部<b>启用</b>任务执行一次（按数据日期逐阶段断点续跑）；每日定时由调度按「执行时间」自动触发。
      </a-alert>
      <a-button style="margin-top: 8px" status="success" @click="triggerVisible = true">
        <template #icon><icon-thunderbolt /></template>
        手动触发
      </a-button>
    </a-card>

    <!-- 新增/编辑弹框 -->
    <a-modal v-model:visible="modalVisible" :title="isEdit ? '编辑任务' : '新增任务'" :width="640" @ok="handleSave" :ok-loading="saving">
      <a-form :model="form" layout="vertical">
        <a-form-item label="任务名称" required>
          <a-input v-model="form.task_name" placeholder="如: 集团财务-按日慢请求" />
        </a-form-item>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="维度类型" required>
              <a-select v-model="form.dimension_type" @change="onDimTypeChange">
                <a-option value="product_domain">产品领域</a-option>
                <a-option value="business_area">业务领域</a-option>
                <a-option value="project_group">项目组</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="10">
            <a-form-item label="维度值" required>
              <a-select v-model="form.dimension_value" allow-search allow-create allow-clear placeholder="选择或输入维度值">
                <a-option v-for="o in dimValueOptions" :key="o.code" :value="o.code">{{ o.name === o.code ? o.name : `${o.name} (${o.code})` }}</a-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="产品线">
              <a-select v-model="form.product_line">
                <a-option value="星瀚">星瀚</a-option>
                <a-option value="星空">星空</a-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-divider orientation="left">量控（默认值与设计 §11.5 一致）</a-divider>
        <a-row :gutter="16">
          <a-col :span="6">
            <a-form-item label="超阈值(ms)">
              <a-input-number v-model="form.threshold_ms" :min="500" :max="60000" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="每组合限量/天">
              <a-input-number v-model="form.daily_limit_per_group" :min="1" :max="1000" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="覆盖超量(%)">
              <a-input-number v-model="form.group_top_pct" :min="10" :max="100" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item label="组合数上限">
              <a-input-number v-model="form.group_max" :min="1" :max="1000" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-divider orientation="left">调度与推送</a-divider>
        <a-row :gutter="16">
          <a-col :span="8">
            <a-form-item label="执行时间">
              <a-time-picker v-model="form.run_time" format="HH:mm" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="16">
            <a-form-item label="云之家推送群 chat_id">
              <a-input v-model="form.yzj_chat_id" allow-clear placeholder="群机器人 token 或完整 sendMsgUrl，留空则不推送" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item label="工作目录（技能目录隔离红线，如 性能分析产出/集团财务）">
          <a-input v-model="form.work_dir" allow-clear placeholder="下载产物/中间文件/报告均落在该目录子文件夹内" />
        </a-form-item>
        <a-form-item label="启用">
          <a-switch v-model="form.enabled" />
          <span style="margin-left: 8px; color: #86909c; font-size: 12px">停用后定时调度与手动触发均跳过该任务</span>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 手动触发弹框 -->
    <a-modal v-model:visible="triggerVisible" title="手动触发（全部启用任务）" :width="440" @ok="handleTrigger" :ok-loading="triggering">
      <a-form layout="vertical">
        <a-form-item label="数据日期（默认昨天）">
          <a-date-picker v-model="triggerDate" style="width: 100%" />
        </a-form-item>
        <a-form-item label="只跑指定阶段（空=全流程）">
          <a-select v-model="triggerStage" allow-clear placeholder="全流程：下载→分析→报告→推送">
            <a-option value="download">download（下载）</a-option>
            <a-option value="analyze">analyze（分析）</a-option>
            <a-option value="report">report（报告）</a-option>
            <a-option value="push">push（推送）</a-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 运行记录抽屉 -->
    <a-drawer v-model:visible="drawerVisible" :title="`运行记录: ${currentTask?.task_name || ''}`" :width="760" :footer="false">
      <a-table :data="runList" :loading="runLoading" :pagination="false" size="small" row-key="id">
        <template #columns>
          <a-table-column title="数据日期" data-index="run_date" :width="100" />
          <a-table-column title="阶段" :width="90">
            <template #cell="{ record }">
              <a-tag size="small">{{ stageText(record.stage) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="状态" :width="80">
            <template #cell="{ record }">
              <a-tag :color="runStatusColor(record.status)" size="small">{{ runStatusText(record.status) }}</a-tag>
            </template>
          </a-table-column>
          <a-table-column title="产物/错误" ellipsis>
            <template #cell="{ record }">
              <span v-if="record.error_message" style="color: #f53f3f">{{ record.error_message }}</span>
              <span v-else-if="record.artifact_path" style="color: #666">{{ record.artifact_path }}</span>
              <span v-else>-</span>
            </template>
          </a-table-column>
          <a-table-column title="开始" :width="140">
            <template #cell="{ record }">{{ fmtTime(record.started_at) }}</template>
          </a-table-column>
          <a-table-column title="结束" :width="140">
            <template #cell="{ record }">{{ fmtTime(record.finished_at) }}</template>
          </a-table-column>
        </template>
      </a-table>
    </a-drawer>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, watch, onUnmounted } from 'vue'
import { Message } from '@arco-design/web-vue'
import { ApiPerfReportTask, ApiPerfCompliance } from '@/api/perfApis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'report-task-manage' })

// ── 任务列表 ──────────────────────────────────
const keyword = ref('')
const filterDimType = ref<string>()
const queryParams = computed(() => ({ keyword: keyword.value || undefined, dimension_type: filterDimType.value || undefined }))
const { isFetching: loading, data: rawData, execute: fetchTasks } = useGet<any>(ApiPerfReportTask.list, queryParams, { immediate: true })
const taskList = computed(() => rawData.value || [])

// ── 维度值选项（按维度类型级联，allow-create 保底手输） ──────────────────────
const dimValueOptions = ref<any[]>([])
const dimPayload = ref<any>({})
const { execute: fetchDimOptions } = useGet<any>(ApiPerfCompliance.dimensionOptions, dimPayload, {
  immediate: false,
  onSuccess(data: any) { dimValueOptions.value = data || [] },
})
const loadDimValues = () => {
  const level = form.dimension_type
  // 产品领域/业务领域/项目组：不传父级 = 全量列出
  dimPayload.value = { level, product_domain: '', business_area: '' }
  fetchDimOptions()
}
const onDimTypeChange = () => { form.dimension_value = undefined; loadDimValues() }

// ── 新增/编辑弹框 ──────────────────────────────
const modalVisible = ref(false)
const isEdit = ref(false)
const saving = ref(false)
const editId = ref('')
const form = reactive<any>({
  task_name: '', dimension_type: 'product_domain', dimension_value: undefined, product_line: '星瀚',
  threshold_ms: 3000, daily_limit_per_group: 100, group_top_pct: 80, group_max: 200,
  run_time: '02:00', yzj_chat_id: '', work_dir: '', enabled: true,
})

const openAddModal = () => {
  isEdit.value = false; editId.value = ''
  Object.assign(form, { task_name: '', dimension_type: 'product_domain', dimension_value: undefined, product_line: '星瀚', threshold_ms: 3000, daily_limit_per_group: 100, group_top_pct: 80, group_max: 200, run_time: '02:00', yzj_chat_id: '', work_dir: '', enabled: true })
  loadDimValues()
  modalVisible.value = true
}

const openEditModal = (record: any) => {
  isEdit.value = true; editId.value = record.id
  Object.assign(form, {
    task_name: record.task_name, dimension_type: record.dimension_type, dimension_value: record.dimension_value,
    product_line: record.product_line || '星瀚',
    threshold_ms: record.threshold_ms ?? 3000, daily_limit_per_group: record.daily_limit_per_group ?? 100,
    group_top_pct: record.group_top_pct ?? 80, group_max: record.group_max ?? 200,
    run_time: record.run_time || '02:00', yzj_chat_id: record.yzj_chat_id || '', work_dir: record.work_dir || '',
    enabled: !!record.enabled,
  })
  loadDimValues()
  modalVisible.value = true
}

const savePayload = ref<any>({})
const { execute: doSave } = usePost<any>(ApiPerfReportTask.save, savePayload, { immediate: false })

const buildPayload = (base: any) => ({
  task_name: base.task_name, dimension_type: base.dimension_type, dimension_value: base.dimension_value,
  product_line: base.product_line,
  threshold_ms: base.threshold_ms, daily_limit_per_group: base.daily_limit_per_group,
  group_top_pct: base.group_top_pct, group_max: base.group_max,
  run_time: base.run_time || '02:00',
  yzj_chat_id: base.yzj_chat_id || undefined, work_dir: base.work_dir || undefined,
  enabled: base.enabled,
})

const handleSave = async () => {
  if (!form.task_name) { Message.warning('请输入任务名称'); return }
  if (!form.dimension_value) { Message.warning('请选择或输入维度值'); return }
  saving.value = true
  try {
    savePayload.value = { id: editId.value || undefined, ...buildPayload(form) }
    await doSave()
    Message.success(isEdit.value ? '编辑成功' : '新增成功')
    modalVisible.value = false; fetchTasks()
  } finally { saving.value = false }
}

// ── 启用开关（内联切换即保存） ──────────────────────────────
const toggleEnabled = async (record: any, enabled: boolean) => {
  savePayload.value = { id: record.id, ...buildPayload({ ...record, yzj_chat_id: record.yzj_chat_id || '', work_dir: record.work_dir || '', enabled }) }
  await doSave()
  Message.success(enabled ? '已启用' : '已停用')
  fetchTasks()
}

// ── 删除 ──────────────────────────────────
const delPayload = ref<any>({})
const { execute: doDelete } = usePost<any>(ApiPerfReportTask.delete, delPayload, { immediate: false })
const handleDelete = async (record: any) => {
  delPayload.value = { id: record.id }
  await doDelete()
  Message.success('删除成功'); fetchTasks()
}

// ── 手动触发 ──────────────────────────────────
const triggerVisible = ref(false)
const triggering = ref(false)
const triggerDate = ref('')
const triggerStage = ref<string>()
const triggerPayload = ref<any>({})
const { execute: doTrigger } = usePost<any>(ApiPerfReportTask.trigger, triggerPayload, {
  immediate: false,
  onSuccess(data: any) { Message.success(String(data || '已触发')) },
})
const handleTrigger = async () => {
  triggering.value = true
  try {
    triggerPayload.value = { run_date: triggerDate.value || undefined, stage: triggerStage.value || undefined }
    await doTrigger()
    triggerVisible.value = false
  } finally { triggering.value = false }
}

// ── 运行记录 ──────────────────────────────────
const drawerVisible = ref(false)
const currentTask = ref<any>(null)
const runList = ref<any[]>([])
const runLoading = ref(false)
const runPayload = ref<any>({})
const { execute: fetchRuns } = useGet<any>(ApiPerfReportTask.runs, runPayload, {
  immediate: false,
  onSuccess(data: any) { runList.value = data || [] },
})
const openRuns = (record: any) => {
  currentTask.value = record; drawerVisible.value = true; runLoading.value = true
  runPayload.value = { task_id: record.id }
  fetchRuns().finally(() => { runLoading.value = false })
}

// 抽屉打开且存在 running 记录时每 5 秒自动刷新
let runTimer: ReturnType<typeof setInterval> | null = null
const stopRunTimer = () => { if (runTimer) { clearInterval(runTimer); runTimer = null } }
watch([drawerVisible, runList], ([visible, list]) => {
  stopRunTimer()
  if (visible && list.some((r: any) => r.status === 'running')) {
    runTimer = setInterval(() => { fetchRuns() }, 5000)
  }
}, { deep: true })
onUnmounted(stopRunTimer)

// ── 格式化辅助 ──────────────────────────────────
const dimTypeText = (t: string) => ({ product_domain: '产品领域', business_area: '业务领域', project_group: '项目组' }[t] || t)
const dimTypeColor = (t: string) => ({ product_domain: 'arcoblue', business_area: 'green', project_group: 'orange' }[t] || 'gray')
const stageText = (s: string) => ({ download: '下载', analyze: '分析', report: '报告', push: '推送' }[s] || s)
const runStatusText = (s: string) => ({ running: '运行中', success: '成功', failed: '失败', skipped: '跳过' }[s] || s || '-')
const runStatusColor = (s: string) => ({ running: 'blue', success: 'green', failed: 'red', skipped: 'gray' }[s] || 'gray')
const fmtTime = (t?: string) => (t ? t.replace('T', ' ').slice(0, 19) : '-')
</script>

<style scoped>
.container {
  padding: 16px;
}
</style>
