/* ——— Tipado de todas las factorías ——— */
type NotificationsRes = ReturnType<typeof import('./notifications').Notifications>;
type TenderStorageRes = ReturnType<typeof import('./tender-storage').TenderStorage>;

/* ——— Singleton ——— */
let _cached: {
  notifications: NotificationsRes;
  tenderStorage: TenderStorageRes;
} | null = null;

/* ——— Instancia única de todos los recursos ——— */
export async function Resources() {
  if (_cached) return _cached;

  const { Notifications } = await import('./notifications');
  const { TenderStorage } = await import('./tender-storage');

  _cached = {
    notifications: Notifications(),
    tenderStorage: TenderStorage(),
  };

  return _cached;
}

/* ───────────────────── Helpers de bindings ───────────────────── */

/** Devuelve bindings "flattened" de los recursos indicados */
export function bindingsOf<
  K extends (keyof Awaited<ReturnType<typeof Resources>>)[]
>(res: Awaited<ReturnType<typeof Resources>>, ...keys: K) {
  return keys.flatMap((k) => Object.values(res[k].bindings));
}

/* grupos predefinidos */
export function bindingsForTenderMonitoring(
  res: Awaited<ReturnType<typeof Resources>>
) {
  return bindingsOf(
    res,
    'notifications',
    'tenderStorage'
  );
}

export type TenderResources = {
  notifications: NotificationsRes;
  tenderStorage: TenderStorageRes;
};