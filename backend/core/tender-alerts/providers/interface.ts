import { Meta, appendMeta, BaseTenderProvider } from './lib.js';
export { Meta, appendMeta };

// Tender provider definition
import type { Tender, FilterConfig } from '../types/tender.js';

export abstract class TenderProvider extends BaseTenderProvider {
  abstract getTenders(config?: Partial<FilterConfig>): Promise<Tender[]>;
  abstract getTendersWithRetry(
    config?: Partial<FilterConfig>, 
    maxRetries?: number, 
    delayMs?: number
  ): Promise<Tender[]>;
}