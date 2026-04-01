// Configuración del administrador de curvas

const CurvaConfig = {
  SUPABASE_URL: "https://djgnfyglyvlfhnhvpzxy.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqZ25meWdseXZsZmhuaHZwenh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODk2NTYsImV4cCI6MjA5MDU2NTY1Nn0.sp6O2dvU8Lo3_toGnxyL9KTYaw55gxuLtsXKUXBUjbE",
  
  // Configuración del Excel
  HEADER_ROW: 1,  // Fila 2 (índice 1) contiene los headers
  DATA_START_ROW: 2,  // Datos empiezan en fila 3 (índice 2)
  
  // Columnas del Excel (índices base 0)
  COLUMNS: {
    REFERENCIA: 1,    // Columna B
    DESCRIPCION: 2,   // Columna C
    OP: 3,            // Columna D
    CANTIDAD: 8,      // Columna I
    ID_COLOR: 11,     // Columna L
    COLOR: 12,        // Columna M
    TALLAS_START: 14  // Columna O (índice 14)
  },
  
  // Configuración de carga
  BATCH_SIZE: 50,  // Registros por lote
  DELAY_BETWEEN_BATCHES: 100  // ms entre lotes
};

// Cliente Supabase
const supabaseCurva = supabase.createClient(
  CurvaConfig.SUPABASE_URL, 
  CurvaConfig.SUPABASE_KEY
);
