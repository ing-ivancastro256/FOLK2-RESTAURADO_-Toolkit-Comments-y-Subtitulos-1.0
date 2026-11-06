import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  const quality = searchParams.get('quality') || 'maxres';

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json({ error: 'ID de video inválido' }, { status: 400 });
  }

  const qualityFilenameMap: Record<string, string> = {
    maxres: 'maxresdefault.jpg',
    sd: 'sddefault.jpg',
    hq: 'hqdefault.jpg',
    mq: 'mqdefault.jpg',
    default: 'default.jpg',
  };

  const filename = qualityFilenameMap[quality] || 'maxresdefault.jpg';
  const targetUrl = `https://img.youtube.com/vi/${videoId}/${filename}`;

  try {
    const imgRes = await fetch(targetUrl, { cache: 'no-store' });

    if (!imgRes.ok) {
      // Fallback a hqdefault
      const fallbackRes = await fetch(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      if (!fallbackRes.ok) {
        return NextResponse.json({ error: 'Miniatura no disponible' }, { status: 404 });
      }
      const buffer = await fallbackRes.arrayBuffer();
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'image/jpeg',
          'Content-Disposition': `attachment; filename="miniatura-${videoId}-hq.jpg"`,
          'Cache-Control': 'public, max-age=86400',
        },
      });
    }

    const buffer = await imgRes.arrayBuffer();

    // Detección de placeholder de YouTube cuando maxresdefault no existe (suele tener < 1500 bytes)
    if (quality === 'maxres' && buffer.byteLength < 1800) {
      const fallbackRes = await fetch(`https://img.youtube.com/vi/${videoId}/hqdefault.jpg`);
      if (fallbackRes.ok) {
        const fallbackBuffer = await fallbackRes.arrayBuffer();
        return new NextResponse(fallbackBuffer, {
          headers: {
            'Content-Type': 'image/jpeg',
            'Content-Disposition': `attachment; filename="miniatura-${videoId}-hq.jpg"`,
            'Cache-Control': 'public, max-age=86400',
          },
        });
      }
    }

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="miniatura-${videoId}-${quality}.jpg"`,
        'Cache-Control': 'public, max-age=86400',
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
