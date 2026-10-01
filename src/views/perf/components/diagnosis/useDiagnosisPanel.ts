/**
 * 诊断卡片的状态与取数（View → Composable → Service → Api）。
 *
 * 同一组件挂在 run / task 两种 scope 上：换 scope_id 时重取列表并清空
 * AI 报告提示（旧报告不属于新范围）。防竞态同其余页签。
 */
import type { Ref } from 'vue'
import type { DiagnosisRow, DiagnosisStepView } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { convertToIssue, fetchDiagnosisList, interpretDiagnosis } from './service'
import { buildStepViews } from './types'

export function useDiagnosisPanel(scope: string, scopeId: Ref<string>) {
  const loading = ref(false)
  const rows = ref<DiagnosisRow[]>([])
  const aiReportId = ref('')
  const aiRunning = ref(false)
  /** 正在转缺陷的 step（按钮 loading 用） */
  const convertingStep = ref('')
  let seq = 0

  async function load() {
    const id = scopeId.value
    const cur = ++seq
    rows.value = []
    if (!id)
      return
    loading.value = true
    try {
      const list = await fetchDiagnosisList(scope, id)
      if (cur !== seq)
        return
      if (list)
        rows.value = list
    }
    finally {
      if (cur === seq)
        loading.value = false
    }
  }

  watch(scopeId, () => {
    aiReportId.value = ''
    void load()
  }, { immediate: true })

  const steps = computed<DiagnosisStepView[]>(() => buildStepViews(rows.value))
  const hasDiagnosis = computed(() => rows.value.length > 0)

  async function toIssue(step: DiagnosisStepView) {
    if (!step.diagnosisId)
      return
    convertingStep.value = step.step
    try {
      const res = await convertToIssue(step.diagnosisId)
      if (res === null)
        return
      Message.success(res.created
        ? `已创建缺陷：${res.issue_id}`
        : `已关联已有缺陷：${res.issue_id}（同指纹去重，未新建）`)
      await load()
    }
    finally {
      convertingStep.value = ''
    }
  }

  async function runAi() {
    if (!hasDiagnosis.value) {
      Message.warning('暂无可解读的诊断结果')
      return
    }
    aiRunning.value = true
    try {
      const res = await interpretDiagnosis(scope, scopeId.value)
      if (res === null)
        return
      aiReportId.value = res.report_id
      Message.success(`已生成分析报告（${res.report_id}）`)
    }
    finally {
      aiRunning.value = false
    }
  }

  return {
    loading,
    steps,
    hasDiagnosis,
    aiReportId,
    aiRunning,
    convertingStep,
    toIssue,
    runAi,
    reload: load,
  }
}
