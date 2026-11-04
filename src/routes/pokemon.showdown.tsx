import { createFileRoute } from "@tanstack/react-router";
import { ShowdownGame } from "@/components/pokemon/showdown/showdown-game";
import { PokeHeader, useT } from "@/components/pokemon/ui";

export const Route = createFileRoute("/pokemon/showdown")({
  component: ShowdownPage,
});

function ShowdownPage() {
  const { t } = useT();
  return (
    <>
      <PokeHeader
        title={t("ফাইট শোডাউন", "Fight Showdown")}
        sub={t(
          "সামনাসামনি লড়াই: জ্যাব, কিক, স্পেশাল আর পাওয়ার ভরলে সুপার মুভ। কম্পিউটারের বিরুদ্ধে, একই ডিভাইসে দুজন, অথবা কোড দিয়ে বন্ধুর সাথে অনলাইনে।",
          "A side-on fighting game: jab, kick, special, and a super move when your POWER bar fills. Play the computer, two on one device, or a friend online with a room code.",
        )}
      />
      <ShowdownGame />
    </>
  );
}
