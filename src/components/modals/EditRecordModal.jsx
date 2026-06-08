import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { calcRec, fmt, fmtDate, t2m } from '../../lib/utils';

export default function EditRecordModal({ recId, onClose }) {
  const { recs, emps, updateRec, deleteRec, upsertPaid, removePaid, paid } = useApp();
  const rec = recs.find(r => r.id === recId);
  const emp = rec ? emps.find(e => e.id === rec.eid) : null;

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
  const [payCheck, setPayCheck] = useState(false);
  const [payExt, setPayExt] = useState(0);

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
    const prevPay = paid.find(p => p.eid === rec.eid && p.date === rec.date);
    if (prevPay) { setPayCheck(true); setPayExt(prevPay.extMin || 0); }
    else { setPayCheck(false); setPayExt(0); }
  }, [rec, emp, paid]);

  if (!rec || !emp) return null;

  const contractMin = emp.ch * 60;

  const preview = !isLibranza && entry && exit
    ? calcRec({ ...rec, entry, exit, brk: parseInt(brk) || 0, citedIn: ci, citedOut: co, libranza: false }, emp)
    : null;

  const handleSave = () => {
    if (isLibranza) {
      updateRec(recId, {
        entry: '', exit: '', brk: emp.brk, obs: obs || 'Libranza',
        status: 'approved', libranza: true,
        special: false, specialNote: '', catUp: false, catUpNote: '',
        citedIn: ci, citedOut: co,
      });
      removePaid(rec.eid, rec.date);
    } else {
      updateRec(recId, {
        citedIn: ci, citedOut: co, entry, exit,
        brk: parseInt(brk) || 0, obs, status: 'approved',
        special, specialNote: special ? specialNote : '',
        catUp, catUpNote: catUp ? catUpNote : '',
        libranza: false,
      });
      if (payCheck && parseFloat(payExt) > 0) {
        upsertPaid({ eid: rec.eid, date: rec.date, month: rec.date.slice(0, 7), ordMin: 0, extMin: parseFloat(payExt), note: `Extras ${fmtDate(rec.date)}` });
      } else {
        removePaid(rec.eid, rec.date);
      }
    }
    onClose();
  };

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

        <div className="frow">
          <div className="fg"><label>Hora citada entrada</label><input type="time" value={ci} onChange={e => setCi(e.target.value)} /></div>
          <div className="fg"><label>Hora citada salida</label><input type="time" value={co} onChange={e => setCo(e.target.value)} /></div>
        </div>
        {!isLibranza && (
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
        {isLibranza && (
          <div className="frow">
            <div className="fg"><label>Observación</label><input type="text" value={obs} onChange={e => setObs(e.target.value)} placeholder="Libranza" /></div>
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
        <div className="modal-foot" style={{ justifyContent: 'space-between' }}>
          <button className="btn-danger" onClick={() => { if (window.confirm('¿Eliminar este registro?')) { deleteRec(recId); onClose(); } }}>Eliminar</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-sm" onClick={onClose}>Cancelar</button>
            <button className="btn-accent" onClick={handleSave}>Guardar y aprobar</button>
          </div>
        </div>
      </div>
    </div>
  );
}
