'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  FileText,
  Search,
  Copy,
  Check,
  Download,
  Trash2,
  Eye,
  Sparkles,
  ArrowLeft,
  Calendar,
  Layers,
  AlertTriangle,
  Play,
} from 'lucide-react';
import { PromptExecutionRecord, YouTubeSearchResultItem } from '@/lib/types';
import { getContentRepository } from '@/lib/repository';
import { PauContinuousView } from './PauContinuousView';
import { generatePauMarkdown } from '@/lib/pau-markdown';

interface PromptOutputsTabProps {
  onOpenVideoWatch?: (video: YouTubeSearchResultItem) => void;
  onNavigateToSearch?: () => void;
}

export function PromptOutputsTab({
  onOpenVideoWatch,
  onNavigateToSearch,
}: PromptOutputsTabProps) {
  const repository = getContentRepository();
  const [outputs, setOutputs] = useState<PromptExecutionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeViewingRecord, setActiveViewingRecord] = useState<PromptExecutionRecord | null>(null);
  const [recordToDelete, setRecordToDelete] = useState<PromptExecutionRecord | null>(null);
  const [isClearAllModalOpen, setIsClearAllModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 2600);
  };

  const loadOutputs = useCallback(async () => {
    try {
      setIsLoading(true);
      const list = await repository.getAllPromptOutputs();
      setOutputs(list);
    } catch (err) {
      console.warn('Error loading prompt outputs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [repository]);

  useEffect(() => {
    let isMounted = true;
    void (async () => {
      try {
        const list = await repository.getAllPromptOutputs();
        if (isMounted) {
          setOutputs(list);
          setIsLoading(false);
        }
      } catch {
        if (isMounted) setIsLoading(false);
      }
    })();
    return () => {
      isMounted = false;
    };
  }, [repository]);

  const filteredOutputs = useMemo(() => {
    if (!searchQuery.trim()) return outputs;
    const q = searchQuery.toLowerCase();
    return outputs.filter(
      (item) =>
        item.videoTitle.toLowerCase().includes(q) ||
        item.promptName.toLowerCase().includes(q) ||
        (item.channelTitle && item.channelTitle.toLowerCase().includes(q)) ||
        item.modelUsed.toLowerCase().includes(q)
    );
  }, [outputs, searchQuery]);

  const handleCopyJson = (record: PromptExecutionRecord) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(JSON.stringify(record.result, null, 2));
      setCopiedId(record.id);
      showToast(`JSON de "${record.videoTitle}" copiado`);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  const handleDownloadJson = (record: PromptExecutionRecord) => {
    const blob = new Blob([JSON.stringify(record.result, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `salida-prompt-${record.videoId}-${record.createdAt}.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Archivo JSON descargado');
  };

  const handleDownloadMarkdown = (record: PromptExecutionRecord) => {
    try {
      const md = generatePauMarkdown(record.result, {
        videoTitle: record.videoTitle,
        videoId: record.videoId,
        modelUsed: record.modelUsed,
      });
      const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      const safeTitle = (record.videoTitle || 'analisis-pau')
        .toLowerCase()
        .replace(/[^a-z0-9áéíóúñü_-]/gi, '_')
        .replace(/_+/g, '_')
        .slice(0, 50);
      link.download = `analisis-pau-${safeTitle}-${record.createdAt}.md`;
      link.click();
      URL.revokeObjectURL(url);
      showToast('Archivo Markdown (.md) descargado');
    } catch {
      showToast('Error al generar archivo Markdown');
    }
  };

  const handleConfirmDelete = async () => {
    if (!recordToDelete) return;
    try {
      await repository.deletePromptOutput(recordToDelete.id);
      setOutputs((prev) => prev.filter((o) => o.id !== recordToDelete.id));
      showToast(`Registro eliminado`);
      setRecordToDelete(null);
    } catch {
      showToast('Error al eliminar el registro');
    }
  };

  const handleConfirmClearAll = async () => {
    try {
      await repository.clearAllPromptOutputs();
      setOutputs([]);
      setIsClearAllModalOpen(false);
      showToast('Historial de salidas de prompts vaciado');
    } catch {
      showToast('Error al limpiar el historial');
    }
  };

  // Si estamos inspeccionando un reporte específico, mostrar la vista continua
  if (activeViewingRecord) {
    return (
      <PauContinuousView
        result={activeViewingRecord.result}
        videoTitle={activeViewingRecord.videoTitle}
        videoId={activeViewingRecord.videoId}
        onBack={() => setActiveViewingRecord(null)}
        backButtonText="Volver al historial de Salidas prompt"
      />
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Flotante */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-[#1C1C1C] dark:bg-slate-800 text-white px-4 py-3 text-xs font-semibold shadow-xl border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Encabezado Principal */}
      <div className="rounded-3xl border border-neutral-200/90 bg-gradient-to-r from-emerald-50/70 via-teal-50/40 to-white p-6 sm:p-8 dark:border-slate-800 dark:bg-gradient-to-r dark:from-slate-900/80 dark:via-emerald-950/20 dark:to-slate-950 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-xs">
              <Layers className="h-5 w-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#121111] dark:text-white font-heading">
              Salidas de Prompts & Historial IA
            </h2>
            <span className="text-xs text-[#5B5B66] dark:text-slate-400 font-mono">
              ({outputs.length} registros)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5B5B66] dark:text-slate-300 leading-relaxed">
            Registro histórico de todos los análisis ejecutados con IA (Detector PAU y futuros prompts). Consulta cualquier análisis previo guardado en tu base de datos local sin tener que volver a consumir tokens.
          </p>
        </div>

        {outputs.length > 0 && (
          <button
            type="button"
            onClick={() => setIsClearAllModalOpen(true)}
            className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-red-400 px-4 py-2 text-xs font-semibold transition-colors shadow-2xs cursor-pointer self-start sm:self-auto"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Vaciar historial</span>
          </button>
        )}
      </div>

      {/* Barra de Filtros y Búsqueda */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5B5B66] dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por video, prompt o modelo..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-[#121111] placeholder-[#5B5B66]/60 focus:border-emerald-600 focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-2xs font-medium"
          />
        </div>

        <span className="text-xs text-[#5B5B66] dark:text-slate-400 font-mono">
          Mostrando {filteredOutputs.length} de {outputs.length} análisis
        </span>
      </div>

      {/* Contenido / Tabla de Registros */}
      {isLoading ? (
        <div className="rounded-2xl border border-neutral-200 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-950">
          <p className="text-xs text-[#5B5B66] dark:text-slate-400">Cargando registros históricos de IndexedDB...</p>
        </div>
      ) : filteredOutputs.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-[#5B5B66] dark:text-slate-400 shadow-2xs border border-neutral-200 dark:border-slate-800">
            <FileText className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
              {outputs.length === 0 ? 'No hay análisis de prompts guardados todavía' : 'No se encontraron resultados con ese filtro'}
            </h3>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md mx-auto">
              {outputs.length === 0
                ? 'Cuando presiones "✨ Analizar comentarios con IA" en cualquier video y elijas "Ver ahora" o "Ver después", se archivará aquí automáticamente.'
                : 'Intenta buscar con otros términos.'}
            </p>
          </div>
          {outputs.length === 0 && onNavigateToSearch && (
            <button
              type="button"
              onClick={onNavigateToSearch}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 px-4.5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
            >
              <Search className="h-4 w-4" />
              <span>Explorar videos para analizar</span>
            </button>
          )}
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-950">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-neutral-200/90 bg-[#FAFAFA] text-[11px] font-bold uppercase tracking-wider text-[#5B5B66] dark:border-slate-800 dark:bg-slate-900/80 dark:text-slate-400 font-heading">
                  <th className="py-3 px-4">Video Analizado</th>
                  <th className="py-3 px-4">Prompt Ejecutado</th>
                  <th className="py-3 px-4">Modelo Gemini</th>
                  <th className="py-3 px-4 text-center">Comentarios</th>
                  <th className="py-3 px-4">Fecha y Hora</th>
                  <th className="py-3 px-4 text-right">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 text-xs dark:divide-slate-800/80">
                {filteredOutputs.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-neutral-50/70 dark:hover:bg-slate-900/40 transition-colors"
                  >
                    {/* Columna Video */}
                    <td className="py-3 px-4 max-w-xs">
                      <div className="flex items-center gap-3">
                        <div className="relative h-11 w-18 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-slate-800 border border-neutral-200 dark:border-slate-800">
                          {item.thumbnailUrl ? (
                            <img
                              src={item.thumbnailUrl}
                              alt={item.videoTitle}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[#5B5B66]">
                              <Play className="h-4 w-4" />
                            </div>
                          )}
                        </div>
                        <div className="space-y-0.5 min-w-0">
                          <p
                            className="font-bold text-[#121111] dark:text-white line-clamp-1 hover:text-emerald-600 dark:hover:text-emerald-400 cursor-pointer"
                            title={item.videoTitle}
                            onClick={() => {
                              if (onOpenVideoWatch) {
                                onOpenVideoWatch({
                                  id: item.videoId,
                                  title: item.videoTitle,
                                  channelTitle: item.channelTitle || '',
                                  description: '',
                                  publishedAt: '',
                                  thumbnailUrl: item.thumbnailUrl || `https://img.youtube.com/vi/${item.videoId}/hqdefault.jpg`,
                                  itemType: 'video',
                                });
                              }
                            }}
                          >
                            {item.videoTitle}
                          </p>
                          <p className="text-[11px] text-[#5B5B66] dark:text-slate-400 truncate">
                            {item.channelTitle || 'Canal de YouTube'}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Columna Prompt */}
                    <td className="py-3 px-4">
                      <div className="space-y-0.5">
                        <span className="font-semibold text-[#121111] dark:text-slate-200 flex items-center gap-1.5">
                          <Sparkles className="h-3 w-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>{item.promptName}</span>
                        </span>
                        <span className="text-[10px] text-[#5B5B66] dark:text-slate-500 font-mono">
                          ID: {item.promptId}
                        </span>
                      </div>
                    </td>

                    {/* Columna Modelo */}
                    <td className="py-3 px-4">
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200/60 dark:border-emerald-800/60 font-mono">
                        {item.modelUsed.replace('gemini-', '')}
                      </span>
                    </td>

                    {/* Columna Comentarios */}
                    <td className="py-3 px-4 text-center">
                      <span className="font-mono font-bold text-[#121111] dark:text-slate-200 tabular-nums">
                        {item.commentsCount}
                      </span>
                      <span className="block text-[10px] text-[#5B5B66] dark:text-slate-500">
                        ({item.commentsSelectedQty === 'all' ? 'Todos' : `Top ${item.commentsSelectedQty}`})
                      </span>
                    </td>

                    {/* Columna Fecha */}
                    <td className="py-3 px-4 text-[#5B5B66] dark:text-slate-400 whitespace-nowrap">
                      <div className="flex items-center gap-1.5 font-mono text-[11px] tabular-nums">
                        <Calendar className="h-3.5 w-3.5 text-[#5B5B66] dark:text-slate-500 shrink-0" />
                        <span>{new Date(item.createdAt).toLocaleDateString('es-ES', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}</span>
                      </div>
                    </td>

                    {/* Columna Acciones */}
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          onClick={() => setActiveViewingRecord(item)}
                          title="Ver informe completo en pantalla"
                          className="flex items-center gap-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-2.5 py-1.5 text-xs font-semibold transition-all shadow-2xs cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>Ver</span>
                        </button>

                        <button
                          type="button"
                          onClick={() => handleCopyJson(item)}
                          title="Copiar JSON"
                          className="rounded-lg p-1.5 text-[#5B5B66] hover:text-[#121111] hover:bg-neutral-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          {copiedId === item.id ? (
                            <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          ) : (
                            <Copy className="h-3.5 w-3.5" />
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadMarkdown(item)}
                          title="Descargar informe en formato Markdown (.md)"
                          className="rounded-lg p-1.5 text-[#5B5B66] hover:text-blue-600 hover:bg-blue-50 dark:text-slate-400 dark:hover:text-blue-400 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <FileText className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadJson(item)}
                          title="Descargar archivo JSON"
                          className="rounded-lg p-1.5 text-[#5B5B66] hover:text-[#121111] hover:bg-neutral-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800 transition-colors cursor-pointer"
                        >
                          <Download className="h-3.5 w-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => setRecordToDelete(item)}
                          title="Eliminar registro"
                          className="rounded-lg p-1.5 text-[#5B5B66] hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Seguro de Confirmación para Eliminar un Registro */}
      {recordToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                  ¿Eliminar este análisis histórico?
                </h4>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                  Se eliminará permanentemente la salida de prompt del video &quot;{recordToDelete.videoTitle}&quot; de tu base de datos local.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setRecordToDelete(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Eliminar Registro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Seguro para Vaciar Todo el Historial */}
      {isClearAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                  ¿Vaciar todo el historial de salidas de prompts?
                </h4>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                  Esta acción eliminará todos los {outputs.length} registros analizados de IndexedDB. No podrás recuperarlos a menos que vuelvas a analizar los videos.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setIsClearAllModalOpen(false)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmClearAll}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                Sí, vaciar todo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
