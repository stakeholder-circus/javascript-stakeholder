import { createHash } from "node:crypto";

import { buildCacheKey } from "../store/runtime-db.js";
import { generateAnthropic } from "./anthropic.js";
import {
	bootstrapBrowserSession,
	generateFromConsumerSession,
	importConsumerSessionMaterial,
} from "./consumer-session.js";
import { generateOpenAiCompatible } from "./openai-compatible.js";

function fillTemplate(template, values) {
	return String(template).replace(/\$\{([^}]+)\}/g, (_match, key) => values[key] ?? "");
}

function resolvePersonalizationProfile(profiles, id) {
	return profiles.find((entry) => entry.id === id) ?? profiles[0] ?? null;
}

function createLocalDemoOutput(input) {
	const families = input.selectedFamilies.join(", ");
	const lines = [
		`Local demo provider staged ${input.sessionConfig.devType} output for ${families}.`,
		`Prompt version ${input.promptAsset.version} and profile ${input.profile.id} are attached for provenance.`,
		`Project ${input.sessionConfig.project} / framework ${input.sessionConfig.framework} remained in the experimental boundary.`,
	];
	return {
		text: lines.join(" "),
		raw: {
			provider: "local-demo",
			families: input.selectedFamilies,
		},
	};
}

export async function importExperimentalSession(store, payload) {
	return await importConsumerSessionMaterial(store, payload);
}

export async function bootstrapExperimentalBrowser(store, payload) {
	return await bootstrapBrowserSession(store, payload);
}

export async function runExperimentalGeneration(runtime, input) {
	const profiles = await runtime.store.listProviderProfiles();
	const prompts = await runtime.store.listPromptAssets();
	const personalizationProfiles = await runtime.store.listPersonalizationProfiles();

	const profile =
		(await runtime.store.getProviderProfile(input.experimentalProfile)) ??
		profiles.find(
			(entry) =>
				entry.id === input.experimentalProvider || entry.provider === input.experimentalProvider,
		) ??
		profiles[0];
	if (!profile) {
		throw new Error(`No provider profile is configured for ${input.experimentalProvider}.`);
	}

	const promptAsset = (await runtime.store.getPromptAsset(input.experimentalPrompt)) ?? prompts[0];
	if (!promptAsset) {
		throw new Error("No prompt asset is available for experimental generation.");
	}

	const personalizationProfile = resolvePersonalizationProfile(
		personalizationProfiles,
		input.personalizationProfile,
	);

	const promptText = fillTemplate(promptAsset.template, {
		devType: input.sessionConfig.devType,
		complexity: input.sessionConfig.complexity,
		jargon: input.sessionConfig.jargon,
		project: input.sessionConfig.project,
		framework: input.sessionConfig.framework,
		families: input.selectedFamilies.join(", "),
	});

	const cacheKey = buildCacheKey({
		provider: profile.provider,
		model: input.experimentalModel || profile.model,
		promptVersion: promptAsset.version,
		promptAsset: promptAsset.id,
		profile: profile.id,
		personalizationProfile: personalizationProfile?.id ?? null,
		config: input.sessionConfig,
		selectedFamilies: input.selectedFamilies,
	});

	const cached = await runtime.db.getCache(cacheKey);
	if (cached) {
		return {
			text: cached.response.text,
			raw: cached.response.raw,
			cache: { hit: true, key: cacheKey, createdAt: cached.createdAt },
			promptAsset,
			profile,
			personalizationProfile,
		};
	}

	const generationInput = {
		profile,
		promptAsset,
		personalizationProfile,
		sessionConfig: input.sessionConfig,
		selectedFamilies: input.selectedFamilies,
		promptText,
		model: input.experimentalModel || profile.model,
	};

	let result;
	switch (profile.provider) {
		case "local-demo":
			result = createLocalDemoOutput(generationInput);
			break;
		case "openai-compatible":
			result = await generateOpenAiCompatible(generationInput);
			break;
		case "anthropic":
			result = await generateAnthropic(generationInput);
			break;
		case "consumer-session": {
			const consumerSession = input.experimentalSessionMaterial
				? await runtime.store.saveConsumerSession({
						profileId: profile.id,
						provider: profile.provider,
						material:
							typeof input.experimentalSessionMaterial === "string"
								? JSON.parse(input.experimentalSessionMaterial)
								: input.experimentalSessionMaterial,
						source: "inline-session",
					})
				: await runtime.store.getLatestConsumerSession(profile.id);
			result = await generateFromConsumerSession({
				...generationInput,
				consumerSession,
			});
			break;
		}
		default:
			throw new Error(`Unsupported experimental provider ${profile.provider}.`);
	}

	const cacheEntry = {
		cacheKey,
		provider: profile.provider,
		model: generationInput.model,
		promptVersion: promptAsset.version,
		personalizationProfile: personalizationProfile?.id ?? null,
		response: result,
		provenance: {
			provider: profile.provider,
			model: generationInput.model,
			adapterMode: input.experimentalAdapterMode,
			promptVersion: promptAsset.version,
			cache: { hit: false, key: cacheKey },
			personalizationProfile: personalizationProfile?.id ?? null,
			timestamp: new Date().toISOString(),
			promptAsset: promptAsset.id,
		},
	};
	await runtime.db.putCache(cacheEntry);

	return {
		...result,
		cache: { hit: false, key: cacheKey },
		promptAsset,
		profile,
		personalizationProfile,
	};
}

export function buildExperimentalProvenance(input) {
	return {
		provider: input.profile.provider,
		model: input.model,
		adapterMode: input.adapterMode,
		promptVersion: input.promptAsset.version,
		cache: input.cache,
		personalizationProfile: input.personalizationProfile?.id ?? null,
		timestamp: new Date().toISOString(),
		promptAsset: input.promptAsset.id,
		provenanceId: createHash("sha256")
			.update(`${input.profile.id}:${input.model}:${input.promptAsset.version}:${input.cache.key}`)
			.digest("hex")
			.slice(0, 16),
	};
}
