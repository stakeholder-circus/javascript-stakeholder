import assert from "node:assert/strict";
import { promises as fs } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { runDeterministicSession } from "../src/shared/engine.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const EVENT_SCHEMA_PATH = path.join(ROOT, "core", "spec", "event-schema.json");

function assertMatchesSchema(event, schema) {
	for (const field of schema.required) {
		assert.ok(field in event, `missing required field ${field}`);
	}
	assert.equal(typeof event.eventType, "string");
	assert.equal(typeof event.sequence, "number");
	assert.equal(typeof event.message, "string");
	assert.equal(typeof event.timestamp, "string");
	if (event.context) {
		assert.equal(typeof event.context, "object");
		for (const value of Object.values(event.context)) {
			assert.ok(
				["boolean", "number", "string"].includes(typeof value) || value === null,
				"context values must be primitive or null",
			);
		}
	}
}

test("deterministic session is stable for the same seed", () => {
	const first = runDeterministicSession({
		devType: "backend",
		seed: "stable-seed",
		outputFormat: "json",
	});
	const second = runDeterministicSession({
		devType: "backend",
		seed: "stable-seed",
		outputFormat: "json",
	});
	assert.deepEqual(first.events, second.events);
	assert.deepEqual(first.selectedFamilies, second.selectedFamilies);
});

test("deterministic session events match the stakeholder-core event schema contract", async () => {
	const schema = JSON.parse(await fs.readFile(EVENT_SCHEMA_PATH, "utf8"));
	const session = runDeterministicSession({
		devType: "fullstack",
		complexity: "high",
		jargon: "high",
		seed: "schema-check",
		outputFormat: "json",
		alerts: true,
		team: true,
		trace: true,
	});

	for (const event of session.events) {
		assertMatchesSchema(event, schema);
	}
});
