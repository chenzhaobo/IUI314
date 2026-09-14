/**
 * 「再次分析」的状态与请求逻辑。
 *
 * 为什么抽出来：问题台账详情与问题列表详情都要这块功能，而两个页面分别是
 * 1200 行和 1100 行 —— 把 90 行逻辑再复制一份，等于让两份状态机各自演进。
 * 实际教训就在这个功能里：`usePost` 不支持 `onSuccess`（只有 `useGet` 经
 * `withOnSuccess` 包过），当初写错一次，表现是"点了没反应"；这种坑只应该修一处。
 *
 * 分层遵循 View → Composable → Api：组件只管渲染与交互，取数与轮询在这里。
 */
import type { ReanalysisDecisionMeta, ReanalysisRecord, ReanalysisTarget } from '@/types/perf-reanalysis'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { ApiPerfPatternLedger } from '@/api/perfApis'
import { isRequestFailed, useGet, usePost } from '@/hooks'

/** 轮询间隔。复核要读 xls、跑脚本、查源码，实测 2 分钟量级，15 秒足够跟上。 */
const POLL_INTERVAL_MS = 15_000

/** 质疑文本长度上限，与后端及输入框的 max-length 保持一致。 */
export const CHALLENGE_MAX_LENGTH = 2000

/** 后端两个 reanalysis 接口的参数形状（同一套键解析，给哪个都行）。 */
interface ReanalysisQuery {
  pattern_id?: string
  issue?: string
}

/** 结论 → 颜色与文案。 */
export function decisionMeta(decision?: string): ReanalysisDecisionMeta {
  switch (decision) {
    case 'update':
      return { color: 'orange', text: '已修正原条目' }
    case 'create':
      return { color: 'arcoblue', text: '已拆出新条目' }
    // reject 是正当结论，不是失败 —— 原结论对的时候说它对，比编一个改动有价值
    case 'reject':
      return { color: 'gray', text: '质疑不成立，未改动' }
    default:
      return { color: 'gray', text: decision || '--' }
  }
}

/** 是否已经定位到一条台账（两种键给其一即可）。 */
function hasTarget(target: ReanalysisTarget): boolean {
  return Boolean(target.patternId?.trim()) || Boolean(target.issue?.trim())
}

/** 把定位键转成后端参数。 */
function toQuery(target: ReanalysisTarget): ReanalysisQuery {
  return {
    pattern_id: target.patternId?.trim() || undefined,
    issue: target.issue?.trim() || undefined,
  }
}

export function usePatternReanalysis() {
  const challengeText = ref('')
  const submitting = ref(false)
  const records = ref<ReanalysisRecord[]>([])
  const loading = ref(false)
  /** 当前定位的台账/问题；提交与轮询都读它，避免抽屉切记录后打到上一条 */
  const target = ref<ReanalysisTarget>({})
  let timer: ReturnType<typeof setTimeout> | null = null

  const historyPayload = ref<ReanalysisQuery>({})
  const submitPayload = ref<ReanalysisQuery & { challenge: string }>({ challenge: '' })

  function stopPoll() {
    if (timer) {
      clearTimeout(timer)
      timer = null
    }
  }

  const { execute: fetchHistory } = useGet<ReanalysisRecord[]>(ApiPerfPatternLedger.reanalysisHistory, historyPayload, {
    immediate: false,
    onSuccess(data) {
      records.value = Array.isArray(data) ? data : []
      // 还在跑就继续轮询：不轮询的话人要自己刷新页面才知道跑完了。
      // 定位键在排程时取快照 —— 切到别的记录时 load() 会先 stopPoll，
      // 所以不存在拿旧快照打错记录的情况。
      stopPoll()
      if (records.value.some(item => item.status === 'running'))
        timer = setTimeout(load, POLL_INTERVAL_MS, { ...target.value })
    },
  })

  /**
   * 载入历史记录；换记录时先清空，避免闪出上一条的内容。
   *
   * 用函数声明而不是箭头常量：`useGet` 的 onSuccess 里要排程下一轮轮询，
   * 而它定义在本函数之前，靠函数提升才能相互引用。
   */
  function load(next: ReanalysisTarget) {
    stopPoll()
    target.value = { ...next }
    records.value = []
    if (!hasTarget(target.value))
      return
    historyPayload.value = toQuery(target.value)
    loading.value = true
    fetchHistory().finally(() => {
      loading.value = false
    })
  }

  /** 关闭抽屉 / 卸载组件时调用：停轮询并清状态。 */
  function reset() {
    stopPoll()
    records.value = []
    challengeText.value = ''
    target.value = {}
  }

  // 注意：`usePost` **不支持** onSuccess —— 只有 `useGet` 经 withOnSuccess 包过
  // （见 hooks/util/useRequest.ts）。所以在 execute() 之后按结果显式处理。
  const { data: submitRes, execute: doSubmit } = usePost<unknown>(ApiPerfPatternLedger.reanalysis, submitPayload, {
    immediate: false,
  })

  async function submit(): Promise<boolean> {
    const text = challengeText.value.trim()
    if (!text) {
      Message.warning('请先写明你的方向或质疑 —— 没有输入就没有复核的依据')
      return false
    }
    if (!hasTarget(target.value)) {
      Message.warning('没有定位到台账，无法提交复核')
      return false
    }
    submitPayload.value = { ...toQuery(target.value), challenge: text }
    submitting.value = true
    try {
      await doSubmit()
      // 失败时 data.value 是错误哨兵而非 null，所以用 isRequestFailed 统一判定；
      // 拦截器已经弹过错误提示，这里失败就不再重复提示。
      if (isRequestFailed(submitRes.value))
        return false
      Message.success('已提交，AI 正在复核（约几分钟），结果会出现在下面的记录里')
      challengeText.value = ''
      load(target.value)
      return true
    }
    finally {
      submitting.value = false
    }
  }

  return { challengeText, submitting, records, loading, load, reset, submit, stopPoll }
}
