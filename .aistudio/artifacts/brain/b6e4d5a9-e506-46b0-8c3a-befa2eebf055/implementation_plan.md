# Corrección Integral de Filtros de Búsqueda y Visor Estilo YouTube con Descarga de Comentarios

Plan de arquitectura y solución para hacer 100% funcionales todos los filtros de búsqueda de YouTube, agregar barra exterior de ordenamiento dinámico y transformar la interacción de búsqueda en una experiencia estilo YouTube (cambio a vista de reproducción con reproductor central, metadatos originales, etiquetas y selección/descarga de comentarios en TXT, CSV y JSON con botón "Atrás").

## Decisiones Críticas y Respuestas del Usuario

> [!IMPORTANT]
> - **Transición de pantalla estilo YouTube**: Al hacer clic en la miniatura o título de un video en el buscador, la pantalla completa del dashboard cambiará a la vista individual del video ("Watch Page Wrapper"), mostrando el reproductor principal en el centro, canal, vistas, fecha, etiquetas, descripción completa y comentarios abajo, con un botón destacado **"← Volver a resultados de búsqueda"** que preserva la búsqueda y filtros intactos.
> - **Descarga de comentarios**: Selector individual y botón "Seleccionar todos" para comentarios, permitiendo descargar los comentarios marcados en **TXT, CSV y JSON**.
> - **Visor puro en el buscador**: La vista individual en el buscador es un visor fiel de YouTube sin botones invasivos de descarga de medios, concentrándose en reproducción, análisis de metadatos y exportación de comentarios.

---

## 1. Diagnóstico y Corrección de Filtros de Búsqueda

### ¿Por qué fallaban los filtros anteriormente?
1. **Petición pública sin tokens nativos de YouTube (`sp` protobuf)**: YouTube no filtra adecuadamente en peticiones públicas si solo se agregan palabras clave a la URL. Requiere los tokens `sp` nativos calculados (o llamada a YouTube Data API v3 con los parámetros oficiales `publishedAfter`, `videoDuration`, `eventType`, etc.).
2. **Falta de filtrado y parseo determinista**: Cuando la consulta devuelve videos generales, el backend debe normalizar y verificar estrictamente las marcas de tiempo (`hace 2 horas`, `hace 1 día`, `hace 4 días`), duraciones en segundos y tipos de contenido, excluyendo implacablemente cualquier resultado que no cumpla el filtro seleccionado.
3. **Persistencia y ejecución inmediata del filtro**: Al seleccionar "Hoy", "Esta semana", "En vivo", etc., el buscador debe re-ejecutar la búsqueda y aplicar el filtro de forma inmediata tanto en backend como en frontend.

### Estrategia de Filtrado Real:
- **Fecha de Carga**:
  - *Hoy*: Solo videos publicados hace $\le 24$ horas (detectando "horas", "minutos", o fechas de hoy).
  - *Esta semana (7 días)*: Solo videos con $< 7$ días (descartando "meses", "años").
  - *Este mes*: Solo videos con $< 30$ días.
  - *Este año*: Solo videos del año actual.
- **Duración**:
  - *Inferior a 3 minutos*: Excluye videos $\ge 180$ segundos.
  - *De 3 a 20 minutos*: Solo videos entre 180s y 1200s.
  - *Más de 20 minutos*: Solo videos $> 1200$ segundos.
- **Características**:
  - *En vivo*: Filtrar por transmisiones actuales o eventos live.
  - *4K / HD / Subtítulos / Creative Commons*: Verificación explícita de distintivos y metadatos.
- **Barra Externa de Ordenamiento**:
  - Menú desplegable o botones inmediatos fuera del modal:
    - *Más vistos (Número de vistas)*
    - *Más recientes (Fecha de publicación)*
    - *Duración (Mayor a menor / Menor a mayor)*
    - *Relevancia (Algoritmo original)*

---

## 2. Visor Individual de Video ("YouTube Watch Wrapper")

Al pulsar sobre cualquier miniatura o título de los resultados de búsqueda:
1. **Transición fluida en el Dashboard**: El listado de búsqueda se oculta temporalmente (guardando en memoria la consulta, página y filtros) y se muestra el visor individual:
   - **Barra de navegación superior del visor**: Botón **"← Volver a resultados de búsqueda"** con contador de resultados encontrados.
   - **Reproductor Central**: IFrame oficial de YouTube en proporción 16:9 con controles nativos y máxima resolución.
   - **Fila de Título y Canal**:
     - Título completo del video en tipografía display.
     - Avatar del canal, nombre del canal y badge de verificación.
     - Métricas reales: vistas con formato completo y compacto, fecha exacta de carga y duración.
   - **Caja de Etiquetas SEO**:
     - Visualización de todas las etiquetas (*tags*) del video con opción de copiar individuales o todas.
   - **Descripción Desplegable**:
     - Vista con botón "Mostrar más / Mostrar menos", conservando formato, enlaces y capítulos.
   - **Sección de Comentarios Estilo YouTube**:
     - Contador total de comentarios.
     - Barra de herramientas con:
       - Casilla de verificación **"Seleccionar todos los comentarios"** ($N$ seleccionados).
       - Botón **"Descargar comentarios"** con menú para elegir **TXT**, **CSV** o **JSON**.
     - Lista de comentarios con casilla individual, avatar de autor, nombre, fecha, texto del comentario y contador de likes.

---

## 3. Arquitectura de Componentes y Flujo de Datos

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Dashboard (app/page.tsx)                        │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │ activeTab === 'search'
┌───────────────────────────────────▼────────────────────────────────────┐
│                    YouTubeSearchTab.tsx (Estado)                       │
│  - query, activeFilters, sortOrder, selectedVideoId, searchHistory     │
└───────────────┬────────────────────────────────────────┬───────────────┘
                │ Si selectedVideoId === null            │ Si selectedVideoId !== null
┌───────────────▼──────────────────────┐   ┌─────────────▼───────────────┐
│        Vista de Resultados           │   │  YouTubeWatchViewer.tsx     │
│  - Barra de búsqueda + Filtros       │   │  - Botón "← Volver"         │
│  - Barra exterior de Ordenación:     │   │  - Reproductor 16:9 central │
│    [Vistas | Fecha | Duración | Rel] │   │  - Título, Canal y Métricas │
│  - Modal 5 Columnas (YouTube exacto) │   │  - Etiquetas SEO            │
│  - Cuadrícula de Tarjetas interactivas│  │  - Descripción expandible   │
│    (Clic en miniatura/título abre)   │   │  - Comentarios con Checkbox │
└───────────────┬──────────────────────┘   │  - Descarga TXT / CSV / JSON│
                │                          └─────────────┬───────────────┘
                │ Fetch con filtros reales               │ Fetch comentarios
┌───────────────▼────────────────────────────────────────▼───────────────┐
│        Rutas de API (/api/youtube/search y /api/youtube/comments)      │
│  - Tokens 'sp' y parámetros oficiales de búsqueda                      │
│  - Normalización estricta de fechas relativas y duraciones             │
│  - Fallback a YouTube Data API v3 si hay clave configurada             │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 4. Plan de Ejecución por Fases

1. **Ruta de Búsqueda (`/app/api/youtube/search/route.ts`)**:
   - Incorporar decodificación y mapeo de tokens `sp` de YouTube para búsquedas públicas.
   - Implementar algoritmo estricto de filtro temporal (descartar videos que no sean de hoy o de esta semana según corresponda).
   - Aplicar ordenamiento real por vistas numéricas, fecha relativa convertida a milisegundos y duración en segundos.
2. **Interfaz de Búsqueda (`/components/YouTubeSearchTab.tsx`)**:
   - Conectar la aplicación inmediata de filtros tanto al pulsar en el modal como en los chips externos.
   - Agregar barra exterior de ordenación (*"Ordenar por: Relevancia | Número de vistas | Fecha de subida | Duración"*).
   - Añadir estado `selectedVideo` para alternar entre el listado de búsqueda y el visor individual sin recargar la página.
3. **Nuevo Componente Visor ("YouTubeWatchViewer")**:
   - Reproductor incrustado responsivo.
   - Cabecera con datos originales: vistas, fecha, canal, tags y descripción.
   - Carga de comentarios reales con casillas de selección múltiple.
   - Exportadores a TXT (texto legible), CSV (columnas Autor, Fecha, Likes, Comentario) y JSON (datos estructurados).
4. **Verificación y Compilación**:
   - Probar búsquedas con filtros de fecha (ej. "hoy", "esta semana"), características ("en vivo", "4k"), duraciones y ordenación.
   - Verificar compilación limpia sin advertencias ni errores de TypeScript.
