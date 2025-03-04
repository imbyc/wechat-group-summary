require('dotenv').config();

module.exports = {
  wechaty: {
    puppet: 'wechaty-puppet-xp',
    token: null,
    reLoginInterval: 300 // 5分钟重试间隔
  },
  siliconflow: {
    endpoint: 'https://api.siliconflow.cn/v1',
    apiKey: process.env.SILICONFLOW_API_KEY,
    model: 'deepseek-ai/DeepSeek-R1', // 或 Distill 版本
    maxContext: 200,
    rateLimit: 30
  },
  db: {
    path: process.env.DB_PATH,
    walMode: process.env.DB_WAL_MODE === 'true'
  },
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: './data/logs/app.log'
  },
  wechatMonitor: {
    wechatPath: process.env.WECHAT_PATH || 'C:\\Program Files (x86)\\Tencent\\WeChat\\WeChat.exe',
    pythonPath: process.env.PYTHON_PATH || 'python',
    versionScriptPath: process.env.VERSION_SCRIPT_PATH || './change_version.py',
    checkInterval: parseInt(process.env.WECHAT_CHECK_INTERVAL || '30000'),
    maxRetries: parseInt(process.env.WECHAT_MAX_RETRIES || '3')
  },
  sync: {
    delay: 3000,         // 3秒延迟
    heartbeatInterval: 5 // 秒
  }
}; 