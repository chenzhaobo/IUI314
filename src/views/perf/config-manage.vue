<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePut } from '@/hooks'
import { ApiPerfConfig } from '@/api/apis'

defineOptions({ name: 'PerfConfigManage' })

// ── 加载配置列表 ──────────────────────────────────
const { isFetching: isLoading, data: rawListData, execute: getList } = useGet<any>(ApiPerfConfig.list, {}, { immediate: true })
const configList = computed(() => rawListData.value || [])

// 按 group_name 分组
const groupedConfigs = computed(() => {
  const groups: Record<string, any[]> = {}
  for (const c of configList.value) {
    const g = c.group_name || '其他'
    if (!groups[g]) groups[g] = []
    groups[g].push(c)
  }
  return groups
})

const groupLabels: Record<string, string> = {
  jmeter: 'JMeter 配置',
  report: '报告路径配置',
}

// ── 编辑 ──────────────────────────────────
const saving = ref(false)

async function handleSave() {
  saving.value = true
  try {
    const { execute, error } = usePut(ApiPerfConfig.save, { configs: configList.value })
    await execute()
    if (error.value) {
      Message.error('保存失败')
      return
    }
    Message.success('保存成功')
    getList()
  } finally {
    saving.value = false
  }
}

// 获取 group 的 label
function getGroupLabel(key: string) {
  return groupLabels[key] || key
}
</script>

<template>
  <div class="page-container">
    <a-card title="平台配置管理" :bordered="false">
      <template #extra>
        <a-space>
          <a-button @click="getList">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
          <a-button type="primary" :loading="saving" @click="handleSave">
            <template #icon><icon-save /></template>
            保存配置
          </a-button>
        </a-space>
      </template>

      <a-spin :loading="isLoading" tip="加载中..." style="width: 100%">
        <div v-for="(configs, groupKey) in groupedConfigs" :key="groupKey" class="config-group">
          <a-divider orientation="left">{{ getGroupLabel(groupKey) }}</a-divider>
          <a-form :model="{}" layout="vertical">
            <a-row :gutter="24">
              <a-col v-for="c in configs" :key="c.id" :span="12">
                <a-form-item :label="c.label || c.config_key">
                  <a-input
                    v-model="c.config_value"
                    :placeholder="`请输入${c.label || c.config_key}`"
                    allow-clear
                  />
                  <template #extra>
                    <span class="config-remark">{{ c.remark || '' }}</span>
                    <span class="config-key">key: {{ c.config_key }}</span>
                  </template>
                </a-form-item>
              </a-col>
            </a-row>
          </a-form>
        </div>
      </a-spin>
    </a-card>
  </div>
</template>

<style scoped>
.page-container {
  padding: 16px;
}
.config-group {
  margin-bottom: 16px;
}
.config-remark {
  color: var(--color-text-3);
  font-size: 12px;
}
.config-key {
  color: var(--color-text-4);
  font-size: 12px;
  margin-left: 8px;
  font-family: monospace;
}
</style>
