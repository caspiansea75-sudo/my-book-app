import { useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type RefObject } from "react";
import { Users } from "lucide-react";
import { Avatar } from "@/components/members/avatar";
import { EVERYONE, activeMention, mentionOptions, splitMentions, type MentionOption, type MentionPerson } from "@/lib/mentions";
import { cn } from "@/lib/utils";
import "@/components/chat/chat-fx.css";

/**
 * The message box. Type "@" to pick a member (or everyone); mentions show highlighted right in the box.
 * `people` = null turns mentions off (private chats) and it behaves like a normal box.
 */
export function MentionTextarea({
  areaRef,
  value,
  onValue,
  onKeyDown,
  people,
  placeholder,
  maxHeight,
  maxLength,
  className,
}: {
  areaRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onValue: (next: string) => void;
  onKeyDown: (e: KeyboardEvent<HTMLTextAreaElement>) => void;
  people: MentionPerson[] | null;
  placeholder: string;
  maxHeight: number;
  maxLength?: number;
  className?: string;
}) {
  const [caret, setCaret] = useState(0);
  const [index, setIndex] = useState(0);
  const [closed, setClosed] = useState(false);
  const back = useRef<HTMLDivElement>(null);

  const act = people ? activeMention(value, caret) : null;
  const options = useMemo(() => (act && people ? mentionOptions(people, act.query) : []), [act?.query, act?.start, people]); // eslint-disable-line react-hooks/exhaustive-deps
  const open = options.length > 0 && !closed;

  useEffect(() => setIndex(0), [act?.query]);

  // Grow with the text, up to maxHeight.
  useLayoutEffect(() => {
    const el = areaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
    if (back.current) back.current.scrollTop = el.scrollTop;
  }, [value, maxHeight, areaRef]);

  const names = useMemo(() => (people ?? []).map((p) => p.name), [people]);
  const segs = useMemo(() => (people ? splitMentions(value, names, "") : []), [people, value, names]);

  function pick(opt: MentionOption) {
    if (!act) return;
    const label = opt.kind === "everyone" ? EVERYONE : opt.person.name;
    const insert = `@${label} `;
    const next = value.slice(0, act.start) + insert + value.slice(caret);
    if (maxLength && next.length > maxLength) return;
    onValue(next);
    setClosed(false);
    const at = act.start + insert.length;
    window.requestAnimationFrame(() => {
      const el = areaRef.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(at, at);
      setCaret(at);
    });
  }

  function keys(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (open && !e.nativeEvent.isComposing) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setIndex((i) => (i + (e.key === "ArrowDown" ? 1 : -1) + options.length) % options.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        pick(options[index] ?? options[0]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setClosed(true);
        return;
      }
    }
    onKeyDown(e);
  }

  const sync = (el: HTMLTextAreaElement) => setCaret(el.selectionStart ?? 0);

  // Private chats: a plain box, exactly as before.
  if (!people) {
    return (
      <textarea
        ref={areaRef}
        rows={1}
        value={value}
        maxLength={maxLength}
        onChange={(e) => onValue(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        className={cn("field-input resize-none", className)}
      />
    );
  }

  return (
    <div className="cx-mention-wrap relative min-w-0 flex-1">
      {open ? (
        <div role="listbox" aria-label="উল্লেখ করুন" className="cx-picker absolute bottom-full left-0 z-30 mb-2 max-h-56 w-[min(300px,100%)] overflow-y-auto rounded-xl border border-border bg-surface-2 p-1 shadow-2xl">
          {options.map((o, k) => (
            <button
              key={o.kind === "everyone" ? "everyone" : o.person.id}
              type="button"
              role="option"
              aria-selected={k === index}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setIndex(k)}
              onClick={() => pick(o)}
              className={cn("flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left font-sans text-sm", k === index ? "bg-surface text-fg" : "text-muted")}
            >
              {o.kind === "everyone" ? (
                <>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent text-accent-fg">
                    <Users className="size-4" strokeWidth={1.75} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-fg">@everyone</span>
                    <span className="block truncate text-xs text-muted">চ্যাটের সবাই নোটিফিকেশন পাবে</span>
                  </span>
                </>
              ) : (
                <>
                  <Avatar name={o.person.name} url={o.person.avatarUrl} size={32} />
                  <span className="min-w-0">
                    <span data-no-i18n className="block truncate text-fg">
                      {o.person.name}
                    </span>
                    <span data-no-i18n className="block truncate text-xs text-muted">
                      @{o.person.username}
                    </span>
                  </span>
                </>
              )}
            </button>
          ))}
        </div>
      ) : null}
      <div ref={back} aria-hidden="true" className="field-input cx-mention-back">
        {segs.map((s, k) =>
          s.mention ? (
            <span key={k} className="cx-mention-in">
              {s.text}
            </span>
          ) : (
            <span key={k}>{s.text}</span>
          ),
        )}
        {"\u200b"}
      </div>
      <textarea
        ref={areaRef}
        rows={1}
        value={value}
        maxLength={maxLength}
        onChange={(e) => {
          onValue(e.target.value);
          setClosed(false);
          sync(e.target);
        }}
        onKeyDown={keys}
        onKeyUp={(e) => sync(e.currentTarget)}
        onClick={(e) => sync(e.currentTarget)}
        onSelect={(e) => sync(e.currentTarget)}
        onScroll={(e) => {
          if (back.current) back.current.scrollTop = e.currentTarget.scrollTop;
        }}
        placeholder={placeholder}
        className={cn("field-input cx-mention-ta resize-none", className)}
      />
    </div>
  );
}
