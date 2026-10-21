<script setup>
import { inject, onMounted, ref, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { api } from '../api.js';

const accountId = inject('accountId');
const messages = ref([]);
const draft = ref('');

async function load() {
  messages.value = accountId.value ? await api.messages(accountId.value) : [];
}
onMounted(load);
watch(accountId, load);

async function add() {
  try {
    await api.addMessage(accountId.value, draft.value);
    draft.value = '';
    await load();
  } catch (err) {
    ElMessage.error(err.message);
  }
}

async function remove(id) {
  await api.deleteMessage(id);
  await load();
}
</script>

<template>
  <div>
    <el-empty v-if="!accountId" description="还没有账号，先到“账号”页扫码添加" />
    <template v-else>
      <div class="toolbar">
        <el-input v-model="draft" placeholder="输入一条消息，比如：早安 ☀️" maxlength="200" style="max-width: 420px" @keyup.enter="add" />
        <el-button type="primary" @click="add">添加</el-button>
        <span class="hint">这个账号发送时从这里随机挑一条</span>
      </div>

      <el-empty v-if="!messages.length" description="还没有消息模板，至少添加一条才能发送" />
      <el-table v-else :data="messages" row-key="id">
        <el-table-column prop="content" label="消息内容" />
        <el-table-column width="90" align="center">
          <template #default="{ row }">
            <el-button link type="danger" @click="remove(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>
</template>
