/**
 * 台账与问题列表共用的「归因产出」渲染口径。
 *
 * 影响面、影响面构成、分析权重、归因标签都是归因算在**台账**上的结果，
 * 而两个页面看的是同一个问题 —— 口径只能有一份。否则同一行在两边显示的
 * 分数与标签会各自演进（比如一边改了「未评分」的措辞、另一边还没改），
 * 这正是这次统一要消掉的东西。
 *
 * 页面侧对应的展示件是 `ImpactCell.vue` / `AnalysisWeightCell.vue`，
 * 详情抽屉里的「影响面构成」也直接调这里的 `impactRows`。
 */

/** 分析字段的最小形状。台账行与问题行都带这些键（问题行由后端从关联台账补齐）。 */
export interface AnalysisRecord {
  impact_score?: number | null
  impact_level?: string | null
  impact_inputs?: Record<string, any> | null
  analysis_weight?: number | null
  analysis_share_pct?: number | string | null
  analysis_dimension?: string | null
  current_avg_ms?: number | null
  expected_avg_ms?: number | null
  expected_meet_ratio?: number | string | null
}

const has = (v: unknown): v is number => v !== null && v !== undefined

/** 毫秒格式化：>=1000 走秒（1.5s），否则原样（800ms）。 */
export function fmtMs(ms?: number | null): string {
  if (ms === null || ms === undefined)
    return '--'
  return ms >= 1000 ? `${(ms / 1000).toFixed(1)}s` : `${ms}ms`
}

/** 影响面等级配色。 */
export function impactColor(level?: string | null): string {
  switch (level) {
    case 'P0': return 'red'
    case 'P1': return 'orange'
    case 'P2': return 'blue'
    default: return 'gray'
  }
}

/** 归因标签「一级-二级」拆成两个 tag；没有分隔符就原样一个。 */
export function splitTag(tag?: string | null): string[] {
  if (!tag)
    return []
  return tag.includes('-') ? tag.split('-', 2) : [tag]
}

/**
 * 影响面构成：把 `impact_inputs` 翻成人能读的几行。
 *
 * 每一行都带口径（份额怎么来的、是不是估算），因为"这个分数是怎么算出来的"
 * 决定了它能不能被质疑 —— 只给一个总分等于要求人无条件相信。
 */
export function impactRows(record: AnalysisRecord): { k: string, v: string }[] {
  const i = record?.impact_inputs || {}
  const rows: { k: string, v: string }[] = []
  if (i.affected_users !== undefined) {
    const src = i.slow_total ? `该操作超3秒 ${i.slow_total} 次中的份额` : '按本问题命中数'
    rows.push({ k: '受影响人次', v: `${i.affected_users} 次/30天（${src}）` })
  }
  if (i.customer_count !== undefined)
    rows.push({ k: '影响客户', v: `${i.customer_count} 个` })
  if (has(i.avg_ms)) {
    // 达标线 3 秒：低于它说明这个操作整体不慢，慢的是其中一部分请求
    const tail = i.avg_ms >= 3000 ? '（已超达标线）' : '（整体未超线，慢在部分请求）'
    rows.push({ k: '平均响应', v: `${fmtMs(i.avg_ms)}${tail}` })
  }
  if (i.clicks !== undefined) {
    const ratio = has(i.slow_ratio_pct) ? `，慢占比 ${i.slow_ratio_pct}%` : ''
    rows.push({ k: '操作点击量', v: `${i.clicks} 次/30天${ratio}` })
  }
  if (record.analysis_dimension)
    rows.push({ k: '分析维度', v: record.analysis_dimension })
  // 口径必须显示：表单级是估算（含该表单其它操作），那 106 条要让人知道
  if (i.granularity)
    rows.push({ k: '统计口径', v: `${i.granularity}，${i.window || ''}` })
  if (has(record.expected_avg_ms)) {
    // 这个比例决定「这条能不能单独修」：13% 意味着修完大部分请求仍超标
    const ceiling = has(record.expected_meet_ratio)
      ? `（按此上限约 ${Math.round(Number(record.expected_meet_ratio))}% 的请求可进 3 秒内）`
      : ''
    rows.push({
      k: '治理预期',
      // 措辞必须是「即使…仍」：脚本假设该段降为 0，做不到的部分它判断不了
      v: `当前 ${fmtMs(record.current_avg_ms)}，即使该段完全消除仍有 ${fmtMs(record.expected_avg_ms)}${ceiling}`,
    })
  }
  return rows
}

/**
 * 分析权重 tooltip 的说明行。
 *
 * 第一行说清"这个百分比是什么口径"（AI 那一轮、占本维度总慢时间），
 * 第二行是治理预期 —— 与影响面构成里的「治理预期」是同一件事的两种入口。
 */
export function analysisWeightLines(record: AnalysisRecord): string[] {
  const lines = [`该问题占本维度总慢时间 ${record?.analysis_share_pct ?? record?.analysis_weight}%（AI 那一轮的口径）`]
  if (has(record?.expected_avg_ms)) {
    lines.push(`当前平均 ${fmtMs(record.current_avg_ms)}；即使该段完全消除，仍有 ${fmtMs(record.expected_avg_ms)}`)
  }
  return lines
}
