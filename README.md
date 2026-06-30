# 电影评分系统

这是“数据库应用课程设计”选题一“电影评分系统”的本地 Web 系统实现。

## 当前状态

项目已生成本地 Web 系统基础文件、演示数据和 MySQL 数据库脚本。后续换电脑或换 Codex 线程时，建议先阅读：

- `README.md`
- `操作记录.md`
- `TODO.md`
- `HANDOFF.md`

## 运行方式

在项目目录执行：

```powershell
cd "D:\Course Project\movie-rating-system"
node server.js
```

浏览器访问：

```text
http://127.0.0.1:3000
```

## 默认账号

| 身份 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | admin | admin123 |
| 普通用户 | user1 | user123 |
| 普通用户 | user2 | user123 |

## 目录说明

| 目录 | 说明 |
| --- | --- |
| `public` | 前端页面、样式和脚本 |
| `data` | 本地 JSON 数据文件 |
| `sql` | MySQL 数据库脚本 |
| `docs` | 课程设计报告素材和设计说明 |
| `reports` | Word 课程设计报告 |
| `scripts` | 辅助检查脚本 |

## 数据库脚本

完整 MySQL 脚本位于：

- `sql/01_schema.sql`
- `sql/02_seed.sql`

脚本包含表、主键、外键、非空、默认值、CHECK 约束、索引、视图、存储过程和触发器。

## 跨设备继续工作的流程

白天在笔记本完成工作后：

```powershell
git status
git add .
git commit -m "更新电影评分系统"
git push
```

晚上在台式机继续前：

```powershell
git pull
```

打开新的 Codex 线程时，可以直接说：

```text
请先阅读 README.md、操作记录.md、TODO.md 和 HANDOFF.md，然后继续完成电影评分系统课设。
```

## GitHub 远程仓库配置

创建 GitHub 私有仓库后，在本项目目录执行：

```powershell
git remote add origin <你的GitHub仓库地址>
git branch -M main
git push -u origin main
```
