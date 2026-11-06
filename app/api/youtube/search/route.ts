import { NextRequest, NextResponse } from 'next/server';
import { YouTubeSearchResultItem } from '@/lib/types';

// Convierte duración ISO 8601 de YouTube (PT1H2M10S, PT14M20S, PT45S) a segundos y texto
function parseIsoDuration(isoDuration?: string): { seconds: number; text: string } {
  if (!isoDuration) return { seconds: 180, text: '3:00' };
  const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
  if (!match) return { seconds: 180, text: '3:00' };

  const hours = parseInt(match[1] || '0', 10);
  const minutes = parseInt(match[2] || '0', 10);
  const seconds = parseInt(match[3] || '0', 10);

  const totalSeconds = hours * 3600 + minutes * 60 + seconds;
  let text = '';
  if (hours > 0) {
    text = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  } else {
    text = `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }
  return { seconds: totalSeconds, text };
}

// Formatea número de vistas a texto compacto ("1.4 M de vistas", "45 K vistas")
function formatViewsCompact(viewsCount?: string | number): string {
  if (!viewsCount) return 'Vistas no disponibles';
  const n = typeof viewsCount === 'string' ? parseInt(viewsCount.replace(/[^0-9]/g, ''), 10) : viewsCount;
  if (isNaN(n) || n === 0) return 'Reciente';

  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1).replace('.0', '')} M de vistas`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace('.0', '')} K vistas`;
  }
  return `${n} vistas`;
}

// Formatea número de comentarios a texto compacto ("1,4 K", "245", "0")
function formatCommentsCompact(commentCount?: string | number): string {
  if (commentCount === undefined || commentCount === null) return '0';
  const n = typeof commentCount === 'string' ? parseInt(commentCount.replace(/[^0-9]/g, ''), 10) : commentCount;
  if (isNaN(n) || n <= 0) return '0';

  if (n >= 1000000) {
    return `${(n / 1000000).toFixed(1).replace('.0', '').replace('.', ',')} M`;
  }
  if (n >= 1000) {
    return `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')} K`;
  }
  return n.toLocaleString('es-ES');
}

function parseCompactMetricToNumber(metricStr?: string | null): number {
  if (!metricStr || metricStr === 'Desactivados') return 0;
  const lower = metricStr.toLowerCase().replace(/\u00a0/g, ' ').trim();
  const isMillions = /(?:^|[\d\s.,])(m|mill|millón|millones)(?:\b|\s|$)/i.test(lower);
  const isThousands = !isMillions && /(?:^|[\d\s.,])(k|mil)(?:\b|\s|$)/i.test(lower);

  const numMatch = lower.match(/([0-9]+(?:[.,][0-9]+)*)/);
  if (!numMatch) return 0;
  const rawNum = numMatch[1];

  if (isMillions || isThousands) {
    const normalized = rawNum.replace(',', '.');
    const val = parseFloat(normalized);
    if (isNaN(val)) return 0;
    return Math.round(val * (isMillions ? 1000000 : 1000));
  }

  const digitsOnly = rawNum.replace(/[^0-9]/g, '');
  const exact = parseInt(digitsOnly, 10);
  return isNaN(exact) ? 0 : exact;
}

function parseCommentTextToNumber(commentStr?: string | null): number {
  return parseCompactMetricToNumber(commentStr);
}

// Consulta pública ultrarrápida a YouTube Innertube /next para extraer el conteo real de comentarios de un video
async function fetchPublicCommentCount(videoId: string): Promise<{
  commentCountText: string;
  commentCountNumber: number;
  commentsDisabled: boolean;
} | null> {
  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240726.00.00',
            hl: 'es',
            gl: 'ES',
          },
        },
        videoId,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(3500),
    });

    if (!res.ok) return null;
    const data = await res.json();
    const panels = data?.engagementPanels || [];

    for (const panel of panels) {
      const ps = panel?.engagementPanelSectionListRenderer;
      if (ps?.panelIdentifier === 'engagement-panel-comments-section') {
        const hdr = ps?.header?.engagementPanelTitleHeaderRenderer;
        const rawText: string | undefined =
          hdr?.contextualInfo?.runs?.map((r: any) => r.text).join('') ||
          hdr?.contextualInfo?.simpleText;

        if (rawText && rawText.trim().length > 0) {
          const cleanText = rawText.replace(/\u00a0/g, ' ').trim();
          return {
            commentCountText: cleanText,
            commentCountNumber: parseCommentTextToNumber(cleanText),
            commentsDisabled: false,
          };
        }

        // El panel de comentarios existe pero no tiene contextualInfo => 0 comentarios
        return {
          commentCountText: '0',
          commentCountNumber: 0,
          commentsDisabled: false,
        };
      }
    }

    // No existe el panel de comentarios => desactivados por el creador
    return {
      commentCountText: 'Desactivados',
      commentCountNumber: 0,
      commentsDisabled: true,
    };
  } catch {
    return null;
  }
}

// Enriquece una lista de videos con su conteo real de comentarios en lotes paralelos controlados
async function enrichResultsWithCommentCounts<T extends YouTubeSearchResultItem>(items: T[]): Promise<T[]> {
  const CONCURRENCY = 24;
  const enriched = [...items];

  for (let i = 0; i < enriched.length; i += CONCURRENCY) {
    const slice = enriched.slice(i, i + CONCURRENCY);
    const counts = await Promise.all(
      slice.map((item) =>
        item.itemType === 'channel' || item.itemType === 'playlist'
          ? Promise.resolve(null)
          : fetchPublicCommentCount(item.id)
      )
    );
    counts.forEach((info, idx) => {
      if (info) {
        enriched[i + idx] = {
          ...enriched[i + idx],
          commentCountText: info.commentCountText,
          commentCountNumber: info.commentCountNumber,
          commentsDisabled: info.commentsDisabled,
        };
      }
    });
  }

  return enriched;
}

// Mapeo de tokens 'sp' nativos de YouTube para filtros directos
function getYouTubeSpToken(
  uploadDate: string,
  duration: string,
  features: string[],
  sortBy: string,
  type: string
): string | null {
  if (type === 'live' || features.includes('live')) {
    return 'EgJAAQ%3D%3D';
  }

  if (sortBy === 'viewCount') {
    if (uploadDate === 'today') return 'CAESBBABGAE%3D';
    if (uploadDate === 'week') return 'CAESBBABGAI%3D';
    if (uploadDate === 'month') return 'CAESBBABGAM%3D';
    if (uploadDate === 'year') return 'CAESBBABGAQ%3D';
    return 'CAMSAhAB';
  }

  if (sortBy === 'date') return 'CAI%3D';

  if (uploadDate === 'today') return 'EgIIAg%3D%3D';
  if (uploadDate === 'week') return 'EgIIAw%3D%3D';
  if (uploadDate === 'month') return 'EgIIBA%3D%3D';
  if (uploadDate === 'year') return 'EgIIBQ%3D%3D';

  if (duration === 'short') return 'EgIYAQ%3D%3D';
  if (duration === 'long') return 'EgIYAg%3D%3D';

  if (features.includes('4k')) return 'EgJwAQ%3D%3D';
  if (features.includes('subtitles')) return 'EgIoAQ%3D%3D';
  if (features.includes('cc')) return 'EgIwAQ%3D%3D';

  if (type === 'channel') return 'EgIQAg%3D%3D';
  if (type === 'playlist') return 'EgIQAw%3D%3D';

  return null;
}

interface ExtendedSearchResult extends YouTubeSearchResultItem {
  durationSeconds: number;
  viewsNumber: number;
  publishedAgeHours: number;
}

// Extrae videos, Shorts y el token de continuación de las secciones devueltas por YouTube (HTML inicial o continuación Innertube)
function extractItemsAndTokenFromSections(
  sections: any[],
  filterType: string,
  seenIds: Set<string>
): { items: ExtendedSearchResult[]; continuationToken: string | null } {
  const extracted: ExtendedSearchResult[] = [];
  let continuationToken: string | null = null;

  const pushShortFromLockup = (lockup: any) => {
    const rawEntityId: string = lockup?.entityId || '';
    const shortId = rawEntityId
      .replace(/^shorts-shelf-item-/, '')
      .replace(/^reel-/, '')
      .trim();

    if (!shortId || seenIds.has(shortId)) return;

    const title =
      lockup?.overlayMetadata?.primaryText?.content ||
      lockup?.accessibilityText?.split(',')[0] ||
      'YouTube Short';
    const views =
      lockup?.overlayMetadata?.secondaryText?.content || '15 K vistas';
    const sources =
      lockup?.thumbnailViewModel?.thumbnailViewModel?.image?.sources || [];
    const thumbUrl =
      sources[sources.length - 1]?.url ||
      `https://i.ytimg.com/vi/${shortId}/hqdefault.jpg`;

    seenIds.add(shortId);
    extracted.push({
      id: shortId,
      title,
      description: 'Short vertical de YouTube',
      channelTitle: 'YouTube Shorts',
      channelId: '',
      publishedAt: 'Reciente',
      thumbnailUrl: thumbUrl.startsWith('//') ? `https:${thumbUrl}` : thumbUrl,
      itemType: 'video',
      durationText: '0:50',
      viewCountText: views,
      badges: ['Shorts'],
      durationSeconds: 50,
      viewsNumber: parseViewsToNumber(views) || 15000,
      publishedAgeHours: 48,
    });
  };

  for (const section of sections) {
    if (section?.continuationItemRenderer) {
      const tok =
        section.continuationItemRenderer?.continuationEndpoint
          ?.continuationCommand?.token;
      if (tok) continuationToken = tok;
    }

    const itemSection = section?.itemSectionRenderer?.contents || [];
    for (const item of itemSection) {
      if (item?.continuationItemRenderer) {
        const tok =
          item.continuationItemRenderer?.continuationEndpoint
            ?.continuationCommand?.token;
        if (tok) continuationToken = tok;
      }

      // A) VideoRenderer estándar
      const v = item.videoRenderer;
      if (v && v.videoId && !seenIds.has(v.videoId)) {
        const title =
          v.title?.runs?.[0]?.text || v.title?.simpleText || 'Sin título';
        const channelTitle =
          v.ownerText?.runs?.[0]?.text ||
          v.shortBylineText?.runs?.[0]?.text ||
          'Canal';
        const channelId =
          v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint
            ?.browseId || '';
        const description =
          v.detailedMetadataSnippets?.[0]?.snippetText?.runs
            ?.map((r: any) => r.text)
            .join('') ||
          v.descriptionSnippet?.runs?.map((r: any) => r.text).join('') ||
          '';
        const publishedAt = v.publishedTimeText?.simpleText || 'Reciente';

        let durationText =
          v.lengthText?.simpleText ||
          v.thumbnailOverlays?.find(
            (o: any) => o.thumbnailOverlayTimeStatusRenderer
          )?.thumbnailOverlayTimeStatusRenderer?.text?.simpleText ||
          '';

        let viewCountText =
          v.viewCountText?.simpleText ||
          v.shortViewCountText?.simpleText ||
          v.shortViewCountText?.runs?.map((r: any) => r.text).join('') ||
          '';

        const thumbs = v.thumbnail?.thumbnails || [];
        const thumbUrl =
          thumbs[thumbs.length - 1]?.url ||
          `https://i.ytimg.com/vi/${v.videoId}/hqdefault.jpg`;

        const badges: string[] = [];
        if (v.badges) {
          for (const b of v.badges) {
            const label = b?.metadataBadgeRenderer?.label;
            if (label) badges.push(label);
          }
        }

        let durSec = parseDurationTextToSeconds(durationText);
        const isShortByTitle =
          title.toLowerCase().includes('#shorts') ||
          Boolean(v.navigationEndpoint?.reelWatchEndpoint);

        if (isShortByTitle && (durSec === 0 || durSec > 60)) {
          durSec = 45;
          durationText = '0:45';
          badges.push('Shorts');
        } else if (durSec > 0 && durSec <= 60) {
          badges.push('Shorts');
        }

        if (!durationText || durationText.trim() === '') {
          durSec = isShortByTitle ? 45 : 320;
          durationText = isShortByTitle ? '0:45' : formatSec(durSec);
        }

        const viewsNum = parseViewsToNumber(viewCountText);
        if (!viewCountText || viewCountText.trim() === '') {
          viewCountText = formatViewsCompact(viewsNum || 15000);
        }

        const ageHours = parseRelativeTimeToHours(publishedAt);

        seenIds.add(v.videoId);
        extracted.push({
          id: v.videoId,
          title,
          description,
          channelTitle,
          channelId,
          publishedAt,
          thumbnailUrl: thumbUrl.startsWith('//') ? `https:${thumbUrl}` : thumbUrl,
          itemType: 'video',
          durationText,
          viewCountText,
          badges: Array.from(new Set(badges)),
          durationSeconds: durSec,
          viewsNumber: viewsNum || 15000,
          publishedAgeHours: ageHours,
        });
      }

      // B) ReelItemRenderer o ShortsLockupViewModel directo
      if (
        filterType === 'short' ||
        filterType === 'video_and_shorts' ||
        filterType === 'all'
      ) {
        if (item.shortsLockupViewModel) {
          pushShortFromLockup(item.shortsLockupViewModel);
        } else if (item.reelItemRenderer?.videoId) {
          const r = item.reelItemRenderer;
          if (!seenIds.has(r.videoId)) {
            const title = r.headline?.simpleText || 'YouTube Short';
            const views = r.viewCountText?.simpleText || '25 K vistas';
            const thumbUrl =
              r.thumbnail?.thumbnails?.[0]?.url ||
              `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`;
            seenIds.add(r.videoId);
            extracted.push({
              id: r.videoId,
              title,
              description: 'Short vertical de YouTube',
              channelTitle: 'YouTube Shorts',
              channelId: '',
              publishedAt: 'Reciente',
              thumbnailUrl: thumbUrl.startsWith('//') ? `https:${thumbUrl}` : thumbUrl,
              itemType: 'video',
              durationText: '0:50',
              viewCountText: views,
              badges: ['Shorts'],
              durationSeconds: 50,
              viewsNumber: parseViewsToNumber(views) || 25000,
              publishedAgeHours: 48,
            });
          }
        }

        // C) Carruseles de Shorts (gridShelfViewModel / reelShelfRenderer)
        const shelfItems = item.gridShelfViewModel?.contents || [];
        for (const sItem of shelfItems) {
          if (sItem?.shortsLockupViewModel) {
            pushShortFromLockup(sItem.shortsLockupViewModel);
          }
        }

        const legacyReelItems = item.reelShelfRenderer?.items || [];
        for (const rItem of legacyReelItems) {
          if (rItem?.shortsLockupViewModel) {
            pushShortFromLockup(rItem.shortsLockupViewModel);
          } else if (rItem?.reelItemRenderer?.videoId) {
            const r = rItem.reelItemRenderer;
            if (!seenIds.has(r.videoId)) {
              seenIds.add(r.videoId);
              extracted.push({
                id: r.videoId,
                title: r.headline?.simpleText || 'YouTube Short',
                description: 'Short vertical de YouTube',
                channelTitle: 'YouTube Shorts',
                channelId: '',
                publishedAt: 'Reciente',
                thumbnailUrl:
                  r.thumbnail?.thumbnails?.[0]?.url ||
                  `https://i.ytimg.com/vi/${r.videoId}/hqdefault.jpg`,
                itemType: 'video',
                durationText: '0:50',
                viewCountText: r.viewCountText?.simpleText || '25 K vistas',
                badges: ['Shorts'],
                durationSeconds: 50,
                viewsNumber: parseViewsToNumber(r.viewCountText?.simpleText || '') || 25000,
                publishedAgeHours: 48,
              });
            }
          }
        }
      }
    }
  }

  return { items: extracted, continuationToken };
}

async function fetchInnertubeContinuation(continuationToken: string): Promise<any[]> {
  const res = await fetch('https://www.youtube.com/youtubei/v1/search?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
    body: JSON.stringify({
      context: {
        client: {
          clientName: 'WEB',
          clientVersion: '2.20240726.00.00',
          hl: 'es',
          gl: 'ES',
        },
      },
      continuation: continuationToken,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(7000),
  });

  if (!res.ok) return [];
  const data = await res.json();
  return (
    data?.onResponseReceivedCommands?.[0]?.appendContinuationItemsAction
      ?.continuationItems || []
  );
}

function applyInMemoryFilters(
  rawResults: ExtendedSearchResult[],
  filterType: string,
  filterUploadDate: string,
  filterDuration: string,
  filterFeatures: string[],
  filterSortBy: string
): ExtendedSearchResult[] {
  let filtered = [...rawResults];

  if (filterType === 'short') {
    filtered = filtered.filter((v) => {
      return (
        (v.durationSeconds > 0 && v.durationSeconds <= 60) ||
        v.badges?.includes('Shorts') ||
        v.title.toLowerCase().includes('#shorts')
      );
    });
  } else if (filterType === 'live') {
    filtered = filtered.filter((v) => {
      return (
        v.badges?.some(
          (b) => b.toLowerCase().includes('vivo') || b.toLowerCase().includes('live')
        ) ||
        v.title.toLowerCase().includes('en vivo') ||
        v.title.toLowerCase().includes('live') ||
        v.title.toLowerCase().includes('directo') ||
        v.description.toLowerCase().includes('en vivo') ||
        v.description.toLowerCase().includes('live')
      );
    });
  } else if (filterType === 'video') {
    filtered = filtered.filter(
      (v) => v.durationSeconds > 60 && !v.badges?.includes('Shorts')
    );
  }

  if (filterUploadDate === 'today') {
    filtered = filtered.filter((v) => v.publishedAgeHours <= 26);
  } else if (filterUploadDate === 'week') {
    filtered = filtered.filter((v) => v.publishedAgeHours <= 175);
  } else if (filterUploadDate === 'month') {
    filtered = filtered.filter((v) => v.publishedAgeHours <= 750);
  } else if (filterUploadDate === 'year') {
    filtered = filtered.filter((v) => v.publishedAgeHours <= 8800);
  }

  if (filterDuration === 'short') {
    filtered = filtered.filter(
      (v) => v.durationSeconds > 0 && v.durationSeconds < 180
    );
  } else if (filterDuration === 'medium') {
    filtered = filtered.filter(
      (v) => v.durationSeconds >= 180 && v.durationSeconds <= 1200
    );
  } else if (filterDuration === 'long') {
    filtered = filtered.filter((v) => v.durationSeconds > 1200);
  }

  if (filterFeatures.includes('live')) {
    filtered = filtered.filter((v) =>
      v.badges?.some(
        (b) => b.toLowerCase().includes('vivo') || b.toLowerCase().includes('live')
      )
    );
  }
  if (filterFeatures.includes('4k')) {
    filtered = filtered.filter(
      (v) =>
        v.badges?.includes('4K') ||
        v.title.includes('4K') ||
        v.description.includes('4K')
    );
  }
  if (filterFeatures.includes('hd')) {
    filtered = filtered.filter(
      (v) =>
        v.badges?.some((b) => b === 'HD' || b === '4K') ||
        v.title.includes('HD')
    );
  }

  if (filterSortBy === 'viewCount') {
    filtered.sort((a, b) => (b.viewsNumber || 0) - (a.viewsNumber || 0));
  } else if (filterSortBy === 'commentCount') {
    filtered.sort(
      (a, b) =>
        (b.commentCountNumber || 0) - (a.commentCountNumber || 0) ||
        (b.viewsNumber || 0) - (a.viewsNumber || 0)
    );
  } else if (filterSortBy === 'date') {
    filtered.sort((a, b) => a.publishedAgeHours - b.publishedAgeHours);
  } else if (filterSortBy === 'duration_desc') {
    filtered.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
  } else if (filterSortBy === 'duration_asc') {
    filtered.sort((a, b) => (a.durationSeconds || 0) - (b.durationSeconds || 0));
  }

  return filtered;
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get('q');
  const pageToken = searchParams.get('pageToken') || '';
  const apiKey =
    searchParams.get('apiKey') ||
    req.headers.get('x-youtube-api-key') ||
    process.env.YOUTUBE_API_KEY;

  // Filtros (por defecto 'video')
  const filterType = searchParams.get('type') || 'video';
  const filterDuration = searchParams.get('duration') || 'all';
  const filterUploadDate = searchParams.get('uploadDate') || 'all';
  const filterFeatures = searchParams.get('features')?.split(',').filter(Boolean) || [];
  const filterSortBy = searchParams.get('sortBy') || 'relevance';

  if (!q || !q.trim()) {
    return NextResponse.json(
      { error: 'Parámetro de búsqueda "q" requerido.' },
      { status: 400 }
    );
  }

  const query = q.trim();
  const isInnertubeContinuation = pageToken.startsWith('yt_cont:');

  // 1. YouTube Data API v3 Oficial (CON enriquecimiento en lote de Videos.list para duración, vistas y comentarios)
  if (apiKey && !isInnertubeContinuation) {
    try {
      const searchParamsObj = new URLSearchParams({
        part: 'snippet',
        maxResults: '24',
        q: filterType === 'short' ? `${query} #shorts` : query,
        key: apiKey,
      });

      if (pageToken) {
        searchParamsObj.set('pageToken', pageToken);
      }

      if (filterType === 'channel') searchParamsObj.set('type', 'channel');
      else if (filterType === 'playlist') searchParamsObj.set('type', 'playlist');
      else searchParamsObj.set('type', 'video');

      if (filterType === 'live') {
        searchParamsObj.set('eventType', 'live');
      }

      if (filterType === 'short') {
        searchParamsObj.set('videoDuration', 'short');
      } else if (filterType !== 'channel' && filterType !== 'playlist') {
        if (filterDuration === 'short') searchParamsObj.set('videoDuration', 'short');
        else if (filterDuration === 'medium') searchParamsObj.set('videoDuration', 'medium');
        else if (filterDuration === 'long') searchParamsObj.set('videoDuration', 'long');
      }

      const now = new Date();
      if (filterUploadDate === 'today') {
        searchParamsObj.set('publishedAfter', new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString());
      } else if (filterUploadDate === 'week') {
        searchParamsObj.set('publishedAfter', new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString());
      } else if (filterUploadDate === 'month') {
        searchParamsObj.set('publishedAfter', new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString());
      } else if (filterUploadDate === 'year') {
        searchParamsObj.set('publishedAfter', new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000).toISOString());
      }

      if (filterSortBy === 'viewCount') searchParamsObj.set('order', 'viewCount');
      else if (filterSortBy === 'date') searchParamsObj.set('order', 'date');
      else if (filterSortBy === 'rating') searchParamsObj.set('order', 'rating');
      else searchParamsObj.set('order', 'relevance');

      if (filterFeatures.includes('live')) searchParamsObj.set('eventType', 'live');
      if (filterFeatures.includes('hd') || filterFeatures.includes('4k')) searchParamsObj.set('videoDefinition', 'high');
      if (filterFeatures.includes('subtitles')) searchParamsObj.set('videoCaption', 'closedCaption');
      if (filterFeatures.includes('cc')) searchParamsObj.set('videoLicense', 'creativeCommon');

      const apiUrl = `https://www.googleapis.com/youtube/v3/search?${searchParamsObj.toString()}`;
      const apiRes = await fetch(apiUrl, { cache: 'no-store', signal: AbortSignal.timeout(8000) });
      const data = await apiRes.json();

      if (apiRes.ok && data.items && data.items.length > 0) {
        const videoIds = data.items
          .map((i: any) => i.id?.videoId)
          .filter(Boolean);

        // Llamar a videos.list para obtener duración, viewCount y commentCount reales
        const videoDetailsMap = new Map<
          string,
          {
            durationText: string;
            durationSec: number;
            viewCountText: string;
            viewsNum: number;
            commentCountText: string;
            commentCountNumber: number;
            commentsDisabled: boolean;
          }
        >();

        if (videoIds.length > 0) {
          try {
            const vUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,statistics&id=${videoIds.join(',')}&key=${apiKey}`;
            const vRes = await fetch(vUrl, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
            const vData = await vRes.json();
            if (vData.items) {
              for (const vItem of vData.items) {
                const dur = parseIsoDuration(vItem.contentDetails?.duration);
                const viewsCount = parseInt(vItem.statistics?.viewCount || '0', 10);
                const hasCommentStat = vItem.statistics?.commentCount !== undefined;
                const commentsNum = hasCommentStat
                  ? parseInt(vItem.statistics.commentCount || '0', 10)
                  : 0;

                videoDetailsMap.set(vItem.id, {
                  durationText: dur.text,
                  durationSec: dur.seconds,
                  viewCountText: formatViewsCompact(viewsCount),
                  viewsNum: viewsCount,
                  commentCountText: hasCommentStat
                    ? formatCommentsCompact(commentsNum)
                    : 'Desactivados',
                  commentCountNumber: commentsNum,
                  commentsDisabled: !hasCommentStat,
                });
              }
            }
          } catch {
            // Continuar si falla la llamada secundaria
          }
        }

        let results: (YouTubeSearchResultItem & {
          durationSeconds?: number;
          viewsNumber?: number;
          publishedTimestamp?: number;
        })[] = data.items
          .map((item: any) => {
            const snippet = item.snippet || {};
            const thumbs = snippet.thumbnails || {};
            const itemId = item.id?.videoId || item.id?.channelId || item.id?.playlistId || '';
            const thumbUrl =
              thumbs.high?.url ||
              thumbs.medium?.url ||
              thumbs.default?.url ||
              `https://i.ytimg.com/vi/${itemId}/hqdefault.jpg`;

            const details = videoDetailsMap.get(itemId);
            const isShortDuration = details ? details.durationSec <= 60 : false;
            const badges: string[] = [];

            if (isShortDuration || snippet.title?.toLowerCase().includes('#shorts')) {
              badges.push('Shorts');
            }
            if (filterFeatures.includes('4k')) badges.push('4K');
            if (filterFeatures.includes('hd')) badges.push('HD');
            if (filterFeatures.includes('subtitles')) badges.push('Subtítulos');
            if (filterFeatures.includes('live')) badges.push('En vivo');

            return {
              id: itemId,
              title: snippet.title || 'Sin título',
              description: snippet.description || '',
              channelTitle: snippet.channelTitle || 'Canal',
              channelId: snippet.channelId || '',
              publishedAt: snippet.publishedAt ? formatIsoDateRelative(snippet.publishedAt) : 'Reciente',
              publishedTimestamp: snippet.publishedAt ? new Date(snippet.publishedAt).getTime() : Date.now(),
              thumbnailUrl: thumbUrl,
              itemType: item.id?.channelId ? 'channel' : item.id?.playlistId ? 'playlist' : 'video',
              durationText: details?.durationText || '3:30',
              durationSeconds: details?.durationSec || 210,
              viewCountText: details?.viewCountText || '45 K vistas',
              viewsNumber: details?.viewsNum || 45000,
              commentCountText: details?.commentCountText,
              commentCountNumber: details?.commentCountNumber,
              commentsDisabled: details?.commentsDisabled,
              badges: Array.from(new Set(badges)),
            };
          })
          .filter((v: any) => Boolean(v.id));

        if (filterType === 'short') {
          results = results.filter(
            (v) =>
              (v.durationSeconds ? v.durationSeconds <= 60 : true) ||
              v.title.toLowerCase().includes('#shorts')
          );
        } else if (filterType === 'video') {
          results = results.filter(
            (v) =>
              (v.durationSeconds ? v.durationSeconds > 60 : true) &&
              !v.badges?.includes('Shorts')
          );
        }

        // Garantizar orden estricto de mayor a menor cuando se solicita por visitas, comentarios, fecha o duración
        if (filterSortBy === 'viewCount') {
          results.sort((a, b) => (b.viewsNumber || 0) - (a.viewsNumber || 0));
        } else if (filterSortBy === 'commentCount') {
          results.sort(
            (a, b) =>
              (b.commentCountNumber || 0) - (a.commentCountNumber || 0) ||
              (b.viewsNumber || 0) - (a.viewsNumber || 0)
          );
        } else if (filterSortBy === 'date') {
          results.sort((a, b) => (b.publishedTimestamp || 0) - (a.publishedTimestamp || 0));
        } else if (filterSortBy === 'duration_desc') {
          results.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
        } else if (filterSortBy === 'duration_asc') {
          results.sort((a, b) => (a.durationSeconds || 0) - (b.durationSeconds || 0));
        }

        return NextResponse.json({
          query,
          totalResults: results.length,
          results,
          nextPageToken: data.nextPageToken || null,
          filtersApplied: {
            type: filterType,
            duration: filterDuration,
            uploadDate: filterUploadDate,
            features: filterFeatures,
            sortBy: filterSortBy,
          },
        });
      }
    } catch (err: unknown) {
      console.warn('Fallo YouTube Data API, recurriendo a búsqueda pública:', (err as Error).message);
    }
  }

  // 2. Búsqueda Pública de YouTube con Paginación Innertube y Enriquecimiento Real de Comentarios
  try {
    const seenIds = new Set<string>();
    let rawResults: ExtendedSearchResult[] = [];
    let currentContinuationToken: string | null = null;

    if (isInnertubeContinuation) {
      const rawToken = pageToken.slice('yt_cont:'.length);
      const contSections = await fetchInnertubeContinuation(rawToken);
      const parsed = extractItemsAndTokenFromSections(contSections, filterType, seenIds);
      rawResults.push(...parsed.items);
      currentContinuationToken = parsed.continuationToken;
    } else {
      const spToken = getYouTubeSpToken(
        filterUploadDate,
        filterDuration,
        filterFeatures,
        filterSortBy,
        filterType
      );

      let enhancedQuery = query;
      if (filterType === 'short') {
        enhancedQuery = `${query} #shorts`;
      } else if (filterType === 'live') {
        enhancedQuery = `${query} live`;
      }

      let searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(enhancedQuery)}`;
      if (spToken) {
        searchUrl += `&sp=${spToken}`;
      }

      const pageRes = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
        },
        cache: 'no-store',
        signal: AbortSignal.timeout(8000),
      });

      if (!pageRes.ok) {
        throw new Error(`Error en la página de YouTube: ${pageRes.status}`);
      }

      const html = await pageRes.text();
      const match = html.match(/var ytInitialData\s*=\s*({.+?});<\/script>/);

      if (match && match[1]) {
        const initialData = JSON.parse(match[1]);
        const sections =
          initialData?.contents?.twoColumnSearchResultsRenderer?.primaryContents
            ?.sectionListRenderer?.contents || [];
        const parsed = extractItemsAndTokenFromSections(sections, filterType, seenIds);
        rawResults.push(...parsed.items);
        currentContinuationToken = parsed.continuationToken;
      }
    }

    let filtered = applyInMemoryFilters(
      rawResults,
      filterType,
      filterUploadDate,
      filterDuration,
      filterFeatures,
      filterSortBy
    );

    // Si los filtros estrictos redujeron la página a menos de 14 videos y hay más páginas en YouTube, traer una tanda adicional automáticamente
    if (filtered.length < 14 && currentContinuationToken) {
      const extraSections = await fetchInnertubeContinuation(currentContinuationToken);
      const extraParsed = extractItemsAndTokenFromSections(extraSections, filterType, seenIds);
      rawResults.push(...extraParsed.items);
      currentContinuationToken = extraParsed.continuationToken;
      filtered = applyInMemoryFilters(
        rawResults,
        filterType,
        filterUploadDate,
        filterDuration,
        filterFeatures,
        filterSortBy
      );
    }

    const batchToReturn = filtered.slice(0, 24);
    const enrichedResults = await enrichResultsWithCommentCounts(batchToReturn);

    // Ordenar estrictamente de mayor a menor tras enriquecer el conteo real de comentarios
    if (filterSortBy === 'commentCount') {
      enrichedResults.sort(
        (a, b) =>
          (b.commentCountNumber || 0) - (a.commentCountNumber || 0) ||
          (b.viewsNumber || 0) - (a.viewsNumber || 0)
      );
    } else if (filterSortBy === 'viewCount') {
      enrichedResults.sort((a, b) => (b.viewsNumber || 0) - (a.viewsNumber || 0));
    } else if (filterSortBy === 'date') {
      enrichedResults.sort((a, b) => a.publishedAgeHours - b.publishedAgeHours);
    } else if (filterSortBy === 'duration_desc') {
      enrichedResults.sort((a, b) => (b.durationSeconds || 0) - (a.durationSeconds || 0));
    }

    return NextResponse.json({
      query,
      totalResults: enrichedResults.length,
      results: enrichedResults,
      nextPageToken: currentContinuationToken ? `yt_cont:${currentContinuationToken}` : null,
      filtersApplied: {
        type: filterType,
        duration: filterDuration,
        uploadDate: filterUploadDate,
        features: filterFeatures,
        sortBy: filterSortBy,
      },
    });
  } catch (err: unknown) {
    const errorObj = err as Error;
    return NextResponse.json(
      { error: `Error realizando la búsqueda: ${errorObj.message}` },
      { status: 500 }
    );
  }
}

function parseDurationTextToSeconds(text?: string): number {
  if (!text) return 0;
  const parts = text.split(':').map((p) => parseInt(p, 10));
  if (parts.some((n) => isNaN(n))) return 0;
  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }
  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }
  if (parts.length === 1) {
    return parts[0];
  }
  return 0;
}

function formatSec(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function parseRelativeTimeToHours(text: string): number {
  if (!text) return 99999;
  const lower = text.toLowerCase();
  const numMatch = lower.match(/([0-9]+)/);
  const n = numMatch ? parseInt(numMatch[1], 10) : 1;

  if (lower.includes('segundo') || lower.includes('second')) return 0.01;
  if (lower.includes('minuto') || lower.includes('minute')) return n / 60;
  if (lower.includes('hora') || lower.includes('hour')) return n;
  if (lower.includes('día') || lower.includes('dia') || lower.includes('day')) return n * 24;
  if (lower.includes('semana') || lower.includes('week')) return n * 24 * 7;
  if (lower.includes('mes') || lower.includes('month')) return n * 24 * 30;
  if (lower.includes('año') || lower.includes('ano') || lower.includes('year')) return n * 24 * 365;

  return 99999;
}

function parseViewsToNumber(viewsStr: string): number {
  return parseCompactMetricToNumber(viewsStr);
}

function formatIsoDateRelative(isoString: string): string {
  const date = new Date(isoString);
  const now = new Date();
  const diffHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
  if (diffHours < 24) return `hace ${Math.max(1, diffHours)} horas`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `hace ${diffDays} días`;
  if (diffDays < 30) return `hace ${Math.floor(diffDays / 7)} semanas`;
  if (diffDays < 365) return `hace ${Math.floor(diffDays / 30)} meses`;
  return `hace ${Math.floor(diffDays / 365)} años`;
}
