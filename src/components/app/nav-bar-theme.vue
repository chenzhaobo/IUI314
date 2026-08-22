<script lang="ts"  setup>
import { useI18n } from 'vue-i18n'

import { useTheme } from '@/hooks'
import { useAppStore } from '@/stores'

defineOptions({ name: 'NavBarTheme' })
const appStore = useAppStore()
const { t } = useI18n({ useScope: 'global' })
const { set_theme, theme_list } = useTheme()
</script>

<template>
  <div>
    <a-dropdown trigger="hover">
      <div class="cursor-pointer">
        <IconSkin />
      </div>
      <template #content>
        <a-doption
          v-for="theme in theme_list"
          :key="theme"
          @click="set_theme(theme)"
        >
          <span
            :class="appStore.app.theme === theme ? 'font-bold' : 'font-normal'"
          >
            {{ t(`theme.${theme}`) }}
          </span>
        </a-doption>
      </template>
    </a-dropdown>
  </div>
</template>
