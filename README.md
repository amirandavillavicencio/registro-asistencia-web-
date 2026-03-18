# CIAC Registro

Aplicación web local para registrar asistencia y uso del CIAC con backend Node.js y SQLite local.

## Requisitos

- Node.js 22+
- `sqlite3` CLI disponible en el sistema
- `zip` y `unzip` para exportación/verificación `.xlsx`

## Ejecutar

```bash
npm start
```

Abrir `http://localhost:3000`.

## Base de datos

- Archivo SQLite local: `data/ciac_registro.sqlite`
- Si existe `data/matriz_estudiantes.sql` y la tabla `matriz_estudiantes` no existe, se importa automáticamente al iniciar.
- Si la tabla ya existe, la importación no se repite.

## Verificación rápida

```bash
npm test
```

El smoke test:
- crea una `matriz_estudiantes.sql` real temporal,
- valida autocompletado por RUN,
- valida entrada/salida,
- valida tabla del día,
- valida informe,
- valida que se genere un `.xlsx` con estructura correcta.
