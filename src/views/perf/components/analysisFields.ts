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
  /** 根因未证实（待补证）：分数不参与优先排序，展示上也要说清 */
  evidence_pending?: boolean
  /** 同一分析维度下的台账条数（含本条） */
  dimension_peers?: number | null
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

/** 千分位：417965 → 417,965。这一屏全是五位数以上的量级，不加分隔读不动。 */
export function fmtNum(v?: number | string | null): string {
  if (v === null || v === undefined || v === '')
    return '--'
  const n = Number(v)
  return Number.isFinite(n) ? n.toLocaleString('en-US') : String(v)
}

/** 影响面构成的一段。title 里写清"是谁的、哪个窗口、哪种统计量"。 */
export interface ImpactSection {
  title: string
  lines: { k: string, v: string }[]
}

/**
 * 影响面构成：按**数据来源**分三段讲。
 *
 * ## 为什么必须分段
 *
 * 这三段来自三个不同的口径，窗口、统计量、粒度都不一样：
 *
 * | 段 | 来源 | 口径 |
 * |---|---|---|
 * | 估算人次 | 快照 × 台账份额 | 该**表单**近 30 天；人次是折算值 |
 * | 折算依据 | 达标率快照 | 该表单（或操作）近 30 天；617ms 是**平均** |
 * | 本次分析 | 本次归因的日志明细 | 本**问题段**；5.2s 是**中位**，且是乐观上限 |
 *
 * 平铺成一列时，人会把 617ms（表单平均）和 5.2s（本问题段中位）读成互相矛盾，
 * 把"约 100% 可达标"读成和"慢占比 2.95%"矛盾。分段之后每个数都挂在自己的来源上。
 */
export function impactSections(record: AnalysisRecord): ImpactSection[] {
  const i = record?.impact_inputs || {}
  const sections: ImpactSection[] = []

  // ① 本问题（折算值）：算式写全 —— 只给一个分数等于要求人无条件相信
  if (i.affected_users !== undefined) {
    const dim = String(i.dimension || record.analysis_dimension || '')
    const control = dim.includes('/') ? dim.split('/').slice(1).join('/') : ''
    const scope = control && control !== '*' ? `操作「${control}」` : '整表单'
    const discount = i.granularity && String(i.granularity).startsWith('表单级') ? ' × 0.4（表单级折扣）' : ''
    const shareText = has(i.share_pct) ? `${i.share_pct}%（本问题在同维度发现中的份额）` : '本问题命中占比'
    const formula = `折算 = ${scope}近 30 天超 3 秒 ${fmtNum(i.slow_total)} 次 × ${shareText}${discount}`
    sections.push({
      title: '本问题（估算）',
      lines: [
        { k: '估算人次', v: `${fmtNum(i.affected_users)} 次/30 天` },
        { k: '折算算式', v: formula },
        { k: '涉及客户', v: `${i.customer_count ?? 0} 个` },
        // 命中数是"为什么叫估算"的直接证据：我们只看到这几条，其余是摊出来的
        has(i.hits) ? { k: '本次命中', v: `${fmtNum(i.hits)} 次（只统计到的问题样本，其余按份额摊到该表单）` } : null,
      ].filter(Boolean) as { k: string, v: string }[],
    })
  }

  // ② 折算依据：快照里是**整表单/操作**的规模，不是本问题的
  const snapshot: { k: string, v: string }[] = []
  if (i.form_name || i.dimension) {
    const dim = String(i.dimension || '')
    const control = dim.includes('/') ? dim.split('/').slice(1).join('/') : ''
    const formLabel = i.form_name ? `${i.form_name}（${dim.split('/')[0]}）` : dim.split('/')[0]
    snapshot.push({ k: '表单', v: formLabel || '--' })
    snapshot.push({ k: '操作', v: control && control !== '*' ? control : '未指定（按整表单口径）' })
  }
  if (i.clicks !== undefined) {
    const ratio = has(i.slow_ratio_pct) ? `超 3 秒 ${fmtNum(i.slow_total)} 次（${i.slow_ratio_pct}%）` : `超 3 秒 ${fmtNum(i.slow_total)} 次`
    snapshot.push({ k: '规模', v: `共 ${fmtNum(i.clicks)} 次请求，${ratio}` })
  }
  if (has(i.avg_ms)) {
    // 达标线 3 秒：低于它说明整体不慢，慢的是其中一部分请求
    const tail = i.avg_ms >= 3000 ? '已超达标线' : '整体未超线，慢在部分请求'
    snapshot.push({ k: '平均耗时', v: `${fmtMs(i.avg_ms)}（${tail}）` })
  }
  if (snapshot.length) {
    sections.push({
      title: `折算依据 · 达标率快照（${i.window || '近 30 天'}）`,
      lines: snapshot,
    })
  }

  // ③ 本次分析：只覆盖本次抓到的日志，且是按上限估的
  const analysis: { k: string, v: string }[] = []
  const peers = record?.dimension_peers
  if (has(record?.current_avg_ms)) {
    analysis.push({ k: '本问题段耗时', v: `中位 ${fmtMs(record.current_avg_ms)}` })
  }
  if (has(record?.expected_avg_ms)) {
    // 措辞必须是「即使…仍」：脚本假设该段归零，做不到的部分它判断不了
    analysis.push({ k: '该段消除后', v: `本维度仍剩 ${fmtMs(record.expected_avg_ms)}` })
  }
  if (has(record?.expected_meet_ratio)) {
    analysis.push({ k: '达标上限', v: `该段请求约 ${Math.round(Number(record.expected_meet_ratio))}% 可进 3 秒（乐观上限，不是预测）` })
  }
  if (analysis.length) {
    const groupNote = peers && peers > 1 ? ` · 同一分析维度共 ${peers} 条发现（份额按此分摊）` : ''
    sections.push({ title: `本次分析${groupNote}`, lines: analysis })
  }

  return sections
}

/** 待补证的说明文案；不是待补证返回 null。 */
export function impactPendingNote(record: AnalysisRecord): string | null {
  if (!record?.evidence_pending)
    return null
  return '根因未证实（待补证）：分数是按未证实的猜测折算的，不参与「该先修谁」的排序'
}

/**
 * 分析权重 tooltip 的说明行。
 *
 * 第一行说清"这个百分比是什么口径"（AI 那一轮、占本维度总慢时间）；
 * 第二行是治理预期 —— 与影响面构成第三段是同一件事的两种入口。
 */
export function analysisWeightLines(record: AnalysisRecord): string[] {
  const lines = [`该问题占本维度总慢时间 ${record?.analysis_share_pct ?? record?.analysis_weight}%（AI 那一轮的口径）`]
  if (has(record?.expected_avg_ms)) {
    lines.push(`当前平均 ${fmtMs(record.current_avg_ms)}；即使该段完全消除，仍有 ${fmtMs(record.expected_avg_ms)}`)
  }
  return lines
}
