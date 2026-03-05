/**
 * search.js
 * Funcionalidades de búsqueda e impresión de documentos
 * Refactorizado aplicando DRY (Don't Repeat Yourself) y encapsulamiento.
 */

const UI = {
    setResult(content) {
        document.getElementById("resultado").innerHTML = content;
    },
    showError(message) {
        this.setResult(`
            <div style="color: var(--danger); padding: 1rem; border-radius: var(--radius);">
                <p><strong>Error:</strong> ${message}</p>
            </div>
        `);
    },
    showSuccess(message) {
        this.setResult(`
            <div style="color: var(--secondary-dark); padding: 1rem; border-radius: var(--radius);">
                ${message}
            </div>
        `);
    }
};

const SearchService = {
    getRecInput() {
        const input = document.getElementById("recInput").value;
        if (!input) {
            UI.setResult("<p>Ingrese un documento para buscar.</p>");
            return null;
        }
        return input;
    },

    findDocument(rec) {
        if (!datosGlobales || datosGlobales.length === 0) {
            UI.setResult("<p>No hay datos cargados en el sistema.</p>");
            return null;
        }
        return datosGlobales.find(item => item.REC == rec);
    },

    validarColaborador(resultado) {
        if (!resultado.COLABORADOR || resultado.COLABORADOR.trim() === "") {
            UI.showError(`El documento ${resultado.REC} no tiene colaborador/responsable asignado. Por favor, asigne un colaborador en la hoja DATA antes de imprimir.`);
            return false;
        }
        return true;
    }
};


function buscarPorREC() {
    const recInput = SearchService.getRecInput();
    if (!recInput) return;

    if (recInput.includes(',')) {
        return buscarMultiplesRECs();
    }

    const resultado = SearchService.findDocument(recInput);
    if (!resultado) {
        return UI.setResult("<p>No se encontró el documento especificado.</p>");
    }

    if (!SearchService.validarColaborador(resultado)) return;

    abrirPlantillaImpresion(resultado);

    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        Object.keys(resultado.DISTRIBUCION.Clientes).forEach(cliente => {
            abrirPlantillaImpresion(resultado, { modo: 'cliente', clienteNombre: cliente });
        });
    }

    UI.showSuccess(`
        <p>Documento ${recInput} encontrado. Se abrió la plantilla de impresión.</p>
        <p>Colaborador asignado: <strong>${resultado.COLABORADOR}</strong></p>
    `);
}

function buscarMultiplesRECs() {
    const recInput = document.getElementById("recInput").value;
    if (!recInput) return UI.setResult("<p>Ingrese uno o más documentos para buscar.</p>");

    const recsArray = recInput.split(',').map(rec => rec.trim()).filter(Boolean);
    if (recsArray.length === 0) return UI.setResult("<p>No se ingresaron documentos válidos.</p>");

    let htmlResult = `<p>Buscando ${recsArray.length} documentos...</p>`;

    recsArray.forEach(rec => {
        const resultado = SearchService.findDocument(rec);
        if (resultado) {
            abrirPlantillaImpresion(resultado, { modo: 'completo', soloImpresionPrincipal: true });
            htmlResult += `<p>REC ${rec} encontrado. Se abrió la plantilla principal.</p>`;
        } else {
            htmlResult += `<p>No se encontró el documento ${rec}.</p>`;
        }
    });

    UI.setResult(htmlResult);
}

function mostrarOpcionesImpresion() {
    const recInput = SearchService.getRecInput();
    if (!recInput) return;

    if (recInput.includes(',')) return UI.showError("Esta función solo funciona con un documento a la vez.");

    const resultado = SearchService.findDocument(recInput);
    if (!resultado) return UI.setResult("<p>No se encontró el documento especificado.</p>");
    if (!SearchService.validarColaborador(resultado)) return;

    let clientesHtml = '';
    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        Object.keys(resultado.DISTRIBUCION.Clientes).forEach(cliente => {
            clientesHtml += `
                <label style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" id="impCliente_${cliente.replace(/\s+/g, '_')}" class="opcion-impresion">
                    Cliente: ${cliente}
                </label>`;
        });
    }

    UI.setResult(`
        <div class="card" style="margin-top: 1rem;">
            <div class="card-header">
                <h3>Opciones de impresión para REC${recInput}</h3>
            </div>
            <div class="card-body">
                <div style="margin-bottom: 1rem;">
                    <div class="btn-group" style="margin-bottom: 1rem;">
                        <button onclick="seleccionarTodasOpciones(true)" class="btn btn-primary btn-sm">Seleccionar todo</button>
                        <button onclick="seleccionarTodasOpciones(false)" class="btn btn-secondary btn-sm">Deseleccionar todo</button>
                    </div>
                    <label style="display: block; margin-bottom: 0.5rem; font-weight: 500;">Seleccione qué imprimir:</label>
                    <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="impPrincipal" class="opcion-impresion"> Plantilla Principal
                        </label>
                        ${clientesHtml}
                    </div>
                </div>
                <div class="btn-group">
                    <button onclick="confirmarImpresionSelectiva('${recInput}')" class="btn btn-primary"><i class="fas fa-print"></i> Imprimir Selección</button>
                    <button onclick="document.getElementById('resultado').innerHTML = ''" class="btn btn-secondary"><i class="fas fa-times"></i> Cancelar</button>
                </div>
            </div>
        </div>
    `);
}

function seleccionarTodasOpciones(seleccionar) {
    document.querySelectorAll('.opcion-impresion').forEach(cb => cb.checked = seleccionar);
}

function confirmarImpresionSelectiva(recBuscado) {
    const resultado = SearchService.findDocument(recBuscado);
    if (!resultado) return;

    const seleccionados = document.querySelectorAll('.opcion-impresion:checked');
    if (seleccionados.length === 0) return alert("Por favor seleccione al menos una opción para imprimir");

    if (document.getElementById("impPrincipal")?.checked) {
        abrirPlantillaImpresion(resultado, { modo: 'completo', soloImpresionPrincipal: true });
    }

    if (resultado.DISTRIBUCION && resultado.DISTRIBUCION.Clientes) {
        Object.keys(resultado.DISTRIBUCION.Clientes).forEach(cliente => {
            const cb = document.getElementById(`impCliente_${cliente.replace(/\s+/g, '_')}`);
            if (cb?.checked) {
                abrirPlantillaImpresion(resultado, { modo: 'cliente', clienteNombre: cliente });
            }
        });
    }

    UI.showSuccess(`<p>Documento ${recBuscado} - Impresión iniciada (${seleccionados.length} plantillas).</p>`);
}

function imprimirSoloClientes() {
    const recInput = SearchService.getRecInput();
    if (!recInput) return;

    if (recInput.includes(',')) return UI.showError("Esta función solo funciona con un documento a la vez.");

    const resultado = SearchService.findDocument(recInput);
    if (!resultado) return UI.setResult("<p>No se encontró el documento especificado.</p>");
    if (!SearchService.validarColaborador(resultado)) return;

    if (!resultado.DISTRIBUCION || !resultado.DISTRIBUCION.Clientes || Object.keys(resultado.DISTRIBUCION.Clientes).length === 0) {
        return UI.showError(`El documento ${recInput} no tiene clientes asignados.`);
    }

    const clientes = Object.keys(resultado.DISTRIBUCION.Clientes);
    clientes.forEach(cliente => abrirPlantillaImpresion(resultado, { modo: 'cliente', clienteNombre: cliente }));

    UI.showSuccess(`
        <p>Documento ${recInput} - Impresión iniciada para:</p>
        <ul>${clientes.map(c => `<li>${c}</li>`).join('')}</ul>
        <p>Total clientes: <strong>${clientes.length}</strong></p>
    `);
}
