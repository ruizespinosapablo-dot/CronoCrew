import { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';

// Tasas SS 2026
const SS_TRAB = 0.0655;  // 4.70 + 1.60 + 0.10 + 0.15
const SS_EMP  = 0.3335;  // 23.60 + 1.50 + 6.70 + 0.60 + 0.20 + 0.75

function daysInMonth(year, month) {
  return new Date(year, month, 0).getDate();
}

// Días del mes en los que el contrato del empleado está activo
function contractDaysInMonth(emp, year, month) {
  const total = daysInMonth(year, month);
  if (!emp.cStart) return total;
  const firstDay = new Date(year, month - 1, 1);
  const lastDay  = new Date(year, month - 1, total);
  const cStart   = new Date(emp.cStart + 'T12:00:00');
  const cEnd     = emp.cEnd ? new Date(emp.cEnd + 'T12:00:00') : null;
  const rangeStart = cStart > firstDay ? cStart : firstDay;
  const rangeEnd   = cEnd && cEnd < lastDay ? cEnd : lastDay;
  if (rangeEnd < rangeStart) return 0;
  return Math.round((rangeEnd - rangeStart) / 86400000) + 1;
}

function calcNomina(emp, extMinutes, year, month) {
  if (emp.brutoMes == null) return null;

  const total   = daysInMonth(year, month);
  const active  = contractDaysInMonth(emp, year, month);
  const prorata = active / total;

  const brutoFijo    = emp.brutoMes * prorata;
  const extrasBruto  = (extMinutes / 60) * (emp.tarifaHoraExt || 0);
  const devengado    = brutoFijo + extrasBruto;

  const baseSS   = (emp.brutoMes - (emp.exentoSS || 0)) * prorata + extrasBruto;
  const baseIRPF = baseSS - (emp.exentoIRPF || 0) * prorata;

  const ssTrab   = baseSS   * SS_TRAB;
  const irpf     = Math.max(0, baseIRPF) * ((emp.irpfPct || 0) / 100);
  const descFijo = (emp.descNomina || 0) * prorata;

  const neto     = devengado - descFijo - ssTrab - irpf;
  const ssEmp    = baseSS * SS_EMP;
  const costeEmp = devengado - descFijo + ssEmp;

  return {
    prorata, brutoFijo, extrasBruto, devengado,
    baseSS, baseIRPF: Math.max(0, baseIRPF),
    ssTrab, irpf, descFijo,
    neto, ssEmp, costeEmp,
    extMinutes,
  };
}

const € = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
const pct = (n) => n.toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + '%';

function exportCSV(rows, monthLabel) {
  const header = [
    'Empleado', 'Días', 'Bruto fijo', 'Extras', 'Devengado',
    'Base SS', 'SS trabajador', 'Base IRPF', 'IRPF',
    'Dto. nómina', 'Neto', 'SS empresa', 'Coste empresa',
  ];
  const lines = rows.map(r => [
    r.emp.name,
    (r.calc.prorata * daysInMonth(...r.ym)).toFixed(0),
    r.calc.brutoFijo.toFixed(2),
    r.calc.extrasBruto.toFixed(2),
    r.calc.devengado.toFixed(2),
    r.calc.baseSS.toFixed(2),
    r.calc.ssTrab.toFixed(2),
    r.calc.baseIRPF.toFixed(2),
    r.calc.irpf.toFixed(2),
    r.calc.descFijo.toFixed(2),
    r.calc.neto.toFixed(2),
    r.calc.ssEmp.toFixed(2),
    r.calc.costeEmp.toFixed(2),
  ].join(';'));
  const csv = [header.join(';'), ...lines].join('\n');
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cierre_${monthLabel}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function CierreMensual() {
  const { emps, paid } = useApp();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [showConfig, setShowConfig] = useState(false);

  const [year, month] = selectedMonth.split('-').map(Number);
  const monthLabel = new Date(year, month - 1, 1)
    .toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });

  const activeEmps = useMemo(() =>
    emps.filter(e => {
      if (e.brutoMes == null) return false;
      // Incluir si el contrato tiene actividad en el mes seleccionado
      const active = contractDaysInMonth(e, year, month);
      return active > 0;
    }).sort((a, b) => a.name.localeCompare(b.name)),
    [emps, year, month]
  );

  const rows = useMemo(() => activeEmps.map(emp => {
    const extMinutes = paid
      .filter(p => p.eid === emp.id && p.month === selectedMonth)
      .reduce((sum, p) => sum + (p.extMin || 0), 0);
    const calc = calcNomina(emp, extMinutes, year, month);
    return { emp, calc, ym: [year, month] };
  }), [activeEmps, paid, selectedMonth, year, month]);

  const totals = useMemo(() => rows.reduce((acc, r) => {
    const c = r.calc;
    return {
      devengado:  acc.devengado  + c.devengado,
      ssTrab:     acc.ssTrab     + c.ssTrab,
      irpf:       acc.irpf       + c.irpf,
      descFijo:   acc.descFijo   + c.descFijo,
      neto:       acc.neto       + c.neto,
      ssEmp:      acc.ssEmp      + c.ssEmp,
      costeEmp:   acc.costeEmp   + c.costeEmp,
    };
  }, { devengado: 0, ssTrab: 0, irpf: 0, descFijo: 0, neto: 0, ssEmp: 0, costeEmp: 0 }), [rows]);

  const sinConfig = emps.filter(e => e.brutoMes == null && !e.cEnd).length;

  return (
    <>
      <div className="ph">
        <div>
          <h1>Cierre mensual</h1>
          <p>Cálculo de nóminas · {monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <input
            type="month"
            value={selectedMonth}
            onChange={e => setSelectedMonth(e.target.value)}
            style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 10px', color: 'var(--text)', fontSize: 13 }}
          />
          {rows.length > 0 && (
            <button className="btn-sm" onClick={() => exportCSV(rows, selectedMonth)}>
              ↓ Exportar CSV
            </button>
          )}
        </div>
      </div>

      {/* Aviso empleados sin configurar */}
      {sinConfig > 0 && (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--by)', borderRadius: 8, padding: '10px 14px', marginBottom: '1rem', fontSize: 13, color: 'var(--text2)' }}>
          ⚠️ {sinConfig} empleado{sinConfig !== 1 ? 's' : ''} sin salario configurado — edítalos en la pestaña Empleados para incluirlos aquí.
        </div>
      )}

      {rows.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text3)', fontSize: 13, fontStyle: 'italic' }}>
          No hay empleados con salario configurado para este mes.
        </div>
      ) : (
        <>
          {/* Tabla principal */}
          <div className="tc" style={{ marginBottom: '1.5rem', overflowX: 'auto' }}>
            <table style={{ minWidth: 900 }}>
              <thead>
                <tr>
                  <th style={{ textAlign: 'left' }}>Empleado</th>
                  <th>Días</th>
                  <th>Bruto fijo</th>
                  <th style={{ color: 'var(--purple)' }}>Extras</th>
                  <th>Devengado</th>
                  <th style={{ color: 'var(--coral)' }}>SS trab.</th>
                  <th style={{ color: 'var(--coral)' }}>IRPF</th>
                  <th style={{ color: 'var(--teal)', fontWeight: 700 }}>Neto</th>
                  <th style={{ color: 'var(--text3)' }}>Coste empresa</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ emp, calc }) => {
                  const dias = Math.round(calc.prorata * daysInMonth(year, month));
                  const total = daysInMonth(year, month);
                  return (
                    <tr key={emp.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{emp.name}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)' }}>{emp.role} · {emp.dept}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 12 }}>
                        {dias}/{total}
                        {dias < total && <span style={{ display: 'block', fontSize: 10, color: 'var(--by)' }}>pro-rata</span>}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13 }}>{€(calc.brutoFijo)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, color: calc.extrasBruto > 0 ? 'var(--purple)' : 'var(--text3)' }}>
                        {calc.extrasBruto > 0 ? €(calc.extrasBruto) : '—'}
                        {calc.extMinutes > 0 && calc.extrasBruto === 0 && (
                          <span style={{ display: 'block', fontSize: 10, color: 'var(--coral)' }}>sin tarifa</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 13, fontWeight: 600 }}>{€(calc.devengado)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--coral)' }}>−{€(calc.ssTrab)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--coral)' }}>
                        −{€(calc.irpf)}
                        <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)' }}>{pct(emp.irpfPct || 0)}</span>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 14, fontWeight: 700, color: 'var(--teal)' }}>{€(calc.neto)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>{€(calc.costeEmp)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr style={{ borderTop: '2px solid var(--border2)', fontWeight: 700 }}>
                  <td colSpan={2} style={{ fontSize: 13, color: 'var(--text2)' }}>{rows.length} empleados</td>
                  <td />
                  <td />
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{€(totals.devengado)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--coral)' }}>−{€(totals.ssTrab)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--coral)' }}>−{€(totals.irpf)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace', color: 'var(--teal)', fontSize: 15 }}>{€(totals.neto)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'monospace' }}>{€(totals.costeEmp)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Resumen */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
            {[
              { label: 'Total devengado', value: €(totals.devengado), color: 'var(--text)' },
              { label: 'SS trabajadores', value: '−' + €(totals.ssTrab), color: 'var(--coral)' },
              { label: 'IRPF retenido', value: '−' + €(totals.irpf), color: 'var(--coral)' },
              { label: 'Total neto a pagar', value: €(totals.neto), color: 'var(--teal)', bold: true },
              { label: 'SS empresa', value: €(totals.ssEmp), color: 'var(--text2)' },
              { label: 'Coste total empresa', value: €(totals.costeEmp), color: 'var(--accent)', bold: true },
            ].map(card => (
              <div key={card.label} className="card-section" style={{ padding: '1rem', textAlign: 'center' }}>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>{card.label}</div>
                <div style={{ fontFamily: 'monospace', fontSize: 16, fontWeight: card.bold ? 700 : 500, color: card.color }}>{card.value}</div>
              </div>
            ))}
          </div>

          {/* Detalle bases cotización */}
          <details style={{ marginBottom: '1.5rem' }}>
            <summary style={{ cursor: 'pointer', fontSize: 13, color: 'var(--text2)', padding: '8px 0', userSelect: 'none' }}>
              Ver detalle de bases de cotización
            </summary>
            <div className="tc" style={{ marginTop: '0.75rem', overflowX: 'auto' }}>
              <table style={{ minWidth: 700 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'left' }}>Empleado</th>
                    <th>Base SS</th>
                    <th>SS trab. ({(SS_TRAB * 100).toFixed(2)}%)</th>
                    <th>SS empresa ({(SS_EMP * 100).toFixed(2)}%)</th>
                    <th>Base IRPF</th>
                    <th>IRPF %</th>
                    <th>IRPF retenido</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ emp, calc }) => (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 600 }}>{emp.name}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{€(calc.baseSS)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--coral)' }}>{€(calc.ssTrab)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--text2)' }}>{€(calc.ssEmp)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12 }}>{€(calc.baseIRPF)}</td>
                      <td style={{ textAlign: 'right', fontSize: 12, color: 'var(--text2)' }}>{pct(emp.irpfPct || 0)}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'monospace', fontSize: 12, color: 'var(--coral)' }}>{€(calc.irpf)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          {/* Nota legal */}
          <div style={{ fontSize: 11, color: 'var(--text3)', padding: '10px 14px', background: 'var(--bg2)', borderRadius: 8, lineHeight: 1.6 }}>
            <b>Nota:</b> Cálculo orientativo. Tasas SS 2026: trabajador {(SS_TRAB * 100).toFixed(2)}% · empresa {(SS_EMP * 100).toFixed(2)}%.
            Este informe no sustituye a la nómina oficial ni a los trámites con la Seguridad Social.
            Pásalo a tu gestoría para la generación de nóminas legales y el Sistema RED.
          </div>
        </>
      )}
    </>
  );
}
