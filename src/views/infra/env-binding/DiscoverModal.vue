<script lang="ts" setup>
/**
 * 「从集群发现」弹窗：按 集群 + 命名空间 + 标签选择器 列出工作负载，生成待确认候选。
 *
 * 发现只落候选（confirmed_at 为空），要在候选区人工确认后才计入生效绑定；
 * 再次发现时本次未返回的行会被后端标记 still_exists=false（列表红显）。
 */
import type { ClusterSelectOption, DiscoverForm } from './types'

const props = defineProps<{
  loading: boolean
  envName: string
  clusterOptions: ClusterSelectOption[]
}>()
defineEmits<{ submit: [] }>()
const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<DiscoverForm>('form', { required: true })

/** 选中集群后带出默认命名空间（只在没填过时），省一次手输 */
function onClusterChange() {
  if (form.value.namespace.trim())
    return
  const option = props.clusterOptions.find(item => item.value === form.value.cluster_id)
  if (option?.defaultNamespace)
    form.value.namespace = option.defaultNamespace
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="envName ? `从集群发现 · ${envName}` : '从集群发现资源'"
    :ok-loading="loading"
    :width="520"
    ok-text="开始发现"
    @ok="$emit('submit')"
  >
    <a-alert type="info" :show-icon="false" class="eb-discover-tip">
      发现只生成「待确认」候选；在候选区确认后才计入生效绑定。
    </a-alert>
    <a-form :model="form" layout="vertical">
      <a-form-item label="K8s 集群" required>
        <a-select
          v-model="form.cluster_id"
          :options="clusterOptions"
          placeholder="选择集群"
          data-testid="form-discover-cluster"
          @change="onClusterChange"
        />
      </a-form-item>
      <a-form-item label="命名空间" required>
        <a-input v-model="form.namespace" placeholder="如 fi-all-sit" />
      </a-form-item>
      <a-form-item label="标签选择器">
        <a-input v-model="form.label_selector" placeholder="可选，如 app.kubernetes.io/name=fi-ebg" />
        <template #extra>
          留空 = 该命名空间下的全部工作负载；写法同 kubectl -l
        </template>
      </a-form-item>
    </a-form>
  </a-modal>
</template>

<style scoped>
.eb-discover-tip {
  margin-bottom: 12px;
}
</style>
