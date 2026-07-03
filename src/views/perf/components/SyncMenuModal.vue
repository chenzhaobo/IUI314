<script lang="ts" setup>
import { ref, watch, computed } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePost } from '@/hooks'
import { ApiPerfEnv, ApiPerfMenu } from '@/api/apis'

const props = defineProps<{
  visible: boolean
  productLine: string
  sourceEnvId: string
  productLineOptions: { label: string; value: string }[]
}>()
const emit = defineEmits<{
  'update:visible': [boolean]
  success: [result: any]
}>()

const syncMenuLoading = ref(false)
const syncMenuProductLine = ref('')
const syncMenuEnvId = ref('')
const syncOptMenus = ref(true)
const syncOptEntities = ref(true)
const clearMenus = ref(false)
const clearEntities = ref(false)
const clearButtons = ref(false)
const syncPreviewLoading = ref(false)
const syncPreviewData = ref<any>(null)
const syncResultVisible = ref(false)
const syncResult = ref<any>(null)

const { data: syncMenuEnvData, execute: fetchSyncMenuEnvList } = useGet<any>(
  ApiPerfEnv.getList,
  computed(() => ({ page_num: 1, page_size: 100, product_line: syncMenuProductLine.value })),
  { immediate: false },
)
const syncMenuEnvOptions = computed(() => (syncMenuEnvData.value?.list || []).map((e: any) => ({ label: e.env_name, value: e.id })))

watch(
  () => props.visible,
  (val) => {
    if (val) {
      syncMenuProductLine.value = props.productLine
      syncMenuEnvId.value = props.sourceEnvId
      syncOptMenus.value = true
      syncOptEntities.value = true
      clearMenus.value = false
      clearEntities.value = false
      clearButtons.value = false
      syncPreviewData.value = null
      if (syncMenuProductLine.value) fetchSyncMenuEnvList()
    }
  },
  { immediate: true },
)

watch(syncMenuProductLine, () => {
  syncMenuEnvId.value = ''
  syncPreviewData.value = null
  if (syncMenuProductLine.value) fetchSyncMenuEnvList()
})

watch(syncMenuEnvId, async (val) => {
  syncPreviewData.value = null
  if (!val || !syncMenuProductLine.value) return
  syncPreviewLoading.value = true
  try {
    const { execute, error, data } = useGet<any>(ApiPerfMenu.syncPreview, { env_id: val, product_line: syncMenuProductLine.value }, { immediate: false })
    await execute()
    if (!error.value) syncPreviewData.value = data.value
  } finally {
    syncPreviewLoading.value = false
  }
})

async function confirmSyncMenu() {
  if (!syncMenuProductLine.value) { Message.warning('请选择产品线'); return }
  if (!syncMenuEnvId.value) { Message.warning('请选择来源环境'); return }
  if (!syncOptMenus.value && !syncOptEntities.value) { Message.warning('请至少选择一项同步内容'); return }
  syncMenuLoading.value = true
  try {
    const { execute, error, data } = usePost<any>(ApiPerfMenu.sync, {
      env_id: syncMenuEnvId.value,
      product_line: syncMenuProductLine.value,
      sync_menus: syncOptMenus.value,
      sync_entities: syncOptEntities.value,
      clear_menus: clearMenus.value,
      clear_entities: clearEntities.value,
      clear_buttons: clearButtons.value,
    })
    await execute()
    if (error.value) { Message.error('同步失败，请查看环境同步状态'); return }
    syncResult.value = data.value
    emit('visible', false)
    syncResultVisible.value = true
    emit('success', data.value)
  } finally {
    syncMenuLoading.value = false
  }
}
</script>

<template>
  <!-- 同步菜单弹窗 -->
  <a-modal :visible="visible" @update:visible="(v: boolean) => emit('update:visible', v)" title="同步菜单" @ok="confirmSyncMenu" :ok-loading="syncMenuLoading" :width="560">
    <a-form :model="{}" layout="vertical">
      <a-form-item label="产品线">
        <a-select v-model="syncMenuProductLine" :options="productLineOptions" placeholder="选择产品线" allow-search />
      </a-form-item>
      <a-form-item label="来源环境">
        <a-select v-model="syncMenuEnvId" :options="syncMenuEnvOptions" placeholder="选择来源环境" allow-search :disabled="!syncMenuProductLine" />
      </a-form-item>
    </a-form>

    <a-spin :loading="syncPreviewLoading" style="width: 100%">
      <div v-if="syncPreviewData" style="margin-bottom: 12px">
        <a-divider orientation="left" :style="{ fontSize: '13px', margin: '8px 0' }">数据对比</a-divider>
        <a-descriptions :column="3" layout="inline" bordered size="small">
          <a-descriptions-item label="">
            <span style="font-weight: 600; color: var(--color-text-1)">数据类型</span>
          </a-descriptions-item>
          <a-descriptions-item label="">
            <span style="font-weight: 600; color: var(--color-text-1)">源系统</span>
          </a-descriptions-item>
          <a-descriptions-item label="">
            <span style="font-weight: 600; color: var(--color-text-1)">平台已有</span>
          </a-descriptions-item>
          <a-descriptions-item label="云">云</a-descriptions-item>
          <a-descriptions-item>{{ syncPreviewData.source_clouds ?? 0 }}</a-descriptions-item>
          <a-descriptions-item>{{ syncPreviewData.existing_clouds ?? 0 }}</a-descriptions-item>
          <a-descriptions-item label="应用">应用</a-descriptions-item>
          <a-descriptions-item>{{ syncPreviewData.source_apps ?? 0 }}</a-descriptions-item>
          <a-descriptions-item>{{ syncPreviewData.existing_apps ?? 0 }}</a-descriptions-item>
          <a-descriptions-item label="菜单">菜单</a-descriptions-item>
          <a-descriptions-item>{{ syncPreviewData.source_menus ?? 0 }}</a-descriptions-item>
          <a-descriptions-item>{{ syncPreviewData.existing_menus ?? 0 }}</a-descriptions-item>
          <a-descriptions-item label="按钮">按钮</a-descriptions-item>
          <a-descriptions-item>{{ syncPreviewData.source_buttons ?? 0 }}</a-descriptions-item>
          <a-descriptions-item>{{ syncPreviewData.existing_buttons ?? 0 }}</a-descriptions-item>
        </a-descriptions>
        <a-alert v-if="syncPreviewData.last_synced_at" type="normal" :show-icon="true" style="margin-top: 8px">
          上次同步时间: {{ syncPreviewData.last_synced_at.replace('T', ' ').substring(0, 19) }}
        </a-alert>
      </div>
    </a-spin>

    <a-divider orientation="left" :style="{ fontSize: '13px', margin: '8px 0' }">同步内容</a-divider>
    <a-space direction="vertical">
      <a-checkbox v-model="syncOptMenus">
        <span style="font-weight: 600">菜单数据</span>
        <span style="color: var(--color-text-3); font-size: 12px; margin-left: 4px">（云/应用/菜单层级，自动跳过未变更记录）</span>
      </a-checkbox>
      <a-checkbox v-model="syncOptEntities">
        <span style="font-weight: 600">实体元数据 + 按钮</span>
        <span style="color: var(--color-text-3); font-size: 12px; margin-left: 4px">（表单元数据、工具栏按钮）</span>
      </a-checkbox>
    </a-space>

    <a-divider orientation="left" :style="{ fontSize: '13px', margin: '8px 0' }">清空选项</a-divider>
    <a-space direction="vertical">
      <a-checkbox v-model="clearMenus">
        <span style="font-weight: 600; color: var(--color-danger-light-4)">清空菜单数据</span>
        <span style="color: var(--color-text-3); font-size: 12px; margin-left: 4px">（硬删除云/应用/菜单）</span>
      </a-checkbox>
      <a-checkbox v-model="clearEntities">
        <span style="font-weight: 600; color: var(--color-danger-light-4)">清空实体元数据</span>
        <span style="color: var(--color-text-3); font-size: 12px; margin-left: 4px">（硬删除）</span>
      </a-checkbox>
      <a-checkbox v-model="clearButtons">
        <span style="font-weight: 600; color: var(--color-danger-light-4)">清空按钮</span>
        <span style="color: var(--color-text-3); font-size: 12px; margin-left: 4px">（硬删除）</span>
      </a-checkbox>
    </a-space>
  </a-modal>

  <!-- 同步菜单结果弹窗 -->
  <a-modal v-model:visible="syncResultVisible" title="同步菜单结果" :footer="false" :width="480">
    <a-result
      v-if="syncResult"
      status="success"
      title="同步完成"
      :sub-title="`产品线: ${syncMenuProductLine} | 环境: ${(syncMenuEnvOptions.find((e: any) => e.value === syncMenuEnvId)?.label) || ''}`"
    >
      <template #extra>
        <a-button type="primary" @click="syncResultVisible = false">关闭</a-button>
      </template>
      <a-descriptions :column="2" layout="inline" bordered size="small">
        <a-descriptions-item label="云">{{ syncResult.cloud_count ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="应用">{{ syncResult.app_count ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="菜单总数">{{ syncResult.menu_count ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="新增菜单">{{ syncResult.new_count ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="更新菜单">{{ syncResult.updated_count ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="跳过未变更">{{ syncResult.skipped_count ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="实体元数据">{{ syncResult.entity_count ?? 0 }}</a-descriptions-item>
        <a-descriptions-item label="按钮">{{ syncResult.button_count ?? 0 }}</a-descriptions-item>
      </a-descriptions>
    </a-result>
  </a-modal>
</template>
