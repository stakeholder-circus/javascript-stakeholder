const ANSI_16 = {
	30: "#1f2933",
	31: "#ff7b8b",
	32: "#77e3a6",
	33: "#ffd47a",
	34: "#74b8ff",
	35: "#d79bff",
	36: "#71d0ff",
	37: "#d8e6fa",
	90: "#6f7f97",
	91: "#ff8fa0",
	92: "#8cf0b1",
	93: "#ffe08d",
	94: "#8bc3ff",
	95: "#ebb1ff",
	96: "#8ce1ff",
	97: "#ffffff",
};

const ANSI_16_BG = {
	40: "#1f2933",
	41: "#ff7b8b",
	42: "#77e3a6",
	43: "#ffd47a",
	44: "#74b8ff",
	45: "#d79bff",
	46: "#71d0ff",
	47: "#d8e6fa",
	100: "#6f7f97",
	101: "#ff8fa0",
	102: "#8cf0b1",
	103: "#ffe08d",
	104: "#8bc3ff",
	105: "#ebb1ff",
	106: "#8ce1ff",
	107: "#ffffff",
};

function xtermColor(index) {
	if (!Number.isFinite(index)) {
		return null;
	}
	if (index < 16) {
		const palette = [
			"#0c0c0c",
			"#a80000",
			"#00a600",
			"#a6a600",
			"#0000a8",
			"#a600a6",
			"#00a6a6",
			"#a6a6a6",
			"#666666",
			"#ff5656",
			"#55ff55",
			"#ffff55",
			"#5555ff",
			"#ff55ff",
			"#55ffff",
			"#ffffff",
		];
		return palette[index];
	}
	if (index >= 16 && index <= 231) {
		const n = index - 16;
		const r = Math.floor(n / 36);
		const g = Math.floor((n % 36) / 6);
		const b = n % 6;
		const steps = [0, 95, 135, 175, 215, 255];
		return `rgb(${steps[r]}, ${steps[g]}, ${steps[b]})`;
	}
	if (index >= 232 && index <= 255) {
		const c = 8 + (index - 232) * 10;
		return `rgb(${c}, ${c}, ${c})`;
	}
	return null;
}

function createState() {
	return {
		fg: null,
		bg: null,
		bold: false,
		faint: false,
		italic: false,
		underline: false,
		inverse: false,
	};
}

function _cloneState(state) {
	return { ...state };
}

function resetState(state) {
	return Object.assign(state, createState());
}

function styleFromState(state) {
	const style = {};
	let fg = state.fg;
	let bg = state.bg;
	if (state.inverse) {
		[fg, bg] = [bg, fg];
	}
	if (fg) {
		style.color = fg;
	}
	if (bg) {
		style.backgroundColor = bg;
	}
	if (state.bold) {
		style.fontWeight = "700";
	}
	if (state.faint) {
		style.opacity = "0.72";
	}
	if (state.italic) {
		style.fontStyle = "italic";
	}
	if (state.underline) {
		style.textDecoration = "underline";
		style.textDecorationThickness = "1.5px";
	}
	return style;
}

function applyCodes(codes, state) {
	for (let i = 0; i < codes.length; i += 1) {
		const code = Number(codes[i] || 0);
		if (code === 0) {
			resetState(state);
			continue;
		}
		if (code === 1) {
			state.bold = true;
			continue;
		}
		if (code === 2) {
			state.faint = true;
			continue;
		}
		if (code === 3) {
			state.italic = true;
			continue;
		}
		if (code === 4) {
			state.underline = true;
			continue;
		}
		if (code === 7) {
			state.inverse = true;
			continue;
		}
		if (code === 22) {
			state.bold = false;
			state.faint = false;
			continue;
		}
		if (code === 23) {
			state.italic = false;
			continue;
		}
		if (code === 24) {
			state.underline = false;
			continue;
		}
		if (code === 27) {
			state.inverse = false;
			continue;
		}
		if (code === 39) {
			state.fg = null;
			continue;
		}
		if (code === 49) {
			state.bg = null;
			continue;
		}
		if (ANSI_16[code]) {
			state.fg = ANSI_16[code];
			continue;
		}
		if (ANSI_16_BG[code]) {
			state.bg = ANSI_16_BG[code];
			continue;
		}
		if ((code === 38 || code === 48) && codes[i + 1] === "5" && codes[i + 2] != null) {
			const color = xtermColor(Number(codes[i + 2]));
			if (color) {
				if (code === 38) {
					state.fg = color;
				} else {
					state.bg = color;
				}
			}
			i += 2;
		}
	}
}

export function stripAnsi(text) {
	const input = String(text ?? "");
	let output = "";
	for (let index = 0; index < input.length; index += 1) {
		if (input[index] === "\u001b" && input[index + 1] === "[") {
			index += 2;
			while (index < input.length && input[index] !== "m") {
				index += 1;
			}
			continue;
		}
		output += input[index];
	}
	return output;
}

export function renderAnsiFragment(text) {
	const fragment = document.createDocumentFragment();
	const input = String(text ?? "");
	const state = createState();
	let cursor = 0;

	const appendChunk = (chunk) => {
		if (!chunk) {
			return;
		}
		const parts = chunk.split("\n");
		for (let index = 0; index < parts.length; index += 1) {
			const part = parts[index];
			if (part) {
				const span = document.createElement("span");
				Object.assign(span.style, styleFromState(state));
				span.textContent = part;
				fragment.append(span);
			}
			if (index < parts.length - 1) {
				fragment.append(document.createElement("br"));
			}
		}
	};

	for (let index = 0; index < input.length; index += 1) {
		if (input[index] !== "\u001b" || input[index + 1] !== "[") {
			continue;
		}
		appendChunk(input.slice(cursor, index));
		let end = index + 2;
		while (end < input.length && input[end] !== "m") {
			end += 1;
		}
		if (end >= input.length) {
			cursor = index;
			break;
		}
		const rawCodes = input.slice(index + 2, end);
		const codes = rawCodes ? rawCodes.split(";") : ["0"];
		applyCodes(codes, state);
		cursor = end + 1;
		index = end;
	}

	appendChunk(input.slice(cursor));
	return fragment;
}

export function ansiToHtml(text) {
	const holder = document.createElement("div");
	holder.append(renderAnsiFragment(text));
	return holder.innerHTML;
}

export function cloneAnsiStateForExport(text) {
	return stripAnsi(text);
}
