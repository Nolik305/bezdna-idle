import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";
import { PETS, RUNES, BATTLE_PASS_REWARDS_FREE, BATTLE_PASS_REWARDS_PREMIUM } from "../game/data";

export function PetScreen() {
  const { s, d } = useGame();
  const { pet } = s;
  
  // Защита от неинициализированных данных
  if (!pet || !Array.isArray(pet.owned)) {
    return (
      <div className="space-y-4">
        <div className="panel p-4 text-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent" />
          <div className="relative">
            <h2 className="text-xl font-display text-green-400 tracking-widest">ПИТОМЦЫ</h2>
            <p className="text-[10px] text-dim mt-1">Загрузка...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-green-500/10 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-display text-green-400 tracking-widest">ПИТОМЦЫ</h2>
          <p className="text-[10px] text-dim mt-1">Верные спутники в бою</p>
        </div>
      </div>

      {/* Current Pet */}
      {pet.equipped && (
        <div className="panel p-6 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-b from-green-900/10 to-transparent" />
          <div className="relative z-10 flex flex-col items-center">
            <div className="w-24 h-24 rounded-full border-4 border-green-500/50 grid place-items-center mb-4 bg-green-500/10">
              <Icon n={PETS.find(p => p.id === pet.equipped)?.icon || "paw"} className="w-12 h-12 text-green-400" />
            </div>
            <h3 className="text-lg font-bold text-fog">{PETS.find(p => p.id === pet.equipped)?.name}</h3>
            <span className="text-[10px] text-green-300">Уровень {pet.level}</span>
            
            {/* XP Bar */}
            <div className="w-full mt-3">
              <div className="flex items-center justify-between text-[8px] text-dim mb-1">
                <span>XP питомца</span>
                <span>{pet.xp} / {pet.level * 500}</span>
              </div>
              <div className="relative h-1.5 rounded-full bg-black/50 overflow-hidden">
                <div 
                  className="absolute inset-y-0 left-0 bg-green-500 transition-all duration-300"
                  style={{ width: (pet.xp / (pet.level * 500)) * 100 + "%" }}
                />
              </div>
            </div>

            {/* Passive Bonus */}
            <div className="mt-4 p-3 rounded-lg bg-green-500/10 border border-green-500/30 w-full">
              <div className="text-[9px] text-green-300 text-center">
                {PETS.find(p => p.id === pet.equipped)?.bonusDescription}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Level Up Button */}
      {pet.equipped && pet.canLevelUp && (
        <button
          onClick={() => d({ type: "PET_LEVEL_UP", petId: pet.equipped! })}
          className="w-full panel p-4 flex items-center justify-center gap-3 hover:bg-green-500/10 transition-all border-green-500/30"
        >
          <Icon n="spark" className="w-6 h-6 text-green-400" />
          <span className="text-lg font-display text-fog">ПОВЫСИТЬ УРОВЕНЬ</span>
          <span className="text-[10px] text-gold">({pet.levelUpCost} 💎)</span>
        </button>
      )}

      {/* Pet Collection */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="paw" className="w-4 h-4 text-green-400" />
          Коллекция питомцев
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {PETS.map((config) => {
            const owned = pet.owned.includes(config.id);
            const equipped = pet.equipped === config.id;
            return (
              <button
                key={config.id}
                disabled={!owned && !config.free}
                onClick={() => owned && !equipped && d({ type: "PET_EQUIP", petId: config.id })}
                className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                  equipped ? "border-green-500/50 bg-green-500/10" :
                  owned ? "border-white/10 bg-white/5 hover:bg-white/10" :
                  "border-white/5 bg-black/20 opacity-50"
                }`}
              >
                <Icon n={config.icon as any} className="w-8 h-8 text-green-400" />
                <div className="text-center">
                  <div className="text-[10px] font-semibold text-fog">{config.name}</div>
                  <div className="text-[8px] text-dim">{config.bonusDescription}</div>
                </div>
                {equipped && (
                  <span className="text-[7px] text-green-300 uppercase tracking-wider">Экипировано</span>
                )}
                {!owned && config.free && (
                  <span className="text-[8px] text-gold">Бесплатно</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Info */}
      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">
          💡 Питомцы дают пассивные бонусы и могут сопровождать в бою
        </p>
      </div>
    </div>
  );
}
