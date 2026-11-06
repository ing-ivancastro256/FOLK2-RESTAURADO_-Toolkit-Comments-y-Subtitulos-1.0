import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { RepurposedContentType } from '@/lib/types';

export async function POST(req: NextRequest) {
  try {
    const { videoTitle, transcriptText, type, tone, instructions } = await req.json();

    if (!transcriptText || transcriptText.trim().length === 0) {
      return NextResponse.json(
        { error: 'Se requiere el texto de la transcripción para generar contenido con IA.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            'La clave GEMINI_API_KEY no está configurada en las variables de entorno. Por favor, actívala en el panel de Secrets de AI Studio.',
        },
        { status: 500 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const toneDirective = tone ? `Tono deseado: ${tone}.` : 'Tono: Dinámico, profesional, persuasivo y cercano.';
    const customNotes = instructions ? `Instrucciones adicionales del creador: ${instructions}` : '';

    let promptSystem = '';
    let promptUser = '';

    switch (type as RepurposedContentType) {
      case 'shorts_script':
        promptSystem =
          'Eres un guionista senior y estratega viral de YouTube Shorts, Instagram Reels y TikTok. Tu objetivo es crear guiones de 45 a 60 segundos con retención máxima y ritmo trepidante.';
        promptUser = `
Transforma la siguiente transcripción del video "${videoTitle}" en un guion estructurado para YouTube Short / Reel.
${toneDirective}
${customNotes}

Estructura obligatoria:
1. **[0-3s] GANCHO VISUAL Y VERBAL**: Frase impactante inicial que rompe el scroll + indicación de cámara/texto en pantalla.
2. **[3-15s] EL PROBLEMA O CURIOSIDAD**: Planteamiento de la tensión o la premisa intrigante.
3. **[15-45s] LOS 3 PUNTOS CLAVE**: Ideas centrales explicadas con claridad y ritmo rápido, incluyendo [Cortes visuales] y [B-roll / Gráficos sugeridos].
4. **[45-60s] REMATE Y LLAMADA A LA ACCIÓN (CTA)**: Cierre contundente y pregunta para generar comentarios o suscripciones.

Transcripción original:
"""
${transcriptText.slice(0, 15000)}
"""
`;
        break;

      case 'twitter_thread':
        promptSystem =
          'Eres un creador de contenido influyente en X (Twitter) especializado en hilos virales de alto valor educacional y de negocio.';
        promptUser = `
Convierte la esencia y las ideas clave del video "${videoTitle}" en un hilo de X (Twitter) de 5 a 7 publicaciones optimizadas.
${toneDirective}
${customNotes}

Estructura obligatoria:
- **Tweet 1 (Gancho)**: Promesa de valor que invite a abrir el hilo, sin rodeos, con gancho irresistible.
- **Tweets 2 a 5**: Puntos clave, lecciones prácticas, citas o datos concretos del video, cada uno con una idea clara y legible en menos de 280 caracteres.
- **Tweet final**: Conclusión memorable, llamada a guardar/retuitear y pregunta abierta para la comunidad.
- Formatea separando cada tweet claramente con un divisor: "--- [Tweet N] ---".

Transcripción original:
"""
${transcriptText.slice(0, 15000)}
"""
`;
        break;

      case 'linkedin_post':
        promptSystem =
          'Eres un redactor experto de LinkedIn (Top Voice) que crea publicaciones con alta tasa de lectura, formato de párrafos de 1-2 líneas y reflexión empresarial o profesional.';
        promptUser = `
Escribe una publicación completa para LinkedIn basada en las lecciones y aprendizajes del video "${videoTitle}".
${toneDirective}
${customNotes}

Estructura obligatoria:
- **Línea 1**: Titular intrigante (antes del "Ver más" de LinkedIn).
- **Cuerpo narrativo**: Espaciado generoso (párrafos de 1 o máximo 2 líneas). Plantea la situación o el error común.
- **Lecciones clave**: 3 a 4 aprendizajes o consejos accionables en viñetas limpias.
- **Conclusión**: Una reflexión profunda sobre el futuro o la mentalidad profesional.
- **Pregunta final**: Una pregunta abierta para abrir debate en los comentarios.

Transcripción original:
"""
${transcriptText.slice(0, 15000)}
"""
`;
        break;

      case 'newsletter_summary':
      default:
        promptSystem =
          'Eres un editor de una prestigiosa newsletter de contenido digital, tecnología y estrategias de crecimiento.';
        promptUser = `
Elabora una edición completa de boletín / newsletter basada en el video "${videoTitle}".
${toneDirective}
${customNotes}

Estructura obligatoria:
- **Título del Boletín y Asunto sugerido** (con alta tasa de apertura).
- **Resumen Ejecutivo (TL;DR)**: En 2 o 3 oraciones contundentes.
- **Análisis a Fondo y Puntos Clave**: Desglose editorial con subtítulos y viñetas explicativas.
- **Cita Destacada**: La frase o idea más poderosa del contenido.
- **Acción Inmediata para el Lector**: Qué puede aplicar hoy mismo quien lea este boletín.

Transcripción original:
"""
${transcriptText.slice(0, 15000)}
"""
`;
        break;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: promptUser,
      config: {
        systemInstruction: promptSystem,
      },
    });

    const generatedText = response.text || '';

    return NextResponse.json({
      content: generatedText,
      modelUsed: 'gemini-3.8-flash',
      type,
      videoTitle,
      createdAt: Date.now(),
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: `Error generando contenido con Gemini: ${error.message || 'Desconocido'}` },
      { status: 500 }
    );
  }
}
