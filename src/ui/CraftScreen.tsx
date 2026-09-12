import { useState } from "react";
import { useGame } from "../game/useGame";
import { RESOURCES, RESOURCE_ICON, CRAFT_RECIPES, ZONE_RESOURCES, RARITY, SLOT_INFO, type CraftRecipe } from "../game/data";
import { fmt, SLOTS } from "../game/logic";
import { Icon, SectionTitle } from "./bits";
import { slotItemSprite } from "../game/sprites";
import type { Slot, BaseSlot } from "../game/types";

// Отображение слота: ring1/ring2 показываем как "Кольцо".
function slotDisp(sl: Slot): { n: string; icon: string } {
  if (sl === "ring1" || sl === "ring2") return SLOT_INFO.ring;
  return SLOT_INFO[sl];
}

function slotBase(sl: Slot): BaseSlot {
  return sl === "ring1" || sl === "ring2" ? "ring" : (sl as BaseSlot);
}

function RecipeCard({ r }: { r: CraftRecipe }) {
  const { s, d } = useGame();
  const [slot, setSlot] = useState<Slot>("weapon");
  const miss = r.mats.find(m => (s.resources[m.type] || 0) < m.amount);
  const isSlotRecipe = r.result.kind === "item"; // только ковка требует выбор слота
  const craft = () => {
    if (isSlotRecipe) d({ type: "CRAFT_SLOT", id: r.id, slot });
    else d({ type: "CRAFT", id: r.id });
  };
  return (
    <div className={`bg-abyss/60 border rounded-xl p-3 ${miss ? "border-line/60" : "border-gold/40"}`}
      style={!miss ? { boxShadow: "0 0 14px rgba(240,180,41,0.12)" } : undefined}>
      <div className="flex items-center gap-2.5">
        <div className="w-11 h-11 shrink-0 rounded-xl grid place-items-center text-2xl border border-line/60 bg-black/30">
          {r.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-display text-[13px] text-fog">{r.name}</div>
          <div className="text-[10px] text-dim leading-snug">{r.desc}</div>
        </div>
        <button disabled={!!miss} onClick={craft}
          className={`btn shrink-0 px-3 py-2 text-[11px] ${miss ? "btn-dark" : "btn-gold"}`}>
          Создать
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {r.mats.map(m => {
          const have = s.resources[m.type] || 0;
          const ok = have >= m.amount;
          return (
            <span key={m.type}
              className={`text-[10px] px-2 py-0.5 rounded-md border flex items-center gap-1 tabular-nums ${ok ? "border-gold/40 text-gold" : "border-line/60 text-dim"}`}>
              {RESOURCE_ICON[m.type]} {m.amount} <span className="opacity-70">/ {have}</span>
            </span>
          );
        })}
        {r.result.kind === "item" && (r.result.minRarity ?? 0) > 0 && (
          <span className="text-[9px] px-2 py-0.5 rounded-md border border-line/60 flex items-center gap-1"
            style={{ color: RARITY[r.result.minRarity!].color }}>
            {RARITY[r.result.minRarity!].name}+
          </span>
        )}
      </div>
      {isSlotRecipe && (
        <div className="mt-2">
          <div className="text-[9px] text-dim mb-1">Слот для ковки:</div>
          <div className="flex flex-wrap gap-1">
            {SLOTS.map(sl => {
              const sd = slotDisp(sl);
              return (
                <button key={sl} onClick={() => setSlot(sl)}
                  className={`px-2 py-1 rounded-md border text-[9px] transition flex items-center gap-1 ${slot === sl ? "bg-gold/15 border-gold/50 text-gold" : "border-line/60 text-dim hover:text-fog"}`}>
                  <img src={slotItemSprite(slotBase(sl), 3)} className="w-4 h-4 object-contain" draggable={false} />{sd.n}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export function CraftSeg() {
  const { s } = useGame();
  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3">
        <SectionTitle icon="goblin" right={<span className="text-[10px] text-dim">ресурсы падают с врагов в зонах</span>}>
          РЕСУРСЫ
        </SectionTitle>
        <div className="grid grid-cols-2 gap-1.5">
          {RESOURCES.map(r => {
            const n = s.resources[r.key] || 0;
            return (
              <div key={r.key} className="bg-abyss/60 border border-line/60 rounded-lg px-2.5 py-1.5 flex items-center gap-2">
                <span className="text-lg leading-none">{r.icon}</span>
                <span className="flex-1 text-[11px] text-fog">{r.name}</span>
                <span className="text-[12px] font-bold tabular-nums" style={{ color: r.color }}>{fmt(n)}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="panel p-3">
        <SectionTitle icon="scroll" right={<span className="text-[10px] text-dim">куда падает</span>}>ДОБЫЧА ПО ЗОНАМ</SectionTitle>
        <div className="flex flex-col gap-1.5">
          {Object.entries(ZONE_RESOURCES).map(([z, list]) => (
            <div key={z} className="flex items-center gap-2 bg-abyss/40 border border-line/50 rounded-lg px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-fog w-6">з.{+z + 1}</span>
              <div className="flex gap-1.5">
                {list.map(k => (
                  <span key={k} title={RESOURCE_ICON[k]} className="text-lg leading-none">{RESOURCE_ICON[k]}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel p-3">
        <SectionTitle icon="gear" right={<span className="text-[10px] text-dim">крафт из ресурсов</span>}>МАСТЕРСКАЯ</SectionTitle>
        <div className="flex flex-col gap-2">
          {CRAFT_RECIPES.map(r => <RecipeCard key={r.id} r={r} />)}
        </div>
      </div>
    </div>
  );
}
