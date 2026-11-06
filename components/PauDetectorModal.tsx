'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Sparkles,
  User,
  AlertTriangle,
  Flame,
  HeartCrack,
  ShieldAlert,
  Compass,
  MessageSquareQuote,
  TrendingUp,
  DollarSign,
  Award,
  CheckCircle2,
  Copy,
  Check,
  Download,
  RotateCcw,
  Clock,
  Layers,
  ChevronRight,
  HelpCircle,
  BarChart3,
  Lightbulb,
} from 'lucide-react';
import { PauAnalysisResult, PauIdeaPau } from '@/lib/types';

interface PauDetectorModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: PauAnalysisResult | null;
  onRetry?: () => void;
  videoTitle?: string;
  videoId?: string;
}

export function PauDetectorModal({
  isOpen,
  onClose,
  result,
  onRetry,
  videoTitle,
  videoId,
}: PauDetectorModalProps) {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'problems' | 'pains_desires' | 'voc' | 'market' | 'ideas' | 'json'
  >('overview');

  const [copiedJson, setCopiedJson] = useState(false);
  const [copiedMd, setCopiedMd] = useState(false);

  // Selección persistente de ideas PAU para desarrollar
  const [selectedIdeas, setSelectedIdeas] = useState<Set<string>>(() => {
    if (videoId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`pau_selected_ideas_${videoId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return new Set(parsed.selected || []);
        } catch {
          // ignore
        }
      }
    }
    return new Set();
  });

  const [developedIdea, setDevelopedIdea] = useState<string | null>(() => {
    if (videoId && typeof window !== 'undefined') {
      const stored = localStorage.getItem(`pau_selected_ideas_${videoId}`);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return parsed.developed || null;
        } catch {
          // ignore
        }
      }
    }
    return null;
  });

  if (!isOpen || !result) return null;

  const toggleSelectIdea = (ideaName: string) => {
    setSelectedIdeas((prev) => {
      const next = new Set(prev);
      if (next.has(ideaName)) {
        next.delete(ideaName);
      } else {
        next.add(ideaName);
      }
      if (videoId && typeof window !== 'undefined') {
        localStorage.setItem(
          `pau_selected_ideas_${videoId}`,
          JSON.stringify({ selected: Array.from(next), developed: developedIdea })
        );
      }
      return next;
    });
  };

  const handleDevelopPau = (idea: PauIdeaPau) => {
    setDevelopedIdea(idea.nombre);
    setSelectedIdeas((prev) => {
      const next = new Set(prev);
      next.add(idea.nombre);
      if (videoId && typeof window !== 'undefined') {
        localStorage.setItem(
          `pau_selected_ideas_${videoId}`,
          JSON.stringify({ selected: Array.from(next), developed: idea.nombre })
        );
      }
      return next;
    });
  };

  const handleCopyJson = () => {
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopiedJson(true);
    setTimeout(() => setCopiedJson(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    const mdContent = `# Análisis de Voice of Customer & Detector PAU
**Video:** ${videoTitle || result.videoTitle || 'YouTube Video'}
**Fecha de análisis:** ${new Date(result.analyzedAt || Date.now()).toLocaleString()}

---

## Métricas de Preprocesamiento
- Comentarios Recibidos: ${result.meta.comentarios_recibidos}
- Comentarios Analizados (Limpios): ${result.meta.comentarios_analizados}
- Comentarios Descartados (Filtros): ${result.meta.comentarios_descartados}
- Confianza: ${result.meta.confianza}

---

## 🎯 Cliente Ideal (Avatar)
- **Nombre ficticio:** ${result.avatar.nombre_ficticio}
- **Situación actual:** ${result.avatar.situacion_actual}
- **Nivel de conciencia:** ${result.avatar.nivel_conciencia}/5
- **Qué quiere conseguir:** ${result.avatar.que_quiere_conseguir}
- **Frase característica:** "${result.avatar.frase_caracteristica || 'N/A'}"

---

## 🔥 Problema Principal
**${result.problema_principal.titulo}**
${result.problema_principal.descripcion}
- Urgencia: ${result.problema_principal.urgencia}/10 | Intensidad: ${result.problema_principal.intensidad}/10 | Frecuencia: ${result.problema_principal.frecuencia}
- Por qué es prioritario: ${result.problema_principal.por_que_es_prioritario}

---

## 💡 Ideas de Productos de Alta Utilidad (PAU)
${result.ideas_pau
  .map(
    (idea, i) => `### ${i + 1}. ${idea.nombre} ($${idea.precio_sugerido_usd} USD)
- **Problema:** ${idea.problema_que_resuelve}
- **Promesa:** ${idea.promesa}
- **Formato:** ${idea.formato}
- **Resultado en:** ${idea.tiempo_resultado_dias} días (${idea.resultado_visible})
- **Urgencia:** ${idea.urgencia}/10 | Potencial Compra: ${idea.potencial_compra}/10 | Potencial Comercial: ${idea.potencial_comercial}/10
`
  )
  .join('\n')}

---

## 🏆 Recomendación Final
- **Idea elegida:** ${result.recomendacion_final.idea_elegida}
- **Motivo:** ${result.recomendacion_final.motivo}
- **Por qué ahora:** ${result.recomendacion_final.por_que_ahora}
- **Siguiente paso:** ${result.recomendacion_final.siguiente_paso}
`;

    const blob = new Blob([mdContent], { type: 'text/markdown;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pau_analisis_${videoId || 'video'}.md`;
    link.click();
    URL.revokeObjectURL(url);
    setCopiedMd(true);
    setTimeout(() => setCopiedMd(false), 2000);
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'bg-rose-500 text-white';
    if (score >= 5) return 'bg-amber-500 text-white';
    return 'bg-blue-500 text-white';
  };

  const getProgressBarColor = (score: number) => {
    if (score >= 8) return 'bg-rose-500';
    if (score >= 5) return 'bg-amber-500';
    return 'bg-blue-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-5 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="flex h-full max-h-[92vh] w-full max-w-6xl flex-col rounded-3xl border border-neutral-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950 overflow-hidden">
        {/* Cabecera Principal */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-neutral-100 bg-[#FAFAFA] p-5 dark:border-slate-800/80 dark:bg-slate-900/60 gap-4">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#2848F0] text-white shadow-xs">
                <Sparkles className="h-4 w-4" />
              </span>
              <h2 className="text-base sm:text-lg font-bold text-[#121111] dark:text-white font-heading truncate">
                Detector de Problemas Urgentes PAU
              </h2>
              <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-[11px] font-bold text-[#2848F0] dark:bg-blue-950/80 dark:text-blue-300">
                Gemini 3.8 Flash
              </span>
            </div>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400 truncate max-w-2xl">
              {videoTitle || result.videoTitle || 'Análisis de Voice of Customer'}
            </p>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto">
            {onRetry && (
              <button
                onClick={onRetry}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors shadow-2xs"
                title="Volver a ejecutar el análisis"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Reintentar</span>
              </button>
            )}
            <button
              onClick={handleCopyJson}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-colors shadow-2xs"
            >
              {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
              <span>{copiedJson ? 'Copiado' : 'JSON'}</span>
            </button>
            <button
              onClick={handleDownloadMarkdown}
              className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-colors shadow-2xs"
            >
              {copiedMd ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Download className="h-3.5 w-3.5" />}
              <span>{copiedMd ? 'Descargado' : 'Markdown'}</span>
            </button>
            <button
              onClick={onClose}
              className="rounded-xl p-1.5 text-[#5B5B66] hover:bg-neutral-200/80 hover:text-[#121111] dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Barra de Auditoría de Comentarios Preprocesados */}
        <div className="flex flex-wrap items-center justify-between border-b border-neutral-100 bg-white px-5 py-2.5 text-xs text-[#5B5B66] dark:border-slate-800 dark:bg-slate-950 gap-2">
          <div className="flex flex-wrap items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="font-medium text-[#121111] dark:text-slate-200">
                {result.meta.comentarios_recibidos}
              </span>{' '}
              recibidos
            </span>
            <span className="text-neutral-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-semibold">
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>{result.meta.comentarios_analizados} analizados</span>
            </span>
            <span className="text-neutral-300 dark:text-slate-700">•</span>
            <span className="flex items-center gap-1.5 text-neutral-500">
              <span>{result.meta.comentarios_descartados} descartados (ruido/spam)</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-neutral-100 px-2.5 py-0.5 text-[11px] font-medium text-[#121111] dark:bg-slate-900 dark:text-slate-300">
              Idioma: {result.meta.idioma || 'Detectado'}
            </span>
            <span
              className={`rounded-lg px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                result.meta.confianza === 'alta'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/80 dark:text-emerald-300'
                  : result.meta.confianza === 'media'
                  ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300'
                  : 'bg-rose-100 text-rose-800 dark:bg-rose-950/80 dark:text-rose-300'
              }`}
            >
              Confianza {result.meta.confianza}
            </span>
          </div>
        </div>

        {/* Pestañas de Navegación del Visor */}
        <div className="flex items-center gap-1 overflow-x-auto border-b border-neutral-200/80 bg-[#FAFAFA] px-5 py-2 dark:border-slate-800 dark:bg-slate-900/40">
          {[
            { id: 'overview', label: '🎯 Cliente Ideal & Avatar', icon: User },
            { id: 'problems', label: '🔥 Problemas & Urgencia', icon: Flame },
            { id: 'pains_desires', label: '💔 Dolores, Miedos & Deseos', icon: HeartCrack },
            { id: 'voc', label: '🗣️ Voz del Cliente (VOC)', icon: MessageSquareQuote },
            { id: 'market', label: '📈 Disposición & Brecha', icon: TrendingUp },
            { id: 'ideas', label: '💡 Ideas PAU ($5 a $47)', icon: Lightbulb },
            { id: 'json', label: '📋 JSON Completo', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center gap-2 whitespace-nowrap rounded-xl px-3.5 py-2 text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-white text-[#2848F0] shadow-xs ring-1 ring-neutral-200 dark:bg-slate-800 dark:text-white dark:ring-slate-700'
                    : 'text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:text-slate-400 dark:hover:bg-slate-800/60 dark:hover:text-slate-200'
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? 'text-[#2848F0] dark:text-blue-400' : ''}`} />
                <span>{tab.label}</span>
                {tab.id === 'ideas' && result.ideas_pau?.length > 0 && (
                  <span className="ml-1 rounded-full bg-[#2848F0] px-1.5 py-0.2 text-[10px] text-white">
                    {result.ideas_pau.length}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Contenido Desplazable */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
          {/* TAB 1: OVERVIEW / AVATAR */}
          {activeTab === 'overview' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Tarjeta del Avatar */}
              <div className="rounded-2xl border border-neutral-200/90 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-neutral-100 dark:border-slate-800 gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white font-bold text-lg shadow-sm">
                      {result.avatar.nombre_ficticio?.charAt(0) || 'A'}
                    </div>
                    <div>
                      <h3 className="text-lg font-bold text-[#121111] dark:text-white font-heading">
                        {result.avatar.nombre_ficticio}
                      </h3>
                      <p className="text-xs text-[#5B5B66] dark:text-slate-400">
                        {result.avatar.edad_aproximada
                          ? `Edad aprox: ${result.avatar.edad_aproximada}`
                          : 'Edad: No especificada en comentarios'}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#5B5B66] dark:text-slate-400 font-medium">Nivel de Conciencia:</span>
                    <span className="rounded-xl bg-blue-50 border border-blue-200 px-3 py-1 text-xs font-bold text-[#2848F0] dark:bg-blue-950/70 dark:border-blue-800 dark:text-blue-300">
                      {result.avatar.nivel_conciencia ? `${result.avatar.nivel_conciencia}/5` : '3/5'} - Reconoce problema
                    </span>
                  </div>
                </div>

                {/* Frase Característica */}
                {result.avatar.frase_caracteristica && (
                  <div className="rounded-xl border border-amber-200/70 bg-amber-50/60 p-4 dark:border-amber-900/40 dark:bg-amber-950/20">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-amber-800 dark:text-amber-400">
                      Frase Característica del Avatar (Cita Real)
                    </span>
                    <blockquote className="mt-1 text-sm italic font-medium text-amber-950 dark:text-amber-200">
                      “{result.avatar.frase_caracteristica}”
                    </blockquote>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                  <div className="rounded-xl bg-[#FAFAFA] p-4 border border-neutral-200/70 dark:bg-slate-950 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-[#121111] dark:text-slate-200 mb-2 font-heading flex items-center gap-1.5">
                      <Compass className="h-3.5 w-3.5 text-blue-600" />
                      <span>Situación Actual</span>
                    </h4>
                    <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                      {result.avatar.situacion_actual}
                    </p>
                  </div>

                  <div className="rounded-xl bg-[#FAFAFA] p-4 border border-neutral-200/70 dark:bg-slate-950 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-[#121111] dark:text-slate-200 mb-2 font-heading flex items-center gap-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-rose-600" />
                      <span>Qué lo bloquea</span>
                    </h4>
                    <ul className="space-y-1.5 text-xs text-[#5B5B66] dark:text-slate-400">
                      {result.avatar.que_lo_bloquea?.map((item, idx) => (
                        <li key={idx} className="flex items-start gap-1.5">
                          <span className="text-rose-500 font-bold">•</span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl bg-[#FAFAFA] p-4 border border-neutral-200/70 dark:bg-slate-950 dark:border-slate-800">
                    <h4 className="text-xs font-bold text-[#121111] dark:text-slate-200 mb-2 font-heading flex items-center gap-1.5">
                      <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Qué quiere conseguir</span>
                    </h4>
                    <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed font-medium text-emerald-900 dark:text-emerald-300">
                      {result.avatar.que_quiere_conseguir}
                    </p>
                  </div>
                </div>

                {/* Qué ha intentado */}
                {result.avatar.que_ha_intentado?.length > 0 && (
                  <div className="pt-2">
                    <span className="text-xs font-bold text-[#121111] dark:text-slate-200 mb-2 block">
                      Soluciones que ya ha intentado:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {result.avatar.que_ha_intentado.map((item, idx) => (
                        <span
                          key={idx}
                          className="rounded-lg bg-neutral-100 px-3 py-1 text-xs text-[#5B5B66] dark:bg-slate-800 dark:text-slate-300"
                        >
                          {item}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Recomendación Final Destacada */}
              {result.recomendacion_final && (
                <div className="rounded-2xl border-2 border-[#2848F0] bg-gradient-to-r from-blue-50/80 to-indigo-50/50 p-6 shadow-sm dark:border-blue-600 dark:bg-gradient-to-r dark:from-blue-950/40 dark:to-indigo-950/30 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#2848F0] dark:text-blue-300 font-heading">
                      <Award className="h-4 w-4" />
                      <span>Oportunidad PAU Seleccionada</span>
                    </div>
                    <span className="rounded-full bg-[#2848F0] px-3 py-0.5 text-xs font-bold text-white shadow-2xs">
                      Recomendada
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-[#121111] dark:text-white font-heading">
                      {result.recomendacion_final.idea_elegida || 'Oportunidad Principal'}
                    </h3>
                    <p className="text-xs text-[#5B5B66] dark:text-slate-300 mt-1">
                      {result.recomendacion_final.problema_que_debe_resolver}
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs pt-1">
                    <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/80 border border-blue-100 dark:border-blue-900/50">
                      <span className="font-bold text-[#121111] dark:text-slate-200 block mb-1">Motivo Estratégico:</span>
                      <p className="text-[#5B5B66] dark:text-slate-400">{result.recomendacion_final.motivo}</p>
                    </div>
                    <div className="rounded-xl bg-white/80 p-3 dark:bg-slate-900/80 border border-blue-100 dark:border-blue-900/50">
                      <span className="font-bold text-[#121111] dark:text-slate-200 block mb-1">Por Qué Ahora:</span>
                      <p className="text-[#5B5B66] dark:text-slate-400">{result.recomendacion_final.por_que_ahora}</p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-blue-200/60 dark:border-blue-900/40 text-xs">
                    <span className="font-semibold text-blue-900 dark:text-blue-300">
                      Siguiente paso: {result.recomendacion_final.siguiente_paso}
                    </span>
                    <button
                      onClick={() => setActiveTab('ideas')}
                      className="flex items-center gap-1 font-bold text-[#2848F0] hover:underline dark:text-blue-400"
                    >
                      <span>Ver todas las ideas PAU</span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: PROBLEMAS & URGENCIA */}
          {activeTab === 'problems' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              {/* Problema Principal */}
              <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full bg-rose-100 p-1.5 text-rose-600 dark:bg-rose-950 dark:text-rose-300">
                      <Flame className="h-4 w-4" />
                    </span>
                    <span className="text-xs font-bold uppercase tracking-wider text-rose-600 dark:text-rose-400 font-heading">
                      Problema Principal de Mercado
                    </span>
                  </div>
                  <span className="rounded-xl bg-neutral-100 px-3 py-1 text-xs font-semibold text-[#5B5B66] dark:bg-slate-800 dark:text-slate-300">
                    Frecuencia: {result.problema_principal.frecuencia} (~{result.problema_principal.menciones_estimadas} menciones)
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-[#121111] dark:text-white font-heading">
                    {result.problema_principal.titulo}
                  </h3>
                  <p className="text-xs text-[#5B5B66] dark:text-slate-300 mt-1 leading-relaxed">
                    {result.problema_principal.descripcion}
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  {/* Urgencia */}
                  <div className="rounded-xl border border-neutral-200 bg-[#FAFAFA] p-3.5 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#121111] dark:text-slate-200">Nivel de Urgencia</span>
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${getScoreColor(result.problema_principal.urgencia)}`}>
                        {result.problema_principal.urgencia}/10
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${getProgressBarColor(result.problema_principal.urgencia)}`}
                        style={{ width: `${result.problema_principal.urgencia * 10}%` }}
                      />
                    </div>
                  </div>

                  {/* Intensidad */}
                  <div className="rounded-xl border border-neutral-200 bg-[#FAFAFA] p-3.5 dark:border-slate-800 dark:bg-slate-950">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-[#121111] dark:text-slate-200">Intensidad Emocional</span>
                      <span className={`rounded-lg px-2 py-0.5 text-xs font-bold ${getScoreColor(result.problema_principal.intensidad)}`}>
                        {result.problema_principal.intensidad}/10
                      </span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${getProgressBarColor(result.problema_principal.intensidad)}`}
                        style={{ width: `${result.problema_principal.intensidad * 10}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Evidencia Textual */}
                {result.problema_principal.evidencia?.length > 0 && (
                  <div className="rounded-xl bg-neutral-50 p-4 border border-neutral-200/70 dark:bg-slate-950 dark:border-slate-800 space-y-2">
                    <span className="text-xs font-bold text-[#121111] dark:text-slate-200 block">
                      Evidencia Textual de los Comentarios:
                    </span>
                    {result.problema_principal.evidencia.map((cita, idx) => (
                      <p key={idx} className="text-xs italic text-[#5B5B66] dark:text-slate-400 pl-3 border-l-2 border-rose-500">
                        “{cita}”
                      </p>
                    ))}
                  </div>
                )}

                <div className="pt-2 text-xs text-[#5B5B66] dark:text-slate-400">
                  <span className="font-bold text-[#121111] dark:text-slate-200">Por qué es prioritario: </span>
                  {result.problema_principal.por_que_es_prioritario}
                </div>
              </div>

              {/* Emoción Raíz y Dolor Futuro */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#121111] dark:text-white font-heading">
                      Emoción Raíz Dominante
                    </span>
                    <span className="rounded-lg bg-rose-100 px-2 py-0.5 text-xs font-bold text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                      Intensidad {result.emocion_raiz.intensidad}/10
                    </span>
                  </div>
                  <h4 className="text-base font-bold text-rose-600 dark:text-rose-400">
                    {result.emocion_raiz.emocion_dominante}
                  </h4>
                  <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                    {result.emocion_raiz.explicacion}
                  </p>
                </div>

                <div className="rounded-2xl border border-neutral-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900/60 space-y-3">
                  <span className="text-xs font-bold text-[#121111] dark:text-white font-heading">
                    Dolor Futuro (Consecuencias si no resuelven)
                  </span>
                  <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                    {result.dolor_futuro.descripcion}
                  </p>
                </div>
              </div>

              {/* Lista Desglosada de Problemas con Barras Visuales */}
              <div className="space-y-3">
                <h4 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                  Todos los Problemas Detectados (Ordenados por Urgencia e Intensidad)
                </h4>
                <div className="space-y-3">
                  {result.problemas?.map((prob, idx) => (
                    <div
                      key={idx}
                      className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/50 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-neutral-100 text-xs font-bold text-[#5B5B66] dark:bg-slate-800 dark:text-slate-300">
                            #{idx + 1}
                          </span>
                          <h5 className="text-xs font-bold text-[#121111] dark:text-white font-heading">
                            {prob.titulo}
                          </h5>
                        </div>
                        <span className="text-[11px] text-[#5B5B66] dark:text-slate-400">
                          ~{prob.menciones_estimadas} menciones ({prob.frecuencia})
                        </span>
                      </div>

                      <p className="text-xs text-[#5B5B66] dark:text-slate-400">{prob.descripcion}</p>

                      <div className="grid grid-cols-2 gap-3 pt-1">
                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-[#5B5B66] mb-1">
                            <span>Urgencia</span>
                            <span>{prob.urgencia}/10</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-rose-500 rounded-full"
                              style={{ width: `${(prob.urgencia || 5) * 10}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-[#5B5B66] mb-1">
                            <span>Intensidad</span>
                            <span>{prob.intensidad}/10</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-indigo-500 rounded-full"
                              style={{ width: `${(prob.intensidad || 5) * 10}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {prob.citas?.length > 0 && (
                        <div className="pt-1 border-t border-neutral-100 dark:border-slate-800/80">
                          {prob.citas.map((cita, cIdx) => (
                            <p key={cIdx} className="text-[11px] italic text-[#5B5B66] dark:text-slate-400">
                              “{cita}”
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: DOLORES, MIEDOS & DESEOS */}
          {activeTab === 'pains_desires' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Dolores */}
                <div className="rounded-2xl border border-rose-200 bg-rose-50/40 p-5 dark:border-rose-900/40 dark:bg-rose-950/20 space-y-3">
                  <div className="flex items-center gap-2 text-rose-800 dark:text-rose-300 font-bold text-xs uppercase tracking-wider font-heading">
                    <HeartCrack className="h-4 w-4" />
                    <span>Dolores y Frustraciones Actuales</span>
                  </div>
                  <ul className="space-y-2 text-xs text-rose-950/80 dark:text-rose-200/90">
                    {result.dolores?.map((dolor, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-rose-100 dark:border-rose-900/30">
                        <span className="text-rose-500 font-bold">✖</span>
                        <span>{dolor}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Miedos */}
                <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 dark:border-amber-900/40 dark:bg-amber-950/20 space-y-3">
                  <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 font-bold text-xs uppercase tracking-wider font-heading">
                    <ShieldAlert className="h-4 w-4" />
                    <span>Miedos y Objeciones</span>
                  </div>
                  <ul className="space-y-2 text-xs text-amber-950/80 dark:text-amber-200/90">
                    {result.miedos?.map((miedo, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-100 dark:border-amber-900/30">
                        <span className="text-amber-500 font-bold">⚠</span>
                        <span>{miedo}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Deseos */}
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-5 dark:border-emerald-900/40 dark:bg-emerald-950/20 space-y-3">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 font-bold text-xs uppercase tracking-wider font-heading">
                    <Sparkles className="h-4 w-4" />
                    <span>Deseos & Transformación Buscada</span>
                  </div>
                  <ul className="space-y-2 text-xs text-emerald-950/80 dark:text-emerald-200/90">
                    {result.deseos?.map((deseo, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-emerald-100 dark:border-emerald-900/30">
                        <span className="text-emerald-500 font-bold">✔</span>
                        <span>{deseo}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Qué ha intentado */}
                <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-3">
                  <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold text-xs uppercase tracking-wider font-heading">
                    <Clock className="h-4 w-4" />
                    <span>Soluciones que Ya Han Intentado</span>
                  </div>
                  <ul className="space-y-2 text-xs text-blue-950/80 dark:text-blue-200/90">
                    {result.que_ha_intentado?.map((intento, idx) => (
                      <li key={idx} className="flex items-start gap-2 bg-white/70 dark:bg-slate-900/60 p-2.5 rounded-xl border border-blue-100 dark:border-blue-900/30">
                        <span className="text-blue-500 font-bold">↪</span>
                        <span>{intento}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: VOZ DEL CLIENTE (VOC) */}
          {activeTab === 'voc' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="flex items-center justify-between pb-2 border-b border-neutral-100 dark:border-slate-800">
                <div>
                  <h3 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                    Citas Textuales Extraídas de los Comentarios
                  </h3>
                  <p className="text-xs text-[#5B5B66] dark:text-slate-400">
                    Copia exacta de las palabras de la audiencia para usar en copys, títulos y promesas comerciales.
                  </p>
                </div>
                <span className="rounded-xl bg-neutral-100 px-3 py-1 text-xs font-semibold text-[#5B5B66] dark:bg-slate-800 dark:text-slate-300">
                  {result.voz_del_cliente?.length || 0} citas destacadas
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {result.voz_del_cliente?.map((voc, idx) => (
                  <div
                    key={idx}
                    className="flex flex-col justify-between rounded-2xl border border-neutral-200 bg-white p-4 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-3"
                  >
                    <blockquote className="text-xs italic text-[#121111] dark:text-slate-200 leading-relaxed font-medium pl-3 border-l-2 border-[#2848F0]">
                      “{voc.frase}”
                    </blockquote>

                    <div className="flex flex-wrap items-center justify-between text-[11px] pt-2 border-t border-neutral-100 dark:border-slate-800 text-[#5B5B66] dark:text-slate-400 gap-2">
                      <div className="flex items-center gap-2">
                        <span className="rounded-md bg-neutral-100 px-2 py-0.5 font-medium dark:bg-slate-800">
                          {voc.tema}
                        </span>
                        {typeof voc.likes === 'number' && voc.likes > 0 && (
                          <span className="text-blue-600 dark:text-blue-400 font-semibold">
                            👍 {voc.likes} likes
                          </span>
                        )}
                      </div>

                      {voc.verificada !== false ? (
                        <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400 font-medium text-[10px]">
                          <Check className="h-3 w-3" /> Verificada
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-neutral-400 font-medium text-[10px]">
                          No verificada
                        </span>
                      )}
                    </div>

                    {voc.por_que_es_relevante && (
                      <p className="text-[11px] text-[#5B5B66] dark:text-slate-400">
                        <strong className="text-[#121111] dark:text-slate-300">Por qué importa:</strong> {voc.por_que_es_relevante}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: DISPOSICIÓN & BRECHA */}
          {activeTab === 'market' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Disposición de Compra */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#121111] dark:text-white font-heading">
                      Disposición de Compra
                    </span>
                    <span
                      className={`rounded-xl px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        result.disposicion_compra.nivel === 'alta'
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                          : result.disposicion_compra.nivel === 'media'
                          ? 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
                          : 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      }`}
                    >
                      Nivel {result.disposicion_compra.nivel}
                    </span>
                  </div>

                  <div className="rounded-xl bg-[#FAFAFA] p-3.5 border border-neutral-200/70 dark:bg-slate-950 dark:border-slate-800">
                    <div className="flex justify-between text-xs font-semibold text-[#121111] dark:text-slate-200 mb-1.5">
                      <span>Termómetro Comercial</span>
                      <span>{result.disposicion_compra.nivel_numerico}/10</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-neutral-200 dark:bg-slate-800 overflow-hidden">
                      <div
                        className={`h-full ${getProgressBarColor(result.disposicion_compra.nivel_numerico)}`}
                        style={{ width: `${(result.disposicion_compra.nivel_numerico || 5) * 10}%` }}
                      />
                    </div>
                  </div>

                  <div>
                    <span className="text-xs font-bold text-[#121111] dark:text-slate-200 block mb-1">
                      Motivo de la Hipótesis Comercial:
                    </span>
                    <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                      {result.disposicion_compra.motivo}
                    </p>
                  </div>

                  {result.disposicion_compra.senales?.length > 0 && (
                    <div>
                      <span className="text-xs font-bold text-[#121111] dark:text-slate-200 block mb-1">
                        Señales Detectadas:
                      </span>
                      <ul className="space-y-1 text-xs text-[#5B5B66] dark:text-slate-400">
                        {result.disposicion_compra.senales.map((s, idx) => (
                          <li key={idx} className="flex items-center gap-1.5">
                            <span className="text-blue-500">•</span>
                            <span>{s}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Brecha de Mercado */}
                <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900/60 space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#121111] dark:text-white font-heading">
                      Brecha y Saturación de Mercado
                    </span>
                    <span className="rounded-xl bg-blue-100 px-3 py-1 text-xs font-bold text-[#2848F0] dark:bg-blue-950 dark:text-blue-300">
                      Saturación: {result.brecha_mercado.saturacion}
                    </span>
                  </div>

                  <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4 dark:border-blue-900/40 dark:bg-blue-950/20 space-y-1.5">
                    <span className="text-xs font-bold text-blue-900 dark:text-blue-300">
                      Oportunidad Detectada:
                    </span>
                    <p className="text-xs text-blue-950/80 dark:text-slate-300 leading-relaxed">
                      {result.brecha_mercado.oportunidad}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <span className="text-xs font-bold text-[#121111] dark:text-slate-200">
                      Recomendación de Lanzamiento:
                    </span>
                    <span
                      className={`rounded-xl px-3 py-1 text-xs font-bold uppercase tracking-wider ${
                        result.brecha_mercado.recomendacion === 'crear'
                          ? 'bg-emerald-500 text-white'
                          : result.brecha_mercado.recomendacion === 'evaluar'
                          ? 'bg-amber-500 text-white'
                          : 'bg-rose-500 text-white'
                      }`}
                    >
                      {result.brecha_mercado.recomendacion}
                    </span>
                  </div>

                  {result.brecha_mercado.limitaciones && (
                    <p className="text-[11px] text-[#5B5B66] dark:text-slate-400 italic">
                      Nota: {result.brecha_mercado.limitaciones}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 6: IDEAS PAU */}
          {activeTab === 'ideas' && (
            <div className="space-y-6 max-w-5xl mx-auto">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-2 border-b border-neutral-100 dark:border-slate-800 gap-2">
                <div>
                  <h3 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                    Productos de Alta Utilidad (PAU) Generados
                  </h3>
                  <p className="text-xs text-[#5B5B66] dark:text-slate-400">
                    Herramientas digitales simples, específicas y accionables con resultado en 1 a 3 días.
                  </p>
                </div>
                {developedIdea && (
                  <span className="rounded-xl bg-emerald-100 border border-emerald-300 px-3 py-1 text-xs font-bold text-emerald-800 dark:bg-emerald-950 dark:border-emerald-800 dark:text-emerald-300">
                    Desarrollando: {developedIdea}
                  </span>
                )}
              </div>

              <div className="space-y-4">
                {result.ideas_pau?.map((idea, idx) => {
                  const isSelected = selectedIdeas.has(idea.nombre);
                  const isDeveloped = developedIdea === idea.nombre;

                  return (
                    <div
                      key={idx}
                      className={`rounded-2xl border p-5 transition-all space-y-4 shadow-xs ${
                        isDeveloped
                          ? 'border-emerald-500 bg-emerald-50/20 ring-2 ring-emerald-500/30 dark:bg-emerald-950/20'
                          : isSelected
                          ? 'border-[#2848F0] bg-blue-50/10 ring-2 ring-[#2848F0]/20 dark:border-blue-600'
                          : 'border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900/60'
                      }`}
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelectIdea(idea.nombre)}
                            className="mt-1 h-4 w-4 rounded border-neutral-300 text-[#2848F0] focus:ring-[#2848F0]"
                          />
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <h4 className="text-base font-bold text-[#121111] dark:text-white font-heading">
                                {idea.nombre}
                              </h4>
                              <span className="rounded-lg bg-neutral-100 px-2 py-0.5 text-[11px] font-medium text-[#5B5B66] dark:bg-slate-800 dark:text-slate-300">
                                {idea.formato}
                              </span>
                            </div>
                            <p className="text-xs text-[#5B5B66] dark:text-slate-400 mt-1">
                              <strong>Problema que resuelve:</strong> {idea.problema_que_resuelve}
                            </p>
                          </div>
                        </div>

                        {/* Badge de Precio Obligatorio 5, 9, 17, 27, 47 */}
                        <div className="flex items-center gap-2 self-start sm:self-auto">
                          <span className="rounded-2xl bg-[#1C1C1C] px-3.5 py-1.5 text-xs font-bold text-white shadow-2xs dark:bg-slate-800">
                            ${idea.precio_sugerido_usd} USD
                          </span>
                        </div>
                      </div>

                      {/* Promesa y Resultado Visible */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl bg-[#FAFAFA] p-3 border border-neutral-200/70 dark:bg-slate-950 dark:border-slate-800">
                          <span className="font-bold text-[#121111] dark:text-slate-200 block mb-0.5">
                            Promesa Concreta:
                          </span>
                          <p className="text-[#5B5B66] dark:text-slate-400">{idea.promesa}</p>
                        </div>
                        <div className="rounded-xl bg-[#FAFAFA] p-3 border border-neutral-200/70 dark:bg-slate-950 dark:border-slate-800">
                          <span className="font-bold text-[#121111] dark:text-slate-200 block mb-0.5">
                            Resultado en {idea.tiempo_resultado_dias} días:
                          </span>
                          <p className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {idea.resultado_visible}
                          </p>
                        </div>
                      </div>

                      {/* Barras de Métricas */}
                      <div className="grid grid-cols-3 gap-3 pt-1">
                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-[#5B5B66] mb-1">
                            <span>Urgencia</span>
                            <span>{idea.urgencia}/10</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-rose-500 rounded-full"
                              style={{ width: `${(idea.urgencia || 5) * 10}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-[#5B5B66] mb-1">
                            <span>Potencial Compra</span>
                            <span>{idea.potencial_compra}/10</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-amber-500 rounded-full"
                              style={{ width: `${(idea.potencial_compra || 5) * 10}%` }}
                            />
                          </div>
                        </div>

                        <div>
                          <div className="flex justify-between text-[11px] font-semibold text-[#5B5B66] mb-1">
                            <span>Potencial Comercial</span>
                            <span>{idea.potencial_comercial}/10</span>
                          </div>
                          <div className="h-1.5 w-full rounded-full bg-neutral-100 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full"
                              style={{ width: `${(idea.potencial_comercial || 5) * 10}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Botón Desarrollar este PAU */}
                      <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-slate-800">
                        <span className="text-[11px] text-[#5B5B66] dark:text-slate-400">
                          {idea.por_que}
                        </span>

                        <button
                          type="button"
                          onClick={() => handleDevelopPau(idea)}
                          className={`flex items-center gap-1.5 rounded-xl px-4 py-2 text-xs font-semibold transition-all shadow-xs ${
                            isDeveloped
                              ? 'bg-emerald-600 text-white'
                              : 'bg-[#2848F0] hover:bg-[#1E3AC7] text-white'
                          }`}
                        >
                          <Check className="h-3.5 w-3.5" />
                          <span>{isDeveloped ? 'PAU Seleccionado para Desarrollo' : 'Desarrollar este PAU'}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 7: JSON COMPLETO */}
          {activeTab === 'json' && (
            <div className="space-y-4 max-w-5xl mx-auto">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#121111] dark:text-slate-200 font-heading">
                  Estructura JSON Devuelta por Gemini (Validada)
                </span>
                <button
                  onClick={handleCopyJson}
                  className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#121111] hover:bg-neutral-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 shadow-2xs"
                >
                  {copiedJson ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedJson ? 'Copiado al portapapeles' : 'Copiar JSON'}</span>
                </button>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-4 dark:border-slate-800 dark:bg-slate-950 overflow-x-auto">
                <pre className="font-mono text-xs text-[#121111] dark:text-slate-300 leading-relaxed">
                  {JSON.stringify(result, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
