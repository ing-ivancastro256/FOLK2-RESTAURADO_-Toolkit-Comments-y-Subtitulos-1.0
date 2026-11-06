import { NextRequest, NextResponse } from 'next/server';
import { generateThumbnailItems } from '@/lib/youtube';
import { YouTubeVideoMetadata } from '@/lib/types';

function parseDurationISO(durationStr: string): number {
  const match = durationStr.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return 0;
  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);
  return hours * 3600 + minutes * 60 + seconds;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  const customApiKey = searchParams.get('apiKey') || req.headers.get('x-youtube-api-key');

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: 'ID de video de YouTube inválido o no proporcionado.' },
      { status: 400 }
    );
  }

  try {
    let title = '';
    let authorName = '';
    let authorUrl = '';
    let description = '';
    let durationSeconds = 0;
    let viewCount = '0';
    let likeCount = '0';
    let commentCount = '0';
    let publishedAt = '';
    let tags: string[] = [];
    let isLive = false;

    // 1. Si el usuario proporcionó una clave de YouTube Data API v3, consultamos la API oficial
    if (customApiKey) {
      try {
        const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,contentDetails,statistics&id=${videoId}&key=${encodeURIComponent(
          customApiKey
        )}`;
        const apiRes = await fetch(apiUrl, { cache: 'no-store' });
        if (apiRes.ok) {
          const apiData = await apiRes.json();
          if (apiData.items && apiData.items.length > 0) {
            const item = apiData.items[0];
            const snippet = item.snippet || {};
            const stats = item.statistics || {};
            const contentDetails = item.contentDetails || {};

            title = snippet.title || '';
            authorName = snippet.channelTitle || '';
            authorUrl = snippet.channelId ? `https://www.youtube.com/channel/${snippet.channelId}` : '';
            description = snippet.description || '';
            publishedAt = snippet.publishedAt || '';
            tags = snippet.tags || [];
            viewCount = stats.viewCount || '0';
            likeCount = stats.likeCount || '0';
            commentCount = stats.commentCount || '0';
            durationSeconds = parseDurationISO(contentDetails.duration || '');
            isLive = snippet.liveBroadcastContent === 'live';
          }
        }
      } catch {
        // Fallback a endpoints públicos
      }
    }

    // 2. Si no tenemos título aún o no hay API key, usamos oEmbed oficial público
    if (!title) {
      try {
        const oEmbedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        const oEmbedRes = await fetch(oEmbedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; YouTubeToolkit/1.0)',
          },
          next: { revalidate: 3600 },
        });

        if (oEmbedRes.ok) {
          const oEmbedData = await oEmbedRes.json();
          title = oEmbedData.title || '';
          authorName = oEmbedData.author_name || '';
          authorUrl = oEmbedData.author_url || '';
        }
      } catch {
        // Fallback
      }
    }

    // 3. Extracción de metadatos profundos (descripción, keywords, duración) scrapeando la cabecera del video
    try {
      const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
        cache: 'no-store',
      });

      if (pageRes.ok) {
        const html = await pageRes.text();

        // Buscar objeto ytInitialPlayerResponse
        const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({[\s\S]+?});(?:var|\s*<\/script>)/);
        if (playerResponseMatch && playerResponseMatch[1]) {
          try {
            const playerResponse = JSON.parse(playerResponseMatch[1]);
            const details = playerResponse.videoDetails || {};

            if (!title && details.title) title = details.title;
            if (!authorName && details.author) authorName = details.author;
            if (!description && details.shortDescription) description = details.shortDescription;
            if (!durationSeconds && details.lengthSeconds) durationSeconds = parseInt(details.lengthSeconds, 10);
            if (viewCount === '0' && details.viewCount) viewCount = details.viewCount;
            if (tags.length === 0 && Array.isArray(details.keywords)) tags = details.keywords;
            isLive = Boolean(details.isLiveContent);
          } catch {
            // Error al parsear JSON
          }
        }

        // Fallbacks con meta tags si falta información
        if (!title) {
          const titleMatch = html.match(/<meta\s+name="title"\s+content="([^"]+)"/i) || html.match(/<title>([^<]+)<\/title>/i);
          if (titleMatch) title = titleMatch[1].replace(' - YouTube', '').trim();
        }
        if (!description) {
          const descMatch = html.match(/<meta\s+name="description"\s+content="([^"]*)"/i);
          if (descMatch) description = descMatch[1].trim();
        }
        if (tags.length === 0) {
          const keywordsMatch = html.match(/<meta\s+name="keywords"\s+content="([^"]*)"/i);
          if (keywordsMatch && keywordsMatch[1]) {
            tags = keywordsMatch[1].split(',').map((t) => t.trim()).filter(Boolean);
          }
        }
        if (!publishedAt) {
          const dateMatch = html.match(/<meta\s+itemprop="uploadDate"\s+content="([^"]+)"/i);
          if (dateMatch) publishedAt = dateMatch[1];
        }
      }
    } catch {
      // Fallback a los datos ya recopilados
    }

    // Si aún no tenemos título, el video puede ser privado o no existir
    if (!title) {
      title = `Video de YouTube (${videoId})`;
    }

    const thumbnails = generateThumbnailItems(videoId);

    const metadata: YouTubeVideoMetadata = {
      videoId,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      title,
      description,
      channelTitle: authorName || 'Canal de YouTube',
      channelUrl: authorUrl,
      publishedAt,
      durationSeconds,
      duration: durationSeconds > 0 ? `${Math.floor(durationSeconds / 60)} min` : undefined,
      viewCount,
      likeCount,
      commentCount,
      tags: tags.slice(0, 30), // Máximo 30 etiquetas
      thumbnails,
      isLive,
      isShort: durationSeconds > 0 && durationSeconds <= 60,
      createdAt: Date.now(),
    };

    return NextResponse.json(metadata);
  } catch (err: unknown) {
    const error = err as Error;
    return NextResponse.json(
      { error: `Error extrayendo metadatos: ${error.message || 'Desconocido'}` },
      { status: 500 }
    );
  }
}
