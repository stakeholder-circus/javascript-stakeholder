import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TARGETS = ["src", "scripts"];

function isDirectExecution(metaUrl) {
	if (!process.argv[1]) {
		return false;
	}
	return fileURLToPath(metaUrl) === process.argv[1];
}

async function collectFiles(targetPath, bucket) {
	const entries = await fs.readdir(targetPath, { withFileTypes: true });
	for (const entry of entries) {
		const resolved = path.join(targetPath, entry.name);
		if (entry.isDirectory()) {
			await collectFiles(resolved, bucket);
			continue;
		}
		if (entry.isFile() && resolved.endsWith(".js")) {
			bucket.push(resolved);
		}
	}
}

function checkFile(file) {
	return new Promise((resolve, reject) => {
		const child = spawn(process.execPath, ["--check", file], { stdio: "pipe" });
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk;
		});
		child.on("exit", (code) => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(stderr || `Syntax check failed for ${file}`));
		});
		child.on("error", reject);
	});
}

export async function runBuildCheck() {
	const files = [];
	for (const target of TARGETS) {
		await collectFiles(path.join(ROOT, target), files);
	}
	for (const file of files.sort()) {
		await checkFile(file);
	}
	return files.length;
}

if (isDirectExecution(import.meta.url)) {
	runBuildCheck()
		.then((count) => {
			process.stdout.write(`build-check checked ${count} module(s)\n`);
		})
		.catch((error) => {
			process.stderr.write(
				`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
			);
			process.exitCode = 1;
		});
}
