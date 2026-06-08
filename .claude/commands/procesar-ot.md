Procesa un PDF de fichas semanales y genera un CSV por empleado.

El argumento es la ruta al PDF (o carpeta con varios PDFs): $ARGUMENTS

**Ejecuta:**
```bash
python3 scripts/pdf_to_csv.py $ARGUMENTS scripts/csv_output/
```

Cuando termine, muestra un resumen de los archivos generados y cuántas jornadas tiene cada empleado.

Si hay errores, muéstralos con contexto para que el usuario pueda corregirlos.
