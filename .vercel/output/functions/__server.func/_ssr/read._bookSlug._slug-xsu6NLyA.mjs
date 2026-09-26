import { o as __toESM } from "../_runtime.mjs";
import { i as formatCount, l as padSlug } from "./db-D7frQ7S3.mjs";
import { S as require_jsx_runtime, X as require_react, y as Link } from "../_libs/@tanstack/react-router+[...].mjs";
import { _ as EyeOff, b as ChevronLeft, d as Minus, f as List, g as Eye, l as Plus, n as VolumeX, r as Volume2, t as X, x as BookOpen, y as ChevronRight } from "../_libs/lucide-react.mjs";
import { l as THEMES, r as Route$1, u as useReaderStore } from "./router-DJg4bJt1.mjs";
import { t as cn } from "./utils-C_uf36nf.mjs";
import { n as WarningGate, t as AmbientAudio } from "./warning-gate-Bqt0AB-M.mjs";
import { n as mediaSrc } from "./media-url-Dg7Csuwg.mjs";
import { t as MediaFigure } from "./media-figure-CNG4DZHK.mjs";
import { t as Lightbox } from "./lightbox-BTn5x8wL.mjs";
import { t as loadChapterForBook } from "./load-chapter-B7uZ00Xu.mjs";
//#region node_modules/.nitro/vite/services/ssr/assets/read._bookSlug._slug-xsu6NLyA.js
var import_react = /* @__PURE__ */ __toESM(require_react());
var import_jsx_runtime = require_jsx_runtime();
function SensitiveBlock({ para, fontSize, toggleId }) {
	const nsfwMode = useReaderStore((s) => s.nsfwMode);
	const id = toggleId ?? para.id;
	const flipped = useReaderStore((s) => s.inverted.includes(id));
	const toggle = useReaderStore((s) => s.togglePara);
	if (!(nsfwMode === "shown" ? !flipped : flipped)) return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: "nsfw-veil overflow-hidden rounded-lg border border-border",
		children: /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => toggle(id),
			className: "pressable flex w-full items-center justify-between gap-3 px-4 py-3 text-left",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
				className: "flex min-w-0 items-center gap-3",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, {
					className: "size-4 shrink-0 text-subtle",
					strokeWidth: 1.75
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
					className: "font-sans text-sm text-muted",
					children: "সংবেদনশীল অংশ লুকানো আছে"
				})]
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
				className: "shrink-0 font-sans text-xs tracking-wide text-lamp",
				children: "দেখুন"
			})]
		})
	});
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "nsfw-shown",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
			type: "button",
			onClick: () => toggle(id),
			className: "pressable absolute -top-1 right-0 z-10 inline-flex items-center gap-1 rounded-full border border-border bg-surface/90 px-2 py-1 font-sans text-xs text-muted",
			"aria-label": "এই অংশ লুকান",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, {
				className: "size-3",
				strokeWidth: 1.75
			}), "লুকান"]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
			className: "nsfw-text pr-16",
			style: { fontSize: `${fontSize}px` },
			children: para.text
		})]
	});
}
function ChapterBody({ chapter, fontSize, bookSlug }) {
	let firstBody = true;
	const [open, setOpen] = (0, import_react.useState)(null);
	const mediaItems = (0, import_react.useMemo)(() => {
		const items = [];
		for (const section of chapter.sections) for (const para of section.paragraphs) if (para.kind === "image" || para.kind === "video") items.push({
			para,
			item: {
				id: para.id,
				kind: para.kind,
				src: para.mediaId ? mediaSrc(para.mediaId) : void 0,
				url: para.url,
				caption: para.caption
			}
		});
		return items;
	}, [chapter]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("article", {
		className: "chapter-body mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
				className: "mb-10 text-center",
				children: [
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "ornament mb-3 text-[10px]",
						children: "✦"
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "font-sans text-xs tracking-widest text-lamp",
						children: chapter.titleEn
					}),
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("h1", {
						className: "mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl",
						children: chapter.title
					}),
					chapter.excerpt ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-muted",
						children: chapter.excerpt
					}) : null,
					/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "ornament mt-6 text-[10px]",
						children: "✦"
					})
				]
			}),
			chapter.sections.map((section) => /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("section", {
				id: section.id,
				className: "mb-4",
				children: [section.title ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("h2", {
					className: "mb-6 mt-10 font-display text-xl font-medium text-lamp",
					children: section.title
				}) : null, section.paragraphs.map((para) => {
					if (para.kind === "break") return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
						className: "scene-break",
						"aria-hidden": "true",
						children: "❦"
					}, para.id);
					if (para.kind === "image" || para.kind === "video") {
						firstBody = false;
						const idx = mediaItems.findIndex((m) => m.para.id === para.id);
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(MediaFigure, {
							kind: para.kind,
							src: para.mediaId ? mediaSrc(para.mediaId) : void 0,
							url: para.url,
							caption: para.caption,
							onOpen: para.kind === "image" ? () => setOpen(idx) : void 0
						}, para.id);
					}
					if (para.nsfw) {
						firstBody = false;
						return /* @__PURE__ */ (0, import_jsx_runtime.jsx)(SensitiveBlock, {
							para,
							fontSize,
							toggleId: bookSlug ? `${bookSlug}:${para.id}` : para.id
						}, para.id);
					}
					const drop = firstBody;
					firstBody = false;
					return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						id: para.id,
						className: drop ? "drop-cap text-fg" : "text-fg",
						style: { fontSize: `${fontSize}px` },
						children: para.text
					}, para.id);
				})]
			}, section.id)),
			open != null ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Lightbox, {
				items: mediaItems.map((m) => m.item),
				index: open,
				onClose: () => setOpen(null),
				onIndex: setOpen
			}) : null
		]
	});
}
function ReaderBar({ bookSlug, title, onOpenToc, prevSlug, nextSlug }) {
	const nsfwMode = useReaderStore((s) => s.nsfwMode);
	const showAll = useReaderStore((s) => s.showAllNsfw);
	const hideAll = useReaderStore((s) => s.hideAllNsfw);
	const fontSize = useReaderStore((s) => s.fontSize);
	const setFontSize = useReaderStore((s) => s.setFontSize);
	const theme = useReaderStore((s) => s.theme);
	const setTheme = useReaderStore((s) => s.setTheme);
	const audioOn = useReaderStore((s) => s.audioOn);
	const setAudioOn = useReaderStore((s) => s.setAudioOn);
	const cycleTheme = () => {
		const i = THEMES.findIndex((t) => t.id === theme);
		const next = THEMES[(i + 1) % THEMES.length];
		if (next) setTheme(next.id);
	};
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("header", {
		className: "sticky top-0 z-50 border-b border-border bg-bg/90 backdrop-blur-md",
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-1 px-2 py-1 sm:px-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: onOpenToc,
					className: "pressable grid size-11 shrink-0 place-items-center rounded-md text-fg hover:bg-surface-2 lg:hidden",
					"aria-label": "সূচিপত্র",
					children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(List, {
						className: "size-5",
						strokeWidth: 1.75
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
					to: "/",
					className: "pressable flex items-center gap-2 rounded-md px-2 py-2 text-muted hover:text-fg",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(BookOpen, {
						className: "size-4",
						strokeWidth: 1.75
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "hidden font-display text-sm sm:inline",
						children: "গল্প"
					})]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
					className: "min-w-0 flex-1 truncate px-1 text-center font-display text-sm text-fg",
					children: title
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "flex items-center",
					children: [prevSlug ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/read/$bookSlug/$slug",
						params: {
							bookSlug,
							slug: prevSlug
						},
						className: "pressable grid size-11 place-items-center rounded-md text-fg hover:bg-surface-2",
						"aria-label": "আগের আপডেট",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {
							className: "size-5",
							strokeWidth: 1.75
						})
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-11 place-items-center text-subtle",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronLeft, {
							className: "size-5",
							strokeWidth: 1.75
						})
					}), nextSlug ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
						to: "/read/$bookSlug/$slug",
						params: {
							bookSlug,
							slug: nextSlug
						},
						className: "pressable grid size-11 place-items-center rounded-md text-fg hover:bg-surface-2",
						"aria-label": "পরের আপডেট",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
							className: "size-5",
							strokeWidth: 1.75
						})
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "grid size-11 place-items-center text-subtle",
						children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChevronRight, {
							className: "size-5",
							strokeWidth: 1.75
						})
					})]
				})
			]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center gap-1.5 overflow-x-auto border-t border-border px-2 py-1 sm:px-3",
			children: [
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("button", {
					type: "button",
					onClick: nsfwMode === "shown" ? hideAll : showAll,
					className: cn("pressable inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-3 font-sans text-xs", nsfwMode === "shown" ? "border-nsfw/40 bg-nsfw/10 text-nsfw" : "border-border bg-surface text-muted"),
					children: [nsfwMode === "shown" ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Eye, {
						className: "size-3.5",
						strokeWidth: 1.75
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(EyeOff, {
						className: "size-3.5",
						strokeWidth: 1.75
					}), nsfwMode === "shown" ? "সব লুকান" : "সব দেখান"]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
					className: "inline-flex h-10 shrink-0 items-center rounded-full border border-border bg-surface",
					children: [
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setFontSize(fontSize - 1),
							className: "pressable grid size-10 place-items-center text-muted hover:text-fg",
							"aria-label": "অক্ষর ছোট",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Minus, {
								className: "size-3.5",
								strokeWidth: 1.75
							})
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "min-w-8 text-center font-sans text-xs tabular-nums text-muted",
							children: fontSize
						}),
						/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
							type: "button",
							onClick: () => setFontSize(fontSize + 1),
							className: "pressable grid size-10 place-items-center text-muted hover:text-fg",
							"aria-label": "অক্ষর বড়",
							children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Plus, {
								className: "size-3.5",
								strokeWidth: 1.75
							})
						})
					]
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: () => setAudioOn(!audioOn),
					className: "pressable grid size-10 shrink-0 place-items-center rounded-full border border-border bg-surface text-muted hover:text-fg",
					"aria-label": audioOn ? "আওয়াজ বন্ধ" : "লোফাই বৃষ্টি",
					children: audioOn ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Volume2, {
						className: "size-4",
						strokeWidth: 1.75
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(VolumeX, {
						className: "size-4",
						strokeWidth: 1.75
					})
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
					type: "button",
					onClick: cycleTheme,
					className: "pressable h-10 shrink-0 rounded-full bg-accent px-3 font-sans text-xs text-accent-fg lg:hidden",
					children: THEMES.find((t) => t.id === theme)?.label
				}),
				/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "ml-auto hidden gap-1 lg:flex",
					children: THEMES.map((t) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
						type: "button",
						onClick: () => setTheme(t.id),
						className: cn("pressable h-10 shrink-0 rounded-full px-3 font-sans text-xs", theme === t.id ? "bg-accent text-accent-fg" : "text-muted hover:bg-surface-2 hover:text-fg"),
						title: t.hint,
						children: t.label
					}, t.id))
				})
			]
		})]
	});
}
function TocList({ bookSlug, chapters, activeSlug, onNavigate }) {
	const progress = useReaderStore((s) => s.progress);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsx)("nav", {
		"aria-label": "সূচিপত্র",
		className: "flex flex-col gap-1 pb-8",
		children: chapters.map((ch) => {
			const active = ch.slug === activeSlug;
			const read = Boolean(progress[`${bookSlug}:${ch.slug}`] || progress[ch.slug]);
			return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(Link, {
				to: "/read/$bookSlug/$slug",
				params: {
					bookSlug,
					slug: ch.slug
				},
				onClick: onNavigate,
				"data-active": active,
				className: cn("toc-link pressable group flex items-start gap-3 rounded-md px-3 py-2", "text-left transition-colors duration-150", active ? "text-fg" : "text-muted hover:bg-surface-2 hover:text-fg"),
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { className: cn("mt-1.5 size-1.5 shrink-0 rounded-full", active ? "bg-lamp" : read ? "bg-accent" : "bg-subtle/50") }), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
					className: "min-w-0 flex-1",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("span", {
						className: "flex items-baseline justify-between gap-2",
						children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: cn("font-display text-sm font-medium", active ? "text-fg" : "text-fg/90"),
							children: ch.title
						}), ch.hasNsfw ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
							className: "font-sans text-xs text-nsfw/80",
							children: "সং"
						}) : null]
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {
						className: "mt-0.5 block truncate font-sans text-xs text-muted",
						children: ch.excerpt
					})]
				})]
			}, ch.slug);
		})
	});
}
function TocDrawer({ bookSlug, open, onClose, chapters, activeSlug }) {
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
		className: cn("fixed inset-0 z-60 bg-bg/50 transition-opacity duration-200", open ? "opacity-100" : "pointer-events-none opacity-0"),
		onClick: onClose,
		"aria-hidden": "true"
	}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
		"data-open": open,
		className: "drawer fixed inset-y-0 left-0 z-70 flex w-80 flex-col border-r border-border bg-surface shadow-soft",
		"aria-hidden": !open,
		children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
			className: "flex items-center justify-between gap-3 border-b border-border px-4 py-3",
			children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
				className: "font-display text-base",
				children: "সূচিপত্র"
			}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("p", {
				className: "font-sans text-xs text-muted",
				children: [formatCount(chapters.length), "টি আপডেট · দ্রুত যান"]
			})] }), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("button", {
				type: "button",
				onClick: onClose,
				className: "pressable grid size-11 place-items-center rounded-md text-muted hover:text-fg",
				"aria-label": "সূচি বন্ধ করুন",
				children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(X, {
					className: "size-5",
					strokeWidth: 1.75
				})
			})]
		}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
			className: "flex-1 overflow-y-auto px-2 pt-3",
			children: /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TocList, {
				bookSlug,
				chapters,
				activeSlug,
				onNavigate: onClose
			})
		})]
	})] });
}
function ReaderPage() {
	const { book } = Route$1.useLoaderData();
	const { slug: rawSlug } = Route$1.useParams();
	const slug = padSlug(rawSlug);
	const [chapter, setChapter] = (0, import_react.useState)(null);
	const [error, setError] = (0, import_react.useState)(null);
	const [tocOpen, setTocOpen] = (0, import_react.useState)(false);
	const fontSize = useReaderStore((s) => s.fontSize);
	const setLastSlug = useReaderStore((s) => s.setLastSlug);
	const setProgress = useReaderStore((s) => s.setProgress);
	(0, import_react.useEffect)(() => {
		let live = true;
		setChapter(null);
		setError(null);
		loadChapterForBook(book, slug).then((ch) => {
			if (!live) return;
			setChapter(ch);
			setLastSlug(book.slug, slug);
			setProgress(`${book.slug}:${slug}`, ch.sections[0]?.paragraphs[0]?.id ?? slug);
			window.scrollTo(0, 0);
		}).catch((err) => {
			if (live) setError(err instanceof Error ? err.message : "লোড ব্যর্থ");
		});
		return () => {
			live = false;
		};
	}, [
		book,
		slug,
		setLastSlug,
		setProgress
	]);
	const nav = (0, import_react.useMemo)(() => {
		const i = book.chapters.findIndex((c) => c.slug === slug);
		return {
			prev: i > 0 ? book.chapters[i - 1]?.slug : void 0,
			next: i >= 0 && i < book.chapters.length - 1 ? book.chapters[i + 1]?.slug : void 0
		};
	}, [book.chapters, slug]);
	return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
		className: "min-h-dvh bg-bg",
		children: [
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(AmbientAudio, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(WarningGate, {}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ReaderBar, {
				bookSlug: book.slug,
				title: chapter?.title ?? "পড়া হচ্ছে…",
				onOpenToc: () => setTocOpen(true),
				prevSlug: nav.prev,
				nextSlug: nav.next
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
				className: "mx-auto flex max-w-6xl",
				children: [/* @__PURE__ */ (0, import_jsx_runtime.jsxs)("aside", {
					className: "toc-rail sticky top-28 hidden w-72 shrink-0 overflow-y-auto border-r border-border bg-surface/40 px-2 py-6 lg:block",
					children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
						className: "mb-3 px-3 font-sans text-xs tracking-widest text-subtle",
						children: "সূচিপত্র"
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)(TocList, {
						bookSlug: book.slug,
						chapters: book.chapters,
						activeSlug: slug
					})]
				}), /* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", {
					className: "min-w-0 flex-1",
					children: error ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-md px-6 py-24 text-center",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "font-display text-xl",
								children: "পাতা মেলেনি"
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("p", {
								className: "mt-2 font-sans text-sm text-muted",
								children: error
							}),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
								to: "/book/$bookSlug",
								params: { bookSlug: book.slug },
								className: "pressable mt-6 inline-flex h-11 items-center rounded-lg bg-accent px-4 text-sm text-accent-fg",
								children: "প্রচ্ছদে ফিরুন"
							})
						]
					}) : !chapter ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", {
						className: "mx-auto max-w-2xl space-y-4 px-6 py-16",
						children: [
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "mx-auto h-8 w-40 animate-pulse rounded bg-surface-2" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-24 animate-pulse rounded bg-surface" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-24 animate-pulse rounded bg-surface" }),
							/* @__PURE__ */ (0, import_jsx_runtime.jsx)("div", { className: "h-24 animate-pulse rounded bg-surface" })
						]
					}) : /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, import_jsx_runtime.jsx)(ChapterBody, {
						chapter,
						fontSize,
						bookSlug: book.slug
					}), /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("nav", {
						className: "mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pb-16",
						children: [nav.prev ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/read/$bookSlug/$slug",
							params: {
								bookSlug: book.slug,
								slug: nav.prev
							},
							className: "pressable inline-flex h-12 items-center rounded-lg border border-border bg-surface px-4 font-sans text-sm text-fg",
							children: "আগের আপডেট"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", {}), nav.next ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/read/$bookSlug/$slug",
							params: {
								bookSlug: book.slug,
								slug: nav.next
							},
							className: "pressable inline-flex h-12 items-center rounded-lg bg-accent px-4 font-sans text-sm text-accent-fg",
							children: "পরের আপডেট"
						}) : /* @__PURE__ */ (0, import_jsx_runtime.jsx)(Link, {
							to: "/book/$bookSlug",
							params: { bookSlug: book.slug },
							className: "pressable inline-flex h-12 items-center rounded-lg border border-border px-4 font-sans text-sm text-fg",
							children: "প্রচ্ছদ"
						})]
					})] })
				})]
			}),
			/* @__PURE__ */ (0, import_jsx_runtime.jsx)(TocDrawer, {
				bookSlug: book.slug,
				open: tocOpen,
				onClose: () => setTocOpen(false),
				chapters: book.chapters,
				activeSlug: slug
			})
		]
	});
}
//#endregion
export { ReaderPage as component };
