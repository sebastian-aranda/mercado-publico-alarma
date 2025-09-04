import { Resource } from 'sst';
import { TenderProvider, appendMeta } from '../interface.js';
import { mercadoPublicoApiResponseSchema, type Tender, type FilterConfig } from '../../types/tender.js';

class MercadoPublicoProvider extends TenderProvider {
  private readonly baseUrl = 'https://api.mercadopublico.cl/servicios/v1/publico';
  private readonly apiToken: string;

  constructor() {
    super({
      paramsSchema: ['apiToken'],
      providerId: 'mercado-publico',
      createAllowed: true,
      description: 'Proveedor oficial del API de Mercado Público de Chile',
      verboseName: 'Mercado Público Chile',
    });
    
    this.apiToken = Resource.MercadoPublicoApiToken.value;
  }

  /**
   * Obtiene licitaciones del API de Mercado Público
   */
  async getTenders(config: Partial<FilterConfig> = {}): Promise<Tender[]> {
    const params = new URLSearchParams({
      ticket: this.apiToken,
      estado: config.estado || 'activas',
    });

    const url = `${this.baseUrl}/licitaciones.json?${params}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status} ${response.statusText}`);
      }

      const rawData = await response.json();
      
      // Validamos la respuesta con Zod
      const validatedData = mercadoPublicoApiResponseSchema.parse(rawData);
      
      return validatedData.Listado;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`Failed to fetch tenders: ${error.message}`);
      }
      throw new Error('Failed to fetch tenders: Unknown error');
    }
  }

  /**
   * Obtiene licitaciones con retry automático
   */
  async getTendersWithRetry(
    config: Partial<FilterConfig> = {},
    maxRetries = 3,
    delayMs = 1000
  ): Promise<Tender[]> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await this.getTenders(config);
      } catch (error) {
        lastError = error as Error;
        console.warn(`Attempt ${attempt}/${maxRetries} failed:`, error);
        
        if (attempt < maxRetries) {
          // Exponential backoff
          const delay = delayMs * Math.pow(2, attempt - 1);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('All retry attempts failed');
  }
}

// Append metadata to class
export const MercadoPublico = appendMeta(MercadoPublicoProvider, {
  paramsSchema: ['apiToken'],
  providerId: 'mercado-publico',
  createAllowed: true,
  description: 'Proveedor oficial del API de Mercado Público de Chile',
  verboseName: 'Mercado Público Chile',
} as const);