import { makeClient } from '../../../../libs/dynamodb/index.js';
import { Resource } from 'sst';

// Types
import type { StoredTender, Tender, FilterConfig } from '../types/tender.js';
import { storedTenderSchema, DEFAULT_FILTER_CONFIG } from '../types/tender.js';

//* Indexes
const indexes = {
  primary: {
    pk: 'tenderId',
  },
} as const;

//* DynamoDB Client
export const tenderClient = makeClient<StoredTender, StoredTender, typeof indexes>(
  Resource.TenderTable.name,
  indexes,
  (doc) => storedTenderSchema.parse(doc)
);

//* Business Logic

/**
 * Verifica si una licitación ya existe en la base de datos
 */
export async function exists(tenderId: string): Promise<boolean> {
  try {
    await tenderClient.get(tenderId);
    return true;
  } catch {
    return false;
  }
}

/**
 * Guarda una nueva licitación en la base de datos
 */
export async function create(tender: Tender, keywords: string[]): Promise<StoredTender> {
  const storedTender: StoredTender = {
    ...tender,
    tenderId: tender.CodigoExterno,
    createdAt: new Date().toISOString(),
    notified: false,
    keywords,
  };
  
  await tenderClient.put(storedTender);
  return storedTender;
}

/**
 * Marca una licitación como notificada
 */
export async function markAsNotified(storedTender: StoredTender): Promise<void> {
  await tenderClient.putUpdate({
    ...storedTender,
    notified: true,
  });
}

/**
 * Filtra licitaciones por keywords
 */
export function filterByKeywords(tenders: Tender[], config: FilterConfig = DEFAULT_FILTER_CONFIG) {
  const filtered: Array<Tender & { matchedKeywords: string[] }> = [];

  for (const tender of tenders) {
    const matchedKeywords = findMatchingKeywords(tender.Nombre, config.keywords);
    
    if (matchedKeywords.length > 0) {
      filtered.push({
        ...tender,
        matchedKeywords,
      });
    }
  }

  return filtered;
}

/**
 * Encuentra keywords que matchean en el texto
 */
function findMatchingKeywords(text: string, keywords: string[]): string[] {
  const normalizedText = normalizeText(text);
  const matchedKeywords: string[] = [];

  for (const keyword of keywords) {
    const normalizedKeyword = normalizeText(keyword);
    
    if (normalizedText.includes(normalizedKeyword)) {
      matchedKeywords.push(keyword);
    }
  }

  return matchedKeywords;
}

/**
 * Normaliza texto para comparación (minúsculas, sin acentos)
 */
function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remover acentos
}