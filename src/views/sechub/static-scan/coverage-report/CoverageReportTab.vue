<script setup lang="ts">
/**
 * 「覆盖自证」只读 tab（W-C）：预扫描收口 / AI 确认完成后生成的 run 级自证报告。
 *
 * 四段（编号与后端报告的段号一致）：
 *   ① 零命中规则清单 —— 分母是「本 run 实际加载/执行的规则集」，规则集不可解析时清单留空并显式记因；
 *   ② 判定台账 —— 候选总数、ai_status 与采信 verdict 双口径分布、未判定占比告警；
 *   ③ 驳回理由聚类 —— 形态计数 + 同文案 ≥3 条的套路化嫌疑（标黄）；
 *   ④ 结论翻转 —— 与上一条「已产生采信结论」的 run 对齐后的翻转对数与明细，无基线时给原因。
 *
 * 只读：本组件不做任何写操作、不轮询（后端在收口/确认后刷新报告），手动「刷新」重拉。
 * 404（该 run 尚无报告）由 service 层与真实失败区分开，这里渲染成空态而不是错误。
 */
import type { TableColumnData } from '@arco-design/web-vue'
import type { DistributionSegment } from './types'
import { computed, watch } from 'vue'
import { formatTime } from '@/hooks'
import { useCoverageReport } from './useCoverageReport'

const props = defineProps<{ runId: string }>()

const { loading, report, absent, failed, notFinalized, load, reset } = useCoverageReport()

watch(
  () => props.runId,
  (id) => {
    if (id)
      void load(id)
    else
      reset()
  },
  { immediate: true },
)

// ── 状态 / 结论的展示口径（与候选明细页的 aiStatusLabels 保持一致）──────────
/** 值 → 中文标签 + 分布条色块 + a-tag 颜色名；表外取值灰色兜底（原样显示 key） */
const STATUS_META: Record<string, { label: string, color: string, tag: string }> = {
  pending: { label: '待确认', color: 'rgb(var(--gray-6))', tag: 'gray' },
  confirmed: { label: '确认问题', color: 'rgb(var(--red-6))', tag: 'red' },
  rejected: { label: '已排除', color: 'rgb(var(--green-6))', tag: 'green' },
  error: { label: '错误', color: 'rgb(var(--orange-6))', tag: 'orange' },
  review_needed: { label: '需人工', color: 'rgb(var(--orangered-6))', tag: 'orangered' },
  // 004：命中白名单第二层（规则×范围豁免）的候选，落库即此状态，不进 AI
  waived: { label: '已豁免', color: 'rgb(var(--gray-6))', tag: 'gray' },
  // 009b：证据型规则候选，已并入同行权威候选
  evidence: { label: '证据（已并入）', color: 'rgb(var(--lime-6))', tag: 'lime' },
}

function statusLabel(value: string): string {
  return STATUS_META[value]?.label ?? (value || '未知')
}

/** counts 记录 → 分布条分段（计数降序、同数按键名升序） */
function toSegments(counts: Record<string, number>): DistributionSegment[] {
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0)
  return Object.entries(counts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, count]) => ({
      key,
      label: statusLabel(key),
      count,
      percent: total > 0 ? (count / total) * 100 : 0,
      color: STATUS_META[key]?.color ?? 'rgb(var(--gray-6))',
      tagColor: STATUS_META[key]?.tag ?? 'gray',
    }))
}

const statusSegments = computed(() => toSegments(report.value?.ledger.ai_status_counts ?? {}))
const verdictSegments = computed(() => toSegments(report.value?.ledger.verdict_counts ?? {}))
/** 采信结论分段的总数（分布百分比的分母，不含被更替的历史轮次） */
const verdictAdoptedTotal = computed(() => verdictSegments.value.reduce((sum, seg) => sum + seg.count, 0))

const undeterminedPercent = computed(() => `${((report.value?.ledger.undetermined_ratio ?? 0) * 100).toFixed(1)}%`)

const executionScopeLabels: Record<string, string> = {
  full: '全量规则',
  directed: '定向子集（DELTA-04）',
  unknown: '不可解析',
}
function executionScopeLabel(scope: string | undefined): string {
  return executionScopeLabels[scope ?? ''] ?? (scope || '-')
}

/** 翻转方向计数：按计数降序（后端 JSON 对象的键序不可依赖，这里显式排） */
const flipPairs = computed(() =>
  Object.entries(report.value?.verdict_flips?.by_pair ?? {}).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])),
)
const flips = computed(() => report.value?.verdict_flips ?? null)
/**
 * 翻转明细行键：后端明细没有 id，而 (文件, 行号, 类别) 就是对齐键、天然唯一；
 * Arco 的 row-key 只接受字段名（不接受函数），所以在这里把键物化成字段。
 */
const flipRows = computed(() =>
  (flips.value?.items ?? []).map(item => ({
    ...item,
    row_key: `${item.file_path}:${item.start_line ?? '-'}:${item.category}`,
  })),
)
/** 无基线的说明：后端原因优先，缺失时给兜底文案 */
const flipsReason = computed(
  () => report.value?.verdict_flips_reason || '暂无可比基线（同仓库同 target_type 暂无已产生采信结论的前序 run）',
)

const zeroHitColumns: TableColumnData[] = [
  { title: '规则编号', dataIndex: 'rule_key', width: 150 },
  { title: '规则名', dataIndex: 'name', ellipsis: true, tooltip: true },
  { title: '版本', dataIndex: 'version', width: 70 },
]

const formColumns: TableColumnData[] = [
  { title: '形态', dataIndex: 'form', width: 120 },
  { title: '命中条数', dataIndex: 'count', width: 100 },
  { title: '线索词', slotName: 'keywords', ellipsis: true, tooltip: true },
]

const flipColumns: TableColumnData[] = [
  { title: '文件', dataIndex: 'file_path', ellipsis: true, tooltip: true, width: 360 },
  { title: '行号', dataIndex: 'start_line', width: 80 },
  { title: '类别', dataIndex: 'category', width: 130 },
  { title: '基线结论', slotName: 'prevVerdict', width: 110 },
  { title: '本次结论', slotName: 'curVerdict', width: 110 },
]

function refresh() {
  if (props.runId)
    void load(props.runId)
}
</script>

<template>
  <div class="coverage-report">
    <a-spin :loading="loading" style="width: 100%">
      <!-- 该 run 尚无报告（404）：正常状态，不是错误 -->
      <div v-if="absent && !loading" class="coverage-state">
        <a-empty description="该运行暂无覆盖自证报告" />
        <p class="coverage-state-tip">
          报告在预扫描收口或 AI 确认完成后自动生成；若本 run 仍在进行，稍后点「刷新」重试。
        </p>
      </div>
      <!-- 统一扫描 run 未定稿（run_not_finalized）：判定生命周期中的正常状态 -->
      <div v-else-if="notFinalized && !loading" class="coverage-state">
        <a-empty description="判定中，定稿后可看报告" />
        <p class="coverage-state-tip">
          统一扫描的报告在全部候选判完且回写成功（已定稿）后开放；可在「扫描运行」页查看判定状态，稍后点「刷新」重试。
        </p>
        <div class="coverage-state-action">
          <a-button size="small" @click="refresh">
            刷新
          </a-button>
        </div>
      </div>
      <div v-else-if="failed && !loading" class="coverage-state">
        <a-empty description="覆盖自证报告加载失败" />
        <p class="coverage-state-tip">
          服务端错误或网络异常；详情见页面顶部提示，稍后可点「刷新」重试。
        </p>
      </div>

      <template v-else-if="report">
        <div class="coverage-head">
          <span class="coverage-head-meta">
            生成时间 {{ formatTime(report.generated_at) }} · schema {{ report.schema }} · run {{ report.run_id }}
          </span>
          <a-button size="small" :loading="loading" @click="refresh">
            刷新
          </a-button>
        </div>

        <!-- 报告告警：诚实性自述（未判定、形态外状态、套路化驳回、规则集不可解析、快照漂移…） -->
        <a-alert v-if="report.warnings.length" type="warning" class="m-b-12px">
          <template #title>
            报告告警（{{ report.warnings.length }}）
          </template>
          <ul class="warn-list">
            <li v-for="warning in report.warnings" :key="warning">
              {{ warning }}
            </li>
          </ul>
        </a-alert>

        <!-- ── ① 零命中规则 ─────────────────────────────────────────── -->
        <a-card :bordered="false" size="small" class="m-b-12px">
          <template #title>
            ① 零命中规则
            <small class="card-sub">本 run 扫过但无任何候选，共 {{ report.zero_hit_rules.length }} 条</small>
          </template>
          <a-descriptions :column="4" size="small" bordered class="m-b-12px">
            <a-descriptions-item label="规则集">
              {{ report.rule_scope.rule_set_key || '-' }}@v{{ report.rule_scope.rule_set_version }}
            </a-descriptions-item>
            <a-descriptions-item label="执行口径">
              {{ executionScopeLabel(report.rule_scope.execution_scope) }}
            </a-descriptions-item>
            <a-descriptions-item label="可执行规则数">
              {{ report.rule_scope.loaded_rule_count }}
            </a-descriptions-item>
            <a-descriptions-item label="纳入零命中统计">
              {{ report.rule_scope.executed_rule_count }}
            </a-descriptions-item>
            <a-descriptions-item label="domains 过滤">
              {{ report.rule_scope.domains.length ? report.rule_scope.domains.join('、') : '不限' }}
            </a-descriptions-item>
            <a-descriptions-item label="快照摘要">
              <span :class="report.rule_scope.snapshot_digest_matches ? '' : 'digest-mismatch'">
                {{ report.rule_scope.snapshot_digest_matches ? '与 run 记录一致' : '已漂移（规则集在 run 后被改动）' }}
              </span>
            </a-descriptions-item>
            <a-descriptions-item label="差量类型">
              {{ report.rule_scope.delta_kind || '全量' }}
            </a-descriptions-item>
            <a-descriptions-item label="规则集 ID">
              {{ report.rule_scope.rule_set_id || '-' }}
            </a-descriptions-item>
          </a-descriptions>
          <a-alert v-if="report.rule_scope.unavailable_reason" type="error">
            <template #title>
              零命中清单不可得
            </template>
            {{ report.rule_scope.unavailable_reason }}
          </a-alert>
          <a-table
            v-else
            :data="report.zero_hit_rules"
            :columns="zeroHitColumns"
            :pagination="false"
            size="small"
            row-key="rule_version_id"
          >
            <template #empty>
              <a-empty description="本 run 无零命中规则（有候选的规则覆盖了全部可执行规则）" />
            </template>
          </a-table>
        </a-card>

        <!-- ── ② 判定台账 ───────────────────────────────────────────── -->
        <a-card :bordered="false" size="small" class="m-b-12px">
          <template #title>
            ② 判定台账
            <small class="card-sub">候选判了多少、还剩多少没判</small>
          </template>
          <a-alert v-if="report.ledger.undetermined_warning" type="warning" class="m-b-12px">
            未判定 {{ report.ledger.undetermined }} 条（错误 {{ report.ledger.error }} / 待确认 {{ report.ledger.pending }}），
            占候选 {{ undeterminedPercent }} —— 本 run 尚未完成全量判定，不得据它宣称覆盖已闭环。
          </a-alert>
          <a-space :size="8" wrap class="m-b-12px">
            <a-tag color="arcoblue">
              候选总数 {{ report.ledger.total }}
            </a-tag>
            <a-tag color="green">
              已判定 {{ report.ledger.determined }}
            </a-tag>
            <a-tag :color="report.ledger.undetermined_warning ? 'orange' : 'gray'">
              未判定 {{ report.ledger.undetermined }}
            </a-tag>
            <a-tag color="gray">
              结论明细行 {{ report.ledger.verdict_rows_total }}
            </a-tag>
          </a-space>

          <div class="dist-block">
            <div class="dist-title">
              候选状态分布（主表 ai_status）
            </div>
            <div v-if="statusSegments.length" class="dist-bar">
              <span
                v-for="seg in statusSegments"
                :key="seg.key"
                class="dist-seg"
                :style="{ flexGrow: seg.count, background: seg.color }"
                :title="`${seg.label} ${seg.count}`"
              />
            </div>
            <a-empty v-else description="本 run 无候选" />
            <div class="dist-legend">
              <a-tag v-for="seg in statusSegments" :key="seg.key" :color="seg.tagColor" size="small">
                {{ seg.label }} {{ seg.count }}（{{ seg.percent.toFixed(1) }}%）
              </a-tag>
            </div>
          </div>

          <div class="dist-block">
            <div class="dist-title">
              采信结论分布（结论明细 adopted=1，共 {{ verdictAdoptedTotal }} 条）
            </div>
            <div v-if="verdictSegments.length" class="dist-bar">
              <span
                v-for="seg in verdictSegments"
                :key="seg.key"
                class="dist-seg"
                :style="{ flexGrow: seg.count, background: seg.color }"
                :title="`${seg.label} ${seg.count}`"
              />
            </div>
            <a-empty v-else description="尚无采信结论（结论明细里没有 adopted=1 的行）" />
            <div class="dist-legend">
              <a-tag v-for="seg in verdictSegments" :key="seg.key" :color="seg.tagColor" size="small">
                {{ seg.label }} {{ seg.count }}（{{ seg.percent.toFixed(1) }}%）
              </a-tag>
            </div>
          </div>
        </a-card>

        <!-- ── ③ 驳回理由聚类 ───────────────────────────────────────── -->
        <a-card :bordered="false" size="small" class="m-b-12px">
          <template #title>
            ③ 驳回理由聚类
            <small class="card-sub">rejected 共 {{ report.rejection_forms.rejected_total }} 条，按形态词归类</small>
          </template>
          <a-empty v-if="report.rejection_forms.rejected_total === 0" description="本 run 无 rejected 结论" />
          <template v-else>
            <a-table
              :data="report.rejection_forms.form_counts"
              :columns="formColumns"
              :pagination="false"
              size="small"
              row-key="form"
              class="m-b-8px"
            >
              <template #keywords="{ record }">
                {{ record.matched_keywords.join('、') }}
              </template>
              <template #empty>
                <a-empty description="没有命中任何形态词（理由未走套路化表述）" />
              </template>
            </a-table>
            <p class="coverage-note">
              未命中形态词 {{ report.rejection_forms.unclassified }} 条 · 无理由文案 {{ report.rejection_forms.missing_rationale }} 条
              —— 形态词只统计「不引用证据也能成立」的表述，是否套路化仍需人工判断。
            </p>
          </template>

          <!-- 套路化嫌疑：同文案 ≥3 条，标黄 -->
          <div v-if="report.rejection_forms.stereotype_suspects.length" class="stereotype-block">
            <div class="stereotype-title">
              套路化驳回嫌疑 {{ report.rejection_forms.stereotype_suspects.length }} 组（同文案成批出现，需人工复核）
            </div>
            <div
              v-for="suspect in report.rejection_forms.stereotype_suspects"
              :key="suspect.rationale"
              class="stereotype-item"
            >
              <a-tag color="orange" size="small">
                {{ suspect.candidate_count }} 条
              </a-tag>
              <span class="stereotype-text">{{ suspect.rationale }}</span>
            </div>
          </div>
        </a-card>

        <!-- ── ④ 结论翻转 ───────────────────────────────────────────── -->
        <a-card :bordered="false" size="small" class="m-b-12px">
          <template #title>
            ④ 结论翻转
            <small class="card-sub">与上一条已产生采信结论的 run 对齐（W-N 漂移监测）</small>
          </template>
          <a-alert v-if="!flips" type="info">
            <template #title>
              暂无可比基线
            </template>
            {{ flipsReason }}
          </a-alert>
          <template v-else>
            <a-space :size="8" wrap class="m-b-8px">
              <a-tag color="gray">
                基线 run {{ flips.baseline_run_id }}
              </a-tag>
              <a-tag color="arcoblue">
                对齐样本 {{ flips.aligned_pairs }} 对
              </a-tag>
              <a-tag :color="flips.total > 0 ? 'orange' : 'green'">
                结论翻转 {{ flips.total }} 对
              </a-tag>
            </a-space>
            <div class="dist-legend m-b-8px">
              <a-tag v-for="[pair, count] in flipPairs" :key="pair" color="orangered" size="small">
                {{ pair }} {{ count }}
              </a-tag>
            </div>
            <a-table
              :data="flipRows"
              :columns="flipColumns"
              :pagination="false"
              size="small"
              row-key="row_key"
            >
              <template #prevVerdict="{ record }">
                <a-tag :color="STATUS_META[record.prev_verdict]?.tag ?? 'gray'" size="small">
                  {{ statusLabel(record.prev_verdict) }}
                </a-tag>
              </template>
              <template #curVerdict="{ record }">
                <a-tag :color="STATUS_META[record.cur_verdict]?.tag ?? 'gray'" size="small">
                  {{ statusLabel(record.cur_verdict) }}
                </a-tag>
              </template>
              <template #empty>
                <a-empty description="对齐样本内没有结论翻转" />
              </template>
            </a-table>
            <p class="coverage-note">
              明细最多展示 50 条（确认↔驳回翻转优先），翻转对数为全量；全量逐条留痕在候选的结论明细里。
            </p>
          </template>
        </a-card>
      </template>
    </a-spin>
  </div>
</template>

<style scoped>
/* tab pane 内是独立滚动容器：报告可能很长，滚动落在本组件内部 */
.coverage-report { height: 100%; overflow-y: auto; overflow-x: hidden; padding: 12px 4px 12px 0; }
.coverage-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 12px; }
.coverage-head-meta { color: var(--color-text-3); font-size: 12px; word-break: break-all; }
.card-sub { margin-left: 12px; color: var(--color-text-3); font-weight: normal; font-size: 12px; }
.coverage-state { padding: 48px 0; }
.coverage-state-tip { margin-top: 8px; color: var(--color-text-3); font-size: 12px; text-align: center; }
.coverage-state-action { margin-top: 8px; text-align: center; }
.warn-list { margin: 0; padding-left: 18px; }
.coverage-note { margin: 4px 0 0; color: var(--color-text-3); font-size: 12px; line-height: 1.6; }
.digest-mismatch { color: rgb(var(--warning-6)); font-weight: 600; }

/* 分布条：flex-grow 取计数，条内色块一眼看出占比 */
.dist-block { margin-bottom: 12px; }
.dist-title { margin-bottom: 6px; color: var(--color-text-2); font-size: 12px; }
.dist-bar { display: flex; height: 14px; overflow: hidden; background: var(--color-fill-2); border-radius: 3px; }
.dist-seg { min-width: 2px; }
.dist-legend { display: flex; flex-wrap: wrap; gap: 4px; margin-top: 6px; }

/* 套路化驳回嫌疑：整块标黄，与普通聚类计数区分开 */
.stereotype-block { margin-top: 12px; }
.stereotype-title { margin-bottom: 6px; color: rgb(var(--warning-7)); font-weight: 600; font-size: 12px; }
.stereotype-item {
  display: flex; align-items: baseline; gap: 8px;
  padding: 6px 8px; margin-bottom: 4px;
  background: var(--color-warning-light-1); border-radius: 3px;
}
.stereotype-text { color: var(--color-text-2); font-size: 13px; word-break: break-all; }
</style>
