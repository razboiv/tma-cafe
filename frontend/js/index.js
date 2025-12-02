// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// Сделаем роутер доступным глобально (нужно для хука из index.html)
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

// Старт приложения
TelegramSDK.ready();
TelegramSDK.expand();
handleLocation();