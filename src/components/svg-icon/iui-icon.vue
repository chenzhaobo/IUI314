<script lang="ts" setup>
import { computed, defineOptions } from 'vue'

defineOptions({ name: 'IuiIcon' })

// 注意: prop 类型需在 SFC 内本地声明。
// Vite 8 (rolldown) 构建时无法从外部文件解析 defineProps 的导入类型 (No fs 错误)。
interface IuiIconProps {
  name: string
  size?: string | number
  color?: string
  rotate?: string | number
  spin?: boolean
}

const props = withDefaults(defineProps<IuiIconProps>(), {
  size: 16,
  color: 'currentColor',
  rotate: 0,
  spin: false,
})
const symbolId = computed(() => `#icon-${props.name}`)
const iconSize = computed(() => `${props.size}px`)
const rotate = computed(() => `rotate(${props.rotate}deg)`)
const styleClass = computed(() => {
  const classList = ['display-class', 'vertical-middle']
  if (props.spin)
    classList.push('animate-spin')
  return classList.join(' ')
})
</script>

<template>
  <svg
    aria-hidden="true"
    :class="styleClass"
  >
    <use :fill="color" :href="symbolId" />
  </svg>
</template>

<style scoped lang="scss">
.display-class{
  display: inline-block;
  width: v-bind(iconSize);
  height: v-bind(iconSize);
  transform: v-bind(rotate);
}
</style>
