import { MercadoPublico } from './mercado-publico/index.js';

const providers = [MercadoPublico] as const;

// Make object mapping providerId to client class
type ProvidersRegistry = {
  [P in typeof providers[number] as P['meta']['providerId']]: P;
};

type ProviderId = keyof ProvidersRegistry;

const providersRegistry = Object.fromEntries(
  providers.map((P) => [P.meta.providerId, P])
) as ProvidersRegistry;

function isProviderId(str: string): str is ProviderId {
  return str in providersRegistry;
}

/**
 * Factory para obtener un proveedor de licitaciones por ID
 */
export function getTenderProvider(providerId: ProviderId) {
  const ProviderClass = providersRegistry[providerId];
  if (!ProviderClass) {
    throw new Error(`Unknown tender provider: ${providerId}`);
  }
  return new ProviderClass();
}

/**
 * Factory para obtener el proveedor por defecto (Mercado Público)
 */
export function getDefaultTenderProvider() {
  return getTenderProvider('mercado-publico');
}

/**
 * Lista todos los proveedores disponibles
 */
export function getAvailableProviders() {
  return providers.map(P => ({
    id: P.meta.providerId,
    name: P.meta.verboseName,
    description: P.meta.description,
    paramsRequired: P.meta.paramsSchema,
    createAllowed: P.meta.createAllowed,
  }));
}

export { type ProviderId, isProviderId };
export * from './interface.js';