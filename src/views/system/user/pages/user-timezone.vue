<script lang="ts" setup>
import { Message } from '@arco-design/web-vue'

import { computed, onUnmounted, ref, watch } from 'vue'
import { ErrorFlag } from '@/api/apis'
import { ApiSysUser } from '@/api/sysApis'
import { DEFAULT_TIMEZONE, formatTime, parseTimeInput, TIMEZONE_OPTIONS, timeZoneLabel, usePut } from '@/hooks'
import { useUserStore } from '@/stores'

defineOptions({ name: 'UserTimezone' })

const props = defineProps<{ userId?: string, timezone?: string }>()

const userStore = useUserStore()

/** 当前选中的时区。优先取后端返回的用户设置，其次 store，最后默认东八区。 */
const selected = ref<string>(props.timezone || userStore.user.timezone || DEFAULT_TIMEZONE)
watch(
  () => props.timezone,
  (v) => {
    if (v)
      selected.value = v
  },
)

/** 每秒走一次，让预览是活的，用户能直观确认选对了时区 */
const nowTick = ref(Date.now())
const timer = window.setInterval(() => (nowTick.value = Date.now()), 1000)
onUnmounted(() => window.clearInterval(timer))

/** 选中时区下的当前时间 */
const previewSelected = computed(() =>
  formatTime(nowTick.value, { timeZone: selected.value, placeholder: '-' }),
)
/** 东八区（平台默认，也是服务端业务时区）下的当前时间，便于对照 */
const previewDefault = computed(() =>
  formatTime(nowTick.value, { timeZone: DEFAULT_TIMEZONE, placeholder: '-' }),
)
const offsetLabel = computed(() => timeZoneLabel(selected.value, parseTimeInput(nowTick.value) ?? undefined))
const changed = computed(() => selected.value !== (userStore.user.timezone || DEFAULT_TIMEZONE))

const saving = ref(false)

async function submit() {
  if (!props.userId) {
    Message.warning('用户信息尚未加载完成，请稍后重试')
    return
  }
  saving.value = true
  try {
    // 只提交 id + timezone：后端 update_profile 是部分更新，未提交字段保持原值，
    // 不会把昵称/手机号覆盖成本页面的陈旧值。
    const { execute, data } = usePut(ApiSysUser.updateProfile, {
      id: props.userId,
      timezone: selected.value,
    })
    await execute()
    if (data.value === ErrorFlag)
      return
    // 立刻生效：store 里的时区被全站 formatTime 读取
    userStore.user.timezone = selected.value
    Message.success(`时区已设为 ${selected.value}，页面时间已按该时区显示`)
  }
  finally {
    saving.value = false
  }
}

function reset() {
  selected.value = userStore.user.timezone || DEFAULT_TIMEZONE
}
</script>

<template>
  <a-form :model="{ selected }" auto-label-width>
    <a-form-item label="显示时区">
      <a-select v-model="selected" placeholder="选择时区" allow-search>
        <a-option
          v-for="opt in TIMEZONE_OPTIONS"
          :key="opt.value"
          :value="opt.value"
          :label="opt.label"
        />
      </a-select>
    </a-form-item>

    <a-form-item label="当前时间">
      <div>
        <div class="font-mono">
          {{ previewSelected }}
          <a-tag class="m-l-6px" color="arcoblue">
            {{ offsetLabel }}
          </a-tag>
        </div>
        <div v-if="selected !== DEFAULT_TIMEZONE" class="text-12px c-gray m-t-4px">
          东八区同一时刻为 {{ previewDefault }}
        </div>
      </div>
    </a-form-item>

    <a-alert class="m-b-12px">
      平台所有列表与详情里的时间都按这里选择的时区显示。修改只影响你自己的显示，
      不改变数据本身。
    </a-alert>

    <div class="flex justify-around m-t-30px">
      <a-button type="primary" :loading="saving" :disabled="!changed" @click="submit">
        保存
      </a-button>
      <a-button type="secondary" :disabled="!changed" @click="reset">
        还原
      </a-button>
    </div>
  </a-form>
</template>
