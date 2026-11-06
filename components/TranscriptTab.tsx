'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Search,
  Copy,
  Check,
  Download,
  Clock,
  Sparkles,
  FileDown,
  Volume2,
  Loader2,
  AlertCircle,
  RefreshCw,
  Languages,
  CheckCircle2,
  Ban,
  FileText,
  AlertTriangle,
} from 'lucide-react';
import { AvailableCaptionTrack, VideoTranscript, YouTubeVideoMetadata } from '@/lib/types';
import { formatDuration, segmentsToPlainText, segmentsToSrt, segmentsToVtt } from '@/lib/youtube';

interface TranscriptTabProps {
  metadata: YouTubeVideoMetadata;
  transcript: VideoTranscript | null;
  isLoading?: boolean;
  error?: string | null;
  onFetchTranscript?: () => Promise<void>;
  onTranscriptSuccess?: (transcript: VideoTranscript) => void;
  onNavigateToRepurpose: () => void;
  onSeekPlayer?: (seconds: number) => void;
}

type TranscriptUIState =
  | 'idle'
  | 'consulting_languages'
  | 'languages_found'
  | 'extracting'
  | 'completed'
  | 'no_captions'
  | 'unavailable'
  | 'error';

export function TranscriptTab({
  metadata,
  transcript: propTranscript,
  onTranscriptSuccess,
  onNavigateToRepurpose,
  onSeekPlayer,
}: TranscriptTabProps) {
  // Transcripción activa local
  const [currentTranscript, setCurrentTranscript] = useState<VideoTranscript | null>(
    propTranscript?.videoId === metadata.videoId ? propTranscript : null
  );

  // Lista de idiomas disponibles consultados
  const [availableLanguages, setAvailableLanguages] = useState<AvailableCaptionTrack[]>([]);
  const [selectedLanguageCode, setSelectedLanguageCode] = useState<string>('');

  // Estados visuales del flujo
  const [uiState, setUiState] = useState<TranscriptUIState>(
    propTranscript?.videoId === metadata.videoId ? 'completed' : 'idle'
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filtro de búsqueda dentro del texto extraído
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);

  // Sincronizar estado cuando cambia el video o la transcripción según el patrón oficial de React
  const [prevVideoId, setPrevVideoId] = useState(metadata.videoId);
  const [prevPropTranscript, setPrevPropTranscript] = useState(propTranscript);

  if (metadata.videoId !== prevVideoId || propTranscript !== prevPropTranscript) {
    setPrevVideoId(metadata.videoId);
    setPrevPropTranscript(propTranscript);
    if (propTranscript && propTranscript.videoId === metadata.videoId) {
      setCurrentTranscript(propTranscript);
      setUiState('completed');
    } else {
      setCurrentTranscript(null);
      setAvailableLanguages([]);
      setSelectedLanguageCode('');
      setUiState('idle');
      setErrorMessage(null);
    }
  }


  // =========================================================================
  // PASO 1: Consultar idiomas disponibles del video
  // =========================================================================
  const handleConsultLanguages = async () => {
    setUiState('consulting_languages');
    setErrorMessage(null);
    try {
      const res = await fetch(`/api/youtube/transcript?videoId=${metadata.videoId}&action=languages`);
      const data = await res.json();

      if (!res.ok) {
        if (data.hasNoCaptions || res.status === 404) {
          setUiState('no_captions');
          setErrorMessage(
            data.error || 'Este video no cuenta con pistas de subtítulos disponibles en YouTube.'
          );
          return;
        }
        if (data.unavailable) {
          setUiState('unavailable');
          setErrorMessage(data.error || 'El video no está disponible o tiene restricciones.');
          return;
        }
        setUiState('error');
        setErrorMessage(data.error || 'Error al consultar idiomas de subtítulos.');
        return;
      }

      const tracks: AvailableCaptionTrack[] = data.languages || [];
      if (tracks.length === 0) {
        setUiState('no_captions');
        setErrorMessage('No se encontraron idiomas de subtítulos para este video.');
        return;
      }

      setAvailableLanguages(tracks);
      // Preseleccionar preferiblemente español ('es'), luego inglés ('en'), o el primer idioma
      const esTrack = tracks.find((t) => t.languageCode.startsWith('es'));
      const enTrack = tracks.find((t) => t.languageCode.startsWith('en'));
      const defaultTrack = esTrack || enTrack || tracks[0];
      setSelectedLanguageCode(defaultTrack.languageCode);

      setUiState('languages_found');
    } catch (err: unknown) {
      const e = err as Error;
      setUiState('error');
      setErrorMessage(e.message || 'Error de conexión al consultar los idiomas.');
    }
  };

  // =========================================================================
  // PASO 2: Extraer la transcripción en el idioma seleccionado
  // =========================================================================
  const handleExtractTranscript = async () => {
    if (!selectedLanguageCode) return;

    setUiState('extracting');
    setErrorMessage(null);
    try {
      const q = new URLSearchParams({
        videoId: metadata.videoId,
        lang: selectedLanguageCode,
      });

      const res = await fetch(`/api/youtube/transcript?${q.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        if (data.hasNoCaptions) {
          setUiState('no_captions');
        } else if (data.unavailable) {
          setUiState('unavailable');
        } else {
          setUiState('error');
        }
        setErrorMessage(data.error || 'Error al extraer los subtítulos del video.');
        return;
      }

      // Validar que la respuesta contenga segmentos válidos
      if (!data.segments || data.segments.length === 0) {
        setUiState('no_captions');
        setErrorMessage('La transcripción retornada no contiene texto legible.');
        return;
      }

      // Asociar nombre legible del idioma si está en la lista consultada
      const foundLang = availableLanguages.find((l) => l.languageCode === selectedLanguageCode);
      const enrichedTranscript: VideoTranscript = {
        ...data,
        languageName: foundLang?.languageName || data.languageName || selectedLanguageCode,
        isAutoGenerated: foundLang?.isAutoGenerated ?? data.isAutoGenerated ?? false,
      };

      setCurrentTranscript(enrichedTranscript);
      setUiState('completed');

      if (onTranscriptSuccess) {
        onTranscriptSuccess(enrichedTranscript);
      }
    } catch (err: unknown) {
      const e = err as Error;
      setUiState('error');
      setErrorMessage(e.message || 'Error de conexión al extraer la transcripción.');
    }
  };

  // Filtrado de segmentos por término de búsqueda
  const filteredSegments = useMemo(() => {
    if (!currentTranscript?.segments) return [];
    if (!searchQuery.trim()) return currentTranscript.segments;

    const query = searchQuery.toLowerCase();
    return currentTranscript.segments.filter((seg) =>
      seg.text.toLowerCase().includes(query)
    );
  }, [currentTranscript, searchQuery]);

  // =========================================================================
  // Acciones de copiado
  // =========================================================================
  const handleCopyAll = () => {
    if (!currentTranscript) return;
    navigator.clipboard.writeText(currentTranscript.fullText);
    setCopiedAll(true);
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopySegment = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 1500);
  };

  // Nombre de archivo sanitizado y descriptivo
  const getFileBaseName = () => {
    const cleanTitle = (metadata.title || 'video')
      .toLowerCase()
      .replace(/[^a-z0-9áéíóúñü]/gi, '-')
      .replace(/-+/g, '-')
      .slice(0, 40);
    const lang = currentTranscript?.language || selectedLanguageCode || 'es';
    return `${cleanTitle}-${metadata.videoId}-${lang}`;
  };

  // =========================================================================
  // Descargas en formatos TXT, SRT y VTT
  // =========================================================================
  const handleDownloadTxt = () => {
    if (!currentTranscript) return;
    const cleanText = segmentsToPlainText(currentTranscript.segments);
    const blob = new Blob([cleanText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `transcripcion-${getFileBaseName()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadSrt = () => {
    if (!currentTranscript) return;
    const srtContent = segmentsToSrt(currentTranscript.segments);
    const blob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subtitulos-${getFileBaseName()}.srt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDownloadVtt = () => {
    if (!currentTranscript) return;
    const vttContent = segmentsToVtt(currentTranscript.segments);
    const blob = new Blob([vttContent], { type: 'text/vtt;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `subtitulos-${getFileBaseName()}.vtt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // =========================================================================
  // RENDER: Estados visuales según especificación
  // =========================================================================

  // 1. Estado: Consultando idiomas disponibles
  if (uiState === 'consulting_languages') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#2848F0] dark:text-rose-500" />
        <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
          Consultando idiomas de subtítulos disponibles...
        </h3>
        <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md">
          Identificando pistas oficiales manuales y de reconocimiento automático en YouTube.
        </p>
      </div>
    );
  }

  // 2. Estado: Extrayendo transcripción
  if (uiState === 'extracting') {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-[#2848F0] dark:text-rose-500" />
        <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
          Extrayendo transcripción ({selectedLanguageCode.toUpperCase()})...
        </h3>
        <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md">
          Obteniendo segmentos de texto reales y sincronizando marcas de tiempo exactas.
        </p>
      </div>
    );
  }

  // 3. Estado: Video sin subtítulos
  if (uiState === 'no_captions') {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50/70 dark:border-amber-900/40 dark:bg-amber-950/20 p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-amber-600 dark:text-amber-400 shadow-2xs border border-amber-200 dark:border-amber-900/50">
          <Ban className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300 font-heading">
            Video sin subtítulos disponibles
          </h3>
          <p className="text-xs text-amber-800/80 dark:text-amber-400/80 max-w-lg mx-auto leading-relaxed">
            {errorMessage ||
              'Este video no cuenta con pistas de subtítulos manuales ni automáticas activadas en YouTube por su creador.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            onClick={handleConsultLanguages}
            className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-white hover:bg-amber-50 dark:border-amber-800 dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-amber-900 dark:text-amber-200 transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Volver a verificar</span>
          </button>
          <button
            onClick={onNavigateToRepurpose}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Generar contenido con metadatos</span>
          </button>
        </div>
      </div>
    );
  }

  // 4. Estado: Video restringido o no disponible
  if (uiState === 'unavailable') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/20 p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs border border-rose-200 dark:border-rose-900/50">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-300 font-heading">
            Video restringido o no disponible
          </h3>
          <p className="text-xs text-rose-800/80 dark:text-rose-400/80 max-w-lg mx-auto leading-relaxed">
            {errorMessage ||
              'El video puede ser privado, no listado, bloqueado por región o protegido por derechos de autor.'}
          </p>
        </div>
        <button
          onClick={handleConsultLanguages}
          className="inline-flex items-center gap-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span>Reintentar comprobación</span>
        </button>
      </div>
    );
  }

  // 5. Estado: Error de extracción
  if (uiState === 'error') {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50/70 dark:border-rose-900/40 dark:bg-rose-950/20 p-8 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-rose-600 dark:text-rose-400 shadow-2xs border border-rose-200 dark:border-rose-900/50">
          <AlertCircle className="h-6 w-6" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-rose-900 dark:text-rose-300 font-heading">
            Ocurrió un error al procesar la transcripción
          </h3>
          <p className="text-xs text-rose-800/80 dark:text-rose-400/80 max-w-lg mx-auto leading-relaxed">
            {errorMessage || 'No fue posible completar la operación en este momento.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
          <button
            onClick={availableLanguages.length > 0 ? handleExtractTranscript : handleConsultLanguages}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-4 py-2 text-xs font-semibold text-white shadow-2xs transition-colors cursor-pointer"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Reintentar extracción</span>
          </button>
          <button
            onClick={() => setUiState('idle')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-300 bg-white hover:bg-neutral-50 dark:border-slate-700 dark:bg-slate-900 px-4 py-2 text-xs font-semibold text-[#121111] dark:text-slate-200 transition-colors cursor-pointer"
          >
            <span>Volver al inicio</span>
          </button>
        </div>
      </div>
    );
  }

  // 6. Estado: Inicial (Idle) - Ofrecer consultar idiomas disponibles
  if (uiState === 'idle') {
    return (
      <div className="rounded-2xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-10 text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white dark:bg-slate-900 text-[#5B5B66] dark:text-slate-400 shadow-2xs border border-neutral-200 dark:border-slate-800">
          <Volume2 className="h-6 w-6 text-[#2848F0] dark:text-rose-500" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
            Extractor oficial de transcripciones y subtítulos
          </h3>
          <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md mx-auto">
            Consulta los idiomas disponibles para &quot;{metadata.title}&quot; y extrae los subtítulos sincronizados.
          </p>
        </div>
        <div className="pt-2">
          <button
            onClick={handleConsultLanguages}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
          >
            <Languages className="h-4 w-4" />
            <span>Consultar idiomas disponibles</span>
          </button>
        </div>
      </div>
    );
  }

  // 7. Estado: Idiomas encontrados - Mostrar selector y botón de extracción
  if (uiState === 'languages_found') {
    return (
      <div className="rounded-2xl border border-neutral-200/90 bg-white dark:border-slate-800 dark:bg-slate-900/60 p-6 sm:p-8 space-y-6 shadow-xs max-w-2xl mx-auto">
        <div className="flex items-center gap-3 border-b border-neutral-100 dark:border-slate-800 pb-4">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-[#2848F0] dark:bg-rose-950/40 dark:text-rose-400 border border-blue-200/60 dark:border-rose-900/50">
            <Languages className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#121111] dark:text-slate-100 font-heading">
              Idiomas encontrados ({availableLanguages.length})
            </h3>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400">
              Selecciona el idioma deseado para extraer los subtítulos del video.
            </p>
          </div>
        </div>

        {/* Selector de idiomas */}
        <div className="space-y-2">
          <label className="text-xs font-semibold text-[#121111] dark:text-slate-200 block">
            Pista de subtítulos disponible:
          </label>
          <div className="relative">
            <select
              value={selectedLanguageCode}
              onChange={(e) => setSelectedLanguageCode(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-[#FAFAFA] dark:border-slate-700 dark:bg-slate-900 py-3 px-4 text-xs sm:text-sm text-[#121111] dark:text-slate-100 focus:border-[#2848F0] dark:focus:border-rose-500 focus:outline-none shadow-2xs cursor-pointer"
            >
              {availableLanguages.map((lang, idx) => (
                <option key={`${lang.languageCode}-${idx}`} value={lang.languageCode}>
                  {lang.languageName} [{lang.languageCode.toUpperCase()}] —{' '}
                  {lang.isAutoGenerated ? 'Generado automáticamente' : 'Oficial del creador'}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Resumen de la pista seleccionada */}
        {selectedLanguageCode && (
          <div className="p-3 rounded-xl bg-neutral-50 dark:bg-slate-800/40 border border-neutral-200/70 dark:border-slate-700/60 flex items-center justify-between text-xs">
            <span className="text-[#5B5B66] dark:text-slate-400">Tipo de pista:</span>
            <span className="font-semibold text-[#121111] dark:text-slate-200 flex items-center gap-1.5">
              {availableLanguages.find((l) => l.languageCode === selectedLanguageCode)?.isAutoGenerated ? (
                <>
                  <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" />
                  <span>Reconocimiento automático de YouTube (ASR)</span>
                </>
              ) : (
                <>
                  <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
                  <span>Subtítulo manual oficial</span>
                </>
              )}
            </span>
          </div>
        )}

        {/* Botón de acción: Extraer transcripción */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-3 pt-2">
          <button
            type="button"
            onClick={handleConsultLanguages}
            className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 text-xs font-semibold text-[#5B5B66] dark:text-slate-300 transition-colors cursor-pointer"
          >
            Volver a escanear
          </button>
          <button
            type="button"
            onClick={handleExtractTranscript}
            disabled={!selectedLanguageCode}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-6 py-2.5 text-xs font-bold text-white shadow-xs hover:shadow-md transition-all cursor-pointer disabled:opacity-50"
          >
            <CheckCircle2 className="h-4 w-4" />
            <span>Extraer Transcripción</span>
          </button>
        </div>
      </div>
    );
  }

  // 8. Estado: Extracción completada (Completed)
  if (!currentTranscript) return null;

  return (
    <div className="space-y-6">
      {/* Barra de herramientas superior */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 border-b border-neutral-200/80 dark:border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-[#121111] dark:text-slate-100 font-heading">
              Transcripción y Subtítulos
            </h2>
            <span className="text-xs text-[#5B5B66] dark:text-slate-400">
              ({currentTranscript.segments.length} segmentos · Idioma:{' '}
              {currentTranscript.languageName || currentTranscript.language.toUpperCase()})
            </span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span
              className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ${
                currentTranscript.isAutoGenerated
                  ? 'bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-200 dark:border-amber-800/40'
                  : 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40'
              }`}
            >
              {currentTranscript.isAutoGenerated
                ? 'Reconocimiento automático de YouTube'
                : 'Pista oficial de subtítulos del creador'}
            </span>

            {/* Botón para cambiar idioma si hay más disponibles */}
            <button
              onClick={handleConsultLanguages}
              className="text-xs text-[#2848F0] hover:underline dark:text-rose-400 font-medium cursor-pointer ml-1"
            >
              Cambiar idioma
            </button>
          </div>
        </div>

        {/* Acciones de exportación y reempaquetado */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Copiar todo */}
          <button
            onClick={handleCopyAll}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-[#121111] dark:text-slate-200 hover:bg-white dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
          >
            {copiedAll ? (
              <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            <span>{copiedAll ? 'Copiada' : 'Copiar todo'}</span>
          </button>

          {/* Descargar TXT */}
          <button
            onClick={handleDownloadTxt}
            className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-[#5B5B66] dark:text-slate-300 hover:text-[#121111] hover:bg-white dark:hover:text-white transition-colors shadow-2xs cursor-pointer"
            title="Descargar texto limpio sin marcas de tiempo (.txt)"
          >
            <FileText className="h-3.5 w-3.5 text-blue-500" />
            <span>.TXT</span>
          </button>

          {/* Descargar SRT */}
          <button
            onClick={handleDownloadSrt}
            className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-[#5B5B66] dark:text-slate-300 hover:text-[#121111] hover:bg-white dark:hover:text-white transition-colors shadow-2xs cursor-pointer"
            title="Descargar subtítulos numerados con tiempo (.srt)"
          >
            <FileDown className="h-3.5 w-3.5 text-emerald-500" />
            <span>.SRT</span>
          </button>

          {/* Descargar VTT */}
          <button
            onClick={handleDownloadVtt}
            className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-[#5B5B66] dark:text-slate-300 hover:text-[#121111] hover:bg-white dark:hover:text-white transition-colors shadow-2xs cursor-pointer"
            title="Descargar formato WebVTT (.vtt)"
          >
            <FileDown className="h-3.5 w-3.5 text-purple-500" />
            <span>.VTT</span>
          </button>

          {/* Repurposing */}
          <button
            onClick={onNavigateToRepurpose}
            className="flex items-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-4 py-2 text-xs font-bold text-white shadow-xs hover:shadow-md transition-all ml-auto sm:ml-0 cursor-pointer"
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Crear Contenido con IA</span>
          </button>
        </div>
      </div>

      {/* Buscador de términos dentro de la transcripción */}
      <div className="relative max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[#5B5B66] dark:text-slate-500">
          <Search className="h-4 w-4" />
        </div>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar palabras o frases en el audio..."
          className="w-full rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900/80 py-2.5 pl-9 pr-4 text-xs text-[#121111] dark:text-slate-200 placeholder-[#5B5B66]/70 focus:border-[#2848F0] dark:focus:border-rose-500 focus:outline-none shadow-xs"
        />
        {searchQuery && (
          <div className="absolute right-3 top-2.5 text-[11px] font-mono text-[#5B5B66] dark:text-slate-400 tabular-nums">
            {filteredSegments.length} coincidencias
          </div>
        )}
      </div>

      {/* Lista sincronizada de segmentos */}
      <div className="rounded-2xl border border-neutral-200/90 bg-white p-4 max-h-[550px] overflow-y-auto space-y-1 divide-y divide-neutral-100 shadow-xs dark:border-slate-800 dark:bg-slate-900/40 dark:divide-slate-800/40">
        {filteredSegments.length > 0 ? (
          filteredSegments.map((seg, idx) => (
            <div
              key={idx}
              className="group flex items-start gap-4 pt-2.5 pb-2.5 px-2.5 rounded-xl hover:bg-[#FAFAFA] dark:hover:bg-slate-800/40 transition-colors"
            >
              {/* Timestamp clickeable */}
              <button
                onClick={() => onSeekPlayer && onSeekPlayer(seg.start)}
                className="shrink-0 flex items-center gap-1 font-mono text-xs font-bold text-[#2848F0] hover:underline dark:text-rose-400 dark:hover:text-rose-300 tabular-nums mt-0.5 cursor-pointer"
                title="Hacer clic para saltar al momento en el reproductor"
              >
                <Clock className="h-3 w-3" />
                <span>{formatDuration(seg.start)}</span>
              </button>

              {/* Texto del segmento */}
              <div className="flex-1 text-xs text-[#121111] dark:text-slate-200 leading-relaxed">
                {seg.text}
              </div>

              {/* Botón copiar fragmento */}
              <button
                onClick={() => handleCopySegment(seg.text, idx)}
                className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200 rounded cursor-pointer"
                title="Copiar frase"
              >
                {copiedIndex === idx ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </button>
            </div>
          ))
        ) : (
          <div className="py-8 text-center text-xs text-[#5B5B66] dark:text-slate-500">
            No se encontraron fragmentos que coincidan con &quot;{searchQuery}&quot;.
          </div>
        )}
      </div>
    </div>
  );
}
