import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

// A small, assistive writing helper — not a content generator. It only
// works with text the author already wrote (a title, a chapter's opening),
// producing a tagline/excerpt/description from it. Uses Google's Gemini
// API, which has a genuinely free developer tier (no card required) via
// a key from aistudio.google.com.

const MODEL = "gemini-2.5-flash-lite";

function isAiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function callGemini(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("AI সংযোগ দেওয়া নেই। GEMINI_API_KEY সেট করুন।");

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 300 },
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`AI সাড়া দেয়নি (${res.status}). ${body.slice(0, 200)}`);
  }

  const json = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("AI থেকে কোনো লেখা পাওয়া যায়নি");
  return text.trim();
}

export const aiStatus = createServerFn({ method: "GET" }).handler(async () => {
  return { configured: isAiConfigured() };
});

export const suggestBookBlurb = createServerFn({ method: "POST" })
  .validator(z.object({ title: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ tagline: string; description: string }> => {
    const prompt = [
      "তুমি একজন বাংলা সাহিত্য সম্পাদক। নিচের বইয়ের শিরোনাম দেখে একটি সংক্ষিপ্ত",
      "ট্যাগলাইন (এক লাইন) এবং একটি পরিচিতি (২-৩ বাক্য) লেখো। কোনো ব্যাখ্যা ছাড়া",
      "শুধু এই সঠিক ফরম্যাটে উত্তর দাও:",
      "ট্যাগলাইন: <এখানে>",
      "পরিচিতি: <এখানে>",
      "",
      `শিরোনাম: ${data.title}`,
    ].join("\n");

    const text = await callGemini(prompt);
    const taglineMatch = text.match(/ট্যাগলাইন:\s*(.+)/);
    const descMatch = text.match(/পরিচিতি:\s*([\s\S]+)/);
    return {
      tagline: taglineMatch?.[1]?.trim() ?? "",
      description: descMatch?.[1]?.trim() ?? "",
    };
  });

export const suggestChapterExcerpt = createServerFn({ method: "POST" })
  .validator(z.object({ chapterText: z.string().min(1) }))
  .handler(async ({ data }): Promise<{ excerpt: string }> => {
    const trimmed = data.chapterText.slice(0, 3000);
    const prompt = [
      "নিচের অধ্যায়ের লেখা থেকে একটি সংক্ষিপ্ত, আকর্ষণীয় প্রিভিউ (১-২ বাক্য, বাংলায়)",
      "লেখো — গল্পের মূল রহস্য না বলে শুধু আগ্রহ তৈরি করো। শুধু প্রিভিউটুকুই লেখো,",
      "অন্য কিছু নয়।",
      "",
      trimmed,
    ].join("\n");

    const text = await callGemini(prompt);
    return { excerpt: text };
  });
