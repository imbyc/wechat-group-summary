const { spawn, exec } = require('child_process');
const path = require('path');
const logger = require('./logger');
const fs = require('fs');

class WechatMonitor {
  constructor(config = {}) {
    this.wechatPath = config.wechatPath || 'C:\\Program Files (x86)\\Tencent\\WeChat\\WeChat.exe';
    this.pythonPath = config.pythonPath || 'python';
    this.versionScriptPath = config.versionScriptPath || path.join(process.cwd(), 'change_version.py');
    this.checkInterval = config.checkInterval || 30000; // 30秒检查一次
    this.maxRetries = config.maxRetries || 3;
    this.retryCount = 0;
    this.wechatProcess = null;
    this.intervalId = null;
    this.onWechatRestart = config.onWechatRestart || (() => {});
    this.wechatStartTime = null;
    this.loginTimeout = config.loginTimeout || 300000; // 5分钟登录超时
    this.isLoginComplete = false;
  }

  /**
   * 检查微信进程是否在运行
   * @returns {Promise<boolean>}
   */
  async isWechatRunning() {
    return new Promise((resolve) => {
      // Windows上使用tasklist检查进程
      exec('tasklist /fi "imagename eq WeChat.exe" /fo csv /nh', (error, stdout) => {
        if (error) {
          logger.error(`检查微信进程失败: ${error.message}`);
          resolve(false);
          return;
        }
        
        // 如果输出中包含WeChat.exe，则表示进程在运行
        const isRunning = stdout.includes('WeChat.exe');
        logger.debug(`微信进程状态: ${isRunning ? '运行中' : '未运行'}`);
        resolve(isRunning);
      });
    });
  }

  /**
   * 启动微信
   * @returns {Promise<boolean>}
   */
  async startWechat() {
    logger.info('正在启动微信...');
    
    return new Promise((resolve) => {
      try {
        // 确保WeChat.exe存在
        if (!fs.existsSync(this.wechatPath)) {
          logger.error(`微信可执行文件不存在: ${this.wechatPath}`);
          resolve(false);
          return;
        }
        
        // 启动微信进程
        this.wechatProcess = spawn(this.wechatPath, [], {
          detached: true,
          stdio: 'ignore'
        });
        
        // 分离子进程，让它独立运行
        this.wechatProcess.unref();
        
        logger.info('微信启动命令已执行');
        
        // 添加记录启动时间
        this.wechatStartTime = Date.now();
        this.isLoginComplete = false;
        
        // 等待5秒确保微信有足够时间启动
        setTimeout(async () => {
          const running = await this.isWechatRunning();
          if (running) {
            logger.info('微信已成功启动');
            resolve(true);
          } else {
            logger.error('微信启动失败');
            resolve(false);
          }
        }, 5000);
      } catch (error) {
        logger.error(`启动微信时出错: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * 运行版本修改脚本
   * @returns {Promise<boolean>}
   */
  async runVersionScript() {
    logger.info(`正在运行微信版本修改脚本... Python路径: ${this.pythonPath}, 脚本路径: ${this.versionScriptPath}`);
    
    return new Promise((resolve) => {
      try {
        // 确保脚本文件存在
        if (!fs.existsSync(this.versionScriptPath)) {
          logger.error(`版本修改脚本不存在: ${this.versionScriptPath}`);
          resolve(false);
          return;
        }
        
        // 使用exec执行Python脚本
        const command = `"${this.pythonPath}" "${this.versionScriptPath}"`;
        exec(command, (error, stdout, stderr) => {
          if (error) {
            logger.error(`版本修改脚本执行失败: ${error.message}`);
            resolve(false);
            return;
          }
          
          if (stderr) {
            logger.error(`版本修改脚本错误: ${stderr}`);
          }
          
          logger.info(`版本修改脚本执行成功: ${stdout.trim()}`);
          resolve(true);
        });
      } catch (error) {
        logger.error(`运行版本修改脚本时出错: ${error.message}`);
        resolve(false);
      }
    });
  }

  /**
   * 重启微信和版本修改
   * @returns {Promise<boolean>}
   */
  async restartWechat() {
    this.retryCount++;
    logger.info(`正在尝试重启微信 (尝试 ${this.retryCount}/${this.maxRetries})...`);
    
    try {
      // 确保微信已关闭
      await this.killWechat();
      
      // 等待一秒让进程完全退出
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 启动微信
      const wechatStarted = await this.startWechat();
      if (!wechatStarted) {
        logger.error('无法启动微信');
        return false;
      }
      
      // 等待微信完全启动
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // 运行版本修改脚本
      const versionChanged = await this.runVersionScript();
      if (!versionChanged) {
        logger.error('无法修改微信版本');
        return false;
      }
      
      // 重置重试计数
      this.retryCount = 0;
      
      // 调用重启回调
      this.onWechatRestart();
      
      return true;
    } catch (error) {
      logger.error(`重启微信过程中出错: ${error.message}`);
      return false;
    }
  }

  /**
   * 强制关闭微信进程
   * @returns {Promise<void>}
   */
  async killWechat() {
    logger.info('正在关闭微信进程...');
    
    return new Promise((resolve) => {
      exec('taskkill /f /im WeChat.exe', (error) => {
        if (error) {
          // 忽略错误，可能是因为进程已不存在
          logger.debug(`关闭微信进程: ${error.message}`);
        } else {
          logger.info('微信进程已关闭');
        }
        resolve();
      });
    });
  }

  /**
   * 开始监控微信进程
   */
  start() {
    if (this.intervalId) {
      logger.warning('微信监控已在运行中');
      return;
    }
    
    logger.info('开始监控微信进程');
    
    // 立即检查一次
    this.check();
    
    // 设置定期检查
    this.intervalId = setInterval(() => this.check(), this.checkInterval);
  }

  /**
   * 停止监控
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      logger.info('已停止微信进程监控');
    }
  }

  /**
   * 检查微信是否运行，如果没有则尝试重启
   */
  async check() {
    try {
      const isRunning = await this.isWechatRunning();
      
      if (!isRunning) {
        logger.warning('检测到微信未运行');
        
        if (this.retryCount < this.maxRetries) {
          await this.restartWechat();
        } else {
          logger.error(`已达到最大重试次数 (${this.maxRetries})，停止自动重启`);
          this.stop();
        }
      } else if (this.retryCount > 0) {
        // 如果微信正在运行，重置重试计数
        this.retryCount = 0;
      }
    } catch (error) {
      logger.error(`检查微信进程时出错: ${error.message}`);
    }
  }

  // 添加一个方法来标记登录完成
  setLoginComplete() {
    logger.info('微信登录已完成，停止监控循环');
    this.isLoginComplete = true;
    // 清除定时器，停止监控
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }
  
  // 修改检查逻辑，检测登录超时
  async checkWechatProcess() {
    try {
      const isRunning = await this.isWechatRunning();
      
      if (isRunning) {
        logger.info('微信进程状态: 运行中');
        
        // 检查是否已经超过登录超时时间
        if (this.wechatStartTime && !this.isLoginComplete) {
          const now = Date.now();
          const elapsed = now - this.wechatStartTime;
          
          if (elapsed > this.loginTimeout) {
            logger.warn(`微信登录超时(${this.loginTimeout / 60000}分钟)，重新启动微信`);
            await this.restartWechat();
          }
        }
      } else {
        logger.info('微信进程状态: 未运行');
        await this.restartWechat();
      }
    } catch (error) {
      logger.error(`检查微信进程时出错: ${error.message}`);
    }
  }
}

module.exports = WechatMonitor; 