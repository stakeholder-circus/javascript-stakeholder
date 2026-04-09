function extractText(payload) {
	return (payload.content ?? [])
		.filter((entry) => entry.type === "text" && typeof entry.text === "string")
		.map((entry) => entry.text)
		.join("\n\n")
		.trim();
}

export async function generateAnthropic(input) {
	const { profile, promptAsset, sessionConfig, personalizationProfile } = input;
	const apiKey = profile.apiKey ?? process.env[profile.apiKeyEnv ?? "ANTHROPIC_API_KEY"];
	if (!apiKey) {
		throw new Error(
			`Missing API key for ${profile.id}. Set ${profile.apiKeyEnv ?? "ANTHROPIC_API_KEY"} or store apiKey in the encrypted profile.`,
		);
	}

	const response = await fetch(profile.baseUrl ?? "https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": profile.apiVersion ?? "2023-06-01",
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: input.model,
			max_tokens: profile.maxTokens ?? 900,
			system: "You generate concise terminal-ready engineering session output.",
			messages: [
				{
					role: "user",
					content: input.promptText,
				},
			],
			metadata: {
				profile: profile.id,
				promptAsset: promptAsset.id,
				promptVersion: promptAsset.version,
				personalizationProfile: personalizationProfile?.id ?? "local-operator",
				devType: sessionConfig.devType,
			},
		}),
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Anthropic request failed (${response.status}): ${body}`);
	}

	const payload = await response.json();
	const text = extractText(payload);
	if (!text) {
		throw new Error("Anthropic response did not include text content.");
	}

	return {
		text,
		raw: payload,
	};
}
