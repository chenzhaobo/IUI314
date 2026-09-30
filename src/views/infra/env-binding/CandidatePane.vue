<script lang="ts" setup>
/**
 * 候选区：集群发现落下、还没人工确认的绑定行（confirmed_at 为空）。
 *
 * 勾选状态留在本组件 —— 确认/忽略后行集合会变，旧 id 随即作废，
 * 往外只抛选中的 id 列表。放在 ListPage 的工具行插槽里（见 env-binding.vue 的注释）。
 */
import type { BindingNameMaps, BindingRow } from './types'
import { Message } from '@arco-design/web-vue'
import { computed, ref, watch } from 'vue'
import { BINDING_MISSING_TEXT, bindingResourceText } from './types'

const props = defineProps<{
  candidates: BindingRow[]
  maps: BindingNameMaps
  confirming: boolean
  ignoring: boolean
}>()

const emit = defineEmits<{
  confirm: [ids: string[]]
  ignore: [ids: string[]]
}>()

const checkedIds = ref<string[]>([])

// 行集合一变（重拉/确认/忽略后）旧勾选即作废，避免把已不存在的 id 提交上去
watch(() => props.candidates.map(row => row.id).join(','), () => {
  checkedIds.value = []
})

const allChecked = computed(
  () => props.candidates.length > 0 && checkedIds.value.length === props.candidates.length,
)
const someChecked = computed(() => checkedIds.value.length > 0 && !allChecked.value)

function toggleRow(id: string) {
  checkedIds.value = checkedIds.value.includes(id)
    ? checkedIds.value.filter(item => item !== id)
    : [...checkedIds.value, id]
}

// 表头勾选框：全选/全不选（部分勾选态下点击 = 全选，与 Arco 的默认直觉一致）
function toggleAll() {
  checkedIds.value = allChecked.value ? [] : props.candidates.map(row => row.id)
}

function submitConfirm() {
  if (!checkedIds.value.length) {
    Message.warning('请先勾选要确认的候选')
    return
  }
  emit('confirm', [...checkedIds.value])
}

function submitIgnore() {
  if (!checkedIds.value.length) {
    Message.warning('请先勾选要忽略的候选')
    return
  }
  emit('ignore', [...checkedIds.value])
}
</script>

<template>
  <div class="eb-candidates">
    <div class="eb-cand-head">
      <a-checkbox :model-value="allChecked" :indeterminate="someChecked" @change="toggleAll">
        集群发现候选（未确认）
      </a-checkbox>
      <span class="eb-cand-count">{{ candidates.length }} 条</span>
      <a-button
        size="mini"
        type="primary"
        :loading="confirming"
        data-testid="btn-confirm-candidates"
        @click="submitConfirm"
      >
        确认
      </a-button>
      <a-button
        size="mini"
        :loading="ignoring"
        data-testid="btn-ignore-candidates"
        @click="submitIgnore"
      >
        忽略
      </a-button>
      <span class="eb-cand-tip">确认后才计入本环境的绑定；忽略后不再出现在候选里</span>
    </div>
    <div class="eb-cand-body">
      <div v-for="row in candidates" :key="row.id" class="eb-cand-row">
        <a-checkbox :model-value="checkedIds.includes(row.id)" @change="toggleRow(row.id)">
          {{ bindingResourceText(row, maps) }}
        </a-checkbox>
        <a-tag v-if="row.still_exists === false" size="small" color="red">
          {{ BINDING_MISSING_TEXT }}
        </a-tag>
        <span v-if="row.infra_role" class="eb-cand-role">{{ row.infra_role }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.eb-candidates {
  display: flex;
  flex-direction: column;
  /* 占用工具行的整行：钳在固定高度里内部滚动，不随候选条数把表格挤没 */
  flex-basis: 100%;
  height: 180px;
  min-width: 0;
  padding: 8px 12px;
  background: var(--color-bg-2);
  border: 1px solid var(--color-border-2);
  border-radius: 4px;
}

.eb-cand-head {
  display: flex;
  flex-shrink: 0;
  gap: 12px;
  align-items: center;
  padding-bottom: 6px;
}

.eb-cand-count {
  color: var(--color-text-3);
}

.eb-cand-tip {
  margin-left: auto;
  color: var(--color-text-3);
  font-size: 12px;
}

.eb-cand-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.eb-cand-row {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 3px 0;
}

.eb-cand-role {
  color: var(--color-text-3);
  font-size: 12px;
}
</style>
