const { UrlLinkImpl } = require("wechaty/impls");

// 新增消息类型常量
module.exports.MESSAGE_TYPE = Object.freeze({
  TEXT: 'text',
  IMAGE: 'image',
  EMOTICON: 'emoticon',
  VIDEO: 'video',
  SYSTEM: 'system',
  VOICE: 'voice',
  FILE: 'file',
  CARD: 'card',
  LOCATION: 'location',
  LINK: 'link'
}); 