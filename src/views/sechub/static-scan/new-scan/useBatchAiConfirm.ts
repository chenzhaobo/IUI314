import type { AiConfirmBody } from './types'
/**
 * 批量 AI 确认：对勾选的多个运行逐个发起 AI 确认（ApiSecPrescan.aiConfirm）。
 *
 * 为什么逐个串行提交：接口一次只接受一个 run_id；串行才能给出每个运行的成功/失败
 * 明细（弹窗里逐行展示），也避免同时给队列灌入大量任务。
 *
 * 与行级入口（useAiConfirm）的分工：批量入口只负责"提交"，不跟踪 Agent 审计进度
 * —— 提交完成后运行页会刷新列表，队列/审计进度由页面已有的 15 秒轮询继续跟踪。
 */
import type { CrossRunAggRow } from '@/types/static-scan'
import { Message } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { triggerAiConfirm } from './service'
import { DEFAULT_BATCH_MODEL, useAiConfirmOptions } from './useAiConfirmOptions'

export interface BatchConfirmTarget {
  run_id: string
  /** 界面展示用的运行标识（应用名 @commit 短 sha） */
  label: string
}

export interface BatchConfirmResult extends BatchConfirmTarget {
  ok: boolean
  message: string
}

export interface UseBatchAiConfirmOptions {
  /** 全部提交完成后回调：运行页据此刷新列表并发起轮询 */
  onSubmitted?: () => void | Promise<void>
}

/** 运行标识：应用名 @commit 短 sha（跨应用批量提交时便于区分） */
function runLabel(row: CrossRunAggRow): string {
  const sha = row.commit_sha ? ` @${row.commit_sha.slice(0, 8)}` : ''
  return `${row.repository_name || row.repository_id}${sha}`
}

export function useBatchAiConfirm(options: UseBatchAiConfirmOptions = {}) {
  const visible = ref(false)
  const submitting = ref(false)
  const finished = ref(false)
  const targets = ref<BatchConfirmTarget[]>([])
  const results = ref<BatchConfirmResult[]>([])
  const form = useAiConfirmOptions()

  const doneCount = computed(() => results.value.length)
  const okCount = computed(() => results.value.filter(item => item.ok).length)
  const failCount = computed(() => results.value.length - okCount.value)

  /** 打开弹窗：rows 是运行页勾选且通过门槛的运行（顺序即提交顺序） */
  function open(rows: CrossRunAggRow[]) {
    targets.value = rows.map(row => ({ run_id: row.run_id, label: runLabel(row) }))
    results.value = []
    finished.value = false
    // 每次打开都复位成约定默认值（模式 batch、模型 DeepSeek-Flash），
    // 避免上次的选择悄悄沿用；其余留空走后端默认
    form.mode.value = 'batch'
    form.model.value = DEFAULT_BATCH_MODEL
    form.agentCode.value = ''
    form.skillCode.value = ''
    form.ensureLookups()
    visible.value = true
  }

  async function submit() {
    if (targets.value.length === 0)
      return
    submitting.value = true
    try {
      for (const target of targets.value) {
        const body: AiConfirmBody = form.buildBody(target.run_id)
        const res = await triggerAiConfirm(body)
        // 失败时拦截器已弹错误提示，这里只记录明细，批量流程继续
        results.value.push({ ...target, ok: Boolean(res), message: res?.message ?? '提交失败（详见顶部错误提示）' })
      }
      finished.value = true
      if (failCount.value === 0)
        Message.success(`已对 ${okCount.value} 个运行发起 AI 确认`)
      else
        Message.warning(`批量确认完成：成功 ${okCount.value} 个，失败 ${failCount.value} 个（详见弹窗列表）`)
      await options.onSubmitted?.()
    }
    finally {
      submitting.value = false
    }
  }

  return {
    visible,
    submitting,
    finished,
    targets,
    results,
    doneCount,
    okCount,
    failCount,
    ...form,
    open,
    submit,
  }
}
