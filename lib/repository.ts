import { getDatabase, checkStorageEstimate } from './db';
import {
  IContentRepository,
  YouTubeVideoMetadata,
  VideoTranscript,
  GeneratedContentItem,
  OperationLog,
  StorageEstimateInfo,
  VideoCommentsData,
  UserPlaylist,
  PlaylistItem,
  YouTubeSearchResultItem,
  PromptExecutionRecord,
} from './types';

export class IndexedDBContentRepository implements IContentRepository {
  private get db() {
    return getDatabase();
  }

  // Videos
  async saveVideo(video: YouTubeVideoMetadata): Promise<string> {
    try {
      const existing = await this.db.videos.get(video.videoId);
      const toSave: YouTubeVideoMetadata = {
        ...video,
        isFavorite: video.isFavorite !== undefined ? video.isFavorite : Boolean(existing?.isFavorite),
        createdAt: video.createdAt || existing?.createdAt || Date.now(),
      };
      await this.db.videos.put(toSave);
      await this.logOperation({
        videoId: video.videoId,
        operationType: 'metadata_fetch',
        status: 'success',
        message: `Video guardado en IndexedDB: ${video.title}`,
        timestamp: Date.now(),
      });
      return video.videoId;
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === 'QuotaExceededError') {
        throw new Error('La cuota de almacenamiento del navegador se ha superado. Por favor, limpia la biblioteca en Configuración.');
      }
      throw error;
    }
  }

  async getVideo(videoId: string): Promise<YouTubeVideoMetadata | undefined> {
    return this.db.videos.get(videoId);
  }

  async getAllVideos(): Promise<YouTubeVideoMetadata[]> {
    return this.db.videos.orderBy('createdAt').reverse().toArray();
  }

  async toggleFavorite(videoId: string): Promise<boolean> {
    const video = await this.getVideo(videoId);
    if (!video) return false;
    const newStatus = !video.isFavorite;
    await this.db.videos.update(videoId, { isFavorite: newStatus });
    return newStatus;
  }

  async isFavoriteVideo(videoId: string): Promise<boolean> {
    const video = await this.getVideo(videoId);
    return Boolean(video?.isFavorite);
  }

  async saveFavoriteVideo(v: YouTubeSearchResultItem | YouTubeVideoMetadata): Promise<boolean> {
    const videoId = 'videoId' in v ? v.videoId : v.id;
    const existing = await this.getVideo(videoId);
    if (!existing) {
      const newVideo: YouTubeVideoMetadata = {
        videoId,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        title: v.title,
        description: v.description || '',
        channelTitle: v.channelTitle || 'Canal',
        publishedAt: v.publishedAt || 'Reciente',
        duration: 'duration' in v ? v.duration : ('durationText' in v ? v.durationText : undefined),
        durationSeconds: 'durationSeconds' in v ? (v as any).durationSeconds : undefined,
        viewCount: 'viewCount' in v ? v.viewCount : ('viewCountText' in v ? v.viewCountText : undefined),
        thumbnails: {
          hq: {
            quality: 'hq',
            label: 'Alta calidad',
            url: 'thumbnailUrl' in v && v.thumbnailUrl ? v.thumbnailUrl : ('thumbnails' in v && v.thumbnails?.hq?.url ? v.thumbnails.hq.url : `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`),
            width: 480,
            height: 360,
          },
          mq: {
            quality: 'mq',
            label: 'Media',
            url: 'thumbnailUrl' in v && v.thumbnailUrl ? v.thumbnailUrl : ('thumbnails' in v && v.thumbnails?.mq?.url ? v.thumbnails.mq.url : `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`),
            width: 320,
            height: 180,
          },
          default: {
            quality: 'default',
            label: 'Estándar',
            url: 'thumbnailUrl' in v && v.thumbnailUrl ? v.thumbnailUrl : ('thumbnails' in v && v.thumbnails?.default?.url ? v.thumbnails.default.url : `https://img.youtube.com/vi/${videoId}/default.jpg`),
            width: 120,
            height: 90,
          },
        },
        createdAt: Date.now(),
        isFavorite: true,
      };
      await this.saveVideo(newVideo);
      return true;
    } else {
      const newStatus = !existing.isFavorite;
      await this.db.videos.update(videoId, { isFavorite: newStatus });
      return newStatus;
    }
  }

  async deleteVideo(videoId: string): Promise<void> {
    await this.db.videos.delete(videoId);
    // Eliminar también transcripciones, comentarios y contenido asociado para mantener la integridad
    await this.deleteTranscript(videoId);
    await this.deleteComments(videoId);
    const relatedAi = await this.getGeneratedContentForVideo(videoId);
    for (const item of relatedAi) {
      if (item.id) await this.deleteGeneratedContent(item.id);
    }
  }

  // Transcripts
  async saveTranscript(transcript: VideoTranscript): Promise<number> {
    try {
      // Si ya existe una transcripción para este videoId, la actualizamos
      const existing = await this.db.transcripts.where('videoId').equals(transcript.videoId).first();
      const id = (await this.db.transcripts.put(
        existing?.id ? { ...transcript, id: existing.id } : transcript
      )) as number;

      await this.logOperation({
        videoId: transcript.videoId,
        operationType: 'transcript_fetch',
        status: 'success',
        message: `Transcripción guardada (${transcript.segments.length} fragmentos)`,
        timestamp: Date.now(),
      });
      return id;
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === 'QuotaExceededError') {
        throw new Error('Almacenamiento lleno al guardar la transcripción.');
      }
      throw error;
    }
  }

  async getTranscript(videoId: string): Promise<VideoTranscript | undefined> {
    return this.db.transcripts.where('videoId').equals(videoId).first();
  }

  async deleteTranscript(videoId: string): Promise<void> {
    await this.db.transcripts.where('videoId').equals(videoId).delete();
  }

  // Comments
  async saveComments(comments: VideoCommentsData): Promise<void> {
    try {
      await this.db.comments.put(comments);
      await this.logOperation({
        videoId: comments.videoId,
        operationType: 'metadata_fetch',
        status: 'success',
        message: `Comentarios guardados (${comments.comments.length} comentarios)`,
        timestamp: Date.now(),
      });
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === 'QuotaExceededError') {
        throw new Error('Almacenamiento lleno al guardar los comentarios.');
      }
      throw error;
    }
  }

  async getComments(videoId: string): Promise<VideoCommentsData | undefined> {
    return this.db.comments.get(videoId);
  }

  async deleteComments(videoId: string): Promise<void> {
    await this.db.comments.delete(videoId);
  }

  // AI Generated Content
  async saveGeneratedContent(item: Omit<GeneratedContentItem, 'id'>): Promise<number> {
    try {
      const id = (await this.db.generated_content.add(item as GeneratedContentItem)) as number;
      await this.logOperation({
        videoId: item.videoId,
        operationType: 'ai_repurpose',
        status: 'success',
        message: `Contenido generado con IA (${item.type})`,
        timestamp: Date.now(),
      });
      return id;
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === 'QuotaExceededError') {
        throw new Error('Almacenamiento lleno al guardar el contenido generado con IA.');
      }
      throw error;
    }
  }

  async getGeneratedContentForVideo(videoId: string): Promise<GeneratedContentItem[]> {
    return this.db.generated_content.where('videoId').equals(videoId).reverse().toArray();
  }

  async getAllGeneratedContent(): Promise<GeneratedContentItem[]> {
    return this.db.generated_content.orderBy('createdAt').reverse().toArray();
  }

  async deleteGeneratedContent(id: number): Promise<void> {
    await this.db.generated_content.delete(id);
  }

  // Operations Log
  async logOperation(op: Omit<OperationLog, 'id'>): Promise<number> {
    try {
      // Limitar el historial de operaciones a las últimas 100 para no inflar IndexedDB
      const count = await this.db.operations.count();
      if (count > 100) {
        const oldest = await this.db.operations.orderBy('timestamp').first();
        if (oldest?.id) await this.db.operations.delete(oldest.id);
      }
      return (await this.db.operations.add(op as OperationLog)) as number;
    } catch {
      return 0;
    }
  }

  async getOperations(limit = 20): Promise<OperationLog[]> {
    return this.db.operations.orderBy('timestamp').reverse().limit(limit).toArray();
  }

  // Favorite Channels
  async saveFavoriteChannel(channel: import('./types').FavoriteChannel): Promise<string> {
    try {
      await this.db.favorite_channels.put(channel);
      await this.logOperation({
        operationType: 'metadata_fetch',
        status: 'success',
        message: `Canal añadido a favoritos: ${channel.title}`,
        timestamp: Date.now(),
      });
      return channel.channelId;
    } catch (err: unknown) {
      const error = err as Error;
      if (error?.name === 'QuotaExceededError') {
        throw new Error('Almacenamiento lleno al guardar el canal en favoritos.');
      }
      throw error;
    }
  }

  async removeFavoriteChannel(channelId: string): Promise<void> {
    await this.db.favorite_channels.delete(channelId);
  }

  async getFavoriteChannels(): Promise<import('./types').FavoriteChannel[]> {
    return this.db.favorite_channels.orderBy('addedAt').reverse().toArray();
  }

  async isFavoriteChannel(channelId: string): Promise<boolean> {
    const item = await this.db.favorite_channels.get(channelId);
    return Boolean(item);
  }

  // Playlists (Listas de Reproducción)
  async createPlaylist(name: string, description = '', color = '#2848F0'): Promise<UserPlaylist> {
    const id = `pl_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const playlist: UserPlaylist = {
      id,
      name: name.trim() || 'Nueva Lista',
      description: description.trim(),
      color,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      items: [],
    };
    await this.db.playlists.put(playlist);
    return playlist;
  }

  async getAllPlaylists(): Promise<UserPlaylist[]> {
    try {
      const list = await this.db.playlists.orderBy('updatedAt').reverse().toArray();
      if (list.length === 0) {
        // Solo crear 'Mi Mix Favorito' la primera vez absoluta, nunca después si el usuario la borró
        const hasInit = typeof window !== 'undefined' ? localStorage.getItem('has_init_default_playlist') : 'true';
        if (!hasInit) {
          if (typeof window !== 'undefined') {
            localStorage.setItem('has_init_default_playlist', 'true');
          }
          const defaultPl = await this.createPlaylist(
            'Mi Mix Favorito',
            'Lista de reproducción predeterminada para reproducir canciones y videos seguidos'
          );
          return [defaultPl];
        }
        return [];
      }
      if (typeof window !== 'undefined' && !localStorage.getItem('has_init_default_playlist')) {
        localStorage.setItem('has_init_default_playlist', 'true');
      }
      return list;
    } catch {
      return [];
    }
  }

  async getPlaylist(id: string): Promise<UserPlaylist | undefined> {
    return this.db.playlists.get(id);
  }

  async addVideoToPlaylist(playlistId: string, item: PlaylistItem): Promise<void> {
    const pl = await this.getPlaylist(playlistId);
    if (!pl) return;
    const exists = pl.items.some((i) => i.id === item.id);
    if (!exists) {
      pl.items.push({ ...item, addedAt: item.addedAt || Date.now() });
    }
    pl.updatedAt = Date.now();
    await this.db.playlists.put(pl);
  }

  async removeVideoFromPlaylist(playlistId: string, videoId: string): Promise<void> {
    const pl = await this.getPlaylist(playlistId);
    if (!pl) return;
    pl.items = pl.items.filter((i) => i.id !== videoId);
    pl.updatedAt = Date.now();
    await this.db.playlists.put(pl);
  }

  async deletePlaylist(playlistId: string): Promise<void> {
    await this.db.playlists.delete(playlistId);
  }

  // Prompt Outputs (Salidas de Prompts)
  async savePromptOutput(record: PromptExecutionRecord): Promise<void> {
    await this.db.prompt_outputs.put(record);
    await this.logOperation({
      videoId: record.videoId,
      operationType: 'ai_repurpose',
      status: 'success',
      message: `Salida de prompt guardada: ${record.promptName} (${record.commentsCount} comentarios)`,
      timestamp: Date.now(),
    });
  }

  async getAllPromptOutputs(): Promise<PromptExecutionRecord[]> {
    return this.db.prompt_outputs.orderBy('createdAt').reverse().toArray();
  }

  async getPromptOutputsByVideo(videoId: string): Promise<PromptExecutionRecord[]> {
    return this.db.prompt_outputs
      .where('videoId')
      .equals(videoId)
      .reverse()
      .sortBy('createdAt');
  }

  async deletePromptOutput(id: string): Promise<void> {
    await this.db.prompt_outputs.delete(id);
  }

  async clearAllPromptOutputs(): Promise<void> {
    await this.db.prompt_outputs.clear();
  }

  // Maintenance
  async clearAllData(): Promise<void> {
    await this.db.videos.clear();
    await this.db.transcripts.clear();
    await this.db.comments.clear();
    await this.db.generated_content.clear();
    await this.db.operations.clear();
    await this.db.favorite_channels.clear();
    await this.db.playlists.clear();
    await this.db.prompt_outputs.clear();
    await this.logOperation({
      operationType: 'storage_clear',
      status: 'warning',
      message: 'Todos los datos de la base de datos local fueron eliminados',
      timestamp: Date.now(),
    });
  }

  async getStorageEstimate(): Promise<StorageEstimateInfo> {
    return checkStorageEstimate();
  }
}

// Factoría desacoplada: Facilita inyectar SupabaseRepository en el futuro sin modificar la UI
let repositoryInstance: IContentRepository | null = null;

export function getContentRepository(): IContentRepository {
  if (!repositoryInstance) {
    repositoryInstance = new IndexedDBContentRepository();
  }
  return repositoryInstance;
}
