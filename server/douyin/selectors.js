// 抖音页面的地址和选择器集中放在这里，抖音改版时只需要改这一个文件。

export const CHAT_URL = 'https://www.douyin.com/chat';

// 会话列表中的一行。它的 React 属性里挂着抖音 IM SDK 的会话对象。
export const CONVERSATION_ITEM = '[data-e2e="conversation-item"]';
// 外层还有一个 ...ItemtitleWrapper（里面带着时间），要排除掉
export const CONVERSATION_TITLE = '[class*="conversationConversationItemtitle"]:not([class*="Wrapper"])';

// 右侧聊天头部，React 属性里的 curConversation 是当前打开的会话
export const CHAT_HEADER = '[class*="RightPanelHeaderconvHeader"]';
export const MESSAGE_INPUT = '[data-e2e="msg-input"]';
