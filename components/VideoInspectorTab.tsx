'use client';

import React, { useState } from 'react';
import {
  ExternalLink,
  Eye,
  Clock,
  Calendar,
  Tag,
  Copy,
  Check,
  Star,
  ChevronDown,
  ChevronUp,
  Image as ImageIcon,
  FileText,
  Sparkles,
  MessageSquare,
  Music2,
} from 'lucide-react';
import { YouTubeVideoMetadata } from '@/lib/types';
import { formatCompactNumber, formatDuration, formatDateSafe } from '@/lib/youtube';

interface VideoInspectorTabProps {
  metadata: YouTubeVideoMetadata;
  onToggleFavorite: () => Promise<void>;
  onNavigateTab: (tab: 'thumbnails' | 'transcript' | 'comments' | 'repurpose' | 'audio') => void;
}

export function VideoInspectorTab({
  metadata,
  onToggleFavorite,
  onNavigateTab,
}: VideoInspectorTabProps) {
  const [copiedAllTags, setCopiedAllTags] = useState(false);
  const [copiedTagIndex, setCopiedTagIndex] = useState<number | null>(null);
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  const handleCopyAllTags = () => {
    if (!metadata.tags || metadata.tags.length === 0) return;
    navigator.clipboard.writeText(metadata.tags.join(', '));
    setCopiedAllTags(true);
    setTimeout(() => setCopiedAllTags(false), 2000);
  };

  const handleCopySingleTag = (tag: string, index: number) => {
    navigator.clipboard.writeText(tag);
    setCopiedTagIndex(index);
    setTimeout(() => setCopiedTagIndex(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Grid principal: Reproductor + Metadatos clave */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Reproductor de video incrustado */}
        <div className="lg:col-span-7 space-y-3">
          <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-neutral-200 bg-black shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <iframe
              id="yt-main-player"
              src={`https://www.youtube.com/embed/${metadata.videoId}?enablejsapi=1`}
              title={metadata.title}
              className="absolute inset-0 h-full w-full"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowFullScreen
            />
          </div>

          {/* Acciones directas del reproductor */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
            <div className="flex items-center gap-2 text-xs text-[#5B5B66] dark:text-slate-400">
              <span>ID: <code className="font-mono text-[#121111] dark:text-slate-300 font-medium">{metadata.videoId}</code></span>
              <span aria-hidden="true">·</span>
              <a
                href={metadata.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[#2848F0] hover:underline dark:text-slate-300 dark:hover:text-white"
              >
                <span>Abrir en YouTube</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>

            <button
              onClick={onToggleFavorite}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all ${
                metadata.isFavorite
                  ? 'border-amber-400/60 bg-amber-50 text-amber-800 dark:border-amber-500/50 dark:bg-amber-950/40 dark:text-amber-300'
                  : 'border-neutral-200 bg-white text-[#5B5B66] hover:text-[#121111] hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
              }`}
            >
              <Star className={`h-3.5 w-3.5 ${metadata.isFavorite ? 'fill-amber-400 text-amber-500' : ''}`} />
              <span>{metadata.isFavorite ? 'En favoritos' : 'Guardar en favoritos'}</span>
            </button>
          </div>
        </div>

        {/* Panel lateral: Metadatos y métricas */}
        <div className="lg:col-span-5 space-y-4">
          <div className="rounded-2xl border border-neutral-200/90 bg-white p-5 space-y-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
            <div>
              <h2 className="text-lg font-bold text-[#121111] dark:text-slate-100 leading-snug font-heading">
                {metadata.title}
              </h2>
              <div className="mt-2 flex items-center gap-2 text-xs text-[#5B5B66] dark:text-slate-400">
                <span className="font-semibold text-[#121111] dark:text-slate-200">{metadata.channelTitle}</span>
                {metadata.channelUrl && (
                  <>
                    <span aria-hidden="true">·</span>
                    <a
                      href={metadata.channelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#2848F0] hover:underline dark:text-slate-400 dark:hover:text-slate-200"
                    >
                      Canal
                    </a>
                  </>
                )}
              </div>
            </div>

            {/* Tira de métricas en formato tabular */}
            <div className="grid grid-cols-3 gap-2 border-y border-neutral-100 py-3.5 dark:border-slate-800/80">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#5B5B66] dark:text-slate-400 font-medium">
                  <Eye className="h-3 w-3" />
                  <span>Vistas</span>
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-[#121111] dark:text-slate-100 tabular-nums">
                  {formatCompactNumber(metadata.viewCount)}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#5B5B66] dark:text-slate-400 font-medium">
                  <Clock className="h-3 w-3" />
                  <span>Duración</span>
                </div>
                <div className="mt-1 font-mono text-sm font-bold text-[#121111] dark:text-slate-100 tabular-nums">
                  {metadata.durationSeconds ? formatDuration(metadata.durationSeconds) : 'N/A'}
                </div>
              </div>

              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-[#5B5B66] dark:text-slate-400 font-medium">
                  <Calendar className="h-3 w-3" />
                  <span>Fecha</span>
                </div>
                <div className="mt-1 text-xs font-semibold text-[#121111] dark:text-slate-200 truncate">
                  {metadata.publishedAt ? formatDateSafe(metadata.publishedAt) : 'Disponible'}
                </div>
              </div>
            </div>

            {/* Accesos rápidos a los otros módulos */}
            <div className="space-y-2 pt-1">
              <span className="text-[11px] font-semibold text-[#5B5B66] dark:text-slate-400 uppercase tracking-wider">
                Herramientas para este video:
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  onClick={() => onNavigateTab('audio')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/50 transition-all shadow-2xs cursor-pointer"
                >
                  <Music2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                  <span>Audio MP3</span>
                </button>

                <button
                  onClick={() => onNavigateTab('thumbnails')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-[#FAFAFA] px-2.5 py-2 text-xs font-semibold text-[#121111] hover:border-[#2848F0] hover:text-[#2848F0] hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition-all shadow-2xs cursor-pointer"
                >
                  <ImageIcon className="h-3.5 w-3.5 text-[#2848F0] dark:text-blue-400" />
                  <span>Miniaturas</span>
                </button>

                <button
                  onClick={() => onNavigateTab('transcript')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-[#FAFAFA] px-2.5 py-2 text-xs font-semibold text-[#121111] hover:border-[#2848F0] hover:text-[#2848F0] hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition-all shadow-2xs cursor-pointer"
                >
                  <FileText className="h-3.5 w-3.5 text-[#2848F0] dark:text-emerald-400" />
                  <span>Subtítulos</span>
                </button>

                <button
                  onClick={() => onNavigateTab('comments')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-[#FAFAFA] px-2.5 py-2 text-xs font-semibold text-[#121111] hover:border-[#2848F0] hover:text-[#2848F0] hover:bg-white dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition-all shadow-2xs cursor-pointer"
                >
                  <MessageSquare className="h-3.5 w-3.5 text-[#2848F0] dark:text-slate-300" />
                  <span>Comentarios</span>
                </button>

                <button
                  onClick={() => onNavigateTab('repurpose')}
                  className="flex items-center justify-center gap-1.5 rounded-xl border border-[#2848F0]/30 bg-[#EEF1F8] px-2.5 py-2 text-xs font-bold text-[#2848F0] hover:bg-[#2848F0] hover:text-white dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-300 dark:hover:bg-rose-900/40 transition-all shadow-2xs cursor-pointer col-span-2 sm:col-span-1"
                >
                  <Sparkles className="h-3.5 w-3.5 text-[#2848F0] dark:text-rose-400" />
                  <span>Repurpose</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Sección inferior: Etiquetas (SEO) y Descripción */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Nube de etiquetas para SEO */}
        <div className="lg:col-span-6 rounded-2xl border border-neutral-200/90 bg-white p-5 space-y-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Tag className="h-4 w-4 text-[#2848F0] dark:text-rose-400" />
              <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
                Etiquetas y Palabras Clave ({metadata.tags?.length || 0})
              </h3>
            </div>
            {metadata.tags && metadata.tags.length > 0 && (
              <button
                onClick={handleCopyAllTags}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
              >
                {copiedAllTags ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                <span>{copiedAllTags ? 'Copiadas' : 'Copiar todas'}</span>
              </button>
            )}
          </div>

          {metadata.tags && metadata.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5 pt-1 max-h-48 overflow-y-auto pr-1">
              {metadata.tags.map((tag, idx) => (
                <button
                  key={idx}
                  onClick={() => handleCopySingleTag(tag, idx)}
                  className="group flex items-center gap-1 rounded-lg border border-neutral-200 bg-[#FAFAFA] px-2.5 py-1 text-xs text-[#5B5B66] hover:border-[#2848F0] hover:text-[#2848F0] hover:bg-white dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:text-white transition-all"
                  title="Haz clic para copiar"
                >
                  <span>#{tag}</span>
                  {copiedTagIndex === idx ? (
                    <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Copy className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity text-[#5B5B66] dark:text-slate-500" />
                  )}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#5B5B66] dark:text-slate-500 italic py-2">
              El creador no ha configurado etiquetas públicas visibles en este video.
            </p>
          )}
        </div>

        {/* Descripción del video con botón de expansión */}
        <div className="lg:col-span-6 rounded-2xl border border-neutral-200/90 bg-white p-5 space-y-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">Descripción del Video</h3>
            <button
              onClick={() => setIsDescExpanded(!isDescExpanded)}
              className="flex items-center gap-1 text-xs font-semibold text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200 transition-colors"
            >
              <span>{isDescExpanded ? 'Contraer' : 'Expandir'}</span>
              {isDescExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>

          <div
            className={`text-xs text-[#5B5B66] dark:text-slate-300 whitespace-pre-wrap leading-relaxed overflow-hidden transition-all ${
              isDescExpanded ? 'max-h-96 overflow-y-auto pr-2' : 'max-h-32'
            }`}
          >
            {metadata.description || 'Sin descripción disponible.'}
          </div>
        </div>
      </div>
    </div>
  );
}
