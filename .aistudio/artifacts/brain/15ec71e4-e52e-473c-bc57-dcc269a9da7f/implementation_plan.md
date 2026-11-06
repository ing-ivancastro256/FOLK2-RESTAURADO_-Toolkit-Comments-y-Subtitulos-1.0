# Módulo de Salidas de Prompts e Integración de Resultados Continuos de IA

Implementación del módulo de registro histórico **"Salidas prompt"** en la barra lateral con persistencia en IndexedDB, confirmación previa de análisis con selector ampliado (100, 300, 500, 1000, Todos), aviso de análisis previos, pop-up de decisión (*Ver ahora* vs *Ver después*), y transformación de la vista de resultados a una presentación continua vertical sin pestañas con botones de JSON en cabecera.

---

## Decisiones Críticas y Preferencias Confirmadas

> [!IMPORTANT]
> A continuación se resumen las decisiones acordadas durante la fase interactiva de clarificación que gobernarán la construcción del flujo:

- **Transición de pantalla (*Ver ahora*)**: Al presionar *Ver ahora* en la ficha del video, la interfaz reemplazará temporalmente el reproductor y comentarios por la vista continua de resultados de alta utilidad, con un botón destacado en la cabecera para **"← Volver al video y comentarios"**.
- **Visualización continua sin pestañas**: Se erradica la navegación por pestañas en los resultados. Todo el informe se despliega en una única página estructurada verticalmente en cascada: (1) Avatar y Cliente Ideal, (2) Problema Principal y Urgencia, (3) Dolores, Miedos y Deseos, (4) Voz del Cliente con Citas Verificadas, y (5) Oportunidades PAU recomendadas con precios ($5 - $47 USD).
- **Tratamiento del JSON**: Se retira el bloque abrumador de JSON crudo del cuerpo visual. Se ubican botones discretos y funcionales en la cabecera superior para **"Copiar JSON"** y **"Descargar .JSON"**.
- **Historial en tabla priorizada**: El nuevo módulo **"Salidas prompt"** en la barra lateral presentará una tabla de registros con las columnas acordadas: **Video** (con miniatura y canal), **Prompt ejecutado**, **Modelo de Gemini**, **Comentarios analizados**, **Fecha y hora**, y **Acciones** (*Ver resultado*, *Copiar JSON*, *Descargar*, *Eliminar*).
- **Historial por ejecuciones fechadas**: Cada nuevo análisis genera un registro individual fechado en IndexedDB, preservando el historial cronológico aunque se analice el mismo video múltiples veces.
- **Selector de comentarios ampliado y advertencia previa**: Opciones de límite: **100**, **300**, **500**, **1000** o **Todos**. Al hacer clic se muestra un modal de confirmación indicando el volumen de comentarios y advirtiendo si ya existe un análisis previo registrado para ese video.

---

## 1. Visión General y Concepto Central

### Qué resuelve este cambio
1. **Pérdida de análisis anteriores**: Antes, los análisis se sobreescribían o dependían de un estado volátil. Con el módulo **"Salidas prompt"**, cada ejecución queda registrada permanentemente en la base de datos local (IndexedDB) para su consulta posterior.
2. **Control de consumo de tokens y errores de clic**: El modal de confirmación previo evita envíos accidentales masivos (ej. enviar 5,000 comentarios por error).
3. **Flujo de trabajo no disruptivo (*Ver ahora* vs *Ver después*)**: El usuario puede analizar un video en segundo plano y optar por seguir navegando (*Ver después*), o entrar en modo de lectura profunda (*Ver ahora*).
4. **Ergonomía de lectura**: La presentación en una sola página vertical continua permite leer el reporte de cliente ideal como un informe de investigación de mercado cohesivo, sin saltos fragmentados entre pestañas.

---

## 2. Experiencia de Usuario y Flujo de Interacción

### Flujo 1: Ejecución del Análisis con Confirmación y Selector Ampliado
1. En la ficha de video (`YouTubeWatchViewer`) o en `CommentsTab`, el usuario elige la cantidad con los nuevos botones: `100`, `300`, `500`, `1000` o `Todos`, y el modelo de Gemini.
2. Al pulsar **"✨ Analizar comentarios con IA"**:
   - Se abre el **Modal de Confirmación**.
   - Muestra el total de comentarios a procesar y el modelo elegido.
   - Si el video ya fue analizado antes, muestra un aviso contextual: *"Ya existe un análisis previo de este video realizado el [Fecha]. Se creará un nuevo registro en tu historial."*
   - Botón *"Confirmar y Analizar"* inicia la llamada; *"Cancelar"* cierra el diálogo.

### Flujo 2: Notificación Post-Análisis (*Ver ahora* o *Ver después*)
1. Una vez obtenido y validado el resultado de Gemini, se almacena automáticamente en IndexedDB (`prompt_outputs`) y LocalStorage.
2. Emerge el diálogo de conclusión:
   - **"Ver ahora"**: Transforma la ficha del video en la nueva vista continua de pantalla completa con botón *"← Volver al video y comentarios"*.
   - **"Ver después"**: Cierra el diálogo, mantiene al usuario donde estaba (reproduciendo el video o leyendo comentarios) y muestra un toast: *"Análisis guardado en Salidas prompt"*.

### Flujo 3: Módulo "Salidas prompt" en la Barra Lateral
1. El usuario hace clic en el nuevo botón de navegación **"Salidas prompt"** en la barra lateral izquierda (con contador de registros).
2. Entra a una vista de panel tipo SaaS con:
   - Buscador rápido por título de video o prompt.
   - Tabla con tipografía tabular para métricas y fechas.
   - Botones directos para **Ver resultado**, **Copiar JSON** y **Eliminar**.
3. Al pulsar **Ver resultado**, se abre el visor continuo de resultados de ese análisis específico.

### Flujo 4: Visor Continuo Rediseñado (Sin Pestañas)
- **Cabecera Flotante/Sticky**: Nombre del prompt, título del video, modelo Gemini utilizado, fecha, botones **Copiar JSON**, **Descargar JSON** y **Volver**.
- **Bloque 1**: Perfil del Avatar y Cliente Ideal (demografía, arquetipo de comprador, nivel de conciencia 1-5, creencia limitante principal).
- **Bloque 2**: Problema Principal y Termómetro Emocional (problema raíz, emoción motora, barras visuales de urgencia e intensidad).
- **Bloque 3**: Matriz de Dolores, Miedos, Deseos y Soluciones Intentadas.
- **Bloque 4**: La Voz del Cliente (citas literales verificadas con likes y autor).
- **Bloque 5**: Brecha de Mercado y Catálogo de Ideas PAU ($5 a $47 USD) con potencial comercial, checkbox de selección y recomendación ganadora.

---

## 3. Decisiones Técnicas y Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                      Sidebar.tsx                            │
│  (Nuevo ítem: 'outputs' -> Salidas prompt [Badge Conteo])    │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                   app/page.tsx (Tab Switch)                 │
│  Renderiza: <PromptOutputsTab />                            │
└──────────────────────────────┬──────────────────────────────┘
                               │
               ┌───────────────┴───────────────┐
               ▼                               ▼
┌─────────────────────────────┐ ┌─────────────────────────────┐
│    PromptOutputsTab.tsx     │ │    PauContinuousView.tsx    │
│ - Tabla de registros        │ │ - Vista vertical continua   │
│ - Búsqueda y filtrado       │ │ - 5 Bloques analíticos      │
│ - Acciones por fila         │ │ - Botones JSON en cabecera  │
│ - Modal confirm. borrar     │ │ - Botón "← Volver"          │
└──────────────┬──────────────┘ └──────────────▲──────────────┘
               │                               │
               ▼                               │ (Invoca al hacer clic
┌─────────────────────────────┐                │  en "Ver ahora" o
│     lib/repository.ts       │                │  "Ver resultado")
│ - Store: 'prompt_outputs'   │────────────────┘
│ - savePromptOutput()        │
│ - getAllPromptOutputs()     │
│ - deletePromptOutput()      │
└─────────────────────────────┘
```

### Modelo de Datos TypeScript (`lib/types.ts`)
```typescript
export interface PromptExecutionRecord {
  id: string; // uuid o timestamp único
  promptId: string; // ej. 'prompt-pau-default'
  promptName: string; // ej. 'Detector de Problemas Urgentes PAU'
  videoId: string;
  videoTitle: string;
  channelTitle?: string;
  thumbnailUrl?: string;
  modelUsed: string; // 'gemini-3.8-flash' | 'gemini-3.1-flash-lite' | etc.
  commentsCount: number; // total comentarios preprocesados y analizados
  commentsSelectedQty: 100 | 300 | 500 | 1000 | 'all';
  result: PauAnalysisResult;
  createdAt: number;
}
```

---

## 4. Estado de Implementación: COMPLETADO CON ÉXITO ✅

- [x] **Base de Datos & Repositorio**: Esquema Dexie v5 con tabla `prompt_outputs`, métodos de repositorio `savePromptOutput`, `getAllPromptOutputs`, `getPromptOutputsByVideo`, `deletePromptOutput` y `clearAllPromptOutputs`.
- [x] **Selector Ampliado de Comentarios**: Opciones de límite `100`, `300`, `500`, `1000` y `Todos` en `YouTubeWatchViewer` y `CommentsTab`.
- [x] **Modal de Confirmación Previo**: Muestra cantidad exacta de comentarios y modelo seleccionado, con detección automática y advertencia si el video ya había sido analizado previamente.
- [x] **Diálogo Post-Análisis ("Ver ahora" vs "Ver después")**:
  - *Ver ahora*: Reemplaza el visor por el reporte continuo sin pestañas y con botón "← Volver al video y comentarios".
  - *Ver después*: Cierra el modal y mantiene al usuario en su navegación actual con confirmación visual de guardado.
- [x] **Nuevo Módulo "Salidas prompt"**: Ubicado en la barra lateral izquierda justo encima de "Gestión de Prompts" con tabla de historial, búsqueda, conteo de registros, visualización en pantalla completa de resultados, copiado/descarga de JSON y eliminación.
- [x] **Visor Continuo de Resultados (PauContinuousView)**: Formato continuo vertical sin pestañas, 5 bloques estructurados, sin JSON crudo en el cuerpo y botones de "Copiar JSON" y "Descargar .JSON" en la cabecera.
- [x] **Verificación**: Linting y compilación de Next.js superados sin errores.
