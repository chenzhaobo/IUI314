<script lang="ts" setup>
import { Message, Modal } from '@arco-design/web-vue'
import { computed, ref } from 'vue'
import { ApiSysApiToken, ApiSysUser } from '@/api/apis'
import { formatTime, useGet, usePost } from '@/hooks'

defineOptions({ name: 'ApiToken' })

const query = ref({ name: '', active_only: false, page_num: 1, page_size: 20 })
const { isFetching, data: raw, execute: fetchList } = useGet<any>(ApiSysApiToken.getList, query, { immediate: true })
const list = computed(() => raw.value?.list || [])
const total = computed(() => raw.value?.total || 0)

// 绑定用户下拉：令牌的权限完全等于这个用户的角色权限
const userQuery = ref({ page_size: 200 })
const { data: userRaw } = useGet<any>(ApiSysUser.getList, userQuery, { immediate: true })
const userOptions = computed(() =>
  (userRaw.value?.list || []).map((u: any) => ({
    label: `${u.user_name}（${u.user_nickname}）`,
    value: u.id,
  })),
)

/// 令牌状态：吊销 / 过期 / 停用 / 有效
function statusOf(r: any): { text: string, color: string } {
  if (r.revoked_at)
    return { text: '已吊销', color: 'gray' }
  if (r.expires_at && new Date(r.expires_at).getTime() < Date.now())
    return { text: '已过期', color: 'orange' }
  if (r.status !== '1')
    return { text: '已停用', color: 'gray' }
  return { text: '有效', color: 'green' }
}

// ── 签发 ──────────────────────────────────────
const addVisible = ref(false)
const addForm = ref<{ name: string, user_id: string, expires_days: number | undefined, remark: string }>({
  name: '',
  user_id: '',
  expires_days: 90,
  remark: '',
})
/// 明文只在签发响应里出现一次，之后任何接口都查不到
const issued = ref<any>(null)

function openAdd() {
  addForm.value = { name: '', user_id: '', expires_days: 90, remark: '' }
  issued.value = null
  addVisible.value = true
}

async function submitAdd() {
  if (!addForm.value.name.trim()) {
    Message.warning('请填令牌名称')
    return false
  }
  const { data } = await usePost(ApiSysApiToken.add, {
    name: addForm.value.name,
    user_id: addForm.value.user_id || undefined,
    expires_days: addForm.value.expires_days,
    remark: addForm.value.remark || undefined,
  }).execute()
  if (data.value === null)
    return false
  issued.value = data.value
  fetchList()
  return false // 保持弹窗打开，让人把明文抄走
}

async function copyToken() {
  const t = issued.value?.token
  if (!t)
    return
  try {
    await navigator.clipboard.writeText(t)
    Message.success('已复制到剪贴板')
  }
  catch {
    // 非 https 或浏览器不给权限时降级：让人手工选中
    Message.warning('浏览器不允许自动复制，请手工选中复制')
  }
}

function handleRevoke(r: any) {
  Modal.warning({
    title: '吊销令牌？',
    content: `令牌「${r.name}」（${r.token_prefix}…）将立即失效，不可撤销。正在用它的脚本会开始报 401。`,
    hideCancel: false,
    okText: '确认吊销',
    onOk: async () => {
      const { data } = await usePost(ApiSysApiToken.revoke, { id: r.id }).execute()
      if (data.value !== null)
        fetchList()
    },
  })
}

const columns = [
  { title: '名称', dataIndex: 'name', width: 160, ellipsis: true, tooltip: true },
  { title: '前缀', dataIndex: 'token_prefix', width: 190, slotName: 'prefix' },
  { title: '代表用户', dataIndex: 'user_id', width: 210, ellipsis: true },
  { title: '状态', dataIndex: 'status', width: 90, slotName: 'status' },
  { title: '过期', dataIndex: 'expires_at', width: 170, slotName: 'expires' },
  { title: '最近使用', dataIndex: 'last_used_at', width: 170, slotName: 'used' },
  { title: '备注', dataIndex: 'remark', ellipsis: true, tooltip: true },
  { title: '操作', dataIndex: 'operations', slotName: 'operations', width: 90, fixed: 'right' as const },
]
</script>

<template>
  <div class="p-4">
    <a-card title="API 令牌" :bordered="false">
      <template #extra>
        <a-space>
          <a-input v-model="query.name" placeholder="名称" allow-clear style="width: 180px" @change="() => fetchList()" />
          <a-switch v-model="query.active_only" @change="() => fetchList()" />
          <span class="text-sm">只看有效</span>
          <a-button @click="() => fetchList()">
            刷新
          </a-button>
          <a-button type="primary" @click="openAdd">
            签发令牌
          </a-button>
        </a-space>
      </template>

      <a-alert type="warning" class="mb-3">
        令牌是给<b>机器客户端</b>用的凭据（MCP 桥、发版脚本、CI）：人走「口令 + 验证码」，机器走令牌。
        <br>
        <b>权限完全等于所绑定用户的角色权限</b>——不额外设一层。要限制范围，就建一个只授了必要权限点的
        专用用户，把令牌绑到它上面。明文只在签发时显示一次，库里只存 SHA-256。
      </a-alert>

      <a-table
        :loading="isFetching"
        :columns="columns"
        :data="list"
        row-key="id"
        size="small"
        :pagination="{ total, current: query.page_num, pageSize: query.page_size, showTotal: true }"
        :scroll="{ x: 1250 }"
        :row-class="(record: any) => (statusOf(record).text !== '有效' ? 'token-inactive' : '')"
        @page-change="(p: number) => { query.page_num = p; fetchList() }"
      >
        <template #prefix="{ record }">
          <span class="font-mono text-xs">{{ record.token_prefix }}…</span>
        </template>
        <template #status="{ record }">
          <a-tag :color="statusOf(record).color">
            {{ statusOf(record).text }}
          </a-tag>
        </template>
        <template #expires="{ record }">
          {{ record.expires_at ? formatTime(record.expires_at) : '长期有效' }}
        </template>
        <template #used="{ record }">
          {{ record.last_used_at ? formatTime(record.last_used_at) : '从未使用' }}
        </template>
        <template #operations="{ record }">
          <a-button v-if="!record.revoked_at" type="text" status="danger" size="mini" @click="handleRevoke(record)">
            吊销
          </a-button>
          <span v-else class="text-gray-400 text-xs">—</span>
        </template>
      </a-table>
    </a-card>

    <a-modal v-model:visible="addVisible" title="签发 API 令牌" :on-before-ok="submitAdd" width="640px">
      <a-form v-if="!issued" :model="addForm" layout="vertical">
        <a-form-item label="名称" help="写清用途，将来排查泄露时靠它定位">
          <a-input v-model="addForm.name" placeholder="如：platform-mcp / 发版脚本 / CI" />
        </a-form-item>
        <a-form-item label="代表用户" help="留空则代表你自己。令牌的权限就是这个用户角色的权限">
          <a-select v-model="addForm.user_id" placeholder="默认：当前登录用户" allow-search allow-clear>
            <a-option v-for="o in userOptions" :key="o.value" :value="o.value">
              {{ o.label }}
            </a-option>
          </a-select>
        </a-form-item>
        <a-form-item label="有效天数" help="留空或 0 = 长期有效。长期令牌泄露后窗口无限，建议设期限">
          <a-input-number v-model="addForm.expires_days" :min="0" :max="3650" placeholder="90" />
        </a-form-item>
        <a-form-item label="备注">
          <a-textarea v-model="addForm.remark" :auto-size="{ minRows: 2 }" />
        </a-form-item>
      </a-form>

      <template v-else>
        <a-alert type="error" class="mb-3">
          <b>明文只显示这一次</b>，关掉这个窗口就再也查不到（库里只存 SHA-256）。
          它等价于所绑定用户的口令，请立刻存进密钥管理或 CI secret。
        </a-alert>
        <a-input :model-value="issued.token" readonly>
          <template #append>
            <a-button size="mini" @click="copyToken">
              复制
            </a-button>
          </template>
        </a-input>
        <a-descriptions :column="1" size="small" bordered class="mt-3">
          <a-descriptions-item label="名称">
            {{ issued.name }}
          </a-descriptions-item>
          <a-descriptions-item label="代表用户">
            {{ issued.user_id }}
          </a-descriptions-item>
          <a-descriptions-item label="过期">
            {{ issued.expires_at ? formatTime(issued.expires_at) : '长期有效' }}
          </a-descriptions-item>
        </a-descriptions>
        <a-divider>怎么用</a-divider>
        <div class="text-xs">
          <div class="mb-1">
            HTTP 头：<span class="font-mono">Authorization: Bearer &lt;令牌&gt;</span>
          </div>
          <div>
            platform-mcp：<span class="font-mono">export PLATFORM_API_TOKEN=&lt;令牌&gt;</span>
            （设了它就不再走登录，也不受验证码影响）
          </div>
        </div>
      </template>
    </a-modal>
  </div>
</template>

<style scoped>
/* 失效令牌置灰，一眼区分哪些还在用 */
:deep(.token-inactive) {
  opacity: 0.55;
}
</style>
