/// <reference path="../.sst/platform/config.d.ts" />
import { TenderResources, bindingsForTenderMonitoring } from "./resources";

export function TenderMonitoring(res: TenderResources) {
  const IS_PROD = $app.stage === "prod";

  // ⏰ Cron Job que ejecuta cada hora
  new sst.aws.Cron("TenderMonitorCron", {
    function: {
      handler: "backend/functions/cron/check-new-tenders.handler",
      runtime: "nodejs20.x",
      timeout: "5 minutes",
      memory: "512 MB",
      environment: {
        NODE_ENV: IS_PROD ? "production" : "development",
      },
      // Linking - acceso typesafe a recursos
      link: bindingsForTenderMonitoring(res),
    },
    schedule: IS_PROD
      ? "rate(1 hour)" // Producción: cada hora
      : "rate(1 minute)", // Dev: cada 5 minutos para testing
    enabled: true,
  });
}
