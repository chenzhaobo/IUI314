<script setup lang="ts">
/**
 * 「再次分析」区块：问题台账详情与问题列表详情共用。
 *
 * 定位一条台账有两种方式，给其一即可：台账页面传 `patternId`，问题页面传 `issue`
 * （后端 `resolve_pattern_key` 统一解析台账 id / pattern_no / issue_no / issue id）。
 *
 * `active` 跟抽屉的显隐联动：抽屉关掉就停轮询，否则切到别的页面还在发请求。
 */
import { computed, onUnmounted, watch } from 'vue'
import { formatTime } from '@/hooks'
import { CHALLENGE_MAX_LENGTH, decisionMeta, usePatternReanalysis } from '@/views/perf/composables/usePatternReanalysis'

defineOptions({ name: 'PatternReanalysis' })

const props = withDefaults(defineProps<{
  /** 台账行 id 或 pattern_no */
  patternId?: string
  /** 问题的 issue_no 或 id */
  issue?: string
  /** 所在抽屉是否可见；false 时停轮询 */
  active?: boolean
  /** 不可用时的说明；给了值就只显示说明，不显示输入框 */
  unavailableReason?: string
}>(), {
  patternId: '',
  issue: '',
  active: true,
  unavailableReason: '',
})

const { challengeText, submitting, records, loading, load, reset, submit } = usePatternReanalysis()

function dotColor(status?: string): string {
  if (status === 'failed')
    return '#f53f3f'
  if (status === 'running')
    return '#ff7d00'
  return '#00b42a'
}

function onSubmit() {
  void submit()
}

/** 定位键与可见性任一变化都要重新决定加载还是停轮询。 */
const trigger = computed(() => ({
  patternId: props.patternId,
  issue: props.issue,
  active: props.active,
  unavailable: Boolean(props.unavailableReason),
}))

watch(trigger, (next) => {
  // 不可用（无归因产物）时不必请求历史：后端同样会因为找不到台账而报错
  if (!next.active || next.unavailable) {
    reset()
    return
  }
  load({ patternId: next.patternId, issue: next.issue })
}, { immediate: true, deep: true })

onUnmounted(reset)
</script>

<template>
  <div>
    <a-divider>再次分析</a-divider>
    <!-- 手工创建的问题没有归因产物（没有原始日志、也没有报告 md），复核无从下手，
         直接说清原因而不是让人写完质疑再吃一个报错。 -->
    <a-alert v-if="unavailableReason" type="info">
      {{ unavailableReason }}
    </a-alert>
    <template v-else>
      <a-alert type="normal" style="margin-bottom: 10px">
        写明你的方向或质疑，AI 会带着它重新读原始日志与报告，然后判断是<strong>修正这一条</strong>、
        <strong>拆出新的一条</strong>，还是<strong>认为原结论仍然成立</strong>。
        质疑写得越具体（哪一行日志、哪个时间戳对不上）复核越准。
      </a-alert>
      <a-textarea
        v-model="challengeText"
        :auto-size="{ minRows: 3, maxRows: 8 }"
        placeholder="例：这份报告说空档前最后一条日志是 A，但我核对原始 xls 是 B（时间戳 14:10:53.517），而且 A 的出口日志在空档之前就打印了，说明它已经返回。"
        :max-length="CHALLENGE_MAX_LENGTH"
        show-word-limit
      />
      <div style="margin-top: 8px">
        <a-button type="primary" :loading="submitting" @click="onSubmit">
          提交复核
        </a-button>
        <span style="margin-left: 10px; color: #86909c; font-size: 12px">
          复核要读原始 Excel、跑分组脚本、查源码，通常几分钟。结果会自动刷新。
        </span>
      </div>

      <a-spin :loading="loading" style="display: block">
        <div v-if="records.length" style="margin-top: 14px">
          <a-timeline>
            <a-timeline-item
              v-for="r in records"
              :key="r.id"
              :dot-color="dotColor(r.status)"
            >
              <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap">
                <span style="color: #86909c; font-size: 12px">{{ formatTime(r.created_at) }}</span>
                <a-tag v-if="r.challenger_name" size="small">
                  {{ r.challenger_name }}
                </a-tag>
                <a-tag v-if="r.status === 'running'" color="orange" size="small">
                  复核中
                </a-tag>
                <a-tag v-else-if="r.status === 'failed'" color="red" size="small">
                  失败
                </a-tag>
                <a-tag v-else :color="decisionMeta(r.decision).color" size="small">
                  {{ decisionMeta(r.decision).text }}
                </a-tag>
                <!-- create 时结果是另一条台账，给出提示让人去找那条 -->
                <span v-if="r.decision === 'create' && r.result_pattern_id" style="font-size: 12px; color: #86909c">
                  新条目已生成，可在列表中查看
                </span>
              </div>
              <div class="content-block" style="margin-top: 6px">
                <strong>质疑：</strong>{{ r.challenge }}
              </div>
              <div v-if="r.decision_reason" class="content-block" style="margin-top: 6px">
                <strong>复核结论：</strong>
                <pre style="white-space: pre-wrap; margin: 4px 0; font-family: inherit">{{ r.decision_reason }}</pre>
              </div>
              <a-alert v-if="r.error_message" type="error" style="margin-top: 6px">
                {{ r.error_message }}
              </a-alert>
              <div v-if="r.input_log_files?.length || r.input_report_md" style="margin-top: 4px; color: #86909c; font-size: 12px">
                送检证据：{{ r.input_log_files?.length || 0 }} 份原始日志{{ r.input_report_md ? ' + 报告全文' : '' }}
              </div>
            </a-timeline-item>
          </a-timeline>
        </div>
      </a-spin>
    </template>
  </div>
</template>
