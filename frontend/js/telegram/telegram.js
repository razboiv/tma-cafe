// frontend/js/telegram/telegram.js
// Мини-обёртка над Telegram.WebApp с корректной работой MainButton/BackButton.

export class TelegramSDK {
  static #readyDone = false;
  static #mainBtnHandler = null;
  static #backBtnHandler = null;

  // ----- базовое -----
  static ready() {
    const W = window.Telegram?.WebApp;
    if (!this.#readyDone && W) {
      try { W.ready(); } catch {}
      this.#readyDone = true;
    }
  }

  static expand() {
    try { window.Telegram?.WebApp?.expand(); } catch {}
  }

  static close() {
    try { window.Telegram?.WebApp?.close(); } catch {}
  }

  static getInitData() {
    return window.Telegram?.WebApp?.initData || '';
  }

  // ----- MainButton (MY CART) -----
  static showMainButton(text, onClick) {
    const W = window.Telegram?.WebApp;
    if (!W || !W.MainButton) return;
    this.ready(); // на всякий случай

    const MB = W.MainButton;
    MB.setText(text || 'MY CART');
    MB.enable();
    MB.show();

    // Снимаем предыдущий обработчик и вешаем новый
    if (this.#mainBtnHandler) {
      try { MB.offClick(this.#mainBtnHandler); } catch {}
    }
    this.#mainBtnHandler = () => { try { onClick?.(); } catch {} };
    MB.onClick(this.#mainBtnHandler);
  }

  static hideMainButton() {
    const MB = window.Telegram?.WebApp?.MainButton;
    if (!MB) return;
    if (this.#mainBtnHandler) {
      try { MB.offClick(this.#mainBtnHandler); } catch {}
      this.#mainBtnHandler = null;
    }
    MB.hide();
  }

  // ----- BackButton -----
  static showBackButton(onClick) {
    const BB = window.Telegram?.WebApp?.BackButton;
    if (!BB) return;
    this.ready();
    BB.show();
    if (this.#backBtnHandler) {
      try { BB.offClick(this.#backBtnHandler); } catch {}
    }
    this.#backBtnHandler = () => { try { onClick?.(); } catch {} };
    BB.onClick(this.#backBtnHandler);
  }

  static hideBackButton() {
    const BB = window.Telegram?.WebApp?.BackButton;
    if (!BB) return;
    if (this.#backBtnHandler) {
      try { BB.offClick(this.#backBtnHandler); } catch {}
      this.#backBtnHandler = null;
    }
    BB.hide();
  }

  // ----- утилиты -----
  static sendData(data) {
    try { window.Telegram?.WebApp?.sendData?.(data); } catch {}
  }

  static openInvoice(url, callback) {
    try { window.Telegram?.WebApp?.openInvoice?.(url, callback); } catch {}
  }

  static showAlert(text) {
    try { window.Telegram?.WebApp?.showAlert?.(text); } catch {}
  }

  static showConfirm(text) {
    try { return window.Telegram?.WebApp?.showConfirm?.(text); } catch {}
    return Promise.resolve(false);
  }
}

export default TelegramSDK;
