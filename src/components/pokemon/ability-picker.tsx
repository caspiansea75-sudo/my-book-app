import { useT } from "@/components/pokemon/ui";
import { ABILITIES, SPECIES_ABILITIES, abilitiesOf } from "@/lib/pokemon/arena-abilities";

const KEY = "arena-ability-v1";
/** The ability chosen earlier for each Pokémon on this device (its first one if none was chosen). */
export const loadAbility = (species: string): string => {
  const list = abilitiesOf(species);
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
    const id = all[species];
    if (id && list.includes(id)) return id;
  } catch {
    /* storage unavailable */
  }
  return list[0] ?? "";
};
export const saveAbility = (species: string, id: string) => {
  try {
    const all = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, string>;
    all[species] = id;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    /* storage unavailable */
  }
};

/** Choose which of its abilities a Pokémon fights with, and read what it does. */
export function AbilityPicker({ species, value, onChange }: { species: string; value: string; onChange: (id: string) => void }) {
  const { t } = useT();
  const list = abilitiesOf(species);
  if (!list.length) return null;
  const sel = ABILITIES[list.includes(value) ? value : list[0]!]!;
  const hidden = SPECIES_ABILITIES[species]?.[2];
  return (
    <div className="ab-abil">
      <div className="ab-abil-h">{t("বিশেষ ক্ষমতা", "Ability")}</div>
      <div className="ab-abil-row">
        {list.map((id) => (
          <button key={id} type="button" aria-pressed={id === sel.id} className={`ab-abil-b ${id === sel.id ? "on" : ""}`} onClick={() => onChange(id)}>
            {ABILITIES[id]!.name}
            {id === hidden && list.indexOf(id) > 0 && SPECIES_ABILITIES[species]?.[0] !== id && SPECIES_ABILITIES[species]?.[1] !== id ? <small> · {t("গোপন", "hidden")}</small> : null}
          </button>
        ))}
      </div>
      <p className="ab-abil-d">{sel.desc}</p>
    </div>
  );
}
