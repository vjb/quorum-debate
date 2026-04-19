import sqlite3 from 'sqlite3';
import path from 'path';
import os from 'os';

// Polyfill for next.js serverless envs (though we are running in nodejs runtime)
const dbPath = path.join(os.tmpdir(), 'agent_memory.sqlite');

let dbInstance: sqlite3.Database | null = null;

export function getDb(): Promise<sqlite3.Database> {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }
    const db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening memory db', err);
        reject(err);
      } else {
        db.run(`
          CREATE TABLE IF NOT EXISTS agent_reflections (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_name TEXT,
            global_task TEXT,
            reflection TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `, (createErr) => {
          if (createErr) reject(createErr);
          else {
            dbInstance = db;
            resolve(db);
          }
        });
      }
    });
  });
}

export async function saveReflection(agentName: string, globalTask: string, reflection: string) {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.run(
      'INSERT INTO agent_reflections (agent_name, global_task, reflection) VALUES (?, ?, ?)',
      [agentName, globalTask, reflection],
      function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      }
    );
  });
}

export async function getPastReflections(agentName: string, limit: number = 3): Promise<string[]> {
  const db = await getDb();
  return new Promise((resolve, reject) => {
    db.all(
      'SELECT reflection FROM agent_reflections WHERE agent_name = ? ORDER BY timestamp DESC LIMIT ?',
      [agentName, limit],
      (err, rows) => {
        if (err) reject(err);
        else resolve(rows.map((r: any) => r.reflection));
      }
    );
  });
}
