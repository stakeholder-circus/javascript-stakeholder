function normalizeUrl(profile) {
	const baseUrl = profile.baseUrl ?? "https://api.openai.com/v1/responses";
	if (baseUrl.endsWith("/responses")) {
		return baseUrl;
	}
	if (baseUrl.endsWith("/v1")) {
		return `${baseUrl}/responses`;
	}
	return `${baseUrl.replace(/\/$/, "")}/v1/responses`;
}

function extractOutputText(payload) {
	if (typeof payload.output_text === "string" && payload.output_text.length > 0) {
		return payload.output_text;
	}
	const segments = [];
	for (const output of payload.output ?? []) {
		for (const content of output.content ?? []) {
			if (content.type === "output_text" && typeof content.text === "string") {
				segments.push(content.text);
			}
		}
	}
	return segments.join("\n\n").trim();
}

export async function generateOpenAiCompatible(input) {
	const { profile, promptAsset, sessionConfig, personalizationProfile } = input;
	const apiKey = profile.apiKey ?? process.env[profile.apiKeyEnv ?? "OPENAI_API_KEY"];
	if (!apiKey) {
		throw new Error(
			`Missing API key for ${profile.id}. Set ${profile.apiKeyEnv ?? "OPENAI_API_KEY"} or store apiKey in the encrypted profile.`,
		);
	}

	const response = await fetch(normalizeUrl(profile), {
		method: "POST",
		headers: {
			authorization: `Bearer ${apiKey}`,
			"content-type": "application/json",
		},
		body: JSON.stringify({
			model: input.model,
			input: [
				{
					role: "system",
					content: [
						{
							type: "input_text",
							text: "You generate concise terminal-ready engineering session output.",
						},
					],
				},
				{
					role: "user",
					content: [{ type: "input_text", text: input.promptText }],
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
		throw new Error(`OpenAI-compatible request failed (${response.status}): ${body}`);
	}

	const payload = await response.json();
	const text = extractOutputText(payload);
	if (!text) {
		throw new Error("OpenAI-compatible response did not include output text.");
	}

	return {
		text,
		raw: payload,
	};
}
