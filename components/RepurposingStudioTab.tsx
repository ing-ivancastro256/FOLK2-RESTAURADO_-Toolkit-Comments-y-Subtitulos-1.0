'use client';

import React, { useState } from 'react';
import {
  Sparkles,
  Copy,
  Check,
  Save,
  Loader2,
  Twitter,
  Linkedin,
  Film,
  Mail,
} from 'lucide-react';
import {
  RepurposedContentType,
  GeneratedContentItem,
  YouTubeVideoMetadata,
  VideoTranscript,
} from '@/lib/types';
import { formatDateSafe } from '@/lib/youtube';

interface RepurposingStudioTabProps {
  metadata: YouTubeVideoMetadata;
  transcript: VideoTranscript | null;
  savedDrafts: GeneratedContentItem[];
  onSaveToLibrary: (item: Omit<GeneratedContentItem, 'id'>) => Promise<void>;
}

const CONTENT_TYPES: {
  id: RepurposedContentType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  description: string;
}[] = [
  {
    id: 'shorts_script',
    label: 'Guion Short / Reel',
    icon: Film,
    description: 'Guion de 60s con gancho en 3s, cortes de cámara y llamada a la acción.',
  },
  {
    id: 'twitter_thread',
    label: 'Hilo de X (Twitter)',
    icon: Twitter,
    description: '5 a 7 publicaciones de alto valor diseñadas para retención y retuits.',
  },
  {
    id: 'linkedin_post',
    label: 'Post de LinkedIn',
    icon: Linkedin,
    description: 'Narrativa profesional con espaciado optimizado y preguntas de debate.',
  },
  {
    id: 'newsletter_summary',
    label: 'Boletín / Newsletter',
    icon: Mail,
    description: 'Resumen ejecutivo, puntos clave, cita destacada y aprendizajes clave.',
  },
];

const TONE_OPTIONS = [
  'Dinámico y persuasivo',
  'Educativo y claro',
  'Directo, conciso y audaz',
  'Cercano y amigable',
  'Analítico y profesional',
];

export function RepurposingStudioTab({
  metadata,
  transcript,
  savedDrafts,
  onSaveToLibrary,
}: RepurposingStudioTabProps) {
  const [selectedType, setSelectedType] = useState<RepurposedContentType>('shorts_script');
  const [selectedTone, setSelectedTone] = useState(TONE_OPTIONS[0]);
  const [customInstructions, setCustomInstructions] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleGenerate = async () => {
    if (!transcript?.fullText && !metadata.description) {
      setError('Se requiere una transcripción o descripción del video para procesar con IA.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setSavedSuccess(false);

    try {
      const res = await fetch('/api/gemini/repurpose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          videoTitle: metadata.title,
          transcriptText: transcript?.fullText || metadata.description,
          type: selectedType,
          tone: selectedTone,
          instructions: customInstructions,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Error al generar contenido con Gemini');
      }

      setGeneratedText(data.content);
    } catch (err: unknown) {
      const errorObj = err as Error;
      setError(errorObj.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(generatedText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSave = async () => {
    if (!generatedText) return;
    try {
      const typeLabel = CONTENT_TYPES.find((c) => c.id === selectedType)?.label || selectedType;
      await onSaveToLibrary({
        videoId: metadata.videoId,
        videoTitle: metadata.title,
        type: selectedType,
        title: `${typeLabel} — ${metadata.title.slice(0, 45)}...`,
        content: generatedText,
        modelUsed: 'gemini-3.8-flash',
        createdAt: Date.now(),
        isSaved: true,
      });
      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 3000);
    } catch (err: unknown) {
      const errObj = err as Error;
      setError(errObj.message);
    }
  };

  return (
    <div className="space-y-8">
      {/* Encabezado */}
      <div className="border-b border-neutral-200/80 dark:border-slate-800 pb-4">
        <h2 className="text-xl font-bold text-[#121111] dark:text-slate-100 font-heading">Estudio de Repurposing con IA</h2>
        <p className="text-xs text-[#5B5B66] dark:text-slate-400 mt-0.5">
          Transforma la transcripción real de este video en formatos listos para publicar mediante Gemini 3.8 Flash.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Panel izquierdo de configuración */}
        <div className="lg:col-span-5 space-y-5">
          {/* Selector de formato */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#121111] dark:text-slate-300 font-heading">
              1. Selecciona el formato:
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {CONTENT_TYPES.map((type) => {
                const IconComponent = type.icon;
                const isSelected = selectedType === type.id;
                return (
                  <button
                    key={type.id}
                    type="button"
                    onClick={() => setSelectedType(type.id)}
                    className={`flex flex-col items-start p-3.5 rounded-2xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#2848F0] bg-[#EEF1F8] text-[#121111] shadow-2xs dark:border-rose-500 dark:bg-rose-950/30 dark:text-white'
                        : 'border-neutral-200 bg-white text-[#5B5B66] hover:border-neutral-300 hover:bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-300 dark:hover:border-slate-700 dark:hover:bg-slate-900'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <IconComponent className={`h-4 w-4 ${isSelected ? 'text-[#2848F0] dark:text-rose-400' : 'text-[#5B5B66] dark:text-slate-400'}`} />
                      <span className="text-xs font-bold font-heading">{type.label}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-[#5B5B66] dark:text-slate-400 line-clamp-2 leading-relaxed">{type.description}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tono de comunicación */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#121111] dark:text-slate-300 font-heading">
              2. Tono de comunicación:
            </label>
            <select
              value={selectedTone}
              onChange={(e) => setSelectedTone(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2.5 text-xs font-medium text-[#121111] dark:text-slate-200 focus:border-[#2848F0] dark:focus:border-rose-500 focus:outline-none shadow-xs"
            >
              {TONE_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {/* Instrucciones adicionales opcionales */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#121111] dark:text-slate-300 font-heading">
              3. Instrucciones adicionales (opcional):
            </label>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="Ej: Incluye una mención al enlace en la descripción, enfatiza el segundo consejo..."
              rows={3}
              className="w-full rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 p-3 text-xs text-[#121111] dark:text-slate-200 placeholder-[#5B5B66]/70 dark:placeholder-slate-500 focus:border-[#2848F0] dark:focus:border-rose-500 focus:outline-none shadow-xs leading-relaxed"
            />
          </div>

          {/* Botón generar */}
          <button
            onClick={handleGenerate}
            disabled={isGenerating || (!transcript && !metadata.description)}
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 py-3 px-4 text-xs font-bold text-white shadow-xs hover:shadow-md disabled:opacity-50 disabled:pointer-events-none transition-all"
          >
            {isGenerating ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Generando con Gemini 3.8 Flash...</span>
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                <span>Generar Contenido</span>
              </>
            )}
          </button>

          {error && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 dark:border-rose-900/50 dark:bg-rose-950/30 p-3 text-xs font-medium text-rose-700 dark:text-rose-300">
              {error}
            </div>
          )}

          {/* Borradores previos para este video */}
          {savedDrafts.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-neutral-200/80 dark:border-slate-800">
              <span className="text-[11px] font-bold text-[#5B5B66] dark:text-slate-400 font-heading">
                Borradores creados para este video ({savedDrafts.length}):
              </span>
              <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {savedDrafts.map((draft) => (
                  <button
                    key={draft.id}
                    onClick={() => {
                      setGeneratedText(draft.content);
                      setSelectedType(draft.type);
                    }}
                    className="w-full text-left p-2.5 rounded-xl border border-neutral-200 bg-white hover:border-[#2848F0] hover:bg-[#FAFAFA] dark:border-slate-800/80 dark:bg-slate-900/40 dark:hover:bg-slate-800 dark:hover:border-slate-700 transition-all shadow-2xs"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-[#121111] dark:text-slate-200 truncate">{draft.title}</span>
                      <span className="text-[#5B5B66] dark:text-slate-500 font-mono text-[10px]">
                        {formatDateSafe(draft.createdAt)}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel derecho de resultado y edición */}
        <div className="lg:col-span-7 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-[#121111] dark:text-slate-300 font-heading">
              Resultado generado {generatedText && '(Editable)'}:
            </span>

            {generatedText && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-1.5 text-xs font-semibold text-[#121111] dark:text-slate-300 hover:bg-[#FAFAFA] dark:hover:bg-slate-800 transition-colors shadow-2xs"
                >
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>

                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-3.5 py-1.5 text-xs font-semibold text-white shadow-2xs transition-colors"
                >
                  {savedSuccess ? <Check className="h-3.5 w-3.5" /> : <Save className="h-3.5 w-3.5" />}
                  <span>{savedSuccess ? '¡Guardado!' : 'Guardar en Biblioteca'}</span>
                </button>
              </div>
            )}
          </div>

          <div className="relative rounded-2xl border border-neutral-200/90 bg-white shadow-xs dark:border-slate-800 dark:bg-slate-900/60 overflow-hidden min-h-[480px] flex flex-col">
            {generatedText ? (
              <textarea
                value={generatedText}
                onChange={(e) => setGeneratedText(e.target.value)}
                className="w-full flex-1 p-5 bg-transparent text-xs sm:text-sm text-[#121111] dark:text-slate-100 font-mono leading-relaxed resize-none focus:outline-none"
                placeholder="El contenido generado aparecerá aquí..."
              />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-[#5B5B66] dark:text-slate-500 space-y-3">
                <div className="h-12 w-12 rounded-2xl bg-[#FAFAFA] dark:bg-slate-950 flex items-center justify-center text-[#5B5B66] dark:text-slate-600 border border-neutral-200 dark:border-slate-800">
                  <Sparkles className="h-6 w-6 text-[#2848F0] dark:text-rose-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-[#121111] dark:text-slate-300 font-bold font-heading">No se ha generado contenido todavía</p>
                  <p className="text-xs text-[#5B5B66] dark:text-slate-500 max-w-sm">
                    Selecciona un formato en el panel izquierdo y pulsa &quot;Generar Contenido&quot; para iniciar la transformación.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
