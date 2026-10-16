import { createFileRoute } from "@tanstack/react-router";
import { PokeHeader, useT } from "@/components/pokemon/ui";
import { PetownGame } from "@/components/pokemon/petown-game";

export const Route = createFileRoute("/pokemon/petown")({
  component: PetownPage,
});

function PetownPage() {
  const { t } = useT();
  return (
    <>
      <PokeHeader
        title={t("পেটাউন অ্যারেনা", "Petown Arena")}
        sub={t(
          "পেটাউন গেমের আসল ডেটা — স্ট্যাট, চাল, অ্যাবিলিটি, হোল্ড আইটেম, মেগা / R2 / আল্টিমেট রূপ — নিয়ে ৩ বনাম ৩ টার্ন-ভিত্তিক লড়াই। CPU-র বিরুদ্ধে খেলুন।",
          "A 3-v-3 turn-based battle built on the Petown game's own data — stats, moves, abilities, hold items and the Mega / R2 / Ultimate forms. Play against the CPU.",
        )}
      />
      <PetownGame />
    </>
  );
}
