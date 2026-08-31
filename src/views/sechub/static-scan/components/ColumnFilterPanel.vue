<script setup lang="ts">
/**
 * 列过滤面板，塞进 Arco 表格列的 filterable.slotName 插槽。
 *
 * Arco 自带的 filters 是「枚举多选」，而这里要过滤文件路径、匹配文本这类自由文本，
 * 候选值无穷、枚举不适用，所以自己做运算符面板。
 */
import { computed } from 'vue'

import type { ColumnFilterState } from '../composables/useColumnFilter'
import { NUMBER_OPS, TEXT_OPS, emptyFilter } from '../composables/useColumnFilter'

const props = defineProps<{
  /** 当前条件；由父组件按 dataIndex 存一份 */
  modelValue: ColumnFilterState
}>()

const emit = defineEmits<{
  'update:modelValue': [ColumnFilterState]
  /** 条件变化后通知父组件重新过滤（父组件可能还要重置分页） */
  'change': []
}>()

const ops = computed(() => (props.modelValue.kind === 'number' ? NUMBER_OPS : TEXT_OPS))

function patch(part: Partial<ColumnFilterState>) {
  emit('update:modelValue', { ...props.modelValue, ...part })
}

function reset() {
  emit('update:modelValue', emptyFilter(props.modelValue.kind))
  emit('change')
}
</script>

<template>
  <div class="col-filter">
    <!-- 时间：从…到…，两端都可留空表示不限 -->
    <template v-if="modelValue.kind === 'date'">
      <a-range-picker
        :model-value="modelValue.range"
        style="width: 240px"
        size="small"
        allow-clear
        @update:model-value="(v: any) => patch({ range: (v ?? ['', '']) as [string, string] })"
        @change="emit('change')"
      />
    </template>

    <!-- 文本 / 数字：运算符 + 值 -->
    <template v-else>
      <a-select
        :model-value="modelValue.op"
        size="small"
        style="width: 96px"
        @update:model-value="(v: any) => patch({ op: v })"
        @change="emit('change')"
      >
        <a-option v-for="o in ops" :key="o.value" :value="o.value">
          {{ o.label }}
        </a-option>
      </a-select>
      <a-input
        :model-value="modelValue.value"
        size="small"
        allow-clear
        style="width: 150px"
        :placeholder="modelValue.kind === 'number' ? '输入数字' : '输入关键字'"
        @update:model-value="(v: any) => patch({ value: String(v ?? '') })"
        @press-enter="emit('change')"
        @clear="emit('change')"
      />
    </template>

    <div class="col-filter-actions">
      <a-button size="mini" @click="reset">
        清空
      </a-button>
      <a-button size="mini" type="primary" @click="emit('change')">
        筛选
      </a-button>
    </div>
  </div>
</template>

<style scoped>
.col-filter {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
}

.col-filter-actions {
  display: flex;
  justify-content: flex-end;
  gap: 6px;
}
</style>
