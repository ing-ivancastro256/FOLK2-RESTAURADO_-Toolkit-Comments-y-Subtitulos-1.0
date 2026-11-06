# YouTube Content Toolkit — Plan de Arquitectura e Implementación

Aplicación web integral y modular para creadores y estrategas de contenido de YouTube. Permite inspeccionar metadatos reales, extraer y previsualizar miniaturas en máxima resolución (MaxRes, HQ, SD), descargar transcripciones reales con marcas de tiempo, analizar etiquetas y SEO competitivo, y reempaquetar el contenido con IA (Gemini 2.5) en Shorts, hilos de X, artículos y boletines, todo respaldado por una capa de persistencia local en IndexedDB diseñada para migrar sin fricción a Supabase.

---

## Decisiones Críticas y Confirmaciones del Usuario

> [!IMPORTANT]
> **Decisiones confirmadas para el MVP 1:**
> - **Alcance funcional prioritario**: Suite completa y modular que integra en una misma estación de trabajo: Extractor de Metadatos y Métricas, Gestor de Miniaturas HD, Extractor de Transcripciones/Subtítulos reales, y Estudio de Repurposing con IA.
> - **Estrategia de APIs de YouTube**: Modo híbrido. La aplicación opera de forma 100% funcional sin requerir credenciales (usando endpoints públicos oEmbed y stream metadata), pero incluye un panel de configuración para que el usuario pueda ingresar opcionalmente su clave de **YouTube Data API v3** para ampliar cuotas y métricas avanzadas (estadísticas detalladas, comentarios, etc.).
> - **Persistencia local pre-Supabase**:
>   - **IndexedDB**: Motor primario para datos estructurados (historial de videos analizados, transcripciones completas, lotes de miniaturas, piezas de contenido generadas por IA, proyectos y notas). Se implementará con **Dexie.js** para garantizar tipado fuerte, transaccionalidad, índices eficientes y control de cuotas (`navigator.storage.estimate()`).
>   - **LocalStorage**: Exclusivo para preferencias ligeras (tema visual claro/oscuro, orden de visualización, filtros activos, clave de API de YouTube en local si el usuario la provee).
>   - **Capa de Repositorio desacoplada**: Contratos e interfaces (`IContentRepository`) que aíslan la UI del motor de almacenamiento, listos para conectarse a Supabase (PostgreSQL + RLS + Auth) en la siguiente fase sin tocar componentes React.

---

## 1. Visión General y Concepto Central

### ¿Qué hace la aplicación?
YouTube Content Toolkit convierte cualquier URL o ID de video de YouTube en un centro de comando analítico y de reutilización de contenido:
1. **Inspector de Video y Metadatos**: Valida cualquier enlace de YouTube (`watch?v=`, `youtu.be/`, Shorts o Live), obtiene metadatos oficiales (título, autor, canal, duración, tags, vistas, fecha) y reproduce el embed con control de marcas de tiempo.
2. **Descargador y Comparador de Miniaturas HD**: Muestra y descarga en un clic las versiones oficiales en máxima fidelidad: `maxresdefault` (1080p/720p), `sddefault` (640×480), `hqdefault` (480×360) y `mqdefault` (320×180), con herramienta de previsualización en feed para evaluar el CTR.
3. **Extractor de Transcripciones Reales**: Obtiene el texto íntegro y los fragmentos con marcas de tiempo (timestamped captions). Permite búsqueda interactiva, copia rápida en formato texto o SRT/VTT, y salto al segundo exacto del video.
4. **Laboratorio de Repurposing con IA**: Utiliza el SDK de Gemini desde el servidor (`gemini-3.8-flash`) para transformar la transcripción real en:
   - Guion para YouTube Short / Reel de 60 segundos con ganchos (hooks) y llamadas a la acción.
   - Hilo para X (Twitter) de 5 a 7 publicaciones optimizado para retención.
   - Publicación estructurada para LinkedIn.
   - Artículo de blog / Newsletter con titulares persuasivos.
5. **Gestor de Biblioteca e Historial (IndexedDB)**: Guarda automáticamente las sesiones, permite etiquetar videos favoritos, exportar en JSON/Markdown y auditar el uso de cuota local con opción de limpieza selectiva.

### Audiencia Objetivo
Creadores de contenido en YouTube, editores de video, agencias de marketing digital y community managers que necesitan acelerar su flujo de trabajo sin saltar entre cinco herramientas dispersas.

---

## 2. Experiencia de Usuario y Diseño Visual

### Identidad Visual y Estilo
- **Dirección estética**: Panel de control técnico moderno, sobrio y de alta densidad para creadores (SaaS Workspace). Evita estilos infantiles o excesos de neón.
- **Paleta de color (Tailwind v4 tokens)**:
  - *Neutros dominantes (60%)*: Slate ultra oscuro (`#0b0f19`) en modo oscuro, blanco puro / zinc muy suave (`#f8fafc`) en modo claro.
  - *Superficies y divisiones (30%)*: Contenedores planos con bordes finos de 1px (`border-slate-800` / `border-slate-200`) y fondos sutilmente contrastados (`bg-slate-900/60` / `bg-white`).
  - *Acentos (10%)*: Rojo YouTube distintivo (`#ef4444` / `rose-600`) para acciones clave y estados activos; acentos secundarios esmeralda (`#10b981`) para confirmaciones de copia o descarga.
- **Tipografía**:
  - Títulos y navegación: *Plus Jakarta Sans* / Sans contemporáneo de peso 600–700 con `text-wrap: balance`.
  - Lectura y controles: Sans legible a 14px–15px con espaciado natural.
  - Métricas, duraciones y marcas de tiempo: `font-mono tabular-nums` para alineación vertical sin saltos.
- **Arquitectura de Navegación**:
  - Barra superior conforme al contrato de 3 zonas: Logotipo y marca (`YouTube Content Toolkit`), enlaces rápidos a módulos (`Inspector`, `Miniaturas`, `Transcripción`, `Repurposing`, `Biblioteca`), y botón de estado / configuración de cuota.
  - Barra de búsqueda central en el Hero con soporte para pegado rápido de URLs y detección automática del Video ID.

---

## 3. Modelo de Almacenamiento Local (IndexedDB & LocalStorage)

### Colecciones en IndexedDB (`youtube_toolkit_db` vía Dexie)

```typescript
// Esquema Dexie v1
db.version(1).stores({
  // Historial de videos analizados y sus metadatos
  videos: '++id, videoId, title, channelTitle, publishedAt, duration, createdAt, isFavorite',
  
  // Transcripciones completas con segmentos temporales
  transcripts: '++id, videoId, language, textLength, createdAt',
  
  // Contenido generado por IA (Shorts, hilos, newsletters, posts)
  generated_content: '++id, videoId, type, title, createdAt, isSaved',
  
  // Registro de tareas y operaciones (logs de extracción y errores)
  operations: '++id, videoId, operationType, status, startedAt, completedAt'
});
```

- **`videos`**: Almacena metadatos del video (`videoId`, `url`, `title`, `description`, `author`, `authorUrl`, `viewCount`, `likeCount`, `thumbnails`, `tags`, `isFavorite`, `createdAt`).
- **`transcripts`**: Almacena el cuerpo de la transcripción y el array de segmentos (`[{ start: number, duration: number, text: string }]`).
- **`generated_content`**: Almacena los borradores creados por el motor de IA (`type: 'shorts' | 'twitter_thread' | 'linkedin' | 'newsletter' | 'summary'`, texto, fecha de creación).
- **`operations`**: Registro de operaciones para trazabilidad, reintentos y auditoría de fallos.

### Preferencias en LocalStorage
- `yt_theme`: `'light' | 'dark' | 'system'`.
- `yt_api_key`: Clave opcional de YouTube Data API v3 (encriptada/ofuscada en el navegador para extender cuotas).
- `yt_auto_analyze`: Booleano para iniciar el análisis automáticamente tras pegar un enlace.
- `yt_default_tab`: Módulo activo por defecto (`'metadata' | 'thumbnails' | 'transcript' | 'repurpose'`).

---

## 4. Arquitectura del Sistema y Capa de Abstracción

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Cliente (Next.js 15 React)                      │
│                                                                        │
│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────────────┐  │
│  │ Video Inspector │  │ Thumbnail Studio │  │ Transcript & Captions │  │
│  └────────┬────────┘  └────────┬─────────┘  └───────────┬───────────┘  │
│           │                    │                        │              │
│           └────────────────────┼────────────────────────┘              │
│                                ▼                                       │
│                    ┌───────────────────────┐                           │
│                    │ Repurposing Studio AI │                           │
│                    └───────────┬───────────┘                           │
│                                │                                       │
│                                ▼                                       │
│               ┌─────────────────────────────────┐                      │
│               │   IContentRepository (Boundary) │                      │
│               └────────┬──────────────────────┬─┘                      │
│                        │                      │                        │
│            ┌───────────▼──────────┐ ┌─────────▼──────────────┐         │
│            │ IndexedDBRepository  │ │ SupabaseRepository     │         │
│            │ (Dexie.js - Fase 1)  │ │ (PostgreSQL - Fase 2)  │         │
│            └──────────────────────┘ └────────────────────────┘         │
└─────────────────────────────────┬──────────────────────────────────────┘
                                  │ Fetch Server Routes
                                  ▼
┌────────────────────────────────────────────────────────────────────────┐
│                        Servidor Next.js (API Routes)                   │
│                                                                        │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ /api/youtube/metadata │  │ /api/youtube/transcript               │  │
│  └───────────┬───────────┘  └───────────────────┬───────────────────┘  │
│              │                                  │                      │
│              ▼                                  ▼                      │
│  ┌───────────────────────┐  ┌───────────────────────────────────────┐  │
│  │ YouTube Public / API  │  │ Gemini 3.8 Flash (AI Repurposing)     │  │
│  │ v3 Hybrid Connector   │  │ via @google/genai                     │  │
│  └───────────────────────┘  └───────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 5. Bloques de Construcción y Criterios de Aceptación

### Bloque 1: Cimientos de Datos, Repositorio y Arquitectura Base
- **Objetivo**: Configurar dependencias (`dexie`, paquetes auxiliares), la capa de repositorio tipada (`IContentRepository`), utilidades de validación de URLs de YouTube y el layout responsive con tema claro/oscuro.
- **Entregables**:
  - Esquema y base de datos Dexie `db.ts`.
  - Implementación de `IndexedDBContentRepository`.
  - Módulo de utilidades `youtube-url.ts` (extrae video IDs de URLs estándar, cortas, Shorts y embeds).
  - Gestor de cuota de almacenamiento (`StorageManager`) con aviso de uso.
- **Criterio de Aceptación**:
  - Se puede inicializar la base de datos sin errores de hydration en Next.js.
  - `IContentRepository` permite guardar, listar, buscar y borrar registros de prueba con IndexedDB real.
  - La cuota de almacenamiento se calcula e informa correctamente en el navegador.

### Bloque 2: Extractor de Metadatos y Estudio de Miniaturas HD
- **Objetivo**: Implementar la extracción real de metadatos de videos de YouTube y la suite de descarga y vista previa de miniaturas.
- **Entregables**:
  - Endpoint `/api/youtube/metadata` con soporte dual: oEmbed público + extracción de metaetiquetas enriquecidas + fallback a YouTube Data API v3 si se proporciona clave.
  - Interfaz de inspección con reproductor incrustado, título, canal, duración, estadísticas y etiquetas.
  - Galería de miniaturas con resoluciones MaxRes (1280x720), SD (640x480), HQ (480x360) y MQ (320x180).
  - Botón de descarga directa con conversión a Blob para evitar bloqueos de CORS, y vista previa interactiva en minicard tipo feed de YouTube.
- **Criterio de Aceptación**:
  - Al ingresar una URL real de YouTube (p. ej., un video oficial), se extraen título, autor, canal y miniaturas reales.
  - El botón de descarga descarga el archivo JPG en su resolución nativa.

### Bloque 3: Extractor de Transcripciones y Subtítulos Reales
- **Objetivo**: Extracción real de transcripciones y pistas de subtítulos de videos de YouTube con marcas de tiempo.
- **Entregables**:
  - Endpoint `/api/youtube/transcript` que extrae subtítulos oficiales / autogenerados reales del video.
  - Visualizador sincronizado de transcripción con búsqueda en tiempo real de palabras clave.
  - Exportación en formatos: Texto plano (.txt), Subtítulos (.srt), WebVTT (.vtt) y JSON estructurado.
  - Posibilidad de hacer clic en cualquier marca de tiempo para saltar a ese segundo en el reproductor.
- **Criterio de Aceptación**:
  - Un video con subtítulos en español o inglés devuelve las frases exactas con sus segundos de inicio.
  - El usuario puede descargar el archivo `.srt` o copiar el texto completo al portapapeles.

### Bloque 4: Motor de Repurposing de Contenido con IA (Gemini 2.5)
- **Objetivo**: Generar automáticamente formatos derivados de alta conversión a partir de la transcripción real obtenida.
- **Entregables**:
  - Endpoint seguro `/api/gemini/repurpose` usando `@google/genai` con `gemini-3.8-flash`.
  - Plantillas de transformación:
    1. Guion de Short / TikTok (Gancho de 3s, problema, 3 puntos clave, llamada a la acción).
    2. Hilo de X (Tweet gancho + 5 tweets de valor + tweet de cierre).
    3. Publicación para LinkedIn (Formato historia con espacio en blanco optimizado para lectura).
    4. Resumen ejecutivo y preguntas frecuentes (FAQ) para boletines.
  - Editor interactivo para afinar el texto generado, copiar en 1 clic y guardar directamente en la biblioteca IndexedDB.
- **Criterio de Aceptación**:
  - A partir de una transcripción real, Gemini genera piezas de contenido estructuradas y personalizadas según el tono elegido.
  - Las piezas generadas quedan registradas en la colección `generated_content` de IndexedDB vinculadas al `videoId`.

### Bloque 5: Biblioteca de Proyectos, Historial y Exportación
- **Objetivo**: Gestión integral de los contenidos guardados, estadísticas de uso local y preparación de la migración a Supabase.
- **Entregables**:
  - Vista de Biblioteca con filtros por tipo (videos analizados, borradores de IA, favoritos).
  - Búsqueda global en contenidos guardados.
  - Herramienta de exportación masiva (JSON / ZIP con Markdown) y botón de purga selectiva de datos.
  - Generador de esquema SQL (`supabase_schema.sql`) para que el usuario pueda copiar y ejecutar en Supabase en cuanto tenga su proyecto listo.
- **Criterio de Aceptación**:
  - El usuario puede ver todos sus proyectos previos sin conexión a servidores externos.
  - Se puede exportar la base de datos completa a un archivo descargable.
