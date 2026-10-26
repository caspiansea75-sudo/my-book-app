import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { ArenaBrawl } from "@/components/pokemon/arena-brawl";
import { ArenaMulti } from "@/components/pokemon/arena-multi";
import { PokeHeader, useT } from "@/components/pokemon/ui";

export const Route = createFileRoute("/pokemon/brawl")({
  component: BrawlPage,
});

function BrawlPage() {
  const { t } = useT();
  const [tab, setTab] = useState<"solo" | "online">("solo");
  return (
    <>
      <PokeHeader
        title={t("অ্যারেনা ব্রল", "Arena Brawl")}
        sub={t(
          "রিয়েল-টাইম, টপ-ডাউন লড়াই: নিজে চলুন, গুলি এড়িয়ে গড়ান, কম্বো করুন। ওয়েভ সারভাইভাল বা ৫-জনের ব্যাটল রয়্যাল।",
          "A real-time, top-down brawl: move, roll through shots, chain combos. Wave survival or a five-way battle royale.",
        )}
      />
      <div className="ab-modes" style={{ maxWidth: 520, margin: "0 auto 14px" }}>
        <button type="button" className={`ab-mode ${tab === "solo" ? "on" : ""}`} onClick={() => setTab("solo")}>
          <b>{t("একা", "Solo")}</b>
          <span>{t("সারভাইভাল বা কম্পিউটারের বিরুদ্ধে রয়্যাল", "Survival, or a royale against the computer")}</span>
        </button>
        <button type="button" className={`ab-mode ${tab === "online" ? "on" : ""}`} onClick={() => setTab("online")}>
          <b>{t("অনলাইন (২–৫ জন)", "Online (2–5 players)")}</b>
          <span>{t("অন্য সদস্যদের সাথে ব্যাটল রয়্যাল", "Battle royale against other members")}</span>
        </button>
      </div>
      {tab === "solo" ? <ArenaBrawl /> : <ArenaMulti />}
    </>
  );
}
