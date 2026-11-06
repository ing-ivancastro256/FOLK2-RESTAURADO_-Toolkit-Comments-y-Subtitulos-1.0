import { GoogleGenAI } from '@google/genai';
import { NextRequest, NextResponse } from 'next/server';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, phrases } = body as { text?: string; phrases?: string[] };

    if (!text && (!phrases || phrases.length === 0)) {
      return NextResponse.json(
        { success: false, error: 'Se requiere texto o lista de frases para traducir.' },
        { status: 400 }
      );
    }

    if (text) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Eres un traductor profesional de inglés a español latino natural, empático y fluido.
Traduce la siguiente cita o testimonio al español latino conversacional.
Devuelve ÚNICAMENTE la traducción directa, sin comillas adicionales, sin explicaciones ni notas.

Texto original:
"${text}"`,
        config: {
          temperature: 0.2,
        },
      });

      const translated = (response.text || '').trim().replace(/^["']|["']$/g, '');
      return NextResponse.json({ success: true, translation: translated });
    }

    // Traducción de múltiples frases por lotes
    if (phrases && phrases.length > 0) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-lite',
        contents: `Eres un traductor experto de inglés a español latino natural y coloquial.
Traduce cada una de las siguientes frases al español latino.
Devuelve exclusivamente un arreglo JSON con las traducciones en el mismo orden:
["traducción 1", "traducción 2", ...]

Frases:
${JSON.stringify(phrases, null, 2)}`,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
        },
      });

      let clean = (response.text || '').trim();
      if (clean.startsWith('```json')) {
        clean = clean.replace(/^```json\s*/i, '').replace(/\s*```$/, '');
      } else if (clean.startsWith('```')) {
        clean = clean.replace(/^```\s*/, '').replace(/\s*```$/, '');
      }

      const list = JSON.parse(clean);
      return NextResponse.json({ success: true, translations: list });
    }

    return NextResponse.json({ success: false, error: 'Parámetros inválidos' }, { status: 400 });
  } catch (error: any) {
    console.error('Error en /api/gemini/translate:', error);
    return NextResponse.json(
      { success: false, error: error?.message || 'Error al traducir con Gemini.' },
      { status: 500 }
    );
  }
}
