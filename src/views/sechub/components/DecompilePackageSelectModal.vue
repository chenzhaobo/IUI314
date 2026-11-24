<script setup lang="ts">
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { ApiSecDecompile } from '@/api/sechubApis'
import { isRequestFailed, useGet, usePost } from '@/hooks'

interface SourceRef {
  id: string
  name: string
}

interface PackageRow {
  name: string
}

const emit = defineEmits<{
  (e: 'updated'): void
}>()

const visible = ref(false)
const source = ref<SourceRef>()
const packageOptions = ref<string[]>([])
const selectedPackageNames = ref<string[]>([])
const keyword = ref('')
const currentPage = ref(1)
const force = ref(false)
const optionsLoading = ref(false)
const submitting = ref(false)

const optionsParams = ref({ id: '' })
const { data: optionsData, execute: loadOptions } = useGet<string[]>(ApiSecDecompile.sourcePackageOptions, optionsParams, { immediate: false })
const syncPayload = ref({ source_id: '', force: false, only: '' })
const { data: syncData, execute: doSync } = usePost<string>(ApiSecDecompile.sync, syncPayload, { immediate: false })

const filteredPackageRows = computed<PackageRow[]>(() => {
  const normalizedKeyword = keyword.value.trim().toLowerCase()
  return packageOptions.value
    .filter(name => !normalizedKeyword || name.toLowerCase().includes(normalizedKeyword))
    .map(name => ({ name }))
})

const pagination = computed(() => ({
  current: currentPage.value,
  pageSize: 20,
  total: filteredPackageRows.value.length,
  showTotal: true,
}))

watch(keyword, () => {
  currentPage.value = 1
})

async function open(value: SourceRef) {
  source.value = value
  packageOptions.value = []
  selectedPackageNames.value = []
  keyword.value = ''
  currentPage.value = 1
  force.value = false
  optionsParams.value = { id: value.id }
  visible.value = true
  optionsLoading.value = true
  try {
    await loadOptions()
    if (isRequestFailed(optionsData.value)) {
      visible.value = false
      return
    }
    packageOptions.value = optionsData.value || []
  }
  finally {
    optionsLoading.value = false
  }
}

function changePage(page: number) {
  currentPage.value = page
}

function selectFiltered() {
  const selected = new Set(selectedPackageNames.value)
  filteredPackageRows.value.forEach(row => selected.add(row.name))
  selectedPackageNames.value = [...selected]
}

async function startSync() {
  if (!source.value || !selectedPackageNames.value.length) {
    Message.warning('请至少选择一个包')
    return
  }
  submitting.value = true
  syncPayload.value = {
    source_id: source.value.id,
    force: force.value,
    only: selectedPackageNames.value.join(','),
  }
  try {
    await doSync()
    if (isRequestFailed(syncData.value))
      return
    Message.success(`已触发 ${selectedPackageNames.value.length} 个包的更新`)
    visible.value = false
    emit('updated')
  }
  finally {
    submitting.value = false
  }
}

defineExpose({ open })
</script>

<template>
  <a-modal
    v-model:visible="visible"
    title="选择要更新的包"
    :width="720"
    :ok-loading="submitting"
    ok-text="开始更新"
    @ok="startSync"
    @cancel="visible = false"
  >
    <a-space direction="vertical" fill size="medium">
      <a-alert>
        从「{{ source?.name }}」的远端索引选择 ZIP 包；源已有的排除规则仍然生效，未选中的包不会下载或反编译。
      </a-alert>
      <a-input v-model="keyword" placeholder="按包名筛选，如 fi-" allow-clear />
      <a-space wrap>
        <a-button size="small" :disabled="!filteredPackageRows.length" @click="selectFiltered">
          选择全部筛选结果
        </a-button>
        <a-button size="small" :disabled="!selectedPackageNames.length" @click="selectedPackageNames = []">
          清空选择
        </a-button>
        <span>共 {{ packageOptions.length }} 个，筛选出 {{ filteredPackageRows.length }} 个，已选 {{ selectedPackageNames.length }} 个</span>
      </a-space>
      <a-table
        v-model:selected-keys="selectedPackageNames"
        :data="filteredPackageRows"
        :loading="optionsLoading"
        :pagination="pagination"
        :row-selection="{ type: 'checkbox', showCheckedAll: true }"
        :scroll="{ y: 360 }"
        row-key="name"
        @page-change="changePage"
      >
        <template #columns>
          <a-table-column title="包名" data-index="name" />
        </template>
      </a-table>
      <a-checkbox v-model="force">
        忽略断点状态，强制重新下载并反编译选中包
      </a-checkbox>
    </a-space>
  </a-modal>
</template>
