/// <reference path="../.sst/platform/config.d.ts" />

export function TenderStorage() {
  // 🗄️ DynamoDB Table para almacenar licitaciones
  const tenderTable = new sst.aws.Dynamo("TenderTable", {
    fields: {
      tenderId: "string", // PK: CodigoExterno de la licitación
    },
    primaryIndex: {
      hashKey: "tenderId",
    },
    ttl: "expiresAt", // Auto-cleanup opcional de registros antiguos
  });

  // 🔐 Secrets para API de Mercado Público
  const mercadoPublicoApiToken = new sst.Secret("MercadoPublicoApiToken");

  return {
    bindings: {
      tenderTable,
      mercadoPublicoApiToken,
    },
  };
}
