/* frontend/js/routing/router.js
 * Универсальный роутер для Telegram WebApp.
 * Не делает предположений о названии экспортов страниц.
 */

const log = (...a) => console.log("[ROUTER]", ...a);

// ---- Карта маршрутов -> динамические импорты страниц ----
const ROUTES = {
  main:      () => import("../pages/main.js"),
  category:  () => import("../pages/category.js"),
  details:   () => import("../pages/details.js"),
  // при необходимости можно добавить cart: () => import("../pages/cart.js"),
};

// ---- утилиты для поиска «класса/экземпляра страницы» в модуле ----
function pickPageCtorOrInstance(mod, wantedName) {
  if (!mod) return null;

  // 1) самый частый случай — default
  if (mod.default) return mod.default;

  // 2) типичные именованные варианты
  const candidatesByName = [
    "Page",
    "MainPage",
    "CategoryPage",
    "DetailsPage",
    wantedName && (wantedName[0].toUpperCase() + wantedName.slice(1) + "Page"),
  ].filter(Boolean);

  for (const k of candidatesByName) {
    if (mod[k]) return mod[k];
  }

  // 3) fallback — первая функция из экспортов
  const anyFn = Object.values(mod).find(v => typeof v === "function");
  if (anyFn) return anyFn;

  // 4) крайний случай — если экспортирован объект со .load
  const anyObjWithLoad = Object.values(mod).find(
    v => v && typeof v === "object" && typeof v.load === "function"
  );
  if (anyObjWithLoad) return anyObjWithLoad;

  return null;
}

function asInstance(value) {
  try {
    // если это класс/функция-конструктор — создать экземпляр
    if (typeof value === "function") {
      // если у прототипа есть load/unload — это «страничный класс»
      if (value.prototype && (value.prototype.load || value.prototype.unload)) {
        return new value();
      }
      // а вдруг это фабрика, возвращающая объект страницы
      const produced = value();
      if (produced) return produced;
    }
    // если это уже объект — вернуть как есть
    if (value && typeof value === "object") return value;
  } catch (_) {}
  return null;
}

// ---- Router ----
class Router {
  constructor(startRoute = "main") {
    this.history = [];
    this.current = null;
    this.startRoute = startRoute;

    this._onBack = this._onBack.bind(this);
    this._tg = (typeof window !== "undefined" && window.Telegram && window.Telegram.WebApp) || null;

    if (this._tg) {
      // слушаем аппаратную back-кнопку
      this._tg.onEvent("back_button_pressed", this._onBack);
      this._tg.BackButton.hide(); // спрячем — будем сами показывать когда есть куда вернуться
    }
  }

  async start(params = null) {
    log("v13 loaded");
    await this.go(this.startRoute, params, { replace: true });
  }

  async go(name, params = null, { replace = false } = {}) {
    const loader = ROUTES[name] || ROUTES.main;
    const mod = await loader();

    const exported = pickPageCtorOrInstance(mod, name);
    if (!exported) {
      throw new Error(`[ROUTER] Cannot resolve page class from module (${name})`);
    }

    const page = asInstance(exported) || exported; // на случай, если это объект с .load
    // выгрузим предыдущую страницу
    if (this.current && this.current.instance && typeof this.current.instance.unload === "function") {
      try { await this.current.instance.unload(); } catch (_) {}
    }

    this.current = { name, instance: page, params };
    // обновим историю
    if (replace && this.history.length) {
      this.history[this.history.length - 1] = { name, params };
    } else if (!replace) {
      this.history.push({ name, params });
    } else {
      this.history = [{ name, params }];
    }

    // показать back кнопку, если есть куда вернуться
    if (this._tg) {
      if (this.history.length > 1) this._tg.BackButton.show();
      else this._tg.BackButton.hide();
    }

    // вызовем загрузку страницы
    if (page && typeof page.load === "function") {
      await page.load(params ?? null);
    }

    // плавная анимация (чуть-чуть «дышим» после рендера)
    requestAnimationFrame(() => {
      document.documentElement.style.scrollBehavior = "smooth";
      setTimeout(() => (document.documentElement.style.scrollBehavior = ""), 120);
    });
  }

  async back() {
    if (this.history.length <= 1) return; // некуда
    // снимаем верхнюю
    this.history.pop();
    const prev = this.history[this.history.length - 1];
    await this.go(prev.name, prev.params, { replace: true });
  }

  async _onBack() {
    await this.back();
  }

  destroy() {
    if (this._tg) {
      try {
        this._tg.offEvent("back_button_pressed", this._onBack);
        this._tg.BackButton.hide();
      } catch (_) {}
    }
  }
}

let _router = null;

// ---- Публичный API (как у тебя в проекте) ----
export function navigateTo(name, params = null) {
  if (_router) return _router.go(name, params);
}

export function goBack() {
  if (_router) return _router.back();
}

export function bootRouter(start = "main", params = null) {
  if (_router) _router.destroy();
  _router = new Router(start);
  return _router.start(params);
}

// Совместимость со старым index.js, который ожидает handleLocation()
export function handleLocation() {
  return bootRouter();
}

// На всякий случай экспортируем Router (может пригодиться)
export { Router };