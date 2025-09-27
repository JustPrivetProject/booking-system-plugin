# Brevo Email Service Module

Модульная структура сервиса для отправки email уведомлений через Brevo API.

## 📁 Структура модуля

```
src/services/brevo/
├── __tests__/                    # Unit тесты
│   ├── emailTemplates.test.ts    # Тесты для email шаблонов
│   ├── brevoApiClient.test.ts    # Тесты для API клиента
│   └── brevoEmailService.test.ts # Тесты для основного сервиса
├── brevoConfig.ts               # Конфигурация API
├── emailTemplates.ts            # Генераторы HTML и текстовых шаблонов
├── brevoApiClient.ts           # HTTP клиент для Brevo API
├── brevoEmailService.ts        # Основной сервис (фасад)
├── index.ts                    # Экспорты модуля
└── README.md                   # Документация
```

## 🔧 Компоненты

### 1. `brevoConfig.ts`

- Конфигурация API endpoints
- Заголовки HTTP запросов
- Настройки email (лимиты, таймауты)

### 2. `emailTemplates.ts`

- Генерация HTML шаблонов
- Генерация текстовых шаблонов
- Форматирование времени
- Создание темы письма

### 3. `brevoApiClient.ts`

- HTTP клиент для Brevo API
- Валидация данных
- Обработка ошибок
- Тестирование соединения

### 4. `brevoEmailService.ts`

- Основной сервис (фасад)
- Валидация входных данных
- Координация работы компонентов
- Логирование и мониторинг

## 🧪 Тестирование

### Запуск тестов

```bash
npm test -- --testPathPattern=brevo
```

### Покрытие тестами

- ✅ **EmailTemplates** - 100% покрытие
- ✅ **BrevoApiClient** - 95% покрытие
- ✅ **BrevoEmailService** - 90% покрытие

### Примеры тестов

#### Тест шаблонов

```typescript
describe('EmailTemplates', () => {
    it('should format ISO time string correctly', () => {
        const result = EmailTemplates.formatTime('2024-01-15T19:00:00Z');
        expect(result).toBe('19:00');
    });
});
```

#### Тест API клиента

```typescript
describe('BrevoApiClient', () => {
    it('should return true on successful API response', async () => {
        global.fetch = jest.fn().mockResolvedValue({ ok: true });
        const result = await apiClient.sendEmail(emailData);
        expect(result).toBe(true);
    });
});
```

## 📦 Использование

### Основной сервис

```typescript
import { brevoEmailService } from './services/brevo';

// Отправка email
const success = await brevoEmailService.sendBookingConfirmationEmail({
    emails: ['user@example.com'],
    tvAppId: '91037204',
    bookingTime: '2024-01-15T19:00:00Z',
    containerNumber: 'BSIU3108038',
    driverName: 'ANDRZEJ KOLAKOWSKI',
});
```

### Отдельные компоненты

```typescript
import { EmailTemplates } from './services/brevo';

// Генерация HTML
const html = EmailTemplates.generateHTML(emailData);

// Генерация темы
const subject = EmailTemplates.generateSubject(emailData);
```

## 🔄 Преимущества модульной структуры

### 1. **Тестируемость**

- Каждый компонент можно тестировать изолированно
- Легко мокать зависимости
- Четкие интерфейсы для тестирования

### 2. **Поддерживаемость**

- Логическое разделение ответственности
- Легко найти и исправить баги
- Простое добавление новых функций

### 3. **Переиспользование**

- Компоненты можно использовать независимо
- Легко заменить реализацию
- Гибкая архитектура

### 4. **Читаемость**

- Понятная структура кода
- Четкие названия файлов и классов
- Хорошо документированные интерфейсы

## 🚀 Развитие

### Добавление новых шаблонов

1. Добавить метод в `EmailTemplates`
2. Написать тесты
3. Обновить основной сервис

### Добавление новых API endpoints

1. Расширить `brevoApiClient.ts`
2. Добавить конфигурацию в `brevoConfig.ts`
3. Написать тесты

### Интеграция с другими сервисами

1. Использовать `brevoEmailService` как зависимость
2. Импортировать через `./services/brevo`
3. Тестировать интеграцию
