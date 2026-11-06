'use client';

import React, { useState } from 'react';
import { Download, Copy, Check, Eye, Smartphone, Monitor } from 'lucide-react';
import { YouTubeVideoMetadata, YouTubeThumbnailItem } from '@/lib/types';
import { formatCompactNumber, formatDuration } from '@/lib/youtube';

interface ThumbnailStudioTabProps {
  metadata: YouTubeVideoMetadata;
}

export function ThumbnailStudioTab({ metadata }: ThumbnailStudioTabProps) {
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [downloadingQuality, setDownloadingQuality] = useState<string | null>(null);

  const thumbnailList: YouTubeThumbnailItem[] = [
    metadata.thumbnails.maxres || {
      quality: 'maxres',
      label: 'Máxima Resolución (HD 1080p/720p)',
      url: `https://img.youtube.com/vi/${metadata.videoId}/maxresdefault.jpg`,
      width: 1280,
      height: 720,
    },
    metadata.thumbnails.sd || {
      quality: 'sd',
      label: 'Resolución Estándar (SD)',
      url: `https://img.youtube.com/vi/${metadata.videoId}/sddefault.jpg`,
      width: 640,
      height: 480,
    },
    metadata.thumbnails.hq,
    metadata.thumbnails.mq,
  ].filter(Boolean);

  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<string | null>(null);

  const handleCopyUrl = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  const handleDownload = async (quality: string) => {
    try {
      setDownloadingQuality(quality);
      setDownloadError(null);
      setDownloadSuccess(null);

      const downloadEndpoint = `/api/youtube/download-thumbnail?videoId=${metadata.videoId}&quality=${quality}`;
      const res = await fetch(downloadEndpoint);

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo descargar la miniatura de YouTube');
      }

      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = `miniatura-${metadata.videoId}-${quality}.jpg`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);

      setDownloadSuccess(`¡Miniatura ${quality.toUpperCase()} descargada correctamente!`);
      setTimeout(() => setDownloadSuccess(null), 3500);
    } catch (err: unknown) {
      const errObj = err as Error;
      setDownloadError(errObj.message || 'Error al procesar la descarga de la miniatura');
    } finally {
      setDownloadingQuality(null);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado de la pestaña */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-neutral-200/80 dark:border-slate-800 pb-4">
        <div>
          <h2 className="text-xl font-bold text-[#121111] dark:text-slate-100 font-heading">Estudio de Miniaturas Oficiales</h2>
          <p className="text-xs text-[#5B5B66] dark:text-slate-400 mt-0.5">
            Descarga las miniaturas originales generadas por YouTube en máxima fidelidad sin pérdida de compresión.
          </p>
          {downloadSuccess && (
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5 flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              <span>{downloadSuccess}</span>
            </p>
          )}
          {downloadError && (
            <p className="text-xs font-semibold text-rose-600 dark:text-rose-400 mt-1.5">
              {downloadError}
            </p>
          )}
        </div>

        {/* Acceso a descarga directa de máxima calidad */}
        <button
          onClick={() => handleDownload('maxres')}
          disabled={downloadingQuality === 'maxres'}
          className="flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-4 py-2.5 text-xs font-semibold text-white shadow-xs hover:shadow-md transition-all whitespace-nowrap self-start sm:self-auto cursor-pointer"
        >
          <Download className="h-4 w-4" />
          <span>{downloadingQuality === 'maxres' ? 'Descargando...' : 'Descargar Máxima Resolución (1080p)'}</span>
        </button>
      </div>

      {/* Grid de miniaturas disponibles */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {thumbnailList.map((thumb) => (
          <div
            key={thumb.quality}
            className="flex flex-col overflow-hidden rounded-2xl border border-neutral-200/90 bg-white shadow-xs transition-all hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-slate-700"
          >
            {/* Imagen miniatura */}
            <div className="relative aspect-video w-full overflow-hidden bg-neutral-900">
              <img
                src={thumb.url}
                alt={`${metadata.title} - ${thumb.label}`}
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover transition-transform duration-300 hover:scale-105"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = `https://img.youtube.com/vi/${metadata.videoId}/hqdefault.jpg`;
                }}
              />
              <div className="absolute top-2.5 right-2.5 rounded-lg bg-black/75 backdrop-blur-xs px-2.5 py-1 font-mono text-[11px] font-medium text-white tabular-nums shadow-xs">
                {thumb.width} × {thumb.height} px
              </div>
            </div>

            {/* Acciones de la miniatura */}
            <div className="p-4 flex items-center justify-between gap-3">
              <div>
                <h4 className="text-xs font-bold text-[#121111] dark:text-slate-200 font-heading">{thumb.label}</h4>
                <span className="text-[11px] font-mono text-[#5B5B66] dark:text-slate-500 uppercase">{thumb.quality}</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleCopyUrl(thumb.url)}
                  className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-[#FAFAFA] px-2.5 py-1.5 text-xs font-medium text-[#121111] hover:bg-neutral-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
                  title="Copiar URL directa de la imagen"
                >
                  {copiedUrl === thumb.url ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                  <span className="hidden sm:inline">{copiedUrl === thumb.url ? 'Copiada' : 'Copiar URL'}</span>
                </button>

                <button
                  onClick={() => handleDownload(thumb.quality)}
                  disabled={downloadingQuality === thumb.quality}
                  className="flex items-center gap-1.5 rounded-lg bg-[#1C1C1C] hover:bg-[#2E2E2E] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-3 py-1.5 text-xs font-semibold transition-colors shadow-2xs"
                  title="Descargar archivo JPG"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>{downloadingQuality === thumb.quality ? '...' : 'Descargar'}</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Simulador de CTR / Feed Preview */}
      <div className="rounded-2xl border border-neutral-200/90 bg-[#FAFAFA] p-6 space-y-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-[#2848F0] dark:text-rose-400" />
              <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
                Simulador de CTR y Feed de YouTube
              </h3>
            </div>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400 mt-0.5">
              Evalúa la legibilidad y el impacto visual de la miniatura tal como la ven los usuarios al hacer scroll.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-white dark:bg-slate-950 p-1 rounded-xl border border-neutral-200 dark:border-slate-800 self-start sm:self-auto shadow-2xs">
            <button
              onClick={() => setPreviewMode('desktop')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                previewMode === 'desktop'
                  ? 'bg-[#1C1C1C] text-white shadow-xs dark:bg-slate-800'
                  : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Escritorio</span>
            </button>
            <button
              onClick={() => setPreviewMode('mobile')}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg transition-colors ${
                previewMode === 'mobile'
                  ? 'bg-[#1C1C1C] text-white shadow-xs dark:bg-slate-800'
                  : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Smartphone className="h-3.5 w-3.5" />
              <span>Móvil</span>
            </button>
          </div>
        </div>

        {/* Tarjeta simulada de YouTube */}
        <div className="flex justify-center pt-2">
          {previewMode === 'desktop' ? (
            <div className="w-full max-w-sm rounded-2xl overflow-hidden bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 shadow-md">
              <div className="relative aspect-video w-full bg-neutral-900">
                <img
                  src={`https://img.youtube.com/vi/${metadata.videoId}/hqdefault.jpg`}
                  alt="Feed Preview"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 text-[10px] font-mono font-bold text-white rounded">
                  {metadata.durationSeconds ? formatDuration(metadata.durationSeconds) : '10:24'}
                </span>
              </div>
              <div className="p-3.5 flex gap-3">
                <div className="h-9 w-9 shrink-0 rounded-full bg-neutral-100 dark:bg-slate-800 flex items-center justify-center text-xs font-bold text-[#121111] dark:text-slate-300">
                  {metadata.channelTitle.slice(0, 2).toUpperCase()}
                </div>
                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-[#121111] dark:text-slate-100 line-clamp-2 leading-snug font-heading">
                    {metadata.title}
                  </h4>
                  <div className="text-[11px] text-[#5B5B66] dark:text-slate-400 flex items-center gap-1">
                    <span>{metadata.channelTitle}</span>
                  </div>
                  <div className="text-[10px] text-[#5B5B66] dark:text-slate-500 font-mono tabular-nums flex items-center gap-1">
                    <span>{formatCompactNumber(metadata.viewCount)} vistas</span>
                    <span aria-hidden="true">·</span>
                    <span>hace 2 semanas</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full max-w-xs rounded-2xl overflow-hidden bg-white dark:bg-slate-950 border border-neutral-200 dark:border-slate-800 p-2 shadow-lg">
              <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-neutral-900">
                <img
                  src={`https://img.youtube.com/vi/${metadata.videoId}/hqdefault.jpg`}
                  alt="Feed Preview Mobile"
                  referrerPolicy="no-referrer"
                  className="h-full w-full object-cover"
                />
                <span className="absolute bottom-1 right-1 bg-black/80 px-1 py-0.5 text-[9px] font-mono font-bold text-white rounded">
                  {metadata.durationSeconds ? formatDuration(metadata.durationSeconds) : '10:24'}
                </span>
              </div>
              <div className="p-2.5 flex gap-2.5">
                <div className="h-8 w-8 shrink-0 rounded-full bg-neutral-100 dark:bg-slate-800 flex items-center justify-center text-[10px] font-bold text-[#121111] dark:text-slate-300">
                  {metadata.channelTitle.slice(0, 2).toUpperCase()}
                </div>
                <div className="space-y-0.5">
                  <h4 className="text-[11px] font-bold text-[#121111] dark:text-slate-100 line-clamp-2 leading-tight font-heading">
                    {metadata.title}
                  </h4>
                  <p className="text-[10px] text-[#5B5B66] dark:text-slate-400 truncate">
                    {metadata.channelTitle} · {formatCompactNumber(metadata.viewCount)} vistas
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
