import { useEffect, useRef, useState } from "react";
import { useVk, type ChatMessage } from "../platform/vk";
import { Icon } from "./bits";

function relTime(ts: number): string {
  const d = Date.now() - ts;
  if (d < 60_000) return "сейчас";
  if (d < 3600_000) return `${Math.floor(d / 60_000)}м`;
  if (d < 86400_000) return `${Math.floor(d / 3600_000)}ч`;
  return `${Math.floor(d / 86400_000)}д`;
}

export function ChatPanel() {
  const { inVk, launchParams, user, isAdmin, fetchChatMessages, sendChatMessage, deleteChatMessage, cloudStatus } = useVk();
  const netDown = cloudStatus === "error" || cloudStatus === "offline";
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [unread, setUnread] = useState(0);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const lastTopRef = useRef(0);

  useEffect(() => {
    if (!inVk && !launchParams) return;
    const load = async () => {
      const list = await fetchChatMessages();
      if (!list.length) return;
      setMsgs(prev => {
        // при открытии панели не считаем прочитанное за новое
        if (open) { lastTopRef.current = list.length; return list; }
        const newOnes = list.filter(m => m.ts > (prev[prev.length - 1]?.ts ?? 0));
        setUnread(u => u + newOnes.filter(m => !m.me).length);
        return list;
      });
    };
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [inVk, launchParams, open, fetchChatMessages]);

  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [msgs.length, open]);

  if (!inVk && !launchParams) return null;

  const openPanel = () => {
    setOpen(true);
    setUnread(0);
    lastTopRef.current = msgs.length;
  };

  const send = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setNotice(null);
    const res = await sendChatMessage(text);
    if (res.ok && res.msg) {
      setMsgs(prev => [...prev, res.msg!]);
      setInput("");
    } else if (res.error === "banned") {
      if (res.bannedUntil == null) setNotice("Вы забанены в чате. Причина: нарушение правил.");
      else {
        const mins = Math.ceil((res.bannedUntil - Date.now()) / 60000);
        setNotice(`Вы забанены в чате ещё на ${mins > 60 ? Math.floor(mins / 60) + " ч" : mins + " мин"}.`);
      }
    } else if (res.error === "too_fast") {
      setNotice("Слишком часто! Подожди пару секунд.");
    } else if (res.error === "hourly_limit") {
      setNotice("Лимит сообщений на час исчерпан.");
    } else if (res.error) {
      setNotice("Не удалось отправить. Проверь соединение.");
    }
    setSending(false);
  };

  const remove = async (id: number) => {
    if (await deleteChatMessage(id)) setMsgs(prev => prev.filter(m => m.id !== id));
  };

  return (
    <>
      <button onClick={open ? () => setOpen(false) : openPanel}
        className="fixed z-40 bottom-24 right-4 w-12 h-12 rounded-full panel grid place-items-center text-xl shadow-xl"
        style={{ color: "#3fd0b6" }} title={open ? "Закрыть чат" : "Чат"}>
        {open ? "✕" : "💬"}
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 bg-ember text-white text-[10px] w-5 h-5 rounded-full grid place-items-center font-bold shadow">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed z-50 bottom-44 right-3 w-[19rem] max-w-[92vw] h-[26rem] max-h-[70vh] panel flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line/60">
            <span className="font-display text-[13px] text-arc flex items-center gap-1.5">
              <Icon n="chat" className="w-4 h-4" />Чат Бездны
            </span>
            <span className="text-[9px] text-dim">реальные игроки</span>
            <button onClick={() => setOpen(false)} className="text-[13px] text-dim hover:text-ember leading-none px-1" title="Закрыть">✕</button>
          </div>

          {netDown && (
            <div className="px-3 py-1.5 text-[10px] text-ember bg-ember/10 border-b border-ember/20 text-center">
              ⚠️ Нет соединения с сервером — сообщения могут не обновляться
            </div>
          )}

          <div ref={listRef} className="flex-1 overflow-y-auto scroll-slim p-2.5 flex flex-col gap-2">
            {msgs.length === 0 && (
              <div className="text-center text-[11px] text-dim/70 py-8">Пока тихо. Напиши первым!</div>
            )}
            {msgs.map(m => (
              <div key={m.id} className={`flex flex-col ${m.me ? "items-end" : "items-start"}`}>
                <div className={`max-w-[85%] rounded-xl px-2.5 py-1.5 border ${m.me ? "bg-arc/12 border-arc/40" : "bg-abyss/60 border-line/60"}`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[10px] font-bold ${m.me ? "text-arc" : "text-gold"}`}>
                      {m.me ? "ты" : (m.admin ? "👑 " : "") + m.userName}
                    </span>
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

          <div className="border-t border-line/60 p-2 flex gap-1.5">
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") send(); }}
              maxLength={200}
              placeholder="Написать…"
              className="flex-1 bg-black/30 border border-line/60 rounded-lg px-2.5 py-1.5 text-[12px] text-fog placeholder-dim focus:outline-none focus:border-arc/60"
            />
            <button onClick={send} disabled={!input.trim() || sending}
              className="btn btn-arc px-3 py-1.5 text-[12px]">➤</button>
          </div>
          {notice && <div className="px-3 pb-1.5 text-[10px] text-ember">{notice}</div>}
          <div className="px-3 pb-1.5 text-[8px] text-dim/50">мат заменяется, лимит 1 сообщ./2 сек · удаляются сообщения старше 3 дней</div>
        </div>
      )}
    </>
  );
}
