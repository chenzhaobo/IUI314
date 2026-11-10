/**
 * 缺陷代码预览状态：版本切换（最新 / 检出时）、按行段续取、镜像降级后的版本同步。
 * 取数在 service 层，组件只关心展示。
 */
import type { IssueCodePreview, IssueCodeVersion } from './types'
import { ref } from 'vue'
import { fetchIssueCode } from './service'

/** 一次「加载更多」的步长（行） */
const PAGE_STEP = 200

export function useIssueCode() {
  const data = ref<IssueCodePreview | null>(null)
  const loading = ref(false)
  const version = ref<IssueCodeVersion>('current')
  let seq = 0

  async function load(issueId: string, range?: { from?: number, to?: number }) {
    if (!issueId) {
      data.value = null
      return
    }
    const current = ++seq
    loading.value = true
    try {
      const result = await fetchIssueCode({ issue_id: issueId, version: version.value, ...range })
      if (current !== seq)
        return
      if (result) {
        data.value = result
        // 后端可能主动降级（镜像不可用 → 命中上下文快照），以实际内容为准同步开关
        version.value = result.version
      }
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  /** 切换版本：最新 commit ↔ 检出时 commit */
  function switchVersion(issueId: string, next: IssueCodeVersion) {
    if (version.value === next)
      return
    version.value = next
    void load(issueId)
  }

  /** 向上 / 向下续取一段，保持当前版本 */
  function loadMore(issueId: string, direction: 'up' | 'down') {
    const current = data.value
    if (!current)
      return
    if (direction === 'down') {
      const from = current.end_line + 1
      if (from > current.total_lines)
        return
      void load(issueId, { from, to: from + PAGE_STEP - 1 })
      return
    }
    const to = current.start_line - 1
    if (to < 1)
      return
    void load(issueId, { from: Math.max(1, to - PAGE_STEP + 1), to })
  }

  /** 回到命中行附近的默认窗口 */
  function jumpToAnchor(issueId: string) {
    void load(issueId)
  }

  function reset() {
    seq++
    data.value = null
    loading.value = false
    version.value = 'current'
  }

  return { data, loading, version, load, switchVersion, loadMore, jumpToAnchor, reset }
}
