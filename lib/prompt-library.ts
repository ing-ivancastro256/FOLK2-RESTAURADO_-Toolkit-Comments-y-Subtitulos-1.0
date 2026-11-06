import { DEFAULT_PAU_DETECTOR_PROMPT } from './pau-prompt';

export type DefaultPromptGroup =
  | 'Análisis PAU'
  | 'Guiones de YouTube'
  | 'Miniaturas'
  | 'Edición';

export type PromptGroup = DefaultPromptGroup | string;

export interface StoredPrompt {
  id: string;
  title: string;
  group: PromptGroup;
  description: string;
  promptText: string;
  isBuiltIn?: boolean;
  createdAt: number;
  updatedAt: number;
  supportedVariables?: string[];
}

export const PRECONFIGURED_PROMPT_GROUPS: DefaultPromptGroup[] = [
  'Análisis PAU',
  'Guiones de YouTube',
  'Miniaturas',
  'Edición',
];

export const COMMON_PROMPT_VARIABLES = [
  { tag: '{{COMENTARIOS}}', desc: 'Comentarios preprocesados y ordenados por likes' },
  { tag: '{{GUION}}', desc: 'Transcripción o guión completo del video con marcas de tiempo' },
  { tag: '{{TITULO}}', desc: 'Título oficial del video de YouTube' },
  { tag: '{{DESCRIPCION}}', desc: 'Descripción y enlaces del video' },
  { tag: '{{DURACION}}', desc: 'Duración total formateada del video' },
];

export const INITIAL_DEFAULT_PROMPTS: StoredPrompt[] = [
  {
    id: 'prompt-pau-default',
    title: 'Detector de Problemas Urgentes PAU',
    group: 'Análisis PAU',
    description:
      'Analiza comentarios reales de clientes potenciales y detecta problemas urgentes, dolor de fondo, emoción raíz, miedos, deseos, citas textuales y oportunidades de Productos de Alta Utilidad (PAU) valorados de $5 a $47 USD.',
    promptText: DEFAULT_PAU_DETECTOR_PROMPT,
    isBuiltIn: true,
    createdAt: 1730000000000,
    updatedAt: 1730000000000,
    supportedVariables: ['{{COMENTARIOS}}'],
  },
  {
    id: 'prompt-script-cleanup',
    title: 'Limpieza y Estructuración de Guión con Marcas de Tiempo',
    group: 'Guiones de YouTube',
    description:
      'Limpia transcripciones sin editar de videos largos o Shorts, eliminando muletillas, pausas y errores de reconocimiento, segmentando el contenido en secciones lógicas con sus marcas de tiempo para YouTube Script Intelligence.',
    promptText: `Eres un editor jefe y guionista senior de YouTube.

Tu tarea es tomar la siguiente transcripción sin procesar y transformarla en un guión limpio, legible y listo para producción.

TÍTULO DEL VIDEO:
{{TITULO}}

GUION / TRANSCRIPCIÓN CON TIEMPOS:
{{GUION}}

INSTRUCCIONES ESPECÍFICAS:
1. Limpia muletillas ("ehh", "bueno", "o sea", repeticiones involuntarias) respetando la voz natural del creador.
2. Organiza el contenido en bloques temáticos claros con su marca de tiempo de inicio (formato [MM:SS]).
3. Identifica y resalta el GANCHO INICIAL (los primeros 30 segundos).
4. Agrega llamadas a la acción (CTA) sugeridas en los momentos de mayor interés.
5. Devuelve el contenido estructurado con títulos de sección en negrita y viñetas de soporte.`,
    isBuiltIn: true,
    createdAt: 1730000001000,
    updatedAt: 1730000001000,
    supportedVariables: ['{{GUION}}', '{{TITULO}}'],
  },
  {
    id: 'prompt-thumb-concepts',
    title: 'Generador de Conceptos Visuales para Miniaturas',
    group: 'Miniaturas',
    description:
      'Analiza el ángulo emocional del video y diseña 3 conceptos contrastantes de miniatura de alta retención (curiosidad, impacto y transformación) con textos de gancho de menos de 4 palabras.',
    promptText: `Eres un director de arte y estratega de CTR para canales de YouTube con millones de suscriptores.

A partir del título y la descripción del video, diseña 3 conceptos visuales de miniatura altamente clicables y contrastantes entre sí.

TÍTULO DEL VIDEO:
{{TITULO}}

DESCRIPCIÓN DEL VIDEO:
{{DESCRIPCION}}

Genera 3 conceptos en las siguientes categorías:
1. CONCEPTO CURIOSIDAD (Genera una pregunta visual abierta o revela un detalle incompleto).
2. CONCEPTO IMPACTO / CONTRASTE (Enfrenta dos estados antes/después o una expresión exagerada y limpia).
3. CONCEPTO TRANSFORMACIÓN / RESULTADO (Demuestra el resultado final tangible con claridad absoluta).

Para cada concepto proporciona:
- Composición visual y plano de cámara (primer plano, plano medio, ángulo holandés).
- Elemento visual focal y contraste de color recomendado.
- Texto en la miniatura (máximo 4 palabras, fuente sin serifa gruesa, alto contraste).
- Justificación psicológica del clic.`,
    isBuiltIn: true,
    createdAt: 1730000002000,
    updatedAt: 1730000002000,
    supportedVariables: ['{{TITULO}}', '{{DESCRIPCION}}'],
  },
  {
    id: 'prompt-retention-hooks',
    title: 'Auditor de Retención y Puntos de Fuga para Edición',
    group: 'Edición',
    description:
      'Detecta caídas de energía y momentos donde el espectador podría aburrirse en el guión, recomendando patrones de interrupción, B-rolls dinámicos, efectos de sonido y zoom punches.',
    promptText: `Eres un editor de video y especialista en retención de audiencia para videos de YouTube.

Analiza el siguiente guión y duración para auditar los puntos de fuga del espectador y elevar la retención en los primeros minutos.

DURACIÓN TOTAL ESTIMADA:
{{DURACION}}

GUION / TRANSCRIPCIÓN:
{{GUION}}

TAREAS:
1. Diagnostica los 3 momentos con mayor riesgo de caída de retención (monotonía verbal o explicaciones teóricas densas).
2. Para cada momento crítico, sugiere:
   - Tipo de interrupción de patrón (Zoom punch in/out, pantalla completa con meme contextual, cambio de cámara o B-roll de soporte).
   - Efecto sonoro sugerido (Whoosh, Pop, Rise o corte repentino de música de fondo).
   - Elemento gráfico en pantalla (gráfica flotante, flecha cinética, texto tipográfico cinético).
3. Proporciona una recomendación de tempo musical para mantener la inercia hasta el final.`,
    isBuiltIn: true,
    createdAt: 1730000003000,
    updatedAt: 1730000003000,
    supportedVariables: ['{{GUION}}', '{{DURACION}}'],
  },
];

const STORAGE_KEY = 'yt_prompts_library';

/**
 * Extrae todas las variables en formato {{VARIABLE}} de un texto de prompt
 */
export function extractPromptVariables(text?: string): string[] {
  if (!text || typeof text !== 'string') return [];
  const matches = text.match(/\{\{([A-Z0-9_]+)\}\}/g);
  if (!matches) return [];
  return Array.from(new Set(matches));
}

/**
 * Obtiene la biblioteca completa de prompts desde localStorage con sincronización
 */
export function getStoredPrompts(): StoredPrompt[] {
  if (typeof window === 'undefined') {
    return INITIAL_DEFAULT_PROMPTS;
  }

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    let list: StoredPrompt[] = raw ? JSON.parse(raw) : [];

    // Si está vacío, cargar los preconfigurados
    if (!list || !Array.isArray(list) || list.length === 0) {
      list = [...INITIAL_DEFAULT_PROMPTS];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    const pauInStorage = localStorage.getItem('pau_detector_prompt');
    let needsSave = false;

    // Normalizar y reparar cualquier prompt con campos faltantes o indefinidos en localStorage
    list = list
      .filter((p): p is StoredPrompt => Boolean(p && typeof p === 'object'))
      .map((p) => {
        const defaultSeed = INITIAL_DEFAULT_PROMPTS.find((seed) => seed.id === p.id);
        let resolvedText = p.promptText;

        if (typeof resolvedText !== 'string') {
          needsSave = true;
          if (p.id === 'prompt-pau-default' && pauInStorage !== null && pauInStorage !== 'undefined') {
            resolvedText = pauInStorage;
          } else {
            resolvedText = defaultSeed?.promptText ?? '';
          }
        }

        const resolvedTitle = typeof p.title === 'string' ? p.title : defaultSeed?.title ?? 'Prompt sin título';
        const resolvedGroup = typeof p.group === 'string' && p.group.trim() ? p.group : defaultSeed?.group ?? 'Análisis PAU';
        const resolvedDescription = typeof p.description === 'string' ? p.description : defaultSeed?.description ?? '';
        const resolvedVariables = Array.isArray(p.supportedVariables)
          ? p.supportedVariables
          : extractPromptVariables(resolvedText);

        if (
          resolvedTitle !== p.title ||
          resolvedGroup !== p.group ||
          resolvedDescription !== p.description ||
          !Array.isArray(p.supportedVariables)
        ) {
          needsSave = true;
        }

        return {
          ...p,
          title: resolvedTitle,
          group: resolvedGroup,
          description: resolvedDescription,
          promptText: resolvedText,
          supportedVariables: resolvedVariables,
        };
      });

    // Sincronizar el prompt PAU si el usuario lo modificó anteriormente en ajustes
    const pauIndex = list.findIndex((p) => p.id === 'prompt-pau-default');
    if (pauInStorage && pauInStorage !== 'undefined' && pauInStorage.trim().length > 50) {
      if (pauIndex >= 0 && list[pauIndex].promptText !== pauInStorage) {
        list[pauIndex].promptText = pauInStorage;
        list[pauIndex].supportedVariables = extractPromptVariables(pauInStorage);
        list[pauIndex].updatedAt = Date.now();
        needsSave = true;
      }
    }

    if (needsSave) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    }

    return list;
  } catch (err) {
    console.warn('Error reading stored prompts:', err);
    return INITIAL_DEFAULT_PROMPTS;
  }
}

/**
 * Guarda o actualiza un prompt en la biblioteca
 */
export function saveStoredPrompt(prompt: StoredPrompt): StoredPrompt[] {
  if (typeof window === 'undefined') return [];

  const list = getStoredPrompts();
  const existingIdx = list.findIndex((p) => p.id === prompt.id);

  const updatedPrompt: StoredPrompt = {
    ...prompt,
    updatedAt: Date.now(),
    supportedVariables: extractPromptVariables(prompt.promptText),
  };

  if (existingIdx >= 0) {
    list[existingIdx] = updatedPrompt;
  } else {
    list.unshift(updatedPrompt);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

  // Si se editó el prompt PAU predeterminado, sincronizar con pau_detector_prompt
  if (prompt.id === 'prompt-pau-default') {
    localStorage.setItem('pau_detector_prompt', prompt.promptText);
  }

  return list;
}

/**
 * Elimina o vacía un prompt
 */
export function deleteStoredPrompt(id: string): StoredPrompt[] {
  if (typeof window === 'undefined') return [];

  let list = getStoredPrompts();
  const target = list.find((p) => p.id === id);

  if (!target) return list;

  if (target.isBuiltIn && id === 'prompt-pau-default') {
    // Si es el PAU incorporado, se vacía o restablece en blanco como pidió el usuario
    list = list.map((p) =>
      p.id === id
        ? {
            ...p,
            promptText: '',
            updatedAt: Date.now(),
            supportedVariables: [],
          }
        : p
    );
    localStorage.setItem('pau_detector_prompt', '');
  } else {
    list = list.filter((p) => p.id !== id);
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  return list;
}

/**
 * Restaura un prompt de fábrica a su valor original
 */
export function restorePromptToDefault(id: string): StoredPrompt[] {
  if (typeof window === 'undefined') return [];

  const defaultSeed = INITIAL_DEFAULT_PROMPTS.find((p) => p.id === id);
  if (!defaultSeed) return getStoredPrompts();

  const list = getStoredPrompts();
  const idx = list.findIndex((p) => p.id === id);

  if (idx >= 0) {
    list[idx] = {
      ...defaultSeed,
      updatedAt: Date.now(),
    };
  } else {
    list.unshift({ ...defaultSeed, updatedAt: Date.now() });
  }

  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));

  if (id === 'prompt-pau-default') {
    localStorage.setItem('pau_detector_prompt', defaultSeed.promptText);
  }

  return list;
}
