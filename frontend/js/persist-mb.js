/* frontend/js/persist-mb.js
   Держим MainButton «живым», но уважаем состояние страниц.
   НИЧЕГО не назначаем: ни текст, ни onClick. */

(function () {
  const W  = window.Telegram && window.Telegram.WebApp;
  if (!W) return;
  const MB = W.MainButton;

  function apply() {
    // страница сама выставляет document.body.dataset.mainbutton
    const mode = document.body?.dataset?.mainbutton || "";
    if (!mode) {
      try { MB.hide(); } catch {}
      return;
    }
    try { MB.enable(); } catch {}
    try { MB.show(); } catch {}
  }

  // держим кнопку «в тонусе», но без собственного onClick
  window.addEventListener("load", apply);
  window.addEventListener("hashchange", apply);
  setInterval(apply, 800);
})();