import React, { useEffect, useRef } from "react";
import { useGame } from "../game/useGame";
import { HeroArt, MonsterArt } from "./art";
import { fmt } from "../game/logic";
import type { GuildBossS, Fx } from "../game/types";

interface GuildBossBattleSceneProps {
  gb: GuildBossS;
}

export function GuildBossBattleScene({ gb }: GuildBossBattleSceneProps) {
  const { s, stats } = useGame();
  const artRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const lastFxId = useRef<number>(0);

  // Handle Animations
  useEffect(() => {
    const fx = gb.fx[0];
    if (fx && fx.id !== lastFxId.current) {
      lastFxId.current = fx.id;
      
      // Determine target and attacker based on kind
      // In BattleScreen: 
      // target = f.kind === "hurt" ? artRef.current : heroRef.current;
      // attacker = f.kind === "hurt" ? heroRef.current : artRef.current;
      // So if kind is "hurt", hero attacks and monster gets hurt.
      
      const target = fx.kind === "hurt" ? artRef.current : heroRef.current;
      const attacker = fx.kind === "hurt" ? heroRef.current : artRef.current;

      if (target) {
        target.classList.remove("anim-shake", "anim-lunge-left", "anim-lunge-right");
        void target.offsetWidth;
        target.classList.add("anim-shake");
      }

      if (attacker && (fx.kind === "dmg" || fx.kind === "crit" || fx.kind === "hurt")) {
        const lungeClass = fx.kind === "hurt" ? "anim-lunge-left" : "anim-lunge-right";
        attacker.classList.remove("anim-lunge-left", "anim-lunge-right");
        void attacker.offsetWidth;
        attacker.classList.add(lungeClass);
      }

      if (fx.kind === "hurt" && heroRef.current) {
          heroRef.current.classList.remove("hero-hurt");
          void heroRef.current.offsetWidth;
          heroRef.current.classList.add("hero-hurt");
      }
    }
  }, [gb.fx]);

  return (
    <div className="relative w-full h-56 bg-abyss/40 rounded-2xl border border-line overflow-hidden flex items-center justify-around px-4 mb-4 select-none">
      {/* HP Bars Overlay */}
      <div className="absolute top-2 left-0 right-0 px-4 flex flex-col gap-1 pointer-events-none z-10">
          {/* Hero HP */}
          <div className="flex justify-between items-end gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-black/50 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#3fd0b6] to-[#7ee8d6] transition-all duration-300" 
                       style={{ width: `${Math.max(0, Math.min(100, (gb.heroHp / gb.heroMaxHp) * 100))}%` }} />
              </div >
              <span className="text-[8px] font-display text-fog tabular-nums shrink-0">{fmt(gb.heroHp)}</span>
          </div>
          {/* Boss HP */}
          <div className="flex justify-between items-end gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-black/50 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#ef4444] to-[#b91c1c] transition-all duration-300" 
                       style={{ width: `${Math.max(0, Math.min(100, (gb.bossHp / gb.bossMaxHp) * 100))}%` }} />
              </div >
              <span className="text-[8px] font-display text-fog tabular-nums shrink-0">{fmt(gb.bossHp)}</span>
          </div>
      </div>

      {/* Floating Damage Numbers */}
      {gb.fx.map((f) => (
        <div
          key={f.id}
          className={`absolute pointer-events-none font-display font-bold select-none z-20 ${
            f.kind === "crit" ? "text-gold2 text-xl" : f.kind === "dmg" ? "text-fog text-base" : "text-blood text-sm"
          }`}
          style={{
            left: `${f.x}%`,
            top: `${f.y}%`,
            transform: "translate(-50%, -50%)",
          }}
        >
          {f.kind === "crit" ? `💥 ${f.text}` : f.kind === "dmg" ? `-${f.text}` : f.text}
        </div>
      ))}

      {/* Battle Field */}
      <div ref={artRef} className="relative w-1/3 h-full flex items-center justify-center">
          <MonsterArt k={gb.bossKey} />
      </div>

      <div ref={heroRef} className="relative w-1/3 h-full flex items-center justify-center">
          <HeroArt 
            classId={s.hero.classId} 
            equip={{
                weapon: s.equip.weapon,
                helm: s.equip.helm,
                amulet: s.equip.amulet,
                armor: s.equip.armor,
                gloves: s.equip.gloves,
                boots: s.equip.boots,
                ring1: s.equip.ring1,
                ring2: s.equip.ring2,
            }} 
          />
      </div>
    </div>
  );
}
