// frontend/js/telegram/telegram.js
// Мини-обёртка над Telegram.WebApp с корректной работой MainButton/BackButton.

export class TelegramSDK {
  static #readyDone = false;
  static #mainBtnHandler = null;
  static #backBtnHandler = null;

  // ---- базовые методы ----
  static ready() {
    const W = window.Telegram?.WebApp;
    if (!this.#readyDone && W) {
      try { W.ready(); } catch {}
      this.#readyDone = true;
    }
  }
  static expand() { try { window.Telegram?.WebApp?.expand(); } catch {} }
  static close() { try { window.Telegram?.WebApp?.close(); } catch {} }
  static getInitData() { return window.Telegram?.WebApp?.initData || ""; }

  // ---- MainButton (MY CART) ----
  static showMainButton(text, onClick) {
    const MB = window.Telegram?.WebApp?.MainButton;
    if (!MB) return;
    this.ready();

    try { MB.setText(text || "MY CART"); } catch {}
    try { MB.enable(); } catch {}
    try { MB.show(); } catch {}

    // снять старый обработчик, повесить новый
    if (this.#mainBtnHandler) {
      try { MB.offClick(this.#mainBtnHandler); } catch {}
    }
    this.#mainBtnHandler = () => { try { onClick?.(); } catch {} };
    try { MB.onClick(this.#mainBtnHandler); } catch {}
  }

  static hideMainButton() {
    const MB = window.Telegram?.WebApp?.MainButton;
    if (!MB) return;
    if (this.#mainBtnHandler) {
      try { MB.offClick(this.#mainBtnHandler); } catch {}
      this.#mainBtnHandler = null;
    }
    try { MB.hide(); } catch {}
  }

  // ---- BackButton ----
  static showBackButton(onClick) {
    const BB = window.Telegram?.WebApp?.BackButton;
    if (!BB) return;
    this.ready();
    try { BB.show(); } catch {}
    if (this.#backBtnHandler) {
      try { BB.offClick(this.#backBtnHandler); } catch {}
    }
    this.#backBtnHandler = () => { try { onClick?.(); } catch {} };
    try { BB.onClick(this.#backBtnHandler); } catch {}
  }

  static hideBackButton() {
    const BB = window.Telegram?.WebApp?.BackButton;
    if (!BB) return;
    if (this.#backBtnHandler) {
      try { BB.offClick(this.#backBtnHandler); } catch {}
      this.#backBtnHandler = null;
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
