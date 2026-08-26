#!/usr/bin/env python3
"""Parse the Bengali novel into chapter JSON for the web book."""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

SRC = Path("/workspace/attachments/অঘটনঘটন পটিয়সী.md")
OUT = Path("/workspace/public/book")

BN_DIGITS = str.maketrans("0123456789", "০১২৩৪৫৬৭৮৯")
BN_WORD_NUM = {
    "এক": 1,
    "দুই": 2,
    "তিন": 3,
    "চার": 4,
    "পাঁচ": 5,
    "পাচ": 5,
    "ছয়": 6,
    "ছয়": 6,
    "সাত": 7,
    "আট": 8,
    "নয়": 9,
    "নয়": 9,
    "দশ": 10,
}

# Explicit sexual / graphic terms (Bengali + English slang used in the text).
# Romance, kisses, and mild attraction are left unmarked unless stacked with these.
NSFW_RE = re.compile(
    r"("
    r"চোদন|চোদার|চুদের|চোদা|চুদা|চুদে|চোদে|চোদ|চুদ|"
    r"ফাক\s*মি|ফাক ইউ|ফাক মি|fuck|fucking|fucked|"
    r"ভোদাআ|ভোদা|গুদের|গুদে|\bগুদ\b|যৌনি|যোনি|"
    r"স্তন|নিপল|nipple|boobs?|"
    r"প্যান্টি|প্যান্টী|lingerie|"
    r"হস্তমৈথুন|অর্গাজম|orgasm|সেক্স|\bsex\b|porn|পর্ন|"
    r"কুত্তা\s*চোদ|ডগি|doggy|"
    r"অজগর|কলাটা|"
    r"(?<![বভ]য়স )(?<![বভ]য়স )(?<!বয়সের )বাড়া(?![রন])|(?<![বভ]য়স )(?<![বভ]য়স )বাড়া(?![রন])|"
    r"ট্যাংকার|হেডলাইট|"
    r"মাগী|মাগি|খানকি|বেশ্যা|\bbitch\b|"
    r"চুষে|চুষে|চেটে\s*চেটে|জিহবা|"
    r"জননাংগ|পেনিস|penis|vagina|"
    r"সহবাস|যৌনমিলন|রমণের|রমণ |"
    r"নিতম্ব|পাছায়|পাছায়|পাছা|"
    r"দুধের\s*ট্যাংকার|দুধ\s*চুষ|"
    r"কোল\s*চোদ|ঘোড়া\s*চোদ|ঘোড়া\s*চোদ|"
    r"ফাক\s*করে|ফাক করা|ফাক করে|"
    r"খাস\s*এমন|"
    r"পিনন্নীত|পয়োধর|পয়োধর|গুরুনিতম্বিনী|"
    r"মাল\s*ফেল|"
    r"blowjob|cunnilingus|"
    r"আকাশী\s*(?:কালারের\s*)?ব্রা|ব্রায়ে|ব্রা |"
    r"কুত্তাআ|"
    r"হিট মি|hit me hard|fuck me|"
    r"ডোন্ট বি এ পুসি"
    r")",
    re.I,
)

# Milder erotic cues — only mark if 3+ in one paragraph.
MILD_RE = re.compile(
    r"("
    r"মেক\s*আউট|make\s*out|"
    r"গরম করে ফেল|হট হয়ে আছ|হট হয়ে আছ|"
    r"বুকজোড়া|বুকজোড়া|"
    r"নরম বুক|"
    r"কামনা|বাসনা|"
    r"উত্তেজন|"
    r"জিন্স পড়লে ওর পিছন"
    r")",
    re.I,
)

CHAPTER_HEAD = re.compile(
    r"^#{1,3}\s*\**\s*আপডেট\s+([^\*\n#]+?)\s*\**\s*$",
    re.M,
)
SUB_HEAD = re.compile(
    r"^(?:#{1,3}\s*)?\**\s*([কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহড়ঢ়য়])\s*\**\s*$",
    re.M,
)
SEP_LINE = re.compile(r"^#{0,3}\s*(?:\t|&?#x09;|\s)*\**\\?\*\\?\*\\?\*\**\s*$")
EMPTY_HEAD = re.compile(r"^#{1,3}\s*$")
MD_JUNK = re.compile(r"^#{1,3}\s*(?:&#x09;|\t|\s)*\**\s*$")


def bn_num(n: int) -> str:
    return str(n).translate(BN_DIGITS)


def parse_chapter_num(raw: str) -> int:
    s = raw.strip().strip("*").strip()
    s = re.sub(r"\s+", "", s)
    if s in BN_WORD_NUM:
        return BN_WORD_NUM[s]
    # Bengali digits
    trans = str.maketrans("০১২৩৪৫৬৭৮৯", "0123456789")
    digits = s.translate(trans)
    m = re.search(r"\d+", digits)
    if m:
        return int(m.group())
    raise ValueError(f"Cannot parse chapter number from {raw!r}")


def clean_inline(s: str) -> str:
    s = html.unescape(s)
    s = s.replace("\u00a0", " ")
    s = s.replace("&#x09;", " ")
    s = re.sub(r"\\(?=[*_])", "", s)
    s = re.sub(r"\*{1,3}([^*]+)\*{1,3}", r"\1", s)
    s = re.sub(r"_{1,2}([^_]+)_{1,2}", r"\1", s)
    s = re.sub(r"`+", "", s)
    s = re.sub(r"[ \t]+", " ", s)
    return s.strip()


def is_separator(line: str) -> bool:
    t = line.strip()
    if not t:
        return False
    t = html.unescape(t)
    t = re.sub(r"[#\t\s\\*]+", "", t)
    t = t.replace("&#x09;", "")
    return t in {"", "***", "—", "— — —", "•••"} and ("*" in line or "—" in line)


def paragraph_nsfw(text: str) -> bool:
    if NSFW_RE.search(text):
        return True
    mild = MILD_RE.findall(text)
    if len(mild) >= 3 and len(text) > 80:
        return True
    return False


def expand_nsfw(flags: list[bool]) -> list[bool]:
    """Fill 1-gap holes inside a sex scene so a scene reads as one block."""
    out = flags[:]
    n = len(out)
    for i in range(1, n - 1):
        if not out[i] and out[i - 1] and out[i + 1]:
            out[i] = True
    # If a run of nsfw is long, pull in the immediately following short reaction para
    i = 0
    while i < n:
        if out[i]:
            j = i
            while j < n and out[j]:
                j += 1
            run = j - i
            if run >= 3 and j < n:
                out[j] = True
            i = j
        else:
            i += 1
    return out


def split_paragraphs(block: str) -> list[dict]:
    # Normalize newlines
    block = block.replace("\r\n", "\n")
    raw_paras = re.split(r"\n\s*\n+", block)
    paras: list[dict] = []
    for raw in raw_paras:
        lines = [ln for ln in raw.split("\n")]
        buf: list[str] = []
        for ln in lines:
            if EMPTY_HEAD.match(ln) or MD_JUNK.match(ln):
                continue
            if is_separator(ln) or re.search(r"\*{3,}", ln):
                if buf:
                    text = clean_inline(" ".join(buf))
                    if text:
                        paras.append({"text": text, "kind": "p"})
                    buf = []
                paras.append({"text": "", "kind": "break"})
                continue
            # drop leftover heading markers inside body
            if re.match(r"^#{1,3}\s", ln):
                ln = re.sub(r"^#{1,3}\s*", "", ln)
            ln = clean_inline(ln)
            if ln:
                # leftover bare section letters should not become body text
                if re.fullmatch(r"[কখগঘঙচছজঝঞটঠডঢণতথদধনপফবভমযরলশষসহড়ঢ়য়]", ln):
                    continue
                buf.append(ln)
        if buf:
            text = clean_inline(" ".join(buf))
            if text:
                paras.append({"text": text, "kind": "p"})
    # collapse consecutive breaks
    cleaned: list[dict] = []
    for p in paras:
        if p["kind"] == "break" and cleaned and cleaned[-1]["kind"] == "break":
            continue
        cleaned.append(p)
    # trim leading/trailing breaks
    while cleaned and cleaned[0]["kind"] == "break":
        cleaned.pop(0)
    while cleaned and cleaned[-1]["kind"] == "break":
        cleaned.pop()
    return cleaned


def excerpt_of(paras: list[dict], n: int = 110) -> str:
    for p in paras:
        if p["kind"] == "p" and len(p["text"]) > 40:
            t = p["text"]
            return t[:n].rstrip() + ("…" if len(t) > n else "")
    return ""


def main() -> None:
    raw = SRC.read_text(encoding="utf-8")
    raw = html.unescape(raw)

    # Find chapter starts
    starts: list[tuple[int, int, str]] = []
    for m in CHAPTER_HEAD.finditer(raw):
        num = parse_chapter_num(m.group(1))
        starts.append((m.start(), num, m.group(0)))
    starts.sort(key=lambda x: x[0])

    OUT.mkdir(parents=True, exist_ok=True)
    chapters_dir = OUT / "chapters"
    chapters_dir.mkdir(exist_ok=True)

    index: list[dict] = []
    total_paras = 0
    total_nsfw = 0
    total_chars = 0

    for i, (pos, num, _head) in enumerate(starts):
        end = starts[i + 1][0] if i + 1 < len(starts) else len(raw)
        body = raw[pos:end]
        # strip the chapter heading line
        body = CHAPTER_HEAD.sub("", body, count=1)

        # split subsections
        sub_matches = list(SUB_HEAD.finditer(body))
        sections: list[dict] = []
        if not sub_matches:
            paras = split_paragraphs(body)
            sections.append({"id": "main", "title": "", "paragraphs": paras})
        else:
            pre = body[: sub_matches[0].start()]
            pre_paras = split_paragraphs(pre)
            if pre_paras:
                sections.append({"id": "main", "title": "", "paragraphs": pre_paras})
            for si, sm in enumerate(sub_matches):
                s_end = sub_matches[si + 1].start() if si + 1 < len(sub_matches) else len(body)
                letter = sm.group(1)
                chunk = body[sm.end() : s_end]
                sections.append(
                    {
                        "id": f"s-{letter}",
                        "title": f"পর্ব {letter}",
                        "paragraphs": split_paragraphs(chunk),
                    }
                )

        # nsfw flags + ids
        pid = 0
        nsfw_count = 0
        para_count = 0
        chars = 0
        all_flags: list[tuple[int, int, bool]] = []  # section idx, para idx, flag
        for si, sec in enumerate(sections):
            flags = []
            for p in sec["paragraphs"]:
                if p["kind"] == "p":
                    flags.append(paragraph_nsfw(p["text"]))
                else:
                    flags.append(False)
            flags = expand_nsfw(flags)
            for pi, p in enumerate(sec["paragraphs"]):
                pid += 1
                p["id"] = f"p-{num}-{pid}"
                if p["kind"] == "p":
                    p["nsfw"] = bool(flags[pi])
                    para_count += 1
                    chars += len(p["text"])
                    if p["nsfw"]:
                        nsfw_count += 1
                else:
                    p["nsfw"] = False

        flat = []
        for sec in sections:
            flat.extend([p for p in sec["paragraphs"] if p["kind"] == "p"])

        title = f"আপডেট {bn_num(num)}"
        excerpt = excerpt_of(flat)
        chapter = {
            "id": num,
            "slug": f"{num:02d}",
            "title": title,
            "titleEn": f"Update {num}",
            "excerpt": excerpt,
            "paraCount": para_count,
            "nsfwCount": nsfw_count,
            "chars": chars,
            "sections": sections,
        }
        (chapters_dir / f"{num:02d}.json").write_text(
            json.dumps(chapter, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
        index.append(
            {
                "id": num,
                "slug": f"{num:02d}",
                "title": title,
                "titleEn": f"Update {num}",
                "excerpt": excerpt,
                "paraCount": para_count,
                "nsfwCount": nsfw_count,
                "chars": chars,
                "hasNsfw": nsfw_count > 0,
            }
        )
        total_paras += para_count
        total_nsfw += nsfw_count
        total_chars += chars
        print(
            f"ch {num:02d} paras={para_count:4d} nsfw={nsfw_count:4d} chars={chars:7d} file={(chapters_dir / f'{num:02d}.json').stat().st_size:8d}"
        )

    meta = {
        "title": "অঘটনঘটন পটিয়সী",
        "titleEn": "Aghotonghoton Potiyoshi",
        "author": "অজানা",
        "language": "bn",
        "chapterCount": len(index),
        "paraCount": total_paras,
        "nsfwCount": total_nsfw,
        "chars": total_chars,
        "chapters": index,
    }
    (OUT / "index.json").write_text(
        json.dumps(meta, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print("---")
    print("chapters", len(index), "paras", total_paras, "nsfw", total_nsfw, "chars", total_chars)


if __name__ == "__main__":
    main()
