<script setup lang="ts">
/**
 * 缺陷代码预览抽屉（A+B）：
 * - 默认看仓库分支**最新 commit** 的文件片段（后端按命中文本重新定位行号）；
 * - 顶部可切到**缺陷最近一次检出时的 commit**，行号与缺陷记录对齐；
 * - 镜像不可用时后端回退到扫描时保存的命中上下文（±10 行），此处用 note 说明。
 *
 * 只渲染纯文本 + 行号，不引额外的语法高亮依赖，也不用 v-html。
 */
import type { IssueCodeVersion } from './types'
import { computed, nextTick, ref, watch } from 'vue'
import { formatTime } from '@/hooks'
import { useIssueCode } from './useIssueCode'

const props = defineProps<{
  visible: boolean
  issueId: string
  /** 弹窗标题里显示的缺陷标题 */
  issueTitle?: string
  /** 缺陷最近一次检出的 commit（来自列表行），用来判断能否切「检出时」 */
  detectionCommit?: string | null
}>()

const emit = defineEmits<{ (e: 'update:visible', value: boolean): void }>()

const { data, loading, version, load, switchVersion, loadMore, jumpToAnchor, reset } = useIssueCode()
const codeRef = ref<HTMLElement | null>(null)

const hasDetection = computed(() => Boolean(props.detectionCommit?.trim()))
const hitLines = computed(() => new Set(data.value?.highlight_lines ?? []))
const isSnippet = computed(() => data.value?.source === 'snippet')
const pathText = computed(() => {
  const current = data.value
  if (!current)
    return props.issueTitle || ''
  return current.resolved_path || current.file_path
})

function shortSha(sha?: string | null): string {
  return sha ? sha.slice(0, 8) : ''
}

function onVersionChange(value: string | number | boolean) {
  const next = String(value) as IssueCodeVersion
  if (next !== 'current' && next !== 'detection')
    return
  switchVersion(props.issueId, next)
}

watch(
  () => [props.visible, props.issueId] as const,
  ([visible, issueId]) => {
    if (visible && issueId) {
      void load(issueId)
      return
    }
    reset()
  },
)

// 每次换窗口/换版本后把命中行滚到可视区域中间，省得用户自己找
watch(data, async (value) => {
  if (!value || !value.highlight_lines.length)
    return
  await nextTick()
  const hit = codeRef.value?.querySelector('.code-line-hit')
  if (hit instanceof HTMLElement)
    hit.scrollIntoView({ block: 'center' })
}, { flush: 'post' })
</script>

<template>
  <a-drawer
    :visible="visible"
    :width="980"
    :footer="false"
    unmount-on-close
    @cancel="emit('update:visible', false)"
  >
    <template #title>
      <div class="code-head">
        <span class="code-title" :title="pathText">
          代码 · {{ issueTitle || pathText }}
        </span>
        <a-radio-group
          :model-value="version"
          type="button"
          size="small"
          @change="onVersionChange"
        >
          <a-radio value="current">
            最新代码
          </a-radio>
          <a-radio value="detection" :disabled="!hasDetection">
            检出时{{ detectionCommit ? ` ${shortSha(detectionCommit)}` : '' }}
          </a-radio>
        </a-radio-group>
      </div>
    </template>

    <a-spin :loading="loading" style="width: 100%">
      <template v-if="data">
        <!-- 版本条：commit / 时间 / 作者 / 分支。commit 时间是判断「看到的是哪一版」的关键 -->
        <div class="code-meta">
          <span class="code-meta-item">
            <span class="code-meta-label">提交</span>
            <a-tooltip v-if="data.commit" :content="data.commit" mini>
              <span class="code-sha">{{ data.commit_short || shortSha(data.commit) }}</span>
            </a-tooltip>
            <span v-else class="code-meta-muted">-</span>
          </span>
          <span class="code-meta-item">
            <span class="code-meta-label">提交时间</span>
            <span>{{ data.commit_time ? formatTime(data.commit_time) : '-' }}</span>
          </span>
          <span v-if="data.commit_author" class="code-meta-item">
            <span class="code-meta-label">作者</span>
            <span>{{ data.commit_author }}</span>
          </span>
          <span v-if="data.branch" class="code-meta-item">
            <span class="code-meta-label">分支</span>
            <span class="code-branch">{{ data.branch }}</span>
          </span>
          <span v-if="data.encoding && data.encoding !== 'utf-8'" class="code-meta-item">
            <span class="code-meta-label">编码</span>
            <span>{{ data.encoding }}</span>
          </span>
        </div>
        <div v-if="data.commit_subject" class="code-subject" :title="data.commit_subject">
          {{ data.commit_subject }}
        </div>

        <!-- 降级 / 行号重定位 / 路径纠偏的说明，别把异常状态藏在日志里 -->
        <a-alert v-if="data.note" :type="isSnippet ? 'warning' : 'info'" class="code-note">
          {{ data.note }}
        </a-alert>

        <div v-if="data.available && data.lines.length" class="code-panel">
          <div class="code-toolbar">
            <span class="code-range">
              第 {{ data.start_line }}–{{ data.end_line }} 行 / 共 {{ data.total_lines }} 行
            </span>
            <a-space :size="8">
              <a-button size="mini" :disabled="data.start_line <= 1" @click="loadMore(issueId, 'up')">
                上一段
              </a-button>
              <a-button size="mini" :disabled="data.end_line >= data.total_lines" @click="loadMore(issueId, 'down')">
                下一段
              </a-button>
              <a-button v-if="data.highlight_lines.length" size="mini" type="text" @click="jumpToAnchor(issueId)">
                回到命中行
              </a-button>
            </a-space>
          </div>
          <div ref="codeRef" class="code-view">
            <div
              v-for="line in data.lines"
              :key="line.n"
              class="code-line"
              :class="{ 'code-line-hit': hitLines.has(line.n) }"
            >
              <span class="code-n">{{ line.n }}</span>
              <span class="code-t">{{ line.text || ' ' }}</span>
            </div>
          </div>
        </div>
        <a-empty v-else description="暂无可预览的源码">
          <template #description>
            <div>{{ data.note || '该缺陷没有可预览的源码' }}</div>
          </template>
        </a-empty>
      </template>
      <a-empty v-else-if="!loading" description="暂无源码可预览" />
    </a-spin>
  </a-drawer>
</template>

<style scoped>
.code-head { display: flex; gap: 16px; align-items: center; justify-content: space-between; }
.code-title { overflow: hidden; max-width: 640px; text-overflow: ellipsis; white-space: nowrap; font-size: 15px; font-weight: 600; }
.code-meta { display: flex; flex-wrap: wrap; gap: 6px 20px; align-items: center; margin-bottom: 6px; color: var(--color-text-2); font-size: 13px; }
.code-meta-item { display: inline-flex; gap: 6px; align-items: center; }
.code-meta-label { color: var(--color-text-3); }
.code-meta-muted { color: var(--color-text-3); }
.code-sha { font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
.code-branch { padding: 0 6px; border-radius: 3px; background: var(--color-fill-2); }
.code-subject { overflow: hidden; margin-bottom: 10px; color: var(--color-text-3); text-overflow: ellipsis; white-space: nowrap; font-size: 12px; }
.code-note { margin-bottom: 10px; }
.code-toolbar { display: flex; gap: 12px; align-items: center; justify-content: space-between; padding: 6px 10px; border-bottom: 1px solid var(--color-border-2); background: var(--color-fill-1); font-size: 12px; }
.code-range { color: var(--color-text-3); }
.code-view { overflow: auto; max-height: 62vh; border: 1px solid var(--color-border-2); border-top: none; background: var(--color-bg-2); }
.code-line { display: flex; min-width: max-content; line-height: 20px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
.code-line:hover { background: var(--color-fill-2); }
.code-line-hit { background: rgb(var(--warning-1)); }
.code-line-hit:hover { background: rgb(var(--warning-2)); }
.code-n { position: sticky; left: 0; flex: 0 0 auto; width: 56px; padding: 0 10px 0 8px; border-right: 1px solid var(--color-border-1); background: var(--color-fill-1); color: var(--color-text-3); text-align: right; user-select: none; }
.code-t { flex: 1 1 auto; padding: 0 12px; color: var(--color-text-1); white-space: pre; }
</style>
