import { useState } from "react";
import { useGame } from "../game/useGame";
import { QUESTS, DAILIES, WEEKLIES, ACHS, SHOP, RARITY, shopCost, VIP_LEVELS, type QuestDef } from "../game/data";
import { fmt, getMetric, saveGame } from "../game/logic";
import { Bar, Icon, SectionTitle } from "./bits";
import { useVk, API_URL } from "../platform/vk";
import { BUILD_VERSION, BUILD_DATE } from "../buildInfo";
import { AdminPanel } from "./AdminPanel";
import { CraftSeg } from "./CraftScreen";
import { EventSeg } from "./EventScreen";
import { GuildSeg } from "./GuildScreen";

type Seg = "quests" | "shop" | "ach" | "craft" | "event" | "guild" | "opt" | "admin";

function QuestRow({ def, done, progress, onClaim }: { def: QuestDef; done: boolean; progress: number; onClaim: () => void }) {
  if (done) return null; // забранные — скрываем, чтобы не мешали
  const ready = progress >= def.target;
  return (
    <div className={`bg-abyss/60 border rounded-xl p-3 ${ready ? "border-gold/50" : "border-line/60"}`}
      style={ready ? { boxShadow: "0 0 14px rgba(240,180,41,0.15)" } : undefined}>
      <div className="flex items-center gap-2">
        <div className="flex-1 min-w-0">
          <div className="font-display text-[13px] text-fog flex items-center gap-1.5">
            {ready && <Icon n="check" className="w-3.5 h-3.5 text-gold" />}{def.title}
          </div>
          <div className="text-[11px] text-dim">{def.desc}</div>
          {def.flavor && <div className="text-[10px] text-dim/70 italic mt-0.5">«{def.flavor}»</div>}
        </div>
        <div className="shrink-0 text-right">
          <div className="flex items-center gap-2 justify-end text-[11px] font-bold">
            {def.reward.gold && <span className="text-gold flex items-center gap-0.5"><Icon n="coin" className="w-3.5 h-3.5" filled />{fmt(def.reward.gold)}</span>}
            {def.reward.gems && <span className="text-mana flex items-center gap-0.5"><Icon n="gem" className="w-3.5 h-3.5" filled />{def.reward.gems}</span>}
            {def.reward.tokens && <span className="text-arc flex items-center gap-0.5"><Icon n="ticket" className="w-3.5 h-3.5" />{def.reward.tokens}</span>}
          </div>
          <button disabled={!ready} onClick={onClaim} className="btn btn-gold px-3 py-1.5 text-[11px] mt-1">Забрать</button>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <Bar v={progress} max={def.target} color={ready ? "#f0b429" : "#3fd0b6"} h="h-1.5" className="flex-1" />
        <span className="text-[10px] text-dim tabular-nums">{fmt(Math.min(progress, def.target))}/{fmt(def.target)}</span>
      </div>
    </div>
  );
}

function QuestsSeg() {
  const { s, d } = useGame();
  const doneChain = s.questsClaimed.length;
  // выполненные (готовые к забору) поднимаем наверх
  const chain = [...QUESTS].sort((a, b) =>
    (getMetric(s, b.metric) >= b.target ? 1 : 0) - (getMetric(s, a.metric) >= a.target ? 1 : 0));
  const dailies = [...DAILIES].sort((a, b) =>
    (getMetric(s, b.metric) >= b.target ? 1 : 0) - (getMetric(s, a.metric) >= a.target ? 1 : 0));
  const weeklies = [...WEEKLIES].sort((a, b) =>
    (getMetric(s, b.metric) >= b.target ? 1 : 0) - (getMetric(s, a.metric) >= a.target ? 1 : 0));
  return (
    <div className="flex flex-col gap-2.5">
      <div className="panel p-3">
        <SectionTitle icon="map" right={<span className="text-[10px] text-dim">глава {Math.min(doneChain + 1, QUESTS.length)}/{QUESTS.length}</span>}>
          КАМПАНИЯ
        </SectionTitle>
        <div className="flex flex-col gap-2">
          {chain.map(q => (
            <QuestRow key={q.id} def={q} done={s.questsClaimed.includes(q.id)} progress={getMetric(s, q.metric)}
              onClaim={() => d({ type: "CLAIM_QUEST", id: q.id })} />
          ))}
        </div>
      </div>
      <div className="panel p-3">
        <SectionTitle icon="refresh" right={<span className="text-[10px] text-dim">обновляются ежедневно</span>}>ЕЖЕДНЕВКИ</SectionTitle>
        <div className="flex flex-col gap-2">
          {dailies.map(q => (
            <QuestRow key={q.id} def={q} done={s.daily.claimed.includes(q.id)} progress={getMetric(s, q.metric)}
              onClaim={() => d({ type: "CLAIM_DAILY", id: q.id })} />
          ))}
        </div>
      </div>
      <div className="panel p-3">
        <SectionTitle icon="crown" right={<span className="text-[10px] text-dim">сброс в понедельник</span>}>ЕЖЕНЕДЕЛЬНИК</SectionTitle>
        <div className="flex flex-col gap-2">
          {weeklies.map(q => (
            <QuestRow key={q.id} def={q} done={s.weekly.claimed.includes(q.id)} progress={getMetric(s, q.metric)}
              onClaim={() => d({ type: "CLAIM_WEEKLY", id: q.id })} />
          ))}
        </div>
      </div>
    </div>
  );
}

function VipPanel() {
  const { s, d } = useGame();
  const cur = s.vip > 0 ? VIP_LEVELS[s.vip - 1] : null;
  const next = s.vip < VIP_LEVELS.length ? VIP_LEVELS[s.vip] : null;
  return (
    <div className="panel p-3 relative overflow-hidden">
      <div className="absolute -top-14 -right-10 w-36 h-36 rounded-full blur-2xl pointer-events-none"
        style={{ background: (cur?.color ?? "#f0b429") + "2e" }} />
      <SectionTitle icon="crown" right={cur
        ? <span className="text-[10px] font-display" style={{ color: cur.color }}>VIP {s.vip} · {cur.name.toUpperCase()}</span>
        : <span className="text-[10px] text-dim">не активирован</span>}>
        ПРИВИЛЕГИИ
      </SectionTitle>

      {cur && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {cur.perks.map(p => (
            <span key={p} className="text-[9px] font-bold px-2 py-1 rounded-md border"
              style={{ color: cur.color, borderColor: cur.color + "55", background: cur.color + "12" }}>
              {p}
            </span>
          ))}
        </div>
      )}

      {next ? (
        <div className="bg-abyss/60 border rounded-xl p-3" style={{ borderColor: next.color + "44" }}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="font-display text-[13px]" style={{ color: next.color }}>VIP {s.vip + 1} · {next.name.toUpperCase()}</span>
            <span className="ml-auto text-[9px] text-dim">воскрешение за {next.respawn} с</span>
          </div>
          <div className="flex flex-wrap gap-1 mb-3">
            {next.perks.map(p => (
              <span key={p} className="text-[9px] px-1.5 py-0.5 rounded bg-panel2 text-fog/85 border border-line/60">{p}</span>
            ))}
          </div>
          <button disabled={s.hero.gems < next.cost} onClick={() => d({ type: "BUY_VIP" })}
            className="btn btn-gold w-full py-2.5 text-[13px] flex items-center justify-center gap-1.5">
            <Icon n="gem" className="w-4 h-4" filled />АКТИВИРОВАТЬ ЗА {fmt(next.cost)}
          </button>
        </div>
      ) : (
        <div className="text-center text-[11px] text-dim py-2">Максимальный VIP. Бездна уважает таких клиентов.</div>
      )}
    </div>
  );
}

function ShopSeg() {
  const { s, d } = useGame();
  return (
    <div className="flex flex-col gap-3">
      <VipPanel />
      <div className="panel p-3">
      <SectionTitle icon="goblin" right={<span className="text-[10px] text-dim italic">«скидки не будет»</span>}>ЛАВКА ГОБЛИНА</SectionTitle>
      <div className="grid grid-cols-2 gap-2.5">
        {SHOP.map(def => {
          const cost = shopCost(def, s.shopBuys[def.id] || 0);
          const gold = def.currency === "gold";
          const afford = gold ? s.hero.gold >= cost : s.hero.gems >= cost;
          const minR = def.minRarity ?? 0;
          return (
            <div key={def.id} className="bg-abyss/60 border border-line/60 rounded-xl p-3 flex flex-col">
              <div className="w-12 h-12 mx-auto mb-2 rounded-xl grid place-items-center border border-gold/30 bg-gold/8 text-gold">
                <Icon n={def.icon} className="w-7 h-7" />
              </div>
              <div className="font-display text-[12px] text-fog text-center leading-tight">{def.name}</div>
              <div className="text-[10px] text-dim text-center mt-1 flex-1">{def.desc}</div>
              {def.kind === "box" && minR > 0 && (
                <div className="text-[9px] text-center mt-1" style={{ color: RARITY[minR].color }}>минимум: {RARITY[minR].name}</div>
              )}
              <button disabled={!afford} onClick={() => d({ type: "BUY_SHOP", id: def.id })}
                className={`btn ${gold ? "btn-gold" : "btn-arc"} w-full py-2 text-[12px] mt-2 flex items-center justify-center gap-1`}>
                <Icon n={gold ? "coin" : "gem"} className="w-3.5 h-3.5" filled />{fmt(cost)}
              </button>
            </div>
          );
        })}
      </div>
      <p className="text-[10px] text-dim/70 text-center mt-3">
        Сундуки дорожают с каждой покупкой. Гоблин называет это «динамическим ценообразованием».
      </p>
      </div>
    </div>
  );
}

function AchSeg() {
  const { s, d } = useGame();
  const claimed = s.achClaimed.length;
  const list = ACHS
    .filter(a => !s.achClaimed.includes(a.id)) // забранные — скрываем
    .sort((a, b) =>
      (getMetric(s, b.metric) >= b.target ? 1 : 0) - (getMetric(s, a.metric) >= a.target ? 1 : 0));
  return (
    <div className="panel p-3">
      <SectionTitle icon="trophy" right={<span className="text-[10px] text-dim">{claimed}/{ACHS.length}</span>}>ДОСТИЖЕНИЯ</SectionTitle>
      <div className="flex flex-col gap-2">
        {list.map(a => {
          const p = getMetric(s, a.metric);
          const ready = p >= a.target;
          return (
            <div key={a.id} className={`bg-abyss/60 border rounded-xl px-3 py-2.5 flex items-center gap-2.5 ${ready ? "border-mana/50" : "border-line/60"}`}>
              <div className={`w-9 h-9 shrink-0 rounded-lg grid place-items-center border ${ready ? "text-mana border-mana/50 bg-mana/10" : "text-gold/70 border-line bg-panel2"}`}>
                <Icon n={ready ? "check" : "trophy"} className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-display text-[12px] text-fog">{a.title}</div>
                <div className="text-[10px] text-dim">{a.desc} · <span className="text-mana font-bold">+{a.reward.gems} крист.</span></div>
                <Bar v={p} max={a.target} color={ready ? "#4cc3ff" : "#33415a"} h="h-1" className="mt-1.5" />
              </div>
              <button disabled={!ready} onClick={() => d({ type: "CLAIM_ACH", id: a.id })} className="btn btn-arc px-2.5 py-1.5 text-[10px] shrink-0">Взять</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OptSeg() {
  const { s, d } = useGame();
  const { inVk, launchParams, initStage, user, friends, serverMmr, serverProfile, leaderboard, cloudStatus, cloudDetail, diag } = useVk();
  const [confirmReset, setConfirmReset] = useState(false);
  const [saved, setSaved] = useState(false);
  return (
    <div className="panel p-3 flex flex-col gap-3">
      <SectionTitle icon="gear">ОПЦИИ</SectionTitle>
      <div className="bg-abyss/60 border border-line/60 rounded-xl p-3">
      <SectionTitle icon="user" right={<span className="text-[10px] text-dim">{launchParams ? "серверная сессия" : inVk ? "WebView подключён" : "веб-превью"}</span>}>ПРОФИЛЬ VK</SectionTitle>
        {user ? (
          <div className="flex items-center gap-2.5">
            <img src={user.photo_100} alt="" className="w-11 h-11 rounded-xl object-cover border border-gold/30" />
            <div className="min-w-0">
              <div className="font-display text-[13px] text-fog truncate">{user.first_name} {user.last_name}</div>
              <div className="text-[10px] text-dim">id{user.id} · друзей доступно: {friends.length}</div>
            </div>
          </div>
        ) : (
          <div className="text-[11px] text-dim">
            {inVk && !launchParams
              ? "VK WebView есть, но VK не передал контекст Mini App. Откройте игру через карточку приложения в VK, а не по ссылке браузера."
              : "Откройте игру внутри VK, чтобы загрузить имя и аватар."}
          </div>
        )}
        {friends.length > 0 && (
          <div className="mt-3 flex items-center gap-1.5">
            {friends.slice(0, 8).map(friend => (
              <img key={friend.id} src={friend.photo_100} alt={`${friend.first_name} ${friend.last_name}`} title={`${friend.first_name} ${friend.last_name}`} className="w-7 h-7 rounded-full object-cover border border-line" />
            ))}
          </div>
        )}
        <div className="mt-3 rounded-lg border border-line/60 bg-panel2/60 px-2.5 py-2 text-[10px] text-dim space-y-0.5">
          <div className="flex items-center justify-between">
            <span>облако:</span>
            <span className="text-fog">{cloudStatus === "saved" ? "☁️ сохранено ✓" : cloudStatus === "syncing" ? "⏳ синхронизация…" : cloudStatus === "error" ? "⚠️ ошибка" : "⚪ офлайн"}</span>
          </div>
          {cloudDetail && (
            <div className="flex items-center justify-between">
              <span>деталь:</span>
              <span className="text-fog truncate max-w-[180px]">{cloudDetail}</span>
            </div>
          )}
          {diag && (
            <div className="flex items-center justify-between">
              <span>диаг:</span>
              <span className="text-fog truncate max-w-[180px]" title={diag}>{diag}</span>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span>этап:</span>
            <span className="text-fog truncate max-w-[180px]" title={initStage}>{initStage}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>параметры VK:</span>
            <span className="text-fog">{launchParams ? "получены" : "не получены"}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>API:</span>
            <span className="text-fog truncate max-w-[180px]">{API_URL}</span>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-line/60 bg-panel2/60 px-2 py-2 text-center">
            <div className="font-display text-[13px] text-gold">{s.duel.mmr}</div>
            <div className="text-[9px] text-dim">локальный MMR</div>
          </div>
          <div className="rounded-lg border border-line/60 bg-panel2/60 px-2 py-2 text-center">
            <div className="font-display text-[13px] text-mana">{serverMmr ?? "—"}</div>
            <div className="text-[9px] text-dim">рейтинг сервера</div>
          </div>
        </div>
        {serverProfile && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <div className="rounded-lg border border-arc/30 bg-arc/5 px-2 py-2 text-center">
              <div className="font-display text-[13px] text-arc">{serverProfile.level}</div>
              <div className="text-[9px] text-dim">серверный уровень</div>
            </div>
            <div className="rounded-lg border border-gold/30 bg-gold/5 px-2 py-2 text-center">
              <div className="font-display text-[13px] text-gold">{fmt(serverProfile.power)}</div>
              <div className="text-[9px] text-dim">серверная сила</div>
            </div>
          </div>
        )}
        {leaderboard.length > 0 && (
          <div className="mt-3 border-t border-line/60 pt-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-display text-[10px] text-fog">ТОП ИГРОКОВ</span>
              <span className="text-[9px] text-dim">серверный рейтинг</span>
            </div>
            <div className="flex flex-col gap-1">
              {leaderboard.slice(0, 5).map((player, index) => (
                <div key={player.vk_user_id} className="flex items-center gap-2 rounded-lg bg-panel2/60 px-2 py-1.5">
                  <span className="w-4 text-center font-display text-[10px] text-gold">{index + 1}</span>
                  {player.avatar_url ? <img src={player.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <span className="h-6 w-6 rounded-full bg-panel grid place-items-center text-[9px] text-dim">?</span>}
                  <span className="min-w-0 flex-1 truncate text-[10px] text-fog">{player.first_name} {player.last_name}</span>
                  <span className="font-display text-[10px] text-mana">{player.mmr}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="bg-abyss/60 border border-line/60 rounded-xl p-3 text-[11px] text-dim leading-relaxed space-y-1">
        <p>· Прогресс сохраняется каждые 4 секунды и при сворачивании приложения.</p>
        <p>· Пока вы офлайн, наёмники продолжают фармить — до 8 часов.</p>
        <p>· Смерть не страшна: <b className="text-fog">автовоскрешение</b> через 3 сек. VIP ускоряет до 0.5 сек.</p>
        <p>· Заточка слотов привязана к слоту — новая шмотка наследует бонус.</p>
      </div>
      <button onClick={() => { saveGame(s); setSaved(true); setTimeout(() => setSaved(false), 1500); }}
        className="btn btn-arc w-full py-3 text-[13px]">{saved ? "СОХРАНЕНО!" : "СОХРАНИТЬ СЕЙЧАС"}</button>
      <button
        onClick={() => {
          if (!confirmReset) { setConfirmReset(true); setTimeout(() => setConfirmReset(false), 3000); return; }
          d({ type: "RESET" });
        }}
        className={`btn w-full py-3 text-[13px] ${confirmReset ? "btn-ember" : "btn-dark"}`}>
        {confirmReset ? "ТОЧНО СБРОСИТЬ? ВСЁ ПРОПАДЁТ" : "СБРОСИТЬ ПРОГРЕСС"}
      </button>
      <div className="text-center text-[10px] text-dim/60">
        «Бездна Idle» · сборка {BUILD_VERSION} · {BUILD_DATE}
        <div className="mt-1">Убийств: {fmt(s.totals.kills)} · Боссов: {fmt(s.totals.bosses)} · Событий пережито: {s.totals.events}</div>
      </div>
    </div>
  );
}

export function MoreScreen() {
  const { isAdmin } = useVk();
  const [seg, setSeg] = useState<Seg>("quests");
  const tabs: { id: Seg; n: string; i: string }[] = [
    { id: "quests", n: "Квесты", i: "scroll" },
    { id: "shop", n: "Лавка", i: "bag" },
    { id: "ach", n: "Свершения", i: "trophy" },
    { id: "craft", n: "Крафт", i: "gear" },
    { id: "event", n: "Ивент", i: "flame" },
    { id: "guild", n: "Гильдия", i: "users" },
    { id: "opt", n: "Опции", i: "sliders" },
  ];
  if (isAdmin) tabs.push({ id: "admin", n: "Админ", i: "gear" });
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-4 gap-1.5 p-1.5 panel">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSeg(t.id)}
            className={`py-2 rounded-lg flex flex-col items-center gap-0.5 transition-all duration-150 ${seg === t.id ? "bg-gold/15 text-gold border border-gold/40" : "text-dim border border-transparent"}`}>
            <Icon n={t.i} className="w-4.5 h-4.5" />
            <span className="text-[9px] font-display tracking-wide">{t.n}</span>
          </button>
        ))}
      </div>
      {seg === "quests" && <QuestsSeg />}
      {seg === "shop" && <ShopSeg />}
      {seg === "ach" && <AchSeg />}
      {seg === "craft" && <CraftSeg />}
      {seg === "event" && <EventSeg />}
      {seg === "guild" && <GuildSeg />}
      {seg === "opt" && <OptSeg />}
      {seg === "admin" && <AdminPanel />}
    </div>
  );
}
