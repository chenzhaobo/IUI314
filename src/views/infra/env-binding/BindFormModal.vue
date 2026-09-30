<script lang="ts" setup>
/**
 * 「新增绑定」弹窗：按 bind_kind 联动必填字段。
 *
 * 四类共用一份表单对象，提交时由 buildBindingPayload 只挑与类型匹配的键 ——
 * 混杂字段会被后端原样写进行里，留下无法解释的数据。
 */
import type { BindingForm, ClusterSelectOption } from './types'
import type { SelectOption } from '@/types/static-scan'
import { BIND_KIND_OPTIONS } from './types'

const props = defineProps<{
  loading: boolean
  envName: string
  clusterOptions: ClusterSelectOption[]
  promOptions: SelectOption[]
  monitorOptions: SelectOption[]
  vmOptions: SelectOption[]
  serviceOptions: SelectOption[]
}>()
defineEmits<{ submit: [] }>()
const visible = defineModel<boolean>('visible', { required: true })
const form = defineModel<BindingForm>('form', { required: true })

/** 工作负载绑定：选中集群后带出默认命名空间（只在没填过时），与「从集群发现」一致 */
function onClusterChange() {
  if (form.value.namespace.trim())
    return
  const option = props.clusterOptions.find(item => item.value === form.value.cluster_id)
  if (option?.defaultNamespace)
    form.value.namespace = option.defaultNamespace
}

// 中间件绑定要求「服务 / 虚拟机至少一个」，两个下拉互斥选择，避免同时填出歧义
function onServiceChange() {
  form.value.vm_id = ''
}

function onVmChange() {
  form.value.service_id = ''
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :title="envName ? `新增绑定 · ${envName}` : '新增绑定'"
    :ok-loading="loading"
    :width="580"
    @ok="$emit('submit')"
  >
    <a-form :model="form" layout="vertical">
      <a-form-item label="绑定类型" required>
        <a-radio-group v-model="form.bind_kind" type="button">
          <a-radio v-for="option in BIND_KIND_OPTIONS" :key="option.value" :value="option.value">
            {{ option.label }}
          </a-radio>
        </a-radio-group>
      </a-form-item>

      <template v-if="form.bind_kind === 'workload'">
        <a-form-item label="K8s 集群" required>
          <a-select
            v-model="form.cluster_id"
            :options="clusterOptions"
            placeholder="选择集群"
            data-testid="form-binding-cluster"
            @change="onClusterChange"
          />
        </a-form-item>
        <a-form-item label="命名空间" required>
          <a-input v-model="form.namespace" placeholder="如 fi-all-sit" data-testid="form-binding-namespace" />
        </a-form-item>
        <a-form-item label="工作负载名" required>
          <a-input v-model="form.workload_name" placeholder="Deployment / StatefulSet 名，如 fi-ebg" />
        </a-form-item>
        <a-form-item label="Monitor 应用名">
          <a-input v-model="form.monitor_app_name" placeholder="可选，如 fi-ebg-sit" />
          <template #extra>
            Monitor 节点清单按它匹配；也可在绑定后于列表行内直接修改
          </template>
        </a-form-item>
        <a-form-item label="允许平台操作">
          <a-switch v-model="form.allow_ops" />
          <template #extra>
            开启后本环境发起操作任务时，允许对该工作负载执行重启、扩缩容等动作
          </template>
        </a-form-item>
      </template>

      <template v-else-if="form.bind_kind === 'middleware'">
        <a-form-item label="关联服务实例">
          <a-select v-model="form.service_id" :options="serviceOptions" placeholder="服务与虚拟机至少填一个" @change="onServiceChange" />
        </a-form-item>
        <a-form-item label="关联虚拟机">
          <a-select v-model="form.vm_id" :options="vmOptions" placeholder="服务与虚拟机至少填一个" @change="onVmChange" />
        </a-form-item>
        <a-form-item label="Prometheus 实例标签" required>
          <a-input v-model="form.prom_instance" placeholder="PMM node_name，如 fi-db-01" />
        </a-form-item>
        <a-form-item label="Prometheus 数据源" required>
          <a-select v-model="form.prometheus_id" :options="promOptions" placeholder="选择数据源" />
        </a-form-item>
      </template>

      <template v-else-if="form.bind_kind === 'prometheus'">
        <a-form-item label="Prometheus 数据源" required>
          <a-select v-model="form.prometheus_id" :options="promOptions" placeholder="选择数据源" />
        </a-form-item>
      </template>

      <template v-else>
        <a-form-item label="Monitor 数据源" required>
          <a-select v-model="form.monitor_source_id" :options="monitorOptions" placeholder="选择数据源" />
        </a-form-item>
      </template>

      <a-form-item label="角色">
        <a-input v-model="form.infra_role" placeholder="可选，如 db / gateway / app" />
      </a-form-item>
      <a-form-item label="备注">
        <a-textarea v-model="form.remark" :auto-size="{ minRows: 2, maxRows: 3 }" placeholder="可选" />
      </a-form-item>
    </a-form>
  </a-modal>
</template>
