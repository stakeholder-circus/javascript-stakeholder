import { createHash } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";

import { resolveStateRoot } from "./encrypted-files.js";

let sqlRuntimePromise;

async function loadSqlRuntime() {
	if (!sqlRuntimePromise) {
		sqlRuntimePromise = initSqlJs({
			locateFile: (file) =>
				new URL(`../../../node_modules/sql.js/dist/${file}`, import.meta.url).toString(),
		});
	}
	return await sqlRuntimePromise;
}

function decodeRow(row) {
	return row ? JSON.parse(row) : null;
}

export function buildCacheKey(input) {
	return createHash("sha256").update(JSON.stringify(input)).digest("hex");
}

export async function createRuntimeDb(options = {}) {
	const stateRoot = options.stateRoot ?? resolveStateRoot();
	const dbRoot = path.join(stateRoot, "runtime");
	const dbPath = path.join(dbRoot, "state.sqlite");
	await fs.mkdir(dbRoot, { recursive: true });

	const SQL = await loadSqlRuntime();
	let database;
	try {
		const existing = await fs.readFile(dbPath);
		database = new SQL.Database(existing);
	} catch (error) {
		if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
			throw error;
		}
		database = new SQL.Database();
	}

	database.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      mode TEXT NOT NULL,
      created_at TEXT NOT NULL,
      config_json TEXT NOT NULL,
      selected_families_json TEXT NOT NULL,
      provenance_json TEXT,
      events_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS cache_entries (
      cache_key TEXT PRIMARY KEY,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_version TEXT NOT NULL,
      personalization_profile TEXT,
      created_at TEXT NOT NULL,
      response_json TEXT NOT NULL,
      provenance_json TEXT
    );
  `);

	async function persist() {
		await fs.writeFile(dbPath, Buffer.from(database.export()));
	}

	function run(sql, params = []) {
		database.run(sql, params);
	}

	function first(sql, params = []) {
		const statement = database.prepare(sql, params);
		try {
			if (!statement.step()) {
				return null;
			}
			return statement.getAsObject();
		} finally {
			statement.free();
		}
	}

	function all(sql, params = []) {
		const statement = database.prepare(sql, params);
		const rows = [];
		try {
			while (statement.step()) {
				rows.push(statement.getAsObject());
			}
		} finally {
			statement.free();
		}
		return rows;
	}

	async function saveSession(session) {
		run(
			`INSERT OR REPLACE INTO sessions
        (id, mode, created_at, config_json, selected_families_json, provenance_json, events_json)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
			[
				session.id,
				session.mode,
				session.createdAt ?? new Date().toISOString(),
				JSON.stringify(session.config ?? {}),
				JSON.stringify(session.selectedFamilies ?? []),
				JSON.stringify(session.provenance ?? null),
				JSON.stringify(session.events ?? []),
			],
		);
		await persist();
		return session;
	}

	async function getSession(id) {
		const row = first("SELECT * FROM sessions WHERE id = ?", [id]);
		if (!row) {
			return null;
		}
		return {
			id: row.id,
			mode: row.mode,
			createdAt: row.created_at,
			config: decodeRow(row.config_json),
			selectedFamilies: decodeRow(row.selected_families_json) ?? [],
			provenance: decodeRow(row.provenance_json),
			events: decodeRow(row.events_json) ?? [],
		};
	}

	async function listSessions(limit = 10) {
		return all("SELECT * FROM sessions ORDER BY created_at DESC LIMIT ?", [limit]).map((row) => ({
			id: row.id,
			mode: row.mode,
			createdAt: row.created_at,
			config: decodeRow(row.config_json),
			selectedFamilies: decodeRow(row.selected_families_json) ?? [],
			provenance: decodeRow(row.provenance_json),
			events: decodeRow(row.events_json) ?? [],
		}));
	}

	async function getCache(cacheKey) {
		const row = first("SELECT * FROM cache_entries WHERE cache_key = ?", [cacheKey]);
		if (!row) {
			return null;
		}
		return {
			cacheKey: row.cache_key,
			provider: row.provider,
			model: row.model,
			promptVersion: row.prompt_version,
			personalizationProfile: row.personalization_profile,
			createdAt: row.created_at,
			response: decodeRow(row.response_json),
			provenance: decodeRow(row.provenance_json),
		};
	}

	async function putCache(entry) {
		run(
			`INSERT OR REPLACE INTO cache_entries
        (cache_key, provider, model, prompt_version, personalization_profile, created_at, response_json, provenance_json)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
			[
				entry.cacheKey,
				entry.provider,
				entry.model,
				entry.promptVersion,
				entry.personalizationProfile ?? null,
				entry.createdAt ?? new Date().toISOString(),
				JSON.stringify(entry.response ?? null),
				JSON.stringify(entry.provenance ?? null),
			],
		);
		await persist();
		return entry;
	}

	return {
		dbPath,
		saveSession,
		getSession,
		listSessions,
		getCache,
		putCache,
	};
}
