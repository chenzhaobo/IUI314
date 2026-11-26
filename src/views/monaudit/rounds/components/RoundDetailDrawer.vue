<script setup lang="ts">
/** 轮次详情：批次进度表（未结束时自动刷新）+ 结算统计；失败批次可重试 */
import { computed, toRef } from 'vue'
import { formatTime } from '@/hooks'
import { BATCH_STATUS, ROUND_STATUS, tagMeta } from '../../shared/types'
import { BATCH_PHASE, caseProgressText, SETTLE_LABELS } from '../types'
import { useRoundDetail } from '../useRoundDetail'
import CaseComparisonPanel from './CaseComparisonPanel.vue'

const props = defineProps<{
  roundId: string
}>()

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

const { detail, loading, retryingId, retry, stats, reload } = useRoundDetail(visible, toRef(props, 'roundId'), () => emit('changed'))

const logSummary = computed(() => {
  const batches = detail.value?.batches ?? []
  return {
    total: batches.reduce((sum, batch) => sum + batch.log_total, 0),
    done: batches.reduce((sum, batch) => sum + batch.log_done, 0),
    failed: batches.reduce((sum, batch) => sum + batch.log_failed, 0),
    running: batches.some(batch => batch.phase === 'logs'),
  }
})
const caseProgress = computed(() => (detail.value ? caseProgressText(detail.value.round) : '0'))
</script>

<template>
  <a-drawer v-model:visible="visible" :width="1100" :footer="false" unmount-on-close>
    <template #title>
      <span>轮次详情</span>
      <span v-if="detail" class="title-sub">{{ detail.round.round_no }} · {{ detail.round.name }}</span>
    </template>
    <a-spin :loading="loading" class="drawer-spin">
      <template v-if="detail">
        <div class="head-row">
          <a-space>
            <a-tag :color="tagMeta(ROUND_STATUS, detail.round.status).color">
              {{ tagMeta(ROUND_STATUS, detail.round.status).label }}
            </a-tag>
            <a-tag>
              最近抓日志 {{ logSummary.done }}/{{ logSummary.total }}
            </a-tag>
            <a-tag v-if="logSummary.failed > 0" color="red">
              日志失败 {{ logSummary.failed }}
            </a-tag>
            <a-tag v-if="logSummary.running" color="arcoblue">
              抓日志中
            </a-tag>
            <a-tag v-if="detail.round.case_sync_status">
              用例 {{ caseProgress }}
            </a-tag>
            <span v-if="!detail.done" class="muted">任务进行中，每 5 秒自动刷新</span>
          </a-space>
          <a-button size="mini" @click="reload">
            刷新
          </a-button>
        </div>

        <a-alert type="info" class="stats-tip">
          结算统计只记录问题复现判定（出现 / 新增 / 重现 / 复发 / 未复现 / 失败批次），不包含日志条数。“最近抓日志”是批次最后一次补抓的待处理数，显示 0/0 表示当时没有待抓任务，不代表该源没有已落盘日志。
        </a-alert>

        <a-descriptions v-if="stats" :column="6" size="small" bordered title="结算统计（问题判定）" class="stats">
          <a-descriptions-item v-for="item in SETTLE_LABELS" :key="item.key" :label="item.label">
            {{ stats[item.key] ?? 0 }}
          </a-descriptions-item>
        </a-descriptions>

        <a-table :data="detail.batches" :pagination="false" row-key="id" size="small" :scroll="{ minWidth: 1300 }">
          <template #columns>
            <a-table-column title="同步源" data-index="source_name" :width="160" ellipsis tooltip />
            <a-table-column title="环境" data-index="env_name" :width="110" ellipsis tooltip />
            <a-table-column title="数据中心" data-index="datacenter_name" :width="140" ellipsis tooltip />
            <a-table-column title="状态" data-index="status" :width="80">
              <template #cell="{ record }">
                <a-tag :color="tagMeta(BATCH_STATUS, record.status).color" size="small">
                  {{ tagMeta(BATCH_STATUS, record.status).label }}
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="阶段" data-index="phase" :width="90">
              <template #cell="{ record }">
                {{ record.phase ? (BATCH_PHASE[record.phase] ?? record.phase) : '-' }}
              </template>
            </a-table-column>
            <a-table-column title="拉取" data-index="fetched_count" :width="70" />
            <a-table-column title="入库" data-index="raw_count" :width="70" />
            <a-table-column title="问题" data-index="issue_count" :width="70" />
            <a-table-column title="新增问题" data-index="new_issue_count" :width="80" />
            <a-table-column title="最近抓日志（完成/总数）" :width="170">
              <template #cell="{ record }">
                <span>{{ record.log_done }}/{{ record.log_total }}</span>
                <a-tag v-if="record.log_failed > 0" color="red" size="small" class="log-failed">
                  失败 {{ record.log_failed }}
                </a-tag>
                <a-tag v-if="record.phase === 'logs'" color="arcoblue" size="small" class="log-failed">
                  抓取中
                </a-tag>
              </template>
            </a-table-column>
            <a-table-column title="错误 / 日志提示" data-index="error" :width="240" ellipsis tooltip />
            <a-table-column title="开始" data-index="started_at" :width="160">
              <template #cell="{ record }">
                {{ formatTime(record.started_at) }}
              </template>
            </a-table-column>
            <a-table-column title="结束" data-index="finished_at" :width="160">
              <template #cell="{ record }">
                {{ formatTime(record.finished_at) }}
              </template>
            </a-table-column>
            <a-table-column title="操作" :width="80" fixed="right">
              <template #cell="{ record }">
                <a-button
                  v-if="record.status === 'failed' && detail.round.status !== 'settled'"
                  size="mini"
                  type="primary"
                  :loading="retryingId === record.id"
                  @click="retry(record.id)"
                >
                  重试
                </a-button>
              </template>
            </a-table-column>
          </template>
        </a-table>

        <CaseComparisonPanel :round="detail.round" @refresh="reload" />
      </template>
      <a-empty v-else-if="!loading" description="轮次不存在" />
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.drawer-spin { display: block; width: 100%; }
.title-sub { margin-left: 8px; color: var(--color-text-3); font-size: 13px; }
.head-row { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.muted { color: var(--color-text-3); font-size: 12px; }
.stats { margin-bottom: 12px; }
.stats-tip { margin-bottom: 12px; }
.log-failed { margin-left: 4px; }
</style>
