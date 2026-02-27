/**
 * UI Capture and Sharing Logic
 * Matching backup.html exactly
 */

async function captureAndDownloadCards() {
    const cardsContainer = document.querySelector('.cards-container');
    const captureBtn = document.getElementById('captureBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');

    try {
        if (loadingOverlay) loadingOverlay.classList.add('active');
        if (loadingText) loadingText.textContent = "Procesando informe visual...";
        if (captureBtn) captureBtn.classList.add('hidden');

        // 1. Abrir todas las tarjetas y guardar estado original
        const cardHeaders = document.querySelectorAll('.card-header');
        const originalStates = [];
        
        cardHeaders.forEach(header => {
            const cardContent = header.nextElementSibling;
            originalStates.push(cardContent.classList.contains('expanded'));
            if (!cardContent.classList.contains('expanded')) {
                cardContent.classList.add('expanded');
                const indicator = header.querySelector('.collapse-indicator');
                if (indicator) indicator.classList.add('expanded');
            }
        });

        await new Promise(resolve => setTimeout(resolve, 500));

        // 2. Configuración para captura
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        
        // Ocultar elementos temporales
        const elementsToHide = document.querySelectorAll('.date-selector-container, .social-links');
        elementsToHide.forEach(el => el.style.visibility = 'hidden');

        // Guardar estilos originales
        const originalStyles = {
            width: cardsContainer.style.width,
            overflow: cardsContainer.style.overflow,
            margin: cardsContainer.style.margin,
            transform: cardsContainer.style.transform,
            zoom: document.body.style.zoom
        };

        // Ajustar para captura - FORZAR ANCHO 1800px (más amplio)
        cardsContainer.style.width = '1800px';
        cardsContainer.style.maxWidth = '1800px';
        cardsContainer.style.minWidth = '1800px';
        cardsContainer.style.overflow = 'visible';
        cardsContainer.style.margin = '0 auto';
        
        if (isMobile) {
            document.body.style.zoom = '1';
        }

        // 3. Capturar con html2canvas
        const canvasOptions = {
            scale: isMobile ? 3 : 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: isMobile ? 3000 : 1800,
            windowHeight: cardsContainer.scrollHeight,
            backgroundColor: '#f9fafb'
        };

        await new Promise(resolve => setTimeout(resolve, 300));
        const canvas = await html2canvas(cardsContainer, canvasOptions);

        // 4. Restaurar todo al estado original
        elementsToHide.forEach(el => el.style.visibility = 'visible');
        Object.assign(cardsContainer.style, originalStyles);
        document.body.style.zoom = originalStyles.zoom;
        
        // Restaurar estado de las tarjetas
        cardHeaders.forEach((header, index) => {
            const cardContent = header.nextElementSibling;
            const indicator = header.querySelector('.collapse-indicator');
            
            if (!originalStates[index]) {
                cardContent.classList.remove('expanded');
                if (indicator) indicator.classList.remove('expanded');
            }
        });

        // 5. Obtener imagen y subir a Drive
        // Reducir calidad en móviles para disminuir tamaño
        const imageQuality = isMobile ? 0.7 : 0.85;
        const imageData = canvas.toDataURL('image/jpeg', imageQuality).split(',')[1];
        
        // Descargar archivo PNG
        const link = document.createElement('a');
        link.href = 'data:image/jpeg;base64,' + imageData;
        link.download = `Informe_Ingresos_${formatDate(new Date()).replace(/\//g, '-')}.jpg`;
        link.click();
        
        // Subir a Drive
        if (loadingText) loadingText.textContent = "Subiendo imagen a Drive...";
        const imageUrl = await uploadImageToDrive(imageData);
        console.log('URL final para WhatsApp:', imageUrl);
        
        if (!imageUrl) {
            console.warn('No se pudo obtener URL de imagen, enviando mensaje sin imagen');
        }
        
        // 6. Generar y abrir mensaje de WhatsApp
        if (loadingText) loadingText.textContent = "Preparando mensaje de WhatsApp...";
        const whatsappMessage = generateWhatsAppMessage(imageUrl);
        console.log('Mensaje completo generado:', decodeURIComponent(whatsappMessage));
        console.log('Link ih3 incluido:', imageUrl ? 'SÍ' : 'NO');
        
        openWhatsApp(whatsappMessage);

    } catch (e) {
        console.error("Capture error:", e);
        alert("Error al generar el informe visual.");
    } finally {
        if (captureBtn) captureBtn.classList.remove('hidden');
        if (loadingOverlay) loadingOverlay.classList.remove('active');
    }
}

function openAllCards() {
    document.querySelectorAll('.card-header').forEach(header => {
        const cardContent = header.nextElementSibling;
        const indicator = header.querySelector('.collapse-indicator');

        if (cardContent && !cardContent.classList.contains('expanded')) {
            cardContent.classList.add('expanded');
            if (indicator) indicator.classList.add('expanded');
        }
    });
}

// WhatsApp message - matching backup.html exactly
function generateWhatsAppMessage(imageUrl = "") {
    if (!currentReportData) return "";

    const diaData = currentReportData.dia.actual;
    const mesData = currentReportData.mes.actual;
    const fechaObj = parseDate(diaData.fecha);

    // Formatear fechas
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

    const diaNombre = dias[fechaObj.getDay()];
    const diaNumero = fechaObj.getDate();
    const mesNombre = meses[fechaObj.getMonth()];
    const año = fechaObj.getFullYear();

    // Datos de semanas
    const semanaActual = getWeekNumber(fechaObj);
    const semanaAnterior = semanaActual - 1 > 0 ? semanaActual - 1 : 52;

    // Preparar comparativo
    let comparativoAnterior = '';
    if (currentReportData.dia.anterior) {
        const fechaAnterior = parseDate(currentReportData.filtros.anterior);
        comparativoAnterior = `(vs ${fechaAnterior.getDate()} ${meses[fechaAnterior.getMonth()]} ${año - 1})`;
    }

    // Determinar flecha de gestión
    let flechaGestion = '';
    if (diaData.gestion) {
        const valorGestion = parseFloat(diaData.gestion);
        flechaGestion = valorGestion < 0 ? '↓' : '↑';
    }

    // Obtener la tendencia global
    const tendenciaGlobal = getGlobalTrend();
    let textoTendencia = '';

    switch (tendenciaGlobal) {
        case 'positive':
            textoTendencia = '↑ Tendencia a la alza';
            break;
        case 'negative':
            textoTendencia = '↓ Tendencia a la baja';
            break;
        default:
            textoTendencia = 'Tendencia Estable';
    }

    // Construir el mensaje base
    let mensaje = `¡Bendiciones para todos!

Adjunto el Cierre de Ingresos del Día:
\`${diaNombre}, ${diaNumero} de ${mesNombre} del ${año}\`

*${formatoCantidad(diaData.ingreso)}* unidades | Cumplimiento *${diaData.porcentaje}*
Meta: *${formatoCantidad(diaData.meta)}* ${comparativoAnterior}

${textoTendencia}

Muestra Semanal (S${semanaActual}/S${semanaAnterior}) Gestión ${flechaGestion} *${diaData.gestion || 'N/A'}*
* Promedio: *${formatoCantidad(diaData.promedio)}*
* Ponderado: *${formatoCantidad(diaData.ponderado)}*
* Desviación: *${formatoCantidad(diaData.desvest)}*
* Máximo: *${formatoCantidad(diaData.max)}*`;

    // Agregar enlaces
    mensaje += `\n\nEnlaces importantes:
☆ Link a la aplicación: https://andres1-dev.github.io/four/income/index.html`;

    if (imageUrl) {
        mensaje += `\n★ Resumen visual: ${imageUrl}`;
    }

    // Cierre del mensaje
    mensaje += `\n\nQuedo atento a sus comentarios.`;

    return encodeURIComponent(mensaje);
}

// Función para abrir WhatsApp - compatible con iOS PWA
function openWhatsApp(message) {
    const phoneNumber = "573168007979";
    const url = `https://wa.me/${phoneNumber}?text=${message}`;

    // Detectar si estamos en iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

    console.log('Abriendo WhatsApp - iOS:', isIOS, 'PWA:', isInStandaloneMode);
    console.log('URL completa:', decodeURIComponent(url));

    if (isIOS && isInStandaloneMode) {
        // En iOS PWA, usar window.open es más confiable
        try {
            const newWindow = window.open(url, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                // Si window.open fue bloqueado, intentar con location
                window.location.href = url;
            }
        } catch (e) {
            console.error('Error abriendo WhatsApp:', e);
            window.location.href = url;
        }
    } else {
        // Para otros navegadores y plataformas
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.target = '_blank';
        anchor.rel = 'noopener noreferrer';
        document.body.appendChild(anchor);
        anchor.click();
        document.body.removeChild(anchor);
    }
}

async function uploadImageToDrive(base64Image) {
    try {
        console.log('Subiendo imagen a Drive...');
        console.log('Tamaño de imagen (base64):', base64Image.length, 'caracteres');
        
        // Convertir base64 a Blob para mejor compatibilidad con iOS
        const byteCharacters = atob(base64Image);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'image/jpeg' });
        
        console.log('Tamaño del blob:', blob.size, 'bytes');
        
        // Usar FormData para mejor compatibilidad con iOS
        const formData = new FormData();
        formData.append('image', blob, 'reporte.jpg');
        formData.append('action', 'uploadImage');
        
        const response = await fetch('https://script.google.com/macros/s/AKfycbz6sUS28Xza02Kjwg-Eez1TPn4BBj2XcZGF8gKxEHr4Fsxz4eqYoQYHCqx5NWaOP1OR8g/exec', {
            method: 'POST',
            body: formData,
            mode: 'cors',
            credentials: 'omit'
        });
        
        console.log('Respuesta HTTP status:', response.status);
        
        if (!response.ok) {
            console.error('Error HTTP:', response.status, response.statusText);
            return null;
        }
        
        const result = await response.json();
        console.log('Respuesta completa de Drive:', JSON.stringify(result));
        
        if (result.status === "success" && result.imageUrl) {
            console.log('✓ URL de imagen obtenida exitosamente:', result.imageUrl);
            return result.imageUrl;
        } else {
            console.error("✗ Error al subir la imagen:", result.message || 'Sin URL en respuesta');
            console.error("Objeto result completo:", result);
            return null;
        }
    } catch (error) {
        console.error("✗ Error en la petición a Drive:", error);
        console.error("Detalles del error:", error.message, error.stack);
        return null;
    }
}
