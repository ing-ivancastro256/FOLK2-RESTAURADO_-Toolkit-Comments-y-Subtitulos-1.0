import { YouTubeThumbnailItem, TranscriptSegment } from './types';

/**
 * Extrae el ID de video de YouTube a partir de cualquier formato de URL soportado o ID directo.
 */
export function extractYouTubeVideoId(input: string): string | null {
  if (!input) return null;
  const cleanInput = input.trim();

  // Si ya es un ID de 11 caracteres alfanuméricos directos
  if (/^[a-zA-Z0-9_-]{11}$/.test(cleanInput)) {
    return cleanInput;
  }

  // Patrones de URLs de YouTube
  const patterns = [
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/watch\?(?:.*&)?v=([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?(?:www\.)?youtube\.com\/live\/([a-zA-Z0-9_-]{11})/i,
    /(?:https?:\/\/)?youtu\.be\/([a-zA-Z0-9_-]{11})/i,
  ];

  for (const pattern of patterns) {
    const match = cleanInput.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }

  return null;
}

export const extractVideoId = extractYouTubeVideoId;

/**
 * Construye la URL estándar de visualización en YouTube para un ID de video.
 */
export function getYouTubeVideoUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

/**
 * Copia texto al portapapeles de forma compatible con iframes y navegadores modernos.
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Usar fallback clásico con textarea si el iframe restringe Clipboard API
  }

  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.setAttribute('readonly', '');
    textArea.style.position = 'fixed';
    textArea.style.top = '-9999px';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textArea);
    return ok;
  } catch {
    return false;
  }
}

/**
 * Genera la estructura completa de miniaturas oficiales para un videoId
 */
export function generateThumbnailItems(videoId: string): {
  maxres: YouTubeThumbnailItem;
  sd: YouTubeThumbnailItem;
  hq: YouTubeThumbnailItem;
  mq: YouTubeThumbnailItem;
  default: YouTubeThumbnailItem;
} {
  return {
    maxres: {
      quality: 'maxres',
      label: 'Máxima Resolución (HD 1080p/720p)',
      url: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
      width: 1280,
      height: 720,
    },
    sd: {
      quality: 'sd',
      label: 'Resolución Estándar (SD)',
      url: `https://img.youtube.com/vi/${videoId}/sddefault.jpg`,
      width: 640,
      height: 480,
    },
    hq: {
      quality: 'hq',
      label: 'Alta Calidad (HQ)',
      url: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      width: 480,
      height: 360,
    },
    mq: {
      quality: 'mq',
      label: 'Calidad Media (MQ)',
      url: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      width: 320,
      height: 180,
    },
    default: {
      quality: 'default',
      label: 'Baja Calidad (Default)',
      url: `https://img.youtube.com/vi/${videoId}/default.jpg`,
      width: 120,
      height: 90,
    },
  };
}

/**
 * Formatea segundos a formato HH:MM:SS o MM:SS
 */
export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '00:00';
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const minsStr = mins.toString().padStart(2, '0');
  const secsStr = secs.toString().padStart(2, '0');

  if (hrs > 0) {
    return `${hrs}:${minsStr}:${secsStr}`;
  }
  return `${minsStr}:${secsStr}`;
}

/**
 * Formatea números grandes (vistas, likes) de forma legible
 */
export function formatCompactNumber(numStrOrNum?: string | number): string {
  if (!numStrOrNum) return '0';
  const num = typeof numStrOrNum === 'string' ? parseInt(numStrOrNum.replace(/[^0-9]/g, ''), 10) : numStrOrNum;
  if (isNaN(num)) return numStrOrNum.toString();

  return new Intl.NumberFormat('es-ES', { notation: 'compact', compactDisplay: 'short' }).format(num);
}

/**
 * Convierte segundos a formato de tiempo SRT: 00:01:23,456
 */
function toSrtTime(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const millis = Math.floor((totalSeconds % 1) * 1000);

  return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')},${millis.toString().padStart(3, '0')}`;
}

/**
 * Convierte segmentos de transcripción a formato estándar de subtítulos SRT
 */
export function segmentsToSrt(segments: TranscriptSegment[]): string {
  return segments
    .map((seg, index) => {
      const start = toSrtTime(seg.start);
      const end = toSrtTime(seg.start + (seg.duration || 2));
      return `${index + 1}\n${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join('\n');
}

/**
 * Convierte segmentos de transcripción a formato WebVTT
 */
export function segmentsToVtt(segments: TranscriptSegment[]): string {
  const header = 'WEBVTT\n\n';
  const body = segments
    .map((seg) => {
      const start = toSrtTime(seg.start).replace(',', '.');
      const end = toSrtTime(seg.start + (seg.duration || 2)).replace(',', '.');
      return `${start} --> ${end}\n${seg.text.trim()}\n`;
    })
    .join('\n');
  return header + body;
}

/**
 * Convierte segmentos de transcripción a texto plano limpio (sin marcas de tiempo)
 */
export function segmentsToPlainText(segments: TranscriptSegment[]): string {
  return segments.map((seg) => seg.text.trim()).filter(Boolean).join('\n');
}

/**
 * Formatea fechas de forma determinista para evitar discrepancias de hidratación entre SSR y cliente
 */
export function formatDateSafe(dateInput: string | number | undefined | null): string {
  if (!dateInput) return '';
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return String(dateInput);
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}
