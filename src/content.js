window.addEventListener('DOMContentLoaded', () => {
    // Получаем элемент с id="SlotsTileDetails"
    const targetNode = document.getElementById('SlotsTileDetails');
    
    // Если элемент найден
    if (targetNode) {
        // Создаем наблюдатель для отслеживания изменений в этом элементе
        const observer = new MutationObserver(() => {
            // Находим все кнопки внутри этого элемента с атрибутом disabled
            targetNode.querySelectorAll('button[disabled]').forEach(button => {
                button.removeAttribute('disabled');  // Убираем атрибут disabled
                button.classList.remove('disabled'); // Убираем класс disabled (если он есть)
                button.style.pointerEvents = 'auto';  // Разрешаем действия с кнопкой
            });
        });

        // Настроим наблюдение за добавлением новых дочерних элементов в #SlotsTileDetails
        observer.observe(targetNode, {
            childList: true,    // Следим за добавлением/удалением дочерних элементов
            subtree: true       // Следим за всеми вложенными элементами внутри #SlotsTileDetails
        });
    } else {
        console.log("Element #SlotsTileDetails not found");
    }
});