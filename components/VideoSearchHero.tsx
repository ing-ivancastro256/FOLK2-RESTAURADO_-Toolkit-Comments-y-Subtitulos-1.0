'use client';

import React, { useState } from 'react';
import { Search, Clipboard, Loader2, ArrowRight, AlertCircle, RotateCcw, X } from 'lucide-react';
import { extractYouTubeVideoId } from '@/lib/youtube';

interface VideoSearchHeroProps {
  onAnalyze: (videoId: string) => Promise<void>;
  isLoading: boolean;
  currentVideoId?: string;
  onReset?: () => void;
}

const PRESET_VIDEOS = [
  {
    label: 'Redes Neuronales (3Blue1Brown)',
    url: 'https://www.youtube.com/watch?v=aircAruvnKk',
    id: 'aircAruvnKk',
  },
  {
    label: 'Curso de Python (Mosh)',
    url: 'https://www.youtube.com/watch?v=kqtD5dpn9C8',
    id: 'kqtD5dpn9C8',
  },
  {
    label: 'Steve Jobs 2005 Stanford Speech',
    url: 'https://www.youtube.com/watch?v=UF8uR6Z6KLc',
    id: 'UF8uR6Z6KLc',
  },
];

export function VideoSearchHero({
  onAnalyze,
  isLoading,
  currentVideoId,
  onReset,
}: VideoSearchHeroProps) {
  const [inputUrl, setInputUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const videoId = extractYouTubeVideoId(inputUrl);

    if (!videoId) {
      setError(
        'Por favor introduce un enlace válido de YouTube (ej: https://www.youtube.com/watch?v=... o youtu.be/...)'
      );
      return;
    }

    try {
      await onAnalyze(videoId);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message || 'Error al procesar el video');
    }
  };

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setInputUrl(text);
      const videoId = extractYouTubeVideoId(text);
      if (videoId) {
        setError(null);
        await onAnalyze(videoId);
      }
    } catch {
      setError('No se pudo acceder al portapapeles. Pega el enlace manualmente en el campo.');
    }
  };

  const handleSelectPreset = async (id: string, url: string) => {
    setInputUrl(url);
    setError(null);
    await onAnalyze(id);
  };

  const handleClear = () => {
    setInputUrl('');
    setError(null);
    if (onReset) onReset();
  };

  return (
    <div className="w-full border-b border-neutral-200/80 bg-gradient-to-b from-[#FAF9F7] via-white to-[#F5F5F5] dark:border-slate-800 dark:from-slate-900/60 dark:to-slate-950 py-10 px-4 sm:px-6 lg:px-8 transition-colors duration-200">
      <div className="mx-auto max-w-4xl text-center">
        <h1
          className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#121111] dark:text-white font-heading"
          style={{ textWrap: 'balance' }}
        >
          Analiza cualquier video de YouTube y crea contenido en segundos
        </h1>
        <p className="mt-2 text-sm text-[#5B5B66] dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Extracción real de metadatos oficiales, miniaturas en 1080p, transcripciones completas con timestamps y reempaquetado con IA.
        </p>

        {/* Formulario de búsqueda principal */}
        <form
          onSubmit={handleSubmit}
          className="mt-7 flex flex-col sm:flex-row items-center gap-2.5 max-w-2xl mx-auto"
        >
          <div className="relative w-full shadow-xs">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-[#5B5B66] dark:text-slate-500">
              <Search className="h-4 w-4" />
            </div>
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => {
                setInputUrl(e.target.value);
                if (error) setError(null);
              }}
              placeholder="Pega un enlace de YouTube: https://www.youtube.com/watch?v=..."
              className="w-full rounded-xl border border-neutral-200 bg-white py-3 pl-10 pr-24 text-sm text-[#121111] placeholder-[#5B5B66]/70 focus:border-[#2848F0] focus:outline-none focus:ring-2 focus:ring-[#2848F0]/20 dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100 dark:placeholder-slate-500 dark:focus:border-rose-500 dark:focus:ring-rose-500/20 transition-all"
              disabled={isLoading}
            />

            <div className="absolute right-2 top-2 flex items-center gap-1">
              {inputUrl && (
                <button
                  type="button"
                  onClick={() => setInputUrl('')}
                  className="p-1.5 text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white"
                  title="Limpiar campo"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={handlePaste}
                disabled={isLoading}
                className="flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
                title="Pegar del portapapeles"
              >
                <Clipboard className="h-3.5 w-3.5" />
                <span>Pegar</span>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <button
              type="submit"
              disabled={isLoading || !inputUrl.trim()}
              className="w-full sm:w-auto flex items-center justify-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-6 py-3 text-sm font-semibold text-white shadow-sm hover:shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Analizando...</span>
                </>
              ) : (
                <>
                  <span>Inspeccionar</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>

            {currentVideoId && (
              <button
                type="button"
                onClick={handleClear}
                className="flex items-center justify-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 dark:border-slate-800 dark:bg-slate-900 px-3 py-3 text-xs font-medium text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-white transition-colors cursor-pointer shrink-0 shadow-2xs"
                title="Reiniciar y limpiar dashboard"
              >
                <RotateCcw className="h-4 w-4" />
                <span className="hidden md:inline">Reiniciar</span>
              </button>
            )}
          </div>
        </form>

        {/* Mensaje de error si ocurre */}
        {error && (
          <div className="mt-3.5 flex items-center justify-center gap-2 text-xs font-medium text-rose-600 dark:text-rose-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Videos de ejemplo para prueba rápida */}
        <div className="mt-5 flex flex-wrap items-center justify-center gap-2 text-xs">
          <span className="text-[#5B5B66] dark:text-slate-500">Ejemplos para probar:</span>
          {PRESET_VIDEOS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => handleSelectPreset(preset.id, preset.url)}
              disabled={isLoading}
              className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-all shadow-2xs cursor-pointer ${
                currentVideoId === preset.id
                  ? 'border-[#2848F0] bg-[#EEF1F8] text-[#2848F0] dark:border-rose-500/50 dark:bg-rose-950/40 dark:text-rose-300'
                  : 'border-neutral-200 bg-white text-[#5B5B66] hover:border-neutral-300 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:text-slate-200'
              }`}
            >
              {preset.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
