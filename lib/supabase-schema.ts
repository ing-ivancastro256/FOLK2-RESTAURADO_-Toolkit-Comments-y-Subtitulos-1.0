/**
 * Esquema SQL preparado para ejecutar directamente en el Editor SQL de Supabase.
 * Incluye tablas tipadas, índices de rendimiento y políticas de seguridad RLS.
 */
export const SUPABASE_SCHEMA_SQL = `-- ==============================================================
-- YOUTUBE CONTENT TOOLKIT — ESQUEMA COMPLETO PARA SUPABASE
-- ==============================================================

-- 1. Habilitar extensión para UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. TABLA: videos (Historial de videos analizados)
CREATE TABLE IF NOT EXISTS public.videos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id VARCHAR(11) NOT NULL,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    channel_title TEXT,
    channel_url TEXT,
    published_at TIMESTAMPTZ,
    duration_seconds INTEGER DEFAULT 0,
    duration TEXT,
    view_count BIGINT DEFAULT 0,
    like_count BIGINT DEFAULT 0,
    comment_count BIGINT DEFAULT 0,
    tags TEXT[] DEFAULT ARRAY[]::TEXT[],
    thumbnails JSONB NOT NULL,
    is_live BOOLEAN DEFAULT FALSE,
    is_short BOOLEAN DEFAULT FALSE,
    is_favorite BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_video UNIQUE (user_id, video_id)
);

-- Índices para búsqueda rápida
CREATE INDEX IF NOT EXISTS idx_videos_user_id ON public.videos(user_id);
CREATE INDEX IF NOT EXISTS idx_videos_video_id ON public.videos(video_id);
CREATE INDEX IF NOT EXISTS idx_videos_created_at ON public.videos(created_at DESC);

-- 3. TABLA: transcripts (Transcripciones y marcas de tiempo)
CREATE TABLE IF NOT EXISTS public.transcripts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id VARCHAR(11) NOT NULL,
    language VARCHAR(10) DEFAULT 'es',
    language_name TEXT,
    is_auto_generated BOOLEAN DEFAULT FALSE,
    segments JSONB NOT NULL,
    full_text TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_video_transcript UNIQUE (user_id, video_id)
);

CREATE INDEX IF NOT EXISTS idx_transcripts_user_video ON public.transcripts(user_id, video_id);

-- 4. TABLA: generated_content (Borradores y piezas creadas con IA)
CREATE TABLE IF NOT EXISTS public.generated_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    video_id VARCHAR(11) NOT NULL,
    video_title TEXT NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'shorts_script', 'twitter_thread', 'linkedin_post', 'newsletter_summary'
    title TEXT NOT NULL,
    content TEXT NOT NULL,
    model_used VARCHAR(50) DEFAULT 'gemini-3.8-flash',
    is_saved BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_generated_content_user_id ON public.generated_content(user_id);
CREATE INDEX IF NOT EXISTS idx_generated_content_video_id ON public.generated_content(video_id);

-- ==============================================================
-- POLÍTICAS DE SEGURIDAD (ROW LEVEL SECURITY - RLS)
-- ==============================================================

ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.generated_content ENABLE ROW LEVEL SECURITY;

-- Políticas para 'videos'
CREATE POLICY "Los usuarios pueden ver únicamente sus videos guardados"
ON public.videos FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden insertar sus propios videos"
ON public.videos FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden actualizar sus propios videos"
ON public.videos FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Los usuarios pueden eliminar sus propios videos"
ON public.videos FOR DELETE
USING (auth.uid() = user_id);

-- Políticas para 'transcripts'
CREATE POLICY "Los usuarios pueden gestionar sus propias transcripciones"
ON public.transcripts FOR ALL
USING (auth.uid() = user_id);

-- Políticas para 'generated_content'
CREATE POLICY "Los usuarios pueden gestionar sus contenidos generados"
ON public.generated_content FOR ALL
USING (auth.uid() = user_id);
`;
