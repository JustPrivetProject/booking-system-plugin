# Container Checker — Чеклист проверки миграции

Миграция с standalone расширения **container-checker-main** в **plugin_brama** (Booking System Plugin).

---

## 1. Backend / Core Logic

### 1.1 Проверка портов (DCT, BCT, GCT)

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 1.1.1 | DCT: baltichub.com | `checkDct()` в ports.js | `checkDct()` в portCheckers.ts | ☐ |
| 1.1.2 | BCT: ebrama.bct.ictsi.com | `checkBct()` с token | `checkBct()` с token | ☐ |
| 1.1.3 | GCT: terminal.gct.pl | `checkGct()` с PRADO_PAGESTATE | `checkGct()` с PRADO_PAGESTATE | ☐ |
| 1.1.4 | SUPPORTED_PORTS | `["DCT", "BCT", "GCT"]` | `['DCT', 'BCT', 'GCT']` | ☐ |
| 1.1.5 | Парсинг полей (Stops, T-State, Time In/Out) | parseDctFields, parseBctModalFields, parseGctRow | Идентичная логика | ☐ |
| 1.1.6 | Фильтрация шума (isNonInformativePortStatus) | hasImageRetrievalNoise, hasTechnicalErrorNoise | Идентичная логика | ☐ |
| 1.1.7 | toMilestone() | GATE_OUT, IN_TERMINAL, DISCHARGED, CUSTOMS, OTHER | Идентичная логика | ☐ |
| 1.1.8 | fetchWithRetry | 3 попытки для BCT, retry при transient errors | Идентичная логика | ☐ |

### 1.2 Состояние и хранилище

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 1.2.1 | Ключи storage | `watchlist`, `settings`, `lastRunAt` | `containerCheckerWatchlist`, `containerCheckerSettings`, `containerCheckerLastRunAt` | ☐ |
| 1.2.2 | Структура watchlist item | containerNumber, port, status, state, statusChanged, stateChanged, hasErrors, errors, lastNotifiedSignature, lastUpdate, lastChangeAt, lastCheckedAt, snapshot | Идентичная | ☐ |
| 1.2.3 | normalizeWatchItem | Нормализация port (DCT по умолчанию) | Идентичная | ☐ |
| 1.2.4 | getNormalizedState | Нормализация + сохранение при изменении | getNormalizedContainerCheckerState | ☐ |

### 1.3 Цикл проверки (evaluateContainer)

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 1.3.1 | Контейнер не найден (best=null) | status/state="-", statusChanged/stateChanged по previous | Идентичная логика | ☐ |
| 1.3.2 | Ошибки при проверке | hasErrors=true, errors[] | Идентичная | ☐ |
| 1.3.3 | statusSignature | port\|statusText\|stateText\|milestone | Идентичная | ☐ |
| 1.3.4 | Условие уведомления | changed && settings.recipientEmail && brevoApiKey && lastNotifiedSignature !== current | changed && lastNotifiedSignature !== current (настройки в notificationService) | ☐ |
| 1.3.5 | runCheckCycle / runContainerCheckCycle | Цикл по watchlist, saveWatchlist, touchLastRunAt | Идентичная логика | ☐ |
| 1.3.6 | acknowledgeUiChanges | Сброс statusChanged/stateChanged | acknowledgeContainerCheckerUiChanges | ☐ |

### 1.4 Alarm (планировщик)

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 1.4.1 | Имя alarm | `container-check` | `container-check` | ☐ |
| 1.4.2 | Инициализация | onInstalled, onStartup | onInstalled, initContainerChecker | ☐ |
| 1.4.3 | periodInMinutes | Из settings.pollingMinutes | Из settings.pollingMinutes | ☐ |
| 1.4.4 | Дефолт polling | 5 мин | 10 мин | ☐ |

---

## 2. Message API

| # | Сообщение | Старая реализация | Новая реализация | Статус |
|---|-----------|-------------------|------------------|--------|
| 2.1 | GET_STATE | `{ type: "GET_STATE" }` | `{ target: "containerChecker", type: "GET_STATE" }` | ☐ |
| 2.2 | ACK_UI_CHANGES | `{ type: "ACK_UI_CHANGES" }` | `{ target: "containerChecker", type: "ACK_UI_CHANGES" }` | ☐ |
| 2.3 | ADD_CONTAINER | `{ type: "ADD_CONTAINER", containerNumber, port }` | `{ target: "containerChecker", type: "ADD_CONTAINER", containerNumber, port }` | ☐ |
| 2.4 | REMOVE_CONTAINER | `{ type: "REMOVE_CONTAINER", containerNumber, port }` | `{ target: "containerChecker", type: "REMOVE_CONTAINER", containerNumber, port }` | ☐ |
| 2.5 | CHECK_NOW | `{ type: "CHECK_NOW" }` | `{ target: "containerChecker", type: "CHECK_NOW" }` | ☐ |
| 2.6 | SAVE_SETTINGS | `{ type: "SAVE_SETTINGS", settings: { pollingMinutes, recipientEmail, brevoSenderEmail, brevoApiKey } }` | `{ target: "containerChecker", type: "SAVE_SETTINGS", settings: { pollingMinutes } }` | ☐ |
| 2.7 | Формат ответа | `{ ok: true, result }` / `{ ok: false, error }` | Идентичный | ☐ |

---

## 3. Уведомления (Email + Windows)

### 3.1 Email (Brevo)

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 3.1.1 | Источник API key | settings.brevoApiKey (ввод в popup) | BREVO_CONFIG.API_KEY (общий для плагина) | ☐ |
| 3.1.2 | Получатель | settings.recipientEmail | notificationSettingsService.getUserEmailForNotifications() | ☐ |
| 3.1.3 | Отправитель | settings.brevoSenderEmail | BREVO_CONFIG (общий) | ☐ |
| 3.1.4 | Subject | `[Container Checker] ${containerNumber}: ${prev} -> ${curr}` | Идентичный | ☐ |
| 3.1.5 | Тело письма | Container, Port, Milestone, Status, State, Data timestamp | Идентичное | ☐ |
| 3.1.6 | Условие отправки | recipientEmail && brevoApiKey && brevoSenderEmail | isEmailNotificationEnabled && emailAddresses.length | ☐ |

### 3.2 Windows (Chrome notifications)

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 3.2.1 | Заголовок | "Container status changed" | "Container status changed" | ☐ |
| 3.2.2 | Сообщение | `${containerNumber} (${port}): ${statusText}` | Идентичное | ☐ |
| 3.2.3 | Иконка | icons/icon128.png | ./icon-144x144.png | ☐ |
| 3.2.4 | Условие показа | Всегда при shouldNotify | isWindowsNotificationEnabled | ☐ |

---

## 4. Popup UI

### 4.1 Общая структура

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 4.1.1 | Режим отображения | Отдельный popup | Вкладка "Container Checker" в popup плагина | ☐ |
| 4.1.2 | Доступ | Без авторизации | Требуется авторизация (общий popup) | ☐ |

### 4.2 Элементы управления

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 4.2.1 | Ввод контейнеров | textarea, несколько через запятую/новую строку | textarea, несколько через запятую/новую строку | ☐ |
| 4.2.2 | Выбор порта | select DCT/BCT/GCT | select DCT/BCT/GCT | ☐ |
| 4.2.3 | Кнопка "Добавить" | Add | Dodaj | ☐ |
| 4.2.4 | Кнопка "Проверить сейчас" | Check all now | Sprawdź teraz | ☐ |
| 4.2.5 | Polling | input number, "Check every X min" | input number, "Co X min" | ☐ |
| 4.2.6 | Auto-resize textarea | Есть (до 6 строк) | Не проверено | ☐ |
| 4.2.7 | Ctrl+Enter для добавления | Есть | Есть | ☐ |

### 4.3 Таблица watchlist

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 4.3.1 | Колонки | Container, Port, Status, State, Last update, Last change, Delete | Kontener, Port, Status, Stan, Ostatnia zmiana, Actions | ☐ |
| 4.3.2 | Колонка "Last update" | Есть (formatLastUpdateCell) | **Отсутствует** | ☐ |
| 4.3.3 | Подсветка изменений | changed-cell для status/state | changed-cell | ☐ |
| 4.3.4 | Индикатор ошибок | ! с tooltip errors | ! с tooltip errors | ☐ |
| 4.3.5 | Кнопка удаления | 🗑️ | delete icon (Material Icons) | ☐ |
| 4.3.6 | Пустое состояние | — | "Dodaj kontenery do śledzenia" | ☐ |
| 4.3.7 | Tooltip при обрезке текста | setTooltipWhenTruncated, applyTruncationTooltips | Не проверено | ☐ |

### 4.4 Настройки (Settings)

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 4.4.1 | Панель Settings | Отдельная секция в popup (recipientEmail, brevoSenderEmail, brevoApiKey) | **Отсутствует в Container Checker** | ☐ |
| 4.4.2 | Brevo настройки | В popup Container Checker | В общих "Powiadomienia" плагина | ☐ |
| 4.4.3 | Polling | В основной области + change → save | В основной области + change → save | ☐ |

### 4.5 Status bar

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 4.5.1 | Текст | "Tracking X container(s) \| Last run: ..." | "Śledzonych: X \| Ostatnie: ..." | ☐ |
| 4.5.2 | Ошибки | "Error: ..." в statusBar | "Błąd: ..." в statusBar | ☐ |

### 4.6 Синхронизация

| # | Функционал | Старая реализация | Новая реализация | Статус |
|---|------------|-------------------|------------------|--------|
| 4.6.1 | chrome.storage.onChanged | watchlist, lastRunAt, settings | containerCheckerWatchlist, containerCheckerLastRunAt, containerCheckerSettings | ☐ |

---

## 5. Permissions и host_permissions

| # | Ресурс | Старая реализация | Новая реализация | Статус |
|---|---------|-------------------|------------------|--------|
| 5.1 | storage | ✓ | ✓ | ☐ |
| 5.2 | alarms | ✓ | ✓ | ☐ |
| 5.3 | notifications | ✓ | ✓ | ☐ |
| 5.4 | baltichub.com | ✓ | ✓ | ☐ |
| 5.5 | ebrama.bct.ictsi.com | ✓ | ✓ | ☐ |
| 5.6 | terminal.gct.pl | ✓ | ✓ | ☐ |
| 5.7 | api.brevo.com | ✓ | ✓ | ☐ |

---

## 6. Edge cases и регрессии

| # | Сценарий | Ожидание | Статус |
|---|----------|----------|--------|
| 6.1 | Добавление дубликата (container+port) | Игнорировать, вернуть state | ☐ |
| 6.2 | ADD_CONTAINER без containerNumber | Error: "Container number is required" | ☐ |
| 6.3 | ADD_CONTAINER без port | Error: "Port is required" | ☐ |
| 6.4 | Неподдерживаемый port | Error: "Unsupported port" | ☐ |
| 6.5 | Контейнер не найден на порту | status/state="-", без ошибки | ☐ |
| 6.6 | Сетевые ошибки при проверке | hasErrors=true, errors[] | ☐ |
| 6.7 | Миграция данных | Старые ключи watchlist/settings не переносятся автоматически | ☐ |

---

## 7. Известные отличия (не баги)

| Отличие | Старое | Новое |
|---------|--------|-------|
| Дефолт polling | 5 мин | 10 мин |
| Brevo API key | Свой у каждого пользователя (в popup) | Общий (BREVO_CONFIG) |
| Email получатель | recipientEmail в настройках CC | userEmail из notification settings |
| Колонка "Last update" | Есть | Нет |
| Язык UI | EN | PL |
| Авторизация | Не требуется | Требуется (общий popup) |

---

## 8. Рекомендуемые тесты

1. **DCT**: Добавить контейнер CMAU0671976, порт DCT → проверить Status/State.
2. **BCT**: Добавить MEDU3721493, порт BCT → проверить.
3. **GCT**: Добавить HLBU3980330, порт GCT → проверить.
4. **Проверка сейчас**: Нажать "Sprawdź teraz" → обновление таблицы.
5. **Polling**: Установить 1 мин → дождаться срабатывания alarm.
6. **Уведомления**: Включить email + windows в Powiadomienia → дождаться изменения статуса контейнера.
7. **Удаление**: Удалить контейнер из списка.
8. **Множественное добавление**: Ввести "A,B,C" или несколько строк → добавить.

---

*Документ создан для верификации миграции Container Checker из container-checker-main в plugin_brama.*
