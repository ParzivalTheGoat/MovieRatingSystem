# HANDOFF

## 项目定位

本项目是数据库应用课程设计“选题一：电影评分系统”。目标是完成一个可本地运行的 Web 系统，并配套完成课程设计报告。

## 当前实现方案

- 运行方式：原生 Node.js 标准库实现本地 Web 服务。
- 演示数据：`data/db.json`。
- 数据库要求：通过 `sql/01_schema.sql` 和 `sql/02_seed.sql` 提供完整 MySQL 实现。
- 文档要求：课程设计报告必须基于给定 Word 模板填写，不能修改模板字体、字号、段落和页面格式。

## 已完成内容

- 阅读并整理课程资料。
- 创建项目目录结构。
- 生成 `README.md`、`操作记录.md`、`TODO.md`、`HANDOFF.md`。
- 生成本地 JSON 演示数据。
- 生成 Node.js 服务端文件 `server.js`。
- 生成 MySQL 脚本：
  - `sql/01_schema.sql`
  - `sql/02_seed.sql`
- 生成前端基础文件：
  - `public/index.html`
  - `public/styles.css`
  - `public/app.js`
- 生成本地 SVG 海报和演员头像资源。
- 生成启动、停止和 API 冒烟测试脚本。
- 完成 Node 语法检查、基础数据检查和 API 冒烟测试。
- 生成报告素材和 Word 报告：
  - `docs/课程设计报告素材.md`
  - `reports/电影评分系统课程设计报告.docx`
- 生成答辩演示流程和系统测试记录：
  - `docs/答辩演示流程.md`
  - `docs/系统测试记录.md`

## 下一步建议

1. 启动系统：`node scripts\start-local.js`。
2. 访问 `http://127.0.0.1:3000`，按 `docs/答辩演示流程.md` 逐项演示。
3. 根据个人信息补全 Word 报告封面中的姓名、学号和专业班级。
4. 如需要更严格遵循原 `.doc` 模板格式，建议手动打开模板，把 `docs/课程设计报告素材.md` 或已生成报告内容粘贴到模板对应章节中，并保留模板样式。
5. 答辩前补充系统运行截图到报告。

## 默认账号

| 身份 | 用户名 | 密码 |
| --- | --- | --- |
| 管理员 | admin | admin123 |
| 普通用户 | user1 | user123 |
| 普通用户 | user2 | user123 |

## 重要要求

- 所有项目相关文件都应保存在 `D:\Course Project\movie-rating-system` 内。
- GitHub 同步前先提交本地改动。
- 不要让两台电脑同时修改同一个 Word 报告文件。
- 换电脑后让 Codex 先读 `README.md`、`操作记录.md`、`TODO.md` 和 `HANDOFF.md`。
- 用户已表示不用继续做 Word 页面渲染检查。

## 给下一个 Codex 线程的提示词

```text
请先阅读 README.md、操作记录.md、TODO.md 和 HANDOFF.md，然后继续完成电影评分系统课设。重点检查本地系统是否能运行，补全缺失功能，并在不修改原 Word 模板格式的前提下生成课程设计报告。
```
