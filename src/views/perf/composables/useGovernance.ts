/**
 * 达标治理看板的取数：看板、项目组方案初稿、周报预览 / 立即推送、方案 md 下载。
 *
 * 分层遵循 View → Composable → Api：页面只管筛选与渲染。
 */
import type { GovernanceBoard, GovernancePlan, GovernancePushPreview, GovernanceQuery } from '@/types/perf-governance'
import { Message } from '@arco-design/web-vue'
import { ref } from 'vue'
import { ApiPerfCompliance, ApiPerfGovernance } from '@/api/perfApis'
import { isRequestFailed, useDownload, useGet, usePost } from '@/hooks'

interface PeriodOption {
  period: string
  label: string
}

interface DomainOption {
  code: string
  name: string
}

/** 把查询对象拼成 query string（下载用）。 */
export function governanceQueryString(q: GovernanceQuery): string {
  const params = new URLSearchParams()
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v) !== '')
      params.set(k, String(v))
  })
  return params.toString()
}

/** 达标率显示：保留两位，未达标标红由页面按 pass 判断。 */
export function fmtRate(v?: number | null): string {
  return typeof v === 'number' ? `${v.toFixed(2)}%` : '--'
}

export function useGovernanceBoard() {
  const query = ref<GovernanceQuery>({ product_line: '星瀚', product_domain: '集团财务', period_type: 'monthly', period: '', only_failing: true })
  const board = ref<GovernanceBoard | null>(null)
  const loading = ref(false)
  const periods = ref<PeriodOption[]>([])

  const { execute: fetchBoard } = useGet<GovernanceBoard>(ApiPerfGovernance.board, query, {
    immediate: false,
    onSuccess(data) {
      board.value = data && typeof data === 'object' ? data : null
    },
  })
  function load() {
    loading.value = true
    fetchBoard().finally(() => {
      loading.value = false
    })
  }

  const periodPayload = ref({ period_type: 'monthly', product_line: query.value.product_line || '星瀚' })
  const { execute: fetchPeriods } = useGet<PeriodOption[]>(ApiPerfCompliance.periodOptions, periodPayload, {
    immediate: false,
    onSuccess(data) {
      periods.value = Array.isArray(data) ? data : []
      if (periods.value.length && !periods.value.some(p => p.period === query.value.period))
        query.value.period = periods.value[0].period
      load()
    },
  })
  /** 切换周期类型：先取可选周期，再按最新一期加载看板。 */
  function changePeriodType(type: string) {
    query.value.period_type = type
    query.value.period = ''
    periodPayload.value = { period_type: type, product_line: query.value.product_line || '星瀚' }
    void fetchPeriods()
  }

  const domains = ref<DomainOption[]>([])
  const domainPayload = ref({ level: 'product_domain', product_line: query.value.product_line || '星瀚' })
  const { execute: fetchDomains } = useGet<DomainOption[]>(ApiPerfCompliance.dimensionOptions, domainPayload, {
    immediate: false,
    onSuccess(data) {
      domains.value = Array.isArray(data) ? data : []
    },
  })
  /** 切换产品线：周期与产品领域选项都要按新线重载，再回到最新周期。 */
  function changeProductLine(line: string) {
    const next = line || '星瀚'
    query.value.product_line = next
    query.value.period = ''
    domainPayload.value = { level: 'product_domain', product_line: next }
    void fetchDomains()
    periodPayload.value = { period_type: query.value.period_type || 'monthly', product_line: next }
    void fetchPeriods()
  }
  /** 首次进入：领域选项与周期并行取，周期取回后自动加载看板。 */
  function init() {
    void fetchDomains()
    changePeriodType(query.value.period_type || 'monthly')
  }

  return { query, board, loading, periods, domains, load, changePeriodType, changeProductLine, init }
}

export function useGovernancePlan() {
  const plan = ref<GovernancePlan | null>(null)
  const loading = ref(false)
  const planQuery = ref<GovernanceQuery>({})
  const { execute: fetchPlan } = useGet<GovernancePlan>(ApiPerfGovernance.plan, planQuery, {
    immediate: false,
    onSuccess(data) {
      plan.value = data && typeof data === 'object' ? data : null
    },
  })
  function load(q: GovernanceQuery) {
    plan.value = null
    planQuery.value = { ...q }
    loading.value = true
    fetchPlan().finally(() => {
      loading.value = false
    })
  }

  const { downloadWithTip } = useDownload()
  const downloading = ref(false)
  async function downloadMd() {
    const p = plan.value
    if (!p)
      return
    downloading.value = true
    try {
      await downloadWithTip(`${ApiPerfGovernance.planDownload}?${governanceQueryString(planQuery.value)}`, `${p.project_group_code}-性能治理方案-${p.period_end}.md`, '方案下载失败')
    }
    finally {
      downloading.value = false
    }
  }

  // ── 周报：预览不发送；立即推送只发给当前项目组 ──
  const preview = ref<GovernancePushPreview | null>(null)
  const previewQuery = ref<{ product_domain?: string, project_group_code?: string }>({})
  const { execute: fetchPreview } = useGet<GovernancePushPreview[]>(ApiPerfGovernance.pushPreview, previewQuery, {
    immediate: false,
    onSuccess(data) {
      preview.value = Array.isArray(data) && data.length ? data[0] : null
    },
  })
  function loadPreview() {
    preview.value = null
    previewQuery.value = { product_domain: planQuery.value.product_domain, project_group_code: planQuery.value.project_group_code }
    void fetchPreview()
  }

  const sendPayload = ref<{ product_domain?: string, project_group_code?: string }>({})
  const sending = ref(false)
  const { data: sendRes, execute: doSend } = usePost<GovernancePushPreview>(ApiPerfGovernance.pushSend, sendPayload, { immediate: false })
  async function sendNow(): Promise<boolean> {
    sendPayload.value = { product_domain: planQuery.value.product_domain, project_group_code: planQuery.value.project_group_code }
    sending.value = true
    try {
      await doSend()
      if (isRequestFailed(sendRes.value))
        return false
      Message.success('已推送到该项目组的云之家群')
      return true
    }
    finally {
      sending.value = false
    }
  }

  return { plan, loading, load, downloadMd, downloading, preview, loadPreview, sendNow, sending }
}
