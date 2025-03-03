

## 版本要求

### 微信版本要求
- 当前支持的微信版本: **v3.9.2.23**

### 依赖包版本
- wechaty-puppet-xp: **1.13.12**

https://www.npmjs.com/package/wechaty-puppet-xp

| **puppet-xp** | **wechat** | **npm install** |
| --- | --- | --- |
| 2.1.1 | [WeChat-v3.9.10.27](https://github.com/tom-snow/wechat-windows-versions/releases/download/v3.9.10.27/WeChatSetup-3.9.10.27.exe) | npm i wechaty-puppet-xp@2.1.1 |
| 1.13.12 | [WeChat-v3.9.2.23](https://github.com/tom-snow/wechat-windows-versions/releases/download/v3.9.2.23/WeChatSetup-3.9.2.23.exe) | npm i wechaty-puppet-xp@1.3.12 |
| 1.12.7 | [WeChat-v3.6.0.18](https://github.com/tom-snow/wechat-windows-versions/releases/download/v3.6.0.18/WeChatSetup-3.6.0.18.exe) | npm i wechaty-puppet-xp@1.12.7 |
| 1.11.14 | [WeChat-v3.3.0.115](https://github.com/wechaty/wechaty-puppet-xp/releases/download/v0.5/WeChatSetup-v3.3.0.115.exe) | npm i wechaty-puppet-xp@1.11.14 |

## 安装说明

### 安装依赖
```bash
npm i wechaty-puppet-xp@1.13.12
```

### 微信版本修改工具
登录提示"你的应用版本过低"，使用项目中的 Python 脚本修改微信版本号：

```bash
# 首先安装所需的Python依赖
pip install pymem

# 打开微信， 然后运行版本修改脚本
python change_version.py
```
