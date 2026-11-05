<script setup lang="ts">
/** 轮次详情：批次进度表（未结束时自动刷新）+ 结算统计；失败批次可重试 */
import { toRef } from 'vue'
import { formatTime } from '@/hooks'
import { BATCH_STATUS, ROUND_STATUS, tagMeta } from '../../shared/types'
import { BATCH_PHASE, SETTLE_LABELS } from '../types'
import { useRoundDetail } from '../useRoundDetail'

const props = defineProps<{
  roundId: string
}>()

const emit = defineEmits<{
  (e: 'changed'): void
}>()

const visible = defineModel<boolean>('visible', { required: true })

const { detail, loading, retryingId, retry, stats, reload } = useRoundDetail(visible, toRef(props, 'roundId'), () => emit('changed'))
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
            <span v-if="!detail.done" class="muted">同步进行中，每 5 秒自动刷新</span>
          </a-space>
          <a-button size="mini" @click="reload">
            刷新
          </a-button>
        </div>

        <a-descriptions v-if="stats" :column="6" size="small" bordered title="结算统计" class="stats">
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
            <a-table-column title="日志" :width="80">
              <template #cell="{ record }">
                {{ record.log_done }}/{{ record.log_total }}
              </template>
            </a-table-column>
            <a-table-column title="错误" data-index="error" :width="220" ellipsis tooltip />
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
</style>
