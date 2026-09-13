import { useGame } from "../game/useGame";
import { Icon } from "./bits";
import { fmt } from "../game/logic";

export function SocialScreen() {
  const { s, d } = useGame();
  const { social } = s;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="panel p-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-blue-500/10 to-transparent" />
        <div className="relative">
          <h2 className="text-xl font-display text-blue-400 tracking-widest">СОЦИАЛ</h2>
          <p className="text-[10px] text-dim mt-1">Друзья и подарки</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2">
        <div className="panel p-3 text-center">
          <div className="text-[8px] text-dim uppercase">Друзья</div>
          <div className="text-lg font-bold text-blue-300">{social.friends.length}</div>
        </div>
        <div className="panel p-3 text-center">
          <div className="text-[8px] text-dim uppercase">Подарки</div>
          <div className="text-lg font-bold text-gold">{social.giftsReceived.filter(g => !g.claimed).length}</div>
        </div>
        <div className="panel p-3 text-center">
          <div className="text-[8px] text-dim uppercase">Приглашено</div>
          <div className="text-lg font-bold text-green-300">{social.referred.length}</div>
        </div>
      </div>

      {/* Gifts */}
      {social.giftsReceived.filter(g => !g.claimed).length > 0 && (
        <div className="panel p-4">
          <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
            <Icon n="bag" className="w-4 h-4 text-gold" />
            Подарки
          </h3>
          <div className="space-y-2">
            {social.giftsReceived.filter(g => !g.claimed).map((gift, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-gold/5 border border-gold/20">
                <div className="flex items-center gap-2">
                  <Icon n="user" className="w-4 h-4 text-gold" />
                  <div>
                    <div className="text-[9px] text-fog">От: {gift.from}</div>
                    <div className="text-[8px] text-dim">
                      {gift.reward.gold && `${fmt(gift.reward.gold)} 💰 `}
                      {gift.reward.gems && `${fmt(gift.reward.gems)} 💎`}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => d({ type: "SOCIAL_CLAIM_GIFT", giftIndex: social.giftsReceived.indexOf(gift) })}
                  className="px-3 py-1 rounded text-[9px] text-gold border border-gold/50 hover:bg-gold/10"
                >
                  Забрать
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Gift */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="heart" className="w-4 h-4 text-red-400" />
          Отправить подарок
        </h3>
        {social.friends.length === 0 ? (
          <div className="text-center py-4 text-dim">
            <p className="text-[10px]">Нет друзей в игре</p>
          </div>
        ) : (
          <div className="space-y-2">
            {social.friends.slice(0, 5).map((friendId) => {
              const sentToday = social.giftsSent.includes(friendId);
              return (
                <button
                  key={friendId}
                  disabled={sentToday}
                  onClick={() => d({ type: "SOCIAL_SEND_GIFT", friendId })}
                  className={`w-full flex items-center justify-between p-2 rounded-lg ${
                    sentToday 
                      ? "bg-black/10 border border-white/5 opacity-50" 
                      : "bg-blue-500/5 border border-blue-400/20 hover:bg-blue-500/10"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon n="user" className="w-4 h-4 text-blue-300" />
                    <span className="text-[10px] text-fog">ID: {friendId}</span>
                  </div>
                  {sentToday ? (
                    <span className="text-[8px] text-dim">✓ Отправлено</span>
                  ) : (
                    <span className="text-[8px] text-blue-300">+1 ❤️</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Invite Friends */}
      <div className="panel p-4">
        <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
          <Icon n="users" className="w-4 h-4 text-green-400" />
          Пригласить друга
        </h3>
        <div className="p-3 rounded-lg bg-green-500/5 border border-green-400/20 text-center">
          <p className="text-[9px] text-fog mb-2">Пригласите друзей и получите бонусы!</p>
          <p className="text-[8px] text-dim mb-3">
            Вы и друг получите по 100 💎 за каждого приглашённого
          </p>
          <button
            onClick={() => {
              // Здесь логика открытия диалога VK для приглашения
              const friendId = prompt("Введите ID друга VK:");
              if (friendId) d({ type: "SOCIAL_INVITE_FRIEND", friendId });
            }}
            className="px-4 py-2 rounded-lg text-[10px] text-green-300 border border-green-400/50 hover:bg-green-400/10"
          >
            Пригласить
          </button>
        </div>
      </div>

      {/* Friend Leaderboard */}
      {social.friendLeaderboard.length > 0 && (
        <div className="panel p-4">
          <h3 className="text-sm font-display text-fog mb-3 flex items-center gap-2">
            <Icon n="crown" className="w-4 h-4 text-gold" />
            Рейтинг друзей
          </h3>
          <div className="space-y-2">
            {social.friendLeaderboard.slice(0, 5).map((entry, idx) => (
              <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-black/20 border border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[9px] text-dim w-4">#{idx + 1}</span>
                  <span className="text-[10px] text-fog">{entry.name}</span>
                </div>
                <div className="text-right">
                  <div className="text-[8px] text-gold">{fmt(entry.power)} ⚔️</div>
                  <div className="text-[7px] text-dim">Зона {entry.zone}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Info */}
      <div className="panel p-3 text-center">
        <p className="text-[9px] text-dim">
          💡 Отправляйте подарки друзьям ежедневно и получайте бонусы
        </p>
      </div>
    </div>
  );
}
