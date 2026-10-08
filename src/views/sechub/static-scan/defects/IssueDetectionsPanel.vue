<script setup lang="ts">
/**
 * 缺陷详情「检出记录」（契约 A）：列出该缺陷在各次扫描里的全部检出，
 * 标出权威规则与代表检出（= 缺陷当前显示内容的来源），点选某条切换下方报告（复用 MdPreview）。
 */
import { MdPreview } from 'md-editor-v3'
import { toRef } from 'vue'
import { formatTime } from '@/hooks'
import { aiStatusLabels, runTargetTypeLabels } from '../labels'
import { DETECTION_RISK_LABELS, detectionLocation } from './types'
import { useIssueDetections } from './useIssueDetections'

const props = defineProps<{ issueId: string }>()

const { detections, loading, activeId, activeDetection, selectDetection } = useIssueDetections(toRef(props, 'issueId'))
</script>

<template>
  <div class="detections">
    <a-spin :loading="loading" style="width: 100%">
      <div v-if="detections.length" class="detection-list" role="listbox" aria-label="检出记录">
        <div class="detection-row detection-head">
          <span>检出时间</span>
          <span>规则</span>
          <span>扫描点</span>
          <span>判定 / 风险</span>
          <span>模型</span>
          <span>位置</span>
        </div>
        <div
          v-for="row in detections"
          :key="row.detection_id"
          class="detection-row"
          :class="{ 'detection-active': row.detection_id === activeId }"
          role="option"
          tabindex="0"
          :aria-selected="row.detection_id === activeId"
          @click="selectDetection(row.detection_id)"
          @keydown.enter="selectDetection(row.detection_id)"
        >
          <span>
            {{ formatTime(row.run_created_at) }}
            <span class="detection-sub">
              {{ runTargetTypeLabels[row.run_target_type]?.label ?? row.run_target_type }}
            </span>
          </span>
          <span>
            <a-tooltip :content="row.rule_key" mini>
              <span>{{ row.rule_name || row.rule_key }}</span>
            </a-tooltip>
            <span class="detection-badges">
              <a-tag v-if="row.is_representative" color="arcoblue" size="small">
                代表检出
              </a-tag>
              <a-tag :color="row.is_authoritative ? 'green' : 'gray'" size="small">
                {{ row.is_authoritative ? '权威' : '非权威' }}
              </a-tag>
            </span>
          </span>
          <span class="detection-ellipsis" :title="row.scan_point_name">
            {{ row.scan_point_name || '-' }}
          </span>
          <span class="detection-badges">
            <a-tag :color="aiStatusLabels[row.ai_status]?.color ?? 'gray'" size="small">
              {{ aiStatusLabels[row.ai_status]?.label ?? row.ai_status }}
            </a-tag>
            <a-tag v-if="row.risk_level" :color="DETECTION_RISK_LABELS[row.risk_level]?.color ?? 'gray'" size="small">
              {{ DETECTION_RISK_LABELS[row.risk_level]?.label ?? row.risk_level }}
            </a-tag>
          </span>
          <span class="detection-ellipsis" :title="row.ai_model ?? ''">
            {{ row.ai_model || '-' }}
          </span>
          <span class="detection-ellipsis" :title="detectionLocation(row)">
            {{ detectionLocation(row) }}
          </span>
        </div>
      </div>
      <a-empty v-else-if="!loading" description="暂无检出记录" />
    </a-spin>
    <div v-if="activeDetection" class="detection-report">
      <div class="detection-report-title">
        {{ formatTime(activeDetection.run_created_at) }} · {{ activeDetection.rule_name || activeDetection.rule_key }}
        <a-tag v-if="activeDetection.is_representative" color="arcoblue" size="small">
          代表检出
        </a-tag>
      </div>
      <MdPreview v-if="activeDetection.ai_detail_report" :model-value="activeDetection.ai_detail_report" />
      <a-empty v-else description="该检出没有详细报告" />
    </div>
  </div>
</template>

<style scoped>
.detections { display: flex; flex-direction: column; gap: 12px; }
.detection-list { max-height: 280px; overflow-x: hidden; overflow-y: auto; border: 1px solid var(--color-border-2); border-radius: 4px; }
.detection-row { display: grid; grid-template-columns: 150px 1.6fr 1fr 150px 120px 2fr; gap: 8px; align-items: center; padding: 6px 10px; border-bottom: 1px solid var(--color-border-1); cursor: pointer; font-size: 13px; }
.detection-row:last-child { border-bottom: none; }
.detection-row:hover, .detection-row:focus-visible { background: var(--color-fill-2); outline: none; }
.detection-head { position: sticky; top: 0; z-index: 1; background: var(--color-fill-1); color: var(--color-text-3); cursor: default; font-size: 12px; }
.detection-active { background: var(--color-primary-light-1); }
.detection-sub { display: block; color: var(--color-text-3); font-size: 12px; }
.detection-badges { display: inline-flex; flex-wrap: wrap; gap: 4px; margin-left: 4px; }
.detection-ellipsis { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.detection-report-title { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; font-weight: 500; }
</style>
