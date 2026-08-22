<script lang="ts" setup>
import { ref, computed, watch } from 'vue'
import { Message } from '@arco-design/web-vue'
import { useGet, usePut } from '@/hooks'
import { ApiPerfConfig } from '@/api/apis'

defineOptions({ name: 'config-manage' })

// ── 路径校验 ──────────────────────────────────
const PATH_CONFIG_KEYS = ['jmeter_work_dir', 'jmeter_script_dir', 'jmeter_home_dir', 'report_base_dir']
const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[/\\]/

/** 检测是否为 Windows 盘符路径 */
function isWindowsDrivePath(value: string): boolean {
  return WINDOWS_DRIVE_RE.test(value)
}

/** 是否为路径类配置 */
function isPathConfig(c: any): boolean {
  return PATH_CONFIG_KEYS.includes(c.config_key)
}

/** 路径配置校验状态 */
function getPathValidateStatus(c: any): 'error' | undefined {
  if (!isPathConfig(c)) return undefined
  const val = c.config_value || ''
  if (val && isWindowsDrivePath(val)) return 'error'
  return undefined
}

/** 路径配置校验提示 */
function getPathValidateHelp(c: any): string {
  if (!isPathConfig(c)) return ''
  const val = c.config_value || ''
  if (val && isWindowsDrivePath(val)) {
    return 'Windows 盘符路径不适用于 Linux 容器环境，请改为相对路径（如 data/_jmeter）'
  }
  return ''
}

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
  deploy: '部署管理目录',
  platform: '平台核心目录',
  jmeter: 'JMeter 配置',
  report: '报告路径配置',
  scan: '静态扫描目录',
  static_scan: '静态扫描配置',
  dmp: 'DMP 数据爬取',
  agent: '压测 Agent',
}

// 判断是否为布尔类型配置（值为 true/false）
function isBoolConfig(c: any): boolean {
  return c.config_value === 'true' || c.config_value === 'false'
}

function handleBoolChange(c: any, val: boolean | string | number) {
  c.config_value = val ? 'true' : 'false'
}

// ── 编辑 ──────────────────────────────────
const saving = ref(false)

async function handleSave() {
  // 前端拦截：检查是否有 Windows 盘符路径
  const invalidPaths = configList.value.filter(
    (c: any) => isPathConfig(c) && c.config_value && isWindowsDrivePath(c.config_value)
  )
  if (invalidPaths.length > 0) {
    const keys = invalidPaths.map((c: any) => c.label || c.config_key).join('、')
    Message.error(`以下配置使用了 Windows 盘符路径，无法在 Linux 容器中使用：${keys}`)
    return
  }

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
          <a-button @click="() => getList()">
            <template #icon><icon-refresh /></template>
            刷新
          </a-button>
          <a-button type="primary" :loading="saving" @click="() => handleSave()">
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
                <a-form-item
                  :label="c.label || c.config_key"
                  :validate-status="getPathValidateStatus(c)"
                  :help="getPathValidateHelp(c)"
                >
                  <a-switch
                    v-if="isBoolConfig(c)"
                    :model-value="c.config_value === 'true'"
                    @change="(val: boolean | string | number) => handleBoolChange(c, val)"
                  />
                  <a-input
                    v-else
                    v-model="c.config_value"
                    :placeholder="`请输入${c.label || c.config_key}`"
                    allow-clear
                    :status="getPathValidateStatus(c)"
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
