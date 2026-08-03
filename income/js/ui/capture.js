/**
 * UI Capture and Sharing Logic
 * Matching backup.html exactly
 */

const CAPTURE_APP_BASE_URL = 'https://andres1-dev.github.io/four/income/login.html';

async function captureAndDownloadCards(silent = false) {
    const cardsContainer = document.querySelector('.cards-container');
    const trendsContainer = document.querySelector('.cards-container2');
    const captureBtn = document.getElementById('captureBtn');
    const loadingOverlay = document.getElementById('loadingOverlay');
    const loadingText = document.getElementById('loadingText');
    
    // Declarar trendsExpandedState al inicio para que esté disponible en todo el scope
    const trendsExpandedState = new Map();

    // Toast de progreso para modo silencioso
    let toastEl = null;
    function updateToast(msg, state = 'loading') {
        if (!toastEl) {
            toastEl = document.createElement('div');
            toastEl.className = 'silent-toast';
            document.body.appendChild(toastEl);
            requestAnimationFrame(() => toastEl.classList.add('visible'));
        }
        const indicator = state === 'loading'
            ? `<div class="silent-toast-spinner"></div>`
            : `<div class="silent-toast-dot${state === 'error' ? ' error' : ''}"></div>`;
        toastEl.innerHTML = `${indicator}<span>${msg}</span>`;
    }
    function removeToast() {
        if (toastEl) {
            toastEl.classList.remove('visible');
            setTimeout(() => { toastEl?.remove(); toastEl = null; }, 200);
        }
    }

    // Crear contenedor temporal para captura
    let tempContainer = null;

    try {
        if (!silent) {
            if (loadingOverlay) loadingOverlay.classList.add('active');
            if (loadingText) loadingText.textContent = "Procesando informe visual...";
        } else {
            updateToast('Generando imagen...');
        }
        if (captureBtn) captureBtn.classList.add('hidden');
        
        // Agregar clase capturing al body para estilos específicos
        document.body.classList.add('capturing');

        // Crear contenedor temporal que incluya ambas secciones
        tempContainer = document.createElement('div');
        tempContainer.style.cssText = 'width: 1840px; max-width: 1840px; min-width: 1840px; margin: 0; padding: 20px; background: transparent; overflow: visible; box-sizing: border-box;';
        tempContainer.className = 'capture-temp-container';
        
        // Clonar las tarjetas principales
        const cardsClone = cardsContainer.cloneNode(true);
        cardsClone.style.width = '100%';
        cardsClone.style.maxWidth = '100%';
        cardsClone.style.minWidth = 'unset';
        cardsClone.style.margin = '0';
        cardsClone.style.overflow = 'visible';
        tempContainer.appendChild(cardsClone);
        
        // Mover temporalmente la tarjeta de tendencias ORIGINAL al contenedor temporal
        let trendsOriginalParent = null;
        let trendsNextSibling = null;
        if (trendsContainer) {
            trendsOriginalParent = trendsContainer.parentNode;
            trendsNextSibling = trendsContainer.nextSibling;
            
            // Guardar estilos originales de la tarjeta de tendencias
            const originalTrendsStyles = {
                width: trendsContainer.style.width,
                maxWidth: trendsContainer.style.maxWidth,
                minWidth: trendsContainer.style.minWidth,
                margin: trendsContainer.style.margin,
                overflow: trendsContainer.style.overflow
            };
            
            // Aplicar estilos para captura
            trendsContainer.style.width = '100%';
            trendsContainer.style.maxWidth = '100%';
            trendsContainer.style.minWidth = 'unset';
            trendsContainer.style.margin = '20px 0 0 0';
            trendsContainer.style.overflow = 'visible';
            
            // Mover al contenedor temporal
            tempContainer.appendChild(trendsContainer);
            
            // Guardar para restaurar después
            tempContainer._trendsOriginalParent = trendsOriginalParent;
            tempContainer._trendsNextSibling = trendsNextSibling;
            tempContainer._originalTrendsStyles = originalTrendsStyles;
        }
        
        // Insertar el contenedor temporal en el DOM (invisible)
        tempContainer.style.position = 'absolute';
        tempContainer.style.left = '-9999px';
        tempContainer.style.top = '0';
        document.body.appendChild(tempContainer);
        
        // Forzar que el contenedor temporal tenga el ancho de escritorio
        tempContainer.style.width = '1800px';
        tempContainer.style.maxWidth = '1800px';
        tempContainer.style.minWidth = '1800px';
        
        // Esperar a que el DOM se actualice y la gráfica se redibuje
        await new Promise(resolve => setTimeout(resolve, 300));

        // 1. Abrir todas las tarjetas en el contenedor temporal
        const cardHeaders = tempContainer.querySelectorAll('.card-header');

        // Guardar estado expandido de las tarjetas del trendsContainer ANTES de expandir
        if (trendsContainer) {
            trendsContainer.querySelectorAll('.card-header').forEach(header => {
                const card = header.closest('.card');
                const cardContent = card ? card.querySelector('.card-content') : null;
                trendsExpandedState.set(header, {
                    cardExpanded: card ? card.classList.contains('expanded') : false,
                    contentExpanded: cardContent ? cardContent.classList.contains('expanded') : false,
                    indicatorExpanded: header.querySelector('.collapse-indicator')?.classList.contains('expanded') || false
                });
            });
        }
        
        cardHeaders.forEach(header => {
            const card = header.closest('.card');
            const cardContent = card ? card.querySelector('.card-content') : header.nextElementSibling;
            if (cardContent && !cardContent.classList.contains('expanded')) {
                cardContent.classList.add('expanded');
                if (card) card.classList.add('expanded');
                const indicator = header.querySelector('.collapse-indicator');
                if (indicator) indicator.classList.add('expanded');
            }
        });

        // Ocultar botones de info en el clon
        const infoButtons = tempContainer.querySelectorAll('.info-btn-inline');
        infoButtons.forEach(btn => btn.style.display = 'none');

        // Esperar más tiempo para que el canvas se renderice correctamente
        await new Promise(resolve => setTimeout(resolve, 800));

        // Asegurar que todas las fuentes estén cargadas antes de capturar
        await document.fonts.ready;

        // Forzar render de FontAwesome precargando un elemento invisible con cada ícono usado
        const faPreload = document.createElement('div');
        faPreload.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;font-size:1px;';
        faPreload.innerHTML = '<i class="fas fa-calendar-day"></i><i class="fas fa-calendar-alt"></i><i class="fas fa-chart-line"></i><i class="fas fa-bullseye"></i><i class="fas fa-money-bill-wave"></i><i class="fas fa-percent"></i><i class="fas fa-chart-simple"></i><i class="fas fa-calculator"></i><i class="fas fa-crown"></i><i class="fas fa-weight-hanging"></i><i class="fas fa-project-diagram"></i>';
        document.body.appendChild(faPreload);
        await new Promise(resolve => setTimeout(resolve, 200));
        faPreload.remove();

        // 2. Configuración para captura
        const isMobile = window.matchMedia("(max-width: 768px)").matches;
        
        // Ocultar elementos temporales
        const elementsToHide = document.querySelectorAll('.date-selector-container, .social-links');
        elementsToHide.forEach(el => el.style.visibility = 'hidden');

        // 3. Capturar con html2canvas
        const canvasOptions = {
            scale: isMobile ? 3 : 2,
            logging: false,
            useCORS: true,
            allowTaint: true,
            scrollX: 0,
            scrollY: 0,
            windowWidth: isMobile ? 3000 : 1840,
            windowHeight: tempContainer.scrollHeight,
            backgroundColor: null  // se aplica manualmente en el canvas final
        };

        await new Promise(resolve => setTimeout(resolve, 300));
        const uiCanvas = await html2canvas(tempContainer, canvasOptions);

        // Canvas final con fondo transparente
        const finalCanvas = document.createElement('canvas');
        finalCanvas.width  = uiCanvas.width;
        finalCanvas.height = uiCanvas.height;
        const fCtx = finalCanvas.getContext('2d');

        // Solo UI, sin fondo sólido
        fCtx.drawImage(uiCanvas, 0, 0);

        const canvas = finalCanvas;

        // 4. Limpiar: restaurar tarjeta de tendencias y remover contenedor temporal
        if (tempContainer) {
            // Restaurar la tarjeta de tendencias a su posición original
            if (tempContainer._trendsOriginalParent && trendsContainer) {
                const originalStyles = tempContainer._originalTrendsStyles;
                trendsContainer.style.width = originalStyles.width;
                trendsContainer.style.maxWidth = originalStyles.maxWidth;
                trendsContainer.style.minWidth = originalStyles.minWidth;
                trendsContainer.style.margin = originalStyles.margin;
                trendsContainer.style.overflow = originalStyles.overflow;
                
                // Reinsertar en su posición original
                if (tempContainer._trendsNextSibling) {
                    tempContainer._trendsOriginalParent.insertBefore(trendsContainer, tempContainer._trendsNextSibling);
                } else {
                    tempContainer._trendsOriginalParent.appendChild(trendsContainer);
                }

                // Restaurar estado expandido/contraído de las tarjetas de tendencias
                trendsExpandedState.forEach((state, header) => {
                    const card = header.closest('.card');
                    const cardContent = card ? card.querySelector('.card-content') : null;
                    const indicator = header.querySelector('.collapse-indicator');
                    if (card) card.classList.toggle('expanded', state.cardExpanded);
                    if (cardContent) cardContent.classList.toggle('expanded', state.contentExpanded);
                    if (indicator) indicator.classList.toggle('expanded', state.indicatorExpanded);
                });
            }
            
            // Remover el contenedor temporal
            tempContainer.remove();
        }
        
        elementsToHide.forEach(el => el.style.visibility = 'visible');
        
        // Forzar reflow para que el DOM aplique los cambios
        void document.body.offsetHeight;

        // 5. Convertir canvas a Blob
        if (!silent && loadingText) loadingText.textContent = "Generando imagen...";
        else updateToast('Procesando imagen...');
        
        const blob = await new Promise(resolve => {
            canvas.toBlob(resolve, 'image/png');
        });
        
        console.log('Imagen generada - Tamaño:', blob.size, 'bytes');

        // 6. Crear archivo y descargar
        const fileName = `Informe_Ingresos_${formatDate(new Date()).replace(/\//g, '-')}.png`;
        downloadImage(blob, fileName);
        
        // 7. Esperar un momento para que se descargue
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // 8. Generar token de acceso y abrir WhatsApp
        if (!silent && loadingText) loadingText.textContent = "Abriendo WhatsApp...";
        else updateToast('Abriendo WhatsApp...');
        let appUrl = CAPTURE_APP_BASE_URL;
        try {
            if (typeof generateAndSaveToken === 'function') {
                appUrl = await generateAndSaveToken();
            }
        } catch (_) {}
        const whatsappText = generateWhatsAppMessage('', appUrl);
        openWhatsAppWithText(whatsappText);
        
        // Esperar un momento y cerrar el overlay/toast
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        if (!silent && loadingOverlay) {
            loadingOverlay.classList.add('closing');
            setTimeout(() => loadingOverlay.classList.remove('active', 'closing'), 400);
        } else {
            removeToast();
        }

    } catch (e) {
        console.error("Capture error:", e);
        alert("Error al generar el informe visual.");
    } finally {
        // Limpiar y restaurar
        if (tempContainer) {
            // Restaurar la tarjeta de tendencias si fue movida
            if (tempContainer._trendsOriginalParent && trendsContainer) {
                const originalStyles = tempContainer._originalTrendsStyles;
                if (originalStyles) {
                    trendsContainer.style.width = originalStyles.width;
                    trendsContainer.style.maxWidth = originalStyles.maxWidth;
                    trendsContainer.style.minWidth = originalStyles.minWidth;
                    trendsContainer.style.margin = originalStyles.margin;
                    trendsContainer.style.overflow = originalStyles.overflow;
                }
                
                // Reinsertar en su posición original
                if (tempContainer._trendsNextSibling) {
                    tempContainer._trendsOriginalParent.insertBefore(trendsContainer, tempContainer._trendsNextSibling);
                } else {
                    tempContainer._trendsOriginalParent.appendChild(trendsContainer);
                }

                // Restaurar estado expandido/contraído de las tarjetas de tendencias
                trendsExpandedState.forEach((state, header) => {
                    const card = header.closest('.card');
                    const cardContent = card ? card.querySelector('.card-content') : null;
                    const indicator = header.querySelector('.collapse-indicator');
                    if (card) card.classList.toggle('expanded', state.cardExpanded);
                    if (cardContent) cardContent.classList.toggle('expanded', state.contentExpanded);
                    if (indicator) indicator.classList.toggle('expanded', state.indicatorExpanded);
                });
            }
            
            // Remover contenedor temporal
            if (tempContainer.parentNode) {
                tempContainer.remove();
            }
        }
        
        // Remover clase capturing del body
        document.body.classList.remove('capturing');
        
        if (captureBtn) captureBtn.classList.remove('hidden');
        if (!silent) {
            if (loadingOverlay) {
                loadingOverlay.classList.add('closing');
                setTimeout(() => loadingOverlay.classList.remove('active', 'closing'), 400);
            }
        } else {
            removeToast();
        }
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

// Función para mostrar notificación toast
function showToast(message, duration = 5000) {
    // Crear elemento toast si no existe
    let toast = document.getElementById('custom-toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'custom-toast';
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: #2563eb;
            color: white;
            padding: 16px 24px;
            border-radius: 12px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 100000;
            max-width: 90%;
            text-align: center;
            font-size: 14px;
            line-height: 1.5;
            opacity: 0;
            transition: opacity 0.3s ease;
        `;
        document.body.appendChild(toast);
    }
    
    // Actualizar mensaje y mostrar
    toast.innerHTML = message;
    toast.style.opacity = '1';
    
    // Ocultar después del tiempo especificado
    setTimeout(() => {
        toast.style.opacity = '0';
    }, duration);
}

// WhatsApp message - matching backup.html exactly
function generateWhatsAppMessage(imageUrl = "", appUrl = "") {
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

    // Agregar enlace a la aplicación (con token si está disponible)
    const linkApp = appUrl || APP_BASE_URL;
    mensaje += `\n\n☆ Link a la aplicación: ${linkApp}`;

    // Solo agregar link de imagen si existe (para compatibilidad con código antiguo)
    if (imageUrl) {
        mensaje += `\n★ Resumen visual: ${imageUrl}`;
    }

    // Cierre del mensaje
    mensaje += `\n\nQuedo atento a sus comentarios.`;

    return mensaje;
}

// Función para descargar la imagen
function downloadImage(blob, fileName) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    console.log('✓ Imagen descargada:', fileName);
}

// Función para abrir WhatsApp solo con texto
function openWhatsAppWithText(message) {
    const phoneNumber = "573168007979";
    const encodedMessage = encodeURIComponent(message);
    const url = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;

    // Detectar si estamos en iOS
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
    const isInStandaloneMode = ('standalone' in window.navigator) && (window.navigator.standalone);

    console.log('Abriendo WhatsApp - iOS:', isIOS, 'PWA:', isInStandaloneMode);

    if (isIOS && isInStandaloneMode) {
        // En iOS PWA, usar window.open es más confiable
        try {
            const newWindow = window.open(url, '_blank');
            if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
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

