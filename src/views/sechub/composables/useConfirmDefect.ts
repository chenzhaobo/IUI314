/**
 * 运行结果「确认缺陷」：弹窗说明（可选）+ 调用 confirm-defect。
 *
 * 成功后后端会返回 `created`（新建 / 命中同指纹更新），
 * 弹窗据此提示，并给出缺陷草稿页面的跳转入口。
 */
import type { ConfirmDefectResult } from '@/types/sechub-release'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'

import { confirmDefect } from '../services/defectDraftService'

export function useConfirmDefect() {
  const visible = ref(false)
  const comment = ref('')
  const submitting = ref(false)
  const result = ref<ConfirmDefectResult | null>(null)
  const resultId = ref('')

  function open(id: string) {
    resultId.value = id
    comment.value = ''
    result.value = null
    visible.value = true
  }

  function close() {
    if (!submitting.value)
      visible.value = false
  }

  async function submit(): Promise<boolean> {
    if (!resultId.value)
      return false
    submitting.value = true
    try {
      const response = await confirmDefect(resultId.value, comment.value)
      if (!response)
        return false
      result.value = response
      Message.success('已生成缺陷草稿')
      return true
    }
    finally {
      submitting.value = false
    }
  }

  return { visible, comment, submitting, result, open, close, submit }
}
