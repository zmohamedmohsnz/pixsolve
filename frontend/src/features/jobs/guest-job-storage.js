const STORAGE_KEY = 'pixsolve.activeGuestJob';

export const saveGuestJob = ({ id, credential }) => {
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ id, credential, accessMode: 'guest' }));
};

export const getGuestJob = () => {
  try {
    const stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY));
    return stored?.accessMode === 'guest' && stored.id && stored.credential ? stored : null;
  } catch {
    return null;
  }
};
