#!/usr/bin/env python3
"""
pdf_to_csv.py — Convierte PDFs de fichas semanales a CSVs por empleado.

Uso:
    python3 scripts/pdf_to_csv.py <pdf_o_carpeta> [carpeta_salida]

Ejemplos:
    python3 scripts/pdf_to_csv.py ~/Downloads/PABLO\ PRUEBA.pdf
    python3 scripts/pdf_to_csv.py ~/Downloads/fichas/ scripts/csv_output/

Salida: un CSV por empleado en carpeta_salida (por defecto: scripts/csv_output/)
"""

import sys, os, re
from collections import defaultdict
from pdfminer.high_level import extract_pages
from pdfminer.layout import LTTextBox, LTTextLine

# ── Mapas ────────────────────────────────────────────────────────────────────

EMPLOYEE_MAP = {
    'PABLO ESPINOSA':    'pablo',
    'ALICIA MIRAMÓN':    'alicia',
    'ALICIA MIRAMON':    'alicia',
    'CÉSAR ESTEBAN':     'cesar',
    'CESAR ESTEBAN':     'cesar',
    'SARA DEL CERRO':    'sara',
    'SUSANA GONZALO':    'susana',
    'IRENE GARCÍA':      'irene',
    'IRENE GARCIA':      'irene',
    'MATEO MONTOYA':     'mateo',
    'YOLANDA RODRÍGUEZ': 'yolanda',
    'YOLANDA RODRIGUEZ': 'yolanda',
    # Empleados del PDF de Producción
    'ALBERTO BÁEZ':      'alberto',
    'ALBERTO BAEZ':      'alberto',
    'ALEJANDRO MOLINA':  'alejandro',
    'MAYTE MARTÍNEZ':    'mayte',
    'MAYTE MARTINEZ':    'mayte',
    'GUILLE SÁNCHEZ':    'guille',
    'GUILLE SANCHEZ':    'guille',
    # Nuevos empleados
    'AINOA MARTÍNEZ':    'ainoa',
    'AINOA MARTINEZ':    'ainoa',
    'ANDREA SAN JUAN':   'andrea',
    'CAMILA BARRENECHEA':'camila',
    'CARLOS GARCÍA':     'carlos',
    'CARLOS GARCIA':     'carlos',
    'DAVID FERNÁNDEZ':   'david',
    'DAVID FERNANDEZ':   'david',
    'JAVIER RUIZ':       'javier',
    'MARTA GARCÍA':      'marta',
    'MARTA GARCIA':      'marta',
}

MONTH_MAP = {
    'enero':1,'febrero':2,'marzo':3,'abril':4,'mayo':5,'junio':6,
    'julio':7,'agosto':8,'septiembre':9,'octubre':10,'noviembre':11,'diciembre':12,
}

# Abreviaturas de mes en las fechas del PDF (ej. "3-nov")
DATE_MONTH_ABBR = {
    'ene':1,'feb':2,'mar':3,'abr':4,'may':5,'jun':6,
    'jul':7,'ago':8,'sep':9,'sept':9,'oct':10,'nov':11,'dic':12,
}

ABSENCE_TOKENS = {
    'FESTIVO':'festivo', 'VACAC':'vacaciones', 'VACACIONES':'vacaciones',
    'MUDANZA':'mudanza', 'BAJA':'baja', 'PERMISO':'permiso',
    'LACTAN':'lactancia',
}

CSV_HEADER = 'empleado_id,fecha,entrada,salida,descanso_min,citado_entrada,citado_salida,tipo_ausencia,extras_pagados_min,jornada_especial,nota_especial,observaciones'

# Columnas por rango X (medidas del PDF real)
COL_RANGES = [
    ('fecha',    0,  155),
    ('marker', 155,  185),  # columna "E" — X = jornada especial
    ('inicio', 185,  250),
    ('fin',    250,  305),
    ('comida', 305,  370),
    ('cita',   370,  440),
    ('horas',  440,  510),
    ('plus',   510,  560),
    ('extras', 560, 9999),
]

def col_for_x(x):
    for name, lo, hi in COL_RANGES:
        if lo <= x < hi:
            return name
    return 'unknown'

# ── Utilidades de tiempo ──────────────────────────────────────────────────────

def t2m(t):
    m = re.match(r'^-?(\d{1,2}):(\d{2})$', t.strip())
    if not m:
        return None
    return int(m.group(1)) * 60 + int(m.group(2))

def m2t(mins):
    h, m = divmod(int(mins), 60)
    return f'{h:02d}:{m:02d}'

def fmt_time(t):
    mins = t2m(t)
    if mins is None or mins == 0:
        # "0:00" can be valid entry time; only empty if truly invalid
        if t.strip() in ('', '0:00', '-0:00'):
            return ''
        return ''
    return m2t(mins)

def fmt_time_keep_zero(t):
    """Formatea incluyendo 0:00 como vacío (se usa para entradas sin datos)."""
    mins = t2m(t)
    return m2t(mins) if mins is not None else ''

def is_zero_time(t):
    m = t2m(t)
    return m is not None and m == 0

def is_valid_nonzero_time(t):
    m = t2m(t)
    return m is not None and m > 0

def add_minutes(time_str, delta):
    base = t2m(time_str)
    if base is None:
        return ''
    return m2t(base + delta)

# ── Extracción de todos los elementos del PDF ─────────────────────────────────

def get_all_elements(pdf_path):
    """
    Devuelve todos los elementos de texto del PDF con (page, x, y, text).
    Ordena por (page asc, y desc, x asc) para lectura lineal.
    """
    elems = []
    for pi, page in enumerate(extract_pages(pdf_path)):
        for element in page:
            if isinstance(element, LTTextBox):
                for line in element:
                    if isinstance(line, LTTextLine):
                        text = line.get_text().strip()
                        if text:
                            elems.append({
                                'page': pi,
                                'x': round(line.x0, 1),
                                'y': round(line.y0, 1),
                                'text': text,
                            })
    elems.sort(key=lambda e: (e['page'], -e['y'], e['x']))
    return elems

def group_rows(elements, tol=3.0):
    """Agrupa elementos con misma (page, y ±tol) en filas."""
    rows = []
    for e in elements:
        placed = False
        for row in rows:
            if row['page'] == e['page'] and abs(row['y'] - e['y']) <= tol:
                row['cells'].append(e)
                placed = True
                break
        if not placed:
            rows.append({'page': e['page'], 'y': e['y'], 'cells': [e]})
    rows.sort(key=lambda r: (r['page'], -r['y']))
    return rows

def row_to_cols(row):
    d = {}
    for cell in row['cells']:
        col = col_for_x(cell['x'])
        if col in d:
            d[col] += ' ' + cell['text']
        else:
            d[col] = cell['text']
    return d

# ── Parseo de datos ───────────────────────────────────────────────────────────

def detect_absence(text):
    up = text.upper()
    for token, atype in ABSENCE_TOKENS.items():
        if token in up:
            return atype
    return None

def parse_date(day_str, week_year, week_month):
    """
    Parsea "3-nov" usando el mes de la abreviatura del propio día.
    Ajusta el año cuando la semana cruza el cambio de año (dic→ene).
    """
    m = re.match(r'^(\d{1,2})-(\w+)$', day_str)
    if not m:
        return None
    day = int(m.group(1))
    abbr = m.group(2).lower()
    actual_month = DATE_MONTH_ABBR.get(abbr, week_month)

    # Ajuste de año al cruzar dic→ene
    actual_year = week_year
    if week_month == 12 and actual_month == 1:
        actual_year = week_year + 1
    elif week_month == 1 and actual_month == 12:
        actual_year = week_year - 1

    return f'{actual_year}-{actual_month:02d}-{day:02d}'

def parse_pdf(pdf_path):
    """
    Procesa un PDF y devuelve dict {employee_id: [row_dict, ...]}.
    Solo incluye semanas marcadas con 'SÍ'.
    """
    result = defaultdict(list)

    elements = get_all_elements(pdf_path)
    rows = group_rows(elements)

    current_employee = None
    current_confirmed = False
    current_year = None
    current_month = None
    in_data_block = False

    for row in rows:
        cols = row_to_cols(row)
        all_texts = [c['text'] for c in row['cells']]
        joined = ' '.join(all_texts)

        # ── Detectar nombre de empleado ───────────────────────────────────
        for name, eid in EMPLOYEE_MAP.items():
            if joined.strip().upper() == name:
                current_employee = eid
                in_data_block = False
                break

        # ── Detectar SÍ / NO (solo, sin cabecera de semana) ─────────────
        if re.search(r'\bSÍ\b', joined, re.IGNORECASE) and not re.search(r'Semana', joined, re.IGNORECASE):
            current_confirmed = True
        elif re.search(r'^\s*NO\s*$', joined, re.IGNORECASE):
            current_confirmed = False
            in_data_block = False

        # ── Detectar cabecera de semana ───────────────────────────────────
        week_m = re.search(r'Semana\s+\d+\s+(\w+)\s+(\d{4})', joined, re.IGNORECASE)
        if week_m and current_employee:
            # Actualizar SÍ/NO desde la misma fila si aparecen juntos
            si_no = re.search(r'\b(SÍ|NO)\b', joined, re.IGNORECASE)
            if si_no:
                current_confirmed = (si_no.group(1).upper() == 'SÍ')
            month_name = week_m.group(1).lower()
            month = MONTH_MAP.get(month_name)
            if month:
                current_year = int(week_m.group(2))
                current_month = month
                in_data_block = False  # se activará al encontrar cabecera de tabla

        # ── Detectar cabecera de tabla (FECHA ↑ E ...) ───────────────────
        if any('FECHA' in t for t in all_texts) and current_employee and current_confirmed:
            in_data_block = True
            continue

        # ── Procesar fila de datos ────────────────────────────────────────
        if not in_data_block:
            continue
        if not current_year or not current_month:
            continue

        fecha_val = cols.get('fecha', '').strip()
        if not re.match(r'^\d{1,2}-\w+$', fecha_val):
            continue  # fila de totales, vacía, u otra cosa

        fecha = parse_date(fecha_val, current_year, current_month)
        if not fecha:
            continue

        marker    = cols.get('marker', '').strip()
        inicio    = cols.get('inicio', '').strip()
        fin_val   = cols.get('fin', '').strip()
        comida    = cols.get('comida', '').strip()
        cita      = cols.get('cita', '').strip()
        extras    = cols.get('extras', '').strip()

        # Ausencia: puede aparecer en 'marker' (x~183), 'inicio' o 'fin'
        ausencia = (detect_absence(marker) or detect_absence(inicio)
                    or detect_absence(fin_val))

        # Libranza: todos 0:00 y sin ausencia conocida
        if not ausencia and is_zero_time(inicio) and is_zero_time(fin_val):
            ausencia = 'libranza'

        especial = (marker.strip() == 'X')

        if ausencia:
            r = {
                'empleado_id':       current_employee,
                'fecha':             fecha,
                'entrada':           '',
                'salida':            '',
                'descanso_min':      '0',
                'citado_entrada':    '',
                'citado_salida':     '',
                'tipo_ausencia':     ausencia,
                'extras_pagados_min':'',
                'jornada_especial':  '',
                'nota_especial':     '',
                'observaciones':     '',
            }
        else:
            comida_min = t2m(comida) or 0
            cita_min   = t2m(cita)
            entrada_fmt = fmt_time_keep_zero(inicio) if is_valid_nonzero_time(inicio) else ''
            salida_fmt  = fmt_time_keep_zero(fin_val) if is_valid_nonzero_time(fin_val) else ''

            if entrada_fmt and cita_min:
                cit_in  = entrada_fmt
                cit_out = add_minutes(entrada_fmt, cita_min + comida_min)
            else:
                cit_in = cit_out = ''

            extras_min = ''
            em = t2m(extras)
            if em and em > 0:
                extras_min = str(em)

            r = {
                'empleado_id':       current_employee,
                'fecha':             fecha,
                'entrada':           entrada_fmt,
                'salida':            salida_fmt,
                'descanso_min':      str(comida_min),
                'citado_entrada':    cit_in,
                'citado_salida':     cit_out,
                'tipo_ausencia':     '',
                'extras_pagados_min':extras_min,
                'jornada_especial':  'true' if especial else '',
                'nota_especial':     '',
                'observaciones':     '',
            }

        result[current_employee].append(r)

    # Ordenar y desduplicar por fecha
    for eid in result:
        seen = set()
        unique = []
        for r in sorted(result[eid], key=lambda x: x['fecha']):
            if r['fecha'] not in seen:
                seen.add(r['fecha'])
                unique.append(r)
        result[eid] = unique

    return result

# ── Serialización CSV ─────────────────────────────────────────────────────────

def row_to_csv_line(r):
    return ','.join([
        r.get('empleado_id',''), r.get('fecha',''), r.get('entrada',''),
        r.get('salida',''), r.get('descanso_min',''), r.get('citado_entrada',''),
        r.get('citado_salida',''), r.get('tipo_ausencia',''),
        r.get('extras_pagados_min',''), r.get('jornada_especial',''),
        r.get('nota_especial',''), r.get('observaciones',''),
    ])

# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    args = sys.argv[1:]
    if not args:
        print('Uso: python3 scripts/pdf_to_csv.py <pdf_o_carpeta> [carpeta_salida] [--excluir id1,id2]')
        sys.exit(1)

    # Extraer --excluir id1,id2 si existe
    excluir = set()
    if '--excluir' in args:
        idx = args.index('--excluir')
        excluir = set(args[idx + 1].split(','))
        args = [a for i, a in enumerate(args) if i != idx and i != idx + 1]

    input_path = os.path.expanduser(args[0])
    output_dir = os.path.expanduser(args[1]) if len(args) > 1 else 'scripts/csv_output'
    os.makedirs(output_dir, exist_ok=True)

    pdfs = (
        sorted(os.path.join(input_path, f) for f in os.listdir(input_path) if f.lower().endswith('.pdf'))
        if os.path.isdir(input_path) else [input_path]
    )

    if not pdfs:
        print(f'No se encontraron PDFs en {input_path}')
        sys.exit(1)

    all_data = defaultdict(list)

    for pdf in pdfs:
        print(f'Procesando: {os.path.basename(pdf)}')
        try:
            data = parse_pdf(pdf)
            for eid, rows in data.items():
                all_data[eid].extend(rows)
        except Exception as e:
            print(f'  ERROR: {e}')

    for eid, rows in all_data.items():
        if eid in excluir:
            print(f'  (omitido: {eid})')
            continue
        seen = set()
        unique = []
        for r in sorted(rows, key=lambda x: x['fecha']):
            if r['fecha'] not in seen:
                seen.add(r['fecha'])
                unique.append(r)

        out_path = os.path.join(output_dir, f'{eid}_completo.csv')
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(CSV_HEADER + '\n')
            for r in unique:
                f.write(row_to_csv_line(r) + '\n')
        print(f'  → {out_path} ({len(unique)} jornadas)')

    print('Listo.')

if __name__ == '__main__':
    main()
