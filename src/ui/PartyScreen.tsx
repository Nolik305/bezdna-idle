import { useState } from "react";
import { DUNGEONS } from "../game/data";
import { fmt } from "../game/logic";
import { useGame } from "../game/useGame";
import { useVk } from "../platform/vk";
import { Bar, Icon, SectionTitle } from "./bits";

function PartyMembers() {
  const { s } = useGame();
  const party = s.party;
  if (!party) return null;
  const members = [
    { name: s.hero.name, classId: s.hero.classId, hp: party.heroHp, maxHp: party.heroMaxHp, bot: false, source: "local" as const, reviveT: party.heroReviveT },
    ...party.mates,
  ];
  return (
    <div className="grid grid-cols-2 gap-2">
      {members.map((member, index) => {
        const alive = member.hp > 0;
        return (
          <div key={`${member.name}-${index}`} className="rounded-xl border border-line/60 bg-abyss/60 p-2.5">
            <div className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-lg grid place-items-center border ${alive ? "border-arc/40 text-arc" : "border-blood/40 text-blood"}`}>
                <Icon n={member.classId === "mage" ? "staff" : "bow"} className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] text-fog font-semibold">{member.name}</div>
                <div className="text-[9px] text-dim">{member.bot ? member.source === "server" ? "серверный игрок · бот" : "локальный бот" : "вы · лидер"}</div>
              </div>
            </div>
            <Bar v={member.hp} max={member.maxHp} color={alive ? "#4ade80" : "#e5484d"} h="h-1.5" className="mt-2" />
            <div className="mt-1 text-[9px] text-dim text-right">
              {alive ? `${fmt(member.hp)} / ${fmt(member.maxHp)} HP` : `возрождение ${Math.ceil(member.reviveT)} с`}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActiveParty() {
  const { s, d } = useGame();
  const party = s.party;
  if (!party) return null;
  const won = party.state === "win";
  const finished = party.state !== "fight";
  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-1">
          <span className="font-display text-[12px] tracking-wider text-arc">ГРУППОВОЕ ПОДЗЕМЕЛЬЕ</span>
          <span className={`text-[10px] font-display ${won ? "text-gold" : finished ? "text-blood" : "text-dim"}`}>
            {won ? "ПОБЕДА" : finished ? "ПОРАЖЕНИЕ" : `${Math.ceil(party.t)} с`}
          </span>
        </div>
        <h2 className="font-display text-xl text-fog text-outline">{party.bossName}</h2>
        <div className="text-[10px] text-dim mb-3">Пати 4/4 · общий урон по боссу</div>
        <Bar v={party.bossHp} max={party.bossMaxHp} color={won ? "#f0b429" : "#e5484d"} h="h-4" shine />
        <div className="mt-1 text-right text-[10px] text-dim tabular-nums">{fmt(Math.max(0, party.bossHp))} / {fmt(party.bossMaxHp)} HP</div>
      </div>

      <div className="panel p-3">
        <SectionTitle icon="users">СОСТАВ ПАТИ</SectionTitle>
        <PartyMembers />
      </div>

      {finished && (
        <div className="panel p-3 text-center border-gold/40">
          {won ? (
            <>
              <div className="font-display text-gold text-lg">ПОДЗЕМЕЛЬЕ ПРОЙДЕНО</div>
              <div className="mt-1 text-[11px] text-dim">
                +{party.reward.gold} золота · +{party.reward.gems} крист. · +{party.reward.pathXp} опыта пути
              </div>
              {party.reward.setItem && <div className="mt-1 text-[10px] text-arc">Сетовый предмет: {party.reward.setItem}</div>}
            </>
          ) : (
            <div className="font-display text-blood">ВРЕМЯ ВЫШЛО</div>
          )}
          <button onClick={() => d({ type: "PARTY_CLOSE" })} className="btn btn-gold w-full py-3 mt-3 text-[13px]">ВЕРНУТЬСЯ</button>
        </div>
      )}
    </div>
  );
}

export function PartyScreen() {
  const { s, d } = useGame();
  const { getPartyBots, cloudStatus } = useVk();
  const [startingTier, setStartingTier] = useState<number | null>(null);
  const netDown = cloudStatus === "error" || cloudStatus === "offline";
  if (s.party) return <ActiveParty />;

  const startParty = async (tier: number) => {
    setStartingTier(tier);
    const bots = await getPartyBots(tier);
    d({ type: "PARTY_START", tier, bots });
    setStartingTier(null);
  };

  return (
    <div className="flex flex-col gap-3">
      {netDown && (
        <div className="panel px-3 py-2 text-[10px] text-ember bg-ember/10 border border-ember/20 text-center">
          ⚠️ Нет соединения с сервером — подбор ботов и отчёт о наградах могут не работать
        </div>
      )}
      <div className="panel p-4">
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <Icon n="users" className="w-6 h-6 text-arc" />
            <h2 className="font-display text-xl text-fog text-outline">ПАТИ-ПОДЗЕМЕЛЬЯ</h2>
          </div>
          <span className="text-[10px] text-gold">билеты: {s.daily.tickets}/3</span>
        </div>
        <p className="text-[11px] text-dim leading-relaxed">
          Вход рассчитан на 4 героев. Если живых участников не хватает, свободные места займут случайные боты из доступных персонажей.
        </p>
      </div>

      {DUNGEONS.map(dungeon => {
        const levelReady = s.hero.level >= dungeon.minLevel;
        const winsReady = s.totals.partyWins >= dungeon.needWins;
        const ready = levelReady && winsReady && s.daily.tickets > 0;
        return (
          <div key={dungeon.tier} className="panel p-3">
            <div className="flex items-start gap-2">
              <div className="w-10 h-10 shrink-0 rounded-lg grid place-items-center border border-arc/40 bg-arc/10 text-arc">
                <Icon n="users" className="w-5 h-5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="font-display text-[13px] text-fog">{dungeon.name}</div>
                <div className="text-[10px] text-dim">{dungeon.desc}</div>
              </div>
              <span className="text-[10px] text-arc font-display">T{dungeon.tier}</span>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[9px] text-dim">
              <span className="rounded-md border border-line px-1.5 py-1">уровень {dungeon.minLevel}+</span>
              {dungeon.needWins > 0 && <span className="rounded-md border border-line px-1.5 py-1">побед пати: {dungeon.needWins}</span>}
              <span className="rounded-md border border-line px-1.5 py-1">4 участника</span>
            </div>
            <button disabled={!ready || startingTier !== null} onClick={() => void startParty(dungeon.tier)}
              className="btn btn-arc w-full py-2.5 mt-3 text-[12px]">
              {startingTier === dungeon.tier ? "ИЩЕМ БОТОВ..." : !levelReady ? `НУЖЕН ${dungeon.minLevel} УРОВЕНЬ` : !winsReady ? `НУЖНО ПОБЕД: ${dungeon.needWins}` : s.daily.tickets < 1 ? "НЕТ БИЛЕТОВ" : "СОБРАТЬ ПАТИ 4/4"}
            </button>
          </div>
        );
      })}
    </div>
  );
}
