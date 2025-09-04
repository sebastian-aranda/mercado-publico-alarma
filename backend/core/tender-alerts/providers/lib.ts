export type Meta = {
  paramsSchema: string[];
  providerId: string;
  createAllowed: boolean;
  description: string;
  verboseName: string;
};

export abstract class BaseTenderProvider {
  providerMeta: Meta;

  constructor(meta: Meta) {
    this.providerMeta = meta;
  }
}

type ClassWithMeta<ClassType, MetaAsConst> = ClassType & { meta: MetaAsConst };

type Class = { new (...args: any[]): any };

export function appendMeta<C extends Class, M extends Meta>(
  cls: C,
  meta: M
): ClassWithMeta<C, M> {
  const out = Object.assign(cls, { meta });
  return out;
}