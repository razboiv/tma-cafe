// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { handleLocation, navigateTo } from "./routing/router.js";

// Делаем функции видимыми (удобно для отладки)
window.navigateTo = navigateTo;
window.handleLocation = handleLocation;

// 1) Г