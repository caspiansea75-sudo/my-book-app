import { createFileRoute } from "@tanstack/react-router";
import { ArenaBrawl } from "@/components/pokemon/arena-brawl";
import { PokeHeader, useT } from "@/components/pokemon/ui";

export const Route = createFileRoute("/pokemon/brawl")({
  component: BrawlPage,
});

function BrawlPage() {
  const { t } = useT();
  return (
    <>
      <PokeHeader
        title={t("অ্যারেনা ব্রল", "Arena Brawl")}
        sub={t(
          "রিয়েল-টাইম, টপ-ডাউন লড়াই: নিজে চলুন, গুলি এড়িয়ে গড়ান, কম্বো করুন। ওয়েভ সারভাইভাল বা ৫-জনের ব্যাটল রয়্যাল।",
          "A real-time, top-down brawl: move, roll through shots, chain combos. Wave survival or a five-way battle royale.",
        )}
      />
      <ArenaBrawl />
    </>
  );
}
