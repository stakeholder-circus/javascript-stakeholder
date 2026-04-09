import { spawn } from "node:child_process";
import path from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const WEB_PORT = Number(process.env.STAKEHOLDER_WEB_SMOKE_PORT ?? 33844);

function isDirectExecution(metaUrl) {
	if (!process.argv[1]) {
		return false;
	}
	return fileURLToPath(metaUrl) === process.argv[1];
}

function exec(command, args, options = {}) {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, {
			cwd: ROOT,
			stdio: ["ignore", "pipe", "pipe"],
			...options,
		});
		let stdout = "";
		let stderr = "";
		if (child.stdout) {
			child.stdout.on("data", (chunk) => {
				stdout += chunk;
				if (options.stdio === "inherit") {
					process.stdout.write(chunk);
				}
			});
		}
		if (child.stderr) {
			child.stderr.on("data", (chunk) => {
				stderr += chunk;
				if (options.stdio === "inherit") {
					process.stderr.write(chunk);
				}
			});
		}
		child.on("exit", (code) => {
			if (code === 0) {
				resolve({ stdout: stdout.trim(), stderr: stderr.trim() });
				return;
			}
			reject(new Error(stderr || `${command} ${args.join(" ")} exited with code ${code}`));
		});
		child.on("error", reject);
	});
}

async function waitFor(url) {
	for (let attempt = 0; attempt < 20; attempt += 1) {
		try {
			const response = await fetch(url);
			if (response.ok) {
				return response;
			}
		} catch {
			// keep retrying while the container boots
		}
		await sleep(500);
	}
	throw new Error(`Timed out waiting for ${url}`);
}

export async function runDockerSmoke() {
	await exec("docker", ["build", "-t", "javascript-stakeholder", "."], { stdio: "inherit" });
	await exec("docker", ["run", "--rm", "javascript-stakeholder", "--list-values"], {
		stdio: "inherit",
	});

	const started = await exec(
		"docker",
		[
			"run",
			"-d",
			"--rm",
			"-p",
			`${WEB_PORT}:3344`,
			"-e",
			"HOST=0.0.0.0",
			"--entrypoint",
			"node",
			"javascript-stakeholder",
			"src/web.js",
		],
		{ stdio: "pipe" },
	);
	const containerId = started.stdout;

	try {
		const rootResponse = await waitFor(`http://127.0.0.1:${WEB_PORT}/`);
		const rootHtml = await rootResponse.text();
		if (!rootHtml.includes("generator terminal")) {
			throw new Error("Web root did not return the terminal shell HTML.");
		}

		const apiResponse = await waitFor(`http://127.0.0.1:${WEB_PORT}/api/list-values`);
		const apiBody = await apiResponse.json();
		if (!Array.isArray(apiBody.devTypes)) {
			throw new Error("Web API list-values response did not include devTypes.");
		}
	} finally {
		if (containerId) {
			await exec("docker", ["stop", containerId], { stdio: "inherit" }).catch(() => {});
		}
	}
}

if (isDirectExecution(import.meta.url)) {
	runDockerSmoke().catch((error) => {
		process.stderr.write(
			`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
		);
		process.exitCode = 1;
	});
}
