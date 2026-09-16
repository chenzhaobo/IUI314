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
  // ── 分析范围（归因回传时落库；老数据可回退读 evidence 内联 scope）──
  /** 本次分析处理的日志日期（run_date） */
  analysis_run_date?: string | null
  /** 该日志分组（桶）的慢请求总数 */
  bucket_slow_count?: number | null
  /** 本次下载并参与分析的采样请求数 */
  bucket_sample_count?: number | null
  /** 本次分析命中样本的请求耗时平均（中位见 current_avg_ms） */
  sample_avg_ms?: number | null
  /** 台账行（老链路）内联的缺陷报告，用于回退读分析范围 */
  evidence?: { defect_report?: { scope?: Record<string, any>, metrics?: Record<string, any> } } | null
}

const has = (v: unknown): v is number => v !== null && v !== undefined
const num = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v))

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

/** 分析范围：优先取台账列（新链路），回退读 evidence 内联 scope（老链路）。 */
export function analysisScope(record: AnalysisRecord) {
  const rep = record?.evidence?.defect_report
  const scope = rep?.scope || {}
  const metrics = rep?.metrics || {}
  const runDate = record?.analysis_run_date || scope.run_date || null
  const bucketSlow = record?.bucket_slow_count ?? metrics.bucket_slow_count ?? null
  const samples = record?.bucket_sample_count ?? metrics.selected_sample_count ?? null
  return {
    runDate: runDate as string | null,
    bucketSlow: bucketSlow === null || bucketSlow === undefined ? null : Number(bucketSlow),
    samples: samples === null || samples === undefined ? null : Number(samples),
    customers: record?.impact_inputs?.customers_analysis ?? null,
  }
}

/** 对比表的一行：一个口径（快照 30 天 / 快照当天 / 日志桶 / 本问题）。 */
export interface ImpactComparisonRow {
  label: string
  window: string
  customers: string
  requests: string
  slow: string
  meetRate: string
  avgCost: string
}

const absent = '—'

/**
 * 达标上限归一化成百分数。
 *
 * 库里存百分数（6 表示 6%），但**历史行存的是 0~1 小数**（P-12128 就是 0.06）——
 * 后端写入口径已经归一，读侧不归一就会显示"约 0% 可进 3 秒"。
 */
export function meetRatioPct(v?: number | string | null): number | null {
  const n = num(v)
  if (n === null || !Number.isFinite(n))
    return null
  return Math.max(0, Math.min(100, n > 1 ? n : n * 100))
}

/**
 * 客户数文案：三种情况分开写。
 *
 * 老台账还没重算时字段缺失 → 待接入；重算过但窗口内一个客户都取不到（没数据，
 * 或源数据 customer_name 为空）→ —；其余给千分位个数。
 * 0 不能直接写成"0 个客户"：那读起来像"确实没有客户"，而它多半是这一窗没数据。
 */
function customersText(v?: number | string | null): string {
  if (v === null || v === undefined)
    return '待接入'
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0)
    return absent
  return `${fmtNum(n)} 个`
}

/** 达标率 = 1 − 慢请求 ÷ 总请求（快照口径；日志侧没有未超线的样本，算不出这一列）。 */
function meetRateText(clicks: number | null, slow: number | null): string {
  if (!clicks || slow === null)
    return absent
  return `${(100 - (slow / clicks) * 100).toFixed(2)}%`
}

/**
 * 影响面对比表：四个口径并排，每格都标口径。
 *
 * | 行 | 数据来源 | 回答的问题 |
 * |---|---|---|
 * | 快照·近30天 | 达标率快照聚合 | 这个表单/操作整体多大、达标率多少 |
 * | 快照·分析当天 | 同表按 stat_date 切一天 | 分析那一天的同口径规模（分析只处理那一天） |
 * | 分析·日志桶 | groups.json coverage | 这次分析看了多少（桶里慢事件数 / 下载几条） |
 * | 本问题·折算 | 快照 × 份额 | 这条问题占多少、修复预期 |
 *
 * 日志桶那一行没有总请求/达标率：桶是**慢请求**的集合，日志里没有"未超线"的样本，
 * 强行补一个只会造出假数。
 */
export function impactComparison(record: AnalysisRecord): ImpactComparisonRow[] {
  const i = record?.impact_inputs || {}
  const scope = analysisScope(record)
  const peers = record?.dimension_peers
  const dimNote = peers && peers > 1 ? `（同维度共 ${peers} 条发现）` : ''
  const rows: ImpactComparisonRow[] = []

  rows.push({
    label: '达标率快照',
    window: `近 30 天${i.window ? ` ${i.window}` : ''}`,
    customers: customersText(i.customers_30d),
    requests: fmtNum(i.clicks),
    slow: i.slow_total !== undefined ? `${fmtNum(i.slow_total)}${has(i.slow_ratio_pct) ? `（${i.slow_ratio_pct}%）` : ''}` : absent,
    meetRate: meetRateText(num(i.clicks), num(i.slow_total)),
    avgCost: has(i.avg_ms) ? `${fmtMs(i.avg_ms)}（加权）` : absent,
  })

  if (scope.runDate) {
    rows.push({
      label: '达标率快照',
      window: `分析当天 ${scope.runDate}`,
      customers: customersText(i.customers_day),
      requests: fmtNum(i.day_clicks),
      slow: fmtNum(i.day_slow_total),
      meetRate: meetRateText(num(i.day_clicks), num(i.day_slow_total)),
      avgCost: has(i.day_avg_ms) ? `${fmtMs(i.day_avg_ms)}（加权）` : absent,
    })
  }

  rows.push({
    label: '本次分析·日志桶',
    window: scope.runDate || absent,
    customers: scope.customers === null ? absent : `${scope.customers} 个（采样范围）`,
    requests: `—（日志只含慢请求）`,
    slow: scope.bucketSlow === null ? absent : `${fmtNum(scope.bucketSlow)}${scope.samples !== null ? `（下载 ${fmtNum(scope.samples)} 条）` : ''}`,
    meetRate: absent,
    avgCost: has(record?.sample_avg_ms) || has(record?.current_avg_ms)
      ? `慢样本 ${has(record?.current_avg_ms) ? `中位 ${fmtMs(record.current_avg_ms)}` : ''}${has(record?.sample_avg_ms) ? `${has(record?.current_avg_ms) ? ' / ' : ''}平均 ${fmtMs(record.sample_avg_ms)}` : ''}`
      : absent,
  })

  rows.push({
    label: `本问题·折算${dimNote}`,
    window: scope.runDate || '同左',
    customers: scope.customers === null ? absent : `${scope.customers} 个（采样范围）`,
    requests: absent,
    slow: has(i.affected_users) ? `${fmtNum(i.affected_users)}（折算）${has(i.share_pct) ? ` = 占表单慢请求 ${i.share_pct}%` : ''}` : absent,
    // 措辞必须限定在"该段请求"上：写成"修复后约 6% 可进 3 秒"会被读成
    // 该表单的达标率只有 6%（那是整表单的数字，在上一行）
    meetRate: meetRatioPct(record?.expected_meet_ratio) === null ? absent : `该段请求约 ${Math.round(meetRatioPct(record?.expected_meet_ratio) as number)}% 可进 3 秒（上限）`,
    avgCost: has(record?.current_avg_ms) || has(record?.expected_avg_ms)
      ? `段 ${fmtMs(record.current_avg_ms)} → 残余 ${fmtMs(record.expected_avg_ms)}`
      : absent,
  })

  return rows
}

/**
 * 修复收益：把折算结果放回**快照分母**才谈得上达标率。
 *
 * 达标率提升 = 折算慢请求 × 该问题的达标上限比例 ÷ 该表单总请求。
 * 必须乘达标上限：P-12128 的残余中位 4.9s 远超 3 秒线（上限只有 6%），
 * 不乘就等于宣称"这些请求全都能进线"，虚高十几倍。
 */
export function impactRecovery(record: AnalysisRecord): string[] {
  const i = record?.impact_inputs || {}
  const affected = num(i.affected_users)
  const clicks = num(i.clicks)
  const slow = num(i.slow_total)
  const capPct = meetRatioPct(record?.expected_meet_ratio)
  if (affected === null || !clicks || slow === null)
    return []
  const cap = capPct === null ? 100 : capPct
  const now = 100 - (slow / clicks) * 100
  const after = 100 - ((slow - affected * (cap / 100)) / clicks) * 100
  const delta = after - now
  const lines = [
    `该表单达标率 ${now.toFixed(2)}% → ${after.toFixed(2)}%（${delta >= 0 ? '+' : ''}${delta.toFixed(2)}pp）`
    + ` ＝ 折算 ${fmtNum(affected)} × 达标上限 ${Math.round(cap)}% ÷ 总请求 ${fmtNum(clicks)}`,
  ]
  const avg = num(i.avg_ms)
  const span = num(record?.current_avg_ms)
  const residual = num(record?.expected_avg_ms)
  if (avg !== null && span !== null && residual !== null) {
    const saved = affected * (cap / 100) * (span - residual)
    const afterAvg = Math.max(0, avg - saved / clicks)
    // 收益摊到整表单后可能不到 1ms：这时直说"几乎不变"才是真话 ——
    // 显示成「2.2s → 2.2s」看起来像算错了
    lines.push(
      avg - afterAvg < 1
        ? `该表单平均耗时 ${fmtMs(avg)} → 基本不变（折算收益摊到全部请求后 <1ms）`
        : `该表单平均耗时 ${fmtMs(avg)} → ${fmtMs(Math.round(afterAvg))}（按同一上限估算）`,
    )
  }
  return lines
}

/** 影响面构成的一段。title 里写清"是谁的、哪个窗口、哪种统计量"。 */
export interface ImpactSection {
  title: string
  lines: { k: string, v: string }[]
}

/** 折算算式：只给一个折算结果，等于要求人无条件相信这个数。 */
export function impactFormula(record: AnalysisRecord): string | null {
  const i = record?.impact_inputs || {}
  if (!has(i.affected_users))
    return null
  const dim = String(i.dimension || record?.analysis_dimension || '')
  const control = dim.includes('/') ? dim.split('/').slice(1).join('/') : ''
  const scope = control && control !== '*' ? `操作「${control}」` : '整表单'
  const discount = i.granularity && String(i.granularity).startsWith('表单级') ? ' × 0.4（表单级折扣）' : ''
  const shareText = has(i.share_pct) ? `${i.share_pct}%（本问题在同维度发现中的份额）` : '本问题命中占比'
  return `折算 = ${scope}近 30 天超 3 秒 ${fmtNum(i.slow_total)} 次 × ${shareText}${discount}`
}

/**
 * 影响面构成（tooltip 版）：按口径分段，与抽屉里的对比表同源。
 *
 * 数据全部来自 `impactComparison` —— 三处（tooltip / 台账详情 / 问题详情）
 * 各写一遍渲染，迟早出现"改了一处没改另一处"的口径不一致。
 */
export function impactSections(record: AnalysisRecord): ImpactSection[] {
  const sections: ImpactSection[] = []
  const formula = impactFormula(record)
  const i = record?.impact_inputs || {}

  if (formula) {
    sections.push({
      title: '估算人次（折算）',
      lines: [
        { k: '估算人次', v: `${fmtNum(i.affected_users)} 次/30 天` },
        { k: '折算算式', v: formula },
        { k: '涉及客户', v: `${i.customer_count ?? 0} 个（采样范围）` },
      ],
    })
  }

  for (const row of impactComparison(record)) {
    sections.push({
      title: `${row.label} · ${row.window}`,
      lines: [
        { k: '客户', v: row.customers },
        { k: '总请求', v: row.requests },
        { k: '慢请求', v: row.slow },
        { k: '达标率', v: row.meetRate },
        { k: '平均耗时', v: row.avgCost },
      ].filter(line => line.v !== '—'),
    })
  }

  const recovery = impactRecovery(record)
  if (recovery.length) {
    sections.push({
      title: '修复收益（估算）',
      lines: recovery.map((v, idx) => ({ k: idx === 0 ? '达标率' : '平均耗时', v })),
    })
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
