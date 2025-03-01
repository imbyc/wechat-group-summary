require('dotenv').config();

module.exports = {
  wechaty: {
    puppet: 'wechaty-puppet-wechat',
    token: null,
    reLoginInterval: 300 // 5分钟重试间隔
  },
  deepseek: {
    endpoint: 'https://api.deepseek.com/v1/chat',
    maxContext: 200,
    rateLimit: 30
  },
  db: {
    path: process.env.DB_PATH,
    walMode: true
  },
  logs: {
    level: process.env.LOG_LEVEL || 'info',
    filePath: './data/logs/app.log'
  }
}; 