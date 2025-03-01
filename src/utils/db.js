const sqlite3 = require('sqlite3').verbose();
const logger = require('./logger');

class Database {
  constructor() {
    this.db = null;
    this.isTestEnv = process.env.NODE_ENV === 'test';
  }

  async connect(path = './data/chat.db') {
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(path, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
        if (err) {
          logger.error(`数据库连接失败: ${err.message}`);
          return reject(err);
        }
        
        if (!this.isTestEnv) {
          logger.info(`已连接数据库: ${path}`);
          this.runPragma();
        }
        resolve();
      });
    });
  }

  runPragma() {
    this.db.serialize(() => {
      this.db.run('PRAGMA journal_mode = WAL;');
      this.db.run('PRAGMA foreign_keys = ON;');
      this.db.run('PRAGMA busy_timeout = 5000;');
    });
  }

  async close() {
    return new Promise((resolve, reject) => {
      if (!this.db) return resolve();
      
      this.db.close(err => {
        if (err) {
          logger.error(`关闭数据库失败: ${err.message}`);
          return reject(err);
        }
        logger.info('数据库连接已关闭');
        resolve();
      });
    });
  }

  async run(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) return reject(err);
        resolve({ lastID: this.lastID, changes: this.changes });
      });
    });
  }

  async get(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) return reject(err);
        resolve(row);
      });
    });
  }

  async all(sql, params = []) {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) return reject(err);
        resolve(rows);
      });
    });
  }

  async exec(sql) {
    return new Promise((resolve, reject) => {
      this.db.exec(sql, err => {
        if (err) return reject(err);
        resolve();
      });
    });
  }

  async transaction(callback) {
    await this.run('BEGIN TRANSACTION');
    try {
      await callback();
      await this.run('COMMIT');
    } catch (err) {
      await this.run('ROLLBACK');
      throw err;
    }
  }
}

module.exports = new Database(); 