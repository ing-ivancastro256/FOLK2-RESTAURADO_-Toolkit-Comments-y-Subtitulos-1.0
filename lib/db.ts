import Dexie, { type Table } from 'dexie';
import {
  YouTubeVideoMetadata,
  VideoTranscript,
  GeneratedContentItem,
  OperationLog,
  StorageEstimateInfo,
  VideoCommentsData,
} from './types';

export class YouTubeToolkitDB extends Dexie {
  videos!: Table<YouTubeVideoMetadata, string>;
  transcripts!: Table<VideoTranscript, number>;
  generated_content!: Table<GeneratedContentItem, number>;
  operations!: Table<OperationLog, number>;
  comments!: Table<VideoCommentsData, string>;
  favorite_channels!: Table<import('./types').FavoriteChannel, string>;
  playlists!: Table<import('./types').UserPlaylist, string>;
  prompt_outputs!: Table<import('./types').PromptExecutionRecord, string>;

  constructor() {
    super('YouTubeToolkitDB');

    this.version(1).stores({
      videos: 'videoId, title, channelTitle, publishedAt, createdAt, isFavorite',
      transcripts: '++id, videoId, language, createdAt',
      generated_content: '++id, videoId, type, createdAt, isSaved',
      operations: '++id, videoId, operationType, status, timestamp',
    });

    this.version(2).stores({
      videos: 'videoId, title, channelTitle, publishedAt, createdAt, isFavorite',
      transcripts: '++id, videoId, language, createdAt',
      generated_content: '++id, videoId, type, createdAt, isSaved',
      operations: '++id, videoId, operationType, status, timestamp',
      comments: 'videoId, fetchedAt',
    });

    this.version(3).stores({
      videos: 'videoId, title, channelTitle, publishedAt, createdAt, isFavorite',
      transcripts: '++id, videoId, language, createdAt',
      generated_content: '++id, videoId, type, createdAt, isSaved',
      operations: '++id, videoId, operationType, status, timestamp',
      comments: 'videoId, fetchedAt',
      favorite_channels: 'channelId, title, handle, addedAt',
    });

    this.version(4).stores({
      videos: 'videoId, title, channelTitle, publishedAt, createdAt, isFavorite',
      transcripts: '++id, videoId, language, createdAt',
      generated_content: '++id, videoId, type, createdAt, isSaved',
      operations: '++id, videoId, operationType, status, timestamp',
      comments: 'videoId, fetchedAt',
      favorite_channels: 'channelId, title, handle, addedAt',
      playlists: 'id, name, createdAt, updatedAt',
    });

    this.version(5).stores({
      videos: 'videoId, title, channelTitle, publishedAt, createdAt, isFavorite',
      transcripts: '++id, videoId, language, createdAt',
      generated_content: '++id, videoId, type, createdAt, isSaved',
      operations: '++id, videoId, operationType, status, timestamp',
      comments: 'videoId, fetchedAt',
      favorite_channels: 'channelId, title, handle, addedAt',
      playlists: 'id, name, createdAt, updatedAt',
      prompt_outputs: 'id, promptId, videoId, modelUsed, createdAt',
    });
  }
}

// Singleton de base de datos para navegador
let dbInstance: YouTubeToolkitDB | null = null;

export function getDatabase(): YouTubeToolkitDB {
  if (typeof window === 'undefined') {
    // Si estamos en server-side Next.js, creamos una instancia dummy o lanzamos un error claro
    return new YouTubeToolkitDB();
  }
  if (!dbInstance) {
    dbInstance = new YouTubeToolkitDB();
  }
  return dbInstance;
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export async function checkStorageEstimate(): Promise<StorageEstimateInfo> {
  if (typeof window !== 'undefined' && 'storage' in navigator && 'estimate' in navigator.storage) {
    try {
      const estimate = await navigator.storage.estimate();
      const quota = estimate.quota || 0;
      const usage = estimate.usage || 0;
      const percentage = quota > 0 ? (usage / quota) * 100 : 0;

      return {
        quotaBytes: quota,
        usageBytes: usage,
        percentageUsed: Number(percentage.toFixed(2)),
        quotaFormatted: formatBytes(quota),
        usageFormatted: formatBytes(usage),
      };
    } catch {
      // Fallback si el navegador restringe la llamada
    }
  }

  return {
    quotaBytes: 0,
    usageBytes: 0,
    percentageUsed: 0,
    quotaFormatted: 'Desconocido',
    usageFormatted: 'Desconocido',
  };
}
