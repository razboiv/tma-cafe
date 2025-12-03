// frontend/js/persist-mb.js
// Гарантированный клик по Telegram MainButton ("MY CART") + детальные логи

function goCart() {
  console.log('[persist-mb] goCart()');
  // временно показываем алерт, чтобы убедиться что клик дошёл
  try { window.Telegram?.WebApp?.showAlert('Opening cart…'); } catch(e) {}

  if (window.navigateTo) {
    window.navigateTo("cart");
  } else {
    location.hash = "#/cart";
    if (window.handleLocation) window.handleLocation();
  }
}

function hook() {
  var W = (window.Telegram && window.Telegram.WebApp) || null;
  if (!W || !W.MainButton) {
    console.log('[persist-mb] no WebApp/MainButton yet');
    return;
  }

  try { W.MainButton.onClick(goCart); } catch (e) {}
  try { if (typeof W.onEvent === "function") W.onEvent("mainButtonClicked", goCart); } catch (e) {}

  try { W.MainButton.enable(); } catch (e) {}
  try { W.MainButton.show(); } catch (e) {}

  console.log('[persist-mb] hook() attached');
}

// После загрузки навешиваем и периодически «переподвешиваем»
window.addEventListener("load", function () {
  console.log('[persist-mb] window load');
  hook();
  setInterval(hook, 800);
});