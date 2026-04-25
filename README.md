# Mentes Maestras

Una webapp donde el usuario plantea un problema, una idea o una decisión y elige
una figura histórica (Einstein, Musk, Jobs, Marie Curie, Sun Tzu, Frida
Kahlo...) para que la IA conteste **como contestaría esa persona**, aplicando
su forma real de pensar al asunto.

## Cómo funciona

- 15 figuras con biografía, estilo de pensamiento y "voz" definidos en
  `data/figures-part*.js`.
- El backend Express expone `POST /api/ask`. Construye un prompt de sistema
  con la ficha de la figura elegida (con `cache_control` para que las
  consultas repetidas a la misma figura sean baratas) y reenvía la respuesta
  al cliente vía Server-Sent Events.
- El frontend (HTML/CSS/JS sin frameworks) muestra el catálogo de figuras,
  acepta la pregunta y renderiza la respuesta en streaming con un markdown
  ligero (negrita, cursiva, listas).

## Requisitos

- Node.js 18+
- Una clave de la API de Anthropic (https://console.anthropic.com/)

## Puesta en marcha

```bash
cp .env.example .env
# Edita .env y pega tu ANTHROPIC_API_KEY
npm install
npm start
```

Abre http://localhost:3000

### Variables de entorno

| Variable             | Por defecto         | Descripción                                       |
| -------------------- | ------------------- | ------------------------------------------------- |
| `ANTHROPIC_API_KEY`  | (requerida)         | Tu clave de la API de Anthropic.                  |
| `ANTHROPIC_MODEL`    | `claude-sonnet-4-6` | Modelo de Claude. `claude-opus-4-7` da más calidad. |
| `PORT`               | `3000`              | Puerto del servidor.                              |

## Estructura

```
.
├── server.js              # Express + endpoint /api/ask con streaming SSE
├── src/prompt.js          # Constructor del prompt de sistema (con caching)
├── data/
│   ├── figures.js         # Agrega todas las figuras
│   └── figures-part*.js   # Fichas de cada lote de figuras
└── public/
    ├── index.html
    ├── styles.css         # Base
    ├── styles-components.css
    ├── app.js             # Lógica del cliente y consumo del SSE
    └── favicon.svg
```

## Añadir una figura nueva

Añade un objeto al `export const partN` correspondiente (o crea un nuevo
`figures-partN.js` y agrégalo al import de `data/figures.js`). Cada figura
necesita: `id`, `name`, `era`, `field`, `tagline`, `color`, `avatar` (2
letras), `bio`, `thinkingStyle`, `voiceHints`.

## Aviso

Las respuestas son **interpretaciones generadas por IA**, no citas
literales. Úsalas como inspiración, no como verdad histórica.
