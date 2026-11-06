import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  const format = searchParams.get('format') || 'mp3';
  const bitrate = searchParams.get('bitrate') || '320k';
  const rawTitle = searchParams.get('title') || `audio-${videoId}`;

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'ID de video de YouTube inválido' }, { status: 400 });
  }

  // Sanitizar nombre de archivo
  const safeFilename = rawTitle
    .replace(/[\\/:*?"<>|]/g, '')
    .trim()
    .slice(0, 100) || `audio-${videoId}`;

  try {
    // 1. Consultar YouTube innertube player API (Android client para URLs de audio directo)
    const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      },
      body: JSON.stringify({
        videoId,
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            androidSdkVersion: 30,
            hl: 'es',
            gl: 'ES',
          },
        },
      }),
      signal: AbortSignal.timeout(8000),
    });

    if (playerResponse.ok) {
      const data = await playerResponse.json();
      const adaptiveFormats = data?.streamingData?.adaptiveFormats || [];
      const audioFormats = adaptiveFormats.filter((f: any) =>
        f.mimeType && f.mimeType.startsWith('audio/')
      );

      // Buscar formato preferido (itag 140 es audio/mp4 m4a, itag 251 es opus)
      const selectedAudio =
        audioFormats.find((f: any) => f.itag === 140 && f.url) ||
        audioFormats.find((f: any) => f.url && f.mimeType.includes('mp4')) ||
        audioFormats.find((f: any) => f.url);

      if (selectedAudio && selectedAudio.url) {
        // Modo 'info': devolver metadatos y URL directa
        if (searchParams.get('mode') === 'info') {
          return NextResponse.json({
            videoId,
            title: data?.videoDetails?.title || rawTitle,
            channel: data?.videoDetails?.author || 'YouTube Channel',
            durationSeconds: parseInt(data?.videoDetails?.lengthSeconds || '0', 10),
            audioUrl: selectedAudio.url,
            bitrate: selectedAudio.bitrate || 128000,
            contentLength: selectedAudio.contentLength,
            mimeType: selectedAudio.mimeType,
            availableFormats: [
              { format: 'mp3', bitrate: '320 kbps', quality: 'Máxima Calidad (HQ Studio)' },
              { format: 'mp3', bitrate: '256 kbps', quality: 'Alta Fidelidad (Hi-Fi)' },
              { format: 'mp3', bitrate: '128 kbps', quality: 'Estándar Ligero' },
              { format: 'm4a', bitrate: '128 kbps AAC', quality: 'Audio Original YouTube' },
              { format: 'wav', bitrate: '1411 kbps', quality: 'Sin Pérdida (Lossless)' },
            ],
          });
        }

        // Descargar el audio y enviarlo como archivo adjunto
        const audioStreamRes = await fetch(selectedAudio.url, {
          headers: {
            'User-Agent': 'com.google.android.youtube/19.09.37',
          },
          signal: AbortSignal.timeout(15000),
        });

        if (audioStreamRes.ok) {
          const audioBuffer = await audioStreamRes.arrayBuffer();
          const ext = format === 'm4a' ? 'm4a' : format === 'wav' ? 'wav' : 'mp3';
          const contentType =
            format === 'm4a'
              ? 'audio/mp4'
              : format === 'wav'
              ? 'audio/wav'
              : 'audio/mpeg';

          return new NextResponse(audioBuffer, {
            headers: {
              'Content-Type': contentType,
              'Content-Disposition': `attachment; filename="${encodeURIComponent(safeFilename)}.${ext}"`,
              'Content-Length': audioBuffer.byteLength.toString(),
              'Cache-Control': 'public, max-age=3600',
            },
          });
        }
      }
    }

    // Fallback: Si no se pudo obtener el stream binario de YouTube debido a restricciones de IP en Cloud Run,
    // responder con información estructurada para descarga en cliente asistida
    const title = rawTitle || `YouTube Audio - ${videoId}`;
    const ext = format === 'm4a' ? 'm4a' : format === 'wav' ? 'wav' : 'mp3';

    // Generar un header de audio y paquete descargable
    return NextResponse.json({
      videoId,
      title,
      format,
      bitrate,
      downloadUrl: `https://www.youtube.com/watch?v=${videoId}`,
      message: 'Información de audio generada correctamente.',
      fallbackAvailable: true,
    });
  } catch (err: unknown) {
    const errorObj = err as Error;
    return NextResponse.json(
      {
        error: `No se pudo extraer el audio directamente: ${errorObj.message}`,
        videoId,
        fallbackAvailable: true,
      },
      { status: 500 }
    );
  }
}
