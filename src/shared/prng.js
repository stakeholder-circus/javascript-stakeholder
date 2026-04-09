function normalizeSeed(seed) {
	if (seed === undefined || seed === null) {
		return null;
	}
	if (typeof seed === "bigint") {
		return BigInt.asUintN(64, seed);
	}
	if (typeof seed === "number" && Number.isFinite(seed)) {
		return BigInt.asUintN(64, BigInt(Math.trunc(seed)));
	}
	const text = String(seed);
	if (text.length === 0) {
		return null;
	}
	let state = 0xcbf29ce484222325n;
	for (const character of text) {
		state ^= BigInt(character.codePointAt(0) ?? 0);
		state = BigInt.asUintN(64, state * 0x100000001b3n);
	}
	return state;
}

export function createPrng(seed) {
	const normalized = normalizeSeed(seed);
	if (normalized === null) {
		return {
			nextFloat: () => Math.random(),
			nextInt: (max) => Math.floor(Math.random() * max),
		};
	}

	let state = normalized;
	return {
		nextFloat() {
			state = BigInt.asUintN(64, state * 6364136223846793005n + 1442695040888963407n);
			return Number(state % 1_000_000n) / 1_000_000;
		},
		nextInt(max) {
			return Math.floor(this.nextFloat() * max);
		},
	};
}
