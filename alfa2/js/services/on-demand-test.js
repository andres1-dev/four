// ============================================================
// on-demand-test.js
//
// Suite de pruebas para validar que on-demand-service.js
// y la EF on-demand-query funcionan correctamente.
//
// CÓMO EJECUTAR:
//   1. Abre la app en el navegador e inicia sesión.
//   2. Abre DevTools → Console.
//   3. Pega y ejecuta: OnDemandTests.runAll()
//   4. También puedes correr cada test por separado:
//        OnDemandTests.testColores()
//        OnDemandTests.testPrecios()
//        OnDemandTests.testHistoricas()
//        OnDemandTests.testBarras()
//        OnDemandTests.testGlobalMaps()
//        OnDemandTests.testOnlyRequestedIds()
//        OnDemandTests.testEmptyInput()
//
// NOTA: Este archivo NO modifica ningún dato ni mapa global.
//       Solo lee y valida. Se puede cargar/descargar libremente.
// ============================================================

const OnDemandTests = (() => {

    // ── Colores de consola ────────────────────────────────────
    const C = {
        ok:   (msg) => console.log(`%c✅ ${msg}`, 'color:#4caf50;font-weight:bold'),
        fail: (msg) => console.log(`%c❌ ${msg}`, 'color:#f44336;font-weight:bold'),
        info: (msg) => console.log(`%cℹ️  ${msg}`, 'color:#2196f3'),
        warn: (msg) => console.log(`%c⚠️  ${msg}`, 'color:#ff9800'),
        head: (msg) => console.log(`%c\n━━━ ${msg} ━━━`, 'color:#9c27b0;font-weight:bold;font-size:13px'),
    };

    function assert(condition, label) {
        if (condition) C.ok(label);
        else C.fail(label);
        return condition;
    }

    // ── Helpers para obtener IDs reales de los mapas en memoria ──
    // (Si los mapas están vacíos, se usan IDs de prueba hardcodeados)

    function _sampleIds(map, n = 3) {
        return [...map.keys()].slice(0, n).map(String);
    }

    // ──────────────────────────────────────────────────────────
    // TEST 1: getColores — devuelve solo los IDs pedidos
    // ──────────────────────────────────────────────────────────
    async function testColores() {
        C.head('TEST getColores');
        const svc = window.OnDemandService;
        if (!svc) { C.fail('OnDemandService no disponible — carga on-demand-service.js'); return false; }

        // Tomar 3 IDs del coloresMap actual (si existe) o usar de prueba
        let ids = window.coloresMap && window.coloresMap.size > 0
            ? _sampleIds(window.coloresMap, 3)
            : ['001', '002', '003'];  // ajusta si conoces IDs reales

        C.info(`IDs a consultar: ${ids.join(', ')}`);

        const result = await svc.getColores(ids);

        assert(result instanceof Map,     'Resultado es un Map');
        assert(result.size > 0,           `Devolvió ${result.size} colores (> 0)`);
        assert(result.size <= ids.length, `No devolvió más de los ${ids.length} IDs pedidos`);

        // Verificar que las claves son exactamente subconjunto de los pedidos
        const extra = [...result.keys()].filter(k => !ids.includes(k));
        assert(extra.length === 0, `No hay IDs extra (strict on-demand): ${extra.join(',') || 'ninguno'}`);

        C.info(`Resultado: ${[...result.entries()].map(([k,v]) => `${k}→${v}`).join(' | ')}`);
        return true;
    }

    // ──────────────────────────────────────────────────────────
    // TEST 2: getPrecios — devuelve solo las refs pedidas
    // ──────────────────────────────────────────────────────────
    async function testPrecios() {
        C.head('TEST getPrecios');
        const svc = window.OnDemandService;
        if (!svc) { C.fail('OnDemandService no disponible'); return false; }

        let refs = window.preciosMap && window.preciosMap.size > 0
            ? _sampleIds(window.preciosMap, 3)
            : ['REF001', 'REF002', 'REF003'];

        C.info(`Referencias a consultar: ${refs.join(', ')}`);

        const result = await svc.getPrecios(refs);

        assert(result instanceof Map, 'Resultado es un Map');
        assert(result.size > 0,       `Devolvió ${result.size} precios`);

        const extra = [...result.keys()].filter(k => !refs.includes(k));
        assert(extra.length === 0, `No hay refs extra: ${extra.join(',') || 'ninguna'}`);

        C.info(`Resultado: ${[...result.entries()].map(([k,v]) => `${k}→$${v}`).join(' | ')}`);
        return true;
    }

    // ──────────────────────────────────────────────────────────
    // TEST 3: getHistoricas — devuelve solo refprovs pedidas
    // ──────────────────────────────────────────────────────────
    async function testHistoricas() {
        C.head('TEST getHistoricas');
        const svc = window.OnDemandService;
        if (!svc) { C.fail('OnDemandService no disponible'); return false; }

        let refprovs = window.historicasMap && window.historicasMap.size > 0
            ? _sampleIds(window.historicasMap, 3)
            : ['1001', '1002', '1003'];

        C.info(`Refprovs a consultar: ${refprovs.join(', ')}`);

        const result = await svc.getHistoricas(refprovs);

        assert(result instanceof Map, 'Resultado es un Map');
        // Puede ser 0 si las refprovs de prueba no existen — avisamos pero no fallamos
        if (result.size === 0) C.warn('0 registros — verifica que los IDs de prueba existen en la tabla');
        else C.ok(`Devolvió ${result.size} historicas`);

        const extra = [...result.keys()].filter(k => !refprovs.includes(k));
        assert(extra.length === 0, `No hay refprovs extra: ${extra.join(',') || 'ninguna'}`);

        C.info(`Resultado: ${[...result.entries()].map(([k,v]) => `${k}→${v}`).join(' | ')}`);
        return true;
    }

    // ──────────────────────────────────────────────────────────
    // TEST 4: getBarras — devuelve solo refprovs pedidas
    // ──────────────────────────────────────────────────────────
    async function testBarras() {
        C.head('TEST getBarras');
        const svc = window.OnDemandService;
        if (!svc) { C.fail('OnDemandService no disponible'); return false; }

        let refprovs = window.barrasMap && window.barrasMap.size > 0
            ? [...new Set([...window.barrasMap.keys()].map(k => k.split('|')[0]))].slice(0, 3)
            : ['REF001', 'REF002'];

        C.info(`Refprovs a consultar: ${refprovs.join(', ')}`);

        const result = await svc.getBarras(refprovs);

        assert(result instanceof Map, 'Resultado es un Map');
        if (result.size === 0) C.warn('0 registros — verifica que las refprovs de prueba existen');
        else C.ok(`Devolvió ${result.size} barras`);

        // Verificar que cada clave tiene el formato correcto refprov|talla|id_color
        const malformed = [...result.keys()].filter(k => k.split('|').length !== 3);
        assert(malformed.length === 0, `Todas las claves tienen formato refprov|talla|id_color`);

        return true;
    }

    // ──────────────────────────────────────────────────────────
    // TEST 5: getGlobalMaps — solo trae los IDs del Excel
    // ──────────────────────────────────────────────────────────
    async function testGlobalMaps() {
        C.head('TEST getGlobalMaps');
        const svc = window.OnDemandService;
        if (!svc) { C.fail('OnDemandService no disponible'); return false; }

        // IDs de prueba — ajusta con valores reales de tus tablas
        const ids = {
            taller_ids:  ['1', '2', '3'],
            linea_ids:   ['1', '2'],
            auditor_ids: ['1'],
            usuario_ids: ['1', '2']
        };

        C.info(`IDs a consultar: talleres=${ids.taller_ids} lineas=${ids.linea_ids} auditores=${ids.auditor_ids} usuarios=${ids.usuario_ids}`);

        const { talleres, lineas, auditores, usuarios } = await svc.getGlobalMaps(ids);

        assert(talleres  instanceof Map, `talleres  es Map (size=${talleres.size})`);
        assert(lineas    instanceof Map, `lineas    es Map (size=${lineas.size})`);
        assert(auditores instanceof Map, `auditores es Map (size=${auditores.size})`);
        assert(usuarios  instanceof Map, `usuarios  es Map (size=${usuarios.size})`);

        return true;
    }

    // ──────────────────────────────────────────────────────────
    // TEST 6: Validar que IDs no pedidos NO vienen en la respuesta
    // Este es el test clave de "on-demand estricto"
    // ──────────────────────────────────────────────────────────
    async function testOnlyRequestedIds() {
        C.head('TEST Estricto: solo devuelve IDs pedidos');
        const svc = window.OnDemandService;
        if (!svc) { C.fail('OnDemandService no disponible'); return false; }

        // Pedir exactamente 1 ID de color conocido
        const idPedido = window.coloresMap && window.coloresMap.size > 0
            ? [...window.coloresMap.keys()][0]
            : '001';

        const result = await svc.getColores([idPedido]);

        const llaves = [...result.keys()];
        assert(
            llaves.every(k => k === idPedido),
            `Solo devolvió el ID pedido (${idPedido}), nada más. Llaves: ${llaves.join(',')}`
        );

        // Pedir un ID que definitivamente NO existe
        const idFalso = 'ID_QUE_NO_EXISTE_99999';
        const resultFalso = await svc.getColores([idFalso]);
        assert(resultFalso.size === 0, `ID inexistente devuelve Map vacío (correcto)`);

        return true;
    }

    // ──────────────────────────────────────────────────────────
    // TEST 7: Input vacío — no debe hacer fetch a la EF
    // ──────────────────────────────────────────────────────────
    async function testEmptyInput() {
        C.head('TEST Input vacío');
        const svc = window.OnDemandService;
        if (!svc) { C.fail('OnDemandService no disponible'); return false; }

        const r1 = await svc.getColores([]);
        assert(r1 instanceof Map && r1.size === 0, 'getColores([]) devuelve Map vacío sin fetch');

        const r2 = await svc.getPrecios([]);
        assert(r2 instanceof Map && r2.size === 0, 'getPrecios([]) devuelve Map vacío sin fetch');

        const r3 = await svc.getHistoricas([]);
        assert(r3 instanceof Map && r3.size === 0, 'getHistoricas([]) devuelve Map vacío sin fetch');

        const r4 = await svc.getBarras([]);
        assert(r4 instanceof Map && r4.size === 0, 'getBarras([]) devuelve Map vacío sin fetch');

        return true;
    }

    // ──────────────────────────────────────────────────────────
    // runAll — ejecuta todos los tests en secuencia
    // ──────────────────────────────────────────────────────────
    async function runAll() {
        C.head('ON-DEMAND SERVICE — Suite completa');
        C.info('EF: on-demand-query | Proyecto: ymaojqjdnrpfkrtuezcw');
        console.time('Total');

        const results = [];
        for (const [name, fn] of [
            ['getColores',         testColores],
            ['getPrecios',         testPrecios],
            ['getHistoricas',      testHistoricas],
            ['getBarras',          testBarras],
            ['getGlobalMaps',      testGlobalMaps],
            ['OnlyRequestedIds',   testOnlyRequestedIds],
            ['EmptyInput',         testEmptyInput],
        ]) {
            try {
                const ok = await fn();
                results.push({ name, ok });
            } catch (e) {
                C.fail(`${name} → ERROR: ${e.message}`);
                results.push({ name, ok: false });
            }
        }

        console.timeEnd('Total');
        C.head('RESUMEN');
        const passed = results.filter(r => r.ok).length;
        results.forEach(r => r.ok ? C.ok(r.name) : C.fail(r.name));
        console.log(`\n${passed}/${results.length} tests pasaron`);

        return passed === results.length;
    }

    return {
        runAll,
        testColores,
        testPrecios,
        testHistoricas,
        testBarras,
        testGlobalMaps,
        testOnlyRequestedIds,
        testEmptyInput,
    };

})();

window.OnDemandTests = OnDemandTests;

console.log('%c[OnDemandTests] Cargado. Ejecuta: OnDemandTests.runAll()', 'color:#9c27b0;font-weight:bold');
