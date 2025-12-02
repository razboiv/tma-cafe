// frontend/js/telegram/telegram.js
// Обёртка Telegram.WebApp с надёжным кликом по MainButton (и через onClick, и через onEvent)

export class TelegramSDK {
  static #readyDone = false;
  static #mbHandler = null;       // наш обработчик (обёртка)
  static #mbLastTs = 0;           // анти-дубль (если два канала сработают одновременно)
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

    // применяем параметры и гарантируем видимость/активность
    try { MB.setParams({ text, is_active: true, is_visible: true }); } catch {}
    try { MB.enable(); } catch {}
    try { MB.show(); } catch {}

    // снимаем старые обработчики (и onClick, и onEvent)
    if (this.#mbHandler) {
      try { MB.offClick(this.#mbHandler); } catch {}
      try { W.offEvent?.("mainButtonClicked", this.#mbHandler); } catch {}
    }

    // единый обёрточный обработчик + анти-дабл (на случай двойного вызова)
    this.#mbHandler = () => {
      const now = Date.now();
      if (now - this.#mbLastTs < 200) return;  // глушим дубль
      this.#mbLastTs = now;
      try { onClick?.(); } catch (e) { console.error(e); }
    };

    // вешаем обеим способами — какой-то точно сработает
    try { MB.onClick(this.#mbHandler); } catch {}
    try { W.onEvent?.("mainButtonClicked", this.#mbHandler); } catch {}
  }

  static hideMainButton() {
    const W = window.Telegram?.WebApp;
    const MB = W?.MainButton;
    if (!MB) return;

    if (this.#mbHandler) {
      try { MB.offClick(this.#mbHandler); } catch {}
      try { W?.offEvent?.("mainButtonClicked", this.#mbHandler); } catch {}
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

    try { BB.show(); } catch {}
    if (this.#bbHandler) {
      try { BB.offClick(this.#bbHandler); } catch {}
    }
    this.#bbHandler = () => { try { onClick?.(); } catch (e) { console.error(e); } };
    try { BB.onClick(this.#bbHandler); } catch {}
  }

  static hideBackButton() {
    const W = window.Telegram?.WebApp;
    const BB = W?.BackButton;
    if (!BB) return;
    if (this.#bbHandler) {
      try { BB.offClick(this.#bbHandler); } catch {}
      this.#bbHandler = null;
    }
    try { BB.hide(); } catch {}
  }

  // ---- утилиты ----
  static sendData(data) { try { window.Telegram?.WebApp?.sendData?.(data); } catch {} }
  static openInvoice(url, cb) { try { window.Telegram?.WebApp?.openInvoice?.(url, cb); } catch {} }
  static showAlert(t) { try { window.Telegram?.WebApp?.showAlert?.(t); } catch {} }
  static showConfirm(t) { try { return window.Telegram?.WebApp?.showConfirm?.(t); } catch {} return Promise.resolve(false); }
}

export default TelegramSDK;
