const express = require("express");
const Database = require("better-sqlite3");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.PORT || 3000);
const DATA_DIR = process.env.DATA_DIR || "/app/data";
const DATABASE_PATH = process.env.DATABASE_PATH || path.join(DATA_DIR, "gantt.sqlite");

fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(DATABASE_PATH);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS task_overrides (
    task_id TEXT PRIMARY KEY,
    payload TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS update_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id TEXT,
    task_name TEXT NOT NULL,
    action TEXT NOT NULL,
    before_payload TEXT,
    after_payload TEXT,
    created_at TEXT NOT NULL
  );
`);

const selectOverrides = db.prepare("SELECT task_id, payload FROM task_overrides");
const upsertOverride = db.prepare(`
  INSERT INTO task_overrides (task_id, payload, updated_at)
  VALUES (@taskId, @payload, @updatedAt)
  ON CONFLICT(task_id) DO UPDATE SET
    payload = excluded.payload,
    updated_at = excluded.updated_at
`);
const deleteOverrides = db.prepare("DELETE FROM task_overrides");
const selectLogs = db.prepare(`
  SELECT id, task_id AS taskId, task_name AS taskName, action, before_payload AS beforePayload, after_payload AS afterPayload, created_at AS timestamp
  FROM update_logs
  ORDER BY id DESC
  LIMIT 200
`);
const insertLog = db.prepare(`
  INSERT INTO update_logs (task_id, task_name, action, before_payload, after_payload, created_at)
  VALUES (@taskId, @taskName, @action, @beforePayload, @afterPayload, @timestamp)
`);
const deleteLogs = db.prepare("DELETE FROM update_logs");

app.use(express.json());
app.use(express.static(__dirname));

app.get("/health", (_req, res) => {
  res.type("text/plain").send("ok");
});

app.get("/api/state", (_req, res) => {
  const overrides = {};
  for (const row of selectOverrides.all()) {
    overrides[row.task_id] = JSON.parse(row.payload);
  }

  const logs = selectLogs.all().map((row) => ({
    ...row,
    before: row.beforePayload ? JSON.parse(row.beforePayload) : null,
    after: row.afterPayload ? JSON.parse(row.afterPayload) : null
  })).map(({ beforePayload, afterPayload, ...entry }) => entry);

  res.json({ overrides, logs });
});

app.put("/api/tasks/:taskId", (req, res) => {
  const { taskId } = req.params;
  const { taskName, action, before, after } = req.body || {};

  if (!after || !taskName) {
    return res.status(400).json({ error: "taskName e after são obrigatórios." });
  }

  const timestamp = new Date().toISOString();
  upsertOverride.run({
    taskId,
    payload: JSON.stringify(after),
    updatedAt: timestamp
  });

  insertLog.run({
    taskId,
    taskName,
    action: action || "Atualização manual",
    beforePayload: before ? JSON.stringify(before) : null,
    afterPayload: JSON.stringify(after),
    timestamp
  });

  res.json({ ok: true });
});

app.post("/api/reset", (req, res) => {
  const timestamp = new Date().toISOString();
  deleteOverrides.run();
  insertLog.run({
    taskId: null,
    taskName: "Planejamento",
    action: "restore",
    beforePayload: null,
    afterPayload: null,
    timestamp
  });

  res.json({ ok: true });
});

app.delete("/api/logs", (_req, res) => {
  deleteLogs.run();
  res.json({ ok: true });
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.listen(PORT, () => {
  console.log(`Gantt server running on port ${PORT}`);
  console.log(`SQLite database: ${DATABASE_PATH}`);
});
