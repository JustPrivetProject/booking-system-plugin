pdfjsLib.GlobalWorkerOptions.workerSrc = 'pdf.worker.min.js';

const pdfPath = 'Port Sloty instrukcja.pdf';

pdfjsLib.getDocument(pdfPath).promise.then(pdf => {
    const pdfContainer = document.getElementById('pdf-container');

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        pdf.getPage(pageNum).then(page => {
            const scale = 3;
            const viewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            canvas.className = 'pdf-canvas';
            const context = canvas.getContext('2d');

            const outputScale = window.devicePixelRatio || 1;
            canvas.width = Math.floor(viewport.width * outputScale);
            canvas.height = Math.floor(viewport.height * outputScale);
            canvas.style.width = Math.floor(viewport.width) + 'px';
            canvas.style.height = Math.floor(viewport.height) + 'px';

            const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;

            pdfContainer.appendChild(canvas);

            page.render({
                canvasContext: context,
                viewport: viewport,
                transform: transform
            });
        });
    }
}).catch(console.error);
