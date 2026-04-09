import { fileURLToPath } from "node:url";

import { createServerApp } from "./server/app.js";

function isDirectExecution(metaUrl) {
	if (!process.argv[1]) {
		return false;
	}
	return fileURLToPath(metaUrl) === process.argv[1];
}

export async function startWebServer(options = {}) {
	const app = await createServerApp(options);
	const port = Number(options.port ?? process.env.PORT ?? 3344);
	const host = options.host ?? process.env.HOST ?? "127.0.0.1";
	return await app.listen(port, host);
}

if (isDirectExecution(import.meta.url)) {
	startWebServer()
		.then(({ port, host }) => {
			process.stdout.write(`javascript-stakeholder web listening on http://${host}:${port}\n`);
		})
		.catch((error) => {
			process.stderr.write(
				`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`,
			);
			process.exitCode = 1;
		});
}
