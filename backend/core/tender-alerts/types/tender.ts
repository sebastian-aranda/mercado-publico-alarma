import { z } from 'zod';

// Schema para una licitación individual del API de Mercado Público
export const tenderSchema = z.object({
  CodigoExterno: z.string(),
  Nombre: z.string(),
  CodigoLicitacion: z.string().nullable().optional(),
  UnidadTecnica: z.string().nullable().optional(),
  Comprador: z.string().nullable().optional(),
  FechaCreacion: z.string().nullable().optional(),
  FechaCierre: z.string().nullable().optional(),
  EstadoLicitacion: z.string().nullable().optional(),
  Tipo: z.string().nullable().optional(),
});

// Schema para la respuesta completa del API
export const mercadoPublicoApiResponseSchema = z.object({
  Cantidad: z.number(),
  Listado: z.array(tenderSchema),
  Version: z.string().optional(),
});

// Schema para el item guardado en DynamoDB (incluye metadata)
export const storedTenderSchema = tenderSchema.extend({
  tenderId: z.string(), // PK: CodigoExterno
  createdAt: z.string(), // ISO timestamp
  notified: z.boolean().default(false),
  keywords: z.array(z.string()).optional(), // Keywords que matchearon
});

// Schema para configuración de filtros
export const filterConfigSchema = z.object({
  keywords: z.array(z.string()),
  estado: z.string().default('activas'),
});

// Tipos inferidos de Zod
export type Tender = z.infer<typeof tenderSchema>;
export type MercadoPublicoApiResponse = z.infer<typeof mercadoPublicoApiResponseSchema>;
export type StoredTender = z.infer<typeof storedTenderSchema>;
export type FilterConfig = z.infer<typeof filterConfigSchema>;

// Configuración por defecto
export const DEFAULT_FILTER_CONFIG: FilterConfig = {
  keywords: ['curso', 'taller', 'capacitación', 'capacitacion', 'primeros auxilios psicológicos', 'relator', 'psicólogo'],
  estado: 'activas',
};