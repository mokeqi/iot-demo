# IoT 温湿度演示（publisher + 网页可视化）

## 使用说明

### 1. 安装依赖

```bash
npm install
```

### 2. 启动 MQTT broker

本地需有一个 MQTT broker 监听 1883 端口（以 mosquitto 为例）：

```bash
mosquitto -v
```

### 3. 启动 publisher 与网页

```bash
npm start
```

- 终端会打印 `[PUB] Connected` 和 `[WEB] http://localhost:3000`
- 浏览器打开 http://localhost:3000 即可看到温湿度实时数据与折线图

### 4. 验证

1. 页面打开后先显示"等待数据…"，约 2 秒内出现数值并开始绘图；
2. 另开一个终端运行 `npm run sub`，订阅端打印的数值应与网页一致；
3. 刷新网页应立即恢复历史曲线（服务端会重放最近 150 个数据点）。

### 配置（.env）

| 变量 | 说明 | 默认值 |
| --- | --- | --- |
| MQTT_URL | broker 地址 | mqtt://localhost:1883 |
| MQTT_USERNAME / MQTT_PASSWORD | broker 认证 | 空 |
| TOPIC | 发布/订阅主题 | iot/demo/temperature |
| PORT | 网页端口 | 3000 |

---

git add .

git commit -m "初始化 IoT 演示项目"

git log --oneline -5
