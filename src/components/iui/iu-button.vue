<script setup lang="ts">
import type { Component } from 'vue'
import { unref } from 'vue'
import type { ButtonTypes } from '@arco-design/web-vue/es/button/constants'
import type { MaybeRef } from '@vueuse/core'
import type { IuButtonStatus } from '@/types/arco.iu'

defineOptions({ name: 'IuButton' })

// 注意: prop 类型需在 SFC 内本地声明 (Vite 8 rolldown 构建限制)。
// 对外复用的 iuButtonPropsType 仍保留在 @/components/iui/iui-props。
interface iuButtonPropsType {
  icon?: string | Component
  label?: string
  shape?: 'square' | 'round' | 'circle'
  size?: 'mini' | 'small' | 'medium' | 'large'
  auth?: MaybeRef<boolean>
  disabled?: MaybeRef<boolean>
  loading?: MaybeRef<boolean>
  type?: ButtonTypes
  status?: IuButtonStatus
  isSlot?: boolean
  slotName?: string
  fn?: () => void
}

withDefaults(defineProps<iuButtonPropsType>(), {
  label: '',
  shape: 'square',
  size: 'medium',
  auth: true,
  disabled: false,
  loading: false,
  type: 'secondary',
  status: 'normal',
  isSlot: false,
  fn: () => {},
})
</script>

<template>
  <template v-if="!isSlot">
    <a-button
      v-if="auth"
      :disabled="unref(disabled)"
      :type="type"
      :status="status"
      :shape="shape"
      :loading="unref(loading)"
      @click="fn as any"
    >
      {{ label }}
      <template #icon>
        <component :is="icon" />
      </template>
    </a-button>
  </template>
  <template v-if="isSlot">
    <slot :name="slotName" />
  </template>
</template>
