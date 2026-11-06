'use client';

import React, { useState } from 'react';
import {
  ArrowLeft,
  Copy,
  Check,
  Download,
  FileText,
  Languages,
  Loader2,
  Sparkles,
  User,
  AlertCircle,
  Flame,
  HeartCrack,
  ShieldAlert,
  Compass,
  History,
  Quote,
  Target,
  DollarSign,
  TrendingUp,
  Clock,
  CheckCircle2,
  BookmarkCheck,
  ExternalLink,
} from 'lucide-react';
import { PauAnalysisResult } from '@/lib/types';
import { generatePauMarkdown } from '@/lib/pau-markdown';

/**
 * Parsea textos que puedan contener "[Traducción: ...]" o "(Traducción: ...)"
 * y separa la frase original de su versión en español latino.
 */
function parseBilingualContent(rawText?: string | null): { original: string; translation: string | null } {
  if (!rawText) return { original: '', translation: null };
  const trimmed = rawText.trim();
  const match = trimmed.match(
    /^(.*?)(?:\[(?:traducci[oó]n|trad):\s*["']?([^"'\]]+)["']?\]|\((?:traducci[oó]n|trad):\s*["']?([^"'\)]+)["']?\))/i
  );
  if (match) {
    const original = match[1].trim().replace(/^["']|["']$/g, '');
    const translation = (match[2] || match[3] || '').trim().replace(/^["']|["']$/g, '');
    return { original: original || trimmed, translation: translation || null };
  }
  return { original: trimmed, translation: null };
}

function isLikelyEnglish(text?: string | null): boolean {
  if (!text) return false;
  if (/traducci[oó]n/i.test(text)) return false;
  const englishWords = /\b(the|and|to|of|a|in|that|have|i|it|for|not|on|with|he|as|you|do|at|this|but|his|by|from|they|we|say|her|she|or|an|will|my|one|all|would|there|their|what|so|up|out|if|about|who|get|which|go|me|when|make|can|like|time|no|just|him|know|take|people|into|year|your|good|some|could|them|see|other|than|then|now|look|only|come|its|over|think|also|back|after|use|two|how|our|work|first|well|way|even|new|want|because|any|these|give|day|most|us)\b/gi;
  const matches = text.match(englishWords);
  return matches !== null && matches.length >= 2;
}

/**
 * Renderiza un texto en línea mostrando la frase original y, a su costado,
 * la traducción al español latino destacada.
 */
function BilingualInlineText({ text, className = '' }: { text: string; className?: string }) {
  const { original, translation } = parseBilingualContent(text);

  if (!translation) {
    return <span className={className}>{text}</span>;
  }

  return (
    <span className={`inline-flex flex-wrap items-baseline gap-1.5 leading-relaxed ${className}`}>
      <span>{original}</span>
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/40 text-emerald-900 dark:text-emerald-200 border border-emerald-200/70 dark:border-emerald-800/40 text-[11px] font-normal not-italic shadow-2xs">
        <Languages className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
        <strong className="text-[9px] uppercase tracking-wider text-emerald-700 dark:text-emerald-400 font-bold">
          ES Latino:
        </strong>
        <span>&quot;{translation}&quot;</span>
      </span>
    </span>
  );
}

interface PauContinuousViewProps {
  result: PauAnalysisResult;
  videoTitle?: string;
  videoId?: string;
  onBack: () => void;
  backButtonText?: string;
}

export function PauContinuousView({
  result,
  videoTitle,
  videoId,
  onBack,
  backButtonText = 'Volver al video y comentarios',
}: PauContinuousViewProps) {
  const [selectedPauIdeas, setSelectedPauIdeas] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(`selected_pau_ideas_${videoId || 'global'}`);
      if (stored) {
        try {
          return new Set(JSON.parse(stored));
        } catch {
          // ignore
        }
      }
    }
    return new Set();
  });
  const [pauActionToast, setPauActionToast] = useState<string | null>(null);
  const [quoteTranslations, setQuoteTranslations] = useState<Record<number, string>>({});
  const [translatingIndex, setTranslatingIndex] = useState<number | null>(null);

  const showToast = (msg: string) => {
    setPauActionToast(msg);
    setTimeout(() => {
      setPauActionToast(null);
    }, 2600);
  };

  const handleDownloadMarkdown = () => {
    try {
      const currentVideoTitle = videoTitle || result.videoTitle || 'Video';
      const mdContent = generatePauMarkdown(result, {
        videoTitle: currentVideoTitle,
        videoId: videoId || result.videoId,
        modelUsed: (result as any).modelUsed,
      });

      const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (currentVideoTitle || 'analisis-pau')
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñü_-]/gi, '_')
        .replace(/_+/g, '_')
        .slice(0, 50);
      link.download = `analisis-pau-${safeTitle}-${Date.now()}.md`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Archivo Markdown (.md) descargado con éxito');
    } catch (err) {
      console.error('Error generando markdown:', err);
      showToast('Error al generar archivo Markdown');
    }
  };

  const handleTranslateQuote = async (rawQuote: string, index: number) => {
    setTranslatingIndex(index);
    try {
      const res = await fetch('/api/gemini/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawQuote }),
      });
      const data = await res.json();
      if (data.success && data.translation) {
        setQuoteTranslations((prev) => ({
          ...prev,
          [index]: data.translation,
        }));
        showToast('Traducción al español latino lista');
      } else {
        showToast('No se pudo traducir la cita');
      }
    } catch (err) {
      console.error('Error traduciendo cita:', err);
      showToast('Error de red al traducir');
    } finally {
      setTranslatingIndex(null);
    }
  };

  const handleDownloadJson = () => {
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `analisis-pau-${videoId || 'video'}-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Archivo JSON descargado con éxito');
  };

  const handleToggleSelectPau = (ideaName: string) => {
    const updated = new Set(selectedPauIdeas);
    if (updated.has(ideaName)) {
      updated.delete(ideaName);
      showToast(`PAU "${ideaName}" desmarcado`);
    } else {
      updated.add(ideaName);
      showToast(`PAU "${ideaName}" seleccionado para desarrollo`);
    }
    setSelectedPauIdeas(updated);
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `selected_pau_ideas_${videoId || 'global'}`,
        JSON.stringify(Array.from(updated))
      );
    }
  };

  const {
    meta,
    avatar,
    problema_principal,
    urgencia_general,
    emocion_raiz,
    dolores = [],
    miedos = [],
    deseos = [],
    que_ha_intentado = [],
    voz_del_cliente = [],
    ideas_pau = [],
    recomendacion_final,
  } = result;

  const currentVideoTitle = videoTitle || result.videoTitle || 'Video de YouTube';
  const currentVideoId = videoId || result.videoId;

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Toast flotante */}
      {pauActionToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-[#1C1C1C] dark:bg-slate-800 text-white px-4 py-3 text-xs font-semibold shadow-xl border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{pauActionToast}</span>
        </div>
      )}

      {/* CABECERA SUPERIOR STICKY CON ACCIONES */}
      <div className="sticky top-0 z-30 -mx-4 sm:-mx-6 -mt-6 p-4 sm:p-6 bg-white/95 dark:bg-slate-950/95 backdrop-blur-md border-b border-neutral-200/90 dark:border-slate-800 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-3.5 py-1.5 text-xs font-bold text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800 transition-colors shadow-2xs cursor-pointer"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>{backButtonText}</span>
            </button>
            <span className="text-xs font-bold text-[#2848F0] dark:text-blue-400 flex items-center gap-1">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Detector PAU</span>
            </span>
          </div>

          <h1 className="text-base sm:text-lg font-bold text-[#121111] dark:text-white font-heading line-clamp-1">
            Análisis de Voice of Customer (VOC) & Productos de Alta Utilidad
          </h1>

          <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B5B66] dark:text-slate-400">
            <span className="font-medium text-[#121111] dark:text-slate-300 max-w-sm sm:max-w-md truncate">
              {currentVideoTitle}
            </span>
            <span>·</span>
            <span className="font-mono tabular-nums">
              {meta?.comentarios_analizados || 0} comentarios analizados
            </span>
            {meta?.comentarios_descartados !== undefined && (
              <>
                <span>·</span>
                <span className="font-mono tabular-nums text-[#5B5B66] dark:text-slate-500">
                  {meta.comentarios_descartados} descartados (spam/cortos)
                </span>
              </>
            )}
          </div>
        </div>

        {/* Botones de acción (Descargar .md y Descargar .JSON) */}
        <div className="flex items-center gap-2 shrink-0 self-start md:self-auto">
          <button
            type="button"
            onClick={handleDownloadMarkdown}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-neutral-50 px-3.5 py-2 text-xs font-bold text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
            title="Descargar análisis completo en formato Markdown (.md)"
          >
            <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
            <span>Descargar .md</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadJson}
            className="flex items-center gap-1.5 rounded-xl bg-[#1C1C1C] hover:bg-[#2E2E2E] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-3.5 py-2 text-xs font-semibold transition-colors cursor-pointer shadow-2xs"
            title="Descargar archivo JSON completo"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Descargar .JSON</span>
          </button>
        </div>
      </div>

      {/* BLOQUE 1: FICHA DEL CLIENTE IDEAL Y AVATAR */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-200/80 dark:border-slate-800 pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-blue-100 text-[#2848F0] dark:bg-blue-950 dark:text-blue-300">
            <User className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-bold text-[#121111] dark:text-white font-heading uppercase tracking-wider">
            1. Perfil del Cliente Ideal & Avatar
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Tarjeta Avatar */}
          <div className="md:col-span-2 rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#2848F0] dark:text-blue-400 font-heading uppercase tracking-wider">
                AVATAR IDENTIFICADO
              </span>
              <span className="text-xs font-semibold text-[#5B5B66] dark:text-slate-400 font-mono">
                {avatar?.edad_aproximada ? `Edad aprox: ${avatar.edad_aproximada}` : 'Perfil representativo'}
              </span>
            </div>
            <h3 className="text-base font-bold text-[#121111] dark:text-white font-heading">
              {avatar?.nombre_ficticio || 'Buscador Activo de Soluciones'}
            </h3>
            <p className="text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed">
              {avatar?.situacion_actual || 'Situación actual identificada en los comentarios del video.'}
            </p>

            {avatar?.que_quiere_conseguir && (
              <div className="pt-2 border-t border-neutral-100 dark:border-slate-800/80 text-xs text-[#5B5B66] dark:text-slate-300">
                <strong className="text-[#121111] dark:text-white">Lo que busca lograr: </strong>
                <span>{avatar.que_quiere_conseguir}</span>
              </div>
            )}

            {avatar?.que_lo_bloquea && avatar.que_lo_bloquea.length > 0 && (
              <div className="text-xs text-[#5B5B66] dark:text-slate-300">
                <strong className="text-[#121111] dark:text-white">Qué lo bloquea: </strong>
                <span>{avatar.que_lo_bloquea.join(', ')}</span>
              </div>
            )}
          </div>

          {/* Tarjeta Nivel de Conciencia */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-3 flex flex-col justify-between">
            <div>
              <span className="text-[11px] font-bold text-[#2848F0] dark:text-blue-400 font-heading uppercase tracking-wider">
                NIVEL DE CONCIENCIA
              </span>
              {(() => {
                const lvl = Number(avatar?.nivel_conciencia) || 3;
                return (
                  <>
                    <div className="flex items-baseline gap-2 mt-2">
                      <span className="text-3xl font-extrabold text-[#121111] dark:text-white font-heading tabular-nums">
                        {lvl}/5
                      </span>
                      <span className="text-xs font-semibold text-[#5B5B66] dark:text-slate-400">
                        {lvl === 1 && 'Inconsciente del problema'}
                        {lvl === 2 && 'Consciente del problema'}
                        {lvl === 3 && 'Consciente de la solución'}
                        {lvl === 4 && 'Consciente del producto'}
                        {lvl === 5 && 'Muy consciente'}
                      </span>
                    </div>

                    {/* Barra de progreso visual */}
                    <div className="w-full bg-neutral-100 dark:bg-slate-800 h-2 rounded-full overflow-hidden mt-3">
                      <div
                        className="bg-[#2848F0] h-full rounded-full transition-all duration-500"
                        style={{ width: `${(lvl / 5) * 100}%` }}
                      />
                    </div>
                  </>
                );
              })()}
            </div>

            <p className="text-[11px] text-[#5B5B66] dark:text-slate-400 leading-relaxed">
              Mide la claridad del avatar sobre su necesidad y receptividad hacia una solución empaquetada.
            </p>
          </div>
        </div>

        {/* Frase característica del avatar */}
        {avatar?.frase_caracteristica && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4.5 dark:border-amber-900/40 dark:bg-amber-950/20 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1 w-full">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 font-heading">
                Frase Característica Detectada
              </span>
              <div className="text-xs text-amber-800/90 dark:text-amber-400/90 leading-relaxed font-medium">
                &quot;<BilingualInlineText text={avatar.frase_caracteristica} />&quot;
              </div>
            </div>
          </div>
        )}
      </section>

      {/* BLOQUE 2: PROBLEMA PRINCIPAL Y TERMÓMETRO EMOCIONAL */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-200/80 dark:border-slate-800 pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-red-100 text-red-600 dark:bg-red-950 dark:text-red-300">
            <Flame className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-bold text-[#121111] dark:text-white font-heading uppercase tracking-wider">
            2. Problema Principal & Termómetro de Urgencia
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Tarjeta del Problema Central */}
          <div className="lg:col-span-2 rounded-2xl border-2 border-red-200/80 bg-red-50/30 p-6 dark:border-red-900/40 dark:bg-red-950/20 shadow-xs space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-red-700 dark:text-red-400 font-heading uppercase">
                  PROBLEMA RAÍZ DETECTADO
                </span>
                {problema_principal?.frecuencia && (
                  <span className="text-xs font-mono px-2 py-0.5 rounded-md bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-300">
                    Frecuencia: {problema_principal.frecuencia}
                    {problema_principal.menciones_estimadas ? ` (${problema_principal.menciones_estimadas} menciones)` : ''}
                  </span>
                )}
              </div>
              <h3 className="text-lg font-bold text-[#121111] dark:text-white font-heading leading-snug">
                {problema_principal?.titulo || problema_principal?.descripcion || 'Bloqueo crítico detectado'}
              </h3>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-[#121111] dark:text-slate-200 font-heading">
                Descripción del Bloqueo:
              </span>
              <p className="text-xs text-[#5B5B66] dark:text-slate-300 leading-relaxed">
                {problema_principal?.descripcion || 'Pérdida considerable de tiempo, frustración o parálisis operativa.'}
              </p>
            </div>

            {problema_principal?.por_que_es_prioritario && (
              <div className="space-y-1 bg-white/70 dark:bg-slate-900/60 p-3.5 rounded-xl border border-red-100 dark:border-red-900/30">
                <span className="text-[11px] font-bold text-red-900 dark:text-red-300 font-heading">
                  ¿Por qué es prioritario resolverlo?
                </span>
                <p className="text-xs text-red-950/80 dark:text-slate-300 leading-relaxed">
                  {problema_principal.por_que_es_prioritario}
                </p>
              </div>
            )}

            {problema_principal?.evidencia && problema_principal.evidencia.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-red-200/50 dark:border-red-900/30">
                <span className="text-[11px] font-bold text-red-900 dark:text-red-300 font-heading">
                  Evidencias observadas:
                </span>
                <ul className="list-disc list-inside text-xs text-red-950/80 dark:text-slate-300 space-y-1.5">
                  {problema_principal.evidencia.slice(0, 5).map((ev, i) => (
                    <li key={i}>
                      <BilingualInlineText text={ev} />
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Tarjetas de Medidores de Urgencia y Emoción */}
          <div className="space-y-4">
            {/* Medidor de Urgencia General */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#121111] dark:text-white font-heading">
                  Nivel de Urgencia
                </span>
                <span className="text-xs font-bold text-red-600 dark:text-red-400 font-mono tabular-nums">
                  {urgencia_general?.nivel || problema_principal?.urgencia || 8}/10
                </span>
              </div>
              <div className="w-full bg-neutral-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                <div
                  className="bg-red-500 h-full rounded-full transition-all duration-500"
                  style={{ width: `${Math.min(100, ((urgencia_general?.nivel || problema_principal?.urgencia || 8) / 10) * 100)}%` }}
                />
              </div>
              <p className="text-[11px] text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                {urgencia_general?.explicacion || 'Alta necesidad de resolverlo pronto.'}
              </p>
              {urgencia_general?.senales && urgencia_general.senales.length > 0 && (
                <div className="pt-2 border-t border-neutral-100 dark:border-slate-800 text-[11px] text-[#5B5B66] dark:text-slate-400">
                  <strong>Señales:</strong> {urgencia_general.senales.slice(0, 2).join(' · ')}
                </div>
              )}
            </div>

            {/* Emoción Raíz */}
            <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#121111] dark:text-white font-heading">
                  Emoción Motora Raíz
                </span>
                <span className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase font-mono">
                  {emocion_raiz?.intensidad || problema_principal?.intensidad || 8}/10
                </span>
              </div>
              <h4 className="text-base font-bold text-purple-700 dark:text-purple-300 font-heading">
                {emocion_raiz?.emocion_dominante || 'Frustración y Sobrecarga'}
              </h4>
              <p className="text-[11px] text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                {emocion_raiz?.explicacion || 'Sensación de estancamiento ante la complejidad técnica o falta de método.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* BLOQUE 3: MATRIZ DE DOLORES, MIEDOS, DESEOS Y SOLUCIONES INTENTADAS */}
      <section className="space-y-4">
        <div className="flex items-center gap-2 border-b border-neutral-200/80 dark:border-slate-800 pb-2">
          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
            <Compass className="h-3.5 w-3.5" />
          </span>
          <h2 className="text-sm font-bold text-[#121111] dark:text-white font-heading uppercase tracking-wider">
            3. Matriz de Dolores, Miedos, Deseos & Soluciones Intentadas
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Dolores Actuales */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <HeartCrack className="h-4 w-4" />
              <h3 className="text-xs font-bold font-heading uppercase">
                Dolores Actuales en los Comentarios
              </h3>
            </div>
            {dolores.length === 0 ? (
              <p className="text-xs text-[#5B5B66] italic">No se registraron dolores específicos.</p>
            ) : (
              <ul className="space-y-2 text-xs text-[#5B5B66] dark:text-slate-300">
                {dolores.map((d, i) => (
                  <li key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-red-500 font-bold mt-0.5">•</span>
                    <BilingualInlineText text={d} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Miedos al Futuro */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-4 w-4" />
              <h3 className="text-xs font-bold font-heading uppercase">
                Miedos si el Problema Continúa
              </h3>
            </div>
            {miedos.length === 0 ? (
              <p className="text-xs text-[#5B5B66] italic">No se registraron temores explícitos.</p>
            ) : (
              <ul className="space-y-2 text-xs text-[#5B5B66] dark:text-slate-300">
                {miedos.map((m, i) => (
                  <li key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-amber-500 font-bold mt-0.5">•</span>
                    <BilingualInlineText text={m} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Deseos Profundos */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Target className="h-4 w-4" />
              <h3 className="text-xs font-bold font-heading uppercase">
                Deseos y Resultados Esperados
              </h3>
            </div>
            {deseos.length === 0 ? (
              <p className="text-xs text-[#5B5B66] italic">No se detectaron deseos claros.</p>
            ) : (
              <ul className="space-y-2 text-xs text-[#5B5B66] dark:text-slate-300">
                {deseos.map((ds, i) => (
                  <li key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-emerald-500 font-bold mt-0.5">•</span>
                    <BilingualInlineText text={ds} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Soluciones ya Intentadas */}
          <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-3">
            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
              <History className="h-4 w-4" />
              <h3 className="text-xs font-bold font-heading uppercase">
                Qué han Intentado Hacer Antes
              </h3>
            </div>
            {que_ha_intentado.length === 0 ? (
              <p className="text-xs text-[#5B5B66] italic">No hay soluciones previas mencionadas.</p>
            ) : (
              <ul className="space-y-2 text-xs text-[#5B5B66] dark:text-slate-300">
                {que_ha_intentado.map((qi, i) => (
                  <li key={i} className="flex items-start gap-2 leading-relaxed">
                    <span className="text-blue-500 font-bold mt-0.5">•</span>
                    <BilingualInlineText text={qi} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* BLOQUE 4: LA VOZ DEL CLIENTE (CITAS VERIFICADAS) */}
      <section className="space-y-4">
        <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300">
              <Quote className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-bold text-[#121111] dark:text-white font-heading uppercase tracking-wider">
              4. La Voz del Cliente (Citas Literales Verificadas)
            </h2>
          </div>
          <span className="text-xs text-[#5B5B66] dark:text-slate-400 font-mono">
            {voz_del_cliente.length} citas extraídas
          </span>
        </div>

        {voz_del_cliente.length === 0 ? (
          <p className="text-xs text-[#5B5B66] italic">No se hallaron citas textuales con suficiente evidencia.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {voz_del_cliente.map((c, i) => {
              const { original, translation } = parseBilingualContent(c.frase);
              const effectiveTranslation =
                c.traduccion_espanol || translation || quoteTranslations[i] || null;
              const hasEnglish = isLikelyEnglish(original);
              const isTranslating = translatingIndex === i;

              return (
                <div
                  key={i}
                  className="rounded-2xl border border-neutral-200 bg-white p-4.5 dark:border-slate-800 dark:bg-slate-950 shadow-2xs space-y-3 flex flex-col justify-between"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-semibold text-indigo-600 dark:text-indigo-400 font-heading">
                        {c.tema || 'Tema relevante'}
                      </span>
                      <span className="font-mono text-[#5B5B66] dark:text-slate-500 tabular-nums">
                        {c.likes} likes
                      </span>
                    </div>

                    {/* Cita original */}
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#5B5B66] dark:text-slate-400 font-heading">
                          {effectiveTranslation ? 'Cita Original:' : 'Cita Literal:'}
                        </span>
                        {effectiveTranslation && (
                          <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-slate-800 text-[#5B5B66] dark:text-slate-400 font-mono">
                            Original
                          </span>
                        )}
                      </div>
                      <blockquote className="text-xs font-medium text-[#121111] dark:text-slate-200 italic leading-relaxed border-l-2 border-indigo-500/50 pl-3">
                        &quot;{original}&quot;
                      </blockquote>
                    </div>

                    {/* Versión en español latino al costado/debajo */}
                    {effectiveTranslation ? (
                      <div className="flex items-start gap-2 p-2.5 rounded-xl bg-emerald-50/80 dark:bg-emerald-950/30 border border-emerald-200/80 dark:border-emerald-800/40 text-xs">
                        <Languages className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                        <div className="space-y-0.5 min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-400 block font-heading">
                            Traducción al Español Latino:
                          </span>
                          <p className="text-emerald-950 dark:text-emerald-100 italic leading-relaxed font-normal">
                            &quot;{effectiveTranslation}&quot;
                          </p>
                        </div>
                      </div>
                    ) : (
                      hasEnglish && (
                        <button
                          type="button"
                          disabled={isTranslating}
                          onClick={() => handleTranslateQuote(original, i)}
                          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#2848F0] dark:text-blue-400 hover:underline pt-0.5 cursor-pointer"
                        >
                          {isTranslating ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" />
                              <span>Traduciendo al español latino...</span>
                            </>
                          ) : (
                            <>
                              <Languages className="h-3 w-3" />
                              <span>Ver versión en español latino</span>
                            </>
                          )}
                        </button>
                      )
                    )}
                  </div>

                  <div className="pt-2 border-t border-neutral-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-[#5B5B66] dark:text-slate-400">
                    <span className="line-clamp-1">{c.por_que_es_relevante}</span>
                    {c.verificada !== false ? (
                      <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0 ml-2">
                        <CheckCircle2 className="h-3 w-3" /> Verificada
                      </span>
                    ) : (
                      <span className="text-amber-600 dark:text-amber-400 font-semibold shrink-0 ml-2">
                        No verificada
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* BLOQUE 5: BRECHA DE MERCADO Y CATÁLOGO DE IDEAS PAU ($5 - $47 USD) */}
      <section className="space-y-5">
        <div className="flex items-center justify-between border-b border-neutral-200/80 dark:border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
              <DollarSign className="h-3.5 w-3.5" />
            </span>
            <h2 className="text-sm font-bold text-[#121111] dark:text-white font-heading uppercase tracking-wider">
              5. Oportunidades & Productos de Alta Utilidad (PAU)
            </h2>
          </div>
          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
            Micro-productos ($5, $9, $17, $27, $47 USD)
          </span>
        </div>

        {/* Recomendación Final Ganadora */}
        {recomendacion_final?.idea_elegida && (
          <div className="rounded-3xl border-2 border-emerald-300/80 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white p-6 dark:border-emerald-700/60 dark:bg-gradient-to-r dark:from-emerald-950/40 dark:via-teal-950/20 dark:to-slate-900 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300 font-heading uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <span>RECOMENDACIÓN FINAL GANADORA</span>
              </span>
              <span className="rounded-full bg-emerald-100 dark:bg-emerald-950 px-3 py-0.5 text-xs font-bold text-emerald-800 dark:text-emerald-300">
                Mayor Retorno & Facilidad
              </span>
            </div>

            <h3 className="text-lg font-extrabold text-[#121111] dark:text-white font-heading">
              {recomendacion_final.idea_elegida}
            </h3>

            <p className="text-xs sm:text-sm text-[#5B5B66] dark:text-slate-300 leading-relaxed">
              {recomendacion_final.motivo}
            </p>

            <div className="pt-2 border-t border-emerald-200/60 dark:border-emerald-800/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
              <div className="space-y-0.5">
                <span className="font-bold text-emerald-900 dark:text-emerald-300">¿Por qué ahora?</span>
                <p className="text-emerald-950/80 dark:text-slate-300">{recomendacion_final.por_que_ahora}</p>
              </div>
              <div className="space-y-0.5 shrink-0">
                <span className="font-bold text-emerald-900 dark:text-emerald-300">Siguiente Paso Táctico:</span>
                <p className="text-emerald-950/80 dark:text-slate-300">{recomendacion_final.siguiente_paso}</p>
              </div>
            </div>
          </div>
        )}

        {/* Listado de Ideas PAU */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {ideas_pau.map((pau, idx) => {
            const isSelected = selectedPauIdeas.has(pau.nombre);
            return (
              <div
                key={idx}
                className={`rounded-2xl border p-5 transition-all shadow-xs flex flex-col justify-between ${
                  isSelected
                    ? 'border-emerald-500 bg-emerald-50/20 dark:border-emerald-600 dark:bg-emerald-950/20 ring-1 ring-emerald-500'
                    : 'border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-950 hover:border-neutral-300'
                }`}
              >
                <div className="space-y-3">
                  {/* Encabezado de la Tarjeta PAU */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 font-mono uppercase">
                        Formato: {pau.formato || 'Herramienta Digital'}
                      </span>
                      <h3 className="text-base font-bold text-[#121111] dark:text-white font-heading">
                        {pau.nombre}
                      </h3>
                    </div>

                    {/* Precio Sugerido */}
                    <div className="rounded-xl bg-emerald-100 dark:bg-emerald-950/70 border border-emerald-300/80 dark:border-emerald-800 px-3 py-1.5 text-center shrink-0">
                      <span className="text-[10px] font-semibold text-emerald-800 dark:text-emerald-400 block uppercase">
                        Precio
                      </span>
                      <span className="text-base font-extrabold text-emerald-900 dark:text-emerald-200 font-heading tabular-nums">
                        ${pau.precio_sugerido_usd} USD
                      </span>
                    </div>
                  </div>

                  {/* Promesa y Resultado */}
                  <div className="space-y-1 bg-neutral-50 dark:bg-slate-900/60 p-3 rounded-xl border border-neutral-100 dark:border-slate-800">
                    <span className="text-[10px] font-bold text-[#5B5B66] dark:text-slate-400 uppercase">
                      Promesa Concreta:
                    </span>
                    <p className="text-xs font-medium text-[#121111] dark:text-slate-200 leading-relaxed">
                      {pau.promesa}
                    </p>
                  </div>

                  <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                    <strong>Problema que resuelve:</strong> {pau.problema_que_resuelve}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-[#5B5B66] dark:text-slate-400">
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-blue-500" />
                      <span>Resultado en <strong>{pau.tiempo_resultado_dias || '1 a 3 días'}</strong></span>
                    </span>
                    <span className="flex items-center gap-1">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
                      <span>Potencial: <strong>{pau.potencial_comercial || 8}/10</strong></span>
                    </span>
                  </div>
                </div>

                {/* Acciones del PAU */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-neutral-100 dark:border-slate-800/80">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-semibold text-[#121111] dark:text-slate-200">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelectPau(pau.nombre)}
                      className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                    />
                    <span>{isSelected ? 'Idea seleccionada' : 'Guardar esta idea'}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => handleToggleSelectPau(pau.nombre)}
                    className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all cursor-pointer shadow-2xs ${
                      isSelected
                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                        : 'border border-neutral-200 bg-white hover:bg-neutral-50 text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-white dark:hover:bg-slate-800'
                    }`}
                  >
                    <BookmarkCheck className="h-3.5 w-3.5" />
                    <span>{isSelected ? 'Desarrollar este PAU ✓' : 'Desarrollar este PAU'}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Pie de página con botón de regreso */}
      <div className="pt-8 border-t border-neutral-200 dark:border-slate-800 flex items-center justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-xl bg-[#1C1C1C] hover:bg-[#2E2E2E] dark:bg-slate-100 dark:hover:bg-white text-white dark:text-slate-900 px-5 py-2.5 text-xs font-bold transition-all shadow-xs cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>{backButtonText}</span>
        </button>

        <span className="text-xs text-[#5B5B66] dark:text-slate-500 font-mono">
          Análisis guardado en base de datos local (IndexedDB)
        </span>
      </div>
    </div>
  );
}
