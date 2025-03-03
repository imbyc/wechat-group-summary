const SummaryBot = require('./core/bot');
const logger = require('./utils/logger');
const db = require('./utils/db');
const config = require('./config');

let bot; // 全局变量存储机器人实例

async function bootstrap() {
  // 初始化数据库连接
  await db.connect(config.db.path);

  // 启动机器人
  const summaryBot = new SummaryBot();
  bot = await summaryBot.start();

  logger.info('服务已成功启动');
}

process.on('SIGINT', async () => {
  logger.info('正在关闭服务...');
  await db.close();
  if (bot) {
    await bot.stop();
    logger.info('机器人已停止');
  }
  process.exit(0);
});

bootstrap().catch(err => {
  logger.error('启动失败:', err);
  process.exit(1);
}); 