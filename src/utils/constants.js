// 新增消息类型常量
module.exports.MESSAGE_TYPE = Object.freeze({
  TEXT: { code: 1, name: 'TEXT' },
  IMAGE: { code: 2, name: 'IMAGE' },
  EMOTICON: { code: 3, name: 'EMOTICON' },
  VIDEO: { code: 4, name: 'VIDEO' },
  LOCATION: { code: 5, name: 'LOCATION' },
  FILE: { code: 7, name: 'FILE' },
  CARD: { code: 8, name: 'CARD' },
  SYSTEM: { code: 5, name: 'SYSTEM' },
  VOICE: { code: 6, name: 'VOICE' }
}); 