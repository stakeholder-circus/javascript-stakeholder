import assert from "node:assert/strict";
import test from "node:test";

import { run } from "../src/index.js";

function createWritable() {
	let value = "";
	return {
		write(chunk) {
			value += chunk;
		},
		read() {
			return value;
		},
	};
}

test("cli --list-values returns the baseline registry and experimental providers", async () => {
	const stdout = createWritable();
	const stderr = createWritable();
	const exitCode = await run(["--list-values"], stdout, stderr);
	assert.equal(exitCode, 0);
	assert.equal(stderr.read(), "");

	const parsed = JSON.parse(stdout.read());
	assert.ok(parsed.devTypes.includes("backend"));
	assert.ok(parsed.experimentalProviders.includes("local-demo"));
});

test("cli deterministic json run preserves normalized event fields", async () => {
	const stdout = createWritable();
	const stderr = createWritable();
	const exitCode = await run(
		[
			"--dev-type",
			"backend",
			"--complexity",
			"medium",
			"--jargon",
			"high",
			"--seed",
			"cli-seed",
			"--output-format",
			"json",
		],
		stdout,
		stderr,
	);
	assert.equal(exitCode, 0);
	assert.equal(stderr.read(), "");

	const parsed = JSON.parse(stdout.read());
	assert.ok(Array.isArray(parsed.events));
	assert.ok(parsed.events.length >= 3);
	for (const event of parsed.events) {
		assert.equal(typeof event.eventType, "string");
		assert.equal(typeof event.sequence, "number");
		assert.equal(typeof event.message, "string");
		assert.equal(typeof event.timestamp, "string");
	}
});
