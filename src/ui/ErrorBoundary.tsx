import { Component, type ErrorInfo, type ReactNode } from "react";

// Ловит ошибки рендера в поддереве и показывает экран восстановления вместо
// белого экрана. Без него любая ошибка в экране (например, отсутствующее поле
// сейва) «убивает» всю игру без возможности вернуться.
export class ErrorBoundary extends Component<{ children: ReactNode }, { err: Error | null }> {
  state: { err: Error | null } = { err: null };

  static getDerivedStateFromError(err: Error) {
    return { err };
  }

  componentDidCatch(err: Error, info: ErrorInfo) {
    try {
      navigator.sendBeacon?.(
        "/api/client-error",
        JSON.stringify({
          msg: String(err?.message || err),
          stack: String(err?.stack || "").slice(0, 1500),
          component: String(info?.componentStack || "").slice(0, 1500),
          href: typeof location !== "undefined" ? location.href : "",
        }),
      );
    } catch { /* телеметрия не должна ломать обработку ошибки */ }
  }

  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div className="min-h-screen bg-dungeon bg-noise grid place-items-center p-6 select-none">
        <div className="panel max-w-sm w-full p-6 text-center">
          <div className="text-4xl mb-3">☠️</div>
          <h1 className="font-display text-lg text-gold tracking-widest">БЕЗДНА ДРОГНУЛА</h1>
          <p className="text-[11px] text-dim mt-2">
            Что-то сломалось при отрисовке экрана. Прогресс сохранён — перезапусти приложение.
          </p>
          <p className="text-[9px] text-dim/60 mt-2 break-words">{String(this.state.err?.message || this.state.err)}</p>
          <div className="flex flex-col gap-2 mt-4">
            <button
              onClick={() => location.reload()}
              className="px-4 py-2.5 rounded-xl font-display text-[12px] text-ink bg-gold border border-gold/50"
            >
              ПЕРЕЗАПУСТИТЬ
            </button>
            <button
              onClick={() => this.setState({ err: null })}
              className="px-4 py-2.5 rounded-xl font-display text-[12px] text-fog border border-line/60"
            >
              ПОПРОБОВАТЬ СНОВА
            </button>
          </div>
        </div>
      </div>
    );
  }
}