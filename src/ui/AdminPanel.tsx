import { useEffect, useState } from "react";
import { useVk, type ChatMessage, type ChatBan } from "../platform/vk";
import { SETS, ZONES, MOBS } from "../game/data";
import { DEFAULT_BALANCE, type DropPoolEntry } from "../game/balanceConfig";
import { Icon, SectionTitle } from "./bits";

type Tab = "balance" | "chat";

/* ================= Баланс (настройки сервера и игры) ================= */
function BalanceTab({ onChanged }: { onChanged: () => void }) {
  const { adminGetBalance, adminSaveBalance } = useVk();
  const [cfg, setCfg] = useState<{ balance: Record<string, unknown>; dropPools: DropPoolEntry[] }>({ balance: {}, dropPools: [] });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  useEffect(() => {
    void adminGetBalance().then(c => {
      const b = (c && typeof c.balance === "object" ? c.balance : {}) as Record<string, unknown>;
      const p = Array.isArray(c?.dropPools) ? c.dropPools as DropPoolEntry[] : [];
      setCfg({ balance: b, dropPools: p });
    });
  }, [adminGetBalance]);

  const balance = cfg.balance;
  const pools = cfg.dropPools;

  const setNum = (key: string, v: number) => setCfg(p => ({ ...p, balance: { ...p.balance, [key]: v } }));
  const setArr = (key: string, arr: number[]) => setCfg(p => ({ ...p, balance: { ...p.balance, [key]: arr } }));
  const setPool = (i: number, patch: Partial<DropPoolEntry>) =>
    setCfg(p => ({ ...p, dropPools: p.dropPools.map((e, j) => j === i ? { ...e, ...patch } : e) }));
  const addPool = () => setCfg(p => ({ ...p, dropPools: [...p.dropPools, { source: "global", contentId: "", chance: 10, ilvlDelta: 0 }] }));
  const removePool = (i: number) => setCfg(p => ({ ...p, dropPools: p.dropPools.filter((_, j) => j !== i) }));

  const save = async () => {
    const ok = await adminSaveBalance({ balance: cfg.balance, dropPools: cfg.dropPools });
    setMsg(ok ? { ok: true, text: "Сохранено ✓. Применится при следующем запуске игры." } : { ok: false, text: "Ошибка сохранения" });
    if (ok) onChanged();
  };

  const num = (key: string, def: number) => Number(balance[key] ?? def);
  const arr = (key: string, def: number[]) => (Array.isArray(balance[key]) ? balance[key] as number[] : def);

  const sourceOptions = [
    { value: "global", label: "Везде" },
    ...ZONES.map((z, i) => ({ value: `zone:${i}`, label: `Зона ${i + 1}: ${z.name}` })),
    ...[...new Set(ZONES.flatMap(z => z.mobs))].map(k => ({ value: `enemy:${k}`, label: `Враг: ${MOBS[k]?.n ?? k}` })),
    ...[...new Set(ZONES.map(z => z.boss))].map(k => ({ value: `boss:${k}`, label: `Босс: ${MOBS[k]?.n ?? k}` })),
  ];
  const contentOptions = SETS.map(s => ({ value: s.id, label: `Сет: ${s.name}` }));
  const srcLabel = (v: string) => sourceOptions.find(o => o.value === v)?.label ?? v;
  const cLabel = (v: string) => contentOptions.find(o => o.value === v)?.label ?? v;

  const numFields: { key: string; label: string; def: number; step?: number }[] = [
    { key: "dropBaseChance", label: "Дроп с обычного врага (0..1)", def: DEFAULT_BALANCE.dropBaseChance, step: 0.01 },
    { key: "bossDropChance", label: "Дроп с босса (0..1)", def: DEFAULT_BALANCE.bossDropChance, step: 0.01 },
    { key: "bossExtraChance", label: "Второй дроп с босса (0..1)", def: DEFAULT_BALANCE.bossExtraChance, step: 0.01 },
    { key: "potionChance", label: "Шанс зелья (0..1)", def: DEFAULT_BALANCE.potionChance, step: 0.01 },
    { key: "ilvlZoneMult", label: "ilvl = зона ×", def: DEFAULT_BALANCE.ilvlZoneMult },
    { key: "ilvlWaveAdd", label: "+ волна ×", def: DEFAULT_BALANCE.ilvlWaveAdd },
    { key: "ilvlBossBonus", label: "+ бонус босса", def: DEFAULT_BALANCE.ilvlBossBonus },
    { key: "statRollMin", label: "Разброс стата: мин", def: DEFAULT_BALANCE.statRollMin, step: 0.01 },
    { key: "statRollMax", label: "Разброс стата: макс", def: DEFAULT_BALANCE.statRollMax, step: 0.01 },
    { key: "enemyHpPow", label: "Рост HP врагов × за волну", def: DEFAULT_BALANCE.enemyHpPow, step: 0.001 },
    { key: "enemyDmgPow", label: "Рост урона врагов × за волну", def: DEFAULT_BALANCE.enemyDmgPow, step: 0.001 },
    { key: "enemyHpBase", label: "База HP врага", def: DEFAULT_BALANCE.enemyHpBase },
    { key: "enemyHpPerZone", label: "HP врага: + за зону", def: DEFAULT_BALANCE.enemyHpPerZone },
    { key: "enemyDmgBase", label: "База урона врага", def: DEFAULT_BALANCE.enemyDmgBase },
    { key: "enemyDmgPerZone", label: "Урон врага: + за зону", def: DEFAULT_BALANCE.enemyDmgPerZone },
    { key: "bossHpMult", label: "Босс: HP ×", def: DEFAULT_BALANCE.bossHpMult, step: 0.1 },
    { key: "bossDmgMult", label: "Босс: урон ×", def: DEFAULT_BALANCE.bossDmgMult, step: 0.1 },
  ];
  const arrFields: { key: string; label: string; len: number; def: number[] }[] = [
    { key: "rarityWeights", label: "Веса редкости (обычный..легендарный)", len: 5, def: DEFAULT_BALANCE.rarityWeights },
    { key: "rarityMult", label: "Множители редкости (0..5)", len: 6, def: DEFAULT_BALANCE.rarityMult },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="bg-abyss/60 border border-line/60 rounded-xl p-3 flex flex-col gap-2">
        <SectionTitle icon="map">ПУЛЫ ДРОПА · где и с каким %</SectionTitle>
        <div className="text-[10px] text-dim leading-relaxed">
          Каждая запись: сет падает с указанного источника со своим шансом. Приоритет: враг/босс → зона → везде. До 1 предмета из пула за убийство, сверх обычного дропа. ilvl± — сдвиг уровня вещи.
        </div>
        {pools.length === 0 && <div className="text-[11px] text-dim text-center py-2">Пулов нет — дроп как обычно.</div>}
        {pools.map((p, i) => (
          <div key={i} className="flex flex-col gap-1.5 rounded-lg border border-line/60 bg-panel2/50 px-2.5 py-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-dim w-14">источник</span>
              <select value={p.source} onChange={e => setPool(i, { source: e.target.value })} className="admin-select flex-1">
                {sourceOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <select value={p.contentId} onChange={e => setPool(i, { contentId: e.target.value })} className="admin-select flex-1">
                <option value="">— выбери сет —</option>
                {contentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <span className="text-[10px] text-dim">%</span>
              <input type="number" min={0} max={100} value={p.chance} onChange={e => setPool(i, { chance: Math.max(0, Math.min(100, Number(e.target.value))) })} className="admin-input w-16 text-center" />
              <span className="text-[10px] text-dim">ilvl±</span>
              <input type="number" value={p.ilvlDelta} onChange={e => setPool(i, { ilvlDelta: Number(e.target.value) })} className="admin-input w-14 text-center" />
              <button onClick={() => removePool(i)} className="btn btn-dark px-2 py-1 text-[12px]">✕</button>
            </div>
          </div>
        ))}
        <button onClick={addPool} className="btn btn-dark w-full py-2 text-[11px]">+ ДОБАВИТЬ ПУЛ</button>
        <div className="text-[10px] text-dim">Назначено: {pools.map(p => `${srcLabel(p.source)}→${cLabel(p.contentId) || "?"} ${p.chance}%`).join(" · ") || "—"}</div>
      </div>

      <div className="bg-abyss/60 border border-line/60 rounded-xl p-3 flex flex-col gap-2">
        <SectionTitle icon="scale">ЧИСЛА ГЕНЕРАЦИИ</SectionTitle>
        <div className="text-[10px] text-dim">Пустые/нестандартные поля не отправляются — клиент использует дефолты.</div>
        {numFields.map(f => (
          <div key={f.key} className="flex items-center justify-between gap-2">
            <span className="text-[11px] text-fog">{f.label}</span>
            <input type="number" step={f.step ?? 1} value={num(f.key, f.def)} onChange={e => setNum(f.key, Number(e.target.value))} className="admin-input w-24 text-right" />
          </div>
        ))}
        {arrFields.map(f => (
          <div key={f.key} className="flex flex-col gap-1">
            <span className="text-[11px] text-fog">{f.label}</span>
            <div className="flex gap-1.5">
              {arr(f.key, f.def).map((v, i) => (
                <input key={i} type="number" value={v} onChange={e => { const a = [...arr(f.key, f.def)]; a[i] = Number(e.target.value); setArr(f.key, a); }} className="admin-input w-14 text-center" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {msg && <div className={`text-[11px] ${msg.ok ? "text-mana" : "text-red-400"}`}>{msg.text}</div>}
      <button onClick={save} className="btn btn-gold w-full py-2.5 text-[12px]">СОХРАНИТЬ БАЛАНС</button>
    </div>
  );
}

/* ================= Модерация чата ================= */
function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "сейчас";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}м`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}ч`;
  return `${Math.floor(d / 86400_000)}д`;
}

function ChatAdminTab() {
  const { fetchChatMessages, deleteChatMessage, adminListBans, adminBanUser, adminUnbanUser } = useVk();
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [bans, setBans] = useState<ChatBan[]>([]);
  const [banId, setBanId] = useState("");
  const [banDays, setBanDays] = useState(1);
  const [banReason, setBanReason] = useState("");

  const load = () => { void fetchChatMessages().then(list => { setMsgs(list); setLoading(false); }); };
  const loadBans = () => { void adminListBans().then(setBans); };
  useEffect(() => { load(); const t = setInterval(load, 5000); return () => clearInterval(t); }, [fetchChatMessages]);
  useEffect(() => { loadBans(); }, [adminListBans]);

  const remove = async (id: number) => {
    if (!confirm("Удалить сообщение?")) return;
    if (await deleteChatMessage(id)) setMsgs(prev => prev.filter(m => m.id !== id));
  };

  const banUser = async () => {
    const target = Number(banId.trim());
    if (!Number.isInteger(target) || target <= 0) { alert("Введи VK ID игрока"); return; }
    if (await adminBanUser(target, banDays, banReason)) { loadBans(); setBanId(""); setBanReason(""); }
    else alert("Не удалось забанить");
  };

  const unban = async (vk_user_id: number) => {
    if (!confirm("Разбанить этого игрока?")) return;
    if (await adminUnbanUser(vk_user_id)) loadBans();
  };

  return (
    <div className="bg-abyss/60 border border-line/60 rounded-xl p-3 flex flex-col gap-3">
      <SectionTitle icon="chat" right={<span className="text-[10px] text-dim">авто-обновление 5с</span>}>МОДЕРАЦИЯ ЧАТА</SectionTitle>
      {loading && <div className="text-[11px] text-dim text-center py-3">Загрузка…</div>}
      {!loading && msgs.length === 0 && <div className="text-[11px] text-dim text-center py-2">Сообщений пока нет.</div>}
      {msgs.map(m => (
        <div key={m.id} className={`flex items-start gap-2 rounded-lg border px-2.5 py-2 text-[11px] ${m.me ? "bg-arc/8 border-arc/30" : "bg-panel2/50 border-line/60"}`}>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className={`font-bold ${m.admin ? "text-gold" : "text-fog"}`}>{m.admin ? "👑 " : ""}{m.userName}</span>
              <span className="text-[9px] text-dim">{relTime(m.ts)}</span>
              {m.me && <span className="text-[9px] text-dim">(это ты)</span>}
            </div>
            <div className="text-fog/90 break-words mt-0.5">{m.text}</div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => { setBanId(String(m.userId)); }}
              className="text-ember text-[11px] px-1" title="Забанить этого игрока">⛔</button>
            <button onClick={() => remove(m.id)} className="text-ember text-[13px] px-1" title="Удалить">✕</button>
          </div>
        </div>
      ))}

      {/* Баны */}
      <div className="border-t border-line/60 pt-3 flex flex-col gap-2">
        <SectionTitle icon="lock">БАНЫ В ЧАТЕ</SectionTitle>
        <div className="flex gap-1.5">
          <input value={banId} onChange={e => setBanId(e.target.value)} placeholder="VK ID игрока" className="admin-input w-24" inputMode="numeric" />
          <input type="number" min={1} value={banDays} onChange={e => setBanDays(Math.max(1, Number(e.target.value)))} className="admin-input w-16 text-center" title="Дней бана" />
          <input value={banReason} onChange={e => setBanReason(e.target.value)} placeholder="Причина (опц.)" className="admin-input flex-1" maxLength={120} />
          <button onClick={banUser} className="btn btn-ember px-3 py-1.5 text-[11px]">Забанить</button>
        </div>
        <div className="text-[9px] text-dim -mt-1">days = дни (минимум 1). Для вечного бана введи 0.</div>
        {bans.length === 0 && <div className="text-[10px] text-dim text-center py-1">Активных банов нет.</div>}
        {bans.map(b => (
          <div key={b.id} className="flex items-center gap-2 rounded-lg border border-line/60 bg-panel2/40 px-2.5 py-1.5 text-[11px]">
            {b.avatar_url ? <img src={b.avatar_url} alt="" className="h-5 w-5 rounded-full object-cover" /> : <span className="h-5 w-5 rounded-full bg-panel grid place-items-center text-[8px] text-dim">?</span>}
            <div className="flex-1 min-w-0">
              <div className="text-fog truncate">{b.name} <span className="text-dim text-[9px]">(id {b.vk_user_id})</span></div>
              <div className="text-[9px] text-dim">
                {b.until == null ? "вечно" : `до ${new Date(b.until).toLocaleString("ru-RU")}`}
                {b.reason ? ` · ${b.reason}` : ""}
              </div>
            </div>
            <button onClick={() => unban(b.vk_user_id)} className="btn btn-dark px-2 py-1 text-[10px]">Разбанить</button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ================= Панель ================= */
export function AdminPanel() {
  const { isAdmin, user } = useVk();
  const [tab, setTab] = useState<Tab>("balance");
  const [refresh, setRefresh] = useState(0);
  const bump = () => setRefresh(x => x + 1);

  if (!isAdmin) {
    return (
      <div className="panel p-4 text-center">
        <Icon n="lock" className="w-6 h-6 mx-auto text-dim mb-2" />
        <div className="text-[12px] text-dim">Админ-панель доступна только владельцу.</div>
      </div>
    );
  }

  const tabs: { id: Tab; n: string; i: string }[] = [
    { id: "balance", n: "Баланс", i: "scale" },
    { id: "chat", n: "Чат", i: "chat" },
  ];

  return (
    <div className="flex flex-col gap-3">
      <div className="panel p-3">
        <SectionTitle icon="gear" right={<span className="text-[10px] text-dim">владелец: {user?.first_name}</span>}>АДМИН-ПАНЕЛЬ</SectionTitle>
      </div>
      <div className="grid grid-cols-2 gap-1.5 p-1.5 panel">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`py-2 rounded-lg flex flex-col items-center gap-0.5 transition ${tab === t.id ? "bg-gold/15 text-gold border border-gold/40" : "text-dim border border-transparent"}`}>
            <Icon n={t.i} className="w-4.5 h-4.5" />
            <span className="text-[9px] font-display tracking-wide">{t.n}</span>
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-3">
        {tab === "balance" && <BalanceTab key={`b-${refresh}`} onChanged={bump} />}
        {tab === "chat" && <ChatAdminTab />}
      </div>
    </div>
  );
}
