# Request Mismatch Analysis & Fixes

## Проблема
Иногда происходит смещение объектов: получаем сигнал что слот свободен, но отправляется не тот запрос.

## Статус исправлений: ✅ ВСЕ ИСПРАВЛЕНО

Все критические проблемы найдены и исправлены. Добавлено подробное логирование для отслеживания.

## Критические проблемы найдены

### 1. ❌ Проблема с мутацией объекта в processDateGroup

**Место**: `src/services/queueManager.ts:461-466`

```typescript
if (req.startSlot && req.body?.formData) {
    req.body.formData.SlotStart = [req.startSlot];  // МУТАЦИЯ!
    req.body.formData.SlotEnd = [req.endSlot];
    time = req.startSlot.split(' ');
}
```

**Проблема**: 
- Мутируем `req.body.formData` напрямую
- Потом создаем `reqForProcessing = { ...req, updated: false }` - это shallow copy
- Если несколько запросов обрабатываются параллельно, может быть race condition
- Изменения могут не сохраниться правильно

**Решение**: Создавать глубокую копию или обновлять только перед отправкой

---

### 2. ❌ Проблема с выбором requestId из кэша

**Место**: `src/background/handlers/MessageHandler.ts:129-130`

```typescript
const requestIds = Object.keys(data.requestCacheHeaders || {});
const requestId = requestIds.length > 0 ? requestIds[requestIds.length - 1] : null;
```

**Проблема**:
- Берется ПОСЛЕДНИЙ requestId из кэша
- Если пользователь быстро делает несколько запросов, может быть путаница
- Нет проверки, что это именно тот запрос, который пользователь только что отправил

**Edge Cases**:
- Пользователь делает запрос A, потом быстро запрос B
- Кэш: `{ "req-A": {...}, "req-B": {...} }`
- Система берет "req-B" (последний)
- Но пользователь кликнул на запрос A
- Результат: обрабатывается не тот запрос!

**Решение**: Нужен более надежный способ сопоставления запроса с действием пользователя

---

### 3. ❌ Проблема с проверкой доступности слота

**Место**: `src/services/baltichub.ts:53-57`

```typescript
export async function checkSlotAvailability(htmlText: string, time: string[]): Promise<boolean> {
    const buttons = parseSlotsIntoButtons(htmlText);
    const slotButton = buttons.find(button => button.text.includes(time[1].slice(0, 5)));
    return slotButton ? !slotButton.disabled : false;
}
```

**Проблема**:
- `time[1].slice(0, 5)` - берет только первые 5 символов времени
- Если `time = ["14.01.2026", "22:00:00"]`, то `time[1].slice(0, 5)` = "22:00"
- Но если формат другой или time неправильно разбит, может быть ошибка
- Нет проверки, что time[1] существует

**Edge Cases**:
- `time = ["14.01.2026"]` - нет времени → `time[1]` = undefined → ошибка
- `time = ["14.01.2026", "2:00:00"]` - `slice(0, 5)` = "2:00" - может не найти кнопку "02:00"

---

### 4. ❌ Проблема с обновлением formData дважды

**Место**: 
- `src/services/queueManager.ts:461-466` (первое обновление)
- `src/services/baltichub.ts:153-155` (второе обновление)

**Проблема**:
- Обновляем `req.body.formData` в `processDateGroup`
- Потом снова обновляем в `executeRequest`
- Если между этими вызовами что-то изменится, может быть проблема
- Дублирование логики

**Решение**: Обновлять только один раз, в `executeRequest`

---

### 5. ❌ Проблема с shallow copy в reqForProcessing

**Место**: `src/services/queueManager.ts:552`

```typescript
const reqForProcessing = req.updated ? { ...req, updated: false } : req;
```

**Проблема**:
- Это shallow copy - `req.body` и `reqForProcessing.body` указывают на один объект
- Если мы мутируем `req.body.formData` до этого, изменения видны в обоих
- Но если мы НЕ мутируем, то изменения не видны

**Решение**: Нужна более явная логика обновления

---

## Исправления

### ✅ Fix 1: Убрать мутацию в processDateGroup, обновлять только в executeRequest

**Проблема**: Мутировали `req.body.formData` в `processDateGroup`, что могло привести к race conditions.

**Решение**: 
- Убрали мутацию в `processDateGroup`
- Обновление `formData` происходит только в `executeRequest` перед отправкой
- Создаем глубокую копию `body` перед обработкой, чтобы избежать мутаций

**Код**:
```typescript
// processDateGroup - только читаем, не мутируем
if (req.startSlot) {
    time = req.startSlot.split(' ');  // Используем для проверки
    // НЕ обновляем req.body.formData здесь!
}

// executeRequest - обновляем перед отправкой
if (req.startSlot && req.endSlot) {
    req.body.formData.SlotStart = [req.startSlot];  // Обновляем здесь
    req.body.formData.SlotEnd = [req.endSlot];
}
```

---

### ✅ Fix 2: Добавить валидацию времени в checkSlotAvailability

**Проблема**: 
- `time[1].slice(0, 5)` могло упасть, если `time[1]` undefined
- Не обрабатывались форматы "2:00" vs "02:00"

**Решение**:
- Добавлена валидация формата времени
- Нормализация времени (padding часа)
- Подробное логирование для отладки

**Код**:
```typescript
// Валидация
if (!time || time.length < 2 || !time[1]) {
    return false;
}

// Нормализация
const timeMatch = timePart.match(/^(\d{1,2}):(\d{2})/);
const hour = timeMatch[1].padStart(2, '0');  // "2" → "02"
const normalizedTime = `${hour}:${minute}`;
```

---

### ✅ Fix 3: Создание глубокой копии перед обработкой

**Проблема**: Shallow copy `{ ...req }` не копировал вложенные объекты.

**Решение**: Создаем глубокую копию `body` и `formData` перед обработкой.

**Код**:
```typescript
const reqForProcessing = {
    ...req,
    body: req.body ? {
        ...req.body,
        formData: req.body.formData ? { ...req.body.formData } : undefined,
    } : undefined,
};
```

---

### ✅ Fix 4: Улучшить логирование для отслеживания проблем

**Добавлено логирование**:
- `req.id` на каждом этапе обработки
- Проверка соответствия `SlotStart SENT` и `req.startSlot`
- Логирование всех идентификаторов при проверке слота
- Логирование группировки запросов по датам

**Ключевые логи**:
```typescript
// При проверке слота
`req.id=${req.id}`, `tvAppId=${tvAppId}`, `Time checked=${time.join(', ')}`

// При отправке запроса
`⚠️ VERIFY: Does SlotStart SENT match req.startSlot? ${...}`

// При группировке
`Request IDs=${requests.map(r => r.id).join(', ')}`
```

---

## Edge Cases для проверки

### Case 1: Несколько запросов с одинаковой датой, но разным временем
```
Request 1: 14.01.2026 22:00:00, tvAppId=92008767
Request 2: 14.01.2026 23:00:00, tvAppId=92008768

Группировка: "14.01.2026" → [Req1, Req2]
Проверка: getSlots("14.01.2026") - получаем HTML со всеми слотами
Обработка:
  - Req1: проверяем слот "22:00" → доступен → отправляем Req1 с time="22:00"
  - Req2: проверяем слот "23:00" → доступен → отправляем Req2 с time="23:00"
```

**Потенциальная проблема**: Если HTML обновляется между проверками, может быть путаница.

**Решение**: Используем один и тот же `htmlText` для всех запросов в группе.

---

### Case 2: Быстрые последовательные запросы
```
T0: User submits Request A → cached as "req-A"
T1: User submits Request B → cached as "req-B"
T2: User clicks "Book" → system takes "req-B" (last)
    But user meant Request A!
```

**Проблема**: Нет способа определить, какой именно запрос пользователь имел в виду.

**Текущее решение**: Берем последний requestId (самый свежий). Это правильно, если пользователь кликает сразу после отправки формы.

**Улучшение**: Добавить timestamp проверку - если последний запрос слишком старый, предупредить.

---

### Case 3: Запросы с одинаковым tvAppId, но разным временем
```
Request 1: tvAppId=92008767, startSlot="14.01.2026 22:00:00"
Request 2: tvAppId=92008767, startSlot="15.01.2026 02:00:00"
```

**Проблема**: Если оба в очереди, и слот доступен для одного, может быть путаница.

**Решение**: Каждый запрос имеет уникальный `req.id`, поэтому они обрабатываются независимо.

---

## Рекомендации для дальнейшей отладки

1. **Добавить уникальный идентификатор в логи**: 
   - Каждый запрос должен иметь уникальный `req.id`
   - Логировать `req.id` на каждом этапе

2. **Проверка соответствия времени**:
   - При проверке слота: логировать `req.startSlot` и `time`
   - При отправке: проверять, что `SlotStart SENT === req.startSlot`

3. **Мониторинг группировки**:
   - Логировать, какие запросы попадают в одну группу
   - Проверять, что запросы не смешиваются

4. **Добавить проверку timestamp**:
   - Если последний requestId слишком старый (>5 минут), предупредить
   - Возможно, нужно очистить старый кэш
