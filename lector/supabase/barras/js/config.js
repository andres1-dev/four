// Configuración del administrador

const AdminConfig = {
  SUPABASE_URL: "https://djgnfyglyvlfhnhvpzxy.supabase.co",
  SUPABASE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImRqZ25meWdseXZsZmhuaHZwenh5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5ODk2NTYsImV4cCI6MjA5MDU2NTY1Nn0.sp6O2dvU8Lo3_toGnxyL9KTYaw55gxuLtsXKUXBUjbE",
  
  // Columnas del Excel
  COLUMNS: {
    REFERENCIA: 0,  // Columna A
    TALLA: 1,       // Columna B
    ID_COLOR: 2,    // Columna C
    BARCODE: 11     // Columna L
  },
  
  // Configuración de carga
  BATCH_SIZE: 50,  // Registros por lote
  DELAY_BETWEEN_BATCHES: 100  // ms entre lotes
};

// Cliente Supabase
const supabaseAdmin = supabase.createClient(
  AdminConfig.SUPABASE_URL, 
  AdminConfig.SUPABASE_KEY
);
