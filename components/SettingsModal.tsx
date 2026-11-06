'use client';

import React, { useState, useEffect } from 'react';
import { X, Key, Database, Copy, Check, Shield, Palette, Sparkles, RotateCcw, AlertCircle } from 'lucide-react';
import { SUPABASE_SCHEMA_SQL } from '@/lib/supabase-schema';
import { DEFAULT_PAU_DETECTOR_PROMPT } from '@/lib/pau-prompt';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  apiKey: string;
  onSaveApiKey: (key: string) => void;
  theme: string;
  onChangeTheme: (theme: string) => void;
  autoAnalyze: boolean;
  onToggleAutoAnalyze: (value: boolean) => void;
}

export function SettingsModal({
  isOpen,
  onClose,
  apiKey,
  onSaveApiKey,
  theme,
  onChangeTheme,
}: SettingsModalProps) {
  const [tempApiKey, setTempApiKey] = useState(apiKey);
  const [copiedSql, setCopiedSql] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'preferences' | 'prompts' | 'supabase'>('preferences');

  // Estado del Prompt PAU persistente en LocalStorage
  const [pauPrompt, setPauPrompt] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('pau_detector_prompt');
      if (stored && stored.trim().length > 50) {
        return stored;
      }
    }
    return DEFAULT_PAU_DETECTOR_PROMPT;
  });
  const [savedPromptSuccess, setSavedPromptSuccess] = useState(false);

  if (!isOpen) return null;

  const handleSavePrompt = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('pau_detector_prompt', pauPrompt);
      try {
        const raw = localStorage.getItem('yt_prompts_library');
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex((p: { id: string }) => p.id === 'prompt-pau-default');
          if (idx >= 0) {
            list[idx].promptText = pauPrompt;
            list[idx].updatedAt = Date.now();
            localStorage.setItem('yt_prompts_library', JSON.stringify(list));
          }
        }
      } catch {
        // ignore
      }
      setSavedPromptSuccess(true);
      setTimeout(() => setSavedPromptSuccess(false), 2500);
    }
  };

  const handleRestoreDefaultPrompt = () => {
    setPauPrompt(DEFAULT_PAU_DETECTOR_PROMPT);
    if (typeof window !== 'undefined') {
      localStorage.setItem('pau_detector_prompt', DEFAULT_PAU_DETECTOR_PROMPT);
      try {
        const raw = localStorage.getItem('yt_prompts_library');
        if (raw) {
          const list = JSON.parse(raw);
          const idx = list.findIndex((p: { id: string }) => p.id === 'prompt-pau-default');
          if (idx >= 0) {
            list[idx].promptText = DEFAULT_PAU_DETECTOR_PROMPT;
            list[idx].updatedAt = Date.now();
            localStorage.setItem('yt_prompts_library', JSON.stringify(list));
          }
        }
      } catch {
        // ignore
      }
      setSavedPromptSuccess(true);
      setTimeout(() => setSavedPromptSuccess(false), 2500);
    }
  };

  const handleSavePreferences = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveApiKey(tempApiKey.trim());
    onClose();
  };

  const handleCopySql = () => {
    navigator.clipboard.writeText(SUPABASE_SCHEMA_SQL);
    setCopiedSql(true);
    setTimeout(() => setCopiedSql(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-2xl rounded-2xl border border-neutral-200 bg-white p-6 shadow-2xl space-y-6 max-h-[90vh] flex flex-col dark:border-slate-800 dark:bg-slate-950">
        {/* Encabezado */}
        <div className="flex items-center justify-between border-b border-neutral-100 dark:border-slate-800 pb-4">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-bold text-[#121111] dark:text-white font-heading">
              Configuración del Toolkit
            </h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-xl p-1.5 text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-white transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Selector de subpestañas */}
        <div className="flex items-center gap-1.5 border-b border-neutral-100 dark:border-slate-800/80 pb-2.5 overflow-x-auto">
          <button
            onClick={() => setActiveSubTab('preferences')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all whitespace-nowrap ${
              activeSubTab === 'preferences'
                ? 'bg-[#1C1C1C] text-white shadow-xs dark:bg-slate-800'
                : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            Preferencias Locales
          </button>
          <button
            onClick={() => setActiveSubTab('prompts')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'prompts'
                ? 'bg-[#2848F0] text-white shadow-xs'
                : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Sparkles className="h-3.5 w-3.5" />
            <span>Configuración de Prompts (PAU)</span>
          </button>
          <button
            onClick={() => setActiveSubTab('supabase')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-xl transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeSubTab === 'supabase'
                ? 'bg-[#EEF1F8] text-[#2848F0] border border-[#2848F0]/30 shadow-2xs dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-800/50'
                : 'text-[#5B5B66] hover:text-[#121111] dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Database className="h-3.5 w-3.5 text-[#2848F0] dark:text-emerald-400" />
            <span>Migración a Supabase (SQL DDL)</span>
          </button>
        </div>

        {/* Contenido de la subpestaña activa */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeSubTab === 'preferences' ? (
            <form onSubmit={handleSavePreferences} className="space-y-5">
              {/* Tema visual */}
              <div className="space-y-2.5 rounded-2xl border border-neutral-200/90 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/50 p-4.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#121111] dark:text-slate-200 font-heading">
                  <Palette className="h-4 w-4 text-[#2848F0] dark:text-blue-400" />
                  <span>Tema de la interfaz</span>
                </div>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                  Elige entre el nuevo estilo moderno con fondo blanco inspirado en Beacons o el modo oscuro cinematográfico.
                </p>
                <div className="flex items-center gap-2.5 pt-1">
                  {[
                    { id: 'light', label: 'Modo Claro (Beacons Style)' },
                    { id: 'dark', label: 'Modo Oscuro' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => onChangeTheme(t.id)}
                      className={`px-4 py-2 rounded-xl border text-xs font-semibold transition-all shadow-2xs ${
                        theme === t.id
                          ? 'border-[#2848F0] bg-white text-[#2848F0] ring-2 ring-[#2848F0]/20 dark:border-rose-500 dark:bg-rose-950/40 dark:text-rose-300 dark:ring-rose-500/20'
                          : 'border-neutral-200 bg-white text-[#5B5B66] hover:text-[#121111] hover:border-neutral-300 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* YouTube Data API Key opcional */}
              <div className="space-y-2.5 rounded-2xl border border-neutral-200/90 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900/50 p-4.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#121111] dark:text-slate-200 font-heading">
                  <Key className="h-4 w-4 text-[#2848F0] dark:text-rose-400" />
                  <span>Clave de YouTube Data API v3 (Opcional)</span>
                </div>
                <p className="text-xs text-[#5B5B66] dark:text-slate-400 leading-relaxed">
                  El toolkit funciona perfectamente de forma gratuita con endpoints públicos. Si deseas acceder a cuotas de consulta muy elevadas o estadísticas avanzadas, puedes ingresar tu propia clave de Google Cloud Console.
                </p>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-xs text-[#121111] font-mono placeholder-[#5B5B66]/60 focus:border-[#2848F0] focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:placeholder-slate-600 dark:focus:border-rose-500 shadow-2xs"
                />
                <p className="text-[11px] text-[#5B5B66] dark:text-slate-500">
                  Esta clave se almacena exclusivamente en el LocalStorage de tu navegador.
                </p>
              </div>

              {/* Guardar cambios */}
              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-[#121111] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 transition-colors"
                >
                  Cerrar
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] dark:bg-rose-600 dark:hover:bg-rose-500 px-5 py-2.5 text-xs font-semibold text-white shadow-xs hover:shadow-md transition-all"
                >
                  Guardar Preferencias
                </button>
              </div>
            </form>
          ) : activeSubTab === 'prompts' ? (
            <div className="space-y-4">
              {/* Información del Prompt PAU */}
              <div className="rounded-2xl border border-blue-200 bg-blue-50/70 p-4 space-y-2 dark:border-blue-900/40 dark:bg-blue-950/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-900 dark:text-blue-300 font-heading">
                    <Sparkles className="h-4 w-4 text-[#2848F0] dark:text-blue-400" />
                    <span>Prompt: “Detector de Problemas Urgentes PAU”</span>
                  </div>
                  <span className="text-[11px] px-2.5 py-0.5 rounded-full font-semibold bg-white text-[#2848F0] border border-blue-200 shadow-2xs dark:bg-slate-900 dark:text-blue-300 dark:border-blue-800">
                    Guardado persistente
                  </span>
                </div>
                <p className="text-xs text-blue-950/80 dark:text-slate-300 leading-relaxed">
                  Este prompt se envía a Gemini al presionar <strong>“✨ Analizar comentarios con IA”</strong> en la ficha de un video. Reemplaza dinámicamente el marcador <code className="font-mono bg-white/80 dark:bg-slate-900 px-1 py-0.5 rounded text-blue-700 dark:text-blue-300 font-bold">{`{{COMENTARIOS}}`}</code> por los comentarios ya limpios y ordenados por likes.
                </p>
                <div className="flex items-center gap-2 pt-1 text-[11px]">
                  {pauPrompt.includes('{{COMENTARIOS}}') ? (
                    <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                      <Check className="h-3.5 w-3.5" /> Marcador {`{{COMENTARIOS}}`} detectado correctamente
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium">
                      <AlertCircle className="h-3.5 w-3.5" /> Marcador no encontrado: los comentarios se anexarán automáticamente al final.
                    </span>
                  )}
                </div>
              </div>

              {/* Editor del Prompt */}
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs text-[#5B5B66] dark:text-slate-400">
                  <span className="font-semibold">Cuerpo del Prompt (Editable)</span>
                  <span className="font-mono text-[11px]">{pauPrompt.length.toLocaleString()} caracteres</span>
                </div>
                <textarea
                  value={pauPrompt}
                  onChange={(e) => setPauPrompt(e.target.value)}
                  rows={14}
                  placeholder="Pega aquí tu prompt..."
                  className="w-full rounded-2xl border border-neutral-200 bg-[#FAFAFA] p-4 text-xs font-mono text-[#121111] leading-relaxed placeholder-[#5B5B66]/60 focus:border-[#2848F0] focus:bg-white focus:outline-none dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200 dark:focus:border-blue-500 shadow-inner resize-y"
                  spellCheck={false}
                />
              </div>

              {/* Barra de Acciones del Prompt */}
              <div className="flex items-center justify-between pt-2 border-t border-neutral-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={handleRestoreDefaultPrompt}
                  className="flex items-center gap-1.5 rounded-xl border border-neutral-200 bg-white px-3.5 py-2 text-xs font-semibold text-[#5B5B66] hover:bg-neutral-100 hover:text-red-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 dark:hover:text-red-400 transition-colors shadow-2xs"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Restaurar prompt por defecto</span>
                </button>

                <div className="flex items-center gap-3">
                  {savedPromptSuccess && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400 animate-pulse">
                      <Check className="h-4 w-4" /> ¡Guardado con éxito!
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={handleSavePrompt}
                    className="flex items-center gap-1.5 rounded-xl bg-[#2848F0] hover:bg-[#1E3AC7] text-white px-5 py-2 text-xs font-semibold shadow-xs hover:shadow-md transition-all"
                  >
                    <Check className="h-3.5 w-3.5" />
                    <span>Guardar Prompt</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4.5 space-y-2 dark:border-emerald-900/40 dark:bg-emerald-950/20">
                <div className="flex items-center gap-2 text-xs font-bold text-emerald-800 dark:text-emerald-300 font-heading">
                  <Shield className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Capa de Acceso a Datos lista para Supabase</span>
                </div>
                <p className="text-xs text-emerald-900/80 dark:text-slate-300 leading-relaxed">
                  Hemos aislado la lógica de datos con el patrón <code className="font-semibold text-emerald-800 dark:text-emerald-300">IContentRepository</code>. En cuanto crees tu proyecto en Supabase, copia este script SQL en el Editor SQL de tu panel para crear las tablas <code className="font-semibold text-emerald-800 dark:text-emerald-300">videos</code>, <code className="font-semibold text-emerald-800 dark:text-emerald-300">transcripts</code> y <code className="font-semibold text-emerald-800 dark:text-emerald-300">generated_content</code> con políticas RLS de seguridad activadas.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-xs font-mono font-medium text-[#5B5B66] dark:text-slate-400">supabase_schema.sql</span>
                <button
                  onClick={handleCopySql}
                  className="flex items-center gap-1 rounded-xl border border-neutral-200 bg-white px-3 py-1.5 text-xs font-semibold text-[#121111] hover:bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 transition-colors shadow-2xs"
                >
                  {copiedSql ? <Check className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                  <span>{copiedSql ? 'Copiado al portapapeles' : 'Copiar SQL DDL'}</span>
                </button>
              </div>

              <div className="rounded-2xl border border-neutral-200 bg-[#FAFAFA] dark:border-slate-800 dark:bg-slate-950 p-4 max-h-72 overflow-y-auto">
                <pre className="font-mono text-[11px] text-[#121111] dark:text-slate-300 leading-relaxed">
                  {SUPABASE_SCHEMA_SQL}
                </pre>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
