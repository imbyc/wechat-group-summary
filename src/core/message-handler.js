const { Message } = require('wechaty');
const db = require('../utils/db');
const logger = require('../utils/logger');
const { MESSAGE_TYPE } = require('../utils/constants');

const MSG_TYPE_MAP = {
  7: MESSAGE_TYPE.TEXT,      // 文本
  6: MESSAGE_TYPE.IMAGE,     // 图片
  3: MESSAGE_TYPE.VIDEO,     // 视频
  5: MESSAGE_TYPE.EMOTICON,  // 表情
  49: MESSAGE_TYPE.SYSTEM,   // 系统消息
  2: MESSAGE_TYPE.VOICE,     // 语音
  8: MESSAGE_TYPE.FILE,      // 文件
  42: MESSAGE_TYPE.CARD,     // 联系人卡片
  13: MESSAGE_TYPE.LOCATION,  // 位置
  14: MESSAGE_TYPE.LINK,      // 第三方应用分享
};

// 获取发送者昵称，添加默认值和错误处理
const getSenderName = async (msg) => {
  try {
    const talker = msg.talker();
    // 先尝试获取群昵称
    let name = await msg.room()?.alias(talker) || '';
    
    // 如果没有群昵称，获取好友昵称
    if (!name) {
      name = talker.name() || '';
    }
    
    // 如果还是没有，使用微信ID
    return name || talker.id || '未知用户';
  } catch (err) {
    logger.warn(`获取用户昵称失败: ${err.message}`);
    return '未知用户';
  }
};

module.exports = async function handleMessage(msg) {
  if (!msg.room()) return;

  try {
    // 获取消息发送者的微信ID - 修复获取当前用户ID的方式
    const wechatId = msg.wechaty.currentUser.id;
    
    // 获取消息类型，并根据映射转换
    const msgType = msg.type();
    const mappedType = MSG_TYPE_MAP[msgType] || msgType; // 未知类型直接用原生类型
    
    logger.debug(`收到原生类型[${msgType}] => 映射为[${mappedType}]，原始内容: ${msg.text().substring(0, 50)}`);
    
    if (msgType === 13) {
      logger.warn('收到位置消息，内容:', await msg.toFileBox()); // 位置消息通常包含缩略图
    }
    
    // 获取发送者昵称，添加默认值和错误处理
    const senderName = await getSenderName(msg);

    // 修改后的插入逻辑
    const result = await db.run(
      `INSERT OR REPLACE INTO messages (
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
        senderName,
        msg.text(),
        new Date(msg.date()).toISOString(),
        mappedType,
        await msg.mentionSelf() ? 1 : 0,
        wechatId
      ]
    );

    // 新增调试日志
    if (result.changes === 0) {
      logger.debug(`消息已存在，跳过插入 (msg_id: ${msg.id})`);
    } else {
      logger.debug(`新消息插入成功，ID: ${result.lastID} (msg_id: ${msg.id})`);
    }

    // 触发总结条件判断
    if (msg.text().includes('总结') && await msg.mentionSelf()) {
      const generator = require('./summary-generator');
      try {
        const summary = await generator(msg.room().id, wechatId);
        await msg.say(summary); // 将总结发回群聊
      } catch (err) {
        await msg.say('总结生成失败，请稍后再试');
      }
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