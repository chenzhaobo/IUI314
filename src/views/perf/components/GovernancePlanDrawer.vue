<script setup lang="ts">
/**
 * 项目组治理方案初稿抽屉：方案正文由后端渲染成 markdown（与下载内容同一份），
 * 这里只负责展示、下载、周报预览与单组立即推送。
 *
 * 方案是原型：恢复量按「表单超 3s 数 × 分析占比 × 预期达标率」估算，不是承诺值。
 */
import type { GovernanceQuery } from '@/types/perf-governance'
import { Modal } from '@arco-design/web-vue'
import { MdPreview } from 'md-editor-v3'
import { ref, watch } from 'vue'
import { useGovernancePlan } from '@/views/perf/composables/useGovernance'
// 必须导入样式，否则 MdPreview 渲染出来没有任何格式
import 'md-editor-v3/lib/style.css'

const props = defineProps<{ query: GovernanceQuery | null }>()
const visible = defineModel<boolean>('visible', { default: false })

const { plan, loading, load, downloadMd, downloading, preview, loadPreview, sendNow, sending } = useGovernancePlan()
const tab = ref('plan')

watch(() => [visible.value, props.query] as const, ([v, q]) => {
  if (v && q?.project_group_code) {
    tab.value = 'plan'
    load(q)
  }
})

function onTabChange(key: string | number) {
  tab.value = String(key)
  if (tab.value === 'push' && !preview.value)
    loadPreview()
}

function confirmSend() {
  const p = preview.value
  if (!p)
    return
  Modal.confirm({
    title: '立即推送周报',
    content: `将把本周报发送到「${p.project_group_name}」的云之家群，这是真实业务群，确认发送？`,
    okText: '发送',
    onBeforeOk: () => sendNow(),
  })
}
</script>

<template>
  <a-drawer v-model:visible="visible" :width="880" :footer="false" unmount-on-close>
    <template #title>
      治理方案初稿 · {{ plan?.project_group_name || query?.project_group_code }}
    </template>
    <a-tabs :active-key="tab" @change="onTabChange">
      <template #extra>
        <a-button size="small" :loading="downloading" :disabled="!plan" @click="downloadMd">
          下载 md
        </a-button>
      </template>
      <a-tab-pane key="plan" title="方案">
        <a-spin :loading="loading" class="full">
          <a-alert type="warning" class="tip">
            初稿：恢复量为估算（超 3s 数 × 分析占比 × 预期达标率），需项目组结合实际确认后转为缺陷承诺。
          </a-alert>
          <MdPreview v-if="plan?.markdown" :model-value="plan.markdown" />
          <a-empty v-else-if="!loading" description="暂无方案数据" />
        </a-spin>
      </a-tab-pane>
      <a-tab-pane key="push" title="周报预览">
        <template v-if="preview">
          <a-space class="tip">
            <a-tag v-if="preview.yzj_group_id" color="green">
              已配置云之家群
            </a-tag>
            <a-tag v-else color="red">
              未配置云之家群（请在项目组管理中填写）
            </a-tag>
            <a-tag :color="preview.pass ? 'green' : 'red'">
              {{ preview.pass ? '已达标' : '未达标' }}
            </a-tag>
          </a-space>
          <pre class="push-content">{{ preview.content }}</pre>
          <a-button type="primary" status="warning" :loading="sending" :disabled="!preview.yzj_group_id" @click="confirmSend">
            立即推送到该项目组
          </a-button>
        </template>
        <a-empty v-else description="暂无周报预览" />
      </a-tab-pane>
    </a-tabs>
  </a-drawer>
</template>

<style scoped>
.full { width: 100%; }
.tip { margin-bottom: 12px; }
.push-content {
  white-space: pre-wrap;
  padding: 12px;
  margin-bottom: 12px;
  background: var(--color-fill-2);
  border-radius: 4px;
  font-size: 13px;
}
</style>
