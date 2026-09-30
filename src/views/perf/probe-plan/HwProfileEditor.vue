<script lang="ts" setup>
/**
 * 硬件档位编辑器：每个档位 = 一组「绑定部署 + 副本 / 容器 limits」变更。
 *
 * 用普通网格而不是 `a-table` 编辑行：变更行的唯一键是 binding_id，而新行的
 * binding_id 还是空串，当 row-key 会重复；档位数量本来就是个位数，网格更直接。
 */
import type { HwProfile } from './types'
import type { SelectOption } from '@/types/static-scan'
import { emptyHwChange, emptyHwProfile } from './types'

withDefaults(defineProps<{
  /** 可选的绑定部署（已按 allow_ops=true 过滤） */
  options: SelectOption[]
  loading?: boolean
}>(), {
  loading: false,
})

const profiles = defineModel<HwProfile[]>({ required: true })

function addProfile() {
  profiles.value = [...profiles.value, emptyHwProfile(profiles.value.length)]
}

function removeProfile(index: number) {
  profiles.value = profiles.value.filter((_, i) => i !== index)
}

function addChange(profile: HwProfile) {
  profile.changes.push(emptyHwChange())
}

function removeChange(profile: HwProfile, index: number) {
  profile.changes.splice(index, 1)
}
</script>

<template>
  <div class="hwp">
    <div v-for="(profile, pi) in profiles" :key="pi" class="hwp-card">
      <div class="hwp-head">
        <span class="hwp-idx">档位 {{ pi + 1 }}</span>
        <a-input
          v-model="profile.label"
          size="small"
          placeholder="档位名称，如 2副本-4C8G"
          class="hwp-label"
        />
        <a-button
          size="mini"
          status="danger"
          :disabled="profiles.length <= 1"
          @click="removeProfile(pi)"
        >
          删除档位
        </a-button>
      </div>

      <div v-for="(change, ci) in profile.changes" :key="ci" class="hwp-row">
        <a-select
          v-model="change.binding_id"
          :options="options"
          :loading="loading"
          size="small"
          placeholder="绑定部署（仅 allow_ops）"
          allow-search
          class="hwp-cell hwp-bind"
        />
        <a-input-number
          :model-value="change.replicas ?? undefined"
          :min="0"
          size="small"
          placeholder="副本数"
          class="hwp-cell"
          @update:model-value="(v: number | undefined) => (change.replicas = v ?? null)"
        />
        <a-input v-model="change.container" size="small" placeholder="容器名" class="hwp-cell" />
        <a-input v-model="change.cpu" size="small" placeholder="cpu 如 500m" class="hwp-cell" />
        <a-input v-model="change.memory" size="small" placeholder="memory 如 1Gi" class="hwp-cell" />
        <a-button
          size="mini"
          status="danger"
          :disabled="profile.changes.length <= 1"
          @click="removeChange(profile, ci)"
        >
          删
        </a-button>
      </div>

      <a-button size="mini" type="dashed" long @click="addChange(profile)">
        + 该档位再加一项变更
      </a-button>
    </div>

    <a-button size="small" type="dashed" long @click="addProfile">
      + 新增硬件档位（不填 = 只测当前硬件）
    </a-button>
  </div>
</template>

<style scoped>
.hwp {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.hwp-card {
  padding: 8px;
  background: var(--color-fill-1);
  border-radius: 4px;
}

.hwp-head {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.hwp-idx {
  flex-shrink: 0;
  color: var(--color-text-2);
  font-weight: 600;
  font-size: 12px;
}

.hwp-label {
  flex: 1;
}

.hwp-row {
  display: flex;
  gap: 6px;
  align-items: center;
  margin-bottom: 6px;
}

.hwp-cell {
  flex: 1;
  min-width: 0;
}

.hwp-bind {
  flex: 1.6;
}
</style>
