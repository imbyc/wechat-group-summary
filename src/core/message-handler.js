const { Message } = require('wechaty');
const db = require('../utils/db');
const logger = require('../utils/logger');

// 定义消息类型映射，不依赖 Message.Type
const MSG_TYPE_MAP = {
  7: 1,  // Text 文本消息
  6: 2,  // Image 图片消息
  // 其他类型可以根据需要添加
  // 1: 3,  // 联系人卡片
  // 2: 4,  // 语音消息
  // 3: 5,  // 视频消息
  // 4: 6,  // 表情消息
  // 5: 7,  // 位置消息
  // 8: 8,  // 文件消息
};

module.exports = async function handleMessage(msg) {
  if (!msg.room()) return;

  try {
    // 获取消息发送者的微信ID - 修复获取当前用户ID的方式
    const wechatId = msg.wechaty.currentUser.id;
    
    // 获取消息类型，并根据映射转换
    const msgType = msg.type();
    const mappedType = MSG_TYPE_MAP[msgType] || 0;
    
    logger.debug(`收到消息类型: ${msgType}, 映射为: ${mappedType}`);
    
    // 插入消息时同时记录微信ID
    await db.run(
      `INSERT OR IGNORE INTO messages (
        room_id, msg_id, sender_id, sender_name, content, 
        msg_time, msg_type, is_at_me, wechat_id,
        created_at, updated_at
      ) VALUES (
        ?,?,?,?,?,?,?,?,?,
        CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      [
        msg.room().id,
        msg.id,
        msg.talker().id,
        msg.talker().name(),
        msg.text(),
        new Date(msg.date()).toISOString(),
        mappedType,
        await msg.mentionSelf() ? 1 : 0,
        wechatId
      ]
    );

    // 触发总结条件判断
    if (msg.text().trim() === '#总结' && await msg.mentionSelf()) {
      require('./summary-generator')(msg.room().id, wechatId);
    }
  } catch (error) {
    logger.error('消息处理失败:', error);
  }
}; 