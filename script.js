// ========================================
// CONFIGURACIÓN DE PDF.JS
// ========================================

pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

const uploadInput = document.getElementById('pdf-upload');
const bookContainer = document.getElementById('flip-book');
const loading = document.getElementById('loading');

// Controles de audio
const botonLeer = document.getElementById('leer-cuento');
const botonPausar = document.getElementById('pausar-cuento');
const botonReanudar = document.getElementById('reanudar-cuento');
const botonDetener = document.getElementById('detener-cuento');
const controlVolumen = document.getElementById('volumen-cuento');
const estadoAudio = document.getElementById('estado-audio');

// Variables del libro
let pageFlip = null;
let textosPaginas = [];
let paginaActual = 0;
let volumen = 1;
let leyendo = false;


// ========================================
// CARGAR EL PDF
// ========================================

uploadInput.addEventListener('change', function (e) {
    const file = e.target.files[0];

    if (!file || file.type !== 'application/pdf') {
        mostrarEstado('Seleccioná un archivo PDF válido.');
        return;
    }

    const fileReader = new FileReader();

    fileReader.onload = function () {
        const typedarray = new Uint8Array(this.result);
        loadPDF(typedarray);
    };

    fileReader.onerror = function () {
        mostrarEstado('No se pudo leer el archivo seleccionado.');
    };

    fileReader.readAsArrayBuffer(file);
});


// ========================================
// PROCESAR EL PDF Y CREAR EL LIBRO
// ========================================

async function loadPDF(pdfData) {
    loading.style.display = 'block';
    loading.textContent = 'Preparando tu cuento...';

    bookContainer.style.display = 'none';
    bookContainer.innerHTML = '';

    detenerLectura(false);

    textosPaginas = [];
    paginaActual = 0;

    if (pageFlip) {
        pageFlip.destroy();
        pageFlip = null;
    }

    try {
        const pdf = await pdfjsLib.getDocument({
            data: pdfData
        }).promise;

        const totalPaginas = pdf.numPages;

        const primeraPagina = await pdf.getPage(1);

        const escala = 1.2;

        const primerViewport = primeraPagina.getViewport({
            scale: escala
        });

        const anchoPagina = primerViewport.width;
        const altoPagina = primerViewport.height;

        // Procesar las páginas una por una
        for (let numero = 1; numero <= totalPaginas; numero++) {

            loading.textContent =
                `Preparando página ${numero} de ${totalPaginas}...`;

            const pagina = await pdf.getPage(numero);

            // Extraer el texto de la página
            const contenidoTexto = await pagina.getTextContent();

            const textoPagina = contenidoTexto.items
                .filter(item => typeof item.str === 'string')
                .map(item => item.str)
                .join(' ')
                .replace(/\s+/g, ' ')
                .trim();

            textosPaginas.push(textoPagina);

            // Dibujar la página del PDF
            const viewport = pagina.getViewport({
                scale: escala
            });

            const canvas = document.createElement('canvas');
            const contexto = canvas.getContext('2d');

            canvas.width = viewport.width;
            canvas.height = viewport.height;

            await pagina.render({
                canvasContext: contexto,
                viewport: viewport
            }).promise;

            // Crear la hoja del libro
            const paginaDiv = document.createElement('div');

            paginaDiv.className = 'page';
            paginaDiv.appendChild(canvas);

            bookContainer.appendChild(paginaDiv);
        }

        // Crear el libro con efecto de pasar páginas
        bookContainer.style.display = 'block';

        pageFlip = new St.PageFlip(bookContainer, {
            width: anchoPagina,
            height: altoPagina,

            size: 'stretch',

            minWidth: 250,
            maxWidth: anchoPagina,

            minHeight: 350,
            maxHeight: altoPagina,

            showCover: true,
            maxShadowOpacity: 0.5,
            usePortrait: true,
            mobileScrollSupport: true
        });

        const paginasHTML =
            bookContainer.querySelectorAll('.page');

        pageFlip.loadFromHTML(paginasHTML);

        // Detectar cuando el lector cambia de página
        pageFlip.on('flip', function (evento) {
            paginaActual = evento.data;

            // Si estaba leyendo, detener la voz anterior.
            detenerLectura(false);

            mostrarEstado(
                `Página ${paginaActual + 1} de ${textosPaginas.length}. ` +
                'Presioná Escuchar para oír esta página.'
            );
        });

        loading.style.display = 'none';

        mostrarEstado(
            `Tu cuento está listo. Tiene ${totalPaginas} páginas.`
        );

    } catch (error) {
        console.error('Error al cargar el PDF:', error);

        loading.textContent =
            'No se pudo cargar el cuento. Comprobá que el PDF sea válido.';

        loading.style.display = 'block';
    }
}


// ========================================
// LEER LA PÁGINA ACTUAL EN VOZ ALTA
// ========================================

function leerPaginaActual() {

    if (!pageFlip || textosPaginas.length === 0) {
        mostrarEstado('Primero cargá tu cuento en PDF.');
        return;
    }

    if (!('speechSynthesis' in window)) {
        mostrarEstado(
            'Tu navegador no admite la lectura en voz alta.'
        );
        return;
    }

    const texto = textosPaginas[paginaActual];

    if (!texto) {
        mostrarEstado(
            'Esta página no contiene texto reconocible para leer.'
        );
        return;
    }

    // Cancelar cualquier lectura anterior
    window.speechSynthesis.cancel();

    const narracion = new SpeechSynthesisUtterance(texto);

    narracion.lang = 'es-UY';
    narracion.volume = volumen;
    narracion.rate = 0.9;
    narracion.pitch = 1;

    narracion.onstart = function () {
        leyendo = true;

        mostrarEstado(
            `Escuchando la página ${paginaActual + 1}...`
        );
    };

    narracion.onend = function () {
        leyendo = false;

        mostrarEstado(
            `Terminaste de escuchar la página ${paginaActual + 1}.`
        );
    };

    narracion.onerror = function (evento) {
        leyendo = false;

        if (evento.error !== 'canceled' &&
            evento.error !== 'interrupted') {

            mostrarEstado(
                'No se pudo reproducir la narración. Intentá nuevamente.'
            );
        }
    };

    window.speechSynthesis.speak(narracion);
}


// ========================================
// BOTONES DE AUDIO
// ========================================

if (botonLeer) {
    botonLeer.addEventListener('click', function () {
        leerPaginaActual();
    });
}

if (botonPausar) {
    botonPausar.addEventListener('click', function () {

        if ('speechSynthesis' in window &&
            window.speechSynthesis.speaking &&
            !window.speechSynthesis.paused) {

            window.speechSynthesis.pause();

            mostrarEstado('Narración pausada.');
        }
    });
}

if (botonReanudar) {
    botonReanudar.addEventListener('click', function () {

        if ('speechSynthesis' in window &&
            window.speechSynthesis.paused) {

            window.speechSynthesis.resume();

            mostrarEstado('Continuando la narración...');
        }
    });
}

if (botonDetener) {
    botonDetener.addEventListener('click', function () {
        detenerLectura(true);
    });
}


// ========================================
// CONTROL DE VOLUMEN
// ========================================

if (controlVolumen) {

    controlVolumen.addEventListener('input', function () {

        volumen = Number(this.value);

        if (volumen === 0) {
            mostrarEstado(
                'Volumen en silencio. Podés aumentarlo con la barra.'
            );
        } else {
            mostrarEstado(
                `Volumen seleccionado: ${Math.round(volumen * 100)} %. ` +
                'El nuevo volumen se aplicará al iniciar la lectura.'
            );
        }
    });
}


// ========================================
// DETENER LA NARRACIÓN
// ========================================

function detenerLectura(actualizarMensaje = true) {

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    leyendo = false;

    if (actualizarMensaje) {
        mostrarEstado('Narración detenida.');
    }
}


// ========================================
// MOSTRAR MENSAJES
// ========================================

function mostrarEstado(mensaje) {

    if (estadoAudio) {
        estadoAudio.textContent = mensaje;
    }
}
// Cargar automáticamente el cuento al abrir la página
window.addEventListener('DOMContentLoaded', async function () {
    try {
        const respuesta = await fetch('./cuento-final.pdf');

        if (!respuesta.ok) {
            throw new Error('No se encontró el PDF del cuento.');
        }

        const datos = new Uint8Array(
            await respuesta.arrayBuffer()
        );
