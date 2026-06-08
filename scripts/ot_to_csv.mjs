#!/usr/bin/env node
/**
 * ot_to_csv.mjs — Extrae datos de OTs (Órdenes de Trabajo) en PDF y genera CSVs por empleado.
 *
 * Uso:
 *   node scripts/ot_to_csv.mjs <carpeta_ots> [carpeta_salida]
 *
 * Requisitos:
 *   ANTHROPIC_API_KEY en el entorno (o en .env.local)
 *
 * Salida:
 *   Un CSV por empleado en carpeta_salida (por defecto: scripts/csv_output/)
 *   Un JSON de caché por PDF en scripts/.ot_cache/ (evita reprocesar)
 */

import Anthropic from '@anthropic-ai/sdk';
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { resolve, join, basename } from 'path';

// ── Configuración ────────────────────────────────────────────────────────────

const EMPLOYEES = {
  pablo:   'Pablo Espinosa',
  alicia:  'Alicia Miramón',
  cesar:   'César Esteban',
  sara:    'Sara del Cerro',
  susana:  'Susana Gonzalo',
  irene:   'Irene García',
  mateo:   'Mateo Montoya',
  yolanda: 'Yolanda Rodríguez',
};

const CSV_HEADERS = 'empleado_id,fecha,entrada,salida,descanso_min,citado_entrada,citado_salida,tipo_ausencia,extras_pagados_min,jornada_especial,nota_especial,observaciones';

// Máximo de PDFs procesados en paralelo (respetar rate limits)
const CONCURRENCY = 3;

// Modelo: haiku para velocidad y coste, sonnet si hay PDFs complejos
const MODEL = 'claude-haiku-4-5-20251001';

// ── Prompt del sistema ───────────────────────────────────────────────────────

const SYSTEM_PROMPT = `Eres un extractor de datos de Órdenes de Trabajo (OT) audiovisuales.
Tu tarea es leer el PDF de una OT de rodaje y devolver un array JSON con los registros de jornada de cada empleado.

EMPLEADOS A BUSCAR (nombre → id):
${Object.entries(EMPLOYEES).map(([id, name]) => `  "${name}" → "${id}"`).join('\n')}

REGLAS DE EXTRACCIÓN:
- "entrada": hora real de llegada del empleado (HH:MM, 24h). Vacío si no asistió.
- "salida": hora real de fin de jornada (HH:MM, 24h). Vacío si no asistió.
- "descanso_min": minutos de descanso/comida. 60 si hay pausa de comida normal, 0 si no la hay.
- "citado_entrada": hora de citación (llamada) del empleado (HH:MM, 24h). Vacío si no aplica.
- "citado_salida": hora prevista de fin según citación (HH:MM, 24h). Vacío si no aplica.
- "tipo_ausencia": solo si el empleado NO trabajó. Valores: "festivo", "vacaciones", "libranza", "baja", "permiso". Vacío si trabajó.
- "extras_pagados_min": minutos de extras ya pagados/acordados fuera del cálculo normal. Vacío si no hay.
- "jornada_especial": true si la jornada supera claramente lo previsto (rodaje largo, noche, situación extraordinaria). false en caso normal.
- "nota_especial": texto corto si hay algo relevante anotado (ej. "Rodaje noche", "Desplazamiento incluido"). Vacío si no hay.
- "observaciones": cualquier otra anotación relevante del empleado en esa jornada. Vacío si no hay.

FORMATO DE SALIDA:
Devuelve ÚNICAMENTE un array JSON válido, sin texto adicional, sin markdown, sin \`\`\`json.
Si un empleado no aparece en la OT, no lo incluyas.
La fecha la extraes del documento (campo "fecha" en formato YYYY-MM-DD).

EJEMPLO DE SALIDA:
[
  {"empleado_id":"pablo","fecha":"2026-01-27","entrada":"11:00","salida":"20:15","descanso_min":0,"citado_entrada":"11:00","citado_salida":"20:00","tipo_ausencia":"","extras_pagados_min":"","jornada_especial":false,"nota_especial":"","observaciones":""},
  {"empleado_id":"cesar","fecha":"2026-01-27","entrada":"08:00","salida":"19:30","descanso_min":60,"citado_entrada":"08:00","citado_salida":"18:15","tipo_ausencia":"","extras_pagados_min":"","jornada_especial":true,"nota_especial":"Jornada larga","observaciones":""}
]`;

// ── Utilidades ───────────────────────────────────────────────────────────────

function loadEnv() {
  const envPath = resolve(process.cwd(), '.env.local');
  if (existsSync(envPath)) {
    readFileSync(envPath, 'utf8').split('\n').forEach(line => {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m && !process.env[m[1].trim()]) process.env[m[1].trim()] = m[2].trim();
    });
  }
}

function pLimit(concurrency) {
  let active = 0;
  const queue = [];
  const next = () => {
    if (active >= concurrency || queue.length === 0) return;
    active++;
    const { fn, resolve, reject } = queue.shift();
    fn().then(resolve, reject).finally(() => { active--; next(); });
  };
  return fn => new Promise((resolve, reject) => { queue.push({ fn, resolve, reject }); next(); });
}

function rowToCSV(row) {
  return [
    row.empleado_id ?? '',
    row.fecha ?? '',
    row.entrada ?? '',
    row.salida ?? '',
    row.descanso_min ?? '',
    row.citado_entrada ?? '',
    row.citado_salida ?? '',
    row.tipo_ausencia ?? '',
    row.extras_pagados_min ?? '',
    row.jornada_especial === true ? 'true' : row.jornada_especial === false ? 'false' : '',
    row.nota_especial ?? '',
    row.observaciones ?? '',
  ].join(',');
}

// ── Procesamiento de un PDF ──────────────────────────────────────────────────

async function processPDF(pdfPath, client, cacheDir) {
  const cacheFile = join(cacheDir, basename(pdfPath).replace('.pdf', '.json'));

  if (existsSync(cacheFile)) {
    process.stderr.write(`  [caché] ${basename(pdfPath)}\n`);
    return JSON.parse(readFileSync(cacheFile, 'utf8'));
  }

  process.stderr.write(`  [procesando] ${basename(pdfPath)}...\n`);
  const pdfData = readFileSync(pdfPath);
  const base64 = pdfData.toString('base64');

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    messages: [{
      role: 'user',
      content: [
        { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: base64 } },
        { type: 'text', text: 'Extrae los datos de todos los empleados de esta OT.' },
      ],
    }],
  });

  const text = response.content[0].text.trim();
  let rows;
  try {
    rows = JSON.parse(text);
  } catch {
    process.stderr.write(`  [error] No se pudo parsear JSON de ${basename(pdfPath)}:\n${text.slice(0, 300)}\n`);
    return [];
  }

  writeFileSync(cacheFile, JSON.stringify(rows, null, 2));
  process.stderr.write(`  [ok] ${basename(pdfPath)} → ${rows.length} registros\n`);
  return rows;
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  loadEnv();

  const [,, inputDir, outputDir = 'scripts/csv_output'] = process.argv;
  if (!inputDir) {
    console.error('Uso: node scripts/ot_to_csv.mjs <carpeta_ots> [carpeta_salida]');
    process.exit(1);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('Falta ANTHROPIC_API_KEY. Añádela al entorno o a .env.local');
    process.exit(1);
  }

  const client = new Anthropic({ apiKey });
  const cacheDir = 'scripts/.ot_cache';
  mkdirSync(cacheDir, { recursive: true });
  mkdirSync(outputDir, { recursive: true });

  const pdfs = readdirSync(inputDir)
    .filter(f => f.toLowerCase().endsWith('.pdf'))
    .map(f => join(inputDir, f))
    .sort();

  if (pdfs.length === 0) {
    console.error(`No se encontraron PDFs en ${inputDir}`);
    process.exit(1);
  }

  process.stderr.write(`\nProcesando ${pdfs.length} OTs con concurrencia ${CONCURRENCY}...\n\n`);

  const limit = pLimit(CONCURRENCY);
  const allResults = await Promise.all(pdfs.map(pdf => limit(() => processPDF(pdf, client, cacheDir))));
  const allRows = allResults.flat();

  // Agrupar por empleado
  const byEmployee = {};
  for (const row of allRows) {
    if (!row.empleado_id) continue;
    if (!byEmployee[row.empleado_id]) byEmployee[row.empleado_id] = [];
    byEmployee[row.empleado_id].push(row);
  }

  // Ordenar por fecha y escribir CSVs
  for (const [eid, rows] of Object.entries(byEmployee)) {
    rows.sort((a, b) => a.fecha.localeCompare(b.fecha));
    const csv = [CSV_HEADERS, ...rows.map(rowToCSV)].join('\n') + '\n';
    const outPath = join(outputDir, `${eid}_completo.csv`);
    writeFileSync(outPath, csv);
    process.stderr.write(`Guardado: ${outPath} (${rows.length} jornadas)\n`);
  }

  process.stderr.write(`\nListo. ${allRows.length} registros totales en ${Object.keys(byEmployee).length} empleados.\n`);
  process.stderr.write(`Para importar a data.js: node scripts/import_csv.mjs <empleado_id> scripts/csv_output/<eid>_completo.csv\n`);
}

main().catch(err => { console.error(err); process.exit(1); });
