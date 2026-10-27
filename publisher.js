require('dotenv').config();
const mqtt = require('mqtt');
const express = require('express');
const path = require('path');
const { DatabaseSync } = require('node:sqlite');

const url = process.env.MQTT_URL || 'mqtt://localhost:1883';
const topic = process.env.TOPIC || 'iot/demo/temperature';
const port = process.env.PORT || 3000;

// ---------- SQLite 历史数据存储 ----------
const db = new DatabaseSync(path.join(__dirname, 'data.db'));
db.exec(`
  CREATE TABLE IF NOT EXISTS sensor_data (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    deviceId    TEXT,
    temperature REAL,
    humidity    REAL,
    timestamp   INTEGER
  );
  CREATE INDEX IF NOT EXISTS idx_sensor_data_ts ON sensor_data(timestamp);
`);
console.log('[DB] SQLite ready, table: sensor_data');

// ---------- 网页服务器（展示实际发布的数据） ----------
const app = express();
app.use(express.static(path.join(__dirname, 'public')));

const history = [];        // 已发布数据的历史记录
const MAX_POINTS = 150;    // 最多保留的数据点数
const sseClients = new Set();

app.get('/api/events', (req, res) => {
  res.set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
  });
  res.flushHeaders();

  // 新客户端先收到完整历史
  res.write(`event: init\ndata: ${JSON.stringify(history)}\n\n`);
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// 历史数据查询：最近 50 条，按时间正序返回
app.get('/api/history', (req, res) => {
  const rows = db.prepare(
    'SELECT * FROM (SELECT * FROM sensor_data ORDER BY id DESC LIMIT 50) ORDER BY id ASC'
  ).all();
  res.json(rows);
});

app.listen(port, () => {
  console.log(`[WEB] http://localhost:${port}`);
});

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(msg);
}

// ---------- 原有 MQTT 数据生成与发布 ----------
const client = mqtt.connect(url, {
  username: process.env.MQTT_USERNAME || undefined,
  password: process.env.MQTT_PASSWORD || undefined,
  reconnectPeriod: 1000,
});

client.on('connect', () => {
  console.log('[PUB] Connected:', url);

  setInterval(() => {
    const data = {
      deviceId: 'sensor-001',
      ts: Date.now(),
      temperature: (20 + Math.random() * 5).toFixed(2),
      humidity: (40 + Math.random() * 10).toFixed(2),
    };
    const payload = JSON.stringify(data);

    client.publish(topic, payload, { qos: 0 }, (err) => {
      if (err) {
        console.error('[PUB] Publish error:', err.message);
      } else {
        console.log('[PUB] Sent:', payload);
        // 只把成功发布的数据送到网页
        history.push(data);
        if (history.length > MAX_POINTS) history.shift();
        broadcast(data);
        // 持久化到 SQLite
        db.prepare(
          'INSERT INTO sensor_data (deviceId, temperature, humidity, timestamp) VALUES (?, ?, ?, ?)'
        ).run(data.deviceId, parseFloat(data.temperature), parseFloat(data.humidity), data.ts);
      }
    });
  }, 2000);
});

client.on('error', (err) => console.error('[PUB] Error:', err.message));
