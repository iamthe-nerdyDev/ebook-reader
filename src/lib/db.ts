import initSqlJs, { Database, SqlJsStatic } from "sql.js";
import wasmUrl from "sql.js/dist/sql-wasm.wasm?url";
import { idbGet, idbSet } from "./idb";
import { MIGRATIONS } from "./schema";

const DB_KEY = "sqlite-db";

let SQL: SqlJsStatic | null = null;
let db: Database | null = null;
let saveTimer: number | null = null;

export async function initDb(): Promise<Database> {
  if (db) return db;
  SQL = await initSqlJs({ locateFile: () => wasmUrl });
  const saved = await idbGet<Uint8Array>("kv", DB_KEY);
  db = saved ? new SQL.Database(saved) : new SQL.Database();
  runMigrations(db);
  return db;
}

function runMigrations(d: Database) {
  d.run("CREATE TABLE IF NOT EXISTS _meta (k TEXT PRIMARY KEY, v TEXT)");
  const row = d.exec("SELECT v FROM _meta WHERE k='version'");
  let version = row.length ? Number(row[0].values[0][0]) : 0;
  for (let i = version; i < MIGRATIONS.length; i++) {
    d.run(MIGRATIONS[i]);
  }
  version = MIGRATIONS.length;
  d.run("INSERT OR REPLACE INTO _meta (k,v) VALUES ('version', ?)", [String(version)]);
}

export function getDb(): Database {
  if (!db) throw new Error("DB not initialised");
  return db;
}

/** Persist the database to IndexedDB (debounced). */
export function persist() {
  if (!db) return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    if (!db) return;
    await idbSet("kv", DB_KEY, db.export());
  }, 250);
}

/** Convenience: run a query and return rows as objects. */
export function query<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  const stmt = getDb().prepare(sql);
  try {
    stmt.bind(params as never);
    const out: T[] = [];
    while (stmt.step()) out.push(stmt.getAsObject() as T);
    return out;
  } finally {
    stmt.free();
  }
}

export function run(sql: string, params: unknown[] = []) {
  getDb().run(sql, params as never);
  persist();
}
