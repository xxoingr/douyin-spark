<script setup>
import { computed, onMounted, onUnmounted, provide, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { accountName, api } from './api.js';
import FriendsTab from './components/FriendsTab.vue';
import MessagesTab from './components/MessagesTab.vue';
import RunsTab from './components/RunsTab.vue';
import AccountTab from './components/AccountTab.vue';

const status = ref({ current: null, last: null });
const finishedCount = ref(0); // 每结束一个后台任务加一，各页面据此重新加载数据
const tab = ref('friends');

// 所有账号，以及当前选中的账号（记在浏览器里，下次打开还是它）
const accounts = ref([]);
const accountId = ref(Number(localStorage.getItem('accountId')) || null);
const account = computed(() => accounts.value.find((a) => a.id === accountId.value) ?? null);
watch(accountId, (id) => localStorage.setItem('accountId', id ?? ''));

async function loadAccounts() {
  const previousIds = accounts.value.map((a) => a.id);
  accounts.value = await api.accounts();
  const ids = accounts.value.map((a) => a.id);
  const added = ids.filter((id) => !previousIds.includes(id));
  // 刚扫码添加的账号自动选中；选中的账号被删了就选第一个
  if (previousIds.length && added.length) accountId.value = added.at(-1);
  else if (!ids.includes(accountId.value)) accountId.value = ids[0] ?? null;
  if (!ids.length) tab.value = 'account';
}
onMounted(() => loadAccounts().catch(() => {}));
watch(finishedCount, () => loadAccounts().catch(() => {}));

let polledOnce = false;
async function poll() {
  const next = await api.status();
  const previousFinish = status.value.last?.finishedAt;
  status.value = next;
  // 页面打开后才结束的任务才提示（打开页面时看到的旧结果不提示）
  if (polledOnce && next.last && next.last.finishedAt !== previousFinish) {
    const { name, error } = next.last;
    if (error) ElMessage.error({ message: `${name}失败：${error}`, duration: 8000 });
    else ElMessage.success(`${name}完成`);
    finishedCount.value++;
  }
  polledOnce = true;
}

let timer;
onMounted(() => {
  poll().catch(() => {});
  timer = setInterval(() => poll().catch(() => {}), 2000);
});
onUnmounted(() => clearInterval(timer));

const busy = computed(() => Boolean(status.value.current));

// 启动后台任务：请求被拒绝（比如正在忙）时提示原因，返回是否启动成功
async function startTask(request) {
  try {
    await request();
    await poll();
    return true;
  } catch (err) {
    ElMessage.error(err.message);
    return false;
  }
}

async function sendNow() {
  if (await startTask(api.run)) tab.value = 'runs';
}

provide('status', status);
provide('busy', busy);
provide('finishedCount', finishedCount);
provide('startTask', startTask);
provide('accounts', accounts);
provide('accountId', accountId);
provide('loadAccounts', loadAccounts);
</script>

<template>
  <div class="page">
    <header class="header">
      <h1>🔥 douyin-spark</h1>
      <div class="header-right">
        <el-tag v-if="busy" type="warning" effect="light">⏳ 正在{{ status.current.name }}…</el-tag>
        <el-select v-if="accounts.length" v-model="accountId" style="width: 190px">
          <template #prefix>
            <img v-if="account?.avatar" :src="account.avatar" class="account-avatar" referrerpolicy="no-referrer" alt="" />
          </template>
          <el-option v-for="a in accounts" :key="a.id" :value="a.id" :label="accountName(a) + (a.loggedIn ? '' : '（登录失效）')">
            <div class="account-option">
              <img v-if="a.avatar" :src="a.avatar" class="account-avatar" referrerpolicy="no-referrer" alt="" />
              <span>{{ accountName(a) }}</span>
              <el-tag v-if="!a.loggedIn" type="danger" size="small" disable-transitions>登录失效</el-tag>
            </div>
          </el-option>
        </el-select>
        <el-button type="danger" :disabled="busy || !accounts.length" @click="sendNow">立即发送（全部账号）</el-button>
      </div>
    </header>

    <el-tabs v-model="tab">
      <el-tab-pane label="好友" name="friends"><FriendsTab /></el-tab-pane>
      <el-tab-pane label="消息" name="messages"><MessagesTab /></el-tab-pane>
      <el-tab-pane label="运行记录" name="runs"><RunsTab /></el-tab-pane>
      <el-tab-pane label="账号" name="account"><AccountTab /></el-tab-pane>
    </el-tabs>
  </div>
</template>

<style>
body {
  margin: 0;
  background: #f6f7f9;
  font-family: system-ui, -apple-system, 'Segoe UI', 'Microsoft YaHei', sans-serif;
}
.page {
  max-width: 960px;
  margin: 0 auto;
  padding: 16px;
}
.header {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.header h1 {
  margin: 0;
  font-size: 22px;
}
.header-right {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.account-option {
  display: flex;
  gap: 8px;
  align-items: center;
}
.account-avatar {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  object-fit: cover;
}
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
  margin-bottom: 12px;
}
.hint {
  color: #909399;
  font-size: 13px;
}
</style>
