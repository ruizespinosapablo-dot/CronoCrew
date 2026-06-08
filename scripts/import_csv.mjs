import { readFileSync, writeFileSync } from 'fs';
import { resolve, basename } from 'path';

// Uso: node scripts/import_csv.mjs <ruta_csv>
// Ejemplo: node scripts/import_csv.mjs scripts/csv_output/pablo_completo.csv
const csvPath = process.argv[2];
if (!csvPath) { console.error('Uso: node scripts/import_csv.mjs <ruta_csv>'); process.exit(1); }

const csv = readFileSync(resolve(csvPath), 'utf8');
const lines = csv.trim().split('\n');
const headers = lines[0].split(',');

const col = (row, name) => {
  const i = headers.indexOf(name);
  return i >= 0 ? row[i].trim() : '';
};

const recs = lines.slice(1).map(line => {
  const row = line.split(',');
  const eid         = col(row, 'empleado_id');
  const date        = col(row, 'fecha');
  const entry       = col(row, 'entrada');
  const exit        = col(row, 'salida');
  const brk         = parseInt(col(row, 'descanso_min')) || 0;
  const citedIn     = col(row, 'citado_entrada');
  const citedOut    = col(row, 'citado_salida');
  const absence     = col(row, 'tipo_ausencia');
  const extrasMin   = col(row, 'extras_pagados_min');
  const special     = col(row, 'jornada_especial') === 'true';
  const specialNote = col(row, 'nota_especial');
  const obs         = col(row, 'observaciones');

  const rec = {
    id: `${eid}_${date}`,
    eid,
    date,
    entry,
    exit,
    obs: obs || (absence === 'festivo' ? 'Festivo' : absence === 'vacaciones' ? 'Vacaciones' : absence === 'mudanza' ? 'Mudanza' : absence === 'libranza' ? 'No asiste' : ''),
    status: 'approved',
    method: 'CSV',
    citedIn,
    citedOut,
    brk,
  };

  if (absence === 'festivo')    rec.absence = 'festivo';
  if (absence === 'vacaciones') rec.absence = 'vacaciones';
  if (absence === 'mudanza')    rec.absence = 'mudanza';
  if (absence === 'libranza')   rec.libranza = true;
  if (extrasMin)                rec.paidExtra = parseInt(extrasMin);
  if (special)                  rec.special = true;
  if (specialNote)              rec.specialNote = specialNote;

  return rec;
});

// Serialize to JS
const js = recs.map(r => {
  const fields = Object.entries(r).map(([k, v]) => {
    if (typeof v === 'string') return `${k}: '${v}'`;
    return `${k}: ${v}`;
  }).join(', ');
  return `  { ${fields} },`;
}).join('\n');

console.log(`// ${recs.length} registros generados\n[\n${js}\n]`);

// Write result to file for review
const previewPath = resolve('scripts', basename(csvPath).replace('.csv', '_preview.js'));
writeFileSync(previewPath, `// ${recs.length} registros generados\n[\n${js}\n]\n`);
console.error(`\nPreview guardado en ${previewPath}`);
