-- 群组信息表
CREATE TABLE IF NOT EXISTS groups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  wechat_id TEXT NOT NULL,  -- 新增的微信账号字段
  name TEXT NOT NULL,
  avatar TEXT,
  notice TEXT,
  member_count INTEGER DEFAULT 0 CHECK(member_count >= 0),
  is_managed BOOLEAN DEFAULT 1,
  last_summary_time DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(room_id, wechat_id)  -- 修改唯一约束为群ID和微信号的组合
);

CREATE INDEX idx_groups_updated ON groups (updated_at);

-- 消息记录表
CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  msg_id TEXT NOT NULL UNIQUE,
  sender_id TEXT NOT NULL,
  sender_name TEXT NOT NULL,
  content TEXT NOT NULL,
  msg_time DATETIME(3) NOT NULL,
  msg_type INTEGER NOT NULL CHECK(msg_type BETWEEN 1 AND 8),
  is_at_me BOOLEAN DEFAULT 0,
  wechat_id TEXT NOT NULL,  -- 新增字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_messages_room_time ON messages (room_id, msg_time);
CREATE INDEX idx_messages_sender ON messages (sender_id);
CREATE INDEX idx_messages_wechat ON messages (wechat_id);

-- 总结历史表
CREATE TABLE IF NOT EXISTS summaries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  room_id TEXT NOT NULL,
  summary_hash TEXT NOT NULL UNIQUE,
  summary_text TEXT NOT NULL,
  model TEXT DEFAULT 'deepseek-r1',
  start_time DATETIME NOT NULL,
  end_time DATETIME NOT NULL,
  token_usage INTEGER CHECK(token_usage >= 0),
  status INTEGER DEFAULT 0 CHECK(status BETWEEN 0 AND 2),
  wechat_id TEXT NOT NULL,  -- 新增字段
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_summaries_time_range ON summaries (start_time, end_time);
CREATE INDEX idx_summaries_wechat ON summaries (wechat_id);

-- 新增同步记录表
CREATE TABLE IF NOT EXISTS sync_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wechat_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('group', 'message')),
  status TEXT NOT NULL CHECK(status IN ('pending', 'completed', 'failed')),
  sync_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sync_logs_wechat ON sync_logs (wechat_id, type);