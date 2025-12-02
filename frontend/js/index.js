// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { handleLocation } from "./routing/router.js";

TelegramSDK.ready();
TelegramSDK.expand();

// Загружаем роуты
handleLocation();
