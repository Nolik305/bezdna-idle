import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";
import { RUNES, BATTLE_PASS_REWARDS_FREE, BATTLE_PASS_REWARDS_PREMIUM } from "../game/data";

export function RunesScreen() {
  const { s, d } = useGame();
  const { runes, equip } = s;

  // Защита от неинициализированных данных
  if (!runes || !Array.isArray(runes.inventory)) {
    return (
      <div className="space-y-4">
        <div className="panel p-4 text-center relative overflow-hidden bg-gradient-to-b from-cyan-500/10 to-transparent">
          <h2 className="text-xl font-display text-cyan-400 tracking-widest">РУНЫ</h2>
          <p className="text-[10px] text-dim mt-1">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/10 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-display text-cyan-400 tracking-widest">РУНЫ</h2>
          <p className="text-[10px] text-dim mt-1">Древняя сила для вашего снаряжения</p>
        </div>
      </div>

      {/* Inventory */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="bag" className="w-4 h-4 text-cyan-400" />
          Инвентарь рун
        </h3>
        {runes.inventory.length === 0 ? (
          <div className="text-center py-8 text-dim">
            <Icon n="question" className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-[10px]">Нет рун в инвентаре</p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-2">
            {runes.inventory.map((runeStack, idx) => (
              <button
                key={idx}
                className="aspect-square rounded-lg border border-cyan-400/30 bg-cyan-400/10 flex flex-col items-center justify-center gap-0.5 hover:bg-cyan-400/20 transition-all"
              >
                <Icon n="spark" className="w-5 h-5 text-cyan-400" />
                <span className="text-[7px] text-fog">{runeStack.count}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Gear with Sockets */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="sword" className="w-4 h-4 text-cyan-400" />
          Снаряжение с гнёздами
        </h3>
        <div className="space-y-3">
          {(Object.keys(equip) as Array<keyof typeof equip>).map((slot) => {
            const item = equip[slot];
            if (!item) return null;
            const gearRunes = runes.gear[item.uid]?.runes || [];
            const sockets = runes.gear[item.uid]?.sockets || 0;
            
            return (
              <div key={slot} className="p-3 rounded-lg bg-black/20 border border-white/5">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] text-fog capitalize">{slot}</span>
                  <span className="text-[9px] text-dim">{item.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  {Array.from({ length: sockets }).map((_, idx) => {
                    const runeId = gearRunes[idx];
                    return (
                      <button
                        key={idx}
                        onClick={() => runeId ? 
                          d({ type: "RUNE_REMOVE", gearUid: item.uid, slotIndex: idx }) :
                          null
                        }
                        className={`w-8 h-8 rounded border-2 flex items-center justify-center ${
                          runeId 
                            ? "border-cyan-400/50 bg-cyan-400/20" 
                            : "border-white/10 bg-black/30"
                        }`}
                      >
                        {runeId ? (
                          <Icon n="spark" className="w-4 h-4 text-cyan-400" />
                        ) : (
                          <span className="text-[10px] text-dim">◦</span>
                        )}
                      </button>
                    );
                  })}
                  {sockets === 0 && (
                    <span className="text-[8px] text-dim">Нет гнёзд</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Rune Types */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3">Типы рун</h3>
        <div className="grid grid-cols-2 gap-2">
          {RUNES.map((config) => (
            <div key={config.id} className="p-2 rounded-lg bg-cyan-500/5 border border-cyan-400/20">
              <div className="flex items-center gap-2 mb-1">
                <Icon n="spark" className="w-4 h-4 text-cyan-400" />
                <span className="text-[10px] font-semibold text-fog">{config.name}</span>
              </div>
              <div className="text-[8px] text-dim">{config.description}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">
          💡 Вставляйте руны в снаряжение для получения бонусов
        </p>
        <p className="text-[9px] text-dim mt-1">
          Комбинируйте руны для активации сет-бонусов
        </p>
      </div>
    </div>
  );
}
