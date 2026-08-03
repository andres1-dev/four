/**
 * Date Utilities
 */

function normalizeDate(date) {
    if (!date) return null;
    if (date.includes('/')) {
        const [day, month, year] = date.split('/');
        const dd = day.padStart(2, '0');
        const mm = month.padStart(2, '0');
        return new Date(`${year}-${mm}-${dd}T00:00:00-05:00`).toISOString().split('T')[0];
    }
    if (date.includes('-')) {
        return new Date(`${date}T00:00:00-05:00`).toISOString().split('T')[0];
    }
    return null;
}

function formatDate(date) {
    if (!date) return '';
    const d = date instanceof Date ? date : new Date(date);
    const offset = d.getTimezoneOffset() + 300;
    const colombiaTime = new Date(d.getTime() + offset * 60000);
    const day = String(colombiaTime.getDate()).padStart(2, '0');
    const month = String(colombiaTime.getMonth() + 1).padStart(2, '0');
    return `${day}/${month}/${colombiaTime.getFullYear()}`;
}

function parseDate(dateStr) {
    if (!dateStr) return null;
    if (dateStr instanceof Date) return isNaN(dateStr.getTime()) ? null : dateStr;
    if (typeof dateStr === 'number') return new Date(dateStr);
    if (typeof dateStr === 'string') {
        const cleanStr = dateStr.trim().split(' ')[0].split('T')[0];
        if (cleanStr.includes('/')) {
            const parts = cleanStr.split('/');
            if (parts.length === 3) {
                const [day, month, year] = parts;
                const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00-05:00`);
                if (!isNaN(d.getTime())) return d;
            }
        }
        if (cleanStr.includes('-')) {
            const parts = cleanStr.split('-');
            if (parts.length === 3) {
                const [year, month, day] = parts;
                const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T00:00:00-05:00`);
                if (!isNaN(d.getTime())) return d;
            }
        }
        const fallback = new Date(dateStr);
        if (!isNaN(fallback.getTime())) return fallback;
    }
    console.error(`Formato de fecha no reconocido: ${dateStr}`);
    return null;
}

function getNombreMes(fecha) {
    const meses = [
        'ENERO', 'FEBRERO', 'MARZO', 'ABRIL', 'MAYO', 'JUNIO',
        'JULIO', 'AGOSTO', 'SEPTIEMBRE', 'OCTUBRE', 'NOVIEMBRE', 'DICIEMBRE'
    ];
    try {
        const d = parseDate(fecha);
        return meses[d.getMonth()];
    } catch (e) {
        console.error(`Error al obtener mes de fecha: ${fecha}`, e);
        return 'ENERO';
    }
}

function getNombreMesCorto(fecha) {
    const meses = [
        'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun',
        'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'
    ];
    try {
        const d = parseDate(fecha);
        return meses[d.getMonth()];
    } catch (e) {
        return 'Ene';
    }
}

function getDiaSemana(fecha) {
    if (!fecha) return 'SIN FECHA';
    const dias = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
    const d = parseDate(fecha);
    if (!d) return 'SIN DÍA';
    const offset = d.getTimezoneOffset() + 300;
    const colombiaTime = new Date(d.getTime() + offset * 60000);
    return dias[colombiaTime.getDay()] || 'SIN DÍA';
}

function getWeekNumber(date) {
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
    const week1 = new Date(d.getFullYear(), 0, 4);
    return 1 + Math.round(((d - week1) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
}

function normalizarInicio(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 0, 0, 0, 0);
}

function normalizarFin(fecha) {
    return new Date(fecha.getFullYear(), fecha.getMonth(), fecha.getDate(), 23, 59, 59, 999);
}

function parseFechaLocal(fechaStr) {
    if (fechaStr.includes("T")) {
        return new Date(fechaStr);
    }
    const [y, m, d] = fechaStr.split("-").map(Number);
    return new Date(y, m - 1, d);
}

function toFechaLocalYYYYMMDD(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
