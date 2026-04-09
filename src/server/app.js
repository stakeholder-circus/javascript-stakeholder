import { randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { formatAnsiLine } from "../shared/ansi.js";
import { listValues, runDeterministicSession } from "../shared/engine.js";
import {
	bootstrapExperimentalBrowser,
	buildExperimentalProvenance,
	importExperimentalSession,
	runExperimentalGeneration,
} from "./providers/index.js";
import { createEncryptedStore } from "./store/encrypted-files.js";
import { createRuntimeDb } from "./store/runtime-db.js";

const CURRENT_DIR = path.dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = path.join(CURRENT_DIR, "..", "web");
const MIME_TYPES = {
	".css": "text/css; charset=utf-8",
	".html": "text/html; charset=utf-8",
	".js": "application/javascript; charset=utf-8",
	".json": "application/json; charset=utf-8",
};
const STREAM_STEP_DELAY_MS = 8;
const STREAM_RETENTION_MS = 5 * 60 * 1000;

function json(response, statusCode, payload) {
	response.writeHead(statusCode, { "content-type": "application/json; charset=utf-8" });
	response.end(JSON.stringify(payload, null, 2));
}

function notFound(response) {
	json(response, 404, { error: "not_found" });
}

async function readBody(request) {
	const chunks = [];
	for await (const chunk of request) {
		chunks.push(chunk);
	}
	if (chunks.length === 0) {
		return {};
	}
	const body = Buffer.concat(chunks).toString("utf8");
	return JSON.parse(body);
}

function sessionSummary(session) {
	return {
		id: session.id,
		mode: session.mode,
		createdAt: session.createdAt,
		config: session.config,
		selectedFamilies: session.selectedFamilies,
		provenance: session.provenance,
	};
}

function addTerminalFields(events) {
	return events.map((event) => ({
		...event,
		terminal: formatAnsiLine(event),
	}));
}

function buildExperimentalEvent(sequence, session, text, provenance) {
	return {
		eventType: "activity",
		sequence,
		message: text,
		timestamp: new Date().toISOString(),
		context: {
			family: "experimental_live_provider",
			group: "experimental",
			mode: "experimental",
			project: session.config.project,
			provider: provenance.provider,
			model: provenance.model,
			adapterMode: provenance.adapterMode,
			promptVersion: provenance.promptVersion,
			traceRow: `javascript-stakeholder:experimental:${provenance.provider}:${provenance.promptVersion}`,
		},
		provenance,
	};
}

async function buildStaticSession(config) {
	const base = runDeterministicSession(config);
	const createdAt = new Date().toISOString();
	return {
		id: config.sessionId ?? base.id ?? `session-${randomUUID()}`,
		createdAt,
		mode: "static",
		config: base.config,
		selectedFamilies: base.selectedFamilies ?? [],
		provenance: null,
		events: addTerminalFields(base.events ?? []),
	};
}

async function buildExperimentalSession(runtime, input) {
	const base = runDeterministicSession({
		...input,
		outputFormat: "json",
	});
	const selectedFamilies = base.selectedFamilies ?? [];
	const generation = await runExperimentalGeneration(runtime, {
		sessionConfig: base.config,
		selectedFamilies,
		experimentalProvider: input.experimentalProvider,
		experimentalModel: input.experimentalModel,
		experimentalProfile: input.experimentalProfile,
		experimentalPrompt: input.experimentalPrompt,
		experimentalAdapterMode: input.experimentalAdapterMode,
		experimentalSessionMaterial: input.experimentalSessionMaterial,
		personalizationProfile: input.personalizationProfile,
	});

	const provenance = buildExperimentalProvenance({
		profile: generation.profile,
		model: input.experimentalModel || generation.profile.model,
		adapterMode: input.experimentalAdapterMode,
		promptAsset: generation.promptAsset,
		cache: generation.cache,
		personalizationProfile: generation.personalizationProfile,
	});

	const baseEvents = [...(base.events ?? [])];
	const endEvent = baseEvents.pop() ?? {
		eventType: "session.end",
		sequence: baseEvents.length + 1,
		message: "session complete",
		timestamp: new Date().toISOString(),
		context: { mode: "experimental" },
	};

	baseEvents.push(
		buildExperimentalEvent(baseEvents.length + 1, base, generation.text, provenance),
		{
			...endEvent,
			sequence: baseEvents.length + 2,
			context: {
				...(endEvent.context ?? {}),
				mode: "experimental",
				provider: provenance.provider,
				promptVersion: provenance.promptVersion,
			},
			provenance,
		},
	);

	return {
		id: input.sessionId ?? base.id ?? `session-${randomUUID()}`,
		createdAt: new Date().toISOString(),
		mode: "experimental",
		config: base.config,
		selectedFamilies,
		provenance,
		events: addTerminalFields(baseEvents),
	};
}

async function serveStaticAsset(response, requestPath) {
	const resolvedPath = requestPath === "/" ? "/index.html" : requestPath;
	const assetPath = path.join(WEB_ROOT, resolvedPath.replace(/^\/+/, ""));
	if (!assetPath.startsWith(WEB_ROOT)) {
		notFound(response);
		return;
	}

	try {
		const payload = await fs.readFile(assetPath);
		const contentType = MIME_TYPES[path.extname(assetPath)] ?? "application/octet-stream";
		response.writeHead(200, { "content-type": contentType });
		response.end(payload);
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			notFound(response);
			return;
		}
		throw error;
	}
}

function writeSseEvent(response, event) {
	response.write(`data: ${JSON.stringify(event)}\n\n`);
}

function delay(ms) {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

function createLiveSessionSnapshot(liveSession) {
	return {
		id: liveSession.id,
		mode: liveSession.mode,
		createdAt: liveSession.createdAt,
		config: liveSession.config,
		selectedFamilies: liveSession.selectedFamilies,
		provenance: liveSession.provenance,
		events: liveSession.events,
		complete: liveSession.completed,
	};
}

function closeLiveSession(liveSession) {
	for (const response of liveSession.listeners) {
		response.end();
	}
	liveSession.listeners.clear();
}

function scheduleLiveSessionRemoval(liveSessions, liveSession) {
	setTimeout(() => {
		liveSessions.delete(liveSession.id);
	}, STREAM_RETENTION_MS).unref?.();
}

async function pumpLiveSession(liveSessions, db, liveSession, session) {
	liveSession.mode = session.mode;
	liveSession.config = session.config;
	liveSession.selectedFamilies = session.selectedFamilies;
	liveSession.provenance = session.provenance;

	for (const event of session.events) {
		liveSession.events.push(event);
		for (const response of liveSession.listeners) {
			writeSseEvent(response, event);
		}
		await delay(STREAM_STEP_DELAY_MS);
	}

	liveSession.completed = true;
	await db.saveSession({
		...session,
		events: [...liveSession.events],
	});
	closeLiveSession(liveSession);
	scheduleLiveSessionRemoval(liveSessions, liveSession);
}

export async function createServerApp(options = {}) {
	const store = await createEncryptedStore({ stateRoot: options.stateRoot });
	const db = await createRuntimeDb({ stateRoot: store.stateRoot });
	const runtime = { store, db };
	const liveSessions = new Map();

	function startLiveSession(mode, _config, buildSession) {
		const id = `session-${randomUUID()}`;
		const liveSession = {
			id,
			mode,
			createdAt: new Date().toISOString(),
			config: null,
			selectedFamilies: [],
			provenance: null,
			events: [],
			listeners: new Set(),
			completed: false,
		};
		liveSessions.set(id, liveSession);
		Promise.resolve()
			.then(() => buildSession(id))
			.then((session) => pumpLiveSession(liveSessions, db, liveSession, session))
			.catch(async (error) => {
				const failureEvent = {
					eventType: "session.error",
					sequence: liveSession.events.length,
					message: error instanceof Error ? error.message : String(error),
					timestamp: new Date().toISOString(),
					context: {
						mode,
						result: "error",
					},
				};
				liveSession.events.push(failureEvent);
				for (const listener of liveSession.listeners) {
					writeSseEvent(listener, failureEvent);
				}
				liveSession.completed = true;
				await db.saveSession(createLiveSessionSnapshot(liveSession));
				closeLiveSession(liveSession);
				scheduleLiveSessionRemoval(liveSessions, liveSession);
			});
		return liveSession;
	}

	const server = createServer(async (request, response) => {
		const requestUrl = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);

		try {
			if (request.method === "GET" && requestUrl.pathname === "/api/list-values") {
				const recentLiveSessions = Array.from(liveSessions.values())
					.map((session) => sessionSummary(createLiveSessionSnapshot(session)))
					.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
				const recentPersistedSessions = await db.listSessions(6);
				json(response, 200, {
					...listValues(),
					providerProfiles: await store.listProviderProfiles(),
					promptAssets: await store.listPromptAssets(),
					personalizationProfiles: await store.listPersonalizationProfiles(),
					recentSessions: [
						...recentLiveSessions,
						...recentPersistedSessions
							.filter((session) => !liveSessions.has(session.id))
							.map(sessionSummary),
					].slice(0, 6),
				});
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/sessions/static") {
				const body = await readBody(request);
				const session = startLiveSession(
					"static",
					body,
					async (sessionId) => await buildStaticSession({ ...body, sessionId }),
				);
				json(response, 200, { id: session.id, selectedFamilies: session.selectedFamilies });
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/sessions/experimental") {
				const body = await readBody(request);
				const session = startLiveSession(
					"experimental",
					body,
					async (sessionId) => await buildExperimentalSession(runtime, { ...body, sessionId }),
				);
				json(response, 200, { id: session.id, selectedFamilies: session.selectedFamilies });
				return;
			}

			if (
				request.method === "GET" &&
				requestUrl.pathname.startsWith("/api/sessions/") &&
				requestUrl.pathname.endsWith("/stream")
			) {
				const sessionId = decodeURIComponent(requestUrl.pathname.split("/")[3] ?? "");
				const liveSession = liveSessions.get(sessionId);
				if (liveSession) {
					response.writeHead(200, {
						"content-type": "text/event-stream; charset=utf-8",
						"cache-control": "no-cache",
						connection: "keep-alive",
					});
					for (const event of liveSession.events) {
						writeSseEvent(response, event);
					}
					if (liveSession.completed) {
						response.end();
						return;
					}
					liveSession.listeners.add(response);
					request.on("close", () => {
						liveSession.listeners.delete(response);
					});
					return;
				}
				const session = await db.getSession(sessionId);
				if (!session) {
					notFound(response);
					return;
				}
				response.writeHead(200, {
					"content-type": "text/event-stream; charset=utf-8",
					"cache-control": "no-cache",
					connection: "keep-alive",
				});
				for (const event of session.events) {
					writeSseEvent(response, event);
				}
				response.end();
				return;
			}

			if (
				request.method === "GET" &&
				requestUrl.pathname.startsWith("/api/sessions/") &&
				requestUrl.pathname.endsWith("/export")
			) {
				const sessionId = decodeURIComponent(requestUrl.pathname.split("/")[3] ?? "");
				const liveSession = liveSessions.get(sessionId);
				if (liveSession) {
					json(response, 200, createLiveSessionSnapshot(liveSession));
					return;
				}
				const session = await db.getSession(sessionId);
				if (!session) {
					notFound(response);
					return;
				}
				json(response, 200, session);
				return;
			}

			if (request.method === "GET" && requestUrl.pathname === "/api/experimental/profiles") {
				json(response, 200, { profiles: await store.listProviderProfiles() });
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/experimental/profiles") {
				const body = await readBody(request);
				const profile = await store.upsertProviderProfile(body);
				json(response, 200, { profile });
				return;
			}

			if (request.method === "GET" && requestUrl.pathname === "/api/experimental/prompts") {
				json(response, 200, { prompts: await store.listPromptAssets() });
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/experimental/prompts") {
				const body = await readBody(request);
				const prompt = await store.upsertPromptAsset(body);
				json(response, 200, { prompt });
				return;
			}

			if (request.method === "POST" && requestUrl.pathname === "/api/experimental/session-import") {
				const body = await readBody(request);
				const record = await importExperimentalSession(store, {
					profileId:
						body.profileId ??
						body.experimentalProfile ??
						body.experimentalProvider ??
						"consumer-session",
					provider: body.provider ?? "consumer-session",
					material: body.material ?? body.experimentalSessionMaterial,
					source: body.source ?? "manual-import",
				});
				json(response, 200, { sessionImport: record });
				return;
			}

			if (
				request.method === "POST" &&
				requestUrl.pathname === "/api/experimental/browser-bootstrap"
			) {
				const body = await readBody(request);
				const profile =
					(await store.getProviderProfile(
						body.profileId ?? body.experimentalProfile ?? body.experimentalProvider,
					)) ?? (await store.getProviderProfile("consumer-session"));
				if (!profile) {
					json(response, 400, { error: "consumer_session_profile_missing" });
					return;
				}
				const record = await bootstrapExperimentalBrowser(store, {
					profile,
					executablePath: body.executablePath,
					timeoutMs: body.timeoutMs,
					headless: body.headless,
				});
				json(response, 200, { sessionImport: record });
				return;
			}

			if (
				request.method === "GET" &&
				(requestUrl.pathname === "/" ||
					requestUrl.pathname.startsWith("/web/") ||
					requestUrl.pathname.endsWith(".js") ||
					requestUrl.pathname.endsWith(".css") ||
					requestUrl.pathname.endsWith(".html"))
			) {
				const webPath = requestUrl.pathname.startsWith("/web/")
					? requestUrl.pathname.replace(/^\/web/, "")
					: requestUrl.pathname;
				await serveStaticAsset(response, webPath);
				return;
			}

			notFound(response);
		} catch (error) {
			json(response, 500, {
				error: "internal_error",
				message: error instanceof Error ? error.message : String(error),
			});
		}
	});

	return {
		stateRoot: store.stateRoot,
		async listen(port = 3344, host = "127.0.0.1") {
			await new Promise((resolve, reject) => {
				server.once("error", reject);
				server.listen(port, host, () => resolve());
			});
			const address = server.address();
			return {
				server,
				port: typeof address === "object" && address ? address.port : port,
				host,
				close: async () => {
					await new Promise((resolve, reject) =>
						server.close((error) => (error ? reject(error) : resolve())),
					);
				},
			};
		},
	};
}
