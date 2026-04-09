import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createEncryptedStore } from "../src/server/store/encrypted-files.js";
import { createRuntimeDb } from "../src/server/store/runtime-db.js";

test("encrypted store and runtime db round-trip provider, prompt, consumer session, cache, and session state", async () => {
	const stateRoot = await mkdtemp(path.join(os.tmpdir(), "javascript-stakeholder-store-"));
	try {
		const store = await createEncryptedStore({ stateRoot });
		const db = await createRuntimeDb({ stateRoot });

		const profile = await store.upsertProviderProfile({
			id: "test-provider",
			provider: "openai-compatible",
			label: "Test provider",
			baseUrl: "https://example.invalid/v1/responses",
			apiKeyEnv: "TEST_API_KEY",
			model: "test-model",
		});
		assert.equal(profile.id, "test-provider");

		const prompt = await store.upsertPromptAsset({
			id: "test-prompt",
			version: "2.0.0",
			label: "Test prompt",
			template: "Prompt for " + "$" + "{devType}",
		});
		assert.equal(prompt.version, "2.0.0");

		const consumerSession = await store.saveConsumerSession({
			profileId: "consumer-session",
			provider: "consumer-session",
			material: { demoResponse: "consumer demo reply" },
			source: "manual-import",
		});
		assert.equal(consumerSession.profileId, "consumer-session");

		await db.putCache({
			cacheKey: "cache-key",
			provider: "local-demo",
			model: "demo-model",
			promptVersion: "1.0.0",
			personalizationProfile: "local-operator",
			response: { text: "cached reply" },
			provenance: { provider: "local-demo" },
		});
		const cached = await db.getCache("cache-key");
		assert.equal(cached.response.text, "cached reply");

		await db.saveSession({
			id: "session-1",
			mode: "static",
			createdAt: new Date().toISOString(),
			config: { devType: "backend" },
			selectedFamilies: ["code_analyzer"],
			provenance: null,
			events: [
				{
					eventType: "activity",
					sequence: 1,
					message: "hello",
					timestamp: new Date().toISOString(),
					context: { family: "code_analyzer" },
				},
			],
		});
		const session = await db.getSession("session-1");
		assert.equal(session.selectedFamilies[0], "code_analyzer");
	} finally {
		await rm(stateRoot, { recursive: true, force: true });
	}
});
