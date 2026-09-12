import { useEffect, useRef, useState } from "react";
import { useGame } from "../game/useGame";
import { SKILLS, mmrRank } from "../game/data";
import { fmt, getStats } from "../game/logic";
import { Icon, Bar, SectionTitle } from "./bits";
import { HeroArt } from "./art";
import { useVk, type VkLeaderboardItem } from "../platform/vk";

function nextRank(mmr: number): { name: string; at: number } | null {
  const ladder = [
    { at: 900, name: "Боец" }, { at: 1150, name: "Гладиатор" }, { at: 1400, name: "Чемпион" },
    { at: 1650, name: "Мастер" }, { at: 1900, name: "Легенда Бездны" },
  ];
  for (const l of ladder) if (mmr < l.at) return l;
  return null;
}

const RANK_REWARDS: { at: number; name: string; gold: number; gems: number }[] = [
  { at: 0, name: "Новичок", gold: 300, gems: 0 },
  { at: 900, name: "Боец", gold: 600, gems: 0 },
  { at: 1150, name: "Гладиатор", gold: 1000, gems: 1 },
  { at: 1400, name: "Чемпион", gold: 1500, gems: 2 },
  { at: 1650, name: "Мастер", gold: 2200, gems: 3 },
  { at: 1900, name: "Легенда Бездны", gold: 3500, gems: 5 },
];
function rankReward(mmr: number) {
  let r = RANK_REWARDS[0];
  for (const def of RANK_REWARDS) if (mmr >= def.at) r = def;
  return r;
}

function Leaderboard({ leaderboard, myMmr }: { leaderboard: VkLeaderboardItem[]; myMmr: number }) {
  const { user } = useVk();
  if (leaderboard.length === 0) return null;
  const myRank = leaderboard.findIndex(p => Number(p.vk_user_id) === Number(user?.id));
  return (
    <div className="panel p-3">
      <SectionTitle icon="trophy">ТОП-100 ПО MMR</SectionTitle>
      <div className="flex flex-col gap-1 max-h-56 overflow-y-auto scroll-slim">
        {leaderboard.slice(0, 100).map((p, i) => {
          const isMe = Number(p.vk_user_id) === Number(user?.id);
          return (
            <div key={p.vk_user_id} className={`flex items-center gap-2 rounded-lg px-2 py-1 ${isMe ? "bg-gold/12 border border-gold/40" : "bg-panel2/40"}`}>
              <span className={`w-5 text-center font-display text-[10px] ${i < 3 ? "text-gold" : "text-dim"}`}>{i + 1}</span>
              {p.avatar_url ? <img src={p.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" /> : <span className="h-5 w-5 rounded-full bg-panel grid place-items-center text-[8px] text-dim">?</span>}
              <span className="min-w-0 flex-1 truncate text-[10px] text-fog">{p.first_name} {p.last_name}{isMe ? " (ты)" : ""}</span>
              <span className="font-display text-[10px] text-mana">{p.mmr}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function DuelScreen() {
  const { s, d } = useGame();
  const { getDuelOpponent, reportDuelResult, duelSeasonCheck, duelRankReward, leaderboard } = useVk();
  const D = s.duel;
  const stats = getStats(s);
  const rank = mmrRank(D.mmr);
  const nxt = nextRank(D.mmr);
  const skills = SKILLS.filter(k => k.classId === s.hero.classId);
  const reported = useRef<Set<number>>(new Set());
  const [seasonNotice, setSeasonNotice] = useState<string | null>(null);
  const [rankRewardMsg, setRankRewardMsg] = useState<string | null>(null);

  // Проверка сезона MMR при входе на арену: если сменился — сброс + награда за лучший ранг.
  useEffect(() => {
    let alive = true;
    duelSeasonCheck().then(r => {
      if (!alive || !r) return;
      d({ type: "DUEL_MMR_SET", mmr: r.mmr });
      if (r.seasonChanged && r.reward) {
        setSeasonNotice(`Новый сезон! Твой лучший ранг «${r.reward.rank}» — награда в сундуке: ${r.reward.gold} золота, ${r.reward.gems} кристаллов. MMR сброшен до 1000.`);
      }
    });
    return () => { alive = false; };
  }, [duelSeasonCheck, d]);

  const claimRankReward = async () => {
    const res = await duelRankReward();
    if (res?.ok && res.gold != null) {
      d({ type: "DUEL_RANK_CLAIM", gold: res.gold, gems: res.gems ?? 0 });
      setRankRewardMsg(`Дневная награда ранга «${res.rank}»: +${res.gold} золота, +${res.gems} кристаллов!`);
    } else {
      setRankRewardMsg(res?.error === "already_claimed" ? "Награда за ранг уже забрана сегодня." : "Не удалось забрать награду.");
    }
  };

  // Отправляем результат боя против реального соперника на сервер (один раз).
  useEffect(() => {
    const foe = D.foe;
    if (D.state !== "result" || !foe?.serverId || reported.current.has(foe.serverId)) return;
    reported.current.add(foe.serverId);
    void reportDuelResult(foe.serverId, D.result === "win");
  }, [D.state, D.result, D.foe, reportDuelResult]);

  const startSearch = () => {
    if (D.tokens < 1) return;
    d({ type: "DUEL_SEARCH" });
    void getDuelOpponent(D.mmr).then(opp => {
      // Если бой уже начался/закрылся к моменту ответа — игнорируем.
      d({ type: "DUEL_FOUND", opponent: opp });
    });
  };

  /* ---------- подтверждение соперника (инфо до боя) ---------- */
  if (D.state === "confirm" && D.foe) {
    const foe = D.foe;
    const powerDelta = ((foe.power - stats.dps) / Math.max(1, stats.dps)) * 100;
    return (
      <div className="flex flex-col gap-3">
        <div className="panel p-4 relative overflow-hidden text-center">
          <div className="absolute -top-14 inset-x-0 h-24 blur-2xl pointer-events-none" style={{ background: "#e5484d22" }} />
          <div className="relative">
            <div className="font-display text-[11px] text-blood tracking-widest mb-2 flex items-center justify-center gap-1.5"><Icon n="crossed" className="w-4 h-4" />СОПЕРНИК НАЙДЕН</div>
            <div className="flex items-center justify-center gap-4 mb-3">
              <div className="w-24 h-28"><HeroArt classId={s.hero.classId} equip={s.equip} /></div>
              <span className="font-display text-blood/40 text-lg">VS</span>
              <div className="w-24 h-28"><HeroArt classId={foe.classId} /></div>
            </div>
            <div className="font-display text-lg text-fog text-outline mb-1">{foe.name}</div>
            <div className="text-[11px] text-gold mb-3">{foe.isBot ? "Бот арены" : "Реальный игрок"} · MMR {foe.mmr} · {mmrRank(foe.mmr)}</div>
            <div className="grid grid-cols-3 gap-2 mb-4">
              <div className="bg-abyss/60 border border-line/60 rounded-xl py-2">
                <div className="font-display text-[15px] text-r1">{fmt(foe.power)}</div>
                <div className="text-[9px] text-dim">сила</div>
              </div>
              <div className="bg-abyss/60 border border-line/60 rounded-xl py-2">
                <div className={`font-display text-[15px] ${powerDelta >= 0 ? "text-gold" : "text-blood"}`}>{powerDelta >= 0 ? "+" : ""}{powerDelta.toFixed(0)}%</div>
                <div className="text-[9px] text-dim">к твоей силе</div>
              </div>
              <div className="bg-abyss/60 border border-line/60 rounded-xl py-2">
                <div className="font-display text-[15px] text-mana">{foe.maxHp}</div>
                <div className="text-[9px] text-dim">здоровье</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => d({ type: "DUEL_CONFIRM" })} className="btn btn-ember py-3 text-[13px] flex items-center justify-center gap-1.5"><Icon n="crossed" className="w-4 h-4" />НА БОЙ</button>
              <button onClick={() => d({ type: "DUEL_CLOSE" })} className="btn btn-dark py-3 text-[13px]">ОТМЕНА</button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ---------- арена боя ---------- */
  if (D.state === "fight" || D.state === "result") {
    const foe = D.foe;
    return (
      <div className="flex flex-col gap-3">
        <div className="panel relative overflow-hidden">
          <div className="absolute inset-0 pointer-events-none"
            style={{ background: "radial-gradient(420px 240px at 50% 30%, rgba(229,72,77,0.12), transparent 70%)" }} />
          <div className="relative px-4 pt-3 flex items-center justify-between">
            <span className="font-display text-[13px] tracking-wide text-blood flex items-center gap-1.5"><Icon n="crossed" className="w-4 h-4" />ДУЭЛЬ</span>
            <span className="text-[10px] text-dim">MMR на кону</span>
          </div>
          <div className="relative h-44">
            <div className="absolute inset-0 flex items-center justify-between px-3">
              <div className="w-26 h-32">
                <div style={{ animation: `lungeR ${Math.max(0.35, 1 / stats.as)}s ease-in-out infinite` }}>
                  <div className="h-32"><HeroArt classId={s.hero.classId} equip={s.equip} /></div>
                </div>
              </div>
              <span className="font-display text-blood/40 text-xl select-none">VS</span>
              {foe && (
                <div className="w-26 h-32">
                  <div style={{ animation: `lungeL ${Math.max(0.35, 1 / foe.as)}s ease-in-out infinite` }}>
                    <div className="h-32"><HeroArt classId={foe.classId} /></div>
                  </div>
                </div>
              )}
            </div>
            {/* fx */}
            <div className="absolute inset-0 pointer-events-none">
              {D.fx.map(f => (
                <span key={f.id}
                  className={`fx-float absolute text-outline font-bold ${f.kind === "crit" ? "text-gold2 font-display text-2xl" : f.kind === "hurt" ? "text-blood text-sm" : "text-fog text-base"}`}
                  style={{ left: f.x + "%", top: f.y + "%" }}>
                  {f.text}
                </span>
              ))}
            </div>
          </div>
          <div className="relative px-4 pb-3 space-y-2">
            <div>
              <div className="flex justify-between text-[10px] mb-0.5">
                <span className="text-fog font-semibold">{s.hero.name}</span>
                <span className="text-dim tabular-nums">{fmt(Math.max(0, D.heroHp))}/{fmt(stats.maxHp)}</span>
              </div>
              <Bar v={D.heroHp} max={stats.maxHp} color="#4ade80" h="h-3" shine />
            </div>
            {foe && (
              <div>
                <div className="flex justify-between text-[10px] mb-0.5">
                  <span className="text-fog font-semibold">{foe.name} <span className="text-dim font-normal">· MMR {foe.mmr}</span></span>
                  <span className="text-dim tabular-nums">{fmt(Math.max(0, foe.hp))}/{fmt(foe.maxHp)}</span>
                </div>
                <Bar v={foe.hp} max={foe.maxHp} color="#e5484d" h="h-3" shine />
              </div>
            )}
          </div>
        </div>

        {/* лог */}
        <div key={D.log[0] ?? ""} className="anim-rise text-[11px] text-dim/90 px-1 h-4 truncate">{D.log[0] ?? "Бой начался..."}</div>

        {/* скилы игрока (авто-каст, некликабельно) */}
        <div className="grid grid-cols-3 gap-2">
          {skills.map(sk => {
            const cd = D.cds[sk.id] || 0;
            const locked = s.hero.level < sk.unlockLevel;
            return (
              <div key={sk.id}
                className="relative btn btn-dark py-2.5 px-1 h-[60px] flex flex-col items-center justify-center gap-0.5 overflow-hidden select-none"
                title={`${sk.name} — авто-каст`}>
                <Icon n={sk.icon} className="w-5 h-5" style={{ color: locked ? "#8b98a9" : "#ff4d6d" }} />
                <span className="text-[8px] text-fog font-body font-semibold text-center leading-tight px-0.5">{sk.name}</span>
                {!locked && cd > 0 && (
                  <span className="absolute inset-x-0 bottom-0 bg-abyss/85 border-t border-line flex items-end justify-center pointer-events-none"
                    style={{ height: (cd / sk.cd) * 100 + "%" }}>
                    <span className="text-[10px] font-display text-fog pb-0.5">{cd.toFixed(1)}</span>
                  </span>
                )}
                {locked && <span className="absolute inset-0 bg-abyss/80 grid place-items-center text-dim"><Icon n="lock" className="w-4 h-4" /></span>}
              </div>
            );
          })}
        </div>
        <p className="text-[10px] text-dim/70 text-center -mt-1">Скилы бьют сами — авто-каст срабатывает каждые ~7 сек.</p>

        {/* итог */}
        {D.state === "result" && (
          <div className="panel anim-pop p-4 text-center relative overflow-hidden"
            style={{ borderColor: (D.result === "win" ? "#f0b429" : "#e5484d") + "66" }}>
            <div className="absolute -top-10 inset-x-0 h-24 blur-2xl pointer-events-none"
              style={{ background: (D.result === "win" ? "#f0b429" : "#e5484d") + "22" }} />
            <div className="relative">
              <h2 className="font-display text-2xl text-outline mb-1" style={{ color: D.result === "win" ? "#f0b429" : "#e5484d" }}>
                {D.result === "win" ? "ПОБЕДА!" : "ПОРАЖЕНИЕ"}
              </h2>
              <div className="flex justify-center gap-4 mb-3">
                <div>
                  <div className="font-display text-lg" style={{ color: D.delta >= 0 ? "#4ade80" : "#e5484d" }}>{D.delta >= 0 ? "+" : ""}{D.delta}</div>
                  <div className="text-[9px] text-dim">MMR</div>
                </div>
                <div>
                  <div className="font-display text-lg text-gold flex items-center gap-1"><Icon n="coin" className="w-4 h-4" filled />{fmt(D.reward)}</div>
                  <div className="text-[9px] text-dim">золото</div>
                </div>
                <div>
                  <div className="font-display text-lg text-fog">{D.mmr}</div>
                  <div className="text-[9px] text-dim">новый MMR</div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button onClick={startSearch} disabled={D.tokens < 1}
                  className="btn btn-gold py-3 text-[13px] flex items-center justify-center gap-1.5">
                  <Icon n="crossed" className="w-4 h-4" />ЕЩЁ РАЗ (1)
                </button>
                <button onClick={() => d({ type: "DUEL_CLOSE" })} className="btn btn-dark py-3 text-[13px]">В ЛОББИ</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ---------- лобби ---------- */
  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-4 relative overflow-hidden">
        <div className="absolute -top-14 -right-10 w-40 h-40 rounded-full bg-blood/12 blur-2xl pointer-events-none" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-2">
            <Icon n="crossed" className="w-6 h-6 text-blood" />
            <h2 className="font-display text-xl text-fog text-outline">АРЕНА ДУЭЛЕЙ</h2>
          </div>
          <div className="flex items-end gap-3 mb-3">
            <div>
              <div className="font-display text-3xl text-gold2 text-outline leading-none">{D.mmr}</div>
              <div className="text-[11px] font-display" style={{ color: "#f0b429" }}>{rank.toUpperCase()}</div>
            </div>
            <div className="flex-1 pb-1">
              {nxt ? (
                <>
                  <div className="flex justify-between text-[9px] text-dim mb-1"><span>до «{nxt.name}»</span><span>{nxt.at - D.mmr} MMR</span></div>
                  <Bar v={D.mmr} max={nxt.at} color="#f0b429" h="h-2" />
                </>
              ) : (
                <div className="text-[10px] text-dim">Вершина лестницы. Дальше — только легенды.</div>
              )}
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 mb-4 text-center">
            <div className="bg-abyss/60 border border-line/60 rounded-xl py-2">
              <div className="font-display text-[15px] text-r1">{D.wins}</div><div className="text-[9px] text-dim">побед</div>
            </div>
            <div className="bg-abyss/60 border border-line/60 rounded-xl py-2">
              <div className="font-display text-[15px] text-blood">{D.losses}</div><div className="text-[9px] text-dim">поражений</div>
            </div>
            <div className="bg-abyss/60 border border-line/60 rounded-xl py-2">
              <div className="font-display text-[15px] text-mana flex items-center justify-center gap-1"><Icon n="ticket" className="w-3.5 h-3.5" />{D.tokens}</div>
              <div className="text-[9px] text-dim">жетоны</div>
            </div>
          </div>

          {D.state === "search" ? (
            <div className="border border-blood/40 rounded-xl p-4 text-center bg-blood/8">
              <div className="flex items-center justify-center gap-2 text-blood font-display text-[14px] mb-1">
                <span className="anim-spin-slow inline-flex"><Icon n="refresh" className="w-4 h-4" /></span>
                ПОИСК СОПЕРНИКА...
              </div>
              <p className="text-[10px] text-dim">Подбираем бойца рядом с твоим MMR ({D.mmr})</p>
            </div>
          ) : (
            <>
              <button onClick={startSearch} disabled={D.tokens < 1}
                className="btn btn-ember w-full py-3.5 text-[15px] flex items-center justify-center gap-2">
                <Icon n="crossed" className="w-5 h-5" />НАЙТИ ПРОТИВНИКА (1 жетон)
              </button>
              <p className="text-[10px] text-dim/70 mt-2 text-center">
                {D.tokens < 1 ? "Жетонов нет. +1 каждый день, ещё дают за ежедневки." : "Победа: +MMR и золото. Поражение: −MMR, но немного золота утешит."}
              </p>
            </>
          )}
        </div>
      </div>

      <div className="panel p-3">
        <SectionTitle icon="gift" right={D.rankClaimed ? <span className="text-[9px] text-dim">сегодня забрано</span> : undefined}>НАГРАДА ЗА РАНГ</SectionTitle>
        <div className="flex items-center gap-3">
          <div className="flex-1 text-[10px] text-dim leading-snug">
            Ежедневно твой ранг <b className="text-gold">{rank}</b> приносит куш:
            <span className="text-fog"> +{rankReward(D.mmr).gold} золота</span>
            {rankReward(D.mmr).gems > 0 && <span className="text-fog">, +{rankReward(D.mmr).gems} кристалла</span>}.
          </div>
          <button onClick={claimRankReward} disabled={D.rankClaimed}
            className={`btn px-3 py-2 text-[11px] ${D.rankClaimed ? "btn-dark opacity-60" : "btn-gold"}`}>
            {D.rankClaimed ? "ЗАБРАНО" : "ЗАБРАТЬ"}
          </button>
        </div>
        {rankRewardMsg && <div className="mt-2 text-[10px] text-arc">{rankRewardMsg}</div>}
      </div>

      {seasonNotice && (
        <div className="panel p-3 border-blood/40 bg-blood/8 anim-pop">
          <div className="flex gap-2 text-[11px] text-fog leading-snug">
            <Icon n="flame" className="w-4 h-4 text-blood shrink-0" />
            <span>{seasonNotice}</span>
          </div>
        </div>
      )}

      <Leaderboard leaderboard={leaderboard} myMmr={D.mmr} />

      <div className="panel p-3">
        <SectionTitle icon="info">КАК ЭТО РАБОТАЕТ</SectionTitle>
        <div className="text-[11px] text-dim leading-relaxed space-y-1.5">
          <p>· Бой автоматический: вы оба лупите друг друга, скилы кастантся сами, но <b className="text-fog">твои кнопки бьют сразу</b>.</p>
          <p>· Соперник генерируется под твой MMR — честно, но с перчинкой.</p>
          <p>· Жетоны: старт 3, <b className="text-fog">+1 в день</b>, дают за ежедневки и еженедельники.</p>
          <p>· <b className="text-gold">Каждый сезон</b> MMR сбрасывается до 1000, а лучший ранг сезона приносит награду (золото + кристаллы) в сундук.</p>
        </div>
      </div>
    </div>
  );
}
