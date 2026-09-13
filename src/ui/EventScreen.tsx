import { useGame } from "../game/useGame";
import { activeSeasonalEvent, SEASONAL_EVENTS, type SeasonalEventDef } from "../game/data";
import { fmt } from "../game/logic";
import { Bar, Icon, SectionTitle } from "./bits";

function EventRow({ ev, points, claimed, onClaim }: {
  ev: SeasonalEventDef; points: number; claimed: number[]; onClaim: (idx: number) => void;
}) {
  const active = activeSeasonalEvent()?.id === ev.id;
  const now = Date.now();
  const started = now >= ev.startTs;
  const ended = now > ev.endTs;
  if (ended) return null;

  const status = !started ? "upcoming" : "active";

  return (
    <div className={`panel p-3 ${active ? "border-gold/50" : "border-line/60"} ${!started ? "opacity-80" : ""}`}>
      <SectionTitle icon={ev.icon} right={status === "active"
        ? <span className="text-[10px] text-arc font-bold">идёт сейчас</span>
        : <span className="text-[10px] text-dim">скоро</span>}>
        {ev.name.toUpperCase()}
      </SectionTitle>
      <div className="text-[11px] text-dim leading-snug mb-3">{ev.desc}</div>

      {status === "active" && (
        <div className="mb-3">
          <div className="flex items-center justify-between text-[10px] text-dim mb-1">
            <span>Очки ивента</span>
            <span className="tabular-nums">{fmt(Math.floor(points))}</span>
          </div>
          <Bar v={points} max={ev.tiers[ev.tiers.length - 1]?.pts ?? 1} color="#3fd0b6" h="h-2" className="w-full" />
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        {ev.tiers.map((t, i) => {
          const done = claimed.includes(i);
          const ready = status === "active" && !done && points >= t.pts;
          return (
            <div key={i} className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 ${done ? "border-line/40 opacity-60" : ready ? "border-gold/50 bg-gold/5" : "border-line/60 bg-abyss/40"}`}>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] text-fog flex items-center gap-1.5">
                  {done && <Icon n="check" className="w-3.5 h-3.5 text-r1" />}
                  {t.label}
                </div>
                <div className="text-[9px] text-dim tabular-nums">{Math.floor(t.pts)} очков</div>
              </div>
              {done ? (
                <span className="text-[10px] text-dim">получено</span>
              ) : (
                <button disabled={!ready} onClick={() => onClaim(i)}
                  className={`btn px-3 py-1.5 text-[11px] ${ready ? "btn-gold" : "btn-dark"}`}>
                  Забрать
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function EventSeg() {
  const { s, d } = useGame();
  const now = Date.now();
  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3">
        <SectionTitle icon="flame" right={<span className="text-[10px] text-dim">ограниченные по времени</span>}>
          СЕЗОННЫЕ ИВЕНТЫ
        </SectionTitle>
        <div className="text-[11px] text-dim leading-snug">
          Сезонные события приходят на месяц. Убивай врагов, боссов и собирай ресурсы, чтобы копить очки и открывать награды.
          Очки ивента сгорают по его завершении.
        </div>
      </div>
      {SEASONAL_EVENTS.map(ev => (
        <EventRow key={ev.id} ev={ev} points={s.seasonal.points} claimed={s.seasonal.claimed}
          onClaim={(idx) => d({ type: "CLAIM_SEASON_TIER", idx })} />
      ))}
      {now > SEASONAL_EVENTS[SEASONAL_EVENTS.length - 1].endTs && (
        <div className="panel p-3 text-center text-[11px] text-dim">Сезонные ивенты скоро вернутся. Заглядывай сюда.</div>
      )}
    </div>
  );
}
