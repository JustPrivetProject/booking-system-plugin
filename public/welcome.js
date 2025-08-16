class ImageSlider {
    constructor() {
        this.currentSlide = 0;
        this.totalSlides = 15;
        this.slider = document.getElementById('slider');
        this.prevBtn = document.getElementById('prevBtn');
        this.nextBtn = document.getElementById('nextBtn');
        this.currentSlideSpan = document.getElementById('currentSlide');
        this.totalSlidesSpan = document.getElementById('totalSlides');
        this.dotsContainer = document.getElementById('dots');
        this.modal = document.getElementById('modal');
        this.modalImage = document.getElementById('modalImage');
        this.closeModal = document.getElementById('closeModal');
        this.fullscreenBtn = document.getElementById('fullscreenBtn');

        this.init();
    }

    init() {
        this.createSlides();
        this.createDots();
        this.updateNavigation();
        this.bindEvents();
        this.showSlide(0);
    }

    createSlides() {
        for (let i = 1; i <= this.totalSlides; i++) {
            const slide = document.createElement('div');
            slide.className = 'slide';

            const img = document.createElement('img');
            img.src = `start/${i}.png`;
            img.alt = `Instrukcja strona ${i}`;
            img.loading = 'lazy';

            // Добавляем обработчик клика для открытия модального окна
            img.addEventListener('click', () => this.openModal());

            slide.appendChild(img);
            this.slider.appendChild(slide);
        }
    }

    createDots() {
        for (let i = 0; i < this.totalSlides; i++) {
            const dot = document.createElement('div');
            dot.className = 'dot';
            dot.addEventListener('click', () => this.showSlide(i));
            this.dotsContainer.appendChild(dot);
        }
    }

    showSlide(index) {
        // Скрываем все слайды
        const slides = this.slider.querySelectorAll('.slide');
        slides.forEach(slide => slide.classList.remove('active'));

        // Убираем активную точку
        const dots = this.dotsContainer.querySelectorAll('.dot');
        dots.forEach(dot => dot.classList.remove('active'));

        // Показываем нужный слайд и активируем точку
        if (slides[index]) {
            slides[index].classList.add('active');
        }
        if (dots[index]) {
            dots[index].classList.add('active');
        }

        this.currentSlide = index;
        this.updateNavigation();
    }

    nextSlide() {
        if (this.currentSlide < this.totalSlides - 1) {
            this.showSlide(this.currentSlide + 1);
        }
    }

    prevSlide() {
        if (this.currentSlide > 0) {
            this.showSlide(this.currentSlide - 1);
        }
    }

    updateNavigation() {
        this.currentSlideSpan.textContent = this.currentSlide + 1;
        this.totalSlidesSpan.textContent = this.totalSlides;

        // Обновляем состояние кнопок
        this.prevBtn.disabled = this.currentSlide === 0;
        this.nextBtn.disabled = this.currentSlide === this.totalSlides - 1;
    }

    openModal(slideIndex) {
        // Используем текущий активный слайд вместо переданного индекса
        const currentSlideNumber = this.currentSlide + 1;
        this.modalImage.src = `start/${currentSlideNumber}.png`;
        this.modalImage.alt = `Instrukcja strona ${currentSlideNumber}`;
        this.modal.style.display = 'block';
        document.body.style.overflow = 'hidden'; // Блокируем прокрутку
    }

    closeModalHandler() {
        this.modal.style.display = 'none';
        document.body.style.overflow = 'auto'; // Возвращаем прокрутку
    }

    toggleFullscreen() {
        if (!document.fullscreenElement) {
            this.modal.requestFullscreen().catch(err => {
                console.log('Ошибка перехода в полноэкранный режим:', err);
            });
        } else {
            document.exitFullscreen();
        }
    }

    bindEvents() {
        // Навигация
        this.prevBtn.addEventListener('click', () => this.prevSlide());
        this.nextBtn.addEventListener('click', () => this.nextSlide());

        // Модальное окно
        this.closeModal.addEventListener('click', () => this.closeModalHandler());
        this.fullscreenBtn.addEventListener('click', () => this.toggleFullscreen());

        // Закрытие модального окна по клику вне изображения
        this.modal.addEventListener('click', e => {
            if (e.target === this.modal) {
                this.closeModalHandler();
            }
        });

        // Управление с клавиатуры
        document.addEventListener('keydown', e => {
            if (this.modal.style.display === 'block') {
                // В модальном окне
                if (e.key === 'Escape') {
                    this.closeModalHandler();
                }
            } else {
                // В слайдере
                if (e.key === 'ArrowLeft') {
                    this.prevSlide();
                } else if (e.key === 'ArrowRight') {
                    this.nextSlide();
                }
            }
        });

        // Свайп для мобильных устройств
        let startX = 0;
        let endX = 0;

        this.slider.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
        });

        this.slider.addEventListener('touchend', e => {
            endX = e.changedTouches[0].clientX;
            this.handleSwipe();
        });

        // Добавляем обработчик для свайпа в модальном окне
        this.modal.addEventListener('touchstart', e => {
            startX = e.touches[0].clientX;
        });

        this.modal.addEventListener('touchend', e => {
            endX = e.changedTouches[0].clientX;
            this.handleSwipe();
        });
    }

    handleSwipe() {
        const swipeThreshold = 50;
        const diff = startX - endX;

        if (Math.abs(diff) > swipeThreshold) {
            if (diff > 0) {
                // Свайп влево - следующая картинка
                this.nextSlide();
            } else {
                // Свайп вправо - предыдущая картинка
                this.prevSlide();
            }
        }
    }
}

// Инициализация слайдера при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new ImageSlider();
});
