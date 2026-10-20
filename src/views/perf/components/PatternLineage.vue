<script setup lang="ts">
/**
 * 「谱系与变更」区块：问题台账详情与问题列表详情共用。
 *
 * 回答三个问题：这条台账和哪些台账有关（同族 / 修复后残留 / 拆分 / 重复）、
 * 结论被改过几次、每次改之前是什么（旧版报告可以打开看）。
 * `editable` 时额外提供「标记重复 / 取消重复」—— 只在台账页开放，问题页只读。
 */
import { MdPreview } from 'md-editor-v3'
import { computed, ref, watch } from 'vue'
import { formatTime } from '@/hooks'
import { changeKindMeta, childRelationText, entryReportPaths, relationMeta, usePatternLineage } from '@/views/perf/composables/usePatternLineage'
import 'md-editor-v3/lib/style.css'

defineOptions({ name: 'PatternLineage' })

const props = withDefaults(defineProps<{
  /** 台账行 id 或 pattern_no */
  patternId?: string
  /** 问题的 issue_no 或 id */
  issue?: string
  /** 所在抽屉是否可见 */
  active?: boolean
  /** 是否允许人工标记重复 */
  editable?: boolean
}>(), {
  patternId: '',
  issue: '',
  active: true,
  editable: false,
})

const emit = defineEmits<{ changed: [] }>()

const { lineage, loading, load, reset, versionVisible, versionLoading, versionFile, versionMarkdown, versionReason, viewVersion, marking, markDuplicate } = usePatternLineage()

const masterNo = ref('')
const dupReason = ref('')

const trigger = computed(() => ({ patternId: props.patternId, issue: props.issue, active: props.active }))
watch(trigger, (next) => {
  masterNo.value = ''
  dupReason.value = ''
  if (!next.active) {
    reset()
    return
  }
  load({ patternId: next.patternId, issue: next.issue })
}, { immediate: true, deep: true })

// 重复状态必然带 duplicate 关系；只看谱系（标记/取消后会重新加载），不依赖父组件可能过期的行状态
const isDuplicate = computed(() => lineage.value?.relation_type === 'duplicate')
const hasContent = computed(() => {
  const l = lineage.value
  return Boolean(l && (l.related || l.children.length || l.change_log.length || l.family_count))
})

async function onMark(master?: string) {
  const key = props.patternId || lineage.value?.pattern_no || ''
  if (await markDuplicate(key, master, dupReason.value)) {
    masterNo.value = ''
    dupReason.value = ''
    emit('changed')
  }
}
</script>

<template>
  <div>
    <a-divider>谱系与变更</a-divider>
    <a-spin :loading="loading" style="display: block; min-height: 40px">
      <a-empty v-if="!hasContent && !editable" description="没有关联台账，结论也未被改写过" />
      <template v-else-if="lineage">
        <div v-if="lineage.related" class="lineage-row">
          <a-tag :color="relationMeta(lineage.relation_type).color" size="small">
            {{ relationMeta(lineage.relation_type).text }}
          </a-tag>
          <strong>{{ lineage.related.pattern_no }}</strong>
          <span class="muted">{{ lineage.related.title }}（{{ lineage.related.form_id }}）</span>
        </div>
        <div v-for="c in lineage.children" :key="c.id" class="lineage-row">
          <a-tag color="arcoblue" size="small">
            {{ childRelationText(c.relation_type) }}
          </a-tag>
          <strong>{{ c.pattern_no }}</strong>
          <span class="muted">{{ c.title }}（{{ c.form_id }}）</span>
        </div>
        <div v-if="lineage.family_count" class="muted lineage-row">
          另有 {{ lineage.family_count }} 条台账的归因标签与涉及对象相同（多为同一根因在其他表单上的实例；证据不足的不代表同一根因）
        </div>

        <a-timeline v-if="lineage.change_log.length" style="margin-top: 10px">
          <a-timeline-item v-for="(e, i) in lineage.change_log" :key="`${e.at}-${i}`">
            <div class="lineage-row">
              <span class="muted">{{ formatTime(e.at) }}</span>
              <a-tag :color="changeKindMeta(e.kind).color" size="small">
                {{ changeKindMeta(e.kind).text }}
              </a-tag>
              <a-tag v-if="e.related_pattern_no" size="small">
                {{ e.related_pattern_no }}
              </a-tag>
              <span class="muted">{{ e.source }}</span>
            </div>
            <div v-if="e.note" style="margin-top: 4px; white-space: pre-wrap">
              {{ e.note }}
            </div>
            <div v-if="e.title || e.attribution_tag" class="muted" style="margin-top: 4px">
              变更前：{{ e.title }}<template v-if="e.attribution_tag">
                ｜{{ e.attribution_tag }} / {{ e.involved_object }}
              </template>
            </div>
            <div v-for="file in entryReportPaths(e)" :key="file" style="margin-top: 4px">
              <a-button size="mini" type="text" @click="viewVersion(file)">
                查看变更前的报告（{{ file }}）
              </a-button>
            </div>
          </a-timeline-item>
        </a-timeline>

        <div v-if="editable" class="lineage-row" style="margin-top: 10px">
          <template v-if="isDuplicate">
            <a-input v-model="dupReason" size="small" style="width: 320px" placeholder="取消原因（必填）：为什么和主台账不是同一个问题" allow-clear />
            <a-button size="small" :loading="marking" :disabled="!dupReason.trim()" @click="onMark()">
              取消重复标记
            </a-button>
          </template>
          <template v-else>
            <a-input v-model="masterNo" size="small" style="width: 220px" placeholder="主台账编号，如 P-12045" allow-clear />
            <a-input v-model="dupReason" size="small" style="width: 220px" placeholder="说明（可选）" allow-clear />
            <a-button size="small" :loading="marking" :disabled="!masterNo.trim()" @click="onMark(masterNo)">
              标记为该台账的重复
            </a-button>
            <span class="muted">两条其实是同一个问题时使用；之后的统计以主台账为准</span>
          </template>
        </div>
      </template>
    </a-spin>

    <a-modal v-model:visible="versionVisible" :title="`变更前的报告 — ${versionFile}`" width="80vw" :footer="false">
      <a-spin :loading="versionLoading" style="display: block; min-height: 120px">
        <MdPreview v-if="versionMarkdown" :model-value="versionMarkdown" />
        <a-alert v-else-if="versionReason" type="warning">
          {{ versionReason }}
        </a-alert>
      </a-spin>
    </a-modal>
  </div>
</template>

<style scoped>
.lineage-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin-top: 4px;
}
.muted {
  color: #86909c;
  font-size: 12px;
}
</style>
