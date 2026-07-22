export const t2m = t => { if (!t) return 0; const [h, m] = t.split(':').map(Number); return h * 60 + m; };
export const m2t = m => { const a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60; return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`; };
export const fmt = m => { if (m === 0) return '0h 00m'; const a = Math.abs(m), h = Math.floor(a / 60), mm = a % 60; return `${m < 0 ? '−' : ''}${h}h ${String(mm).padStart(2, '0')}m`; };

export const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const fmtDate = d => { if (!d) return '—'; const [y, mo, dy] = d.split('-'); return `${parseInt(dy)} ${MONTHS[parseInt(mo) - 1]} ${y}`; };

export const getToday = () => new Date().toISOString().slice(0, 10);

export function weekDates(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay();
  const diff = (day === 0 ? -6 : 1 - day);
  const mon = new Date(now);
  mon.setDate(now.getDate() + diff + offsetWeeks * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return d.toISOString().slice(0, 10);
  });
}

export function weekLabel(offsetWeeks = 0) {
  const dates = weekDates(offsetWeeks);
  const a = new Date(dates[0]), b = new Date(dates[4]);
  return `${a.getDate()} – ${b.getDate()} ${MONTHS[b.getMonth()]} ${b.getFullYear()}`;
}

// El cómputo de horas vive en calc.js (origen único compartido con ClapCrew).
export { calcRec, calcActorRec, calcRecForEmp, calcPeriod } from './calc';

export const DAY_NAMES = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

export const ABS_MAP = {
  baja: '🏥 Baja médica',
  vacaciones: '🌴 Vacaciones',
  festivo: '🎉 Festivo',
  permiso: '📋 Permiso',
};
