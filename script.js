// ========================================
// CONFIGURACIÓN
// ========================================

pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');

const botonLeer = document.getElementById('leer-cuento');
const botonPausar = document.getElementById('pausar-cuento');
const botonReanudar = document.getElementById('reanudar-cuento');
const botonDetener = document.getElementById('detener-cuento');
const controlVolumen = document.getElementById('volumen-cuento');
const estadoAudio = document.getElementById('estado-audio');

let pageFlip = null;
let textosPaginas = [];
let paginaActual = 0;
let volumen = 1;

// ========================================
// CARGAR EL PDF AUTOMÁTICAMENTE
// ========================================

async function loadPDF() {
    loading.style.display = 'block';
    loading.textContent = 'Preparando tu cuento...';

    try {
        const respuesta = await fetch('./cuento-final.pdf');

        if (!respuesta.ok) {
            throw new Error('No se pudo encontrar el PDF.');
        }

        const datos = new Uint8Array(await respuesta.arrayBuffer());

        const pdf = await pdfjsLib.getDocument({
            data: datos
        }).promise;

        textosPaginas = [];

        const primeraPagina = await pdf.getPage(1);
        const escala = 1.2;
        const viewportInicial = primeraPagina.getViewport({ scale: escala });

        bookContainer.innerHTML = '';

        for (let numero = 1; numero <= pdf.numPages; numero++) {
            loading.textContent =
                `Preparando página ${numero} de ${pdf.numPages}...`;

            const pagina = await pdf.getPage(numero);

            const contenidoTexto = await pagina.getTextContent();

            const texto = contenidoTexto.items
                .filter(item => typeof item.str === 'string')
                .map(item => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

            textosPaginas.push(texto);

            const viewport = pagina.getViewport({ scale: escala });
            const canvas = document.createElement('canvas');
            const contexto = canvas.getContext('2d');

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await pagina.render({
                canvasContext: contexto,
                viewport: viewport
            }).promise;

            const hoja = document.createElement('div');
            hoja.className = 'page';
            hoja.appendChild(canvas);

            bookContainer.appendChild(hoja);
        }

        bookContainer.style.display = 'block';

        pageFlip = new St.PageFlip(bookContainer, {
            width: viewportInicial.width,
            height: viewportInicial.height,
            size: 'stretch',
            minWidth: 250,
            maxWidth: viewportInicial.width,
            minHeight: 350,
            maxHeight: viewportInicial.height,
            showCover: true,
            maxShadowOpacity: 0.5,
            usePortrait: true,
            mobileScrollSupport: true
        });

        pageFlip.loadFromHTML(
            bookContainer.querySelectorAll('.page')
        );

        pageFlip.on('flip', function(evento) {
            paginaActual = evento.data;

            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
            }

            mostrarEstado(
                `Página ${paginaActual + 1} de ${textosPaginas.length}.`
            );
        });

        loading.style.display = 'none';

        mostrarEstado(
            `Tu cuento está listo. Tiene ${pdf.numPages} páginas.`
        );

    } catch (error) {
        console.error(error);

        loading.textContent =
            'No se pudo abrir el cuento. Verificá que cuento-final.pdf esté en el repositorio.';
    }
}

// ========================================
// ESCUCHAR EL CUENTO
// ========================================

function leerPaginaActual() {
    if (!pageFlip || !textosPaginas.length) {
        mostrarEstado('Esperá a que termine de cargar el cuento.');
        return;
    }

    if (!('speechSynthesis' in window)) {
        mostrarEstado('Tu navegador no admite la lectura en voz alta.');
        return;
    }

    const texto = textosPaginas[paginaActual];

    if (!texto) {
        mostrarEstado('Esta página no contiene texto reconocible.');
        return;
    }

    window.speechSynthesis.cancel();

    const narracion = new SpeechSynthesisUtterance(texto);

    narracion.lang = 'es-UY';
    narracion.volume = volumen;
    narracion.rate = 0.9;
    narracion.pitch = 1;

    narracion.onstart = () => {
        mostrarEstado(`Escuchando la página ${paginaActual + 1}...`);
    };

    narracion.onend = () => {
        mostrarEstado(`Terminaste de escuchar la página ${paginaActual + 1}.`);
    };

    narracion.onerror = evento => {
        if (evento.error !== 'canceled' &&
            evento.error !== 'interrupted') {
            mostrarEstado('No se pudo reproducir la narración.');
        }
    };

    window.speechSynthesis.speak(narracion);
}

// ========================================
// BOTONES DE AUDIO
// ========================================

botonLeer.addEventListener('click', leerPaginaActual);

botonPausar.addEventListener('click', () => {
    if (window.speechSynthesis.speaking &&
        !window.speechSynthesis.paused) {
        window.speechSynthesis.pause();
        mostrarEstado('Narración pausada.');
    }
});

botonReanudar.addEventListener('click', () => {
    if (window.speechSynthesis.paused) {
        window.speechSynthesis.resume();
        mostrarEstado('Continuando la narración...');
    }
});

botonDetener.addEventListener('click', () => {
    window.speechSynthesis.cancel();
    mostrarEstado('Narración detenida.');
});

controlVolumen.addEventListener('input', function() {
    volumen = Number(this.value);
    mostrarEstado(
        `Volumen seleccionado: ${Math.round(volumen * 100)} %.`
    );
});

// ========================================
// MENSAJES
// ========================================

function mostrarEstado(mensaje) {
    estadoAudio.textContent = mensaje;
}

// ========================================
// INICIAR
// ========================================

loadPDF();
