import type { Chapter } from "@/lib/book";
import { SensitiveBlock } from "@/components/book/sensitive-block";

export function ChapterBody({
  chapter,
  fontSize,
}: {
  chapter: Chapter;
  fontSize: number;
}) {
  let firstBody = true;

  return (
    <article className="chapter-body mx-auto max-w-2xl px-4 pb-24 pt-8 sm:px-6">
      <header className="mb-10 text-center">
        <p className="ornament mb-3 text-[10px]">✦</p>
        <p className="font-sans text-xs tracking-widest text-lamp">
          {chapter.titleEn}
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold text-fg sm:text-4xl">
          {chapter.title}
        </h1>
        {chapter.excerpt ? (
          <p className="mx-auto mt-4 max-w-md font-sans text-sm leading-relaxed text-muted">
            {chapter.excerpt}
          </p>
        ) : null}
        <p className="ornament mt-6 text-[10px]">✦</p>
      </header>

      {chapter.sections.map((section) => (
        <section key={section.id} id={section.id} className="mb-4">
          {section.title ? (
            <h2 className="mb-6 mt-10 font-display text-xl font-medium text-lamp">
              {section.title}
            </h2>
          ) : null}
          {section.paragraphs.map((para) => {
            if (para.kind === "break") {
              return (
                <div key={para.id} className="scene-break" aria-hidden="true">
                  ❦
                </div>
              );
            }
            if (para.nsfw) {
              firstBody = false;
              return <SensitiveBlock key={para.id} para={para} fontSize={fontSize} />;
            }
            const drop = firstBody;
            firstBody = false;
            return (
              <p
                key={para.id}
                id={para.id}
                className={drop ? "drop-cap text-fg" : "text-fg"}
                style={{ fontSize: `${fontSize}px` }}
              >
                {para.text}
              </p>
            );
          })}
        </section>
      ))}
    </article>
  );
}
