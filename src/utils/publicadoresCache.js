import { isClientCacheFresh, readClientCache, writeClientCache } from './clientCache';

const PUBLICADORES_CACHE_KEY = 's21_publicadores_cache_v2';
export const PUBLICADORES_CACHE_FRESH_MS = 1000 * 60 * 30;

export const readPublicadoresCache = () => readClientCache(PUBLICADORES_CACHE_KEY);

export const writePublicadoresCache = (publicadores) => {
    writeClientCache(PUBLICADORES_CACHE_KEY, publicadores);
};

export const isPublicadoresCacheFresh = (entry) => (
    isClientCacheFresh(entry, PUBLICADORES_CACHE_FRESH_MS)
);
