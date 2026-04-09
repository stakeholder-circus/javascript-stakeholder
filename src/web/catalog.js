export const DEV_TYPES = [
	"backend",
	"blockchain",
	"data-science",
	"dev-ops",
	"frontend",
	"fullstack",
	"game-development",
	"machine-learning",
	"security",
	"systems-programming",
];

export const COMPLEXITIES = [
	{ value: "low", label: "Low", count: 1 },
	{ value: "medium", label: "Medium", count: 2 },
	{ value: "high", label: "High", count: 3 },
	{ value: "extreme", label: "Extreme", count: 4 },
];

export const JARGON_LEVELS = [
	{ value: "low", label: "Low" },
	{ value: "normal", label: "Normal" },
	{ value: "high", label: "High" },
	{ value: "extreme", label: "Extreme" },
];

export const OUTPUT_FORMATS = [
	{ value: "text", label: "Text" },
	{ value: "json", label: "JSON" },
];

export const FAMILY_GROUPS = [
	{
		id: "classic-six",
		label: "classic six",
		families: [
			{
				id: "code_analyzer",
				label: "code_analyzer",
				summary: "code review, build graph, SDK drift",
			},
			{
				id: "data_processing",
				label: "data_processing",
				summary: "fixtures, pipelines, transforms",
			},
			{ id: "jargon", label: "jargon", summary: "credible domain language" },
			{ id: "metrics", label: "metrics", summary: "token cost, burn, queue depth" },
			{
				id: "network_activity",
				label: "network_activity",
				summary: "API, SSE, and transport events",
			},
			{
				id: "system_monitoring",
				label: "system_monitoring",
				summary: "health, backpressure, saturation",
			},
		],
	},
	{
		id: "modern-core",
		label: "modern core",
		families: [
			{
				id: "agent_workflows",
				label: "agent_workflows",
				summary: "delegation, retries, approvals",
			},
			{
				id: "platform_engineering",
				label: "platform_engineering",
				summary: "golden paths, identity, queues",
			},
			{
				id: "observability_ai_runtime",
				label: "observability_ai_runtime",
				summary: "tracing, burn rate, GPU pressure",
			},
			{
				id: "delivery_preview_ops",
				label: "delivery_preview_ops",
				summary: "preview deploys, canaries, flags",
			},
			{
				id: "supply_chain_security",
				label: "supply_chain_security",
				summary: "provenance, attestations, secrets",
			},
		],
	},
	{
		id: "ai-governance",
		label: "ai governance",
		families: [
			{
				id: "ai_inference_ops",
				label: "ai_inference_ops",
				summary: "model routing, fallback, cache",
			},
			{
				id: "knowledge_retrieval",
				label: "knowledge_retrieval",
				summary: "stale embeddings, recall, citations",
			},
			{
				id: "evaluation_and_guardrails",
				label: "evaluation_and_guardrails",
				summary: "eval drift, guardrail failures",
			},
			{
				id: "aibom_provenance",
				label: "aibom_provenance",
				summary: "model lineage and AI bills of materials",
			},
			{
				id: "data_governance_compliance",
				label: "data_governance_compliance",
				summary: "consent, retention, audit",
			},
			{ id: "finops_capacity", label: "finops_capacity", summary: "budget, quota, resource burn" },
		],
	},
	{
		id: "security-blockchain",
		label: "security and blockchain",
		families: [
			{
				id: "identity_and_trust",
				label: "identity_and_trust",
				summary: "keys, delegation, trust boundaries",
			},
			{
				id: "agent_boundary_security",
				label: "agent_boundary_security",
				summary: "prompt, tool, and auth boundaries",
			},
			{
				id: "blockchain_protocol_ops",
				label: "blockchain_protocol_ops",
				summary: "rollups, validators, account abstraction",
			},
			{
				id: "cross_chain_interop",
				label: "cross_chain_interop",
				summary: "chain abstraction and transfers",
			},
			{
				id: "proof_and_sequencer_ops",
				label: "proof_and_sequencer_ops",
				summary: "proof queues, ordering, MEV",
			},
		],
	},
	{
		id: "health-protocol",
		label: "health and protocol",
		families: [
			{
				id: "fhir_profile_generator",
				label: "fhir_profile_generator",
				summary: "FHIR R4/R5 resources",
			},
			{
				id: "smart_launch_oauth",
				label: "smart_launch_oauth",
				summary: "SMART launch and OAuth context",
			},
			{
				id: "bulk_fhir_population_ops",
				label: "bulk_fhir_population_ops",
				summary: "bulk export and analytics",
			},
			{ id: "hl7v2_feed_ops", label: "hl7v2_feed_ops", summary: "ADT/ORU/ORM feed handling" },
			{
				id: "clinical_workflow_events",
				label: "clinical_workflow_events",
				summary: "hooks, subscriptions, DEQM",
			},
			{
				id: "dicomweb_imaging_ops",
				label: "dicomweb_imaging_ops",
				summary: "QIDO/WADO/STOW imaging flows",
			},
			{
				id: "openehr_semantic_record_ops",
				label: "openehr_semantic_record_ops",
				summary: "archetypes, templates, AQL",
			},
			{
				id: "device_telemetry_clinical",
				label: "device_telemetry_clinical",
				summary: "bedside telemetry and alerts",
			},
			{
				id: "emr_vendor_adapter",
				label: "emr_vendor_adapter",
				summary: "vendor-specific EMR adapter flows",
			},
			{
				id: "ocpp_chargepoint_ops",
				label: "ocpp_chargepoint_ops",
				summary: "OCPP 1.6 and 2.x chargepoint ops",
			},
			{ id: "ocpi_roaming_ops", label: "ocpi_roaming_ops", summary: "roaming, sessions, tariffs" },
			{ id: "mcp_a2a_ops", label: "mcp_a2a_ops", summary: "MCP and A2A tool calls" },
			{
				id: "streaming_bus_ops",
				label: "streaming_bus_ops",
				summary: "Kafka, NATS, MQTT, event buses",
			},
			{
				id: "service_mesh_rpc_ops",
				label: "service_mesh_rpc_ops",
				summary: "gRPC and GraphQL federation",
			},
			{
				id: "edge_client_runtime",
				label: "edge_client_runtime",
				summary: "edge UI, hydration, offline sync",
			},
			{
				id: "embedded_agentic_pipeline",
				label: "embedded_agentic_pipeline",
				summary: "deterministic control loops",
			},
		],
	},
	{
		id: "overlay-quantum",
		label: "overlay and quantum",
		families: [
			{
				id: "multilingual_security_packs",
				label: "multilingual_security_packs",
				summary: "localized security/operator tone",
			},
			{
				id: "security_persona_packs",
				label: "security_persona_packs",
				summary: "SOC, CTI, reverse-engineering personas",
			},
			{
				id: "hybrid_runtime_ops",
				label: "hybrid_runtime_ops",
				summary: "quantum jobs, sessions, batches",
			},
			{
				id: "capacity_cost_controller",
				label: "capacity_cost_controller",
				summary: "queues, reservations, spend controls",
			},
			{
				id: "batch_execution_tuner",
				label: "batch_execution_tuner",
				summary: "batch throughput and benchmarks",
			},
			{
				id: "compiler_maintainer",
				label: "compiler_maintainer",
				summary: "transpiler and plugin maintenance",
			},
			{
				id: "interop_adapter_engineer",
				label: "interop_adapter_engineer",
				summary: "OpenQASM and QIR adaptation",
			},
			{
				id: "preflight_capacity_planner",
				label: "preflight_capacity_planner",
				summary: "resource estimation and gating",
			},
			{
				id: "simulator_performance_engineer",
				label: "simulator_performance_engineer",
				summary: "simulators, GPU, local mode",
			},
		],
	},
];

export const FAMILY_CATALOG = FAMILY_GROUPS.flatMap((group) =>
	group.families.map((family) => ({
		...family,
		group: group.id,
		groupLabel: group.label,
	})),
);

export const FAMILY_BY_ID = new Map(FAMILY_CATALOG.map((family) => [family.id, family]));

export const DEFAULT_SESSION = {
	devType: "fullstack",
	complexity: "medium",
	jargon: "normal",
	outputFormat: "text",
	seed: "stakeholder-2026",
	project: "stakeholder",
	framework: "browser-ui",
	focusFamily: "",
	alerts: false,
	team: true,
	minimal: false,
	trace: true,
};

export const DEFAULT_EXPERIMENTAL = {
	provider: "local-demo",
	model: "gpt-5.4",
	profile: "default",
	prompt: "browser-terminal-v1",
	adapterMode: "api",
	sessionMaterial: "",
};
