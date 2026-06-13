import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../lib/supabase';
import { calcRec, calcActorRec, fmt, fmtDate } from '../../lib/utils';
import { useEnterKey } from '../../lib/useEnterKey';

const ACTION_LABEL = { create: '✅ Creado', update: '✏️ Modificado', delete: '🚫 Anulado' };
const ACTION_COLOR = { create: 'var(--teal)', update: 'var(--amber)', delete: 'var(--coral)' };

const FIELD_LABELS = {
  entry: 'Entrada', exit: 'Salida', brk: 'Descanso (min)',
  obs: 'Observación', status: 'Estado', absence: 'Ausencia',
  libranza: 'Libranza', special: 'Jornada especial', cat_up: 'Subida categoría',
  cited_in: 'Hora citada entrada', cited_out: 'Hora citada salida',
  perm_min: 'Ausencia parcial (min)', perm_reason: 'Motivo ausencia',
  km_applied: 'Kilometraje', km_count: 'Km', km_eur: 'Importe km (€)',
  extra_day: 'Jornada no habitual',
};

function AuditDiff({ prev, next }) {
  if (!prev && !next) return null;
  const keys = Object.keys(FIELD_LABELS);
  const diffs = keys.filter(k => {
    const a = prev?.[k] ?? null, b = next?.[k] ?? null;
    return String(a) !== String(b);
  });
  if (!diffs.length) return <span style={{ color: 'var(--text3)', fontSize: 11 }}>Sin cambios de campos</span>;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 4 }}>
      {diffs.map(k => (
        <div key={k} style={{ fontSize: 11, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text3)' }}>{FIELD_LABELS[k]}:</span>
          {prev && <span style={{ color: 'var(--coral)', textDecoration: 'line-through' }}>{String(prev[k] ?? '—')}</span>}
          {prev && next && <span style={{ color: 'var(--text3)' }}>→</span>}
          {next && <span style={{ color: 'var(--teal)' }}>{String(next[k] ?? '—')}</span>}
        </div>
      ))}
    </div>
  );
}

export default function EditRecordModal({ recId, onClose }) {
  const { recs, emps, updateRec, deleteRec, upsertPaid, removePaid, paid } = useApp();
  const [auditLogs, setAuditLogs] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);

  useEffect(() => {
    if (!recId || !supabase) return;
    supabase.from('rec_audit').select('*').eq('rec_id', recId).order('changed_at', { ascending: false })
      .then(({ data }) => { setAuditLogs(data || []); setAuditLoading(false); });
  }, [recId]);
  const rec = recs.find(r => r.id === recId);
  const emp = rec ? emps.find(e => e.id === rec.eid) : null;

  const isActor = emp?.dept === 'Actores';

  const [isLibranza, setIsLibranza] = useState(false);
  const [ci, setCi] = useState('');
  const [co, setCo] = useState('');
  const [entry, setEntry] = useState('');
  const [exit, setExit] = useState('');
  const [brk, setBrk] = useState(0);
  const [obs, setObs] = useState('');
  const [special, setSpecial] = useState(false);
  const [specialNote, setSpecialNote] = useState('');
  const [catUp, setCatUp] = useState(false);
  const [catUpNote, setCatUpNote] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [payCheck, setPayCheck] = useState(false);
  const [payExt, setPayExt] = useState(0);
  const [kmEur, setKmEur] = useState('');
  const [kmOn, setKmOn] = useState(false);
  const [dropPerm, setDropPerm] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  // Actor-specific fields
  const [actorCited, setActorCited] = useState('');
  const [actorEnd, setActorEnd] = useState('');
  const [actorMakeup, setActorMakeup] = useState(60);
  const [actorTravelIn, setActorTravelIn] = useState(0);
  const [actorTravelOut, setActorTravelOut] = useState(0);
  const [actorBreak, setActorBreak] = useState(60);

  useEffect(() => {
    if (!rec || !emp) return;
    setIsLibranza(rec.libranza || false);
    setCi(rec.citedIn || emp.start);
    setCo(rec.citedOut || emp.end);
    setEntry(rec.entry || '');
    setExit(rec.exit || '');
    setBrk(rec.brk != null ? rec.brk : emp.brk);
    setObs(rec.obs || '');
    setSpecial(rec.special || false);
    setSpecialNote(rec.specialNote || '');
    setCatUp(rec.catUp || false);
    setCatUpNote(rec.catUpNote || '');
    setActorCited(rec.actorCited || rec.entry || '');
    setActorEnd(rec.actorEnd || rec.exit || '');
    setActorMakeup(rec.actorMakeup ?? 60);
    setActorTravelIn(rec.actorTravelIn ?? 0);
    setActorTravelOut(rec.actorTravelOut ?? 0);
    setActorBreak(rec.actorBreak ?? 60);
    const prevPay = paid.find(p => p.eid === rec.eid && p.date === rec.date);
    if (prevPay) { setPayCheck(true); setPayExt(prevPay.extMin || 0); }
    else { setPayCheck(false); setPayExt(0); }
    setKmEur(rec.kmEur != null ? String(rec.kmEur) : '');
    setKmOn(rec.kmApplied || false);
    setDropPerm(false);
  }, [rec, emp, paid]);

  if (!rec || !emp) return null;

  const contractMin = emp.ch * 60;

  const preview = !isActor && !isLibranza && entry && exit
    ? calcRec({ ...rec, entry, exit, brk: parseInt(brk) || 0, citedIn: ci, citedOut: co, libranza: false }, emp)
    : null;

  const actorPreview = isActor && !isLibranza && actorCited && actorEnd
    ? calcActorRec({ actorCited, actorEnd, actorMakeup: +actorMakeup, actorTravelIn: +actorTravelIn, actorTravelOut: +actorTravelOut, actorBreak: +actorBreak }, emp)
    : null;

  const kmPatch = kmOn
    ? { kmApplied: true, kmEur: kmEur !== '' ? parseFloat(kmEur) : null }
    : { kmApplied: false, kmCount: null, kmEur: null };
  const permPatch = dropPerm ? { permMin: 0, permReason: null } : {};

  const handleSave = () => {
    if (isLibranza) {
      updateRec(recId, {
        entry: '', exit: '', brk: emp.brk, obs: obs || 'Libranza',
        status: 'approved', libranza: true,
        special: false, specialNote: '', catUp: false, catUpNote: '',
        citedIn: '', citedOut: '',
        actorCited: null, actorEnd: null,
        kmApplied: false, kmCount: null, kmEur: null,
        permMin: 0, permReason: null,
      });
      removePaid(rec.eid, rec.date);
    } else if (isActor) {
      updateRec(recId, {
        entry: actorCited, exit: actorEnd,
        brk: +actorBreak, obs, status: 'approved',
        citedIn: actorCited, citedOut: actorEnd,
        actorCited, actorEnd,
        actorMakeup: +actorMakeup, actorTravelIn: +actorTravelIn,
        actorTravelOut: +actorTravelOut, actorBreak: +actorBreak,
        libranza: false, special: false, catUp: false,
        ...kmPatch, ...permPatch,
      });
    } else {
      updateRec(recId, {
        citedIn: ci, citedOut: co, entry, exit,
        brk: parseInt(brk) || 0, obs, status: 'approved',
        special, specialNote: special ? specialNote : '',
        catUp, catUpNote: catUp ? catUpNote : '',
        libranza: false,
        ...kmPatch, ...permPatch,
      });
      if (payCheck && parseFloat(payExt) > 0) {
        upsertPaid({ eid: rec.eid, date: rec.date, month: rec.date.slice(0, 7), ordMin: 0, extMin: parseFloat(payExt), note: `Extras ${fmtDate(rec.date)}` });
      } else {
        removePaid(rec.eid, rec.date);
      }
    }
    onClose();
  };
  useEnterKey(handleSave);

  return (
    <div className="modal-overlay open" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 560 }}>
        <h3>Revisar jornada</h3>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: '1rem' }}>
          {emp.alias || emp.name} · {fmtDate(rec.date)}
        </p>

        <div className="tog-section" style={{ marginBottom: '1rem', background: isLibranza ? 'rgba(161,139,255,0.08)' : undefined, border: isLibranza ? '1px solid var(--purple)' : undefined }}>
          <label className="tog-label">
            <input type="checkbox" checked={isLibranza} onChange={e => setIsLibranza(e.target.checked)} />
            <span style={{ color: 'var(--purple)', fontWeight: 700 }}>📅 Marcar como Libranza</span>
          </label>
          {isLibranza && (
            <div className="tog-body" style={{ color: 'var(--text2)', fontSize: 13 }}>
              Se desactivarán jornada especial, subida de categoría y pago de extras.
              Se registrarán <b style={{ color: 'var(--coral)' }}>{fmt(contractMin)}</b> como compensadas.
            </div>
          )}
        </div>

        {!isActor && (
          <div className="frow">
            <div className="fg"><label>Hora citada entrada</label><input type="time" value={ci} onChange={e => setCi(e.target.value)} /></div>
            <div className="fg"><label>Hora citada salida</label><input type="time" value={co} onChange={e => setCo(e.target.value)} /></div>
          </div>
        )}
        {isActor && !isLibranza && (
          <>
            <div className="frow">
              <div className="fg"><label>Hora de citación</label><input type="time" value={actorCited} onChange={e => setActorCited(e.target.value)} /></div>
              <div className="fg"><label>Fin de jornada</label><input type="time" value={actorEnd} onChange={e => setActorEnd(e.target.value)} /></div>
            </div>
            <div className="frow">
              <div className="fg"><label>Caracterización (min)</label><input type="number" value={actorMakeup} min={0} step={5} onChange={e => setActorMakeup(e.target.value)} /></div>
              <div className="fg"><label>Viaje ida (min)</label><input type="number" value={actorTravelIn} min={0} step={5} onChange={e => setActorTravelIn(e.target.value)} /></div>
              <div className="fg"><label>Viaje vuelta (min)</label><input type="number" value={actorTravelOut} min={0} step={5} onChange={e => setActorTravelOut(e.target.value)} /></div>
              <div className="fg"><label>Descanso (min)</label><input type="number" value={actorBreak} min={0} step={5} onChange={e => setActorBreak(e.target.value)} /></div>
            </div>
          </>
        )}
        {!isActor && !isLibranza && (
          <>
            <div className="frow">
              <div className="fg"><label>Entrada real</label><input type="time" value={entry} onChange={e => setEntry(e.target.value)} /></div>
              <div className="fg"><label>Salida real</label><input type="time" value={exit} onChange={e => setExit(e.target.value)} /></div>
            </div>
            <div className="frow">
              <div className="fg"><label>Descanso real (min)</label><input type="number" value={brk} min={0} step={5} onChange={e => setBrk(e.target.value)} /></div>
              <div className="fg"><label>Observación</label><input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Opcional" /></div>
            </div>
          </>
        )}
        {(isLibranza || isActor) && (
          <div className="frow">
            <div className="fg"><label>Observación</label><input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder={isLibranza ? 'Libranza' : 'Opcional'} /></div>
          </div>
        )}

        {actorPreview && (
          <div className="calc-box" style={{ marginBottom: '1rem' }}>
            <div className="calc-grid">
              <div className="cg-item"><div className="cg-l">Citación – Fin</div><div className="cg-v">{actorCited}–{actorEnd}</div></div>
              <div className="cg-item"><div className="cg-l">Caract. extra</div><div className="cg-v" style={{ color: 'var(--teal)' }}>{actorPreview.makeupExtra > 0 ? '+' + fmt(actorPreview.makeupExtra) : '—'}</div></div>
              <div className="cg-item"><div className="cg-l">Viaje extra</div><div className="cg-v" style={{ color: 'var(--teal)' }}>{actorPreview.travelExtra > 0 ? '+' + fmt(actorPreview.travelExtra) : '—'}</div></div>
              <div className="cg-item"><div className="cg-l">Trabajo efectivo</div><div className="cg-v">{fmt(actorPreview.net)}</div></div>
              <div className="cg-item"><div className="cg-l">Acumulado</div><div className="cg-v" style={{ color: 'var(--teal)' }}>{actorPreview.accum > 0 ? '+' + fmt(actorPreview.accum) : '—'}</div></div>
              <div className="cg-item"><div className="cg-l">Compensado</div><div className="cg-v" style={{ color: 'var(--coral)' }}>{actorPreview.comp > 0 ? '−' + fmt(actorPreview.comp) : '—'}</div></div>
            </div>
          </div>
        )}
        {preview && (
          <div className="calc-box" style={{ marginBottom: '1rem' }}>
            <div className="calc-grid">
              <div className="cg-item"><div className="cg-l">Hora citada</div><div className="cg-v">{ci}–{co}</div></div>
              <div className="cg-item"><div className="cg-l">Horas netas</div><div className="cg-v">{fmt(preview.net)}</div></div>
              <div className="cg-item"><div className="cg-l">Acumuladas</div><div className="cg-v" style={{ color: 'var(--teal)' }}>{preview.accum > 0 ? '+' + fmt(preview.accum) : '—'}</div></div>
              <div className="cg-item"><div className="cg-l">Compensadas</div><div className="cg-v" style={{ color: 'var(--coral)' }}>{preview.comp > 0 ? '−' + fmt(preview.comp) : '—'}</div></div>
              <div className="cg-item"><div className="cg-l">Extras (sin ×1.5)</div><div className="cg-v" style={{ color: 'var(--purple)' }}>{preview.extra > 0 ? '+' + fmt(preview.extra) : '—'}</div></div>
              <div className="cg-item"><div className="cg-l">TOTAL del día</div><div className="cg-v" style={{ color: preview.total >= 0 ? 'var(--teal)' : 'var(--coral)' }}>{fmt(Math.round(preview.total))}</div></div>
            </div>
          </div>
        )}
        {isLibranza && (
          <div className="calc-box" style={{ marginBottom: '1rem' }}>
            <div className="calc-grid">
              <div className="cg-item"><div className="cg-l">Tipo</div><div className="cg-v" style={{ color: 'var(--purple)' }}>📅 Libranza</div></div>
              <div className="cg-item"><div className="cg-l">Compensadas</div><div className="cg-v" style={{ color: 'var(--coral)' }}>−{fmt(contractMin)}</div></div>
              <div className="cg-item"><div className="cg-l">TOTAL del día</div><div className="cg-v" style={{ color: 'var(--coral)' }}>−{fmt(contractMin)}</div></div>
            </div>
          </div>
        )}

        {!isActor && (
          <>
            <div className="tog-section" style={{ opacity: isLibranza ? 0.35 : 1, pointerEvents: isLibranza ? 'none' : undefined }}>
              <label className="tog-label">
                <input type="checkbox" checked={special} onChange={e => setSpecial(e.target.checked)} disabled={isLibranza} />
                <span style={{ color: 'var(--amber)' }}>⭐ Marcar como jornada especial (E)</span>
              </label>
              {special && !isLibranza && (
                <div className="tog-body">
                  <div className="fg" style={{ marginBottom: 0 }}><label>Nota para el empleado</label><input type="text" value={specialNote} onChange={e => setSpecialNote(e.target.value)} placeholder="Ej: rodaje festivo, guardia..." /></div>
                </div>
              )}
            </div>
            <div className="tog-section" style={{ opacity: isLibranza ? 0.35 : 1, pointerEvents: isLibranza ? 'none' : undefined }}>
              <label className="tog-label">
                <input type="checkbox" checked={catUp} onChange={e => setCatUp(e.target.checked)} disabled={isLibranza} />
                <span style={{ color: 'var(--purple)' }}>⬆ Subida de categoría (X)</span>
              </label>
              {catUp && !isLibranza && (
                <div className="tog-body">
                  <div className="fg" style={{ marginBottom: 0 }}><label>Motivo / categoría aplicada</label><input type="text" value={catUpNote} onChange={e => setCatUpNote(e.target.value)} placeholder="Ej: operación especial, dirección..." /></div>
                </div>
              )}
            </div>
            <div className="tog-section" style={{ opacity: isLibranza ? 0.35 : 1, pointerEvents: isLibranza ? 'none' : undefined }}>
              <label className="tog-label">
                <input type="checkbox" checked={payCheck} onChange={e => setPayCheck(e.target.checked)} disabled={isLibranza} />
                <span style={{ color: 'var(--teal)' }}>💰 Pagar minutos extra de esta jornada</span>
              </label>
              {payCheck && !isLibranza && (
                <div className="tog-body">
                  <div className="fg" style={{ marginBottom: '.6rem' }}><label>Minutos extra a pagar</label><input type="number" value={payExt} min={0} step={15} onChange={e => setPayExt(e.target.value)} /></div>
                  {parseFloat(payExt) > 0 && (
                    <div style={{ fontSize: 12, color: 'var(--text2)', padding: '6px 8px', background: 'var(--bg4)', borderRadius: 6 }}>
                      Se pagarán <b style={{ color: 'var(--purple)' }}>{payExt} min extra</b> → equiv. <b style={{ color: 'var(--teal)' }}>{fmt(Math.round(parseFloat(payExt) * 1.5))}</b> con ×1.5
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
        {!isLibranza && (
          <div style={{ marginTop: '1rem', padding: '.8rem 1rem', background: 'var(--bg3)', borderRadius: 'var(--r)', border: '1px solid var(--border2)' }}>
            {rec.permMin > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: '.75rem', flexWrap: 'wrap' }}>
                <div style={{ fontSize: 13, color: 'var(--text2)', opacity: dropPerm ? 0.5 : 1 }}>
                  🩺 Ausencia parcial: <b style={{ color: 'var(--text)', textDecoration: dropPerm ? 'line-through' : undefined }}>{Math.round(rec.permMin / 60 * 100) / 100} h</b> · {rec.permReason || '—'} <span style={{ color: 'var(--text3)' }}>(no penaliza el saldo)</span>
                  {dropPerm && <span style={{ color: 'var(--coral)', marginLeft: 6 }}>· se eliminará al guardar</span>}
                </div>
                <button className="btn-sm" onClick={() => setDropPerm(v => !v)} style={dropPerm ? { borderColor: 'var(--coral)', color: 'var(--coral)' } : {}}>
                  {dropPerm ? 'Mantener ausencia' : '🗑 Quitar ausencia'}
                </button>
              </div>
            )}
            <label className="tog-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input type="checkbox" checked={kmOn} onChange={e => setKmOn(e.target.checked)} />
              <span style={{ color: 'var(--teal)', fontWeight: 700 }}>🚗 Kilometraje aplicado</span>
            </label>
            {kmOn && (
              <div className="fg" style={{ marginTop: '.6rem', marginBottom: 0 }}>
                <label>Importe a pagar (€){rec.kmCount ? ` · ${rec.kmCount} km declarados` : ''}</label>
                <input type="number" min={0} step="0.01" value={kmEur} onChange={e => setKmEur(e.target.value)} placeholder="Ej: 12.50" />
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>Aparecerá en Informes y se podrá exportar a ClapPay.</span>
              </div>
            )}
          </div>
        )}
        {/* Historial de cambios (desplegable) */}
        <div style={{ borderTop: '1px solid var(--border2)', marginTop: '1rem', paddingTop: '1rem' }}>
          <button
            onClick={() => setShowHistory(v => !v)}
            style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)' }}
          >
            <span>🕓 Historial de cambios{!auditLoading && auditLogs.length > 0 ? ` (${auditLogs.length})` : ''}</span>
            <span style={{ fontSize: 13 }}>{showHistory ? '▲' : '▼'}</span>
          </button>
          {showHistory && (<>
          <div style={{ marginTop: '.6rem' }} />
          {auditLoading && <div style={{ fontSize: 12, color: 'var(--text3)' }}>Cargando…</div>}
          {!auditLoading && auditLogs.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text3)', fontStyle: 'italic' }}>Sin cambios registrados todavía.</div>
          )}
          {!auditLoading && auditLogs.map(log => (
            <div key={log.id} style={{ marginBottom: '.6rem', padding: '.5rem .75rem', background: 'var(--bg3)', borderRadius: 8, borderLeft: `3px solid ${ACTION_COLOR[log.action] || 'var(--border2)'}` }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', marginBottom: 2 }}>
                <span style={{ fontWeight: 700, fontSize: 12, color: ACTION_COLOR[log.action] }}>{ACTION_LABEL[log.action] || log.action}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>{new Date(log.changed_at).toLocaleString('es-ES')}</span>
                <span style={{ fontSize: 11, color: 'var(--text2)' }}>por <b>{log.changed_by}</b></span>
              </div>
              {log.reason && <div style={{ fontSize: 11, color: 'var(--amber)', marginBottom: 2 }}>Motivo: {log.reason}</div>}
              <AuditDiff prev={log.prev_data} next={log.new_data} />
            </div>
          ))}
          </>)}
        </div>

        {showDeleteConfirm && (
          <div style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid var(--coral)', borderRadius: 'var(--r)', padding: '1rem', marginBottom: '1rem' }}>
            <p style={{ fontSize: 13, color: 'var(--coral)', fontWeight: 700, marginBottom: '.5rem' }}>⚠️ Confirmar anulación del registro</p>
            <p style={{ fontSize: 12, color: 'var(--text2)', marginBottom: '.75rem' }}>
              El registro no se elimina — queda marcado como anulado con tu nombre, fecha y el motivo. Esto es obligatorio por ley.
            </p>
            <div className="fg" style={{ marginBottom: '.75rem' }}>
              <label>Motivo de la anulación <span style={{ color: 'var(--coral)' }}>*</span></label>
              <input
                type="text"
                value={deleteReason}
                onChange={e => setDeleteReason(e.target.value)}
                placeholder="Ej: fichaje duplicado, error de entrada..."
                autoFocus
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn-sm" onClick={() => { setShowDeleteConfirm(false); setDeleteReason(''); }}>Cancelar</button>
              <button
                className="btn-danger"
                disabled={!deleteReason.trim()}
                onClick={() => { deleteRec(recId, deleteReason.trim()); onClose(); }}
              >
                Confirmar anulación
              </button>
            </div>
          </div>
        )}
        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <button className="btn-danger" onClick={() => setShowDeleteConfirm(true)}>Anular registro</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn-accent" onClick={handleSave}>Guardar y aprobar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
