# CIAC Registro MVP para Vercel

MVP funcional enfocado en cuatro flujos:

1. ingresar RUN correctamente
2. autocompletar datos desde la matriz
3. registrar entrada y salida correctamente
4. mostrar registros del día

## Stack objetivo

- Frontend simple con HTML, CSS y JavaScript.
- Backend con rutas serverless en `api/` para Vercel.
- Persistencia compatible con Vercel usando REST de Vercel KV si defines `KV_REST_API_URL` y `KV_REST_API_TOKEN`.
- Fallback local en `data/attendance-records.json` para desarrollo local sin depender de SQLite persistente para registros.

## Endpoints

- `GET /api/buscar?run=12345678`
- `POST /api/registrar`
- `GET /api/registros-hoy`

## Fuente de datos

La matriz se lee desde `data/matrizsjvita.db` en modo solo lectura y se mapea así:

- `rut` -> `run`
- `dv` -> `dv`
- `carrera_ingreso` -> `carrera`
- `cohorte` -> `anio_ingreso`

Si existe una columna de nombre equivalente, también se autocompleta.

## Desarrollo local

```bash
node server.js
```

Luego abre `http://localhost:3000`.

## Despliegue en Vercel

1. Sube este repo a GitHub.
2. Importa el proyecto en Vercel.
3. Configura estas variables de entorno si quieres persistencia real en Vercel:
   - `KV_REST_API_URL`
   - `KV_REST_API_TOKEN`
4. Despliega.

Si no configuras KV, las funciones seguirán respondiendo, pero en Vercel los registros no serán persistentes entre invocaciones.
