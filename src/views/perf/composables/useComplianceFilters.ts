/**
 * 达标率看板 / 趋势共用的维度过滤（产品领域、业务领域、项目组、客户、产品版本、苍穹版本）。
 *
 * 客户清单来自 DMP，全量两万多家，下拉不能一次拉全 —— 客户与版本都走
 * `keyword + limit` 远程搜索；版本选项还会按已选客户级联收窄。
 */
import { computed, onUnmounted, ref, type Ref } from 'vue'
import { ApiPerfCompliance, type DimensionOption } from '@/api/perfApis'
import { useGet } from '@/hooks'

/** 客户下拉默认返回条数（后端上限 500） */
const CUSTOMER_OPTION_LIMIT = 200
/** 版本下拉默认返回条数（后端上限 500） */
const VERSION_OPTION_LIMIT = 200
const SEARCH_DEBOUNCE_MS = 300

interface UseComplianceFiltersOptions {
  /** 任一过滤值变化后触发页面重载（树 / 明细 / 趋势） */
  onChange?: () => void
}

export function useComplianceFilters(productLine: Ref<string>, options: UseComplianceFiltersOptions = {}) {
  const { onChange } = options

  const productDomain = ref('')
  const businessArea = ref('')
  const projectGroupCode = ref('')
  const customer = ref('')
  const productVersion = ref('')
  const cosmicVersion = ref('')

  const productDomainOptions = ref<DimensionOption[]>([])
  const businessAreaOptions = ref<DimensionOption[]>([])
  const projectGroupOptions = ref<DimensionOption[]>([])
  const customerOptions = ref<DimensionOption[]>([])
  const productVersionOptions = ref<DimensionOption[]>([])
  const cosmicVersionOptions = ref<DimensionOption[]>([])

  const toOptions = (data: DimensionOption[] | undefined): DimensionOption[] => (Array.isArray(data) ? data : [])

  // ── 项目组体系选项（产品领域 → 业务领域 → 项目组 级联） ─────────────
  const productDomainPayload = ref<Record<string, unknown>>({ level: 'product_domain', product_line: productLine.value })
  const { execute: fetchProductDomains } = useGet<DimensionOption[]>(ApiPerfCompliance.dimensionOptions, productDomainPayload, {
    immediate: true,
    onSuccess(d) { productDomainOptions.value = toOptions(d) },
  })

  const businessAreaPayload = ref<Record<string, unknown>>({ level: 'business_area', product_line: productLine.value })
  const { execute: fetchBusinessAreas } = useGet<DimensionOption[]>(ApiPerfCompliance.dimensionOptions, businessAreaPayload, {
    immediate: true,
    onSuccess(d) { businessAreaOptions.value = toOptions(d) },
  })

  const projectGroupPayload = ref<Record<string, unknown>>({ level: 'project_group', product_line: productLine.value })
  const { execute: fetchProjectGroups } = useGet<DimensionOption[]>(ApiPerfCompliance.dimensionOptions, projectGroupPayload, {
    immediate: true,
    onSuccess(d) { projectGroupOptions.value = toOptions(d) },
  })

  // ── 客户 / 版本选项（远程搜索 + 客户级联） ──────────────────────────
  const customerPayload = ref<Record<string, unknown>>({ level: 'customer', product_line: productLine.value, keyword: '', limit: CUSTOMER_OPTION_LIMIT })
  const { execute: fetchCustomers, isFetching: customerLoading } = useGet<DimensionOption[]>(ApiPerfCompliance.dimensionOptions, customerPayload, {
    immediate: true,
    onSuccess(d) { customerOptions.value = toOptions(d) },
  })

  const productVersionPayload = ref<Record<string, unknown>>({ level: 'product_version', product_line: productLine.value, keyword: '', limit: VERSION_OPTION_LIMIT })
  const { execute: fetchProductVersions, isFetching: productVersionLoading } = useGet<DimensionOption[]>(ApiPerfCompliance.dimensionOptions, productVersionPayload, {
    immediate: true,
    onSuccess(d) { productVersionOptions.value = toOptions(d) },
  })

  const cosmicVersionPayload = ref<Record<string, unknown>>({ level: 'cosmic_version', product_line: productLine.value, keyword: '', limit: VERSION_OPTION_LIMIT })
  const { execute: fetchCosmicVersions, isFetching: cosmicVersionLoading } = useGet<DimensionOption[]>(ApiPerfCompliance.dimensionOptions, cosmicVersionPayload, {
    immediate: true,
    onSuccess(d) { cosmicVersionOptions.value = toOptions(d) },
  })

  const versionLoading = computed(() => productVersionLoading.value || cosmicVersionLoading.value)

  // ── 级联加载 ──────────────────────────────────────────────
  function reloadBusinessAreaOptions() {
    businessAreaPayload.value = {
      level: 'business_area',
      product_line: productLine.value,
      ...(productDomain.value ? { product_domain: productDomain.value } : {}),
    }
    fetchBusinessAreas()
  }

  function reloadProjectGroupOptions() {
    projectGroupPayload.value = {
      level: 'project_group',
      product_line: productLine.value,
      ...(productDomain.value ? { product_domain: productDomain.value } : {}),
      ...(businessArea.value ? { business_area: businessArea.value } : {}),
    }
    fetchProjectGroups()
  }

  function versionPayload(level: 'product_version' | 'cosmic_version', keyword = ''): Record<string, unknown> {
    return {
      level,
      product_line: productLine.value,
      keyword: keyword.trim(),
      limit: VERSION_OPTION_LIMIT,
      ...(customer.value ? { customer: customer.value } : {}),
    }
  }

  function loadVersionOptions(level: 'product_version' | 'cosmic_version', keyword = '') {
    if (level === 'product_version') {
      productVersionPayload.value = versionPayload(level, keyword)
      fetchProductVersions()
    } else {
      cosmicVersionPayload.value = versionPayload(level, keyword)
      fetchCosmicVersions()
    }
  }

  function reloadCustomerOptions() {
    customerPayload.value = { level: 'customer', product_line: productLine.value, keyword: '', limit: CUSTOMER_OPTION_LIMIT }
    fetchCustomers()
  }

  /**
   * 产品线切换后重载全部选项。筛选值由调用方先 resetFilters（或自行清空），
   * 避免旧产品线的客户/版本留在下拉里误导选择。
   */
  function reloadDimensionOptions() {
    productDomainPayload.value = { level: 'product_domain', product_line: productLine.value }
    fetchProductDomains()
    businessAreaPayload.value = { level: 'business_area', product_line: productLine.value }
    fetchBusinessAreas()
    projectGroupPayload.value = { level: 'project_group', product_line: productLine.value }
    fetchProjectGroups()
    reloadCustomerOptions()
    loadVersionOptions('product_version')
    loadVersionOptions('cosmic_version')
  }

  // ── 过滤值变化 ────────────────────────────────────────────
  function onProductDomainFilterChange() {
    businessArea.value = ''
    projectGroupCode.value = ''
    reloadBusinessAreaOptions()
    reloadProjectGroupOptions()
    onChange?.()
  }

  function onBusinessAreaFilterChange() {
    projectGroupCode.value = ''
    reloadProjectGroupOptions()
    onChange?.()
  }

  function onCustomerFilterChange() {
    productVersion.value = ''
    cosmicVersion.value = ''
    loadVersionOptions('product_version')
    loadVersionOptions('cosmic_version')
    onChange?.()
  }

  function onVersionFilterChange() {
    onChange?.()
  }

  // ── 远程搜索（防抖，避免每敲一个字都打后端） ──────────────────────
  let customerTimer: ReturnType<typeof setTimeout> | null = null
  let productVersionTimer: ReturnType<typeof setTimeout> | null = null
  let cosmicVersionTimer: ReturnType<typeof setTimeout> | null = null

  function searchCustomerOptions(keyword: string) {
    if (customerTimer) clearTimeout(customerTimer)
    customerTimer = setTimeout(() => {
      customerPayload.value = { ...customerPayload.value, keyword: keyword.trim() }
      fetchCustomers()
    }, SEARCH_DEBOUNCE_MS)
  }

  function searchProductVersionOptions(keyword: string) {
    if (productVersionTimer) clearTimeout(productVersionTimer)
    productVersionTimer = setTimeout(() => loadVersionOptions('product_version', keyword), SEARCH_DEBOUNCE_MS)
  }

  function searchCosmicVersionOptions(keyword: string) {
    if (cosmicVersionTimer) clearTimeout(cosmicVersionTimer)
    cosmicVersionTimer = setTimeout(() => loadVersionOptions('cosmic_version', keyword), SEARCH_DEBOUNCE_MS)
  }

  onUnmounted(() => {
    if (customerTimer) clearTimeout(customerTimer)
    if (productVersionTimer) clearTimeout(productVersionTimer)
    if (cosmicVersionTimer) clearTimeout(cosmicVersionTimer)
  })

  // ── 参数输出 ──────────────────────────────────────────────
  /** 非空过滤值 → 请求参数（空值不带，避免后端把它当成过滤条件） */
  function dimFilterParams(): Record<string, string> {
    const params: Record<string, string> = {}
    if (productDomain.value) params.product_domain = productDomain.value
    if (businessArea.value) params.business_area = businessArea.value
    if (projectGroupCode.value) params.project_group_code = projectGroupCode.value
    if (customer.value) params.customer = customer.value
    if (productVersion.value) params.product_version = productVersion.value
    if (cosmicVersion.value) params.cosmic_version = cosmicVersion.value
    return params
  }

  /** 清空全部过滤值并重载选项（产品线切换 / 重置按钮） */
  function resetFilters() {
    productDomain.value = ''
    businessArea.value = ''
    projectGroupCode.value = ''
    customer.value = ''
    productVersion.value = ''
    cosmicVersion.value = ''
    reloadDimensionOptions()
  }

  return {
    productDomain,
    businessArea,
    projectGroupCode,
    customer,
    productVersion,
    cosmicVersion,
    productDomainOptions,
    businessAreaOptions,
    projectGroupOptions,
    customerOptions,
    productVersionOptions,
    cosmicVersionOptions,
    customerLoading,
    versionLoading,
    onProductDomainFilterChange,
    onBusinessAreaFilterChange,
    onCustomerFilterChange,
    onVersionFilterChange,
    searchCustomerOptions,
    searchProductVersionOptions,
    searchCosmicVersionOptions,
    dimFilterParams,
    resetFilters,
    reloadDimensionOptions,
  }
}
