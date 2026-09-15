/**
 * 问题台账的动作规则表 —— 行内菜单与工具栏**共用这一份**。
 *
 * ## 为什么要有这个模块
 *
 * 以前行内菜单按 `v-if="record.status !== 'xxx'"` 挡，工具栏只看勾选数量；
 * 于是「显示可点」和「真的能动」是两套判断，选中集合里混进一条已提单的，
 * 按钮照样亮着，提交后被后端整批拒绝 —— 用户看到的是一个报错、什么都没发生。
 *
 * ## 状态口径
 *
 * 行的"人工可视状态"以 `issue_id` 为准：**有 issue_id 就是已提单**，只读。
 * 否则看 `status`，只有 new / observing / wont_fix 三个人工态是"活的"；
 * 其余（scheduled/fixing/fixed/verified/recurrent/closed/exempted）是遗留值，
 * 归入 legacy：只保留「撤回待处置」这一个入口把它们拉回新流程。
 */

/** 台账行上出现的人工动作。 */
export type LedgerAction = 'convert' | 'link' | 'wontFix' | 'observe' | 'restore' | 'discard' | 'edit' | 'reanalyze'

/** 行的人工可视状态。 */
export type LedgerState = 'issued' | 'new' | 'observing' | 'wont_fix' | 'legacy'

/** 规则表只需要这几个字段，别处传整行进来也能用。 */
export interface LedgerActionRow {
  status?: string | null
  issue_id?: string | null
}

/** 动作 → 允许的起始状态。没列出的状态一律不可操作。 */
const ALLOWED_FROM: Record<LedgerAction, LedgerState[]> = {
  // 转缺陷 / 关联已有问题：三个未提单的人工态都能走，提单后再由问题跟踪接手
  convert: ['new', 'observing', 'wont_fix'],
  link: ['new', 'observing', 'wont_fix'],
  // 处置：只能从"还没下过这个判断"的状态过来（同态重复点没有意义）
  wontFix: ['new', 'observing'],
  observe: ['new', 'wont_fix'],
  // 撤回：把判断撤掉。遗留态也开放 —— 那是老数据回到新流程的唯一入口
  restore: ['observing', 'wont_fix', 'legacy'],
  // 废弃 = 这条分析不该存在，与问题单生命周期无关；但已提单的不在台账侧动
  discard: ['new', 'observing', 'wont_fix', 'legacy'],
  edit: ['new', 'observing', 'wont_fix', 'legacy'],
  // 再次分析不改状态，已提单的也能复核（结论可能要更新）
  reanalyze: ['issued', 'new', 'observing', 'wont_fix', 'legacy'],
}

/** 动作的显示名，用于按钮与提示文案。 */
const ACTION_LABEL: Record<LedgerAction, string> = {
  convert: '转缺陷',
  link: '关联已有问题',
  wontFix: '不处理',
  observe: '观察',
  restore: '撤回待处置',
  discard: '废弃',
  edit: '修改归属',
  reanalyze: '再次分析',
}

/** 把行归到人工可视状态。`issue_id` 非空即已提单（status 可能是脏的，以关联为准）。 */
export function ledgerStateOf(row: LedgerActionRow | null | undefined): LedgerState {
  if (!row)
    return 'legacy'
  if (row.issue_id != null && String(row.issue_id).trim() !== '')
    return 'issued'
  switch (row.status) {
    case 'new':
    case 'observing':
    case 'wont_fix':
      return row.status
    default:
      return 'legacy'
  }
}

/** 这个动作能不能用在这条行上。 */
export function canLedgerAction(action: LedgerAction, row: LedgerActionRow | null | undefined): boolean {
  return ALLOWED_FROM[action].includes(ledgerStateOf(row))
}

/** 批量：哪些行能被这个动作处理（其余会被跳过）。 */
export function filterActionable<T extends LedgerActionRow>(rows: T[], action: LedgerAction): T[] {
  return rows.filter(row => canLedgerAction(action, row))
}

/**
 * 不能操作时的原因，直接写给人看。
 *
 * 「已提单」这条最需要解释：用户看到的是"按钮灰了"，而真正的原因在另一张表上
 * （问题跟踪里），得说清楚去哪儿处理。
 */
export function ledgerActionDisabledHint(action: LedgerAction, row: LedgerActionRow | null | undefined): string {
  const state = ledgerStateOf(row)
  if (state === 'issued')
    return `已提单的台账是只读的，「${ACTION_LABEL[action]}」请到问题跟踪里操作`
  if (state === 'legacy')
    return `这是历史遗留状态（${row?.status ?? '未知'}），只提供「撤回待处置」把它拉回新流程`
  return `当前状态不支持「${ACTION_LABEL[action]}」`
}

/**
 * 工具行按钮的提示：选中集合里有多少条能动、多少条会被跳过。
 * 没有可操作行时返回禁用原因。
 */
export function batchActionHint(action: LedgerAction, selected: LedgerActionRow[]): string {
  const actionable = filterActionable(selected, action).length
  const skipped = selected.length - actionable
  if (!actionable) {
    if (!selected.length)
      return `请先勾选要${ACTION_LABEL[action]}的台账`
    const issued = selected.filter(r => ledgerStateOf(r) === 'issued').length
    return issued === selected.length
      ? `已选中的台账都已提单，只读；「${ACTION_LABEL[action]}」请到问题跟踪里操作`
      : `已选中的台账都不支持「${ACTION_LABEL[action]}」`
  }
  return skipped > 0
    ? `对 ${actionable} 条执行「${ACTION_LABEL[action]}」，跳过 ${skipped} 条（已提单或状态不支持）`
    : `对选中的 ${actionable} 条执行「${ACTION_LABEL[action]}」`
}
