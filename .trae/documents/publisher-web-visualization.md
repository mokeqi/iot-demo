# 计划：为 publisher.js 添加数据可视化网页界面

## 概要

在 publisher.js 中嵌入 Express 服务器，通过 SSE（Server-Sent Events）把程序**实际发布**的 MQTT 数据实时推送到中文网页，前端用 Chart.js（CDN 引入）绘制温湿度折线图。保留原有 MQTT 数据生成与发布功能不变。

## 现状分析

- [publisher.js](../../publisher.js)：连接 MQTT 后每 2 秒生成 `{ deviceId: 'sensor-001', ts: Date.now(), temperature: 'xx.xx', humidity: 'xx.xx' }`（字符串保留两位小数），发布到主题 `iot/demo/temperature`。
- [package.json](../../package.json)：依赖 `dotenv`、`mqtt`；脚本 `pub`、`sub`。
- [.env](../../.env)：`MQTT_URL=mqtt://localhost:1883`、`TOPIC=iot/demo/temperature`。
- [README.md](../../README.md)：目前只有几条 git 命令，无使用说明。

## 用户已确认的决策

1. 图表：Chart.js 通过 CDN 引入（不做离线手绘）。
2. 架构：Express 嵌入 publisher.js 单进程运行（一条命令启动发布 + 网页）。
3. 数据传输：SSE（浏览器原生 EventSource，自动重连，无需额外依赖）。
4. 中文界面、无前端框架、不执行 Git 提交/推送。

## 改动文件

### 1. 修改 `publisher.js`

保留原有 MQTT 连接、定时生成、发布逻辑不动，增加：

- `const express = require('express')`，创建 app，`express.static('public')` 提供静态页面。
- 内存历史数组 `history`（最多保留约 150 个点），在**发布成功回调**里将同一条 data 存入并广播，保证网页展示的就是实际发布的数据。
- SSE 端点 `GET /api/events`：
  - 客户端连上后先发送 `init` 事件（携带完整历史），再持续推送新数据点；
  - `req.on('close')` 时清理断开的客户端。
- 监听 `PORT`（默认 3000），启动时打印 `http://localhost:3000`。
- MQTT 未连接/报错时网页自然保持"等待数据"，不需要特殊处理。

### 2. 新建 `public/index.html`（单文件，内联 CSS/JS）

- 标题"IoT 温湿度监控"，界面全中文。
- 顶部数值卡片：设备ID、温度（°C）、湿度（%）、更新时间（HH:MM:SS）。
- 未收到任何数据前显示"等待数据…"占位提示，收到后隐藏。
- Chart.js 折线图：温度、湿度两条曲线，左右双 Y 轴（温湿度量程不同），X 轴为时间标签，随数据自动滚动。
- JS 通过 `new EventSource('/api/events')` 接收：`init` 事件重建整个历史，普通消息追加单点。
- 纯原生 JS，不引入任何框架；Chart.js 用国内 CDN（bootcdn）地址。

### 3. 修改 `package.json`

- `dependencies` 增加 `express`（^4.x）。
- `scripts` 增加 `"start": "node publisher.js"`（保留 `pub`、`sub` 不变）。

### 4. 修改 `README.md`

在现有内容前补一节"使用说明"：

- 安装：`npm install`
- 前置：本地需运行 MQTT broker（如 `mosquitto -v`，监听 1883）
- 启动：`npm start`，浏览器打开 http://localhost:3000
- 验证方法（见下）。

## 数据流

```
publisher.js 定时生成 data
  ├─ client.publish() 到 MQTT（原功能，不变）
  └─ 写入 history + SSE 广播 → 浏览器 EventSource → 更新卡片 + Chart.js 折线图
```

## 新增依赖

- npm：仅 `express`。
- 前端：Chart.js CDN（不进 package.json）。

## 启动与验证

1. `npm install`（安装 express）。
2. 启动 broker：`mosquitto -v`（若已在运行可跳过）。
3. `npm start`，终端应显示 `[PUB] Connected` 与 `[WEB] http://localhost:3000`。
4. 浏览器打开 http://localhost:3000：
   - 首次打开先显示"等待数据…"，约 2 秒内出现数值和曲线，之后每 2 秒推进一个点；
   - 刷新页面应立即显示历史曲线（init 事件生效）。
5. 另开终端 `npm run sub`，核对订阅端打印的数值与网页一致。
6. 边界情况：停掉 broker 后网页保持最后状态且不再新增点，恢复后自动继续（EventSource 自动重连 + MQTT 重连）。

## 不做的事

- 不改动 subscriber.js 的现有行为。
- 不引入前端框架、构建工具或数据库。
- 不执行任何 Git 提交或推送。
