<!--
  治理排序：选范围 → 读已有台账 → AI 给批次与顺序。

  与台账列表的「影响面」列的分工：那一列排单条，这里排批次。
  影响面前三名可能是三个不相干的问题各自排期，而治理排序要看出
  「这 20 条里 8 条在同一条调用链上、一个专项一起修」——
  实测生产 cm 应用 44 条、TaskFacadeImpl.approve 出现 3 次（一处修完消掉三条）。
-->
<template>
  <div class="plan-page">
    <a-card :bordered="false" title="选择范围">
      <a-alert type="normal" style="margin-bottom: 14px">
        从<strong>已归因的台账</strong>里出治理排期建议，不重新分析日志。
        条件可任意组合（多选），改条件后左侧会即时给出条数与聚类，确认无误再生成。
      </a-alert>

      <a-row :gutter="16">
        <a-col :span="6">
          <a-form-item label="应用" content-flex>
            <a-select v-model="scope.app_numbers" multiple allow-clear placeholder="不限" :max-tag-count="2">
              <a-option v-for="v in opts.apps" :key="v" :value="v">{{ v }}</a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="项目组" content-flex>
            <a-select v-model="scope.project_group_codes" multiple allow-clear placeholder="不限" :max-tag-count="2">
              <a-option v-for="v in opts.groups" :key="v" :value="v">{{ v }}</a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="业务领域" content-flex>
            <a-select v-model="scope.business_areas" multiple allow-clear placeholder="不限" :max-tag-count="2">
              <a-option v-for="v in opts.areas" :key="v" :value="v">{{ v }}</a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="影响面" content-flex>
            <a-select v-model="scope.impact_levels" multiple allow-clear placeholder="不限">
              <a-option value="P0">P0</a-option>
              <a-option value="P1">P1</a-option>
              <a-option value="P2">P2</a-option>
              <a-option value="P3">P3</a-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="16">
        <a-col :span="6">
          <a-form-item label="维度值" content-flex>
            <a-select v-model="scope.dimension_values" multiple allow-clear placeholder="不限" :max-tag-count="2">
              <a-option v-for="v in opts.dims" :key="v" :value="v">{{ v }}</a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item label="产品线" content-flex>
            <a-select v-model="scope.product_lines" multiple allow-clear placeholder="不限" :max-tag-count="2">
              <a-option v-for="v in opts.lines" :key="v" :value="v">{{ v }}</a-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-space style="margin-top: 26px">
            <a-button type="primary" :loading="planning" @click="generate">生成排期建议</a-button>
            <a-button @click="clearScope">清空条件</a-button>
            <span style="color: #86909c; font-size: 12px">生成要调 AI，约几分钟</span>
          </a-space>
        </a-col>
      </a-row>
    </a-card>

    <a-row :gutter="16" style="margin-top: 16px">
      <a-col :span="9">
        <a-card :bordered="false" :title="`范围预览 — ${preview?.scope_label || '全部台账'}`">
          <a-spin :loading="previewing" style="display: block">
            <template v-if="stats">
              <a-descriptions :column="1" size="small" bordered>
                <a-descriptions-item label="台账条数">{{ stats.total }}</a-descriptions-item>
                <a-descriptions-item label="治理预期">
                  可达标 {{ stats.can_meet_count }} · 修完仍超标 {{ stats.cannot_meet_count }} ·
                  无预期 {{ stats.unknown_meet_count }}
                  <div style="color: #86909c; font-size: 12px">
                    「无预期」多为缺日志类，本轮给不出优化目标
                  </div>
                </a-descriptions-item>
                <a-descriptions-item label="已建问题单">{{ stats.with_issue_count }}</a-descriptions-item>
              </a-descriptions>

              <a-divider orientation="left" style="margin: 14px 0 8px">聚类（一起修的候选）</a-divider>
              <div v-for="blk in clusterBlocks" :key="blk.label" style="margin-bottom: 8px">
                <div style="color: #86909c; font-size: 12px">{{ blk.label }}</div>
                <a-tag v-for="([k, n], i) in blk.rows" :key="i" size="small" style="margin: 2px">
                  {{ k }} <strong style="margin-left: 3px">{{ n }}</strong>
                </a-tag>
                <span v-if="!blk.rows.length" style="color: #c9cdd4; font-size: 12px">无</span>
              </div>
            </template>
            <a-empty v-else description="调整条件后自动预览" />
          </a-spin>
        </a-card>
      </a-col>

      <a-col :span="15">
        <a-card :bordered="false" title="排期建议">
          <a-spin :loading="planning" style="display: block; min-height: 120px">
            <MdPreview v-if="planMd" :modelValue="planMd" />
            <a-empty v-else description="点「生成排期建议」后显示" />
          </a-spin>
          <div v-if="planReportId" style="margin-top: 8px; color: #86909c; font-size: 12px">
            已存为报告（{{ planReportId }}），可在「报告列表」中查看历史建议
          </div>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script lang="ts" setup>
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { MdPreview } from 'md-editor-v3'
import 'md-editor-v3/lib/style.css'
import { ApiPerfPatternLedger, ApiPerfTreatment } from '@/api/perfApis'
import { useGet, usePost } from '@/hooks'

defineOptions({ name: 'treatment-plan' })

const blankScope = () => ({
  app_numbers: [] as string[],
  project_group_codes: [] as string[],
  business_areas: [] as string[],
  product_lines: [] as string[],
  dimension_values: [] as string[],
  impact_levels: [] as string[],
})
const scope = reactive(blankScope())
const clearScope = () => Object.assign(scope, blankScope())

// 只把非空条件发给后端 —— 空数组会被后端当成「没选」，但显式过滤掉更清晰，
// 也避免以后后端改成「空数组=筛 0 条」时前端行为跟着变
const payloadOf = () => {
  const o: Record<string, string[]> = {}
  for (const [k, v] of Object.entries(scope)) {
    if (Array.isArray(v) && v.length) o[k] = v
  }
  return o
}

// ── 下拉选项：从台账现有数据里取，不写死 ──────────────
const opts = reactive({ apps: [] as string[], groups: [] as string[], areas: [] as string[], dims: [] as string[], lines: [] as string[] })
const ledgerPayload = ref<any>({ page_num: 1, page_size: 500 })
const { execute: fetchLedger } = useGet<any>(ApiPerfPatternLedger.list, ledgerPayload, {
  immediate: false,
  onSuccess(d: any) {
    const rows: any[] = d?.list ?? d ?? []
    const uniq = (f: (r: any) => any) => [...new Set(rows.map(f).filter(Boolean))].sort() as string[]
    opts.apps = uniq(r => r.app_number)
    opts.groups = uniq(r => r.project_group_code)
    opts.areas = uniq(r => r.business_area)
    opts.dims = uniq(r => r.dimension_value)
    opts.lines = uniq(r => r.product_line)
  },
})

// ── 预览：不调 AI，改条件就刷新 ────────────────────────
const preview = ref<any>(null)
const previewing = ref(false)
const previewPayload = ref<any>({})
const { execute: doPreview } = usePost<any>(ApiPerfTreatment.preview, previewPayload, {
  immediate: false,
  onSuccess(d: any) { preview.value = d },
})
const stats = computed(() => preview.value?.stats)

const clusterBlocks = computed(() => {
  const s = stats.value
  if (!s) return []
  return [
    // 同一对象放最前：那是「一处代码修完消掉多条」，最确定的一起修机会
    { label: '同一对象出现多次（一处修多条）', rows: s.same_object ?? [] },
    { label: '按包聚集（同一模块）', rows: s.by_pkg ?? [] },
    { label: '按标签聚集（同一模式，可做统一方案）', rows: s.by_tag ?? [] },
    { label: '按应用聚集（排期单位）', rows: s.by_app ?? [] },
  ]
})

let timer: ReturnType<typeof setTimeout> | null = null
const refreshPreview = () => {
  if (timer) clearTimeout(timer)
  // 防抖：多选框连点会连发请求，而预览要扫全表
  timer = setTimeout(() => {
    previewPayload.value = payloadOf()
    previewing.value = true
    doPreview().finally(() => { previewing.value = false })
  }, 350)
}
watch(scope, refreshPreview, { deep: true })

// ── 生成建议 ────────────────────────────────────────────
const planMd = ref('')
const planReportId = ref('')
const planning = ref(false)
const planPayload = ref<any>({})
const { execute: doPlan } = usePost<any>(ApiPerfTreatment.plan, planPayload, {
  immediate: false,
  onSuccess(d: any) { planReportId.value = d?.report_id || '' },
})
const reportPayload = ref<any>({})
const { execute: fetchReport } = useGet<any>(ApiPerfTreatment.reportDetail, reportPayload, {
  immediate: false,
  onSuccess(d: any) { planMd.value = d?.content || '' },
})

const generate = async () => {
  if (!stats.value?.total) {
    Message.warning('该范围内没有台账，请放宽条件')
    return
  }
  planning.value = true
  planMd.value = ''
  planReportId.value = ''
  try {
    planPayload.value = payloadOf()
    await doPlan()
    if (planReportId.value) {
      reportPayload.value = { id: planReportId.value }
      await fetchReport()
    }
  } finally {
    planning.value = false
  }
}

onMounted(() => {
  fetchLedger()
  refreshPreview()
})
</script>

<style scoped lang="less">
.plan-page {
  padding: 12px;
}
</style>
