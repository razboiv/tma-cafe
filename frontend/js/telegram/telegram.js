// Надёжная обёртка над Telegram.WebApp с кликом MainButton через onClick и onEvent

export class TelegramSDK {
  static #readyDone = false;
  static #mbHandler = null;  // единый обработчик (обёртка)
  static #mbLastTs = 0;      // анти-дубль
  static #bbHandler = null;

  // ---- базовое ----
  static ready() {
    const W = window.Telegram?.WebApp;
    if (!this.#readyDone && W) {
      try { W.ready(); } catch {}
      this.#readyDone = true;
    }
  }
  static expand() { try { window.Telegram?.WebApp?.expand(); } catch {} }
  static close()  { try { window.Telegram?.WebApp?.close(); }  catch {} }
  static getInitData() { return window.Telegram?.WebApp?.initData || ""; }

  // ---- MainButton ----
  static showMainButton(text = "MY CART", onClick) {
    const W = window.Telegram?.WebApp;
    const MB = W?.MainButton;
    if (!W || !MB) return;
    this.ready();

    // снять старые обработчики
    if (this.#mbHandler) {
      try { MB.offClick(this.#mbHandler); } catch {}
      try { W.offEvent?.("mainButtonClicked", this.#mbHandler); } catch {}
    }

    // обёртка + защита от двойного вызова
    this.#mbHandler = () => {
      const now = Date.now();
      if (now - this.#mbLastTs < 200) return;
      this.#mbLastTs = now;
      try { onClick?.(); } catch (e) { console.error(e); }
    };

    // применяем параметры и гарантируем видимость/активность
    try { MB.setParams({ text, is_visible: true, is_active: true }); } catch {}
    try { MB.enable(); } catch {}
    try { MB.show(); } catch {}

    // двойная подписка — какой-то канал точно сработает
    try { MB.onClick(this.#mbHandler); } catch {}
    try { W.onEvent?.("mainButtonClicked", this.#mbHandler); } catch {}
  }

  static hideMainButton() {
    const W = window.Telegram?.WebApp;
    const MB = W?.MainButton;
    if (!MB) return;

    if (this.#mbHandler) {
      try { MB.offClick(this.#mbHandler); } catch {}
      try { W.offEvent?.("mainButtonClicked", this.#mbHandler); } catch {}
      this.#mbHandler = null;
    }
    try { MB.hide(); } catch {}
  }

  // ---- BackButton ----
  static showBackButton(onClick) {
    const W = window.Telegram?.WebApp;
    const BB = W?.BackButton;
    if (!BB) return;
    this.ready();

    if (this.#bbHandler) {
      try { BB.offClick(this.#bbHandler); } catch {}
    }
    this.#bbHandler = () => { try { onClick?.(); } catch (e) { console.error(e); } };
    try { BB.show(); } catch {}
    try { BB.onClick(this.#bbHandler); } catch {}
  }

  static hideBackButton() {
    const BB = window.Telegram?.WebApp?.BackButton;
    if (!BB) return;
    if (this.#bbHandler) {
      try { BB.offClick(this.#bbHandler); } catch {}
      this.#bbHandler = null;
    }
    try { BB.hide(); } catch {}
  }

  // ---- утилиты ----
  static sendData(data)    { try { window.Telegram?.WebApp?.sendData?.(data); } catch {} }
  static openInvoice(u,cb) { try { window.Telegram?.WebApp?.openInvoice?.(u, cb); } catch {} }
  static showAlert(t)      { try { window.Telegram?.WebApp?.showAlert?.(t); } catch {} }
  static showConfirm(t)    { try { return window.Telegram?.WebApp?.showConfirm?.(t); } catch {} return Promise.resolve(false); }
}

export default TelegramSDK;