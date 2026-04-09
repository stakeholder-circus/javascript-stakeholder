const RESET = "\u001b[0m";
const BOLD = "\u001b[1m";
const DIM = "\u001b[2m";
const ITALIC = "\u001b[3m";
const _UNDERLINE = "\u001b[4m";
const _INVERSE = "\u001b[7m";

const PALETTE = {
	blue: "\u001b[34m",
	cyan: "\u001b[36m",
	green: "\u001b[32m",
	magenta: "\u001b[35m",
	red: "\u001b[31m",
	yellow: "\u001b[33m",
	brightBlue: "\u001b[94m",
	brightCyan: "\u001b[96m",
	brightGreen: "\u001b[92m",
	brightMagenta: "\u001b[95m",
	brightRed: "\u001b[91m",
	brightYellow: "\u001b[93m",
	white: "\u001b[37m",
};

export function formatAnsiLine(event) {
	const family = event.context?.family ?? "session";
	const title = event.context?.familyTitle ?? family;
	const accent = selectAccent(family);
	const tag = `${BOLD}${accent}[${title}]${RESET}`;
	if (event.eventType === "trace") {
		return `${DIM}${PALETTE.brightBlue}${event.message}${RESET}`;
	}
	if (event.eventType === "session.start") {
		return `${BOLD}${PALETTE.brightGreen}${event.message}${RESET}`;
	}
	if (event.eventType === "session.end") {
		return `${BOLD}${PALETTE.brightMagenta}${event.message}${RESET}`;
	}
	if (event.eventType === "experimental.provenance") {
		return `${ITALIC}${PALETTE.brightYellow}${event.message}${RESET}`;
	}
	return `${tag} ${ITALIC}${accent}${event.message}${RESET}`;
}

export function tokenizeAnsi(input) {
	const tokens = [];
	let style = emptyStyle();
	let buffer = "";

	const flush = () => {
		if (buffer) {
			tokens.push({ text: buffer, style: { ...style } });
			buffer = "";
		}
	};

	for (let index = 0; index < input.length; index += 1) {
		const character = input[index];
		if (character === "\u001b" && input[index + 1] === "[") {
			flush();
			const end = input.indexOf("m", index);
			if (end === -1) {
				break;
			}
			const codes = input
				.slice(index + 2, end)
				.split(";")
				.filter(Boolean)
				.map(Number);
			style = applyCodes(style, codes.length === 0 ? [0] : codes);
			index = end;
			continue;
		}
		buffer += character;
	}
	flush();
	return tokens;
}

function selectAccent(family) {
	if (family.includes("security") || family.includes("blockchain")) {
		return PALETTE.brightRed;
	}
	if (family.includes("health") || family.includes("fhir") || family.includes("hl7")) {
		return PALETTE.brightGreen;
	}
	if (family.includes("quantum")) {
		return PALETTE.brightMagenta;
	}
	if (family.includes("network") || family.includes("rpc") || family.includes("stream")) {
		return PALETTE.brightCyan;
	}
	return PALETTE.brightYellow;
}

function emptyStyle() {
	return {
		bold: false,
		dim: false,
		italic: false,
		underline: false,
		inverse: false,
		color: "",
	};
}

function applyCodes(current, codes) {
	const style = { ...current };
	for (const code of codes) {
		switch (code) {
			case 0:
				Object.assign(style, emptyStyle());
				break;
			case 1:
				style.bold = true;
				break;
			case 2:
				style.dim = true;
				break;
			case 3:
				style.italic = true;
				break;
			case 4:
				style.underline = true;
				break;
			case 7:
				style.inverse = true;
				break;
			case 22:
				style.bold = false;
				style.dim = false;
				break;
			case 23:
				style.italic = false;
				break;
			case 24:
				style.underline = false;
				break;
			case 27:
				style.inverse = false;
				break;
			case 31:
				style.color = "ansi-red";
				break;
			case 32:
				style.color = "ansi-green";
				break;
			case 33:
				style.color = "ansi-yellow";
				break;
			case 34:
				style.color = "ansi-blue";
				break;
			case 35:
				style.color = "ansi-magenta";
				break;
			case 36:
				style.color = "ansi-cyan";
				break;
			case 37:
				style.color = "ansi-white";
				break;
			case 91:
				style.color = "ansi-bright-red";
				break;
			case 92:
				style.color = "ansi-bright-green";
				break;
			case 93:
				style.color = "ansi-bright-yellow";
				break;
			case 94:
				style.color = "ansi-bright-blue";
				break;
			case 95:
				style.color = "ansi-bright-magenta";
				break;
			case 96:
				style.color = "ansi-bright-cyan";
				break;
			default:
				break;
		}
	}
	return style;
}
