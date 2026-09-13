import { useEffect, useState } from "react";
import { useGame } from "../game/useGame";
import { useVk, type GuildInfo, type GuildMember, type ChatMessage } from "../platform/vk";
import { fmt } from "../game/logic";
import { Bar, Icon, SectionTitle } from "./bits";

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "сейчас";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}м`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}ч`;
  return `${Math.floor(d / 86400_000)}д`;
}

const ROLE_NAMES: Record<string, string> = { owner: "👑 Владелец", officer: "Офицер", member: "Участник" };

function GuildChat({ guildId }: { guildId: number }) {
  const { fetchGuildChat, sendGuildChat, deleteGuildChatMessage, isAdmin } = useVk();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);

  const load = () => { void fetchGuildChat().then(setMsgs); };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [guildId, fetchGuildChat]);

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    const msg = await sendGuildChat(text);
    if (msg) { setMsgs(prev => [...prev, msg]); setInput(""); }
    setSending(false);
  };

  const remove = async (id: number) => {
    if (await deleteGuildChatMessage(id)) setMsgs(prev => prev.filter(m => m.id !== id));
  };

  return (
    <div>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto scroll-slim mb-2">
        {msgs.length === 0 && <div className="text-center text-[11px] text-dim/70 py-3">Обсудите что-нибудь стратегическое…</div>}
        {msgs.map(m => (
          <div key={m.id} className={`flex flex-col ${m.me ? "items-end" : "items-start"}`}>
            <div className={`max-w-[88%] rounded-xl px-2.5 py-1.5 border ${m.me ? "bg-arc/12 border-arc/40" : "bg-abyss/60 border-line/60"}`}>
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className={`text-[10px] font-bold ${m.me ? "text-arc" : "text-gold"}`}>{m.me ? "ты" : m.userName}</span>
                <span className="text-[9px] text-dim/70">{relTime(m.ts)}</span>
                {(m.me || isAdmin) && (
                  <button onClick={() => remove(m.id)} className="text-[10px] text-dim/60 hover:text-ember leading-none" title="Удалить">✕</button>
                )}
              </div>
              <div className="text-[12px] text-fog leading-snug break-words">{m.text}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-1.5">
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter") send(); }}
          maxLength={200}
          placeholder="Своим…"
          className="flex-1 bg-black/30 border border-line/60 rounded-lg px-2.5 py-1.5 text-[12px] text-fog placeholder-dim focus:outline-none focus:border-arc/60"
        />
        <button onClick={send} disabled={!input.trim() || sending} className="btn btn-arc px-3 py-1.5 text-[12px]">➤</button>
      </div>
    </div>
  );
}

function MemberRow({ m, me }: { m: GuildMember; me: boolean }) {
  return (
    <div className="flex items-center gap-2 bg-abyss/40 border border-line/50 rounded-lg px-2.5 py-1.5">
      {m.avatar_url
        ? <img src={m.avatar_url} alt="" className="w-6 h-6 rounded-full border border-line/60 object-cover" />
        : <div className="w-6 h-6 rounded-full bg-panel2 border border-line/60 grid place-items-center text-[10px] text-dim">?</div>}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-fog truncate">{m.name} {me && <span className="text-arc">(ты)</span>}</div>
        <div className="text-[9px] text-dim">{ROLE_NAMES[m.role] ?? m.role} · ур. {m.level}</div>
      </div>
    </div>
  );
}

function GuildView({ guild, reload }: { guild: GuildInfo; reload: () => void }) {
  const { user, guildLeave, guildGoalClaim, guildGoalSet } = useVk();
  const [tab, setTab] = useState<"goal" | "members" | "chat">("goal");
  const [newGoalKey, setNewGoalKey] = useState<"kills" | "gold">("kills");
  const [newGoalTarget, setNewGoalTarget] = useState(500);

  const goalMet = guild.goalTarget > 0 && guild.goalValue >= guild.goalTarget;
  const isOwner = guild.myRole === "owner";

  const setGoal = async () => {
    if (await guildGoalSet(newGoalKey, newGoalTarget)) reload();
  };

  const claim = async () => {
    const res = await guildGoalClaim();
    if (res.ok) reload();
  };

  const leave = async () => {
    if (!confirm("Покинуть гильдию?")) return;
    const res = await guildLeave();
    if (res.ok) { if (res.disbanded) alert("Ты был владельцем — гильдия распущена."); reload(); }
  };

  const pct = guild.goalTarget > 0 ? Math.min(100, Math.round((guild.goalValue / guild.goalTarget) * 100)) : 0;

  return (
    <div className="flex flex-col gap-3">
      {/* шапка: имя, уровень, опыт, статус цели */}
      <div className="panel p-3">
        <SectionTitle icon="users" right={<span className="text-[10px] text-gold font-bold">уровень {guild.level}</span>}>
          {guild.name.toUpperCase()}{guild.tag ? ` · ${guild.tag}` : ""}
        </SectionTitle>
        <div className="text-[10px] text-dim mb-1">Опыт гильдии: {fmt(guild.xp)} · участников: {guild.members.length}</div>
        <Bar v={guild.xp} max={Math.max(40 * (guild.level + 1) ** 2 - 40 * guild.level ** 2, 40)} color="#f0b429" h="h-1.5" className="w-full" />
        <div className="mt-2.5 flex items-center justify-between text-[11px]">
          <span className="text-fog">Цель: {guild.goalKey === "gold" ? "золото" : "убийства"}</span>
          {guild.goalTarget > 0 ? (
            <span className="tabular-nums text-[10px] text-fog">{fmt(guild.goalValue)} / {fmt(guild.goalTarget)} · {pct}%</span>
          ) : (
            <span className="text-[10px] text-dim">не задана</span>
          )}
        </div>
      </div>

      {/* вкладки */}
      <div className="grid grid-cols-3 gap-1.5 p-1.5 panel">
        {([
          { id: "goal", n: "Цель", i: "flame" },
          { id: "members", n: "Участники", i: "user" },
          { id: "chat", n: "Чат", i: "chat" },
        ] as const).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-2 rounded-lg flex items-center justify-center gap-1.5 transition ${tab === t.id ? "bg-gold/15 text-gold border border-gold/40" : "text-dim border border-transparent"}`}>
            <Icon n={t.i} className="w-4 h-4" />
            <span className="text-[10px] font-display tracking-wide">{t.n}</span>
            {t.id === "members" && <span className="text-[9px] text-dim">{guild.members.length}</span>}
          </button>
        ))}
      </div>

      {/* вкладка: цель */}
      {tab === "goal" && (
        <div className="panel p-3">
          <SectionTitle icon="flame" right={guild.goalTarget > 0 ? <span className="text-[10px] text-gold font-bold">{pct}%</span> : undefined}>
            ОБЩАЯ ЦЕЛЬ
          </SectionTitle>
          {guild.goalTarget > 0 ? (
            <div className="flex flex-col gap-1.5">
              <div className="text-[10px] text-dim">Убийства и золото всей гильдией копят прогресс — награда каждому участнику.</div>
              <Bar v={guild.goalValue} max={guild.goalTarget} color={goalMet ? "#f0b429" : "#3fd0b6"} h="h-2.5" className="w-full" />
              {goalMet ? (
                guild.goalClaimed
                  ? <div className="text-[10px] text-dim text-center">Награда цели получена. Жди новую цель!</div>
                  : <button onClick={claim} className="btn btn-gold w-full py-2.5 text-[11px]">ЗАБРАТЬ НАГРАДУ ГИЛЬДИИ</button>
              ) : (
                <div className="text-[10px] text-dim text-center">Фарми — вклад в общую копилку идёт автоматически.</div>
              )}
            </div>
          ) : (
            <div className="text-[10px] text-dim text-center py-1">
              {isOwner ? "Поставь первую цель — и вся гильдия будет фармить на общую награду." : "Владелец ещё не поставил цель."}
            </div>
          )}

          {isOwner && (
            <div className="mt-3 border-t border-line/60 pt-2 flex flex-col gap-1.5">
              <div className="text-[10px] text-dim">Новая цель (сбросит прогресс и награды):</div>
              <div className="flex gap-1.5">
                <select value={newGoalKey} onChange={e => setNewGoalKey(e.target.value as "kills" | "gold")} className="admin-select flex-1">
                  <option value="kills">Убийства</option>
                  <option value="gold">Золото</option>
                </select>
                <input type="number" min={1} value={newGoalTarget} onChange={e => setNewGoalTarget(Math.max(1, Number(e.target.value)))} className="admin-input w-24 text-center" />
                <button onClick={setGoal} className="btn btn-dark px-3 py-1.5 text-[11px]">Цель</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* вкладка: участники */}
      {tab === "members" && (
        <div className="panel p-3">
          <SectionTitle icon="user" right={<span className="text-[10px] text-dim">{guild.members.length} чел.</span>}>УЧАСТНИКИ</SectionTitle>
          <div className="flex flex-col gap-1.5">
            {guild.members.map(m => <MemberRow key={m.vk_user_id} m={m} me={Number(m.vk_user_id) === Number(user?.id)} />)}
          </div>
        </div>
      )}

      {/* вкладка: чат */}
      {tab === "chat" && (
        <div className="panel p-3">
          <SectionTitle icon="chat">ЧАТ ГИЛЬДИИ</SectionTitle>
          <GuildChat guildId={guild.id} />
        </div>
      )}

      <button onClick={leave} className="btn btn-dark w-full py-2 text-[11px] text-ember">ПОКИНУТЬ ГИЛЬДИЮ</button>
      <div className="text-[9px] text-dim text-center">Владелец, уходя, передаёт гильдию старейшему участнику (или распускает её).</div>
    </div>
  );
}

function NoGuild({ reload }: { reload: () => void }) {
  const { guildCreate, guildJoin, guildSearch, user } = useVk();
  const [name, setName] = useState("");
  const [tag, setTag] = useState("");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; name: string; tag: string; level: number; members: number }[]>([]);
  const [error, setError] = useState("");

  const create = async () => {
    setError("");
    if (name.trim().length < 2) { setError("Имя слишком короткое (мин. 2 символа)"); return; }
    const res = await guildCreate(name.trim(), tag.trim());
    if (!res.ok) { setError({ name_taken: "Имя занято", already_in_guild: "Ты уже в гильдии" }[res.error ?? ""] ?? "Ошибка создания"); return; }
    reload();
  };

  const doSearch = async () => {
    if (query.trim().length < 2) return;
    setResults(await guildSearch(query.trim()));
  };

  const join = async (id: number) => {
    const res = await guildJoin(id);
    if (res.ok) reload();
    else setError(res.error === "already_in_guild" ? "Ты уже в гильдии" : "Не удалось вступить");
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3">
        <SectionTitle icon="users" right={<span className="text-[10px] text-dim">клад-на-всех</span>}>ГИЛЬДИЯ</SectionTitle>
        <div className="text-[11px] text-dim leading-snug mb-3">
          Объединяйся с другими игроками: общий чат, совместная цель (убийства/золото всей гильдией)
          с наградой для каждого участника и уровень гильдии.
        </div>
        <div className="flex flex-col gap-1.5">
          <input value={name} onChange={e => setName(e.target.value)} maxLength={24} placeholder="Название гильдии (мин. 2 символа)" className="admin-input w-full" />
          <div className="flex gap-1.5">
            <input value={tag} onChange={e => setTag(e.target.value)} maxLength={6} placeholder="Тег (опц.)" className="admin-input w-28" />
            <button onClick={create} className="btn btn-gold flex-1 py-2 text-[11px]">СОЗДАТЬ ГИЛЬДИЮ</button>
          </div>
        </div>
        {error && <div className="text-[11px] text-ember mt-2">{error}</div>}
      </div>

      <div className="panel p-3">
        <SectionTitle icon="search">НАЙТИ ГИЛЬДИЮ</SectionTitle>
        <div className="flex gap-1.5 mb-2">
          <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === "Enter") doSearch(); }} maxLength={30} placeholder="Название…" className="admin-input flex-1" />
          <button onClick={doSearch} className="btn btn-dark px-3 py-1.5 text-[11px]">Поиск</button>
        </div>
        <div className="flex flex-col gap-1.5">
          {results.length === 0 && <div className="text-[10px] text-dim text-center py-2">Введи название, чтобы найти гильдию.</div>}
          {results.map(r => (
            <div key={r.id} className="flex items-center gap-2 bg-abyss/40 border border-line/50 rounded-lg px-2.5 py-2">
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-fog font-semibold truncate">{r.name}{r.tag ? ` · ${r.tag}` : ""}</div>
                <div className="text-[9px] text-dim">уровень {r.level} · {r.members} участников</div>
              </div>
              <button onClick={() => join(r.id)} className="btn btn-dark px-3 py-1.5 text-[10px]">Вступить</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function GuildSeg() {
  const { guildMine } = useVk();
  const [guild, setGuild] = useState<GuildInfo | null | undefined>(undefined);
  const [reloadKey, setReloadKey] = useState(0);
  const reload = () => setReloadKey(x => x + 1);

  useEffect(() => {
    let alive = true;
    guildMine().then(g => { if (alive) setGuild(g); });
    return () => { alive = false; };
  }, [guildMine, reloadKey]);

  return (
    <div className="flex flex-col gap-2.5 anim-rise">
      {guild === undefined ? (
        <div className="panel p-6 text-center text-[11px] text-dim">Загрузка…</div>
      ) : guild ? (
        <GuildView guild={guild} reload={reload} />
      ) : (
        <NoGuild reload={reload} />
      )}
    </div>
  );
}
