<script setup>
import { inject, onMounted, onUnmounted, ref, watch } from 'vue';
import { api } from '../api.js';

const status = inject('status');
const finishedCount = inject('finishedCount');
const accountId = inject('accountId');
const runs = ref([]);

async function load() {
  runs.value = accountId.value ? await api.runs(accountId.value) : [];
}
onMounted(load);
watch([finishedCount, accountId], load);

// 发送进行中时每 3 秒刷新一次，能看到一个个好友的结果陆续出来
let timer;
onMounted(() => {
  timer = setInterval(() => {
    if (status.value.current?.name === '发送') load().catch(() => {});
  }, 3000);
});
onUnmounted(() => clearInterval(timer));

const RESULT = {
  success: { text: '成功', type: 'success' },
  skipped: { text: '跳过', type: 'info' },
  failed: { text: '失败', type: 'danger' },
};
const RUN_STATUS = {
  running: { text: '进行中', type: 'warning' },
  done: { text: '已完成', type: 'success' },
  failed: { text: '出错', type: 'danger' },
};

const time = (iso) => new Date(iso).toLocaleString('zh-CN', { hour12: false });
const count = (run, result) => run.sends.filter((s) => s.status === result).length;
</script>

<template>
  <div>
    <el-empty v-if="!runs.length" description="还没有运行过，点右上角“立即发送”试试" />
    <el-collapse v-else>
      <el-collapse-item v-for="run in runs" :key="run.id" :name="run.id">
        <template #title>
          <div class="run-title">
            <span>{{ time(run.started_at) }}</span>
            <el-tag :type="RUN_STATUS[run.status].type" size="small">{{ RUN_STATUS[run.status].text }}</el-tag>
            <span class="hint">成功 {{ count(run, 'success') }} · 跳过 {{ count(run, 'skipped') }} · 失败 {{ count(run, 'failed') }}</span>
          </div>
        </template>
        <el-alert v-if="run.error" :title="run.error" type="error" :closable="false" show-icon />
        <el-table :data="run.sends" size="small">
          <el-table-column prop="friend_title" label="好友" min-width="160" />
          <el-table-column label="结果" width="80">
            <template #default="{ row }">
              <el-tag :type="RESULT[row.status].type" size="small">{{ RESULT[row.status].text }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="content" label="内容" min-width="140" />
          <el-table-column prop="detail" label="说明" min-width="160" />
        </el-table>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<style scoped>
.run-title {
  display: flex;
  gap: 10px;
  align-items: center;
}
</style>
