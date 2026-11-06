import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';
import { DEFAULT_PAU_DETECTOR_PROMPT } from '@/lib/pau-prompt';
import { PauAnalysisResult } from '@/lib/types';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

const ALLOWED_PRICES = [5, 9, 17, 27, 47];

function snapToAllowedPrice(price: number): number {
  if (ALLOWED_PRICES.includes(price)) return price;
  return ALLOWED_PRICES.reduce((prev, curr) =>
    Math.abs(curr - price) < Math.abs(prev - price) ? curr : prev
  );
}

const CANDIDATE_MODELS = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-3.1-flash-lite'];

async function generateWithFallbackAndRetry(prompt: string, preferredModel?: string) {
  let lastError: any = null;

  // Si el usuario especificó un modelo en el desplegable, colocarlo como primera opción
  const modelsToTry = preferredModel && CANDIDATE_MODELS.includes(preferredModel)
    ? [preferredModel, ...CANDIDATE_MODELS.filter((m) => m !== preferredModel)]
    : CANDIDATE_MODELS;

  for (const model of modelsToTry) {
    // Hasta 2 intentos por modelo en caso de saturación temporal (503 / 429)
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        if (attempt > 0) {
          await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
        }
        const response = await ai.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            ...(model !== 'gemini-3.8-flash' ? { temperature: 0.4 } : {}),
          },
        });

        if (response.text && response.text.trim().length > 0) {
          return { text: response.text, modelUsed: model };
        }
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        const isTransient =
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE') ||
          msg.includes('429') ||
          msg.includes('RESOURCE_EXHAUSTED') ||
          msg.includes('overloaded');

        if (!isTransient) {
          // Si no es sobrecarga temporal, probar siguiente modelo
          break;
        }
      }
    }
  }

  throw lastError || new Error('Los servidores de Gemini están experimentando alta demanda. Por favor reintenta en unos instantes.');
}

// Regex para detectar enlaces y URLs comunes
const LINK_REGEX = /(?:https?:\/\/|www\.|\.com|\.io|\.org|\.net|\.me\/|t\.me\/|bit\.ly\/)/i;

interface CommentInput {
  id?: string;
  text: string;
  authorName?: string;
  likeCount?: number;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      comments,
      customPrompt,
      limit = 'all',
      videoTitle = '',
      videoId = '',
      selectedModel,
    } = body as {
      comments: CommentInput[];
      customPrompt?: string;
      limit?: number | 'all';
      videoTitle?: string;
      videoId?: string;
      selectedModel?: string;
    };

    if (!Array.isArray(comments) || comments.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se recibieron comentarios para analizar.' },
        { status: 400 }
      );
    }

    const comentarios_recibidos = comments.length;

    // 1. Limpieza y preprocesamiento de comentarios
    const seenTexts = new Set<string>();
    const cleanComments: Array<{ text: string; likeCount: number }> = [];

    for (const c of comments) {
      const rawText = (c.text || '').trim();
      const normalizedKey = rawText.toLowerCase().replace(/\s+/g, ' ');

      // Filtro de duplicados
      if (seenTexts.has(normalizedKey)) continue;

      // Filtro de enlaces y promociones evidentes
      if (LINK_REGEX.test(rawText)) continue;

      // Filtro de longitud mínima (menos de 25 caracteres)
      if (rawText.length < 25) continue;

      seenTexts.add(normalizedKey);
      // Evitar que comentarios monstruosos desborden el contexto
      const safeText = rawText.length > 600 ? rawText.slice(0, 600) + '...' : rawText;
      cleanComments.push({
        text: safeText,
        likeCount: typeof c.likeCount === 'number' ? c.likeCount : 0,
      });
    }

    // 2. Ordenar por likes de forma descendente
    cleanComments.sort((a, b) => b.likeCount - a.likeCount);

    // 3. Aplicar límite seleccionado (100, 500 o todos)
    let selectedComments = cleanComments;
    if (typeof limit === 'number' && limit > 0) {
      selectedComments = cleanComments.slice(0, limit);
    }

    if (selectedComments.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Todos los comentarios recibidos fueron filtrados por contener enlaces, ser duplicados o tener menos de 25 caracteres.',
        },
        { status: 400 }
      );
    }

    const comentarios_analizados = selectedComments.length;
    const comentarios_descartados = Math.max(0, comentarios_recibidos - comentarios_analizados);

    // 4. Formatear cada comentario como: [Likes: n] texto del comentario
    const formattedCommentsBlock = selectedComments
      .map((c) => `[Likes: ${c.likeCount}] ${c.text}`)
      .join('\n');

    // 5. Preparar prompt reemplazando {{COMENTARIOS}} o anexando al final
    const basePrompt = (customPrompt && customPrompt.trim().length > 50)
      ? customPrompt
      : DEFAULT_PAU_DETECTOR_PROMPT;

    let finalPrompt: string;
    if (basePrompt.includes('{{COMENTARIOS}}')) {
      finalPrompt = basePrompt.replace('{{COMENTARIOS}}', formattedCommentsBlock);
    } else {
      finalPrompt = `${basePrompt}\n\nCOMENTARIOS:\n\n${formattedCommentsBlock}`;
    }

    // Si se tiene el título del video, añadir contexto sutil en la cabecera
    if (videoTitle) {
      finalPrompt = `[Contexto del Video de YouTube: "${videoTitle}"]\n\n${finalPrompt}`;
    }

    // 6. Llamada a Gemini con cascada de modelos y reintentos automáticos
    const { text: rawGeneratedText } = await generateWithFallbackAndRetry(finalPrompt, selectedModel);

    let rawResponseText = rawGeneratedText || '';
    if (!rawResponseText) {
      throw new Error('Gemini devolvió una respuesta vacía.');
    }

    // Limpieza de bloques markdown en caso de que vengan delimitados
    rawResponseText = rawResponseText.trim();
    if (rawResponseText.startsWith('```json')) {
      rawResponseText = rawResponseText.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
    } else if (rawResponseText.startsWith('```')) {
      rawResponseText = rawResponseText.replace(/^```\s*/, '').replace(/\s*```$/, '');
    }

    let parsedResult: PauAnalysisResult;
    try {
      parsedResult = JSON.parse(rawResponseText);
    } catch {
      throw new Error('El modelo generó un formato JSON inválido. Intenta ejecutar el análisis nuevamente.');
    }

    // 7. Sobrescribir campos meta con los conteos reales del preprocesamiento
    if (!parsedResult.meta) {
      parsedResult.meta = {
        comentarios_recibidos,
        comentarios_analizados,
        comentarios_descartados,
        idioma: 'Español',
        confianza: 'media',
        notas: null,
      };
    } else {
      parsedResult.meta.comentarios_recibidos = comentarios_recibidos;
      parsedResult.meta.comentarios_analizados = comentarios_analizados;
      parsedResult.meta.comentarios_descartados = comentarios_descartados;
    }

    // 8. Verificación de citas literales en los comentarios enviados
    // Creamos un corpus de texto unificado en minúsculas para cotejo exacto/subcadena
    const commentsCorpus = selectedComments
      .map((c) => c.text.toLowerCase().replace(/\s+/g, ' '))
      .join(' \n ');

    const verifyQuote = (quote: string | null | undefined): boolean => {
      if (!quote || typeof quote !== 'string' || quote.trim().length === 0) return false;
      const originalPart = quote.split(/\[(?:traducci[oó]n|trad):/i)[0].trim().replace(/^["']|["']$/g, '');
      const cleanQuote = (originalPart || quote).toLowerCase().trim().replace(/\s+/g, ' ');
      // Subcadena o coincidencia de al menos un fragmento significativo (>15 chars)
      if (commentsCorpus.includes(cleanQuote)) return true;
      if (cleanQuote.length > 20) {
        const sub = cleanQuote.substring(0, Math.min(35, cleanQuote.length));
        if (commentsCorpus.includes(sub)) return true;
      }
      return false;
    };

    // Verificar citas en voz_del_cliente y extraer traduccion_espanol si viene incrustada
    if (Array.isArray(parsedResult.voz_del_cliente)) {
      parsedResult.voz_del_cliente = parsedResult.voz_del_cliente.map((item) => {
        let frase = (item.frase || '').trim();
        let traduccion = item.traduccion_espanol || null;

        const match = frase.match(/^(.*?)(?:\[(?:traducci[oó]n|trad):\s*["']?([^"'\]]+)["']?\])/i);
        if (match) {
          frase = match[1].trim();
          if (!traduccion) {
            traduccion = match[2].trim();
          }
        }

        return {
          ...item,
          frase,
          traduccion_espanol: traduccion,
          verificada: verifyQuote(frase),
        };
      });
    }

    // 9. Verificar y ajustar precios en ideas_pau exclusivamente a 5, 9, 17, 27, 47
    if (Array.isArray(parsedResult.ideas_pau)) {
      parsedResult.ideas_pau = parsedResult.ideas_pau.map((idea) => {
        const currentPrice = Number(idea.precio_sugerido_usd) || 17;
        return {
          ...idea,
          precio_sugerido_usd: snapToAllowedPrice(currentPrice),
        };
      });
    }

    // 10. Añadir metadatos complementarios
    parsedResult.videoId = videoId;
    parsedResult.videoTitle = videoTitle;
    parsedResult.analyzedAt = Date.now();

    return NextResponse.json({
      success: true,
      data: parsedResult,
    });
  } catch (error: any) {
    console.error('Error en /api/gemini/analyze-comments:', error);
    let errorMessage = error?.message || 'Error al procesar el análisis con Gemini.';
    if (
      errorMessage.includes('503') ||
      errorMessage.includes('high demand') ||
      errorMessage.includes('UNAVAILABLE') ||
      errorMessage.includes('overloaded')
    ) {
      errorMessage =
        'Los servidores de Gemini están experimentando alta demanda momentánea (error 503). Por favor espera unos segundos y pulsa "Reintentar", o prueba seleccionando "100" comentarios para una respuesta más rápida.';
    } else if (
      errorMessage.includes('429') ||
      errorMessage.includes('quota') ||
      errorMessage.includes('RESOURCE_EXHAUSTED')
    ) {
      errorMessage =
        'Límite de solicitudes alcanzado momentáneamente. Por favor espera unos segundos antes de reintentar.';
    }
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
      },
      { status: 500 }
    );
  }
}
