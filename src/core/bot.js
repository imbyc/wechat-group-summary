const { WechatyBuilder } = require('wechaty');
const { PuppetXp } = require('wechaty-puppet-xp');
const config = require('../config');
const logger = require('../utils/logger');
const db = require('../utils/db');
const WechatMonitor = require('../utils/wechat-monitor');

class SummaryBot {
  constructor() {
    // 创建微信监控实例
    this.wechatMonitor = new WechatMonitor({
      ...config.wechatMonitor,  // 展开配置对象
      onWechatRestart: async () => {
        logger.info('微信已重启，尝试重新启动机器人');
        // 如果机器人已在运行，先停止
        if (this.bot) {
          try {
            await this.bot.stop();
          } catch (err) {
            logger.error('停止机器人失败:', err.message);
            // 继续尝试创建新实例
          }
        }
        // 重新创建puppet和bot
        this.initBot();
        // 重新启动机器人
        await this.start();
      }
    });
    
    // 初始化机器人
    this.initBot();
    this.currentUser = null;

    this.syncProgress = {
      current: 0,
      total: 1 // 移除历史消息同步任务，只保留群组信息同步
    };
  }
  
  initBot() {
    try {
      // 简化配置，专注于稳定性
      const puppet = new PuppetXp({
        uos: true,
        timeout: 300000,
        memory: {
          maxSize: "2048mb",
          path: "./memory_cache"
        }
      });
      
      this.bot = WechatyBuilder.build({
        puppet: puppet,
        name: 'GroupSummaryBot'
      });
    } catch (err) {
      logger.error(`初始化机器人失败: ${err.message}`);
      throw err;
    }
    
    // 添加登录事件处理
    this.bot.on('login', async (user) => {
      logger.info(`机器人登录成功: ${user.name()}`);
      // 设置登录完成，停止微信监控循环
      this.wechatMonitor.setLoginComplete();
    });
  }

  async start() {
    // 启动微信监控
    this.wechatMonitor.start();
    
    // 使用传统的事件绑定方式，避免箭头函数造成的上下文问题
    this.bot.on('scan', (qrcode) => {
      logger.info(`扫码登录URL：https://wechaty.js.org/qrcode/${encodeURIComponent(qrcode)}`);
    });
    
    this.bot.on('login', (user) => {
      logger.info(`用户 ${user} 登录成功`);
      this.currentUser = user;

      // 使用块级作用域变量
      let remainingTime = 3;
      logger.info(`准备同步数据（${remainingTime}秒后开始）...`);

      const syncTimer = setInterval(() => {
        remainingTime -= 1;
        if (remainingTime > 0) {
          logger.info(`倒计时 ${remainingTime} 秒后开始同步...`);
        }
      }, 1000);

      setTimeout(async () => {
        clearInterval(syncTimer);
        try {
          // 添加进程异常捕获
          process.on('unhandledRejection', (reason) => {
            logger.error('未处理的Promise拒绝:', reason);
          });
          
          logger.info('开始同步群组信息...');
          await this.syncRoomList();
          
          logger.info('开始验证数据库写入...');
          const testRecord = await db.get("SELECT COUNT(*) AS count FROM messages");
          logger.info(`当前消息记录数: ${testRecord.count}`);
        } catch (err) {
          logger.error('同步过程中发生致命错误:', err.stack); // 打印完整堆栈
          process.exit(1); // 明确退出进程
        }
      }, 3000);
    });
    
    this.bot.on('message', (msg) => {
      try {
        const handleMessage = require('./message-handler');
        handleMessage(msg).catch(err => {
          logger.error('处理消息失败:', err);
        });
      } catch (err) {
        logger.error('加载消息处理模块失败:', err);
      }
    });
    
    this.bot.on('error', (error) => {
      logger.error('机器人运行错误:', error);
      // 不抛出错误，允许程序继续运行
    });
    
    // 各种群聊事件处理
    this.bot.on('room-join', (room, inviteeList, inviter) => {
      this.onRoomJoin(room, inviteeList, inviter).catch(err => {
        logger.error('处理加入群聊事件失败:', err);
      });
    });
    
    this.bot.on('room-leave', (room, leaverList) => {
      this.onRoomLeave(room, leaverList).catch(err => {
        logger.error('处理离开群聊事件失败:', err);
      });
    });
    
    this.bot.on('room-topic', (room, newTopic, oldTopic, changer) => {
      this.onRoomTopic(room, newTopic, oldTopic, changer).catch(err => {
        logger.error('处理群名称变化事件失败:', err);
      });
    });

    try {
      logger.info('正在启动机器人...');
      await this.bot.start();
      logger.info('机器人启动成功');
      return this.bot;
    } catch (err) {
      logger.error(`机器人启动失败: ${err.message}`);
      
      // 检查是否是因为微信进程问题导致的启动失败
      if (err.message.includes('Process not found') || 
          err.message.includes('Timeout')) {
        logger.info('尝试重启微信...');
        await this.wechatMonitor.restartWechat();
      }
      
      throw err;
    }
  }

  async stop() {
    // 停止微信监控
    this.wechatMonitor.stop();
    
    // 停止机器人
    if (this.bot) {
      try {
        await this.bot.stop();
        logger.info('机器人已停止');
      } catch (err) {
        logger.error(`停止机器人失败: ${err.message}`);
      }
    }
  }

  async syncRoomList(isFullSync = false) {
    try {
      const rooms = await this.bot.Room.findAll();
      this.syncProgress.current++;
      
      // 检查是否需要全量同步
      const lastSync = await db.get(
        `SELECT * FROM sync_logs 
         WHERE wechat_id = ? AND type = 'group'
         ORDER BY sync_time DESC LIMIT 1`,
        [this.currentUser.id]
      );

      // 增量同步条件：非全量同步且存在7天内成功记录
      if (!isFullSync && lastSync && 
          new Date(lastSync.sync_time) > Date.now() - 7*24*60*60*1000) {
        logger.info('7天内已有同步记录，跳过全量同步');
        return;
      }

      this.syncProgress.total++;
      logger.info(`[${this.syncProgress.current}/${this.syncProgress.total}] 发现 ${rooms.length} 个群组`);
      if (!this.currentUser) {
        logger.error('尚未登录，无法同步群组信息');
        return;
      }

      const wechatId = this.currentUser.id;
      logger.info(`开始同步微信账号 ${wechatId} 的群组信息`);
      
      // 使用事务进行批量更新
      await db.transaction(async () => {
        // 获取当前数据库中该微信号的所有群组
        const existingRooms = await db.all(
          `SELECT room_id FROM groups WHERE wechat_id = ?`, 
          [wechatId]
        );
        const existingRoomIds = new Set(existingRooms.map(r => r.room_id));
        
        // 更新或插入群组信息
        for (const room of rooms) {
          const roomId = room.id;
          const roomName = await room.topic();
          const memberCount = (await room.memberAll()).length;
          
          if (existingRoomIds.has(roomId)) {
            await db.run(
              `UPDATE groups SET 
               name = ?, 
               member_count = ?,
               updated_at = CURRENT_TIMESTAMP
               WHERE room_id = ? AND wechat_id = ?`,
              [roomName, memberCount, roomId, wechatId]
            );
          } else {
            await db.run(
              `INSERT INTO groups 
               (room_id, wechat_id, name, member_count, is_managed) 
               VALUES (?, ?, ?, ?, 1)`,
              [roomId, wechatId, roomName, memberCount]
            );
          }
          
          logger.info(`已同步群组: ${roomName}`);
        }
      });
      
      logger.info(`微信账号 ${wechatId} 的群组信息同步完成`);

      // 记录同步状态
      await db.run(
        `INSERT INTO sync_logs (wechat_id, type, status)
         VALUES (?, 'group', 'completed')`,
        [this.currentUser.id]
      );
    } catch (err) {
      await db.run(
        `INSERT INTO sync_logs (wechat_id, type, status)
         VALUES (?, 'group', 'failed')`,
        [this.currentUser.id]
      );
      logger.error(`同步群组信息失败: ${err.message}`);
    }
  }

  async onRoomJoin(room, inviteeList, inviter) {
    if (!this.currentUser) return;
    
    try {
      // 检查房间是否准备好
      if (!room.isReady()) {
        logger.info(`房间未准备好，等待准备...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
        
        // 如果仍未准备好，跳过本次处理
        if (!room.isReady()) {
          logger.warn(`房间仍未准备好，稍后将通过同步机制处理`);
          return;
        }
      }
      
      const roomId = room.id;
      const wechatId = this.currentUser.id;
      
      try {
        const roomName = await room.topic();
        const memberCount = (await room.memberAll()).length;
        
        // 同步群组信息
        await db.run(
          `INSERT INTO groups 
           (room_id, wechat_id, name, member_count, is_managed) 
           VALUES (?, ?, ?, ?, 1)
           ON CONFLICT(room_id, wechat_id) DO UPDATE SET
           name = excluded.name,
           member_count = excluded.member_count,
           updated_at = CURRENT_TIMESTAMP`,
          [roomId, wechatId, roomName, memberCount]
        );
        logger.info(`新加入群组: ${roomName}`);
      } catch (err) {
        // 如果无法获取群信息，记录最基本信息
        logger.warn(`无法获取完整群信息，记录基本信息: ${err.message}`);
        await db.run(
          `INSERT INTO groups 
           (room_id, wechat_id, name, is_managed) 
           VALUES (?, ?, ?, 1)
           ON CONFLICT(room_id, wechat_id) DO UPDATE SET
           updated_at = CURRENT_TIMESTAMP`,
          [roomId, wechatId, '新群组(待同步)', 1]
        );
        
        // 安排稍后通过同步功能更新
        setTimeout(() => this.syncRoomList(), 30000); // 30秒后同步群列表
      }
    } catch (err) {
      logger.error(`处理加入群聊事件失败: ${err.message}`);
    }
  }
  
  async onRoomLeave(room, leaverList) {
    if (!this.currentUser) return;
    
    // 可以根据需要决定是否删除群组或标记为非管理状态
    const roomId = room.id;
    const wechatId = this.currentUser.id;
    
    try {
      await db.run(
        `UPDATE groups SET is_managed = 0, updated_at = CURRENT_TIMESTAMP
         WHERE room_id = ? AND wechat_id = ?`,
        [roomId, wechatId]
      );
      logger.info(`已离开群组 ${roomId}`);
    } catch (err) {
      logger.error(`更新群组状态失败: ${err.message}`);
    }
  }
  
  async onRoomTopic(room, newTopic, oldTopic, changer) {
    if (!this.currentUser) return;
    
    try {
      // 检查房间是否准备好
      if (!room.isReady()) {
        logger.info(`房间未准备好，等待准备...`);
        await new Promise(resolve => setTimeout(resolve, 3000)); // 等待3秒
        
        // 如果仍未准备好，跳过本次处理
        if (!room.isReady()) {
          logger.warn(`房间仍未准备好，稍后将通过同步机制处理`);
          return;
        }
      }
      
      const roomId = room.id;
      const wechatId = this.currentUser.id;
      
      // 先检查群组是否已存在
      const existingGroup = await db.get(
        `SELECT id FROM groups WHERE room_id = ? AND wechat_id = ?`,
        [roomId, wechatId]
      );
      
      if (existingGroup) {
        // 如果群组存在，更新群名称
        await db.run(
          `UPDATE groups SET name = ?, updated_at = CURRENT_TIMESTAMP
           WHERE room_id = ? AND wechat_id = ?`,
          [newTopic, roomId, wechatId]
        );
        logger.info(`群名称已更新: ${oldTopic} -> ${newTopic}`);
      } else {
        // 如果群组不存在，添加新群组记录
        try {
          const memberCount = (await room.memberAll()).length;
          
          await db.run(
            `INSERT INTO groups 
             (room_id, wechat_id, name, member_count, is_managed) 
             VALUES (?, ?, ?, ?, 1)`,
            [roomId, wechatId, newTopic, memberCount]
          );
          logger.info(`新增群组并更新群名称: ${newTopic}`);
        } catch (err) {
          // 如果无法获取完整群信息，记录基本信息
          logger.warn(`无法获取完整群信息，记录基本信息: ${err.message}`);
          await db.run(
            `INSERT INTO groups 
             (room_id, wechat_id, name, is_managed) 
             VALUES (?, ?, ?, 1)`,
            [roomId, wechatId, newTopic, 1]
          );
          
          // 安排稍后通过同步功能更新
          setTimeout(() => this.syncRoomList(), 30000);
        }
      }
    } catch (err) {
      logger.error(`更新群名称失败: ${err.message}`);
    }
  }
}

module.exports = SummaryBot; 