<script setup lang="ts">
/**
 * 按规则批量生成配置缺陷：勾选项目组 → POST /config-check/defects/batch。
 *
 * 生成后弹窗保持打开并展示 created / updated / failed，方便逐组核对；
 * 汇总与明细由页面在成功后刷新。
 */
import type { ConfigGroupDistRow, ConfigRuleRow } from '../../../composables/configCheckRules'
import type { ConfigBatchDefectResult } from '@/types/sechub-release'
import { computed, ref, watch } from 'vue'

const props = defineProps<{
  rule: ConfigRuleRow | null
  groups: ConfigGroupDistRow[]
  loading: boolean
  result: ConfigBatchDefectResult | null
}>()

const emit = defineEmits<{
  (e: 'submit', groups: string[]): void
}>()

const visible = defineModel<boolean>('visible', { default: false })

const selectableCodes = computed(() => props.groups.filter(row => row.selectable).map(row => row.code))
const selected = ref<string[]>([])

function resetSelection() {
  selected.value = [...selectableCodes.value]
}

watch(visible, (value) => {
  if (value)
    resetSelection()
})

watch(() => props.rule?.code, () => {
  if (visible.value)
    resetSelection()
})

function confirm() {
  if (!selected.value.length)
    return
  emit('submit', [...selected.value])
}
</script>

<template>
  <a-modal
    v-model:visible="visible"
    :closable="!loading"
    :mask-closable="!loading"
    :width="600"
    title="按项目组生成缺陷"
  >
    <template v-if="rule">
      <a-alert :show-icon="false" style="margin-bottom: 10px" type="info">
        规则 {{ rule.code }} · {{ rule.title }}
        <br>
        已提缺陷的项目组会更新现有草稿，其余新建；未归属项目组的检查项不在列表内。
      </a-alert>

      <div class="toolbar">
        <span class="hint">已选 {{ selected.length }} / {{ selectableCodes.length }}</span>
        <a-space :size="4">
          <a-button size="mini" @click="selected = [...selectableCodes]">
            全选
          </a-button>
          <a-button size="mini" @click="selected = []">
            清空
          </a-button>
        </a-space>
      </div>

      <a-checkbox-group v-model="selected" class="groups">
        <a-checkbox
          v-for="row in groups"
          :key="row.code || '__none__'"
          :disabled="!row.selectable"
          :value="row.code"
        >
          {{ row.name }}（待处理 {{ row.open }}）
        </a-checkbox>
      </a-checkbox-group>

      <a-alert v-if="result" class="result" :show-icon="true" type="success">
        已生成 {{ result.created }} 个、更新 {{ result.updated }} 个配置缺陷。
      </a-alert>
      <a-alert v-if="result?.failed.length" class="result" :show-icon="true" type="warning">
        <div>失败 {{ result.failed.length }} 个：</div>
        <div v-for="row in result.failed" :key="row.project_group" class="failure">
          {{ row.project_group }}：{{ row.error }}
        </div>
      </a-alert>
    </template>
    <a-empty v-else description="请先在左栏选择规则" />

    <template #footer>
      <a-space>
        <a-button @click="visible = false">
          关闭
        </a-button>
        <a-button
          :disabled="!rule || !selected.length"
          :loading="loading"
          type="primary"
          @click="confirm"
        >
          生成
        </a-button>
      </a-space>
    </template>
  </a-modal>
</template>

<style scoped>
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.hint {
  color: var(--color-text-3);
  font-size: 12px;
}
.groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 280px;
  overflow-x: hidden;
  overflow-y: auto;
}
.result {
  margin-top: 10px;
}
.failure {
  font-size: 12px;
  word-break: break-all;
}
</style>
