'use client';

import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Plus,
  RotateCcw,
  Tag,
  FileCode,
  Info,
  Check,
  AlertCircle,
} from 'lucide-react';
import {
  StoredPrompt,
  COMMON_PROMPT_VARIABLES,
  PRECONFIGURED_PROMPT_GROUPS,
  extractPromptVariables,
} from '@/lib/prompt-library';

interface PromptEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  prompt: StoredPrompt | null;
  onSave: (savedPrompt: StoredPrompt) => void;
  onRestoreDefault?: (id: string) => void;
  availableGroups: string[];
}

export function PromptEditorModal({
  isOpen,
  onClose,
  prompt,
  onSave,
  onRestoreDefault,
  availableGroups,
}: PromptEditorModalProps) {
  const isEditing = Boolean(prompt && prompt.id);

  const [title, setTitle] = useState(prompt?.title || '');
  const [selectedGroup, setSelectedGroup] = useState<string>(
    prompt?.group || 'Análisis PAU'
  );
  const [isCustomGroup, setIsCustomGroup] = useState(false);
  const [customGroupName, setCustomGroupName] = useState('');
  const [description, setDescription] = useState(prompt?.description || '');
  const [promptText, setPromptText] = useState(prompt?.promptText || '');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const currentVariables = extractPromptVariables(promptText);

  // Inserción de variable en el cursor o al final del texto
  const handleInsertVariable = (tag: string) => {
    setPromptText((prev) => {
      if (prev.includes(tag)) {
        return prev;
      }
      return prev ? `${prev}\n\n${tag}` : tag;
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    const cleanTitle = title.trim();
    if (!cleanTitle) {
      setErrorMessage('Por favor ingresa un título o nombre para el prompt.');
      return;
    }

    const cleanGroup = isCustomGroup
      ? customGroupName.trim()
      : selectedGroup.trim();

    if (!cleanGroup) {
      setErrorMessage('Por favor selecciona o define un grupo para el prompt.');
      return;
    }

    const newOrUpdatedPrompt: StoredPrompt = {
      id: prompt?.id || `prompt-${Date.now()}`,
      title: cleanTitle,
      group: cleanGroup,
      description: description.trim(),
      promptText: promptText,
      isBuiltIn: prompt?.isBuiltIn,
      createdAt: prompt?.createdAt || Date.now(),
      updatedAt: Date.now(),
      supportedVariables: currentVariables,
    };

    onSave(newOrUpdatedPrompt);
    onClose();
  };

  const handleRestore = () => {
    if (prompt?.id && onRestoreDefault) {
      onRestoreDefault(prompt.id);
      onClose();
    }
  };

  // Combinar grupos únicos
  const mergedGroups = Array.from(
    new Set([...PRECONFIGURED_PROMPT_GROUPS, ...availableGroups])
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="w-full max-w-3xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-5 max-h-[92vh] flex flex-col dark:border-slate-800 dark:bg-slate-950">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#2848F0] text-white shadow-xs">
              <Sparkles className="h-4 w-4" />
            </span>
            <div>
              <h3 className="text-base font-bold text-[#121111] dark:text-white font-heading">
                {isEditing ? 'Editar Prompt de IA' : 'Crear Nuevo Prompt de IA'}
              </h3>
              <p className="text-xs text-[#5B5B66] dark:text-slate-400">
                Almacena directivas estructuradas con variables para automatizar tareas en el toolkit.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-4 pr-1">
          {errorMessage && (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Fila: Nombre del Prompt y Grupo */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#121111] dark:text-slate-200 flex items-center gap-1.5 font-heading">
                <FileCode className="h-3.5 w-3.5 text-[#2848F0] dark:text-blue-400" />
                <span>Título o Nombre del Prompt</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="ej. Limpiador de Guión con Marcas de Tiempo"
                className="w-full rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3.5 py-2.5 text-xs text-[#121111] dark:text-white placeholder-[#5B5B66]/60 focus:border-[#2848F0] focus:outline-none shadow-2xs font-medium"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#121111] dark:text-slate-200 flex items-center gap-1.5 font-heading">
                <Tag className="h-3.5 w-3.5 text-[#2848F0] dark:text-blue-400" />
                <span>Grupo o Categoría</span>
              </label>
              {!isCustomGroup ? (
                <div className="flex items-center gap-2">
                  <select
                    value={selectedGroup}
                    onChange={(e) => {
                      if (e.target.value === '__new_group__') {
                        setIsCustomGroup(true);
                      } else {
                        setSelectedGroup(e.target.value);
                      }
                    }}
                    className="flex-1 rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3 py-2.5 text-xs text-[#121111] dark:text-white focus:border-[#2848F0] focus:outline-none shadow-2xs cursor-pointer font-medium"
                  >
                    {mergedGroups.map((g) => (
                      <option key={g} value={g} className="dark:bg-slate-900">
                        {g}
                      </option>
                    ))}
                    <option value="__new_group__" className="text-[#2848F0] font-semibold dark:bg-slate-900">
                      + Crear nuevo grupo personalizado...
                    </option>
                  </select>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={customGroupName}
                    onChange={(e) => setCustomGroupName(e.target.value)}
                    placeholder="Nombre del nuevo grupo (ej. Shorts Virales)"
                    className="flex-1 rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3.5 py-2.5 text-xs text-[#121111] dark:text-white placeholder-[#5B5B66]/60 focus:border-[#2848F0] focus:outline-none shadow-2xs font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setIsCustomGroup(false)}
                    className="rounded-xl border border-neutral-200 bg-neutral-100 dark:border-slate-800 dark:bg-slate-800 px-3 py-2.5 text-xs font-semibold text-[#5B5B66] dark:text-slate-300 hover:text-[#121111] cursor-pointer"
                  >
                    Volver
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Indicaciones / Descripción */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-[#121111] dark:text-slate-200 flex items-center gap-1.5 font-heading">
              <Info className="h-3.5 w-3.5 text-[#2848F0] dark:text-blue-400" />
              <span>Indicaciones y Descripción de Uso</span>
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explica qué hace este prompt y en qué casos o pantallas debe ejecutarse..."
              className="w-full rounded-xl border border-neutral-200 bg-white dark:border-slate-800 dark:bg-slate-900 px-3.5 py-2 text-xs text-[#121111] dark:text-white placeholder-[#5B5B66]/60 focus:border-[#2848F0] focus:outline-none shadow-2xs"
            />
          </div>

          {/* Botones de Inserción Rápida de Variables */}
          <div className="space-y-1.5 rounded-2xl border border-neutral-200/80 bg-neutral-50/80 p-3.5 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-[#121111] dark:text-slate-300 font-heading">
                Insertar Variables Dinámicas
              </span>
              <span className="text-[11px] text-[#5B5B66] dark:text-slate-400">
                Haz clic para agregar la variable al texto del prompt
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 pt-1">
              {COMMON_PROMPT_VARIABLES.map((v) => {
                const isPresent = promptText.includes(v.tag);
                return (
                  <button
                    key={v.tag}
                    type="button"
                    onClick={() => handleInsertVariable(v.tag)}
                    title={v.desc}
                    className={`flex items-center gap-1 px-2.5 py-1 text-xs font-mono font-medium rounded-lg border transition-all cursor-pointer ${
                      isPresent
                        ? 'bg-blue-50 text-[#2848F0] border-blue-200 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-800'
                        : 'bg-white text-[#5B5B66] border-neutral-200 hover:border-neutral-300 hover:text-[#121111] dark:bg-slate-950 dark:text-slate-300 dark:border-slate-800'
                    }`}
                  >
                    <Plus className="h-3 w-3" />
                    <span>{v.tag}</span>
                    {isPresent && <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 ml-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cuerpo del Prompt */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs text-[#5B5B66] dark:text-slate-400">
              <span className="font-semibold text-[#121111] dark:text-slate-200 font-heading">
                Cuerpo del Prompt
              </span>
              <span className="font-mono text-[11px]">
                {promptText.length.toLocaleString()} caracteres · {currentVariables.length} variable(s) detectada(s)
              </span>
            </div>
            <textarea
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
              rows={12}
              placeholder="Pega aquí el contenido completo del prompt. Puedes usar variables como {{COMENTARIOS}}, {{GUION}}, {{TITULO}}..."
              className="w-full rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-4 text-xs font-mono text-[#121111] leading-relaxed placeholder-[#5B5B66]/60 focus:border-[#2848F0] focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-blue-500 shadow-inner resize-y"
              spellCheck={false}
            />
          </div>

          {/* Pie de Acciones */}
          <div className="flex items-center justify-between pt-3 border-t border-neutral-100 dark:border-slate-800">
            {prompt?.isBuiltIn && onRestoreDefault ? (
              <button
                type="button"
                onClick={handleRestore}
                className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-red-400 transition-colors shadow-2xs cursor-pointer"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                <span>Restaurar versión de fábrica</span>
              </button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-neutral-200 bg-white px-4 py-2 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="flex items-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-blue-600 dark:hover:bg-blue-500 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:shadow-md transition-all cursor-pointer"
              >
                <Check className="h-3.5 w-3.5" />
                <span>{isEditing ? 'Guardar Cambios' : 'Crear Prompt'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
