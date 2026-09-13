import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";

export function BaseScreen() {
  const { s, d } = useGame();
  const { base } = s;

  if (!base.unlocked) {
    return (
      <div className="panel p-8 text-center">
        <Icon n="home" className="w-16 h-16 text-dim mx-auto mb-4" />
        <h2 className="text-lg font-display text-fog">База</h2>
        <p className="text-[11px] text-dim mt-2">База ещё не открыта</p>
        <p className="text-[10px] text-dim mt-1">Достигните 50 зоны для разблокировки</p>
      </div>
    );
  }

  const totalProduction = Object.values(base.buildings).reduce((sum, b) => sum + b.productionRate, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-amber-500/10 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-display text-amber-400 tracking-widest">БАЗА</h2>
          <p className="text-[10px] text-dim mt-1">Управляйте ресурсами</p>
        </div>
      </div>

      {/* Resources */}
      <div className="grid grid-cols-2 gap-2">
        {Object.entries(base.resources).map(([resId, amount]) => (
          <div key={resId} className="panel p-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Icon n={resId === "wood" ? "tree" : resId === "ore" ? "pickaxe" : "leaf"} className="w-5 h-5 text-amber-400" />
              <span className="text-[9px] text-fog capitalize">{resId === "wood" ? "Дерево" : resId === "ore" ? "Руда" : "Еда"}</span>
            </div>
            <span className="text-[11px] font-bold text-amber-300">{fmt(amount)}</span>
          </div>
        ))}
      </div>

      {/* Collect Button */}
      <button
        onClick={() => d({ type: "BASE_COLLECT" })}
        className="w-full panel p-4 flex items-center justify-center gap-3 hover:bg-amber-500/10 transition-all border-amber-500/30"
      >
        <Icon n="bag" className="w-6 h-6 text-amber-400" />
        <span className="text-lg font-display text-fog">СОБРАТЬ РЕСУРСЫ</span>
      </button>

      {/* Buildings */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="home" className="w-4 h-4 text-amber-400" />
          Постройки
        </h3>
        <div className="space-y-3">
          {Object.entries(base.buildings).map(([buildingId, building]) => (
            <div key={buildingId} className="p-3 rounded-lg bg-black/20 border border-white/5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Icon n={buildingId === "lumber" ? "tree" : buildingId === "mine" ? "pickaxe" : "wheat"} className="w-5 h-5 text-amber-400" />
                  <div>
                    <div className="text-[10px] font-semibold text-fog capitalize">
                      {buildingId === "lumber" ? "Лесопилка" : buildingId === "mine" ? "Шахта" : "Ферма"}
                    </div>
                    <div className="text-[8px] text-dim">Уровень {building.level}</div>
                  </div>
                </div>
                <button
                  onClick={() => d({ type: "BASE_UPGRADE_BUILDING", buildingId })}
                  className="px-2 py-1 rounded text-[8px] text-gold border border-gold/50 hover:bg-gold/10"
                >
                  Улучшить
                </button>
              </div>
              <div className="flex items-center justify-between text-[8px] text-dim">
                <span>{building.productionRate} / час</span>
                <span className="text-amber-300">+{Math.floor(building.productionRate * 0.1)} при улучшении</span>
              </div>
              
              {/* Hero Assignment */}
              <div className="mt-2 pt-2 border-t border-white/5">
                <div className="text-[8px] text-dim mb-1">Назначить героя:</div>
                <div className="flex gap-1">
                  {["mage", "archer"].map((classId) => (
                    <button
                      key={classId}
                      onClick={() => d({ type: "BASE_ASSIGN_HERO", buildingId, classId: classId as any })}
                      className={`px-2 py-1 rounded text-[8px] ${
                        building.assignedHero === classId 
                          ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" 
                          : "bg-black/20 text-dim border border-white/5"
                      }`}
                    >
                      {classId === "mage" ? "Маг" : "Лучник"}
                    </button>
                  ))}
                  <button
                    onClick={() => d({ type: "BASE_ASSIGN_HERO", buildingId, classId: null })}
                    className={`px-2 py-1 rounded text-[8px] ${
                      !building.assignedHero 
                        ? "bg-red-500/20 text-red-300 border border-red-500/30" 
                        : "bg-black/20 text-dim border border-white/5"
                    }`}
                  >
                    Снять
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Info */}
      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">
          💡 Назначенные герои увеличивают производство на 50%
        </p>
      </div>
    </div>
  );
}
