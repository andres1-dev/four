# 🧠 AI CODE MAP (Functional Architecture for Agents)

> **MANDATORY RULE 0:** No agent (AI) is allowed to guess, hallucinate, or blindly search for a function, DOM ID, or logic. You MUST consult this document FIRST. This map describes at the code-line level what each module does and what state it mutates. Whenever an important workflow is changed or added that costs AI agents time to find, **YOU MUST UPDATE THIS FILE.**

## 🏛️ GENERAL ARCHITECTURE (Monolithic Vanilla JS)
The project uses a controlled global scope. **ALL STATE** lives in `js/config/constants.js`. Services use global callbacks/promises, the DOM is manipulated via direct browser APIs, and IDs must be strictly respected.

---

## 📂 1. CONFIGURATION & GLOBAL STATE LAYER (`js/config/`)

### 📄 `js/config/constants.js`
**Purpose:** The "Single Source of Truth" for global state and endpoint URLs. Never re-declare a state in another module.
**State Dependencies:** None, this is the origin.

- **Static Constants:**
  - `API_KEY` / `SPREADSHEET_ID`: Keys for the Google Sheets API v4.
  - `GAS_URL` / `SISPROWEB_GAS_URL` / `DISTRIBUTION_GAS_URL`: Google Apps Script Endpoints (Direct POSTs, no GETs).
  - `CONFIG_SHEETS`: Object holding names of "Dynamic Config" sheets.
  - `bodegasMap` / `tiposMap`: Static objects for rigid hardcoded mappings.

- **Maps & Matrices (The Application Data State):**
  - **Dynamic Maps (Google Sheets):** `escanersMap`, `proveedoresMap`, `auditoresMap`, `gestoresMap`, `coloresMap`, `data2Map`, `data2CountMap`, `data2JsonMap` (stores Batch/Lote JSONs), `preciosMap`, `sisproMap`, `historicasMap`, `clientesMap`.
  - **Active Data:** `processedData` (Current processed data), `currentOPData`.
  - **Transfers:** `cancelledTransfers` (Set), `transferListData`.
  - **Distribution:** `allRecData`, `allConfigData`, `activeMayoristas`, `empresasData`, `currentRecData`, `empresasDistributionState` (-1 by default).

- **Exported Setters:**
  - `setProcessedData(data)`, `setCurrentOPData`, `addCancelledTransfer`, `setAllRecData`, etc.
  - *Rule:* The entire reassignment of a Map is done using `setX(data)`. Individual item mutations are typically done using standard `get()` / `set()` methods of the native JS `Map` object directly.

---

## 📂 2. SERVICES LAYER - NETWORK MODE (`js/services/`)

### 📄 `js/services/csv-parser.js`
**Purpose:** Plain text parsing of CSV and generating Blobs for downloads. Does not touch global states. Avoids external libraries.
- `parseCSV(csvContent)`: Receives a text string, handles quotes (`"`) and semicolons (`;`). Returns a Matrix (`Array` of `Arrays`).
- `exportToCSV(data, filename)`: Receives an array of JSON objects, creates a `text/csv` Blob, injects a temporary `<a>` element in the DOM for auto-download, and cleans it up. Features hardcoded fixed columns (REFERENCIA, USUARIO, OP, etc.).

### 📄 `js/services/gas-service.js`
**Purpose:** Securely sending POST data (writes) to GAS endpoints.
**Strict Rule:** Requests are sent via `XMLHttpRequest` with `Content-Type: application/x-www-form-urlencoded`. `fetch` is NEVER used for saving OPs and Distribution.
- `saveOPToSheets(jsonData)`: Sends JSON data encapsulated in the `action=guardarOP` formData to `GAS_URL` with a 30,000ms timeout. Returns a `Promise`.
- `sendToDistributionGAS(data)`: Sends string formData to `DISTRIBUTION_GAS_URL`. *Functional trait:* It resolves the Promise ignoring the exact response content as long as the HTTP status is received, assuming a "fire and forget" logic on eventual timeouts.

### 📄 `js/services/google-sheets.js`
**Purpose:** Massive operations invoking direct API v4 reads and writing to the Orders/Sispro system. Exports everything to the Global Window.
**State it mutates:** Directly modifies most Maps inside `constants.js` via calls to Setters (`setEscanersMap()`, etc.) or `.clear()`/`.set()`.

**Base Reading Flow (GET API v4):**
- `fetchSheetData(range)`: Uses native `fetch()` towards `https://sheets.googleapis.com/v4/...`. Returns JSON containing the `.values` array.
- **Asynchronous Loadings with Timeout (Batch Size = 1000):** To prevent DOM freezing. Mutates the designated Map.
  - `loadUsuariosData()`, `loadProveedoresData()`, `loadAuditoresData()`, `loadGestoresData()`. Mutates the Map's *value* into string `"TRUE"`.
  - `loadColoresData()`, `loadPreciosData()`, `loadHistoricasData()`, `loadSisproData()`, `loadClientesData()`.
  - `loadData2Data()`: *Complex logic here.* Evaluates OP, Date, Quantity from the `DATA2` Sheet. Parses JSON strings from Column 18 (S) in Google Sheets to extract "LOTES" and tracks the rows.
  - `loadPedidosData()`, `loadFinalizadosData()`.

**Distribution Verification Flow:**
- `checkIfRecExists(recNumber)`: Queries `DISTRIBUTION_SHEET_NAME!A:A`.
- `verifyDocumentSavedExhaustive(...)`: Max-retries loop natively implemented (no external libs) aiming to read the Google Sheets back to confirm data survival.

**Alternative Write Flow (POST Fetch):**
- `agregarPedidoASheets(pedido)`, `actualizarPedidoEnSheets`, `eliminarPedidoDeSheets`, `finalizarPedidoEnSheets`. Uses `fetch()` targeting the URL `SISPROWEB_GAS_URL`.
- `saveNewSISPROWEBData(data)` / `saveNewColorData(data)`: Append clean, brand-new entries.

*(Note: At the end of the file `window.property = method` exposes all functions globally)*

---

## 📂 3. CORE LAYER (Initialization & Base DOM) (`js/core/`)

### 📄 `js/core/app-init.js`
**Purpose:** Main startup orchestrator.
**Dependencies:** Executes promises from `google-sheets.js` and exposes global functions.
- `initializeApp()`: Sets up listeners, tabs, notifications. Flags `distributionInitialized = true` and fires `loadDataFromSheets()`.
- `loadDataFromSheets(silent)`: The loading engine. Shows `#quick-loading` modal. Blocks UI (`#processBtn`). Loads `loadAllConfigData()` (dynamic sheets). Fires `Promise.all` across Maps (Colores, data2, Precio, Sispro, Historicas, Clientes). Finally initializes Distribution, Orders, and Printing logic.
- `loadDataAfterSave(silent)`: **Critical Optimization**. Executed post-OP save. *ONLY reloads DATA2*, Distribution, and Printing variables, bypassing gigantic loads like SISPROWEB to save bandwidth.
- `updateDataStats()`: Injects DOM (`stat-colores`, `stat-ops`, etc.) counting the current real `.size` of `constants.js` Maps.

### 📄 `js/core/event-listeners.js`
**Purpose:** Delegate main UI event listeners.
**Mapped DOM:** `#csvFile`, `#uploadBox`, `#settingsBtn`, `#exportCancelledBtn`, `#importCancelledBtn`.
- `setupFileUploadListeners()`: Detects clicks and drag/drops from visual `#uploadBox` redirecting to `#csvFile` input. Triggers `processCSV()` using a 500ms `setTimeout`.

### 📄 `js/core/theme.js`
**Purpose:** Manage Visual Studio Code styling (Dark/Light themes).
**Mutates:** `localStorage('vscode-theme')`, `<body class="vscode-dark">`, and `#themeToggle` icon.

---

## 📂 4. UTILITIES LAYER (Pure Functions & Getters) (`js/utils/`)

### 📄 `js/utils/formatters.js`
**Purpose:** Visual formatting without side effects (Pure Functions).
- `formatCellValue`, `formatCosto`, `formatCurrency`, `formatNumber`, `formatPercentage`.
- `formatDate` and `normalizeFecha`: Force uniform text formatting into `DD/MM/YYYY`. Supports "19/3/2026 12:00:00" truncations.

### 📄 `js/utils/logger.js`
**Purpose:** **ABSOLUTE DEFENSE FRONTLINE FOR DEBUGGING**. Permanently replaces `console.log`.
- Injects a DOM `#logContainer` dynamically. Keeps trailing arrays up to 1000 logs max.
- Public Methods: `Logger.info`, `.warn`, `.error`, `.success`, `.toggle`, `.clear`, `.export`.
- Its visible interface is hidden by default. Use `Ctrl+Shift+L` globally to pop it open. (Note: `.error` and `.warn` still echo cleanly to native `console` for extreme safety).

### 📄 `js/utils/performance.js`
**Purpose:** Optimization tools avoiding GC stalls and memory leaks.
**Window Exports:** Wrapped in `window.performanceUtils`.
- Tools: `debounce`, `throttle`, `memoize`, `processInBatches`, `lazyLoad`, `delegateEvent`, `cleanupLargeObject`, `startTimer`, `batchDOMUpdates`, `concatStrings`, `getWithCache`. (Mandatory for huge CSV rendering operations).

### 📄 `js/utils/helpers.js`
**Purpose:** Massive business wrappers, parsing logics, and Global Map getters.
- **Normalization:** `normalizeBodega`, `normalizeTipo`, `normalizeText` (strips accents and strange encoding chars). `limpiarTextoPromocion`.
- **State Getters:** `getRepresentativeItem`, `getSisproData(op)`, `getColorName`, `getPvp`, `getReferenciaHistorica`, `getClienteData`. These safely search internal state avoiding hard nulls.
- **OP Status Validation:** `validarEstado()`: Joins `${OP}|${Fechanormalizada}|${Cantidad}` querying `data2Map.has()`. Concludes "PENDIENTE" (Pending) or "CONFIRMADA" (Confirmed).
- **🚨 `validarEstadoParcial(lote, traslado, totalGeneral, cantidad)`:** The advanced "PARTIAL" validation core.
  - Recursively checks `data2JsonMap` (Historic JSON nested arrays parsed previously from **DATA2 Column S**).
  - Determinations:
    - `{rechazar: true, tipo: 'REPETIDO'}`: Blocked because the `traslado` (Transfer ID) is already processed in the historic JSON.
    - `{rechazar: true, tipo: 'RECHAZADO', mensaje: 'Lote cerrado'}`: Blocked because `saldoRestante = (TOTAL_GENERAL - acumulado_historico)` is mathematically smaller than the new CSV `cantidad`.
    - `{esParcial: true, sufijo: 'LOTE.X'}`: Passed! Partial allowance. Renames the OP logically creating branches ("2425 LOTE.1") without destroying the maestro JSON history.

---

## 📂 5. BUSINESS MODULES LAYER (`js/modules/`)

### 📄 `js/modules/data-processing.js`
**Purpose:** Heavy lifting module. Tears through raw array rows parsed from CSVs, cleaning them and dropping the networking hooks.
**State Dependencies:** Heavy access across all Maps via `constants.js` (Escaners, Cancelled Transfers).
- `processCSV()`: The trigger. Binds to `#csvFile`, blocks UI panels, runs `parseCSV()`, keeping output inside `lastCsvRows` for ultra-fast re-processing.
- **🚨 `processCSVData(rows)`:** The heaviest processing engine. Hardcoded Array Index scanning (from 0 to 37+):
  1. *First Pass (Extracting Unit Costs):* Sweeps `rows`. Exclusive validation filter:
     - **Bodega** (`row[14]`) == `'PR'`, **Tipo** (`row[3]`) == `'TR'`. **Usuario** (`row[1]`) must exist in `escanersMap`.
     - Synthesizes the group Key: `${row[2]}`(OP) | `${row[11]}`(Talla) | `${row[12]}`(Color).
     - Extracts fundamental financial and auditing variables: Costo (`row[10]`), OS (`row[13]`), CC (`row[37]`).
  2. *Second Pass (Extracting Valid 'TR' Data):*
     - Reverse filter mapping: **Bodega** (`row[14]`) !== `'PR'` AND **Tipo** (`row[3]`) == `'TR'`.
     - Soft Drops: Discards `row[7]` if found inside `cancelledTransfers` avoiding phantom saves.
     - Live Verification: Ensures **OP (`row[2]`)** exists natively in `sisproMap`, and **Color Code (`row[12]`)** is valid via `coloresMap`. If missing data is detected, stores it in sets and breaks the loop halting UI pushing the `showMissingDataModal()`.
  3. *Partial Logic Injection & Final Grouping:* Dispatches OP to `validarEstadoParcial(row[2], row[7], row[19], row[9])`. If mathematically rejected, OP goes silently to `opErrors`. If passed, OP receives a `.OP_SUFIJO` (e.g., `2425 LOTE.1`).
     - Identical rows deduplicate and accumulate math for `CANTIDAD` (`row[9]`) under a mega-string dictionary key: `${op}|${referencia}|${talla}|${codColorOriginal}|${bodega}`.
- Invokes `setProcessedData(Array)` dropping control back.

### 📄 `js/modules/distribution.js`
**Purpose:** Mathematical scaling engine. Calculates mandatory fractions (30% logic) vs Wholesaler specific customized amounts.
**Mapped DOM:** Dynamically creates countless elements (`document.getElementById`) appending IDs procedurally.
- `cargarTodosLosDatos()`: Performs raw `GET` directly to Google Sheets API bypassing helpers, looking specifically deep inside **Column S** arrays, parsing into a giant `allRecData` schema map.
- `generateEmpresasUI()` / `generateMayoristasUI()`: Renders interactive manual fields dynamically (`#empresa-XX`) iterating states bounded into `empresasData` & `activeMayoristas`. Checkbox driven logic.
- **🚨 `updateAllDistributionValues()`:** Core mathematical calculation routing.
  - Aggregates Size/Color capacities tracking live parsed items directly.
  - Scans user manually selected "Mayoristas" (Wholesalers - absolute unit demands).
  - Operates over the remaining absolute fractions (*Available*) computing logical overrides applying user-supplied % values to "Secondary" distribution slots simulating required deductions (Merma forzada).
  - Final leftover chunk mathematically drops safely to the entity tagged internally as the `Principal` actor.
  - Modifies exact `.textContent` DOM values efficiently wrapping the updates via `forEach()` instead of tearing down nodes.

### 📄 `js/modules/op-editor.js`
**Purpose:** Live visual DOM UI manipulating processed OP metrics before dispatching the HTTP save process.
**Mapped DOM:** Handles `document.getElementById` for (`#proveedor`, `#auditor`, `#pvpEdit`, etc).
- `loadOPData()`: Fills drop-downs from global definitions querying dynamically. It inherently extracts and defaults the `USUARIO` value scanning from the originally read CSV dataset automatically finding matches.
- `renderResumenBodegas()`: Live HTML table compilation classifying row behaviors splitting dynamically grouped categories (`PRIMERAS`, `PROMOCIONES`, `COBROS`, `SIN CONFECCIONAR`), pushing editable inputs linked locally modifying cost indexes individually across rows.
- **🚨 `generateJSONForOP()`:** Re-assembles all fields and input checks validating strictly.
  - Critical Financial Rule: The designated Warehouse **`SIN CONFECCIONAR` (ZY)** *NEVER* adds mathematical density towards the total accounting variables like `costoTotal` and strictly forbids `COSTO_UNITARIO`. Its unit cost is bypassed forcing it rigidly to `0`.
  - Master Structural Architecture built on the fly:
    - **HR (Basic Roadmap Array):** Captures EXCLUSIVELY lines possessing the designated `'PRIMERAS'` warehouse marker using strict arrays: `[COD_COLOR, COLORES, TALLA, CANTIDAD]`.
    - **ANEXOS:** An expanded auxiliary dictionary parsing out and archiving custom sub-categories `'PROMOCIONES'`, `'COBROS'`, and `'SIN CONFECCIONAR'` wrapping data identifying internal Transfers, effectively separating accounting categories for backend tracking metrics later.
    - Yields locked global verification integers representing absolute outputs: `TOTAL_RELATIVO` (Full+Promo+Cobros), `TOTAL_GENERAL` (Everything incl. Sin confeccionar) and subtraction discrepancies (`DIFERENCIA`).
  - Calls `syntaxHighlightJSON` natively painting stringified outputs inside the UI rendering before ultimately dispatching HTTP queries using `saveToSheets()`.

### 📄 `js/modules/orders.js`
**Purpose:** Miniature CRM panel handling Active/Finished status updates strictly controlling interaction with Wholesalers.
- Binds arrays internally managing references inside `pedidosMap` / `finalizadosMap`.
- Drives table generation dynamically interacting straight into GAS targets via native HTTP commands calling helpers to CREATE, EDIT, FINISH items.
- Leverages immediate validation pipelines injecting `onModalOpChange(val)` listening continuously typing events validating data chunks cross-checking global `sisproMap` registries blocking broken submits efficiently.
- `mostrarModalPedidosParaLote(lote)`: Distribution logic integration tracking exactly how many pending wholesale tasks an OP mathematically holds resolving bottlenecks avoiding duplicates effectively.

### 📄 `js/modules/transfers.js`
**Purpose:** Isolated logical block strictly guarding Local Storage caches controlling Cancellation directives bypassing cloud dependencies.
- Segregates anything bearing a recognized `TRASLADO` pattern from parsed lines filtering specifically.
- `toggleTransferCancellation()`: Adds or Removes targets tracking actively the internally maintained `cancelledTransfers` Set locking patterns directly pushing changes to `localStorage` ignoring browser wiping sequences ensuring long term blocks over specific Transfer ID payloads preventing double operations. Drives import/export hooks handling native JSON files.

---
 
 ## 📂 6. PRINTING LAYER (Logic & Templates) (`js/printing/`)

### 📄 `js/printing/printing.js`
**Purpose:** Proxy bridge connecting modern structural patterns with domain-specific printing logic. Handles `print_cargarDatos`, `print_buscarPorREC`, etc.

### 📄 `js/printing/printing-templates.js`
**Purpose:** Storage for HTML/CSS templates used in printed documents.

### 📄 `js/printing/printing-search.js` & `printing-main.js`
**Purpose:** Legacy logic for document searching and print orchestrating.

---

## 🎨 7. USER INTERFACE LAYER (`js/ui/`)

### 📄 `js/ui/missing-data-modal.js`
**Purpose:** Critical blocker forcing active logical corrections blocking downstream workflows missing mapping definitions inside internal sheets.
- Stacks internal callback logic resolving pending actions chaining promises pushing blocking constraints checking `currentMissingData.onComplete`.
- `showMissingDataModal(ops, colores)`: Dual functional Modal. Permits explicit parsing matching VLookup algorithms extracting metadata resolving logic natively handling Excel (`.xlsx`) drops saving users time parsing inputs manually avoiding typos natively.
- Calls `saveNewSISPROWEBData(array)` launching requests to specific GAS Endpoints natively pushing results handling.

### 📄 `js/ui/sispro-update-modal.js`
**Purpose:** Deep injection UI system handling bulk upload updates pushing changes. Bypasses single entries managing thousands of objects effectively crossing (`.xlsx`) datasets against deep internal maps avoiding redundancies tracking (`seen.has()`) logics finding missing hooks specifically.
- Paints visual mathematical previews counting specifically new items ignoring repeats validating sizes dropping UI lists before calling network.

### 📄 `js/ui/results-display.js`
**Purpose:** Manages `#selectOP` DOM element. Pushes lists visually separating groups extracting datasets directly pushing UI logic post CSV parses natively dropping values targeting drop downs.
- *Key Feature:* Detects logically split payloads applying visually parsed branching indicators injecting specifically the icon `↳ OP: 2425 LOTE.1` appending invisible mapped data definitions using HTML5 `.dataset.items`.

### 📄 `js/ui/tabs.js`
**Purpose:** Architecturally mimics Visual Studio Code layout styling handling interactions cross communicating events binding main panels natively driving left bar clicks linking elements explicitly swapping CSS behaviors natively bypassing heavy frameworks pushing pure DOM loops handling tab closings logically effectively maintaining memory low natively.

### 📄 `js/ui/json-editor.js`
**Purpose:** Captures final JSON definitions formatting specific regex injections producing visual representations parsing strings natively applying `syntaxHighlightJSON` coloring classes directly injecting toggling capabilities mapping text copying native behaviors handling button callbacks handling UI natively.

### 📄 `js/ui/notifications.js` & `status-bar.js`
**Purpose:** Completely intercepts rigid Javascript API natively removing standard Chrome browser pop ups bypassing generic dialogs pushing HTML logic natively.
- `showMessage()` arrays floating specific timed boxes fading effectively handling class overrides blocking overlaps effectively replacing annoying prompts seamlessly natively handling limits enforcing 3 concurrent dialogues natively restricting memory flows blocking overflows efficiently.
- `status-bar`: Clocks cycles counting loading algorithms appending strings imitating aesthetics explicitly simulating variables injecting loading gears spinning handling states like `⏱ 4.2s`.

### 📄 `js/ui/quick-confirm.js` & `modals.js`
**Purpose:** Deep pure DOM manipulation dynamically generating masked elements generating objects dynamically binding `createModal` loops isolating scopes mapping HTML logic natively parsing strings destroying classes removing event listeners preventing native leaks effectively replacing external library logic creating custom components native strictly enforcing layouts matching global aesthetic rules rigidly.
- `showQuickConfirm()` natively outputs logic waiting on active promises returning resolved booleans blocking heavy destructive actions actively protecting native data preventing overrides preventing crashes parsing native calls actively locking destructive paths tracking workflows effectively forcing decisions.

### 📄 `js/script.js`
**Purpose:** THE MASTER LOADER. It behaves similarly to how `styles.css` handles CSS imports. It uses a private IIFE to sequentially inject all application `<script>` tags into the DOM head, ensuring strict dependency order (Config > Utils > Services > UI > Core > Modules > Printing). **This is the ONLY script tag allowed in `index.html`.**

### 📄 `js/core/app.js`
**Purpose:** The main application orchestrator (Logic). It manages `DOMContentLoaded`, initializes `setupAllEventListeners`, and handles the final `initializeApp` call. It also integrates module-specific listeners (Printing/Orders) previously located in the HTML.

---

## 🏁 AI AGENT INSTRUCTIONS (READ CAREFULLY)

If you are an AGENT and you are reading this file, **you have completed your Mandatory Context Grounding Phase.**
1. **Never edit `constants.js`** unless absolutely explicitly necessary to add a totally new business concept map.
2. All computationally heavy mathematics occur inside `data-processing.js` or `distribution.js`. Do not re-calculate totals in the UI components.
3. All the direct DOM injections, animations, and modals must reside solely in the `js/ui/` folder.
4. Information delivery to Google Server strictly relies on the `XMLHttpRequest` pattern wrapped in Promises located in `gas-service.js` and `google-sheets.js`.

> "Do not invent IDs. Do not hallucinate state logic. Adhere strictly to the established monolithic architecture."
