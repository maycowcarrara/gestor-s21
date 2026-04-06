export const readClientCache = (key) => {
    if (typeof window === 'undefined') return null;

    try {
        const rawValue = window.localStorage.getItem(key);
        if (!rawValue) return null;

        const parsed = JSON.parse(rawValue);
        if (!parsed || typeof parsed !== 'object') return null;

        return {
            value: parsed.value,
            savedAt: Number(parsed.savedAt || 0)
        };
    } catch {
        return null;
    }
};

export const writeClientCache = (key, value) => {
    if (typeof window === 'undefined') return;

    try {
        window.localStorage.setItem(key, JSON.stringify({
            value,
            savedAt: Date.now()
        }));
    } catch {
        // Cache é opcional; falhas não devem quebrar a UI.
    }
};

export const isClientCacheFresh = (entry, maxAgeMs) => {
    if (!entry?.savedAt) return false;
    return Date.now() - entry.savedAt <= maxAgeMs;
};
