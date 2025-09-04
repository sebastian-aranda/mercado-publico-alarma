/// <reference path="./.sst/platform/config.d.ts" />

const PROFILE = {
  default: 'socialtech-dev',
  test: 'socialtech-test', 
  prod: 'socialtech-prod',
} as const;

export default $config({
  app(input) {
    const stage = input?.stage ?? 'default';
    const profile = PROFILE[stage];

    return {
      home: 'aws',
      name: 'mercado-publico-alarma',
      region: 'sa-east-1',
      removal: ['prod', 'test', 'default'].includes(stage)
        ? 'retain' 
        : 'remove',
      protect: stage === 'prod',
      providers: {
        aws: { region: 'sa-east-1', profile },
      },
    };
  },

  async run() {
    const { Resources } = await import('./infra/resources');
    const { TenderMonitoring } = await import('./infra/tender-monitoring');

    const res = await Resources(); // ← singleton

    TenderMonitoring(res);
  },
});
