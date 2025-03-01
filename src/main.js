const SummaryBot = require('./core/bot');
const logger = require('./utils/logger');
const db = require('./utils/db');
const config = require('./config');

async function bootstrap() {
  // 初始化数据库连接
  await db.connect(config.db.path);

  // 启动机器人
  const bot = new SummaryBot();
  await bot.start();

  logger.info('服务已成功启动');
}

process.on('SIGINT', async () => {
  await db.close();
  // 这里可能需要定义 bot 变量
  // await bot.stop();
  process.exit(0);
});

bootstrap().catch(err => {
  logger.error('启动失败:', err);
  process.exit(1);
}); 