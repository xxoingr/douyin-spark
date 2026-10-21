// 和后端 /api 打交道的函数都在这里。出错时抛出带中文原因的 Error。
async function request(method, path, body) {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.error || `请求失败（${res.status}）`);
  return data;
}

export const api = {
  status: () => request('GET', '/status'),
  accounts: () => request('GET', '/accounts'),
  login: () => request('POST', '/accounts/login'),
  deleteAccount: (accountId) => request('DELETE', `/accounts/${accountId}`),
  refreshFriends: (accountId) => request('POST', `/accounts/${accountId}/friends/refresh`),
  friends: (accountId) => request('GET', `/accounts/${accountId}/friends`),
  setFriendEnabled: (accountId, uid, enabled) => request('PATCH', `/accounts/${accountId}/friends/${uid}`, { enabled }),
  messages: (accountId) => request('GET', `/accounts/${accountId}/messages`),
  addMessage: (accountId, content) => request('POST', `/accounts/${accountId}/messages`, { content }),
  deleteMessage: (messageId) => request('DELETE', `/messages/${messageId}`),
  run: () => request('POST', '/runs'),
  runs: (accountId) => request('GET', `/accounts/${accountId}/runs`),
};

// 账号显示名：没读到昵称时用编号
export const accountName = (account) => account.nickname || `账号 ${account.id}`;
