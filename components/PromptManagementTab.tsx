'use client';

import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Plus,
  Search,
  Copy,
  Check,
  Edit3,
  Trash2,
  RotateCcw,
  Tag,
  AlertTriangle,
  FileCode,
  Layers,
  Terminal,
} from 'lucide-react';
import {
  StoredPrompt,
  getStoredPrompts,
  saveStoredPrompt,
  deleteStoredPrompt,
  restorePromptToDefault,
  PRECONFIGURED_PROMPT_GROUPS,
} from '@/lib/prompt-library';
import { PromptEditorModal } from './PromptEditorModal';

export function PromptManagementTab() {
  const [prompts, setPrompts] = useState<StoredPrompt[]>(() => {
    return getStoredPrompts();
  });

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<string>('all');
  const [editorPrompt, setEditorPrompt] = useState<StoredPrompt | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [promptToDelete, setPromptToDelete] = useState<StoredPrompt | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [actionToast, setActionToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setActionToast(msg);
    setTimeout(() => {
      setActionToast(null);
    }, 2800);
  };

  // Grupos únicos disponibles
  const availableGroups = useMemo(() => {
    const fromPrompts = prompts.map((p) => p.group).filter(Boolean);
    return Array.from(new Set([...PRECONFIGURED_PROMPT_GROUPS, ...fromPrompts]));
  }, [prompts]);

  // Filtrar prompts
  const filteredPrompts = useMemo(() => {
    return prompts.filter((p) => {
      const group = p.group || '';
      const matchesGroup =
        selectedGroup === 'all' || group.toLowerCase() === selectedGroup.toLowerCase();
      if (!matchesGroup) return false;

      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      return (
        (p.title || '').toLowerCase().includes(q) ||
        group.toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q) ||
        (p.promptText || '').toLowerCase().includes(q)
      );
    });
  }, [prompts, selectedGroup, searchQuery]);

  const handleOpenNewPrompt = () => {
    setEditorPrompt(null);
    setIsEditorOpen(true);
  };

  const handleOpenEdit = (prompt: StoredPrompt) => {
    setEditorPrompt(prompt);
    setIsEditorOpen(true);
  };

  const handleSavePrompt = (saved: StoredPrompt) => {
    const updated = saveStoredPrompt(saved);
    setPrompts([...updated]);
    showToast(
      saved.id === editorPrompt?.id
        ? `Prompt "${saved.title}" actualizado con éxito`
        : `Nuevo prompt "${saved.title}" creado`
    );
  };

  const handleConfirmDelete = () => {
    if (!promptToDelete) return;
    const isPau = promptToDelete.id === 'prompt-pau-default';
    const updated = deleteStoredPrompt(promptToDelete.id);
    setPrompts([...updated]);
    setPromptToDelete(null);
    showToast(
      isPau
        ? 'El contenido del Detector PAU se ha vaciado en blanco'
        : `Prompt "${promptToDelete.title}" eliminado`
    );
  };

  const handleRestoreDefault = (id: string) => {
    const updated = restorePromptToDefault(id);
    setPrompts([...updated]);
    const restored = updated.find((p) => p.id === id);
    showToast(`Prompt "${restored?.title || id}" restaurado a versión de fábrica`);
  };

  const handleCopyPromptText = (prompt: StoredPrompt) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(prompt.promptText ?? '');
      setCopiedId(prompt.id);
      showToast(`Prompt "${prompt.title}" copiado al portapapeles`);
      setTimeout(() => {
        setCopiedId(null);
      }, 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast de confirmación flotante */}
      {actionToast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-2xl bg-[#1C1C1C] dark:bg-slate-800 text-white px-4 py-3 text-xs font-semibold shadow-xl border border-white/10 animate-in fade-in slide-in-from-bottom-2 duration-200">
          <Check className="h-4 w-4 text-emerald-400 shrink-0" />
          <span>{actionToast}</span>
        </div>
      )}

      {/* Encabezado Principal */}
      <div className="rounded-3xl border border-neutral-200/90 bg-gradient-to-r from-blue-50/70 via-indigo-50/40 to-white p-6 sm:p-8 dark:border-slate-800 dark:bg-gradient-to-r dark:from-slate-900/80 dark:via-blue-950/20 dark:to-slate-950 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-5">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[#2848F0] text-white shadow-xs">
              <Terminal className="h-5 w-5" />
            </span>
            <h2 className="text-xl sm:text-2xl font-bold text-[#121111] dark:text-white font-heading">
              Gestión de Prompts de IA
            </h2>
            <span className="text-xs text-[#5B5B66] dark:text-slate-400 font-mono">
              ({prompts.length} disponibles)
            </span>
          </div>
          <p className="text-xs sm:text-sm text-[#5B5B66] dark:text-slate-300 leading-relaxed">
            Almacén centralizado de directivas para inteligencia artificial. Crea y edita prompts especializados por grupos para ejecutarlos en el análisis de comentarios PAU, limpieza de guiones o generación de miniaturas.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenNewPrompt}
          className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] text-white px-5 py-2.5 text-xs font-bold transition-all shadow-xs hover:shadow-md cursor-pointer whitespace-nowrap self-start sm:self-auto"
        >
          <Plus className="h-4 w-4" />
          <span>Crear Nuevo Prompt</span>
        </button>
      </div>

      {/* Barra de herramientas: Búsqueda y Filtros de Grupo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Selector interactivo de grupos */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 max-w-full">
          <button
            type="button"
            onClick={() => setSelectedGroup('all')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
              selectedGroup === 'all'
                ? 'bg-[#1C1C1C] text-white shadow-2xs dark:bg-slate-800'
                : 'bg-white border border-neutral-200 text-[#5B5B66] hover:text-[#121111] hover:border-neutral-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
            }`}
          >
            Todos ({prompts.length})
          </button>
          {availableGroups.map((group) => {
            const count = prompts.filter((p) => (p.group || '').toLowerCase() === group.toLowerCase()).length;
            const isActive = selectedGroup.toLowerCase() === group.toLowerCase();
            return (
              <button
                key={group}
                type="button"
                onClick={() => setSelectedGroup(group)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-[#2848F0] text-white shadow-2xs dark:bg-blue-600'
                    : 'bg-white border border-neutral-200 text-[#5B5B66] hover:text-[#121111] hover:border-neutral-300 dark:bg-slate-900 dark:border-slate-800 dark:text-slate-300'
                }`}
              >
                {group} ({count})
              </button>
            );
          })}
        </div>

        {/* Buscador */}
        <div className="relative w-full md:w-72 shrink-0">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#5B5B66] dark:text-slate-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por título, texto o variable..."
            className="w-full rounded-xl border border-neutral-200 bg-white py-2 pl-9 pr-3 text-xs text-[#121111] placeholder-[#5B5B66]/60 focus:border-[#2848F0] focus:outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200 shadow-2xs font-medium"
          />
        </div>
      </div>

      {/* Grid de Tarjetas de Prompts */}
      {filteredPrompts.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/30 p-12 text-center space-y-4">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white dark:bg-slate-900 text-[#5B5B66] dark:text-slate-400 shadow-2xs border border-neutral-200 dark:border-slate-800">
            <Layers className="h-6 w-6 text-[#2848F0] dark:text-blue-400" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-[#121111] dark:text-slate-200 font-heading">
              No se encontraron prompts en este grupo
            </h3>
            <p className="text-xs text-[#5B5B66] dark:text-slate-400 max-w-md mx-auto">
              Prueba con otro término de búsqueda o crea un nuevo prompt para la categoría seleccionada.
            </p>
          </div>
          <button
            type="button"
            onClick={handleOpenNewPrompt}
            className="inline-flex items-center gap-2 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] px-4.5 py-2 text-xs font-bold text-white shadow-xs cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span>Crear Prompt Nuevo</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredPrompts.map((p) => {
            const isPau = p.id === 'prompt-pau-default';
            const promptText = p.promptText ?? '';
            const charCount = promptText.length;
            const variables = Array.isArray(p.supportedVariables) ? p.supportedVariables : [];

            return (
              <div
                key={p.id}
                className="group rounded-2xl border border-neutral-200 bg-white p-5 hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-slate-700 transition-all shadow-xs hover:shadow-md flex flex-col justify-between"
              >
                <div className="space-y-3">
                  {/* Fila Superior: Grupo y Estado Built-in */}
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-[#2848F0] dark:text-blue-400 flex items-center gap-1">
                      <Tag className="h-3 w-3" />
                      <span>{p.group}</span>
                    </span>
                    <span className="text-[11px] text-[#5B5B66] dark:text-slate-500 font-mono">
                      {charCount.toLocaleString()} caracteres
                    </span>
                  </div>

                  {/* Título */}
                  <h3 className="text-sm font-bold text-[#121111] dark:text-white font-heading line-clamp-1">
                    {p.title}
                  </h3>

                  {/* Descripción de uso */}
                  <p className="text-xs text-[#5B5B66] dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {p.description || 'Sin descripción de uso.'}
                  </p>

                  {/* Variables dinámicas detectadas */}
                  {variables.length > 0 && (
                    <div className="flex flex-wrap items-center gap-1 pt-1">
                      {variables.map((v) => (
                        <span
                          key={v}
                          className="font-mono text-[10px] font-semibold text-blue-700 bg-blue-50 dark:text-blue-300 dark:bg-blue-950/60 rounded px-1.5 py-0.5 border border-blue-200/60 dark:border-blue-900/60"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Vista previa del prompt */}
                  <div className="rounded-xl border border-neutral-200/70 bg-[#FAFAFA] dark:border-slate-800/80 dark:bg-slate-900/60 p-3 text-[11px] font-mono text-[#5B5B66] dark:text-slate-400 line-clamp-3 leading-relaxed select-none">
                    {promptText || <span className="italic text-red-500">Prompt vacío (en blanco)</span>}
                  </div>
                </div>

                {/* Acciones de la Tarjeta */}
                <div className="flex items-center justify-between pt-4 mt-4 border-t border-neutral-100 dark:border-slate-800/80">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleCopyPromptText(p)}
                      title="Copiar texto del prompt"
                      className="flex items-center gap-1 rounded-lg border border-neutral-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-[#5B5B66] hover:text-[#121111] hover:bg-neutral-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:text-white transition-colors cursor-pointer shadow-2xs"
                    >
                      {copiedId === p.id ? (
                        <>
                          <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                          <span className="text-emerald-600 dark:text-emerald-400">Copiado</span>
                        </>
                      ) : (
                        <>
                          <Copy className="h-3.5 w-3.5" />
                          <span>Copiar</span>
                        </>
                      )}
                    </button>

                    {p.isBuiltIn && (
                      <button
                        type="button"
                        onClick={() => handleRestoreDefault(p.id)}
                        title="Restaurar a versión de fábrica"
                        className="rounded-lg p-1.5 text-[#5B5B66] hover:text-[#121111] hover:bg-neutral-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-900 transition-colors cursor-pointer"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      title="Editar prompt"
                      className="flex items-center gap-1 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-[#121111] dark:bg-slate-800 dark:hover:bg-slate-700 dark:text-white px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
                    >
                      <Edit3 className="h-3.5 w-3.5" />
                      <span>Editar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPromptToDelete(p)}
                      title={isPau ? 'Vaciar prompt a blanco' : 'Eliminar prompt'}
                      className="rounded-lg p-1.5 text-[#5B5B66] hover:text-red-600 hover:bg-red-50 dark:text-slate-400 dark:hover:text-red-400 dark:hover:bg-red-950/40 transition-colors cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Edición / Creación */}
      {isEditorOpen && (
        <PromptEditorModal
          isOpen={isEditorOpen}
          onClose={() => setIsEditorOpen(false)}
          prompt={editorPrompt}
          onSave={handleSavePrompt}
          onRestoreDefault={handleRestoreDefault}
          availableGroups={availableGroups}
        />
      )}

      {/* Modal Seguro de Confirmación de Eliminación */}
      {promptToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="w-full max-w-md rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-4 dark:border-slate-800 dark:bg-slate-950">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-100 text-red-600 dark:bg-red-950/60 dark:text-red-400">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-[#121111] dark:text-white font-heading">
                  {promptToDelete.id === 'prompt-pau-default'
                    ? '¿Vaciar el Detector de Problemas PAU?'
                    : '¿Eliminar este prompt?'}
                </h4>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                  {promptToDelete.id === 'prompt-pau-default'
                    ? 'Al ser el prompt base del sistema, su contenido se dejará completamente en blanco como solicitaste. Podrás restaurarlo en cualquier momento usando el botón de fábrica.'
                    : `Estás a punto de eliminar permanentemente "${promptToDelete.title}". Esta acción no se puede deshacer.`}
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-neutral-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => setPromptToDelete(null)}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="rounded-xl bg-red-600 hover:bg-red-700 text-white px-4 py-2 text-xs font-semibold shadow-xs transition-colors cursor-pointer"
              >
                {promptToDelete.id === 'prompt-pau-default' ? 'Vaciar a blanco' : 'Eliminar prompt'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
