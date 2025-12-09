// frontend/js/index.js
import TelegramSDK from "./telegram/telegram.js";
import { bootRouter, handleLocation } from "./routing/router.js";

// Telegram WebApp init
TelegramSDK.ready();
TelegramSDK.expand();

// Непосредственно API Telegram
const TG = window.Telegram?.WebApp;

// Системная кнопка «Назад» → обычный history.back()
TG?.BackButton?.onClick?.(() => history.back());

// Старт роутера
bootRouter();

// Реакция на смену хэша
window.addEventListener("hashchange", handleLocation);