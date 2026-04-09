import {
	ALERT_FAMILIES,
	CLASSIC_FAMILIES,
	CLI_FLAGS,
	COMPLEXITIES,
	DEV_TYPES,
	EXPERIMENTAL_ADAPTER_MODES,
	EXPERIMENTAL_PROVIDERS,
	FAMILY_MAP,
	GENERATOR_FAMILIES,
	JARGON_LEVELS,
	OUTPUT_FORMATS,
	POLICY_FAMILIES,
	TEAM_FAMILIES,
} from "./catalog.js";
import { createPrng } from "./prng.js";

export function listValues() {
	return {
		devType: DEV_TYPES,
		devTypes: DEV_TYPES,
		jargon: JARGON_LEVELS,
		jargonLevels: JARGON_LEVELS,
		complexity: COMPLEXITIES,
		complexities: COMPLEXITIES,
		outputFormat: OUTPUT_FORMATS,
		outputFormats: OUTPUT_FORMATS,
		generatorFamilies: GENERATOR_FAMILIES.map((family) => family.id),
		experimentalProviders: Array.from(new Set(["local-demo", ...EXPERIMENTAL_PROVIDERS])),
		experimentalAdapterModes: EXPERIMENTAL_ADAPTER_MODES,
		flags: CLI_FLAGS,
	};
}

export function createScheduler(config, seed = config.seed) {
	const random = createPrng(seed);
	const eligible = eligibleFamilies(config);
	const selected = [];
	pushUnique(selected, eligible, CLASSIC_FAMILIES, random);
	if (plannedActivities(config.complexity) >= 2) {
		pushUnique(
			selected,
			eligible,
			eligible.filter((family) => !CLASSIC_FAMILIES.includes(family) && family !== "jargon"),
			random,
		);
	}
	if (plannedActivities(config.complexity) >= 3) {
		pushUnique(selected, eligible, POLICY_FAMILIES, random);
	}
	while (selected.length < plannedActivities(config.complexity)) {
		const choice = eligible[random.nextInt(eligible.length)];
		if (!selected.includes(choice)) {
			selected.push(choice);
		}
	}
	if (config.alerts) {
		pushUnique(selected, eligible, ALERT_FAMILIES, random);
	}
	if (config.team) {
		pushUnique(selected, eligible, TEAM_FAMILIES, random);
	}
	return selected.map((family) => ({
		family,
		kind:
			config.alerts && ALERT_FAMILIES.includes(family)
				? "alert-injection"
				: config.team && TEAM_FAMILIES.includes(family)
					? "team-injection"
					: "generator",
		flavors: resolveFlavors(config, family, random),
	}));
}

export function runDeterministicSession(inputConfig) {
	const config = normalizeConfig(inputConfig);
	const plan = createScheduler(config, config.seed);
	const events = [];
	let sequence = 0;
	events.push(
		toNormalizedEvent({
			eventType: "session.start",
			sequence: sequence++,
			message: "Session configuration accepted",
			context: {
				project: config.project,
				devType: config.devType,
				jargon: config.jargon,
				complexity: config.complexity,
				framework: config.framework,
				durationSeconds: config.duration,
			},
			timestamp: timestampFor(config.seed, 0),
		}),
	);
	events.push(
		toNormalizedEvent({
			eventType: "boot.sequence",
			sequence: sequence++,
			message: "Scheduler baseline initialized",
			context: {
				plannedActivities: plannedActivities(config.complexity),
				alertsEnabled: config.alerts,
				teamActivity: config.team,
				seeded: config.seed !== undefined && config.seed !== null,
				outputFormat: config.outputFormat,
			},
			timestamp: timestampFor(config.seed, 1),
		}),
	);

	for (const selection of plan) {
		const render = renderFamily(selection.family, {
			config,
			flavors: selection.flavors,
			kind: selection.kind,
		});
		events.push(
			toNormalizedEvent({
				eventType: "activity",
				sequence: sequence++,
				message: render.message,
				context: {
					family: selection.family,
					familyTitle: FAMILY_MAP.get(selection.family)?.title ?? selection.family,
					kind: selection.kind,
					protocol: FAMILY_MAP.get(selection.family)?.protocol ?? null,
					flavors: selection.flavors,
					project: config.project,
					framework: config.framework || null,
					...render.context,
				},
				timestamp: timestampFor(config.seed, sequence),
			}),
		);
		if (config.trace) {
			events.push(
				toNormalizedEvent({
					eventType: "trace",
					sequence: sequence++,
					message: `scheduled ${selection.family} kind=${selection.kind} flavorCount=${selection.flavors.length}`,
					context: {
						family: selection.family,
						protocol: FAMILY_MAP.get(selection.family)?.protocol ?? null,
						flavorCount: selection.flavors.length,
					},
					timestamp: timestampFor(config.seed, sequence),
				}),
			);
		}
	}

	events.push(
		toNormalizedEvent({
			eventType: "session.end",
			sequence,
			message: "Session completed",
			context: {
				exitCode: 0,
				result: "ok",
				plannedActivities: plan.length,
			},
			timestamp: timestampFor(config.seed, sequence + 1),
		}),
	);
	return { config, plan, events };
}

export function renderFamily(familyId, context) {
	const family = FAMILY_MAP.get(familyId);
	if (!family) {
		throw new Error(`Unknown family: ${familyId}`);
	}
	const message = family.messages[context.config.jargon] ?? family.messages.low;
	const familyContext = {
		rendererGroup: family.group,
		discipline: family.id,
	};
	if (family.group === "classic-six") {
		familyContext.project = context.config.project;
	}
	if (family.group === "modern-core") {
		familyContext.teamActivity = context.config.team;
	}
	if (family.group === "ai-governance") {
		familyContext.experimentalBoundary = context.flavors.includes("experimental-live-provider");
	}
	if (family.group === "security-blockchain") {
		familyContext.alertsEnabled = context.config.alerts;
	}
	if (family.group === "health-protocol") {
		familyContext.protocolSurface = family.protocol ?? "mixed";
	}
	if (family.group === "overlay-quantum") {
		familyContext.overlayCount = context.flavors.length;
	}
	return {
		message: `${family.title.toLowerCase()} lane for ${context.config.project}: ${message}`,
		context: familyContext,
	};
}

export function toNormalizedEvent(event) {
	return {
		eventType: event.eventType,
		sequence: event.sequence,
		message: event.message,
		timestamp: event.timestamp,
		context: sanitizeContext(event.context ?? {}),
	};
}

export function normalizeConfig(config = {}) {
	const defaults = {
		devType: "backend",
		jargon: "medium",
		complexity: "medium",
		duration: 1,
		alerts: false,
		project: "stakeholder-terminal",
		minimal: false,
		team: false,
		framework: "",
		seed: undefined,
		outputFormat: "text",
		noColor: false,
		trace: false,
		experimentalProvider: "",
		experimentalModel: "",
		experimentalProfile: "",
		experimentalPrompt: "",
		experimentalAdapterMode: "api",
	};
	const merged = { ...defaults, ...config };
	validateEnum("devType", merged.devType, DEV_TYPES);
	validateEnum("jargon", merged.jargon, JARGON_LEVELS);
	validateEnum("complexity", merged.complexity, COMPLEXITIES);
	validateEnum("outputFormat", merged.outputFormat, OUTPUT_FORMATS);
	if (merged.experimentalProvider) {
		validateEnum(
			"experimentalProvider",
			merged.experimentalProvider,
			Array.from(new Set(["local-demo", ...EXPERIMENTAL_PROVIDERS])),
		);
	}
	if (merged.experimentalAdapterMode) {
		validateEnum(
			"experimentalAdapterMode",
			merged.experimentalAdapterMode,
			EXPERIMENTAL_ADAPTER_MODES,
		);
	}
	return merged;
}

function eligibleFamilies(config) {
	const set = new Set(CLASSIC_FAMILIES);
	switch (config.devType) {
		case "backend":
			add(
				set,
				"agent-workflows",
				"ai-inference-ops",
				"platform-engineering",
				"supply-chain-security",
				"observability-ai-runtime",
				"delivery-preview-ops",
				"evaluation-and-guardrails",
				"knowledge-retrieval",
				"identity-and-trust",
				"aibom-provenance",
				"data-governance-compliance",
				"finops-capacity",
				"mcp-a2a-ops",
				"streaming-bus-ops",
				"service-mesh-rpc-ops",
			);
			break;
		case "frontend":
			add(
				set,
				"agent-workflows",
				"delivery-preview-ops",
				"edge-client-runtime",
				"observability-ai-runtime",
				"knowledge-retrieval",
				"service-mesh-rpc-ops",
			);
			break;
		case "fullstack":
			add(
				set,
				"agent-workflows",
				"ai-inference-ops",
				"platform-engineering",
				"observability-ai-runtime",
				"delivery-preview-ops",
				"knowledge-retrieval",
				"mcp-a2a-ops",
				"streaming-bus-ops",
				"service-mesh-rpc-ops",
				"supply-chain-security",
			);
			break;
		case "data-science":
			add(
				set,
				"ai-inference-ops",
				"knowledge-retrieval",
				"evaluation-and-guardrails",
				"aibom-provenance",
				"data-governance-compliance",
				"observability-ai-runtime",
			);
			break;
		case "dev-ops":
			add(
				set,
				"agent-workflows",
				"platform-engineering",
				"supply-chain-security",
				"observability-ai-runtime",
				"delivery-preview-ops",
				"identity-and-trust",
				"finops-capacity",
				"mcp-a2a-ops",
				"streaming-bus-ops",
				"service-mesh-rpc-ops",
			);
			break;
		case "blockchain":
			add(
				set,
				"blockchain-protocol-ops",
				"cross-chain-interop",
				"proof-and-sequencer-ops",
				"supply-chain-security",
				"identity-and-trust",
				"mcp-a2a-ops",
			);
			break;
		case "machine-learning":
			add(
				set,
				"ai-inference-ops",
				"knowledge-retrieval",
				"evaluation-and-guardrails",
				"observability-ai-runtime",
				"aibom-provenance",
				"finops-capacity",
			);
			break;
		case "systems-programming":
			add(
				set,
				"observability-ai-runtime",
				"embedded-agentic-pipeline",
				"identity-and-trust",
				"supply-chain-security",
				"streaming-bus-ops",
			);
			break;
		case "game-development":
			add(
				set,
				"edge-client-runtime",
				"delivery-preview-ops",
				"observability-ai-runtime",
				"streaming-bus-ops",
				"service-mesh-rpc-ops",
			);
			break;
		case "security":
			add(
				set,
				"agent-workflows",
				"supply-chain-security",
				"observability-ai-runtime",
				"evaluation-and-guardrails",
				"identity-and-trust",
				"aibom-provenance",
				"agent-boundary-security",
				"data-governance-compliance",
				"mcp-a2a-ops",
				"streaming-bus-ops",
				"service-mesh-rpc-ops",
			);
			break;
		default:
			break;
	}

	const haystack = `${config.project} ${config.framework}`.toLowerCase();
	if (
		containsKeyword(haystack, [
			"ehr",
			"emr",
			"fhir",
			"hl7",
			"openehr",
			"dicom",
			"clinical",
			"patient",
			"hospital",
		])
	) {
		add(
			set,
			"fhir-profile-generator",
			"smart-launch-oauth",
			"bulk-fhir-population-ops",
			"hl7v2-feed-ops",
			"clinical-workflow-events",
			"dicomweb-imaging-ops",
			"openehr-semantic-record-ops",
			"device-telemetry-clinical",
			"emr-vendor-adapter",
		);
	}
	if (
		containsKeyword(haystack, ["charge", "charger", "charging", "ev", "ocpp", "ocpi", "roaming"])
	) {
		add(
			set,
			"ocpp-chargepoint-ops",
			"ocpi-roaming-ops",
			"streaming-bus-ops",
			"service-mesh-rpc-ops",
		);
	}
	if (containsKeyword(haystack, ["quantum", "qir", "qasm", "braket", "qiskit", "cudaq", "ionq"])) {
		add(
			set,
			"hybrid-runtime-ops",
			"capacity-cost-controller",
			"batch-execution-tuner",
			"compiler-maintainer",
			"interop-adapter-engineer",
			"preflight-capacity-planner",
			"simulator-performance-engineer",
		);
	}
	if (
		containsKeyword(haystack, [
			"mcp",
			"a2a",
			"mqtt",
			"nats",
			"kafka",
			"grpc",
			"graphql",
			"webtransport",
		])
	) {
		add(set, "mcp-a2a-ops", "streaming-bus-ops", "service-mesh-rpc-ops");
	}
	return [...set];
}

function resolveFlavors(config, family, random) {
	const flavors = [];
	if (
		config.devType === "security" ||
		family.includes("security") ||
		family.includes("blockchain")
	) {
		if (["high", "extreme"].includes(config.jargon) || config.alerts) {
			const languages = ["english", "chinese", "russian", "spanish", "arabic"];
			flavors.push(`multilingual-security:${languages[random.nextInt(languages.length)]}`);
		}
		if (["high", "extreme"].includes(config.jargon)) {
			const personas = [
				"bug-bounty-operator",
				"incident-commander",
				"reverse-engineer",
				"threat-hunter",
				"soc-analyst",
				"dark-market-watcher",
				"cti-brief-writer",
			];
			flavors.push(`security-persona:${personas[random.nextInt(personas.length)]}`);
		}
	}
	const haystack = `${config.project} ${config.framework}`.toLowerCase();
	if (
		containsKeyword(haystack, [
			"experimental",
			"openai",
			"anthropic",
			"claude",
			"responses",
			"llm",
		]) &&
		["ai-inference-ops", "evaluation-and-guardrails", "aibom-provenance"].includes(family)
	) {
		flavors.push("experimental-live-provider");
	}
	return flavors;
}

function plannedActivities(complexity) {
	return { low: 1, medium: 2, high: 3, extreme: 4 }[complexity] ?? 2;
}

function pushUnique(selected, eligible, pool, random) {
	const candidates = pool.filter(
		(family) => eligible.includes(family) && !selected.includes(family),
	);
	if (candidates.length > 0) {
		selected.push(candidates[random.nextInt(candidates.length)]);
	}
}

function add(set, ...values) {
	for (const value of values) {
		set.add(value);
	}
}

function containsKeyword(haystack, keywords) {
	return keywords.some((keyword) => haystack.includes(keyword));
}

function sanitizeContext(context) {
	return Object.fromEntries(
		Object.entries(context).map(([key, value]) => [
			key,
			Array.isArray(value) ? value.join(", ") : value,
		]),
	);
}

function timestampFor(seed, offset) {
	if (seed === undefined || seed === null) {
		return new Date(Date.now() + offset * 1000).toISOString();
	}
	return new Date(offset * 1000).toISOString();
}

function validateEnum(name, value, allowed) {
	if (!allowed.includes(value)) {
		throw new Error(`Invalid ${name}: ${value}`);
	}
}
