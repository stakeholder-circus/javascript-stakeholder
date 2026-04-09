import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

const SECRET_ENV = "STAKEHOLDER_ENCRYPTION_KEY";
const SECRET_DIR = ".secrets";
const DATA_DIR = "encrypted";

const DEFAULT_PROVIDER_PROFILES = [
	{
		id: "local-demo",
		provider: "local-demo",
		label: "Local demo provider",
		adapterModes: ["api", "consumer"],
		model: "deterministic-demo",
	},
	{
		id: "openai-compatible",
		provider: "openai-compatible",
		label: "OpenAI-compatible API",
		baseUrl: "https://api.openai.com/v1/responses",
		apiKeyEnv: "OPENAI_API_KEY",
		model: "gpt-5.4-mini",
		adapterModes: ["api"],
	},
	{
		id: "anthropic",
		provider: "anthropic",
		label: "Anthropic API",
		baseUrl: "https://api.anthropic.com/v1/messages",
		apiKeyEnv: "ANTHROPIC_API_KEY",
		model: "claude-sonnet-4-5",
		adapterModes: ["api"],
	},
	{
		id: "consumer-session",
		provider: "consumer-session",
		label: "Consumer session adapter",
		captureUrl: "https://chatgpt.com/",
		adapterModes: ["consumer"],
		requestTemplate: {
			method: "POST",
			url: "",
			headers: {},
			bodyTemplate: '{"prompt":"' + "$" + '{prompt}"}',
			responsePath: "text",
		},
	},
	{
		id: "openai-consumer",
		provider: "consumer-session",
		label: "OpenAI consumer session",
		captureUrl: "https://chatgpt.com/",
		captureSelector: 'textarea, [contenteditable="true"]',
		adapterModes: ["consumer"],
		requestTemplate: {
			method: "POST",
			url: "",
			headers: {},
			bodyTemplate: '{"prompt":"' + "$" + '{prompt}"}',
			responsePath: "text",
		},
	},
	{
		id: "claude-consumer",
		provider: "consumer-session",
		label: "Claude consumer session",
		captureUrl: "https://claude.ai/",
		captureSelector: 'textarea, [contenteditable="true"]',
		adapterModes: ["consumer"],
		requestTemplate: {
			method: "POST",
			url: "",
			headers: {},
			bodyTemplate: '{"prompt":"' + "$" + '{prompt}"}',
			responsePath: "text",
		},
	},
];

const DEFAULT_PROMPT_ASSETS = [
	{
		id: "operator-brief",
		version: "1.0.0",
		label: "Operator brief",
		template:
			"Generate a concise stakeholder session for " +
			"$" +
			"{devType} using " +
			"$" +
			"{complexity} complexity and " +
			"$" +
			"{jargon} jargon. Project: " +
			"$" +
			"{project}. Framework: " +
			"$" +
			"{framework}. Families: " +
			"$" +
			"{families}.",
	},
	{
		id: "provider-narrative",
		version: "1.0.0",
		label: "Provider narrative",
		template:
			"Produce a terminal-ready engineering narrative for " +
			"$" +
			"{devType}. Emphasize " +
			"$" +
			"{families}. Keep provenance-friendly structure and mention the project " +
			"$" +
			"{project}.",
	},
];

const DEFAULT_PERSONALIZATION_PROFILES = [
	{
		id: "local-operator",
		label: "Local operator",
		description: "Default local operator profile for deterministic and experimental sessions.",
	},
];

function withDefaults(entries, defaults) {
	const byId = new Map(defaults.map((entry) => [entry.id, entry]));
	for (const entry of entries) {
		if (entry?.id) {
			byId.set(entry.id, { ...byId.get(entry.id), ...entry });
		}
	}
	return [...byId.values()];
}

export function resolveStateRoot() {
	return (
		process.env.STAKEHOLDER_STATE_DIR ??
		path.join(os.homedir(), ".stakeholder", "javascript-stakeholder")
	);
}

async function ensureDirectory(targetPath) {
	await fs.mkdir(targetPath, { recursive: true });
	return targetPath;
}

async function readJsonIfExists(targetPath) {
	try {
		return JSON.parse(await fs.readFile(targetPath, "utf8"));
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			return null;
		}
		throw error;
	}
}

async function resolveSecretKey(stateRoot) {
	const envValue = process.env[SECRET_ENV];
	if (envValue) {
		return createHash("sha256").update(envValue).digest();
	}

	const secretDir = await ensureDirectory(path.join(stateRoot, SECRET_DIR));
	const secretPath = path.join(secretDir, "master.key");
	try {
		const existing = await fs.readFile(secretPath, "utf8");
		return Buffer.from(existing.trim(), "base64");
	} catch (error) {
		if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
			throw error;
		}
	}

	const generated = randomBytes(32);
	await fs.writeFile(secretPath, generated.toString("base64"), { mode: 0o600 });
	return generated;
}

function encryptPayload(key, payload) {
	const iv = randomBytes(12);
	const cipher = createCipheriv("aes-256-gcm", key, iv);
	const ciphertext = Buffer.concat([cipher.update(payload, "utf8"), cipher.final()]);
	const tag = cipher.getAuthTag();
	return JSON.stringify({
		algorithm: "aes-256-gcm",
		iv: iv.toString("base64"),
		tag: tag.toString("base64"),
		ciphertext: ciphertext.toString("base64"),
	});
}

function decryptPayload(key, payload) {
	const parsed = JSON.parse(payload);
	const decipher = createDecipheriv(parsed.algorithm, key, Buffer.from(parsed.iv, "base64"));
	decipher.setAuthTag(Buffer.from(parsed.tag, "base64"));
	const plaintext = Buffer.concat([
		decipher.update(Buffer.from(parsed.ciphertext, "base64")),
		decipher.final(),
	]);
	return plaintext.toString("utf8");
}

async function readEncryptedFile(targetPath, key, fallback) {
	try {
		const payload = await fs.readFile(targetPath, "utf8");
		return JSON.parse(decryptPayload(key, payload));
	} catch (error) {
		if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
			return fallback;
		}
		throw error;
	}
}

async function writeEncryptedFile(targetPath, key, payload) {
	const serialized = encryptPayload(key, JSON.stringify(payload, null, 2));
	await fs.writeFile(targetPath, serialized, { mode: 0o600 });
}

function stampRecord(record) {
	return {
		updatedAt: new Date().toISOString(),
		...record,
	};
}

export async function createEncryptedStore(options = {}) {
	const stateRoot = options.stateRoot ?? resolveStateRoot();
	const dataRoot = await ensureDirectory(path.join(stateRoot, DATA_DIR));
	const key = await resolveSecretKey(stateRoot);

	const files = {
		providerProfiles: path.join(dataRoot, "provider-profiles.json.enc"),
		promptAssets: path.join(dataRoot, "prompt-assets.json.enc"),
		personalizationProfiles: path.join(dataRoot, "personalization-profiles.json.enc"),
		consumerSessions: path.join(dataRoot, "consumer-sessions.json.enc"),
	};

	const metadataPath = path.join(stateRoot, "metadata.json");
	const metadata = (await readJsonIfExists(metadataPath)) ?? {
		createdAt: new Date().toISOString(),
	};
	await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));

	async function listProviderProfiles() {
		const stored = await readEncryptedFile(files.providerProfiles, key, []);
		const merged = withDefaults(stored, DEFAULT_PROVIDER_PROFILES);
		if (stored.length !== merged.length) {
			await writeEncryptedFile(files.providerProfiles, key, merged);
		}
		return merged;
	}

	async function upsertProviderProfile(profile) {
		const current = await listProviderProfiles();
		const next = withDefaults([stampRecord(profile)], current);
		await writeEncryptedFile(files.providerProfiles, key, next);
		return next.find((entry) => entry.id === profile.id) ?? profile;
	}

	async function getProviderProfile(id) {
		const profiles = await listProviderProfiles();
		return profiles.find((entry) => entry.id === id || entry.provider === id) ?? null;
	}

	async function listPromptAssets() {
		const stored = await readEncryptedFile(files.promptAssets, key, []);
		const merged = withDefaults(stored, DEFAULT_PROMPT_ASSETS);
		if (stored.length !== merged.length) {
			await writeEncryptedFile(files.promptAssets, key, merged);
		}
		return merged;
	}

	async function upsertPromptAsset(asset) {
		const current = await listPromptAssets();
		const baseId =
			asset.id ??
			asset.label
				?.toLowerCase()
				.replace(/[^a-z0-9]+/g, "-")
				.replace(/^-|-$/g, "") ??
			`prompt-${Date.now()}`;
		const stamped = stampRecord({ ...asset, id: baseId, version: asset.version ?? "1.0.0" });
		const next = withDefaults([stamped], current);
		await writeEncryptedFile(files.promptAssets, key, next);
		return next.find((entry) => entry.id === stamped.id) ?? stamped;
	}

	async function getPromptAsset(idOrLiteral) {
		const prompts = await listPromptAssets();
		const byId = prompts.find((entry) => entry.id === idOrLiteral || entry.label === idOrLiteral);
		if (byId) {
			return byId;
		}
		if (!idOrLiteral) {
			return prompts[0] ?? null;
		}
		const literalId = `literal-${createHash("sha256").update(idOrLiteral).digest("hex").slice(0, 12)}`;
		return {
			id: literalId,
			version: "literal",
			label: "Literal prompt",
			template: idOrLiteral,
			literal: true,
		};
	}

	async function listPersonalizationProfiles() {
		const stored = await readEncryptedFile(files.personalizationProfiles, key, []);
		const merged = withDefaults(stored, DEFAULT_PERSONALIZATION_PROFILES);
		if (stored.length !== merged.length) {
			await writeEncryptedFile(files.personalizationProfiles, key, merged);
		}
		return merged;
	}

	async function saveConsumerSession(record) {
		const sessions = await readEncryptedFile(files.consumerSessions, key, []);
		const nextRecord = stampRecord({
			id: record.id ?? `consumer-${Date.now()}`,
			profileId: record.profileId ?? "consumer-session",
			provider: record.provider ?? "consumer-session",
			material: record.material,
			source: record.source ?? "manual-import",
			capturedAt: record.capturedAt ?? new Date().toISOString(),
		});
		const next = [...sessions.filter((entry) => entry.id !== nextRecord.id), nextRecord];
		await writeEncryptedFile(files.consumerSessions, key, next);
		return nextRecord;
	}

	async function getLatestConsumerSession(profileId) {
		const sessions = await readEncryptedFile(files.consumerSessions, key, []);
		const filtered = sessions.filter(
			(entry) => !profileId || entry.profileId === profileId || entry.provider === profileId,
		);
		return (
			filtered.sort((left, right) => right.capturedAt.localeCompare(left.capturedAt))[0] ?? null
		);
	}

	async function exportStateBundle() {
		return {
			providerProfiles: await listProviderProfiles(),
			promptAssets: await listPromptAssets(),
			personalizationProfiles: await listPersonalizationProfiles(),
			hasConsumerSessions: Boolean(await getLatestConsumerSession()),
		};
	}

	return {
		stateRoot,
		listProviderProfiles,
		upsertProviderProfile,
		getProviderProfile,
		listPromptAssets,
		upsertPromptAsset,
		getPromptAsset,
		listPersonalizationProfiles,
		saveConsumerSession,
		getLatestConsumerSession,
		exportStateBundle,
	};
}
