import { NextRequest, NextResponse } from 'next/server';
import { YouTubeCommentItem, VideoCommentsData, YouTubeCommentReply } from '@/lib/types';

const INNERTUBE_CLIENT_CONTEXT = {
  client: {
    clientName: 'WEB',
    clientVersion: '2.20240726.00.00',
    hl: 'es',
    gl: 'ES',
  },
};

function parseCompactCount(raw?: string | number | null): number {
  if (raw === undefined || raw === null) return 0;
  if (typeof raw === 'number') return isNaN(raw) ? 0 : Math.max(0, Math.round(raw));

  const lower = String(raw).toLowerCase().replace(/\u00a0/g, ' ').trim();
  if (!lower || lower === 'desactivados') return 0;

  const isMillions = /(?:^|[\d\s.,])(m|mill|millón|millones)(?:\b|\s|$)/i.test(lower);
  const isThousands = !isMillions && /(?:^|[\d\s.,])(k|mil)(?:\b|\s|$)/i.test(lower);

  const numMatch = lower.match(/([0-9]+(?:[.,][0-9]+)*)/);
  if (!numMatch) return 0;
  const rawNum = numMatch[1];

  if (isMillions || isThousands) {
    const val = parseFloat(rawNum.replace(',', '.'));
    return isNaN(val) ? 0 : Math.round(val * (isMillions ? 1000000 : 1000));
  }

  const exact = parseInt(rawNum.replace(/[^0-9]/g, ''), 10);
  return isNaN(exact) ? 0 : exact;
}

export type CommentSortOrder = 'top' | 'newest' | 'oldest';

function parsePublishedAgeHours(publishedText?: string): number {
  if (!publishedText) return 0;
  const clean = publishedText.toLowerCase().replace(/\(.*?\)/g, '').trim();

  // Si es fecha ISO válida
  const parsedTime = Date.parse(publishedText);
  if (!isNaN(parsedTime) && publishedText.includes('-')) {
    return Math.max(0, (Date.now() - parsedTime) / (1000 * 60 * 60));
  }

  const numMatch = clean.match(/([0-9]+)/);
  const n = numMatch ? parseInt(numMatch[1], 10) : 1;

  if (clean.includes('segundo') || clean.includes('second') || clean.includes('momento') || clean.includes('instante')) {
    return n / 3600;
  }
  if (clean.includes('minuto') || clean.includes('minute')) {
    return n / 60;
  }
  if (clean.includes('hora') || clean.includes('hour')) {
    return n;
  }
  if (clean.includes('día') || clean.includes('dia') || clean.includes('day') || clean.includes('ayer')) {
    return n * 24;
  }
  if (clean.includes('semana') || clean.includes('week')) {
    return n * 24 * 7;
  }
  if (clean.includes('mes') || clean.includes('month')) {
    return n * 24 * 30.44;
  }
  if (clean.includes('año') || clean.includes('ano') || clean.includes('year')) {
    return n * 24 * 365.25;
  }

  return 0;
}

function mapEntityPayloadToReply(payload: any): YouTubeCommentReply | null {
  if (!payload) return null;
  const props = payload.properties || {};
  const author = payload.author || {};
  const toolbar = payload.toolbar || {};

  const id = props.commentId || payload.key;
  const text = props.content?.content ?? '';
  if (!id || !text.trim()) return null;

  const channelPath =
    author.channelCommand?.innertubeCommand?.commandMetadata?.webCommandMetadata?.url ||
    author.channelCommand?.innertubeCommand?.browseEndpoint?.canonicalBaseUrl ||
    (author.channelId ? `/channel/${author.channelId}` : '');

  return {
    id,
    authorName: author.displayName || props.authorButtonA11y || 'Usuario de YouTube',
    authorProfileImageUrl: author.avatarThumbnailUrl || '',
    authorChannelUrl: channelPath
      ? channelPath.startsWith('http')
        ? channelPath
        : `https://www.youtube.com${channelPath}`
      : '',
    text: text.trim(),
    likeCount: parseCompactCount(toolbar.likeCountNotliked || toolbar.likeCountLiked),
    publishedAt: props.publishedTime || 'Reciente',
  };
}

function mapLegacyCommentRenderer(renderer: any): {
  id: string;
  authorName: string;
  authorProfileImageUrl: string;
  authorChannelUrl: string;
  text: string;
  likeCount: number;
  publishedAt: string;
  replyCount: number;
} | null {
  if (!renderer || !renderer.commentId) return null;
  const text =
    renderer.contentText?.runs?.map((r: any) => r.text).join('') ||
    renderer.contentText?.simpleText ||
    '';
  if (!text.trim()) return null;

  const authorUrl =
    renderer.authorEndpoint?.commandMetadata?.webCommandMetadata?.url ||
    renderer.authorEndpoint?.browseEndpoint?.canonicalBaseUrl ||
    '';

  const thumbs = renderer.authorThumbnail?.thumbnails || [];

  return {
    id: renderer.commentId,
    authorName:
      renderer.authorText?.simpleText ||
      renderer.authorText?.runs?.[0]?.text ||
      'Usuario de YouTube',
    authorProfileImageUrl: thumbs[thumbs.length - 1]?.url || '',
    authorChannelUrl: authorUrl ? `https://www.youtube.com${authorUrl}` : '',
    text: text.trim(),
    likeCount: parseCompactCount(
      renderer.voteCount?.simpleText ||
        renderer.voteCount?.runs?.map((r: any) => r.text).join('') ||
        renderer.likeCount
    ),
    publishedAt:
      renderer.publishedTimeText?.runs?.[0]?.text ||
      renderer.publishedTimeText?.simpleText ||
      'Reciente',
    replyCount: parseCompactCount(renderer.replyCount),
  };
}

async function fetchRepliesForToken(replyToken: string): Promise<YouTubeCommentReply[]> {
  try {
    const res = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      body: JSON.stringify({
        context: INNERTUBE_CLIENT_CONTEXT,
        continuation: replyToken,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return [];
    const data = await res.json();

    const entityMap = new Map<string, any>();
    const mutations = data?.frameworkUpdates?.entityBatchUpdate?.mutations || [];
    for (const m of mutations) {
      const cep = m?.payload?.commentEntityPayload;
      if (cep) {
        if (cep.key) entityMap.set(cep.key, cep);
        if (cep.properties?.commentId) entityMap.set(cep.properties.commentId, cep);
      }
    }

    const replies: YouTubeCommentReply[] = [];
    const seenReplyIds = new Set<string>();

    const endpoints = data?.onResponseReceivedEndpoints || [];
    for (const ep of endpoints) {
      const items =
        ep?.appendContinuationItemsAction?.continuationItems ||
        ep?.reloadContinuationItemsCommand?.continuationItems ||
        [];

      for (const item of items) {
        const cvm = item?.commentViewModel?.commentViewModel || item?.commentViewModel;
        if (cvm) {
          const payload = entityMap.get(cvm.commentKey) || entityMap.get(cvm.commentId);
          const mapped = mapEntityPayloadToReply(payload);
          if (mapped && !seenReplyIds.has(mapped.id)) {
            seenReplyIds.add(mapped.id);
            replies.push(mapped);
          }
        } else if (item?.commentRenderer) {
          const legacy = mapLegacyCommentRenderer(item.commentRenderer);
          if (legacy && !seenReplyIds.has(legacy.id)) {
            seenReplyIds.add(legacy.id);
            replies.push({
              id: legacy.id,
              authorName: legacy.authorName,
              authorProfileImageUrl: legacy.authorProfileImageUrl,
              authorChannelUrl: legacy.authorChannelUrl,
              text: legacy.text,
              likeCount: legacy.likeCount,
              publishedAt: legacy.publishedAt,
            });
          }
        }
      }
    }

    // Fallback si las mutaciones vinieron sin commentViewModel explícito
    if (replies.length === 0 && entityMap.size > 0) {
      for (const cep of entityMap.values()) {
        if ((cep.properties?.replyLevel ?? 1) >= 1) {
          const mapped = mapEntityPayloadToReply(cep);
          if (mapped && !seenReplyIds.has(mapped.id)) {
            seenReplyIds.add(mapped.id);
            replies.push(mapped);
          }
        }
      }
    }

    return replies;
  } catch {
    return [];
  }
}

async function fetchPublicYouTubeComments(
  videoId: string,
  targetMax: number,
  sortOrder: CommentSortOrder
): Promise<VideoCommentsData & { commentsDisabled?: boolean }> {
  // Paso 1: Obtener panel de comentarios del video específico y sus tokens de ordenamiento (Destacados y Más recientes)
  const initRes = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept-Language': 'es-ES,es;q=0.9',
    },
    body: JSON.stringify({
      context: INNERTUBE_CLIENT_CONTEXT,
      videoId,
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });

  if (!initRes.ok) {
    throw new Error(`YouTube devolvió estado ${initRes.status}`);
  }

  const initData = await initRes.json();
  const panels = initData?.engagementPanels || [];

  let commentsPanel: any = null;
  for (const panel of panels) {
    const ps = panel?.engagementPanelSectionListRenderer;
    if (ps?.panelIdentifier === 'engagement-panel-comments-section') {
      commentsPanel = ps;
      break;
    }
  }

  if (!commentsPanel) {
    return {
      videoId,
      totalResults: 0,
      comments: [],
      commentsDisabled: true,
      fetchedAt: Date.now(),
    };
  }

  const hdr = commentsPanel?.header?.engagementPanelTitleHeaderRenderer;
  const rawTotalText: string =
    hdr?.contextualInfo?.runs?.map((r: any) => r.text).join('') ||
    hdr?.contextualInfo?.simpleText ||
    '0';
  const reportedTotal = parseCompactCount(rawTotalText);

  // Extraer tokens de ordenamiento del submenú oficial de YouTube (0 = Destacados/Principales, 1 = Más recientes)
  const subMenuItems: any[] = hdr?.menu?.sortFilterSubMenuRenderer?.subMenuItems || [];
  const extractMenuToken = (menuItem: any): string | undefined =>
    menuItem?.serviceEndpoint?.continuationCommand?.token ||
    menuItem?.serviceEndpoint?.reloadContinuationItemsCommand?.continuationItems?.[0]
      ?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;

  const topSortToken = extractMenuToken(subMenuItems[0]);
  const newestSortToken = extractMenuToken(subMenuItems[1]);

  let defaultSectionToken: string | undefined = undefined;
  const sectionContents = commentsPanel?.content?.sectionListRenderer?.contents || [];
  for (const sec of sectionContents) {
    const items = sec?.itemSectionRenderer?.contents || [];
    for (const it of items) {
      const tok =
        it?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
      if (tok) {
        defaultSectionToken = tok;
        break;
      }
    }
    if (defaultSectionToken) break;
  }

  // Para 'newest' y 'oldest' usamos el flujo cronológico real ('Más recientes') de YouTube
  let nextContinuationToken: string | undefined =
    sortOrder === 'newest' || sortOrder === 'oldest'
      ? newestSortToken || topSortToken || defaultSectionToken
      : topSortToken || defaultSectionToken;

  if (!nextContinuationToken) {
    return {
      videoId,
      totalResults: reportedTotal,
      comments: [],
      fetchedAt: Date.now(),
    };
  }

  // Para 'oldest' ampliamos la ventana de paginación cronológica para llegar a los primeros comentarios del video
  const fetchLimit =
    sortOrder === 'oldest' ? Math.min(Math.max(targetMax, 600), 1000) : targetMax;

  // Paso 2: Paginar los comentarios reales de este video
  const allComments: YouTubeCommentItem[] = [];
  const seenIds = new Set<string>();
  const replyTokenByCommentId = new Map<string, string>();

  const maxPages = Math.min(Math.ceil(fetchLimit / 20) + 1, 75);
  let pageCount = 0;

  while (nextContinuationToken && allComments.length < fetchLimit && pageCount < maxPages) {
    const pageRes: Response = await fetch('https://www.youtube.com/youtubei/v1/next?prettyPrint=false', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
      },
      body: JSON.stringify({
        context: INNERTUBE_CLIENT_CONTEXT,
        continuation: nextContinuationToken,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(8000),
    });

    if (!pageRes.ok) break;
    const pageData: any = await pageRes.json();
    pageCount++;

    const entityMap = new Map<string, any>();
    const mutations = pageData?.frameworkUpdates?.entityBatchUpdate?.mutations || [];
    for (const m of mutations) {
      const cep = m?.payload?.commentEntityPayload;
      if (cep) {
        if (cep.key) entityMap.set(cep.key, cep);
        if (cep.properties?.commentId) entityMap.set(cep.properties.commentId, cep);
      }
    }

    let foundNextToken: string | undefined = undefined;
    const endpoints = pageData?.onResponseReceivedEndpoints || [];

    for (const ep of endpoints) {
      const items =
        ep?.reloadContinuationItemsCommand?.continuationItems ||
        ep?.appendContinuationItemsAction?.continuationItems ||
        [];

      for (const item of items) {
        if (item?.continuationItemRenderer) {
          const tok =
            item.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token ||
            item.continuationItemRenderer?.button?.buttonRenderer?.command?.continuationCommand
              ?.token;
          if (tok) {
            foundNextToken = tok;
          }
          continue;
        }

        const thread = item?.commentThreadRenderer;
        if (!thread) continue;

        const cvm = thread.commentViewModel?.commentViewModel || thread.commentViewModel;
        let commentObj: YouTubeCommentItem | null = null;

        if (cvm) {
          const payload = entityMap.get(cvm.commentKey) || entityMap.get(cvm.commentId);
          if (payload) {
            const base = mapEntityPayloadToReply(payload);
            if (base) {
              const replyCount = parseCompactCount(payload.toolbar?.replyCount);
              commentObj = {
                ...base,
                replyCount,
                replies: [],
              };
            }
          }
        }

        if (!commentObj && thread.comment?.commentRenderer) {
          const legacy = mapLegacyCommentRenderer(thread.comment.commentRenderer);
          if (legacy) {
            commentObj = {
              ...legacy,
              replies: [],
            };
          }
        }

        if (commentObj && !seenIds.has(commentObj.id)) {
          seenIds.add(commentObj.id);
          allComments.push(commentObj);

          // Capturar token de respuestas asociado al ID del comentario
          const replyContents = thread.replies?.commentRepliesRenderer?.contents || [];
          for (const rc of replyContents) {
            const rTok =
              rc?.continuationItemRenderer?.continuationEndpoint?.continuationCommand?.token;
            if (rTok) {
              replyTokenByCommentId.set(commentObj.id, rTok);
              break;
            }
          }

          if (allComments.length >= fetchLimit) break;
        }
      }
      if (allComments.length >= fetchLimit) break;
    }

    nextContinuationToken = foundNextToken;
  }

  // Aplicar ordenamiento cronológico exacto si se pidió 'newest' o 'oldest'
  let orderedComments = allComments;
  if (sortOrder === 'newest') {
    orderedComments = [...allComments].sort(
      (a, b) => parsePublishedAgeHours(a.publishedAt) - parsePublishedAgeHours(b.publishedAt)
    );
  } else if (sortOrder === 'oldest') {
    // Invertimos primero el flujo cronológico (más recientes -> más antiguos) para preservar el orden exacto dentro del mismo rango de fecha, y luego ordenamos de mayor a menor antigüedad (evitando que un comentario fijado reciente quede primero)
    orderedComments = [...allComments]
      .reverse()
      .sort(
        (a, b) => parsePublishedAgeHours(b.publishedAt) - parsePublishedAgeHours(a.publishedAt)
      );
  }

  const finalComments = orderedComments.slice(0, targetMax);

  // Paso 3: Cargar respuestas anidadas de los primeros hilos visibles con respuestas en paralelo
  const threadsWithRepliesToFetch: { index: number; token: string }[] = [];
  for (let idx = 0; idx < finalComments.length && threadsWithRepliesToFetch.length < 20; idx++) {
    const rTok = replyTokenByCommentId.get(finalComments[idx].id);
    if (rTok) {
      threadsWithRepliesToFetch.push({ index: idx, token: rTok });
    }
  }

  const REPLY_CONCURRENCY = 10;
  for (let i = 0; i < threadsWithRepliesToFetch.length; i += REPLY_CONCURRENCY) {
    const batch = threadsWithRepliesToFetch.slice(i, i + REPLY_CONCURRENCY);
    const batchReplies = await Promise.all(batch.map((entry) => fetchRepliesForToken(entry.token)));

    batchReplies.forEach((replies, idx) => {
      const targetIdx = batch[idx].index;
      if (finalComments[targetIdx] && replies.length > 0) {
        finalComments[targetIdx] = {
          ...finalComments[targetIdx],
          replies,
          replyCount: Math.max(finalComments[targetIdx].replyCount || 0, replies.length),
        };
      }
    });
  }

  return {
    videoId,
    totalResults: Math.max(reportedTotal, finalComments.length),
    comments: finalComments,
    fetchedAt: Date.now(),
  };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const videoId = searchParams.get('videoId');
  const rawSort = searchParams.get('sort') || 'top';
  const sortOrder: CommentSortOrder =
    rawSort === 'newest' || rawSort === 'oldest' ? rawSort : 'top';
  const apiKey =
    searchParams.get('apiKey') ||
    req.headers.get('x-youtube-api-key') ||
    process.env.YOUTUBE_API_KEY;

  // Cantidad objetivo de comentarios (por defecto 300 para carga ágil y completa; hasta 2000 bajo demanda)
  const maxCommentsParam = parseInt(searchParams.get('max') || '300', 10);
  const targetMax = isNaN(maxCommentsParam)
    ? 300
    : Math.min(Math.max(maxCommentsParam, 50), 2000);

  if (!videoId || !/^[a-zA-Z0-9_-]{11}$/.test(videoId)) {
    return NextResponse.json(
      { error: 'ID de video de YouTube inválido o no proporcionado.' },
      { status: 400 }
    );
  }

  // 1. Si hay clave de YouTube Data API v3 configurada, intentar primero con la API oficial
  if (apiKey) {
    try {
      let nextPageToken: string | undefined = undefined;
      const allComments: YouTubeCommentItem[] = [];
      let totalResultsReported = 0;
      let pageCount = 0;
      const fetchLimit =
        sortOrder === 'oldest' ? Math.min(Math.max(targetMax, 600), 1000) : targetMax;
      const MAX_PAGES = Math.ceil(fetchLimit / 100);
      const ytApiOrder = sortOrder === 'top' ? 'relevance' : 'time';

      do {
        let apiUrl = `https://www.googleapis.com/youtube/v3/commentThreads?part=snippet,replies&videoId=${videoId}&maxResults=100&order=${ytApiOrder}&key=${encodeURIComponent(
          apiKey
        )}`;
        if (nextPageToken) {
          apiUrl += `&pageToken=${encodeURIComponent(nextPageToken)}`;
        }

        const apiRes = await fetch(apiUrl, {
          cache: 'no-store',
          signal: AbortSignal.timeout(10000),
        });
        const data = await apiRes.json();

        if (!apiRes.ok) {
          if (data?.error?.errors?.[0]?.reason === 'commentsDisabled') {
            return NextResponse.json({
              videoId,
              commentsDisabled: true,
              comments: [],
              totalResults: 0,
              fetchedAt: Date.now(),
            });
          }
          if (pageCount === 0) {
            throw new Error(data?.error?.message || 'Error en YouTube Data API');
          }
          break;
        }

        if (totalResultsReported === 0 && data.pageInfo?.totalResults) {
          totalResultsReported = data.pageInfo.totalResults;
        }

        const items = data.items || [];
        for (const item of items) {
          const top = item.snippet?.topLevelComment?.snippet || {};
          const rawReplies = item.replies?.comments || [];
          const replies: YouTubeCommentReply[] = rawReplies.map((r: any) => {
            const rSnippet = r.snippet || {};
            return {
              id: r.id || Math.random().toString(36).substring(2),
              authorName: rSnippet.authorDisplayName || 'Usuario de YouTube',
              authorProfileImageUrl: rSnippet.authorProfileImageUrl || '',
              authorChannelUrl: rSnippet.authorChannelUrl || '',
              text: rSnippet.textDisplay
                ? rSnippet.textDisplay.replace(/<[^>]+>/g, '').trim()
                : rSnippet.textOriginal || '',
              likeCount: rSnippet.likeCount || 0,
              publishedAt: rSnippet.publishedAt || new Date().toISOString(),
            };
          });

          allComments.push({
            id: item.id || Math.random().toString(36).substring(2),
            authorName: top.authorDisplayName || 'Usuario de YouTube',
            authorProfileImageUrl: top.authorProfileImageUrl || '',
            authorChannelUrl: top.authorChannelUrl || '',
            text: top.textDisplay
              ? top.textDisplay.replace(/<[^>]+>/g, '').trim()
              : top.textOriginal || '',
            likeCount: top.likeCount || 0,
            publishedAt: top.publishedAt || new Date().toISOString(),
            replyCount: item.snippet?.totalReplyCount || replies.length || 0,
            replies,
          });
        }

        nextPageToken = data.nextPageToken;
        pageCount++;

        if (allComments.length >= fetchLimit) {
          break;
        }
      } while (nextPageToken && pageCount < MAX_PAGES);

      let ordered = allComments;
      if (sortOrder === 'newest') {
        ordered = [...allComments].sort(
          (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
        );
      } else if (sortOrder === 'oldest') {
        ordered = [...allComments]
          .reverse()
          .sort(
            (a, b) => new Date(a.publishedAt).getTime() - new Date(b.publishedAt).getTime()
          );
      }

      const finalApiComments = ordered.slice(0, targetMax);

      return NextResponse.json({
        videoId,
        totalResults: Math.max(totalResultsReported, finalApiComments.length),
        comments: finalApiComments,
        fetchedAt: Date.now(),
      });
    } catch (err: unknown) {
      console.warn(
        'Fallo YouTube Data API en comentarios, usando extracción directa Innertube:',
        (err as Error).message
      );
    }
  }

  // 2. Extracción directa pública en tiempo real desde YouTube Innertube (/youtubei/v1/next)
  try {
    const publicCommentsData = await fetchPublicYouTubeComments(videoId, targetMax, sortOrder);
    return NextResponse.json(publicCommentsData);
  } catch (err: unknown) {
    const errorObj = err as Error;
    return NextResponse.json(
      {
        videoId,
        error: `No se pudieron cargar los comentarios de este video: ${errorObj.message}`,
        comments: [],
        totalResults: 0,
        fetchedAt: Date.now(),
      },
      { status: 502 }
    );
  }
}
