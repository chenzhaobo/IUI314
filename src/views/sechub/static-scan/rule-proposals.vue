<script setup lang="ts">
/**
 * 规则优化提案页（007c）：退役 / 知识修订 / 新增规则 / 新增扫描点 / 反例。
 *
 * · 提案由生成器在规则效果快照刷新后 best-effort 产出，也可点「立即生成」手动触发；
 * · 只有待处理的提案可采纳 / 驳回，备注可选；采纳只改提案状态，规则改版仍走人工 + 重放；
 * · 比率后端给 0~1 小数，按百分比 1 位小数展示，null 显示「—」（不是 0%）；
 * · 待处理置前（后端排序之上再做页内稳定排序）。
 */
import { onMounted } from 'vue'
import ListPage from '@/components/common/ListPage.vue'
import ProposalEvidence from './rule-proposals/ProposalEvidence.vue'
import {
  kindLabel,
  PROPOSAL_KIND_OPTIONS,
  PROPOSAL_STATUS_OPTIONS,
  proposalMetricItems,
  proposalTarget,
  recordText,
  RULE_PROPOSAL_COLUMNS,
  RULE_PROPOSAL_TABLE_MIN_WIDTH,
  statusLabel,
  text,
} from './rule-proposals/types'
import { DECISION_NOTE_MAX, useRuleProposals } from './rule-proposals/useRuleProposals'

// 组件名必须与路由 name（= sys_menu.path 'rule-proposals'）逐字一致，keep-alive :include 才能缓存本页
// eslint-disable-next-line vue/component-definition-name-casing
defineOptions({ name: 'rule-proposals' })

const {
  rows,
  loading,
  failed,
  query,
  pagination,
  onPageChange,
  onPageSizeChange,
  search,
  reset,
  load,
  decideVisible,
  decideTarget,
  decideDecision,
  decideNote,
  deciding,
  openDecide,
  submitDecide,
  generating,
  generateSummary,
  summaryVisible,
  generate,
} = useRuleProposals()

onMounted(() => {
  void load()
})
</script>

<template>
  <div>
    <ListPage>
      <template #filter>
        <div class="filter-bar">
          <div class="f-sm">
            <a-select v-model="query.kind" placeholder="类型" allow-clear @change="search">
              <a-option v-for="opt in PROPOSAL_KIND_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <div class="f-sm">
            <a-select v-model="query.status" placeholder="状态" allow-clear @change="search">
              <a-option v-for="opt in PROPOSAL_STATUS_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </a-option>
            </a-select>
          </div>
          <a-button type="primary" @click="search">
            查询
          </a-button>
          <a-button @click="reset">
            重置
          </a-button>
        </div>
      </template>

      <template #toolbar>
        <a-button :loading="loading" @click="load()">
          <template #icon>
            <icon-refresh />
          </template>
          刷新
        </a-button>
        <a-button type="primary" :loading="generating" @click="generate">
          立即生成
        </a-button>
        <span class="hint">采纳只改提案状态，不会自动修改规则；规则改版仍走人工修订 + 重放</span>
      </template>

      <template #default="{ tableHeight }">
        <a-table
          :data="rows"
          :columns="RULE_PROPOSAL_COLUMNS"
          :loading="loading"
          :pagination="pagination"
          :scroll="{ minWidth: RULE_PROPOSAL_TABLE_MIN_WIDTH, y: tableHeight }"
          :expandable="{ width: 36 }"
          row-key="id"
          size="small"
          @page-change="onPageChange"
          @page-size-change="onPageSizeChange"
        >
          <template #kind="{ record }">
            <a-tag :color="kindLabel(record.kind).color" size="small">
              {{ kindLabel(record.kind).label }}
            </a-tag>
          </template>
          <template #status="{ record }">
            <a-tag :color="statusLabel(record.status).color" size="small">
              {{ statusLabel(record.status).label }}
            </a-tag>
          </template>
          <template #target="{ record }">
            <div class="mono">
              {{ proposalTarget(record).primary }}
            </div>
            <div class="sub">
              {{ proposalTarget(record).secondary }}
            </div>
          </template>
          <template #metrics="{ record }">
            <span v-for="item in proposalMetricItems(record)" :key="item.label" class="metric">
              <span class="sub">{{ item.label }}</span> {{ item.value }}
            </span>
          </template>
          <template #decision="{ record }">
            <span v-if="record.status === 'pending'" class="sub">—</span>
            <span v-else>{{ text(record.decided_by) }}：{{ text(record.decision_note) }}</span>
          </template>
          <template #ops="{ record }">
            <a-space v-if="record.status === 'pending'" :size="4">
              <a-button type="text" size="small" status="success" @click="openDecide(record, 'accepted')">
                采纳
              </a-button>
              <a-button type="text" size="small" status="danger" @click="openDecide(record, 'rejected')">
                驳回
              </a-button>
            </a-space>
            <span v-else class="sub">已决策</span>
          </template>
          <template #expand-row="{ record }">
            <ProposalEvidence :row="record" />
          </template>
          <template #empty>
            <a-result v-if="failed" status="error" title="提案加载失败" subtitle="后端未返回数据，请重试或检查网络与权限">
              <template #extra>
                <a-button size="small" type="primary" @click="load()">
                  重试
                </a-button>
              </template>
            </a-result>
            <a-empty v-else description="暂无提案：规则效果快照刷新后自动生成，也可点「立即生成」" />
          </template>
        </a-table>
      </template>
    </ListPage>

    <!-- 采纳 / 驳回确认（备注可选，写入 decision_note） -->
    <a-modal
      v-model:visible="decideVisible"
      :title="decideDecision === 'accepted' ? '采纳提案' : '驳回提案'"
      :ok-loading="deciding"
      :ok-button-props="{ status: decideDecision === 'accepted' ? 'normal' : 'danger' }"
      unmount-on-close
      :on-before-ok="submitDecide"
    >
      <p v-if="decideTarget">
        确认{{ decideDecision === 'accepted' ? '采纳' : '驳回' }}「{{ kindLabel(decideTarget.kind).label }}」提案：
        <span class="mono">{{ proposalTarget(decideTarget).primary }}</span>？
      </p>
      <a-textarea
        v-model="decideNote"
        placeholder="备注（可选）：决策依据、后续动作"
        :max-length="DECISION_NOTE_MAX"
        show-word-limit
        :auto-size="{ minRows: 3 }"
      />
    </a-modal>

    <!-- 立即生成：汇总 -->
    <a-modal v-model:visible="summaryVisible" title="提案生成结果" :footer="false" unmount-on-close>
      <a-descriptions v-if="generateSummary" :column="1" size="small" bordered>
        <a-descriptions-item label="新建">
          {{ generateSummary.created }}
        </a-descriptions-item>
        <a-descriptions-item label="刷新">
          {{ generateSummary.refreshed }}
        </a-descriptions-item>
        <a-descriptions-item label="未变">
          {{ generateSummary.unchanged }}
        </a-descriptions-item>
        <a-descriptions-item label="按类型新建">
          <span v-if="!Object.keys(generateSummary.created_by_kind ?? {}).length">—</span>
          <span v-for="(count, kind) in generateSummary.created_by_kind" :key="kind" class="metric">
            {{ kindLabel(String(kind)).label }} {{ count }}
          </span>
        </a-descriptions-item>
        <a-descriptions-item label="阈值">
          {{ recordText(generateSummary.thresholds) }}
        </a-descriptions-item>
      </a-descriptions>
    </a-modal>
  </div>
</template>

<style scoped>
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
/* 宽度必须落在包裹 div 上：Arco 的 Select 是 inheritAttrs: false */
.f-sm {
  width: 140px;
}
.filter-bar > div :deep(.arco-select) {
  width: 100%;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
.mono {
  overflow: hidden;
  font-family: monospace;
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.sub {
  color: var(--color-text-3);
  font-size: 12px;
}
.metric {
  margin-right: 12px;
  white-space: nowrap;
}
</style>
