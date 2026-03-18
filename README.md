# CIAC Registro MVP

MVP funcional enfocado solo en lo crítico:

1. ingreso correcto de RUN
2. autocompletado desde matriz local
3. registro de entrada y salida
4. tabla del día

## Stack

- Node.js
- Express
- SQLite local usando `node:sqlite`
- HTML + CSS + JavaScript simple

## Cómo ejecutar

```bash
npm install
npm start
```

Abre `http://localhost:3000`

## Estructura

- `server.js`: backend y lógica de base de datos
- `public/index.html`: interfaz MVP
- `public/styles.css`: estilos simples
- `public/app.js`: lógica frontend
- `data/ciac_registro.db`: base local generada por la app
- `data/matrizsjvita.db`: base de respaldo cargada en este MVP

## Carga de matriz

El backend intenta en este orden:

1. `data/matriz_estudiantes.sql`
2. `data/matrizsjvita.db`

Si existe `data/matriz_estudiantes.sql` y la tabla `matriz_estudiantes` no está creada, la importa automáticamente.
Si no existe ese SQL, usa la base local de respaldo.

## Nota importante sobre el nombre

La base subida `matrizsjvita.db` no trae columna de nombre. Por eso:

- sí autocompleta DV
- sí autocompleta carrera
- sí autocompleta año de ingreso
- el nombre queda manual

Si luego reemplazas la fuente por un SQL que sí tenga un campo de nombre, el backend lo detecta automáticamente y también autocompleta ese dato.
