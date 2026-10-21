<script setup>
import { inject } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { accountName, api } from '../api.js';

const accounts = inject('accounts');
const busy = inject('busy');
const startTask = inject('startTask');
const loadAccounts = inject('loadAccounts');

const date = (iso) => (iso ? new Date(iso).toLocaleDateString('zh-CN') : '');

// 返回 true 表示用户点了确定
const confirm = (message, title, confirmButtonText) =>
  ElMessageBox.confirm(message, title, { confirmButtonText, cancelButtonText: '取消', type: 'warning' }).then(
    () => true,
    () => false,
  );

// 一般只在发送提示“登录失效”时才需要
async function relogin(account) {
  const message = `会弹出浏览器窗口扫码。请先在手机抖音里切换到「${accountName(account)}」这个号再扫。确定要重新登录吗？`;
  if (await confirm(message, '重新登录', '重新登录')) startTask(api.login);
}

async function remove(account) {
  const message = `会删除「${accountName(account)}」的登录状态、好友勾选、消息模板和运行记录，抖音上的聊天不受影响。确定删除吗？`;
  if (!(await confirm(message, '删除账号', '删除'))) return;
  try {
    await api.deleteAccount(account.id);
    await loadAccounts();
    ElMessage.success('已删除');
  } catch (err) {
    ElMessage.error(err.message);
  }
}
</script>

<template>
  <div>
    <div class="toolbar">
      <el-button type="primary" :disabled="busy" @click="startTask(api.login)">添加账号</el-button>
      <span class="hint">会在电脑上弹出浏览器窗口，用手机抖音扫码（5 分钟内有效）。要添加哪个号，就先在手机抖音里切换到那个号再扫。</span>
    </div>

    <el-empty v-if="!accounts.length" description="还没有账号，点“添加账号”扫码登录" />
    <el-card v-for="a in accounts" :key="a.id" shadow="never" class="account">
      <img v-if="a.avatar" :src="a.avatar" class="avatar" referrerpolicy="no-referrer" alt="" />
      <div class="info">
        <b>{{ accountName(a) }}</b>
        <span v-if="a.loggedIn" class="hint">✅ 已登录，有效期至 {{ date(a.expiresAt) }}，每次运行都会自动续期</span>
        <span v-else class="hint">❌ 登录已失效，需要重新登录</span>
      </div>
      <el-button v-if="a.loggedIn" link type="info" :disabled="busy" @click="relogin(a)">重新登录</el-button>
      <el-button v-else type="primary" size="small" :disabled="busy" @click="startTask(api.login)">重新登录</el-button>
      <el-button link type="danger" :disabled="busy" @click="remove(a)">删除</el-button>
    </el-card>
  </div>
</template>

<style scoped>
.account {
  margin-bottom: 8px;
}
.account :deep(.el-card__body) {
  display: flex;
  gap: 12px;
  align-items: center;
}
.avatar {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  object-fit: cover;
}
.info {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 4px;
}
</style>
