// Гарантированный переход в корзину: сначала дергаем роутер,
// а затем, если что-то не сработало, насильно рендерим корзину.

async function hardRenderCart() {
  try {
    // 1) HTML корзины
    const resp = await fetch("/pages/cart.html", { cache: "no-store" });
    const html = await resp.text();
    const cur = document.querySelector("#page-current");
    const next = document.querySelector("#page-next");
    if (next) next.style.display = "none";
    if (cur) cur.innerHTML = html;

    // 2) JS страницы корзины
    const mod = await import("./pages/cart.js");
    const CartPage = mod.default;
    const page = new CartPage();
    page.load(null);

    console.log("[persist-mb] hardRenderCart(): success");
  } catch (e) {
    console.error("[persist-mb] hardRenderCart(): failed", e);
  }
}

function toCart() {
  try { console.log("[persist-mb] toCart() start, hash:", location.hash); } catch {}

  // — обычные триггеры роутера —
  try { if (window.navigateTo) window.navigateTo("cart"); } catch {}
  try { if (location.hash !== "#/cart") location.hash = "#/cart"; } catch {}
  try { window.dispatchEvent(new HashChangeEvent("hashchange")); } catch {}
  try { typeof window.onhashchange === "function" && window.onhashchange(); } catch {}
  try {
    const url = location.pathname + "?dest=cart" + (location.hash || "");
    history.pushState({ dest: "cart" }, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  } catch {}
  try { window.handleLocation && window.handleLocation(); } catch {}

  // — бэкап: через 120мс насильно рисуем корзину —
  setTimeout(() => hardRenderCart(), 120);

  try { console.log("[persist-mb] toCart() forced"); } catch {}
}

function hook() {
  const W = (window.Telegram && window.Telegram.WebApp) || null;
  if (!W || !W.MainButton) return;

  try { W.MainButton.onClick(toCart); } catch {}
  try { typeof W.onEvent === "function" && W.onEvent("mainButtonClicked", toCart); } catch {}

  try { W.MainButton.enable(); } catch {}
  try { W.MainButton.show(); } catch {}

  try { console.log("[persist-mb] hook() attached"); } catch {}
}

window.addEventListener("load", function () {
  hook();
  setInterval(hook, 800); // если чей-то код снимает обработчик
});