// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// Делаем роутер доступным глобально (нужно для внешнего хука)
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

// Старт приложения
TelegramSDK.ready();
TelegramSDK.expand();
handleLocation();