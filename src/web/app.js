import { renderAnsiFragment, stripAnsi } from "./ansi.js";
import {
	COMPLEXITIES,
	DEFAULT_EXPERIMENTAL,
	DEFAULT_SESSION,
	DEV_TYPES,
	FAMILY_BY_ID,
	FAMILY_CATALOG,
	FAMILY_GROUPS,
	JARGON_LEVELS,
	OUTPUT_FORMATS,
} from "./catalog.js";

const STORAGE_KEY = "javascript-stakeholder.web.state.v1";
const recentSessions = [];
const activeState = {
	session: { ...DEFAULT_SESSION },
	experimental: { ...DEFAULT_EXPERIMENTAL },
	currentSession: null,
	selectedEventId: null,
	focusPane: "terminal",
	splitMode: "balanced",
	currentMode: "static",
};

const refs = {};

const familyGroupsById = new Map(FAMILY_GROUPS.map((group) => [group.id, group]));

function $(selector) {
	return document.querySelector(selector);
}

function hashSeed(input) {
	const value = String(input ?? "stakeholder");
	let hash = 2166136261;
	for (let index = 0; index < value.length; index += 1) {
		hash ^= value.charCodeAt(index);
		hash = Math.imul(hash, 16777619);
	}
	return hash >>> 0;
}

function createRng(seed) {
	let state = hashSeed(seed);
	return () => {
		state = (Math.imul(1664525, state) + 1013904223) >>> 0;
		return state / 0x100000000;
	};
}

function choice(items, rng) {
	return items[Math.floor(rng() * items.length) % items.length];
}

function shuffle(items, rng) {
	const values = [...items];
	for (let index = values.length - 1; index > 0; index -= 1) {
		const swap = Math.floor(rng() * (index + 1));
		[values[index], values[swap]] = [values[swap], values[index]];
	}
	return values;
}

function mapOptions(select, items, placeholder) {
	const previousValue = select.value;
	select.innerHTML = "";
	if (placeholder) {
		const option = document.createElement("option");
		option.value = "";
		option.textContent = placeholder;
		select.append(option);
	}
	for (const item of items) {
		const option = document.createElement("option");
		option.value = item.value ?? item.id;
		option.textContent = item.label ?? item.id;
		select.append(option);
	}
	if ([...select.options].some((option) => option.value === previousValue)) {
		select.value = previousValue;
	}
}

function ensureDatalist(input, id) {
	let datalist = document.getElementById(id);
	if (!datalist) {
		datalist = document.createElement("datalist");
		datalist.id = id;
		document.body.append(datalist);
	}
	input.setAttribute("list", id);
	return datalist;
}

function fillDatalist(datalist, values) {
	datalist.innerHTML = "";
	for (const value of values) {
		const option = document.createElement("option");
		option.value = value.value;
		option.label = value.label ?? value.value;
		datalist.append(option);
	}
}

function asLabelValue(entry, fallbackPrefix = "item") {
	if (entry == null) {
		return null;
	}
	if (typeof entry === "string") {
		return { value: entry, label: entry };
	}
	const value =
		entry.id ??
		entry.value ??
		entry.name ??
		entry.label ??
		entry.model ??
		entry.provider ??
		entry.prompt ??
		entry.key ??
		entry.sessionId ??
		null;
	if (!value) {
		return null;
	}
	const label =
		entry.label ??
		entry.name ??
		entry.displayName ??
		entry.title ??
		entry.model ??
		entry.provider ??
		entry.prompt ??
		`${fallbackPrefix}:${value}`;
	return { value: String(value), label: String(label) };
}

function uniqueByValue(items) {
	const seen = new Set();
	return items.filter((item) => {
		if (!item?.value || seen.has(item.value)) {
			return false;
		}
		seen.add(item.value);
		return true;
	});
}

function normalizeRecentSession(entry) {
	if (entry == null) {
		return null;
	}
	if (typeof entry === "string") {
		return {
			id: entry,
			mode: "recent",
			config: { devType: "unknown" },
			selectedFamilies: [],
			provenance: { provider: "local", model: "unknown" },
		};
	}
	const id = entry.id ?? entry.sessionId ?? entry.name ?? entry.label ?? null;
	if (!id) {
		return null;
	}
	return {
		id: String(id),
		mode: entry.mode ?? entry.kind ?? "recent",
		config: {
			devType: entry.config?.devType ?? entry.devType ?? "unknown",
		},
		selectedFamilies: Array.isArray(entry.selectedFamilies)
			? entry.selectedFamilies.map(String)
			: [],
		provenance: entry.provenance ?? {
			provider: entry.provider ?? "local",
			model: entry.model ?? "unknown",
			adapterMode: entry.adapterMode ?? "api",
			promptVersion: entry.promptVersion ?? "baseline",
		},
	};
}

function normalizeProviderProfile(entry) {
	if (entry == null) {
		return null;
	}
	if (typeof entry === "string") {
		return {
			id: entry,
			label: entry,
			model: entry,
			profile: entry,
		};
	}
	const base = asLabelValue(entry, "provider");
	if (!base) {
		return null;
	}
	return {
		id: base.value,
		label: base.label,
		provider: String(entry.provider ?? entry.type ?? base.value),
		model: String(entry.model ?? entry.defaultModel ?? entry.displayModel ?? base.value),
		profile: String(entry.profile ?? entry.name ?? entry.profileId ?? base.value),
		prompt: String(entry.prompt ?? entry.promptAsset ?? entry.defaultPrompt ?? ""),
		adapterMode: String(entry.adapterMode ?? entry.mode ?? "api"),
		notes: String(entry.notes ?? ""),
	};
}

function normalizePromptAsset(entry) {
	if (entry == null) {
		return null;
	}
	if (typeof entry === "string") {
		return { id: entry, label: entry, version: "latest" };
	}
	const base = asLabelValue(entry, "prompt");
	if (!base) {
		return null;
	}
	return {
		id: base.value,
		label: base.label,
		version: String(entry.version ?? entry.revision ?? entry.latestVersion ?? "latest"),
		provider: String(entry.provider ?? ""),
	};
}

function applyServerListValues(payload) {
	const providerEntries =
		payload.providerProfiles ?? payload.providers ?? payload.experimentalProviders ?? [];
	const promptEntries = payload.promptAssets ?? payload.prompts ?? payload.promptVersions ?? [];
	const recentEntries = payload.recentSessions ?? payload.sessions ?? payload.recentRuns ?? [];
	const providerProfiles = uniqueByValue(
		(Array.isArray(providerEntries) ? providerEntries : [])
			.map(normalizeProviderProfile)
			.filter(Boolean),
	);
	const promptAssets = uniqueByValue(
		(Array.isArray(promptEntries) ? promptEntries : []).map(normalizePromptAsset).filter(Boolean),
	);
	const recent = (Array.isArray(recentEntries) ? recentEntries : [])
		.map(normalizeRecentSession)
		.filter(Boolean);

	if (providerProfiles.length) {
		mapOptions($("#experimental-provider"), [
			{ value: "local-demo", label: "local-demo" },
			...providerProfiles.map((profile) => ({
				value: profile.id,
				label: `${profile.label}${profile.model ? ` · ${profile.model}` : ""}`,
			})),
		]);
		$("#experimental-provider").value =
			providerProfiles[0]?.id ?? $("#experimental-provider").value;
		$("#experimental-model").value =
			$("#experimental-model").value.trim() ||
			providerProfiles[0]?.model ||
			DEFAULT_EXPERIMENTAL.model;
		$("#experimental-profile").value =
			$("#experimental-profile").value.trim() ||
			providerProfiles[0]?.profile ||
			DEFAULT_EXPERIMENTAL.profile;
		$("#experimental-prompt").value =
			$("#experimental-prompt").value.trim() ||
			providerProfiles[0]?.prompt ||
			promptAssets[0]?.id ||
			DEFAULT_EXPERIMENTAL.prompt;
	}

	const providerModelList = ensureDatalist($("#experimental-model"), "experimental-model-list");
	fillDatalist(
		providerModelList,
		uniqueByValue(
			providerProfiles
				.map((profile) => ({ value: profile.model, label: `${profile.label} · ${profile.model}` }))
				.filter((item) => item.value),
		),
	);

	const providerProfileList = ensureDatalist(
		$("#experimental-profile"),
		"experimental-profile-list",
	);
	fillDatalist(
		providerProfileList,
		uniqueByValue(
			providerProfiles
				.map((profile) => ({
					value: profile.profile,
					label: `${profile.label} · ${profile.profile}`,
				}))
				.filter((item) => item.value),
		),
	);

	const promptList = ensureDatalist($("#experimental-prompt"), "experimental-prompt-list");
	fillDatalist(
		promptList,
		uniqueByValue(
			promptAssets
				.map((asset) => ({
					value: asset.id,
					label:
						asset.version && asset.version !== "latest"
							? `${asset.label} · ${asset.version}`
							: asset.label,
				}))
				.filter((item) => item.value),
		),
	);

	if (recent.length) {
		recentSessions.splice(0, recentSessions.length, ...recent);
		terminal.renderRecentSessions();
	}

	return {
		providerProfiles,
		promptAssets,
		recentSessions: recent,
		defaultSession:
			payload.defaultSession ?? payload.sessionDefaults ?? payload.defaults?.session ?? null,
		defaultExperimental:
			payload.defaultExperimental ??
			payload.experimentalDefaults ??
			payload.defaults?.experimental ??
			null,
	};
}

function getFocusFamily(config) {
	if (!config.focusFamily) {
		return null;
	}
	const direct = FAMILY_BY_ID.get(config.focusFamily);
	if (direct) {
		return direct;
	}
	const group = familyGroupsById.get(config.focusFamily);
	if (group) {
		return FAMILY_BY_ID.get(group.families[0]?.id) ?? null;
	}
	return null;
}

function familiesForDevType(devType) {
	const biased = {
		backend: [
			"agent_workflows",
			"platform_engineering",
			"observability_ai_runtime",
			"supply_chain_security",
			"delivery_preview_ops",
		],
		blockchain: [
			"blockchain_protocol_ops",
			"cross_chain_interop",
			"proof_and_sequencer_ops",
			"identity_and_trust",
			"supply_chain_security",
		],
		"data-science": [
			"knowledge_retrieval",
			"ai_inference_ops",
			"evaluation_and_guardrails",
			"aibom_provenance",
			"observability_ai_runtime",
		],
		"dev-ops": [
			"platform_engineering",
			"delivery_preview_ops",
			"observability_ai_runtime",
			"supply_chain_security",
			"finops_capacity",
		],
		frontend: [
			"edge_client_runtime",
			"delivery_preview_ops",
			"agent_workflows",
			"observability_ai_runtime",
			"platform_engineering",
		],
		fullstack: [
			"platform_engineering",
			"delivery_preview_ops",
			"agent_workflows",
			"knowledge_retrieval",
			"observability_ai_runtime",
		],
		"game-development": [
			"edge_client_runtime",
			"observability_ai_runtime",
			"delivery_preview_ops",
			"platform_engineering",
			"simulator_performance_engineer",
		],
		"machine-learning": [
			"ai_inference_ops",
			"knowledge_retrieval",
			"evaluation_and_guardrails",
			"aibom_provenance",
			"observability_ai_runtime",
		],
		security: [
			"supply_chain_security",
			"agent_boundary_security",
			"identity_and_trust",
			"aibom_provenance",
			"multilingual_security_packs",
		],
		"systems-programming": [
			"observability_ai_runtime",
			"embedded_agentic_pipeline",
			"identity_and_trust",
			"platform_engineering",
			"service_mesh_rpc_ops",
		],
	};
	return biased[devType] ?? biased.fullstack;
}

function bucketForFamily(familyId) {
	const group = familyGroupsById.get(FAMILY_CATALOG.find((item) => item.id === familyId)?.group);
	return group?.id ?? "classic-six";
}

function familyTemplate(family, rng, config) {
	const templates = {
		code_analyzer: [
			"build graph edges stayed consistent across the audit pass",
			"SDK drift was reduced to an explicit traceable mismatch",
			"renderer output now points back to contract rows and source evidence",
		],
		data_processing: [
			"fixture streams stayed normalized and repeatable",
			"schema transforms remained deterministic under seed control",
			"batch data stayed aligned with the canonical event contract",
		],
		jargon: [
			"language was grounded in current engineering practice",
			"terminology kept the output credible instead of inflated",
			"the wording pack remained usable in real operational context",
		],
		metrics: [
			"token spend, queue depth, and burn rate stayed visible",
			"latency and throughput metrics were summarized without noise",
			"the telemetry line made tradeoffs obvious at a glance",
		],
		network_activity: [
			"SSE delivery and transport events remained in sync",
			"API boundaries stayed explicit in the activity trace",
			"the network lane showed the same seed-stable ordering",
		],
		system_monitoring: [
			"collector pressure and saturation stayed within guardrails",
			"the health panel highlighted the active bottleneck cleanly",
			"runtime status stayed readable in the terminal pane",
		],
		agent_workflows: [
			"delegation and handoff steps were preserved as distinct rows",
			"approval gates and retry paths remained visible in the trace",
			"workflow orchestration stayed explicit without collapsing detail",
		],
		platform_engineering: [
			"golden-path provisioning stayed visible in the panel flow",
			"identity and queue pressure were surfaced as first-class events",
			"self-service platform steps remained deterministic and reviewable",
		],
		observability_ai_runtime: [
			"trace fanout, burn rate, and GPU pressure were rendered together",
			"AI runtime telemetry stayed legible in the inspector pane",
			"the observability lane kept cost and health tied to the same run",
		],
		delivery_preview_ops: [
			"preview deploy state and rollout control stayed in the same session",
			"flag changes and canary status were written as separate events",
			"delivery flow remained readable from prompt to provenance",
		],
		supply_chain_security: [
			"provenance and attestation checks stayed explicit in the trace",
			"secret and dependency risk was surfaced without burying the cause",
			"supply-chain posture remained visible as a first-class event",
		],
		ai_inference_ops: [
			"routing, fallback, and cache status were surfaced together",
			"prompt and model selection stayed deterministic under seed",
			"the inference lane made adapter behavior obvious",
		],
		knowledge_retrieval: [
			"embedding freshness and recall quality stayed visible",
			"retrieval drift was called out in the inspector detail",
			"the knowledge lane kept citations and corpus state aligned",
		],
		evaluation_and_guardrails: [
			"eval drift and guardrail status stayed separate from baseline noise",
			"the review panel highlighted failures without losing context",
			"benchmarks and policy checks remained explicit in the output",
		],
		aibom_provenance: [
			"model lineage and prompt asset versioning stayed visible",
			"the AI bill of materials remained attached to the session",
			"cache and provenance metadata were kept in the inspector",
		],
		data_governance_compliance: [
			"consent, retention, and audit scope stayed clear in the trace",
			"governed data usage remained readable from the terminal pane",
			"compliance rules showed up as structured metadata",
		],
		finops_capacity: [
			"quota, budget, and consumption stayed in the same view",
			"capacity planning was rendered as an operational signal",
			"the run kept cost pressure visible without extra jargon",
		],
		identity_and_trust: [
			"keys, delegation, and trust boundaries stayed distinct",
			"auth and identity state were preserved in one readable block",
			"the trust lane stayed explicit in both terminal and inspector",
		],
		agent_boundary_security: [
			"tool, prompt, and auth boundaries were rendered clearly",
			"boundary failures stayed visible rather than being summarized away",
			"the security lane kept the risk surface readable",
		],
		blockchain_protocol_ops: [
			"rollup and validator state stayed current in the session",
			"account abstraction and sequencing were called out directly",
			"protocol operations remained credible and current",
		],
		cross_chain_interop: [
			"chain abstraction and transfer paths stayed legible",
			"cross-domain handoff details were preserved in the trace",
			"the interop lane showed the actual bridge behavior",
		],
		proof_and_sequencer_ops: [
			"proof queue lag and ordering pressure remained explicit",
			"sequencer behavior and MEV pressure stayed visible",
			"proof ops were rendered as operational state, not buzzwords",
		],
		fhir_profile_generator: [
			"FHIR resource generation stayed aligned with the profile",
			"patient and encounter shapes were rendered cleanly",
			"the health lane kept payloads practical and readable",
		],
		smart_launch_oauth: [
			"launch context and OAuth scope stayed visible",
			"SMART app flow details were preserved in one session",
			"the auth lane remained explicit and readable",
		],
		bulk_fhir_population_ops: [
			"bulk export and dataset movement remained deterministic",
			"population-style flows stayed visible in the trace",
			"the health data lane kept batch semantics clear",
		],
		hl7v2_feed_ops: [
			"ADT and ORU feed handling stayed readable",
			"interface-engine behavior was rendered as operational state",
			"v2 feed edges remained explicit in the session",
		],
		clinical_workflow_events: [
			"subscription and hooks behavior stayed visible",
			"clinical workflow signals were kept in structured form",
			"the workflow lane preserved event semantics",
		],
		dicomweb_imaging_ops: [
			"QIDO, WADO, and STOW behavior stayed legible",
			"imaging transport details were rendered with care",
			"the DICOM lane kept the protocol story intact",
		],
		openehr_semantic_record_ops: [
			"archetype and template behavior stayed in scope",
			"semantic record flow remained explicit and readable",
			"the openEHR lane kept AQL and record structure visible",
		],
		device_telemetry_clinical: [
			"device telemetry and alerts stayed visible",
			"bedside signals were rendered as structured state",
			"the device lane kept the clinical edge explicit",
		],
		emr_vendor_adapter: [
			"vendor adapter behavior stayed isolated from the core lane",
			"EMR integration edges remained readable in the trace",
			"the adapter lane kept vendor specifics obvious",
		],
		ocpp_chargepoint_ops: [
			"chargepoint state and session movement stayed visible",
			"OCPP behavior remained grounded in practical operations",
			"the charging lane kept 1.6 and 2.x semantics clear",
		],
		ocpi_roaming_ops: [
			"roaming and tariff movement stayed readable",
			"session settlement remained explicit in the session trace",
			"the roaming lane kept market behavior visible",
		],
		mcp_a2a_ops: [
			"MCP and A2A tool calls stayed in the event stream",
			"agent handoffs were rendered as protocol state",
			"tool-routing behavior remained explicit",
		],
		streaming_bus_ops: [
			"bus lag and event stream shape stayed visible",
			"Kafka, NATS, and MQTT behavior remained differentiated",
			"the streaming lane preserved the actual transport story",
		],
		service_mesh_rpc_ops: [
			"RPC routing and federation stayed readable",
			"mesh behavior was rendered as concrete operational state",
			"the service lane kept request flow explicit",
		],
		edge_client_runtime: [
			"edge hydration and client runtime edges stayed visible",
			"the browser path kept offline and streaming state separate",
			"client-runtime details were preserved cleanly",
		],
		embedded_agentic_pipeline: [
			"embedded control flow stayed deterministic and readable",
			"resource-bound pipeline steps were kept explicit",
			"the embedded lane favored operational clarity",
		],
		multilingual_security_packs: [
			"localized threat-language flavor stayed consistent",
			"the security narration kept tone and content controlled",
			"multilingual operator style remained explicit",
		],
		security_persona_packs: [
			"operator persona was rendered without losing technical detail",
			"SOC and CTI tone stayed recognizable in the session",
			"persona overlay remained clear and controlled",
		],
		hybrid_runtime_ops: [
			"quantum runtime state stayed practical and bounded",
			"jobs, sessions, and batches were rendered with care",
			"the hybrid lane kept execution semantics visible",
		],
		capacity_cost_controller: [
			"queue and reservation state stayed visible",
			"budget controls were rendered as operational detail",
			"the capacity lane kept cost guardrails explicit",
		],
		batch_execution_tuner: [
			"batch throughput and job groups stayed readable",
			"execution tuning was preserved as a traceable action",
			"the batch lane kept aggregate behavior clear",
		],
		compiler_maintainer: [
			"transpiler and plugin changes stayed visible",
			"compiler maintenance remained concrete and reviewable",
			"the maintenance lane kept backend adaptation explicit",
		],
		interop_adapter_engineer: [
			"OpenQASM and QIR adaptation stayed in the same view",
			"interop translation behavior remained precise",
			"the adapter lane kept semantic mismatch visible",
		],
		preflight_capacity_planner: [
			"resource estimates and gating remained explicit",
			"preflight checks stayed visible before execution",
			"the planner lane kept capacity risk readable",
		],
		simulator_performance_engineer: [
			"local simulation and GPU use stayed in scope",
			"the simulator lane kept performance and portability visible",
			"runtime benchmarking remained a first-class event",
		],
	};
	const options = templates[family.id] ?? [
		`${family.summary} stayed visible in the current run`,
		`${family.id} remained explicit and traceable`,
		`the terminal kept ${family.label} readable`,
	];
	const base = choice(options, rng);
	const extras = [];
	if (config.trace) {
		extras.push("trace enabled");
	}
	if (config.alerts) {
		extras.push("alerts on");
	}
	if (config.team) {
		extras.push("team visible");
	}
	if (config.minimal) {
		extras.push("minimal mode");
	}
	return { base, extras };
}

function selectFamilies(config, rng) {
	const selected = [];
	const used = new Set();
	const add = (familyId) => {
		if (!familyId || used.has(familyId) || !FAMILY_BY_ID.has(familyId)) {
			return;
		}
		used.add(familyId);
		selected.push(FAMILY_BY_ID.get(familyId));
	};

	const focus = getFocusFamily(config);
	const classicSix = FAMILY_GROUPS[0].families.map((family) => family.id);
	const complexity =
		COMPLEXITIES.find((item) => item.value === config.complexity) ?? COMPLEXITIES[1];
	const desiredCount = complexity.count;
	const bias = familiesForDevType(config.devType);

	if (focus && bucketForFamily(focus.id) === "classic-six") {
		add(focus.id);
	} else {
		add(choice(shuffle(classicSix, rng), rng));
	}

	if (focus && bucketForFamily(focus.id) !== "classic-six" && desiredCount > 1) {
		add(focus.id);
	}

	const buckets = [
		bias,
		FAMILY_GROUPS[1].families.map((family) => family.id),
		FAMILY_GROUPS[2].families.map((family) => family.id),
		FAMILY_GROUPS[3].families.map((family) => family.id),
		FAMILY_GROUPS[4].families.map((family) => family.id),
		FAMILY_GROUPS[5].families.map((family) => family.id),
	];

	if (config.alerts) {
		buckets.unshift([
			"supply_chain_security",
			"system_monitoring",
			"observability_ai_runtime",
			"agent_boundary_security",
			"device_telemetry_clinical",
			"ocpp_chargepoint_ops",
		]);
	}

	if (config.team) {
		buckets.unshift([
			"agent_workflows",
			"delivery_preview_ops",
			"platform_engineering",
			"focus",
			"mcp_a2a_ops",
		]);
	}

	if (
		/openai|anthropic|claude|provider|llm/i.test(
			[config.project, config.framework, config.focusFamily].join(" "),
		)
	) {
		buckets.unshift([
			"ai_inference_ops",
			"evaluation_and_guardrails",
			"aibom_provenance",
			"knowledge_retrieval",
		]);
	}

	for (const bucket of buckets) {
		const candidates = bucket.filter(Boolean).filter((id) => FAMILY_BY_ID.has(id) && !used.has(id));
		if (!candidates.length) {
			continue;
		}
		add(choice(candidates, rng));
		if (selected.length >= desiredCount) {
			break;
		}
	}

	const fallbackPool = shuffle(
		FAMILY_CATALOG.map((family) => family.id),
		rng,
	);
	for (const familyId of fallbackPool) {
		if (selected.length >= desiredCount) {
			break;
		}
		add(familyId);
	}

	return selected.slice(0, desiredCount);
}

function makeProvenance(config, mode, index) {
	const provider = mode === "experimental" ? config.experimentalProvider : "local";
	const model = mode === "experimental" ? config.experimentalModel : "deterministic";
	const adapterMode = mode === "experimental" ? config.experimentalAdapterMode : "api";
	const promptVersion = mode === "experimental" ? config.experimentalPrompt : "baseline";
	const cache = mode === "experimental" ? (index % 2 === 0 ? "hit" : "miss") : "n/a";
	const personalizationProfile = mode === "experimental" ? config.experimentalProfile : "baseline";
	return {
		provider,
		model,
		adapterMode,
		promptVersion,
		cache,
		personalizationProfile,
		provenance: `${provider}:${model}:${promptVersion}`,
	};
}

function formatTimestamp(base, offset) {
	return new Date(base + offset * 1000).toISOString();
}

function formatTerminalLine(event, _index) {
	const family = event.context?.family ?? event.eventType;
	const group = event.context?.group ?? "system";
	const seq = String(event.sequence).padStart(3, "0");
	const mood = event.context?.experimental ? "\x1b[38;5;213m" : "\x1b[38;5;81m";
	const label = event.eventType === "session.end" ? "\x1b[38;5;82m" : mood;
	const muted = "\x1b[2m";
	const reset = "\x1b[0m";
	const detail = event.context?.traceRow ? ` ${muted}${event.context.traceRow}${reset}` : "";
	return `${muted}${seq}${reset} ${label}${family}${reset} ${muted}${group}${reset} ${event.message}${detail}`;
}

function buildLocalSession(config, mode) {
	const seed = `${mode}:${config.seed}:${config.devType}:${config.complexity}:${config.focusFamily}:${config.experimentalProvider}`;
	const rng = createRng(seed);
	const families = selectFamilies(config, rng);
	const events = [];
	const createdAt = Date.now();

	const pushEvent = (eventType, message, context = {}) => {
		const sequence = events.length + 1;
		const event = {
			eventType,
			sequence,
			message,
			timestamp: formatTimestamp(createdAt, sequence),
			context: {
				devType: config.devType,
				complexity: config.complexity,
				jargon: config.jargon,
				outputFormat: config.outputFormat,
				minimal: Boolean(config.minimal),
				trace: Boolean(config.trace),
				alerts: Boolean(config.alerts),
				team: Boolean(config.team),
				mode,
				...context,
			},
			provenance: makeProvenance(config, mode, sequence),
			terminal: "",
		};
		event.terminal = formatTerminalLine(event, sequence);
		events.push(event);
	};

	pushEvent("session.start", `${mode} session opened for ${config.devType}`, {
		sessionId: `local-${hashSeed(seed).toString(16)}`,
	});
	pushEvent("session.plan", `selected ${families.length} generator lanes`, {
		lanes: families.map((family) => family.id),
	});

	for (const family of families) {
		const template = familyTemplate(family, rng, config);
		pushEvent("generator.activity", `${family.label}: ${template.base}`, {
			family: family.id,
			familyLabel: family.label,
			group: family.group,
			groupLabel: family.groupLabel,
			traceRow: `${family.id} -> ${family.group} -> ${config.devType}`,
		});
		if (config.trace) {
			pushEvent(
				"generator.trace",
				`trace ${family.id}: ${template.extras.join(", ") || "traceable"}`,
				{
					family: family.id,
					familyLabel: family.label,
					group: family.group,
					traceRow: `${family.id} trace row`,
				},
			);
		}
	}

	pushEvent(
		"session.end",
		mode === "experimental"
			? "experimental provider session complete"
			: "deterministic session complete",
		{
			status: "ok",
			durationMs: events.length * 180,
		},
	);

	return {
		id: `local-${hashSeed(seed).toString(16)}`,
		mode,
		config: { ...config },
		events,
		selectedFamilies: families.map((family) => family.id),
		provenance: events.at(-1)?.provenance,
	};
}

class TerminalSurface {
	constructor({ scrollbackEl, sessionChip, focusChip, commandInput, recentList }) {
		this.scrollbackEl = scrollbackEl;
		this.sessionChip = sessionChip;
		this.focusChip = focusChip;
		this.commandInput = commandInput;
		this.recentList = recentList;
		this.lines = [];
		this.lookup = new Map();
		this.selectedId = null;
	}

	clear() {
		this.scrollbackEl.innerHTML = "";
		this.lines = [];
		this.lookup.clear();
		this.selectedId = null;
	}

	addLine({ event, kind = "event", system = false }) {
		const line = document.createElement("div");
		line.className = "terminal-line";
		line.dataset.kind = kind;
		line.dataset.eventId =
			event?.eventId ??
			(event?.sequence != null ? `session-${event.sequence}` : `${kind}-${this.lines.length + 1}`);
		const gutter = document.createElement("span");
		gutter.className = "line-gutter";
		gutter.textContent = String(event?.sequence ?? this.lines.length + 1).padStart(3, "0");
		const content = document.createElement("span");
		content.className = "line-content";
		const terminalText =
			event?.terminal ??
			formatTerminalLine(
				event ?? { sequence: this.lines.length + 1, message: "" },
				this.lines.length + 1,
			);
		content.append(renderAnsiFragment(terminalText));
		line.append(gutter, content);
		line.addEventListener("click", () => {
			this.select(line.dataset.eventId);
			window.dispatchEvent(
				new CustomEvent("javascript-stakeholder:select-event", {
					detail: { eventId: line.dataset.eventId },
				}),
			);
		});
		if (system) {
			line.dataset.system = "true";
		}
		this.scrollbackEl.append(line);
		this.lines.push(line);
		if (event) {
			this.lookup.set(line.dataset.eventId, event);
		}
		this.scrollToEnd();
		return line.dataset.eventId;
	}

	select(eventId) {
		this.selectedId = eventId;
		for (const line of this.lines) {
			line.dataset.selected = String(line.dataset.eventId === eventId);
		}
	}

	scrollToEnd() {
		this.scrollbackEl.scrollTop = this.scrollbackEl.scrollHeight;
	}

	setStatus({ sessionLabel, modeLabel, providerLabel, focusLabel }) {
		this.sessionChip.textContent = sessionLabel;
		this.focusChip.textContent = focusLabel;
		refs.statusIdle.textContent = "ready";
		refs.statusMode.textContent = modeLabel;
		refs.statusProvider.textContent = providerLabel;
	}

	addRecentSession(session) {
		recentSessions.unshift(session);
		while (recentSessions.length > 6) {
			recentSessions.pop();
		}
		this.renderRecentSessions();
	}

	renderRecentSessions() {
		this.recentList.innerHTML = "";
		for (const session of recentSessions) {
			const card = document.createElement("button");
			card.type = "button";
			card.className = "session-card";
			card.innerHTML = `
        <strong>${session.id}</strong>
        <span class="meta">${session.mode} | ${session.config.devType} | ${session.selectedFamilies.length} families</span>
        <span class="meta">${session.provenance?.provider ?? "local"} / ${session.provenance?.model ?? "deterministic"}</span>
      `;
			card.addEventListener("click", () => {
				renderSession(session, { preserveScroll: false });
			});
			this.recentList.append(card);
		}
	}
}

class InspectorPane {
	constructor() {
		this.activeTab = "event";
	}

	setTab(tab) {
		this.activeTab = tab;
		document.querySelectorAll("[data-view]").forEach((node) => {
			node.classList.toggle("hidden", node.dataset.view !== tab);
		});
		document.querySelectorAll(".tab-button").forEach((button) => {
			button.classList.toggle("is-active", button.dataset.tab === tab);
		});
	}

	setEvent(event) {
		const eventSummary = $("#event-summary");
		const provenanceSummary = $("#provenance-summary");
		const rawEvent = $("#raw-event");
		const traceRows = $("#trace-rows");

		if (!event) {
			eventSummary.innerHTML = "<dt>status</dt><dd>no event selected</dd>";
			provenanceSummary.innerHTML = "<dt>status</dt><dd>no provenance available</dd>";
			rawEvent.textContent = "";
			traceRows.textContent = "";
			return;
		}

		const entries = [
			["event type", event.eventType],
			["sequence", String(event.sequence)],
			["message", event.message],
			["timestamp", event.timestamp],
			["family", event.context?.family ?? "n/a"],
			["group", event.context?.group ?? "n/a"],
		];
		eventSummary.innerHTML = entries
			.map(([key, value]) => `<dt>${key}</dt><dd>${escapeHtml(value ?? "")}</dd>`)
			.join("");

		const provenance = event.provenance ?? {};
		const provenanceEntries = Object.entries(provenance).length
			? Object.entries(provenance)
			: [["status", "no provenance"]];
		provenanceSummary.innerHTML = provenanceEntries
			.map(
				([key, value]) =>
					`<dt>${escapeHtml(key)}</dt><dd>${escapeHtml(stringifyValue(value))}</dd>`,
			)
			.join("");

		rawEvent.textContent = JSON.stringify(event, null, 2);
		traceRows.textContent = stringifyTraceRows(event);
	}
}

function escapeHtml(value) {
	return String(value)
		.replaceAll("&", "&amp;")
		.replaceAll("<", "&lt;")
		.replaceAll(">", "&gt;")
		.replaceAll('"', "&quot;");
}

function stringifyValue(value) {
	if (typeof value === "string") {
		return value;
	}
	if (value == null) {
		return "";
	}
	return JSON.stringify(value);
}

function stringifyTraceRows(event) {
	const rows = [];
	rows.push(`event ${event.sequence}: ${event.eventType}`);
	rows.push(`family: ${event.context?.family ?? "n/a"}`);
	rows.push(`group: ${event.context?.group ?? "n/a"}`);
	rows.push(`mode: ${event.context?.mode ?? "static"}`);
	if (event.context?.traceRow) {
		rows.push(`trace-row: ${event.context.traceRow}`);
	}
	if (event.provenance) {
		rows.push(`provider: ${event.provenance.provider}`);
		rows.push(`model: ${event.provenance.model}`);
		rows.push(`adapter: ${event.provenance.adapterMode}`);
	}
	return rows.join("\n");
}

function populateControls() {
	mapOptions(
		$("#dev-type"),
		DEV_TYPES.map((value) => ({ value, label: value })),
	);
	mapOptions($("#complexity"), COMPLEXITIES);
	mapOptions($("#jargon"), JARGON_LEVELS);
	mapOptions($("#output-format"), OUTPUT_FORMATS);
	mapOptions($("#focus-family"), [
		{ value: "", label: "auto" },
		...FAMILY_GROUPS.map((group) => ({ value: group.id, label: `group: ${group.label}` })),
		...FAMILY_CATALOG.map((family) => ({
			value: family.id,
			label: `${family.group} :: ${family.label}`,
		})),
	]);
}

function readFormState() {
	return {
		devType: $("#dev-type").value,
		complexity: $("#complexity").value,
		jargon: $("#jargon").value,
		outputFormat: $("#output-format").value,
		seed: $("#seed").value.trim() || DEFAULT_SESSION.seed,
		project: $("#project").value.trim() || DEFAULT_SESSION.project,
		framework: $("#framework").value.trim() || DEFAULT_SESSION.framework,
		focusFamily: $("#focus-family").value,
		alerts: $("#alerts").checked,
		team: $("#team").checked,
		minimal: $("#minimal").checked,
		trace: $("#trace").checked,
	};
}

function readExperimentalState() {
	return {
		experimentalProvider: $("#experimental-provider").value,
		experimentalModel: $("#experimental-model").value.trim() || DEFAULT_EXPERIMENTAL.model,
		experimentalProfile: $("#experimental-profile").value.trim() || DEFAULT_EXPERIMENTAL.profile,
		experimentalPrompt: $("#experimental-prompt").value.trim() || DEFAULT_EXPERIMENTAL.prompt,
		experimentalAdapterMode: $("#experimental-adapter-mode").value,
		experimentalSessionMaterial: $("#experimental-session-material").value.trim(),
	};
}

function persistState() {
	try {
		const payload = {
			session: readFormState(),
			experimental: {
				provider: $("#experimental-provider").value,
				model: $("#experimental-model").value.trim() || DEFAULT_EXPERIMENTAL.model,
				profile: $("#experimental-profile").value.trim() || DEFAULT_EXPERIMENTAL.profile,
				prompt: $("#experimental-prompt").value.trim() || DEFAULT_EXPERIMENTAL.prompt,
				adapterMode: $("#experimental-adapter-mode").value,
			},
		};
		localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
	} catch {
		// storage is optional
	}
}

function restoreState(catalog = {}) {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		const fallbackSession = { ...DEFAULT_SESSION, ...(catalog.defaultSession ?? {}) };
		const fallbackExperimental = {
			...DEFAULT_EXPERIMENTAL,
			...(catalog.defaultExperimental ?? {}),
		};
		if (!raw) {
			applyState(fallbackSession, fallbackExperimental);
			return;
		}
		const parsed = JSON.parse(raw);
		applyState(
			{ ...fallbackSession, ...(parsed.session ?? {}) },
			{ ...fallbackExperimental, ...(parsed.experimental ?? {}) },
		);
	} catch {
		applyState(DEFAULT_SESSION, DEFAULT_EXPERIMENTAL);
	}
}

function applyState(session, experimental) {
	$("#dev-type").value = session.devType;
	$("#complexity").value = session.complexity;
	$("#jargon").value = session.jargon;
	$("#output-format").value = session.outputFormat;
	$("#seed").value = session.seed;
	$("#project").value = session.project;
	$("#framework").value = session.framework;
	$("#focus-family").value = session.focusFamily ?? "";
	$("#alerts").checked = Boolean(session.alerts);
	$("#team").checked = Boolean(session.team);
	$("#minimal").checked = Boolean(session.minimal);
	$("#trace").checked = Boolean(session.trace);

	$("#experimental-provider").value = experimental.provider;
	$("#experimental-model").value = experimental.model;
	$("#experimental-profile").value = experimental.profile;
	$("#experimental-prompt").value = experimental.prompt;
	$("#experimental-adapter-mode").value = experimental.adapterMode;
	$("#experimental-session-material").value = experimental.sessionMaterial ?? "";
}

function setPaneFocus(pane) {
	activeState.focusPane = pane;
	document.querySelectorAll("[data-pane]").forEach((node) => {
		node.dataset.focus = String(node.dataset.pane === pane);
	});
	refs.focusChip.textContent = `focus: ${pane}`;
}

function setSplitMode(mode) {
	activeState.splitMode = mode;
	document.body.dataset.splitMode = mode;
}

async function runSession(mode = "static") {
	persistState();
	const sessionConfig = readFormState();
	const experimental = readExperimentalState();
	activeState.currentMode = mode;
	const providerLabel = mode === "experimental" ? experimental.experimentalProvider : "local";
	terminal.setStatus({
		sessionLabel: `${mode} pending`,
		modeLabel: mode,
		providerLabel,
		focusLabel: `focus: ${activeState.focusPane}`,
	});

	let session;
	try {
		session = await runViaServer(mode, sessionConfig, experimental);
	} catch (error) {
		session = buildLocalSession(
			{
				...sessionConfig,
				...experimental,
				experimentalProvider: experimental.experimentalProvider,
				experimentalModel: experimental.experimentalModel,
				experimentalProfile: experimental.experimentalProfile,
				experimentalPrompt: experimental.experimentalPrompt,
				experimentalAdapterMode: experimental.experimentalAdapterMode,
			},
			mode,
		);
		terminal.addLine({
			event: {
				sequence: 0,
				message: `server unavailable, using local ${mode} engine`,
				terminal: `\x1b[38;5;214mserver unavailable\x1b[0m \x1b[2m${stripAnsi(String(error?.message ?? error))}\x1b[0m`,
			},
			system: true,
		});
		renderSession(session, { preserveScroll: true });
	}

	saveCurrentSession(session);
	if (!recentSessions.some((recent) => recent.id === session.id)) {
		terminal.addRecentSession(session);
	}
	terminal.setStatus({
		sessionLabel: session.id,
		modeLabel: session.mode,
		providerLabel: session.provenance?.provider ?? "local",
		focusLabel: `focus: ${activeState.focusPane}`,
	});
	return session;
}

async function runViaServer(mode, sessionConfig, experimental) {
	const payload =
		mode === "experimental"
			? {
					...sessionConfig,
					...experimental,
					experimentalProvider: experimental.experimentalProvider,
					experimentalModel: experimental.experimentalModel,
					experimentalProfile: experimental.experimentalProfile,
					experimentalPrompt: experimental.experimentalPrompt,
					experimentalAdapterMode: experimental.experimentalAdapterMode,
				}
			: sessionConfig;

	const endpoint = mode === "experimental" ? "/api/sessions/experimental" : "/api/sessions/static";
	const response = await fetch(endpoint, {
		method: "POST",
		headers: { "content-type": "application/json" },
		body: JSON.stringify(payload),
	});

	if (!response.ok) {
		throw new Error(`session bootstrap failed (${response.status})`);
	}

	const body = await response.json();
	const session = {
		id: body.id ?? `server-${Date.now()}`,
		mode,
		config: sessionConfig,
		events: Array.isArray(body.events) ? [...body.events] : [],
		provenance: body.provenance ?? body.events?.at?.(-1)?.provenance ?? null,
		selectedFamilies: body.selectedFamilies ?? [],
		streamUrl: body.streamUrl ?? body.eventsUrl ?? null,
	};

	beginSessionRender(session);

	if (session.events.length) {
		const initialEvents = [...session.events];
		session.events.length = 0;
		for (const event of initialEvents) {
			appendSessionEvent(session, event);
		}
	}

	const shouldStream =
		Boolean(session.id) &&
		body.stream !== false &&
		body.live !== false &&
		(Boolean(body.streamUrl) ||
			Boolean(body.eventsUrl) ||
			!Array.isArray(body.events) ||
			body.events.length === 0);

	if (shouldStream) {
		await streamSession(session, body);
	}

	return session;
}

async function streamSession(session, body = {}) {
	const source = await openSessionEventSource(session.id, body);
	return await new Promise((resolve, reject) => {
		const failTimer = window.setTimeout(() => {
			source.close();
			reject(new Error("stream timeout"));
		}, 20_000);
		let sawEvent = false;

		const finalize = () => {
			window.clearTimeout(failTimer);
			source.close();
			updateCurrentChips(session);
			if (!recentSessions.some((recent) => recent.id === session.id)) {
				terminal.addRecentSession(session);
			}
			resolve(session.events);
		};

		const handlePayload = (payload) => {
			sawEvent = true;
			const event = normalizeSessionEvent(payload, session);
			appendSessionEvent(session, event);
			if (
				event.eventType === "session.end" ||
				event.eventType === "complete" ||
				event.eventType === "done"
			) {
				finalize();
			}
		};

		source.onmessage = (event) => {
			try {
				handlePayload(JSON.parse(event.data));
			} catch (error) {
				window.clearTimeout(failTimer);
				source.close();
				reject(error);
			}
		};

		for (const name of ["event", "session", "generator", "message", "complete", "done"]) {
			source.addEventListener(name, (event) => {
				try {
					handlePayload(event.data ? JSON.parse(event.data) : { eventType: name });
				} catch (error) {
					window.clearTimeout(failTimer);
					source.close();
					reject(error);
				}
			});
		}

		source.onerror = () => {
			window.clearTimeout(failTimer);
			source.close();
			if (sawEvent) {
				resolve(session.events);
				return;
			}
			reject(new Error("stream error"));
		};
	});
}

function openSessionEventSource(sessionId, body = {}) {
	const candidates = [];
	if (body.streamUrl) {
		candidates.push(body.streamUrl);
	}
	if (body.eventsUrl) {
		candidates.push(body.eventsUrl);
	}
	candidates.push(
		`/api/sessions/${encodeURIComponent(sessionId)}/events`,
		`/api/sessions/${encodeURIComponent(sessionId)}/stream`,
	);
	const urls = [...new Set(candidates.filter(Boolean))];

	return new Promise((resolve, reject) => {
		let index = 0;
		let current = null;
		let resolved = false;

		const openNext = () => {
			if (resolved) {
				return;
			}
			if (current) {
				current.close();
				current = null;
			}
			if (index >= urls.length) {
				reject(new Error("no stream endpoint available"));
				return;
			}
			current = new EventSource(urls[index]);
			index += 1;
			const timer = window.setTimeout(() => {
				if (current) {
					current.close();
				}
			}, 2000);
			current.onopen = () => {
				window.clearTimeout(timer);
				if (!resolved) {
					resolved = true;
					resolve(current);
				}
			};
			current.onerror = () => {
				window.clearTimeout(timer);
				if (!resolved) {
					openNext();
				}
			};
		};

		openNext();
	});
}

function normalizeSessionEvent(payload, session) {
	if (!payload || typeof payload !== "object") {
		const event = {
			eventType: "session.message",
			sequence: session.events.length + 1,
			message: String(payload ?? ""),
			timestamp: new Date().toISOString(),
			context: { mode: session.mode },
			provenance: session.provenance ?? null,
		};
		event.terminal = formatTerminalLine(event, event.sequence);
		return event;
	}
	const sequence = Number(payload.sequence ?? session.events.length + 1);
	const event = {
		...payload,
		sequence,
		message: payload.message ?? payload.text ?? String(payload.eventType ?? "event"),
		timestamp: payload.timestamp ?? new Date().toISOString(),
		context: {
			mode: session.mode,
			...(payload.context ?? {}),
		},
		provenance: payload.provenance ?? session.provenance ?? null,
	};
	const terminal = payload.terminal ?? payload.message ?? payload.data ?? "";
	event.terminal =
		typeof terminal === "string" && terminal.trim()
			? terminal
			: formatTerminalLine(event, event.sequence);
	return event;
}

function appendSessionEvent(session, event) {
	const normalized = normalizeSessionEvent(event, session);
	session.events.push(normalized);
	const eventId = `session-${normalized.sequence}`;
	terminal.addLine({ event: { ...normalized, eventId }, kind: "session" });
	terminal.select(eventId);
	if (
		normalized.eventType === "session.end" ||
		normalized.eventType === "generator.activity" ||
		normalized.eventType === "generator.trace" ||
		normalized.context?.trace
	) {
		inspector.setEvent(normalized);
	}
}

function beginSessionRender(session, { preserveScroll } = { preserveScroll: false }) {
	activeState.currentSession = session;
	activeState.selectedEventId = null;
	terminal.clear();
	if (!preserveScroll) {
		terminal.scrollbackEl.scrollTop = 0;
	}
	terminal.addLine({
		event: {
			sequence: 0,
			message: `${session.mode} session ${session.id} started`,
			terminal: `\x1b[1m${session.mode}\x1b[0m \x1b[38;5;81m${session.id}\x1b[0m \x1b[2m${session.config.devType}\x1b[0m`,
		},
		system: true,
	});
}

function renderSession(session, { preserveScroll }) {
	beginSessionRender(session, { preserveScroll });
	const snapshot = [...session.events];
	session.events.length = 0;
	snapshot.forEach((event) => {
		appendSessionEvent(session, event);
	});
	const selected = session.events.at(-1) ?? session.events[0] ?? null;
	if (selected) {
		terminal.select(`session-${selected.sequence}`);
		inspector.setEvent(selected);
	} else {
		inspector.setEvent(null);
	}
	updateCurrentChips(session);
	if (!recentSessions.some((recent) => recent.id === session.id)) {
		terminal.addRecentSession(session);
	}
}

function updateCurrentChips(session) {
	refs.sessionChip.textContent = session.id;
	refs.statusIdle.textContent = session.mode === "experimental" ? "experimental" : "ready";
	refs.statusMode.textContent = session.mode;
	refs.statusProvider.textContent = session.provenance?.provider ?? "local";
}

function saveCurrentSession(session) {
	activeState.currentSession = session;
	updateCurrentChips(session);
}

function importSessionMaterial() {
	const raw = $("#experimental-session-material").value.trim();
	if (!raw) {
		terminal.addLine({
			event: {
				sequence: 0,
				message: "no session material to import",
				terminal: "\x1b[38;5;214mimport skipped\x1b[0m \x1b[2mempty session material\x1b[0m",
			},
			system: true,
		});
		return;
	}
	terminal.addLine({
		event: {
			sequence: 0,
			message: "imported session material into browser state",
			terminal: "\x1b[38;5;82mimported\x1b[0m \x1b[2mbrowser-local consumer state updated\x1b[0m",
			provenance: {
				provider: $("#experimental-provider").value,
				model: $("#experimental-model").value,
				adapterMode: $("#experimental-adapter-mode").value,
				promptVersion: $("#experimental-prompt").value,
				cache: "n/a",
				personalizationProfile: $("#experimental-profile").value,
			},
		},
		system: true,
	});
}

function bootstrapBrowserSession() {
	const sessionMaterial = $("#experimental-session-material");
	if (!sessionMaterial.value.trim()) {
		sessionMaterial.value = JSON.stringify(
			{
				adapterMode: $("#experimental-adapter-mode").value,
				provider: $("#experimental-provider").value,
				note: "browser bootstrap placeholder",
				timestamp: new Date().toISOString(),
			},
			null,
			2,
		);
	}
	terminal.addLine({
		event: {
			sequence: 0,
			message: "browser bootstrap placeholder initialized",
			terminal: "\x1b[38;5;213mbootstrap\x1b[0m \x1b[2mbrowser session placeholder ready\x1b[0m",
		},
		system: true,
	});
}

function exportSession() {
	const session = activeState.currentSession;
	if (!session) {
		terminal.addLine({
			event: {
				sequence: 0,
				message: "no session to export",
				terminal: "\x1b[38;5;214mexport skipped\x1b[0m \x1b[2mrun a session first\x1b[0m",
			},
			system: true,
		});
		return;
	}
	const blob = new Blob([JSON.stringify(session, null, 2)], { type: "application/json" });
	const url = URL.createObjectURL(blob);
	const anchor = document.createElement("a");
	anchor.href = url;
	anchor.download = `${session.id}.json`;
	anchor.click();
	URL.revokeObjectURL(url);
}

function parseCommand(commandText) {
	const text = commandText.trim();
	if (!text) {
		return { action: "noop" };
	}
	const [command, ...rest] = text.split(/\s+/);
	const tail = rest.join(" ");
	switch (command.toLowerCase()) {
		case "run":
			return { action: "run", mode: "static" };
		case "rerun":
			return { action: "run", mode: activeState.currentMode };
		case "clear":
			return { action: "clear" };
		case "split":
			return { action: "split" };
		case "focus":
			return { action: "focus", pane: tail || "terminal" };
		case "trace":
			return { action: "trace", value: tail.toLowerCase() };
		case "provider":
			return { action: "provider", value: tail };
		case "profile":
			return { action: "profile", value: tail };
		case "prompt":
			return { action: "prompt", value: tail };
		case "experimental":
			return { action: "experimental", value: tail };
		case "export":
			return { action: "export" };
		case "help":
			return { action: "help" };
		default:
			return { action: "unknown", command: text };
	}
}

async function executeCommand(commandText) {
	terminal.addLine({
		event: {
			sequence: 0,
			message: commandText,
			terminal: `\x1b[38;5;81m$\x1b[0m ${commandText}`,
		},
		system: true,
	});

	const parsed = parseCommand(commandText);
	switch (parsed.action) {
		case "run":
			await runSession(parsed.mode);
			break;
		case "clear":
			terminal.clear();
			inspector.setEvent(null);
			break;
		case "split":
			setSplitMode(activeState.splitMode === "balanced" ? "terminal-wide" : "balanced");
			terminal.addLine({
				event: {
					sequence: 0,
					message: `split mode is now ${activeState.splitMode}`,
					terminal: `\x1b[38;5;81msplit\x1b[0m \x1b[2m${activeState.splitMode}\x1b[0m`,
				},
				system: true,
			});
			break;
		case "focus":
			setPaneFocus(parsed.pane);
			terminal.addLine({
				event: {
					sequence: 0,
					message: `focus moved to ${parsed.pane}`,
					terminal: `\x1b[38;5;81mfocus\x1b[0m \x1b[2m${parsed.pane}\x1b[0m`,
				},
				system: true,
			});
			break;
		case "trace":
			$("#trace").checked = parsed.value !== "off";
			terminal.addLine({
				event: {
					sequence: 0,
					message: `trace ${$("#trace").checked ? "enabled" : "disabled"}`,
					terminal: `\x1b[38;5;81mtrace\x1b[0m \x1b[2m${$("#trace").checked ? "on" : "off"}\x1b[0m`,
				},
				system: true,
			});
			break;
		case "provider":
			$("#experimental-provider").value = parsed.value || $("#experimental-provider").value;
			terminal.addLine({
				event: {
					sequence: 0,
					message: `provider set to ${$("#experimental-provider").value}`,
					terminal: `\x1b[38;5;213mprovider\x1b[0m \x1b[2m${$("#experimental-provider").value}\x1b[0m`,
				},
				system: true,
			});
			break;
		case "profile":
			$("#experimental-profile").value = parsed.value || $("#experimental-profile").value;
			terminal.addLine({
				event: {
					sequence: 0,
					message: `profile set to ${$("#experimental-profile").value}`,
					terminal: `\x1b[38;5;213mprofile\x1b[0m \x1b[2m${$("#experimental-profile").value}\x1b[0m`,
				},
				system: true,
			});
			break;
		case "prompt":
			$("#experimental-prompt").value = parsed.value || $("#experimental-prompt").value;
			terminal.addLine({
				event: {
					sequence: 0,
					message: `prompt set to ${$("#experimental-prompt").value}`,
					terminal: `\x1b[38;5;213mprompt\x1b[0m \x1b[2m${$("#experimental-prompt").value}\x1b[0m`,
				},
				system: true,
			});
			break;
		case "experimental":
			activeState.currentMode = parsed.value === "on" ? "experimental" : "static";
			terminal.addLine({
				event: {
					sequence: 0,
					message: `mode is now ${activeState.currentMode}`,
					terminal: `\x1b[38;5;213mmode\x1b[0m \x1b[2m${activeState.currentMode}\x1b[0m`,
				},
				system: true,
			});
			break;
		case "export":
			exportSession();
			break;
		case "help":
			terminal.addLine({
				event: {
					sequence: 0,
					message:
						"commands: run, rerun, clear, split, focus, trace, provider, profile, prompt, export",
					terminal:
						"\x1b[38;5;81mhelp\x1b[0m \x1b[2mrun | rerun | clear | split | focus | trace | provider | profile | prompt | export\x1b[0m",
				},
				system: true,
			});
			break;
		case "noop":
			break;
		default:
			terminal.addLine({
				event: {
					sequence: 0,
					message: `unknown command: ${parsed.command}`,
					terminal: `\x1b[38;5;196munknown\x1b[0m \x1b[2m${parsed.command}\x1b[0m`,
				},
				system: true,
			});
			break;
	}

	persistState();
}

function wireEvents() {
	$("#session-config-form").addEventListener("change", persistState);
	$("#session-config-form").addEventListener("input", persistState);
	$("#run-static").addEventListener("click", () => runSession("static"));
	$("#run-experimental").addEventListener("click", () => runSession("experimental"));
	$("#import-session").addEventListener("click", importSessionMaterial);
	$("#bootstrap-browser").addEventListener("click", bootstrapBrowserSession);
	$("#export-session").addEventListener("click", exportSession);
	$("#reset-config").addEventListener("click", () => {
		applyState(DEFAULT_SESSION, DEFAULT_EXPERIMENTAL);
		persistState();
		terminal.addLine({
			event: {
				sequence: 0,
				message: "configuration reset to defaults",
				terminal: "\x1b[38;5;82mreset\x1b[0m \x1b[2mdefault session restored\x1b[0m",
			},
			system: true,
		});
	});

	$("#terminal-command-form").addEventListener("submit", async (event) => {
		event.preventDefault();
		const input = $("#terminal-command");
		const command = input.value;
		input.value = "";
		await executeCommand(command);
		input.focus();
	});

	document.querySelectorAll(".tab-button").forEach((button) => {
		button.addEventListener("click", () => inspector.setTab(button.dataset.tab));
	});

	window.addEventListener("javascript-stakeholder:select-event", (event) => {
		const selectedEventId = event.detail?.eventId;
		const current = activeState.currentSession;
		if (!current) {
			return;
		}
		const selected =
			current.events.find((entry) => `session-${entry.sequence}` === selectedEventId) ??
			current.events.at(-1);
		if (selected) {
			inspector.setEvent(selected);
			activeState.selectedEventId = selectedEventId;
		}
	});
}

function seedWelcome() {
	terminal.addLine({
		event: {
			sequence: 1,
			message: "browser terminal initialized",
			terminal: "\x1b[38;5;81mbrowser ready\x1b[0m \x1b[2mstatic app loaded\x1b[0m",
			provenance: {
				provider: "local",
				model: "deterministic",
				adapterMode: "api",
				promptVersion: "baseline",
			},
		},
		system: true,
	});
	terminal.addLine({
		event: {
			sequence: 2,
			message: "use the prompt below or the control panel to run a session",
			terminal: "\x1b[2mtype help for commands\x1b[0m",
			provenance: {
				provider: "local",
				model: "deterministic",
				adapterMode: "api",
				promptVersion: "baseline",
			},
		},
		system: true,
	});
}

async function bootstrapFromServer() {
	try {
		const response = await fetch("/api/list-values");
		if (!response.ok) {
			throw new Error("list-values unavailable");
		}
		const payload = await response.json();
		const catalog = applyServerListValues(payload);
		if (Array.isArray(payload.devTypes) && payload.devTypes.length) {
			mapOptions(
				$("#dev-type"),
				payload.devTypes.map((value) => ({ value, label: value })),
			);
		}
		if (Array.isArray(payload.complexities) && payload.complexities.length) {
			mapOptions(
				$("#complexity"),
				payload.complexities.map((entry) => ({
					value: entry.value ?? entry,
					label: entry.label ?? entry.value ?? entry,
				})),
			);
		}
		if (Array.isArray(payload.jargonLevels) && payload.jargonLevels.length) {
			mapOptions(
				$("#jargon"),
				payload.jargonLevels.map((entry) => ({
					value: entry.value ?? entry,
					label: entry.label ?? entry.value ?? entry,
				})),
			);
		}
		if (Array.isArray(payload.outputFormats) && payload.outputFormats.length) {
			mapOptions(
				$("#output-format"),
				payload.outputFormats.map((entry) => ({
					value: entry.value ?? entry,
					label: entry.label ?? entry.value ?? entry,
				})),
			);
		}
		if (Array.isArray(payload.generatorFamilies) && payload.generatorFamilies.length) {
			mapOptions($("#focus-family"), [
				{ value: "", label: "auto" },
				...payload.generatorFamilies.map((family) => ({
					value: family.id ?? family.value ?? family,
					label: `${family.group ?? "family"} :: ${family.label ?? family.id ?? family}`,
				})),
			]);
		}
		return catalog;
	} catch {
		// local fallback stays in place
		return {};
	}
}

const terminal = new TerminalSurface({
	scrollbackEl: $("#terminal-scrollback"),
	sessionChip: $("#chip-session"),
	focusChip: $("#chip-focus"),
	commandInput: $("#terminal-command"),
	recentList: $("#recent-sessions"),
});

const inspector = new InspectorPane();

function installShellFocus() {
	const focusers = ["terminal", "controls", "inspector"];
	let index = 0;
	document.addEventListener("keydown", (event) => {
		if (event.key === "F6") {
			event.preventDefault();
			index = (index + 1) % focusers.length;
			setPaneFocus(focusers[index]);
			if (focusers[index] === "terminal") {
				$("#terminal-command").focus();
			}
		}
	});
}

async function main() {
	refs.statusIdle = document.querySelector('[data-status="idle"]');
	refs.statusMode = document.querySelector('[data-status="mode"]');
	refs.statusProvider = document.querySelector('[data-status="provider"]');
	refs.sessionChip = $("#chip-session");
	refs.focusChip = $("#chip-focus");

	populateControls();
	const catalog = await bootstrapFromServer();
	restoreState(catalog);
	wireEvents();
	installShellFocus();
	inspector.setTab("event");
	terminal.renderRecentSessions();
	terminal.setStatus({
		sessionLabel: "no session",
		modeLabel: "static",
		providerLabel: "local",
		focusLabel: "focus: terminal",
	});
	seedWelcome();
	setPaneFocus("terminal");
	terminal.commandInput.focus();
	persistState();
}

main().catch((error) => {
	terminal.addLine({
		event: {
			sequence: 0,
			message: `bootstrap failed: ${error.message}`,
			terminal: `\x1b[38;5;196mbootstrap failed\x1b[0m \x1b[2m${error.message}\x1b[0m`,
		},
		system: true,
	});
	inspector.setEvent({
		eventType: "bootstrap.error",
		sequence: 0,
		message: error.message,
		timestamp: new Date().toISOString(),
		context: { error: true },
		provenance: {
			provider: "local",
			model: "deterministic",
			adapterMode: "api",
			promptVersion: "baseline",
		},
	});
});
