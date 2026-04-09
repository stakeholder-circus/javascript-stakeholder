import { fileURLToPath } from "node:url";
import {
	buildExperimentalProvenance,
	runExperimentalGeneration,
} from "./server/providers/index.js";
import { createEncryptedStore } from "./server/store/encrypted-files.js";
import { createRuntimeDb } from "./server/store/runtime-db.js";
import { formatAnsiLine, tokenizeAnsi } from "./shared/ansi.js";
import { listValues, runDeterministicSession } from "./shared/engine.js";

const KNOWN_VALUE_FLAGS = new Set([
	"--complexity",
	"--dev-type",
	"--experimental-adapter-mode",
	"--experimental-model",
	"--experimental-profile",
	"--experimental-prompt",
	"--experimental-provider",
	"--framework",
	"--jargon",
	"--output-format",
	"--project",
	"--seed",
	"--state-root",
]);

const KNOWN_BOOLEAN_FLAGS = new Set([
	"--alerts",
	"--help",
	"--list-values",
	"--minimal",
	"--no-color",
	"--team",
	"--trace",
]);

function isDirectExecution(metaUrl) {
	if (!process.argv[1]) {
		return false;
	}
	return fileURLToPath(metaUrl) === process.argv[1];
}

function kebabToCamel(flag) {
	return flag.replace(/^--/, "").replace(/-([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function stripAnsi(input) {
	return tokenizeAnsi(String(input))
		.map((token) => token.text)
		.join("");
}

function printHelp(stdout) {
	stdout.write(
		`${[
			"javascript-stakeholder CLI",
			"",
			"Options:",
			"  --list-values",
			"  --dev-type <value>",
			"  --complexity <value>",
			"  --jargon <value>",
			"  --project <value>",
			"  --framework <value>",
			"  --seed <value>",
			"  --output-format <text|json>",
			"  --alerts",
			"  --team",
			"  --minimal",
			"  --trace",
			"  --no-color",
			"  --experimental-provider <id>",
			"  --experimental-model <id>",
			"  --experimental-profile <id>",
			"  --experimental-prompt <id-or-literal>",
			"  --experimental-adapter-mode <api|consumer>",
			"  --state-root <path>",
		].join("\n")}\n`,
	);
}

function parseArgs(argv) {
	const options = {};
	for (let index = 0; index < argv.length; index += 1) {
		const arg = argv[index];
		if (!arg.startsWith("--")) {
			throw new Error(`Unexpected positional argument ${arg}.`);
		}
		const [flag, inlineValue] = arg.split("=", 2);
		if (KNOWN_BOOLEAN_FLAGS.has(flag)) {
			options[kebabToCamel(flag)] = true;
			continue;
		}
		if (!KNOWN_VALUE_FLAGS.has(flag)) {
			throw new Error(`Unknown flag ${flag}.`);
		}
		const nextValue = inlineValue ?? argv[index + 1];
		if (nextValue == null || nextValue.startsWith("--")) {
			throw new Error(`Flag ${flag} requires a value.`);
		}
		options[kebabToCamel(flag)] = nextValue;
		if (inlineValue == null) {
			index += 1;
		}
	}
	return options;
}

function buildStaticListValues() {
	const values = listValues();
	const experimentalProviders = Array.from(
		new Set(["local-demo", ...(values.experimentalProviders ?? [])]),
	);
	return {
		...values,
		experimentalProviders,
	};
}

async function buildExperimentalSession(options) {
	const base = runDeterministicSession({
		...options,
		outputFormat: "json",
	});
	const store = await createEncryptedStore({ stateRoot: options.stateRoot });
	const db = await createRuntimeDb({ stateRoot: store.stateRoot });
	const generation = await runExperimentalGeneration(
		{ store, db },
		{
			sessionConfig: base.config,
			selectedFamilies: base.selectedFamilies ?? [],
			experimentalProvider: options.experimentalProvider,
			experimentalModel: options.experimentalModel,
			experimentalProfile: options.experimentalProfile,
			experimentalPrompt: options.experimentalPrompt,
			experimentalAdapterMode: options.experimentalAdapterMode ?? "api",
		},
	);

	const provenance = buildExperimentalProvenance({
		profile: generation.profile,
		model: options.experimentalModel || generation.profile.model,
		adapterMode: options.experimentalAdapterMode ?? "api",
		promptAsset: generation.promptAsset,
		cache: generation.cache,
		personalizationProfile: generation.personalizationProfile,
	});

	const events = [...(base.events ?? [])];
	const finalEvent = events.pop() ?? {
		eventType: "session.end",
		sequence: events.length + 1,
		message: "session complete",
		timestamp: new Date().toISOString(),
		context: { mode: "experimental" },
	};

	events.push(
		{
			eventType: "activity",
			sequence: events.length + 1,
			message: generation.text,
			timestamp: new Date().toISOString(),
			context: {
				family: "experimental_live_provider",
				group: "experimental",
				mode: "experimental",
				provider: provenance.provider,
				model: provenance.model,
				promptVersion: provenance.promptVersion,
				traceRow: `javascript-stakeholder:experimental:${provenance.provider}:${provenance.promptVersion}`,
			},
			provenance,
		},
		{
			...finalEvent,
			sequence: events.length + 2,
			context: {
				...(finalEvent.context ?? {}),
				mode: "experimental",
				provider: provenance.provider,
				promptVersion: provenance.promptVersion,
			},
			provenance,
		},
	);

	return {
		id: base.id,
		mode: "experimental",
		config: base.config,
		selectedFamilies: base.selectedFamilies ?? [],
		provenance,
		events,
	};
}

function writeSession(session, options, stdout) {
	if ((options.outputFormat ?? session.config?.outputFormat ?? "text") === "json") {
		stdout.write(`${JSON.stringify(session, null, 2)}\n`);
		return;
	}
	for (const event of session.events) {
		const line = options.noColor ? stripAnsi(formatAnsiLine(event)) : formatAnsiLine(event);
		stdout.write(`${line}\n`);
	}
}

export async function run(argv, stdout = process.stdout, stderr = process.stderr) {
	try {
		const options = parseArgs(argv);
		if (options.help) {
			printHelp(stdout);
			return 0;
		}
		if (options.listValues) {
			stdout.write(`${JSON.stringify(buildStaticListValues(), null, 2)}\n`);
			return 0;
		}

		const isExperimental = Boolean(options.experimentalProvider);
		const session = isExperimental
			? await buildExperimentalSession(options)
			: runDeterministicSession(options);
		writeSession(session, options, stdout);
		return 0;
	} catch (error) {
		stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
		return 1;
	}
}

if (isDirectExecution(import.meta.url)) {
	run(process.argv.slice(2)).then((code) => {
		process.exitCode = code;
	});
}
