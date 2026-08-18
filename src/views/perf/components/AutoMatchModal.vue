<script lang="ts" setup>
import { ref } from 'vue'
import { Message } from '@arco-design/web-vue'
import { usePost } from '@/hooks'
import { ApiPerfMenu } from '@/api/apis'

const props = defineProps<{
  visible: boolean
  result: any
  productLine: string
}>()
const emit = defineEmits<{
  'update:visible': [boolean]
  modulesCreated: []
}>()

const createModulesLoading = ref(false)

async function handleCreateModulesFromUnmatched() {
  const apps = props.result?.unmatched_apps_detail
  if (!apps || apps.length === 0) { Message.warning('没有未匹配应用'); return }
  createModulesLoading.value = true
  try {
    const { execute, error, data } = usePost<any>(ApiPerfMenu.createModules, {
      product_line: props.productLine,
      apps,
    })
    await execute()
    if (error.value) { Message.error('插入失败'); return }
    const r = data.value
    Message.success(`已插入 ${r.inserted ?? 0} 条模块记录，跳过 ${r.skipped ?? 0} 条`)
    emit('modulesCreated')
    emit('update:visible', false)
  } finally {
    createModulesLoading.value = false
  }
}

function handleDownloadUnmatchedApps() {
  const apps = props.result?.unmatched_apps as string[] | undefined
  if (!apps || apps.length === 0) { Message.warning('没有未匹配应用可下载'); return }
  const ts = new Date()
  const dateStr = `${ts.getFullYear()}${String(ts.getMonth() + 1).padStart(2, '0')}${String(ts.getDate()).padStart(2, '0')}${String(ts.getHours()).padStart(2, '0')}${String(ts.getMinutes()).padStart(2, '0')}`
  const header = `序号\t未匹配应用`
  const lines = apps.map((name, i) => `${i + 1}\t${name}`)
  const content = '\uFEFF' + [header, ...lines].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `未匹配应用清单_${dateStr}.csv`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
</script>

<template>
  <a-modal :visible="visible" @update:visible="(v: boolean) => emit('update:visible', v)" title="自动匹配项目组结果" :footer="false" :width="560">
    <a-descriptions :column="1" layout="inline" bordered size="small" style="margin-bottom: 12px">
      <a-descriptions-item label="回填模块项目组">{{ result?.modules_backfilled ?? 0 }} 条</a-descriptions-item>
      <a-descriptions-item label="匹配应用数">{{ result?.apps_matched ?? 0 }} / {{ (result?.apps_matched ?? 0) + (result?.unmatched_apps?.length ?? 0) }}</a-descriptions-item>
      <a-descriptions-item label="更新应用数">{{ result?.apps_updated ?? 0 }} 条</a-descriptions-item>
      <a-descriptions-item label="匹配菜单数">{{ result?.menus_matched ?? 0 }}</a-descriptions-item>
      <a-descriptions-item label="更新菜单数">{{ result?.menus_updated ?? 0 }} 条</a-descriptions-item>
    </a-descriptions>
    <div v-if="result?.unmatched_apps?.length" style="margin-top: 8px">
      <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px">
        <span style="font-weight: 600">未匹配应用（{{ result.unmatched_apps.length }}个）：</span>
        <a-space>
          <a-button type="text" size="small" :loading="createModulesLoading" @click="handleCreateModulesFromUnmatched">
            <template #icon><icon-plus /></template>
            插入模块管理
          </a-button>
          <a-button type="text" size="small" @click="handleDownloadUnmatchedApps">
            <template #icon><icon-download /></template>
            下载清单
          </a-button>
        </a-space>
      </div>
      <a-list :data="result.unmatched_apps.slice(0, 20)" size="small" :bordered="true" max-height="200">
        <template #item="{ item }">{{ item }}</template>
      </a-list>
      <div v-if="result.unmatched_apps.length > 20" style="color: var(--color-text-3); font-size: 12px; margin-top: 4px">
        ...还有 {{ result.unmatched_apps.length - 20 }} 个未显示
      </div>
    </div>
  </a-modal>
</template>
