const db = require('./src/utils/db');
const config = require('./src/config');
const fs = require('fs').promises;
const path = require('path');

// 完整系统提示词（来自 summary-generator.js）
const SYSTEM_PROMPT = `你是一个专业的群聊分析师，请根据提供的群聊记录生成结构化总结。要求：
1. 按以下格式组织内容：
   【群聊精华总结】
   - 日期范围：{start_date} 至 {end_date}
   - 总消息量：{total_messages}条
   
2. 核心话题分析（3-5个）：
   ● 话题1标题（参与人数：X）
     - 核心观点
     - 主要讨论时段
     - 关键参与者：@用户A @用户B
     
3. 趣味互动片段：
   👉 {有趣对话摘要}
   👉 {表情包使用情况}
   
4. 重要信息归档：
   - 分享链接：{重要链接}
   - 文件资料：{重要文件}
   
5. 待跟进事项：
   - [待处理] @某人 需要提交的内容
   - [已确认] 下周会议时间

请使用自然的口语化中文，采用以下增强要求：
- 使用emoji适当分隔章节
- 关键数据用【】标出
- 涉及人员使用@提及
- 时间精确到小时（例如：03-15 14:00）`;

async function generateTestPrompt(roomId) {
    await db.connect(config.db.path);
    
    // 获取群组信息（对应代码行 26-32）
    const group = await db.get(`
        SELECT * FROM groups 
        WHERE room_id = ?`, 
        [roomId]
    );
    
    if (!group) {
        console.error('群组不存在');
        return;
    }

    // 获取消息记录（对应代码行 40-46）
    const messages = await db.all(`
        SELECT * FROM messages 
        WHERE room_id = ?
        AND msg_type = 'text'
        ORDER BY msg_time`,
        [roomId]
    );

    // 生成提示词（对应代码行 7-14, 17-22）
    const userPrompt = `请分析【${group.name}】的群聊记录，时间范围：${
        messages[0].msg_time} 至 ${messages[messages.length-1].msg_time
    }，共${messages.length}条消息：\n\n${
        messages.map(m => `[${m.msg_time}] ${m.sender_name}: ${m.content}`).join('\n')
    }`;

    // 构造请求参数（对应代码行 67-74）
    const requestPayload = {
        messages: [
            { role: "system", content: SYSTEM_PROMPT },
            { role: "user", content: userPrompt }
        ],
        model: "deepseek-ai/DeepSeek-R1",
        temperature: 0.3
    };

    console.log("API 请求参数：");
    console.log(JSON.stringify(requestPayload, null, 2));
    console.log("\nAPI 端点：", config.siliconflow.endpoint + "/chat/completions");
    console.log("请求头需包含：Authorization: Bearer [你的API密钥]");

    // 生成文件名
    const filename = `request_${roomId.replace(/[@]/g, '_')}.json`;
    const outputPath = path.join(__dirname, filename);

    // 构造完整请求对象
    const apiRequest = {
        url: `${config.siliconflow.endpoint}/chat/completions`,
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": "Bearer ${API_KEY}"  // 需要用户自行替换
        },
        body: requestPayload
    };

    // 写入文件
    await fs.writeFile(outputPath, JSON.stringify(apiRequest, null, 2));
    console.log(`请求文件已保存至: ${outputPath}`);
}

// 使用示例
generateTestPrompt('20731004658@chatroom').catch(console.error);
