import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createServerApp } from "../src/server/app.js";

test("server exposes list-values, static sessions, SSE replay, and experimental local-demo sessions", async () => {
	const stateRoot = await mkdtemp(path.join(os.tmpdir(), "javascript-stakeholder-"));
	const app = await createServerApp({ stateRoot });
	const listener = await app.listen(0);
	const baseUrl = `http://${listener.host}:${listener.port}`;

	try {
		const listResponse = await fetch(`${baseUrl}/api/list-values`);
		assert.equal(listResponse.status, 200);
		const listBody = await listResponse.json();
		assert.ok(Array.isArray(listBody.devTypes));
		assert.ok(Array.isArray(listBody.providerProfiles));
		assert.ok(listBody.experimentalProviders.includes("local-demo"));
		assert.ok(listBody.providerProfiles.some((profile) => profile.id === "openai-consumer"));
		assert.ok(listBody.providerProfiles.some((profile) => profile.id === "claude-consumer"));

		const staticResponse = await fetch(`${baseUrl}/api/sessions/static`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({ devType: "backend", seed: "server-seed", trace: true }),
		});
		assert.equal(staticResponse.status, 200);
		const staticBody = await staticResponse.json();
		assert.ok(staticBody.id);

		const streamResponse = await fetch(
			`${baseUrl}/api/sessions/${encodeURIComponent(staticBody.id)}/stream`,
		);
		const streamText = await streamResponse.text();
		assert.match(streamText, /data:/);
		assert.match(streamText, /session.end/);

		const exportResponse = await fetch(
			`${baseUrl}/api/sessions/${encodeURIComponent(staticBody.id)}/export`,
		);
		const exported = await exportResponse.json();
		assert.ok(Array.isArray(exported.events));
		assert.ok(exported.events.some((event) => event.eventType === "session.end"));

		const importResponse = await fetch(`${baseUrl}/api/experimental/session-import`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				experimentalProvider: "openai-consumer",
				material: { sessionToken: "manual-token" },
			}),
		});
		assert.equal(importResponse.status, 200);
		const importBody = await importResponse.json();
		assert.equal(importBody.sessionImport.profileId, "openai-consumer");

		const experimentalResponse = await fetch(`${baseUrl}/api/sessions/experimental`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify({
				devType: "machine-learning",
				seed: "exp-seed",
				experimentalProvider: "local-demo",
				experimentalProfile: "local-demo",
				experimentalPrompt: "operator-brief",
				experimentalModel: "deterministic-demo",
				experimentalAdapterMode: "api",
			}),
		});
		assert.equal(experimentalResponse.status, 200);
		const experimentalBody = await experimentalResponse.json();
		const experimentalStream = await fetch(
			`${baseUrl}/api/sessions/${encodeURIComponent(experimentalBody.id)}/stream`,
		);
		const experimentalStreamText = await experimentalStream.text();
		assert.match(experimentalStreamText, /data:/);
		const experimentalExport = await fetch(
			`${baseUrl}/api/sessions/${encodeURIComponent(experimentalBody.id)}/export`,
		).then((response) => response.json());
		assert.ok(
			experimentalExport.events.some((event) => event.provenance?.provider === "local-demo"),
		);
	} finally {
		await listener.close();
		await rm(stateRoot, { recursive: true, force: true });
	}
});
