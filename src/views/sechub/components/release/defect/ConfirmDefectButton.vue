<script setup lang="ts">
/**
 * 运行结果行「确认缺陷」入口：弹窗填可选说明 → confirm-defect → 给出草稿页跳转。
 *
 * 逻辑在 `useConfirmDefect`，本组件只负责按钮、弹窗与跳转。
 */
import { useRouter } from 'vue-router'

import { useConfirmDefect } from '../../../composables/useConfirmDefect'

defineProps<{ resultId: string }>()

const router = useRouter()
const { visible, comment, submitting, result, open, close, submit } = useConfirmDefect()

async function handleConfirm() {
  await submit()
}

function goDefects() {
  visible.value = false
  void router.push('/sechub/release/release-defects')
}
</script>

<template>
  <a-button size="mini" type="text" @click="open(resultId)">
    确认缺陷
  </a-button>
  <a-modal
    v-model:visible="visible"
    :closable="!submitting"
    :mask-closable="!submitting"
    title="确认缺陷"
    :width="520"
    unmount-on-close
  >
    <template v-if="!result">
      <a-alert type="info" :show-icon="false">
        确认后会把该结果标记为真实缺陷，并按模板生成缺陷草稿；同一接口同类型的未关闭缺陷会更新已有草稿。
      </a-alert>
      <a-form :model="{ comment }" layout="vertical" style="margin-top: 12px">
        <a-form-item label="说明（可选）">
          <a-textarea
            v-model="comment"
            :auto-size="{ minRows: 3, maxRows: 6 }"
            placeholder="补充复核说明，将写入缺陷内容"
          />
        </a-form-item>
      </a-form>
    </template>
    <template v-else>
      <a-alert type="success">
        {{ result.created ? '已生成缺陷草稿' : '已更新缺陷草稿' }}
      </a-alert>
    </template>

    <template #footer>
      <a-space v-if="result">
        <a-button @click="visible = false">
          关闭
        </a-button>
        <a-button type="primary" @click="goDefects">
          查看缺陷草稿
        </a-button>
      </a-space>
      <a-space v-else>
        <a-button :disabled="submitting" @click="close">
          取消
        </a-button>
        <a-button type="primary" :loading="submitting" @click="handleConfirm">
          确认生成草稿
        </a-button>
      </a-space>
    </template>
  </a-modal>
</template>
