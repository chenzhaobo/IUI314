/**
 * 「确认复现」行动作：确认弹窗 → 调接口 → 成功后回调刷新列表。
 * 待复现的缺陷只由 AI 发现产生，人工确认后升级为「待修复」进入正常处置流程。
 */
import type { ScanIssueRow } from '@/types/static-scan'
import { Message, Modal } from '@arco-design/web-vue'
import { canConfirmRepro } from './issueStates'
import { confirmIssueRepro } from './service'

export function useConfirmRepro(onConfirmed: () => void) {
  function confirmRepro(row: Pick<ScanIssueRow, 'id' | 'status' | 'title'>) {
    if (!canConfirmRepro(row)) {
      Message.warning('只有「待复现」的缺陷可以确认复现')
      return
    }
    Modal.confirm({
      title: '确认复现',
      content: `确认「${row.title}」已人工复现？确认后状态变为「待修复」，进入正常处置流程。`,
      okText: '确认复现',
      // 返回 false 保持弹窗打开（失败原因已由拦截器提示）
      onBeforeOk: async () => {
        const res = await confirmIssueRepro(row.id)
        if (res === null)
          return false
        Message.success('已确认复现')
        onConfirmed()
        return true
      },
    })
  }

  return { confirmRepro }
}
