import type { ReleaseScopeField, ReleaseScopeSelection } from './releaseScopeRules'
/**
 * 发版范围筛选状态：产品线 / 迭代 / 产品领域 / 业务领域 / 项目组 / 应用 / 处理人 + 联动。
 *
 * 范围是各发版页面的公共前置条件：`toQuery()` 产出接口 query，`version` 在用户
 * 改动范围后自增，页面据此回到第 1 页重新取数。选项全部来自
 * `GET /sechub/release/scope-options`，组件不自行请求。
 */
import type { ReleaseScopeOptions, ReleaseScopeQuery, ReleaseTreeLabels, ReleaseTreeScope } from '@/types/sechub-release'
import { computed, ref } from 'vue'

import { useRoute } from 'vue-router'
import { fetchScopeOptions } from '../services/releaseScopeService'
import { emptyScopeSelection, mergeSelection, selectionFromRoute } from './releaseScopeRoute'
import {
  buildScopeQuery,
  businessAreaOptionsOf,
  cascadeDomainOf,
  defaultIterationIdOf,
  domainOptionsOf,
  iterationOptionsOf,
  locateProjectGroup,
  normalizeScopeSelection,
  productLineOptionsOf,
  projectGroupOptionsOf,
  resetOnFieldChange,
  scopeSummaryText,
  structuralScopeOf,
} from './releaseScopeRules'

function labelFor(entry: [string, string] | undefined, code: string): string {
  return entry && code && entry[0] === code ? entry[1] : ''
}

function labelEntry(code: string | undefined, label: string | undefined): [string, string] | undefined {
  return code && label ? [code, label] : undefined
}

export function useReleaseScope() {
  const route = useRoute()
  const loading = ref(false)
  const options = ref<ReleaseScopeOptions | null>(null)
  const productLine = ref('')
  const iterationId = ref('')
  const productDomain = ref('')
  const businessArea = ref('')
  const projectGroup = ref('')
  const appNumber = ref('')
  const handler = ref('')
  const mine = ref(false)
  /** 用户改动范围后自增 */
  const version = ref(0)
  /** 后端实际生效的产品领域（coverage 回传），未选领域时用于回显默认值 */
  const effectiveDomains = ref<string[]>([])

  const selection = computed<ReleaseScopeSelection>(() => ({
    productLine: productLine.value,
    iterationId: iterationId.value,
    productDomain: productDomain.value,
    businessArea: businessArea.value,
    projectGroup: projectGroup.value,
    appNumber: appNumber.value,
    handler: handler.value,
    mine: mine.value,
  }))
  const envError = computed(() => options.value?.env_error ?? '')
  const productLineOptions = computed(() => productLineOptionsOf(options.value))
  const iterationOptions = computed(() => iterationOptionsOf(options.value))
  const domainOptions = computed(() => domainOptionsOf(options.value))
  const cascadeDomain = computed(() => cascadeDomainOf(options.value, productDomain.value, effectiveDomains.value))
  const businessAreaOptions = computed(() => businessAreaOptionsOf(options.value, cascadeDomain.value))
  const projectGroupOptions = computed(() => projectGroupOptionsOf(options.value, cascadeDomain.value, businessArea.value))
  /** 左树点选时记下的显示名（编码 → 名称）；当前值换掉后自然失效 */
  const treeLabels = ref<{ projectGroup?: [string, string], appNumber?: [string, string] }>({})
  const projectGroupLabel = computed(() => labelFor(treeLabels.value.projectGroup, projectGroup.value))
  const appLabel = computed(() => labelFor(treeLabels.value.appNumber, appNumber.value))
  const summaryText = computed(() => scopeSummaryText(selection.value, options.value, effectiveDomains.value, projectGroupLabel.value))
  /** 左树高亮：当前选择对应的范围（规则由页面自己管） */
  const structuralScope = computed<ReleaseTreeScope>(() => structuralScopeOf(selection.value))

  function setField(field: ReleaseScopeField, value: string) {
    if (field === 'iterationId')
      iterationId.value = value
    else if (field === 'productDomain')
      productDomain.value = value
    else if (field === 'businessArea')
      businessArea.value = value
    else if (field === 'projectGroup')
      projectGroup.value = value
    else if (field === 'appNumber')
      appNumber.value = value
    else if (field === 'handler')
      handler.value = value
  }

  function applyReset(reset: Partial<ReleaseScopeSelection>) {
    if (reset.iterationId !== undefined)
      iterationId.value = reset.iterationId
    if (reset.productDomain !== undefined)
      productDomain.value = reset.productDomain
    if (reset.businessArea !== undefined)
      businessArea.value = reset.businessArea
    if (reset.projectGroup !== undefined)
      projectGroup.value = reset.projectGroup
    if (reset.appNumber !== undefined)
      appNumber.value = reset.appNumber
    if (reset.handler !== undefined)
      handler.value = reset.handler
    if (reset.mine !== undefined)
      mine.value = reset.mine
  }

  function assignSelection(next: ReleaseScopeSelection) {
    productLine.value = next.productLine
    applyReset(next)
  }

  async function loadOptions(requested: string): Promise<ReleaseScopeOptions | null> {
    loading.value = true
    try {
      const result = await fetchScopeOptions(requested || undefined)
      if (!result)
        return null
      options.value = result
      productLine.value = result.product_line
      return result
    }
    finally {
      loading.value = false
    }
  }

  /** 路由预填的迭代 / 领域 / 业务领域 / 项目组必须仍在选项树里，否则回退默认 */
  function normalizeSelection(result: ReleaseScopeOptions) {
    applyReset(normalizeScopeSelection(selection.value, result))
  }

  function applyRouteSelection() {
    assignSelection(mergeSelection(emptyScopeSelection(), selectionFromRoute(route.query)))
  }

  function applyInitial(initial?: Partial<ReleaseScopeSelection>) {
    if (!initial)
      return
    assignSelection(mergeSelection(selection.value, initial))
  }

  /** 读路由 query 预填 → 拉选项 → 校正缺省值（产品线 is_default / 迭代 current_id） */
  async function init(initial?: Partial<ReleaseScopeSelection>) {
    applyRouteSelection()
    applyInitial(initial)
    const result = await loadOptions(productLine.value)
    if (result)
      normalizeSelection(result)
  }

  /** 切换下拉：联动清空下级；产品线需要重新拉选项 */
  async function handleChange(field: ReleaseScopeField, value: string) {
    if (field === 'productLine') {
      if (!value || value === productLine.value)
        return
      const previous = selection.value
      productLine.value = value
      applyReset({
        iterationId: '',
        productDomain: '',
        businessArea: '',
        projectGroup: '',
        appNumber: '',
        handler: '',
      })
      const result = await loadOptions(value)
      if (!result) {
        productLine.value = previous.productLine
        applyReset(previous)
        return
      }
      iterationId.value = defaultIterationIdOf(result)
      version.value += 1
      return
    }
    // 在默认领域下选业务领域：把默认领域落成显式选择，保证 query 与级联校验一致
    if (field === 'businessArea' && value && !productDomain.value)
      productDomain.value = cascadeDomain.value
    setField(field, value)
    applyReset(resetOnFieldChange(field, options.value))
    version.value += 1
  }

  /** 项目组统计表点选：反查并补齐上级领域；再次点击同一组取消 */
  function selectProjectGroup(code: string) {
    if (projectGroup.value === code) {
      projectGroup.value = ''
      version.value += 1
      return
    }
    const located = locateProjectGroup(options.value, code)
    if (!located)
      return
    productDomain.value = located.productDomain
    businessArea.value = located.businessArea
    projectGroup.value = code
    version.value += 1
  }

  /** 「只看我的」开关：独立于字符串字段 */
  function toggleMine(value: boolean) {
    mine.value = value
    version.value += 1
  }

  /** 左树点选：节点 scope 写回范围；scope 未包含的字段清空；不处理 rule_code */
  function applyTreeScope(scope: ReleaseTreeScope) {
    productDomain.value = scope.product_domain ?? ''
    businessArea.value = scope.business_area ?? ''
    projectGroup.value = scope.project_group ?? ''
    appNumber.value = scope.app_number ?? ''
    handler.value = scope.handler ?? ''
    const labels: ReleaseTreeLabels = scope.labels ?? {}
    treeLabels.value = {
      projectGroup: labelEntry(scope.project_group, labels.project_group),
      appNumber: labelEntry(scope.app_number, labels.app_number),
    }
    version.value += 1
  }

  function syncEffectiveDomains(domains: string[]) {
    effectiveDomains.value = [...new Set(domains.filter(Boolean))]
  }

  function toQuery(): ReleaseScopeQuery {
    return buildScopeQuery(selection.value)
  }

  return {
    loading,
    options,
    productLine,
    iterationId,
    productDomain,
    businessArea,
    projectGroup,
    appNumber,
    handler,
    mine,
    version,
    effectiveDomains,
    selection,
    structuralScope,
    projectGroupLabel,
    appLabel,
    envError,
    productLineOptions,
    iterationOptions,
    domainOptions,
    businessAreaOptions,
    projectGroupOptions,
    summaryText,
    init,
    handleChange,
    toggleMine,
    applyTreeScope,
    selectProjectGroup,
    syncEffectiveDomains,
    toQuery,
  }
}
