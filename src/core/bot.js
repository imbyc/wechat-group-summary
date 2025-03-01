const { WechatyBuilder } = require('wechaty');
// const { PuppetPadlocal } = require('wechaty-puppet-padlocal');
const config = require('../config');
const logger = require('../utils/logger');

class SummaryBot {
  constructor() {
    this.bot = WechatyBuilder.build({
      puppet: config.wechaty.puppet,
      name: 'GroupSummaryBot'
    });
  }

  async start() {
    this.bot
      .on('scan', this.onScan)
      .on('login', this.onLogin)
      .on('message', this.onMessage)
      .on('error', this.onError);

    await this.bot.start();
  }

  onScan(qrcode) {
    logger.info(`扫码登录URL：https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`);
  }

  onLogin(user) {
    logger.info(`用户 ${user} 登录成功`);
  }

  async onMessage(msg) {
    // 消息处理逻辑
  }

  onError(error) {
    logger.error('机器人运行错误:', error);
  }
}

module.exports = SummaryBot; 