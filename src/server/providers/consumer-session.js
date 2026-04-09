function applyTemplate(template, values) {
	return String(template).replace(/\$\{([^}]+)\}/g, (_match, key) => values[key] ?? "");
}

function resolvePath(payload, pathExpression) {
	if (!pathExpression) {
		return payload;
	}
	return String(pathExpression)
		.split(".")
		.filter(Boolean)
		.reduce((current, key) => (current == null ? undefined : current[key]), payload);
}

function safeParse(rawValue) {
	if (!rawValue) {
		return null;
	}
	try {
		return JSON.parse(rawValue);
	} catch {
		return { raw: rawValue };
	}
}

export async function importConsumerSessionMaterial(store, input) {
	const material = typeof input.material === "string" ? safeParse(input.material) : input.material;
	if (!material || typeof material !== "object") {
		throw new Error("Consumer session material must be valid JSON or a structured object.");
	}
	return await store.saveConsumerSession({
		profileId: input.profileId,
		provider: input.provider ?? "consumer-session",
		material,
		source: input.source ?? "manual-import",
	});
}

export async function bootstrapBrowserSession(store, input) {
	let playwright;
	try {
		playwright = await import("playwright-core");
	} catch (error) {
		throw new Error(`playwright-core is required for browser bootstrap: ${error.message}`);
	}

	const browserType = playwright.chromium ?? playwright.webkit ?? playwright.firefox;
	if (!browserType) {
		throw new Error("No Playwright browser type is available for bootstrap.");
	}

	const profile = input.profile;
	const browser = await browserType.launch({
		headless: input.headless ?? false,
		executablePath: input.executablePath || undefined,
	});

	try {
		const context = await browser.newContext();
		const page = await context.newPage();
		await page.goto(profile.captureUrl ?? profile.loginUrl ?? "https://chatgpt.com/", {
			waitUntil: "domcontentloaded",
		});

		if (profile.captureSelector) {
			await page.waitForSelector(profile.captureSelector, { timeout: input.timeoutMs ?? 60_000 });
		} else {
			await page.waitForTimeout(input.timeoutMs ?? 20_000);
		}

		const cookies = await context.cookies();
		const storage = await page.evaluate(() => ({
			localStorage: Object.fromEntries(Object.entries(window.localStorage)),
			sessionStorage: Object.fromEntries(Object.entries(window.sessionStorage)),
		}));

		return await store.saveConsumerSession({
			profileId: profile.id,
			provider: profile.provider ?? "consumer-session",
			source: "browser-bootstrap",
			material: {
				cookies,
				storage,
				capturedFrom: page.url(),
			},
		});
	} finally {
		await browser.close();
	}
}

export async function generateFromConsumerSession(input) {
	const sessionRecord = input.consumerSession;
	if (!sessionRecord?.material) {
		throw new Error("No consumer session material is available for this profile.");
	}

	const material = sessionRecord.material;
	if (typeof material.demoResponse === "string") {
		return {
			text: material.demoResponse,
			raw: { source: "consumer-demo", material },
		};
	}

	const requestTemplate = input.profile.requestTemplate;
	if (!requestTemplate?.url) {
		throw new Error("Consumer session profile is missing requestTemplate.url for live replay.");
	}

	const cookieHeader = Array.isArray(material.cookies)
		? material.cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ")
		: material.cookieHeader;

	const headers = {
		"content-type": "application/json",
		...(requestTemplate.headers ?? {}),
	};
	if (cookieHeader) {
		headers.cookie = cookieHeader;
	}

	const values = {
		prompt: input.promptText,
		model: input.model,
		promptVersion: input.promptAsset.version,
		profileId: input.profile.id,
	};

	const response = await fetch(requestTemplate.url, {
		method: requestTemplate.method ?? "POST",
		headers,
		body: requestTemplate.bodyTemplate
			? applyTemplate(requestTemplate.bodyTemplate, values)
			: undefined,
	});

	if (!response.ok) {
		const body = await response.text();
		throw new Error(`Consumer session request failed (${response.status}): ${body}`);
	}

	const payload =
		requestTemplate.responseType === "text" ? await response.text() : await response.json();
	const resolved = resolvePath(payload, requestTemplate.responsePath);
	const text = typeof resolved === "string" ? resolved : JSON.stringify(resolved, null, 2);

	return {
		text,
		raw: payload,
	};
}
