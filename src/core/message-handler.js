const { Message } = require('wechaty');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { MESSAGE_TYPE } = require('../utils/constants');

// 微信XP协议 v1.13.12 实际消息类型号
const MSG_TYPE_MAP = {
  7: MESSAGE_TYPE.TEXT,     // 文本
  6: MESSAGE_TYPE.IMAGE,    // 图片
  3: MESSAGE_TYPE.VIDEO,    // 视频
  5: MESSAGE_TYPE.EMOTICON,// 表情
  49: MESSAGE_TYPE.SYSTEM,   // 系统消息
  2: MESSAGE_TYPE.VOICE,    // 语音
  8: MESSAGE_TYPE.FILE,     // 文件
  42: MESSAGE_TYPE.CARD,     // 联系人卡片
  13: MESSAGE_TYPE.LOCATION, // 新增位置消息映射
};

module.exports = async function handleMessage(msg) {
  if (!msg.room()) return;

  try {
    // 获取消息发送者的微信ID - 修复获取当前用户ID的方式
    const wechatId = msg.wechaty.currentUser.id;
    
    // 获取消息类型，并根据映射转换
    const msgType = msg.type();
    const mappedType = MSG_TYPE_MAP[msgType] || 0;
    
    logger.debug(`收到原生类型[${msgType}] => 映射为[${mappedType.name}]，原始内容: ${msg.text().substring(0, 50)}`);
    
    if (msgType === 13) {
      logger.warn('收到位置消息，内容:', await msg.toFileBox()); // 位置消息通常包含缩略图
    }
    
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

async function syncHistoryMessages() {
  if (!this.currentUser) return;
  
  const wechatId = this.currentUser.id;
  const roomList = await this.bot.Room.findAll();
  
  for (const room of roomList) {
    try {
      let lastMessage = await db.get(
        `SELECT msg_time FROM messages 
         WHERE room_id = ? AND wechat_id = ?
         ORDER BY msg_time DESC LIMIT 1`,
        [room.id, wechatId]
      );
      
      const since = lastMessage ? new Date(lastMessage.msg_time) : new Date(0);
      
      // 获取历史消息（微信协议限制，可能只能获取近期消息）
      const history = await room.messages({ since });
      
      for (const msg of history) {
        // 复用现有的消息处理逻辑
        const handleMessage = require('./message-handler');
        await handleMessage(msg);
      }
      
      logger.info(`已同步 ${history.length} 条历史消息 - ${await room.topic()}`);
    } catch (err) {
      logger.error(`同步历史消息失败 [${room.id}]:`, err);
    }
  }
} 