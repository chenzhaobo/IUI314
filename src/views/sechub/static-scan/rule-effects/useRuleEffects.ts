/**
 * 规则效果页的状态与取数（View → Composable → Service → Api）。
 *
 * 只读指标页：AI 侧是 run 级物化快照、开发侧是对缺陷表的实时聚合，
 * 因此不轮询 —— 开发刚改过状态时点「刷新」即可看到（后端每次查询都现算）。
 * 默认按 AI 采信率升序，先看最差的规则。
 */
import type { RuleEffectFilter, RuleEffectTableRow } from './types'
import { ref } from 'vue'
import { usePagedQuery } from '@/hooks'
import { fetchRepositoryOptions, fetchRuleEffects } from './service'
import { RULE_EFFECT_DEFAULT_FILTER, RULE_EFFECT_PAGE_SIZE, RULE_EFFECT_PAGE_SIZES, ruleEffectRowKey } from './types'

export function useRuleEffects() {
  const rows = ref<RuleEffectTableRow[]>([])
  const loading = ref(false)
  /** 最近一次列表查询失败（空态据此渲染「重试」而不是「暂无数据」） */
  const failed = ref(false)
  /** 防竞态：连点筛选/翻页时，迟到的旧响应不得覆盖新条件的结果 */
  let seq = 0

  // fetch 必须传函数声明而不是箭头函数：usePagedQuery 在声明处就要引用它重拉列表，
  // 函数提升在这里真实可用（回调只在事件里触发，不会被立即调用）。
  const { query, total, pagination, onPageChange, onPageSizeChange, search, reset }
    = usePagedQuery<RuleEffectFilter>(
      { ...RULE_EFFECT_DEFAULT_FILTER },
      () => load(),
      { pageSize: RULE_EFFECT_PAGE_SIZE, pageSizeOptions: RULE_EFFECT_PAGE_SIZES },
    )

  async function load() {
    const current = ++seq
    loading.value = true
    try {
      const page = await fetchRuleEffects(query.value)
      // 迟到的响应直接丢弃：它属于上一组查询条件
      if (current !== seq)
        return
      failed.value = page === null
      rows.value = (page?.list ?? []).map(row => ({ ...row, row_key: ruleEffectRowKey(row) }))
      total.value = page?.total ?? 0
    }
    finally {
      if (current === seq)
        loading.value = false
    }
  }

  // ── 仓库下拉 + 显示名解析（同一份数据，避免两处各拉一次）──────────
  const repositoryOptions = ref<{ label: string, value: string }[]>([])
  const repositoryNames = ref<Record<string, string>>({})

  async function loadRepositoryOptions() {
    const list = await fetchRepositoryOptions()
    // 失败就保持空：筛选少一个下拉不该让整页不可用，列表里仓库列退回显示 id
    if (!list)
      return
    repositoryOptions.value = list.map(repo => ({
      label: `${repo.module_name}（${repo.repository_name}）`,
      value: repo.repository_id,
    }))
    const names: Record<string, string> = {}
    for (const repo of list)
      names[repo.repository_id] = `${repo.module_name}（${repo.repository_name}）`
    repositoryNames.value = names
  }

  /** 仓库显示名：解析不到时退回 id（列表行的仓库可能不在当前下拉里）；字段缺失给「—」 */
  function repositoryLabel(repositoryId: unknown): string {
    const id = typeof repositoryId === 'string' ? repositoryId : ''
    if (!id)
      return '—'
    return repositoryNames.value[id] || id
  }

  return {
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
    repositoryOptions,
    loadRepositoryOptions,
    repositoryLabel,
  }
}
