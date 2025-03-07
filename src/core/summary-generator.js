const db = require('../utils/db');
const logger = require('../utils/logger');
const config = require('../config');
const axios = require('axios');

// 系统提示词模板
const SYSTEM_PROMPT = `你是一个专业的群聊分析师，请根据提供的群聊记录生成结构化总结。要求：
1. 按【群聊精华总结】格式组织内容
2. 识别3-5个主要话题，按热度排序
3. 每个话题包含时间范围、内容摘要和简要点评
4. 提取趣味互动片段
5. 列出提到的工具/观点
6. 记录待跟进事项
7. 使用自然的口语化中文`;

// 生成用户提示词
function buildUserPrompt(messages, groupName) {
  const messageTexts = messages.map(m => 
    `[${m.msg_time}] ${m.sender_name}: ${m.content}`
  ).join('\n');

  return `请分析【${groupName}】的群聊记录，时间范围：${messages[0].msg_time} 至 ${messages[messages.length-1].msg_time}，共${messages.length}条消息：\n\n${messageTexts}`;
}

async function generateSummary(roomId, wechatId) {
  try {
    // 获取群组信息
    const group = await db.get(`
      SELECT * FROM groups 
      WHERE room_id = ? AND wechat_id = ?`, 
      [roomId, wechatId]
    );

    if (!group) {
      logger.error(`群组不存在: ${roomId}`);
      return;
    }

    // 获取需要总结的消息
    const messages = await db.all(`
      SELECT * FROM messages 
      WHERE room_id = ? AND wechat_id = ?
      ${group.last_summary_time ? 'AND msg_time > ?' : ''}
      ORDER BY msg_time`,
      group.last_summary_time ? [roomId, wechatId, group.last_summary_time] : [roomId, wechatId]
    );

    if (messages.length === 0) {
      logger.info(`没有新消息需要总结: ${group.name}`);
      return;
    }

    // 在API调用前添加请求日志
    logger.debug('准备调用DeepSeek API', {
      model: config.siliconflow.model,
      messageCount: messages.length,
      timeRange: `${messages[0].msg_time} ~ ${messages[messages.length-1].msg_time}`
    });

    // 记录完整的提示词内容
    const systemPrompt = SYSTEM_PROMPT;
    const userPrompt = buildUserPrompt(messages, group.name);
    logger.debug('系统提示词:', systemPrompt.substring(0, 200) + '...'); // 截取前200字符
    logger.debug('用户提示词:', userPrompt.substring(0, 500) + '...'); // 截取前500字符

    // 调用API时添加请求参数记录
    const requestPayload = {
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      model: config.siliconflow.model,
      temperature: 0.3
    };
    logger.debug('完整请求参数:', JSON.stringify(requestPayload, null, 2));

    // 调用DeepSeek API
    const response = await axios.post(
      `${config.siliconflow.endpoint}/chat/completions`,
      requestPayload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${config.siliconflow.apiKey}`
        }
      }
    );

    const summaryText = response.data.choices[0].message.content;

    // 存储总结结果
    await db.transaction(async () => {
      // 更新群组最后总结时间
      await db.run(`
        UPDATE groups SET last_summary_time = ?
        WHERE id = ?`,
        [new Date().toISOString(), group.id]
      );

      // 插入总结记录
      await db.run(`
        INSERT INTO summaries (
          room_id, summary_hash, summary_text, 
          start_time, end_time, wechat_id
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [
          roomId,
          createSummaryHash(summaryText),
          summaryText,
          messages[0].msg_time,
          messages[messages.length-1].msg_time,
          wechatId
        ]
      );
    });

    logger.info(`群组总结生成成功: ${group.name}`);
    return summaryText;

  } catch (error) {
    const errorData = {
      request: {
        messageCount: messages.length,
        timeRange: messages.length > 0 ? 
          `${messages[0].msg_time} ~ ${messages[messages.length-1].msg_time}` : '无消息',
        promptPreview: messages.length > 0 ? 
          messages.slice(0, 3).map(m => m.content) : []
      },
      response: error.response ? {
        status: error.response.status,
        data: error.response.data
      } : null,
      errorMessage: error.message
    };
    
    logger.error('生成总结失败详情:', JSON.stringify(errorData, null, 2));
    throw error;
  }
}

// 生成简易哈希用于去重
function createSummaryHash(text) {
  return require('crypto')
    .createHash('md5')
    .update(text)
    .digest('hex');
}

module.exports = generateSummary; 