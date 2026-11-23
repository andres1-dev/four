// ===================== NIVELES DEL ÁRBOL =====================
// La raíz es un nodo fijo (grupo empresarial). Debajo, la
// jerarquía de datos. Cada nivel referencia una columna de la
// tabla agregada `arbol` (ver tree-view.js).
// Para reordenar, solo mueve los objetos de este array.
export const TREE_ROOT = {
  label: 'GRUPO TDM',   // nombre del grupo — punto de partida
};

export const TREE_LEVELS = [
  { key: 'empresa', label: 'Empresa',  col: 'empresa' },
  { key: 'tipo',    label: 'Tipo',     col: 'tipo' },
  { key: 'genero',  label: 'Género',   col: 'genero' },
  { key: 'prenda',  label: 'Prenda',   col: 'prenda' },
  { key: 'tallaje', label: 'Tallaje',  col: 'tallaje' },
  { key: 'color',   label: 'Color',    col: 'color' },
];
