import { o as __toESM } from "../_runtime.mjs";
import { S as require_jsx_runtime, X as require_react } from "../_libs/@tanstack/react-router+[...].mjs";
import { u as useReaderStore } from "./router-DJg4bJt1.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/warning-gate-Bqt0AB-M.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
/**
* Soft brown-noise rain bed. Generated in-graph so we never ship audio files.
*/
function AmbientAudio() {
	const on = useReaderStore((s) => s.audioOn);
	const ctxRef = (0, import_react.useRef)(null);
	const gainRef = (0, import_react.useRef)(null);
	(0, import_react.useEffect)(() => {
		if (!on) {
			const g = gainRef.current;
			const ctx = ctxRef.current;
			if (g && ctx) {
				g.gain.cancelScheduledValues(ctx.currentTime);
				g.gain.setTargetAtTime(0, ctx.currentTime, .08);
			}
			return;
		}
		let cancelled = false;
		const boot = async () => {
			const Ctx = window.AudioContext || window.webkitAudioContext;
			if (!Ctx) return;
			const ctx = ctxRef.current ?? new Ctx();
			ctxRef.current = ctx;
			if (ctx.state === "suspended") await ctx.resume();
			if (cancelled) return;
			if (!gainRef.current) {
				const bufferSize = 2 * ctx.sampleRate;
				const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
				const data = buffer.getChannelData(0);
				let last = 0;
				for (let i = 0; i < bufferSize; i++) {
					const white = Math.random() * 2 - 1;
					last = (last + .02 * white) / 1.02;
					data[i] = last * 3.2;
				}
				const src = ctx.createBufferSource();
				src.buffer = buffer;
				src.loop = true;
				const filter = ctx.createBiquadFilter();
				filter.type = "lowpass";
				filter.frequency.value = 780;
				const gain = ctx.createGain();
				gain.gain.value = 0;
				src.connect(filter);
				filter.connect(gain);
				gain.connect(ctx.destination);
				src.start();
				gainRef.current = gain;
			}
			const g = gainRef.current;
			g.gain.cancelScheduledValues(ctx.currentTime);
			g.gain.setTargetAtTime(.045, ctx.currentTime, .25);
		};
		boot();
		return () => {
			cancelled = true;
		};
	}, [on]);
	(0, import_react.useEffect)(() => {
		return () => {
			ctxRef.current?.close();
			ctxRef.current = null;
			gainRef.current = null;
		};
	}, []);
	return null;
}
function WarningGate() {
	const warned = useReaderStore((s) => s.warned);
	const setWarned = useReaderStore((s) => s.setWarned);
	const [hydrated, setHydrated] = (0, import_react.useState)(false);
	(0, import_react.useEffect)(() => {
		const unsub = useReaderStore.persist.onFinishHydration(() => setHydrated(true));
		if (useReaderStore.persist.hasHydrated()) setHydrated(true);
		return unsub;
	}, []);
	if (!hydrated || warned) return null;
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "fixed inset-0 z-70 flex items-center justify-center bg-bg/70 p-4",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-soft",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "font-sans text-xs tracking-widest text-lamp",
					children: "সতর্কবার্তা"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mt-2 font-display text-2xl font-semibold",
					children: "প্রাপ্তবয়স্ক পাঠ"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "mt-3 font-sans text-sm leading-relaxed text-muted",
					children: "এই বইয়ে প্রাপ্তবয়স্কদের জন্য সংবেদনশীল দৃশ্য আছে। সেগুলো ডিফল্টে লুকানো থাকে। চাইলে এক ক্লিকে সব দেখান — তখন লেখা লাল রঙে আসবে। কোনো অংশ কাটা হয়নি।"
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: setWarned,
					className: "pressable mt-6 h-12 w-full rounded-lg bg-accent font-sans text-sm font-medium text-accent-fg",
					children: "বুঝেছি, পড়ব"
				})
			]
		})
	});
}
//#endregion
export { WarningGate as n, AmbientAudio as t };
