const { Message } = require('wechaty');
const db = require('../utils/db');
const logger = require('../utils/logger');

const MSG_TYPE_MAP = {
  [Message.Type.Text]: 1,
  [Message.Type.Image]: 2,
  // ...其他类型映射
};

module.exports = async function handleMessage(msg) {
  if (!msg.room()) return;

  try {
    await db.run(
      `INSERT OR IGNORE INTO messages VALUES (
        NULL,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP
      )`,
      [
        msg.room().id,
        msg.id,
        msg.talker().id,
        msg.talker().name(),
        msg.text(),
        new Date(msg.date()).toISOString(),
        MSG_TYPE_MAP[msg.type()],
        await msg.mentionSelf() ? 1 : 0
      ]
    );

    // 触发总结条件判断
    if (msg.text().trim() === '#总结' && await msg.mentionSelf()) {
      require('./summary-generator')(msg.room().id);
    }
  } catch (error) {
    logger.error('消息处理失败:', error);
  }
}; 