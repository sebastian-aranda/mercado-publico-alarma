import { DynamoDBClient } from '@aws-sdk/client-dynamodb';

import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
  DeleteCommand,
  ScanCommand,
  TransactWriteCommand,
} from '@aws-sdk/lib-dynamodb';
import type { ScanCommandOutput } from '@aws-sdk/lib-dynamodb';

type ElementFromArray<ArrType> = ArrType extends readonly (infer ElementType)[]
  ? ElementType
  : never;

type TransactWriteItem = ElementFromArray<
  ConstructorParameters<typeof TransactWriteCommand>[0]['TransactItems']
>;

// type PutInputItem = ConstructorParameters<typeof PutCommand>[0]['Item'];

export function makeClient<
  ItemOut extends Record<string, unknown>,
  ItemIn extends ItemOut,
  Indexes extends IndexesType
>(
  table: string,
  indexes: Indexes,
  preSaveParser: (doc: unknown) => ItemOut
): Client<ItemIn, ItemOut, Indexes> {
  const client = DynamoDBDocumentClient.from(new DynamoDBClient({}), {
    marshallOptions: { removeUndefinedValues: true },
  });

  function parseKey(key: Key<Indexes['primary']>) {
    // string Key -> Simple index, build key with just pk
    // object key -> Use as provided
    if (typeof key === 'string') return { [indexes['primary'].pk]: key };
    else return key;
  }

  function parseQuerySKOpts(index: Index, options: QueryOptions<Indexes>) {
    // Validate no more than 1 sortkey comparison option was passed
    const availableSKOpts = [
      'eq',
      'lt',
      'lte',
      'gt',
      'gte',
      'between',
      'beginsWith',
    ] as const;

    const optKeys = Object.keys(options);
    const passedSKOpts = availableSKOpts.filter((opt) => optKeys.includes(opt));
    if (passedSKOpts.length > 1)
      throw new Error(`No more than 1 sortkey comparison option is allowed`);

    // Get the passed option, if any
    const skOpt = passedSKOpts.pop();

    // No option returns dummy modifications to query params
    // No sort key ignores sk options
    if (!skOpt || !index.sk)
      return { attNames: {}, attValues: {}, keyExp: '' as const };

    // Build query params modifiers

    // Set ExpressionAttributeNames
    const attNames = { '#skName': index.sk };

    // Set ExpressionAttributeValues
    let attValues;
    if (skOpt === 'between') {
      const skOptValue = options[skOpt];
      if (!skOptValue || skOptValue.length !== 2)
        throw new Error(
          'When using the "between" sort key option, provide an array [skLowerBound, skUpperBound]'
        );

      attValues = {
        ':skLowerBound': skOptValue[0],
        ':skUpperBound': skOptValue[1],
      };
    } else {
      const skOptValue = options[skOpt];
      if (typeof skOptValue === 'undefined')
        throw new Error(`SK option ${skOpt} cannot be undefined`);
      attValues = { ':skValue': skOptValue };
    }

    // Set KeyConditionExpression modifier
    const keyExps = {
      eq: 'AND #skName = :skValue',
      lt: 'AND #skName < :skValue',
      lte: 'AND #skName <= :skValue',
      gt: 'AND #skName > :skValue',
      gte: 'AND #skName >= :skValue',
      between: 'AND #skName BETWEEN :skLowerBound AND :skUpperBound',
      beginsWith: 'AND begins_with(#skName, :skValue)',
    } as const;
    const keyExp = keyExps[skOpt];

    return { attNames, attValues, keyExp };
  }

  function makeKeyParams(item: ItemIn | ItemOut, type: 'create' | 'putUpdate') {
    const comparison = type === 'create' ? '<>' : '=';

    const { pk, sk } = indexes['primary'];

    const itemPk = item[pk];
    if (!itemPk)
      throw new Error('Item does not have pk declared in primary index.');

    const pkAttNames = { '#pk': pk },
      pkAttValues = { ':pk': itemPk },
      pkConditionExpression = `#pk ${comparison} :pk`;

    let skAttNames, skAttValues, skConditionExpression;
    if (sk) {
      const itemSk = item[sk];
      if (!itemSk)
        throw new Error('Item does not have sk declared in primary index.');

      skAttNames = { '#sk': sk };
      skAttValues = { ':sk': itemSk };
      skConditionExpression = `  AND #sk ${comparison} :sk`;
    } else {
      skAttNames = {};
      skAttValues = {};
      skConditionExpression = '';
    }

    return {
      ExpressionAttributeNames: { ...pkAttNames, ...skAttNames },
      ExpressionAttributeValues: { ...pkAttValues, ...skAttValues },
      ConditionExpression: pkConditionExpression + skConditionExpression, //<-- Use aliased partition key, dynamo will replace based on ExpressionAttributeNames
    };
  }

  function makeCreateKeyParams(item: ItemIn | ItemOut) {
    return makeKeyParams(item, 'create');
  }

  function makePutUpdateKeyParams(item: ItemIn | ItemOut) {
    return makeKeyParams(item, 'putUpdate');
  }

  return {
    async get(key, params = {}) {
      const keyObject = parseKey(key);

      const command = new GetCommand({
        TableName: table,
        Key: keyObject,
        ...params,
      });

      const { Item } = await client.send(command);

      if (!Item) throw new Error('Item not found');
      return Item as ItemOut;
    },

    async put(item, params = {}) {
      const parsedItem = preSaveParser(item);
      const command = new PutCommand({
        TableName: table,
        Item: parsedItem,
        ...params,
      });
      await client.send(command);
      // TODO: Return only on success
      return parsedItem;
    },

    async create(item) {
      //* Puts only if item does not exists
      const keyParams = makeCreateKeyParams(item);

      return await this.put(item, {
        ExpressionAttributeNames: keyParams.ExpressionAttributeNames,
        ExpressionAttributeValues: keyParams.ExpressionAttributeValues,
        ConditionExpression: keyParams.ConditionExpression,
      });
    },

    async putUpdate(item) {
      //* Puts only if item already exists
      const keyParams = makePutUpdateKeyParams(item);

      return await this.put(item, {
        ExpressionAttributeNames: keyParams.ExpressionAttributeNames,
        ExpressionAttributeValues: keyParams.ExpressionAttributeValues,
        ConditionExpression: keyParams.ConditionExpression,
      });
    },

    async query(pk, options = {}, params = {}) {
      // Validate index
      const indexName = options.indexName || 'primary';
      const index = indexes[indexName];
      if (!index) throw new Error(`Index ${indexName} not registered`);

      const skMod = parseQuerySKOpts(index, options);

      const command = new QueryCommand({
        TableName: table,
        IndexName: indexName === 'primary' ? undefined : indexName,
        ExclusiveStartKey: options.exclusiveStartKey,
        ExpressionAttributeNames: { '#pkName': index.pk, ...skMod.attNames },
        ExpressionAttributeValues: { ':pkValue': pk, ...skMod.attValues },
        KeyConditionExpression: [`#pkName = :pkValue`, skMod.keyExp]
          .join(' ')
          .trim(),
        ...params,
      });
      const { Items, LastEvaluatedKey } = await client.send(command);

      const items = Items as ItemOut[] & { lastKey: LastKey };
      items.lastKey = LastEvaluatedKey;
      return items;
    },

    async queryAll(pk, options = {}, params = {}) {
      //* Keeps querying until returned LastEvaluatedKey is undefined
      //* Supports starting from LastEvaluatedKey

      let items: ItemOut[] = [];
      let lastKey: LastKey | null = options.exclusiveStartKey ?? null;
      //? If lastKey is not provided, initialize as null in order to avoid conflict with while loop condition (stop when lastKey is exactly undefined)

      do {
        options.exclusiveStartKey = lastKey ?? undefined;

        const iterationItems = await this.query(pk, options, params);
        items.push(...iterationItems);
        lastKey = iterationItems.lastKey;
      } while (typeof lastKey !== 'undefined');

      return items;
    },

    async scan(options = {}, params = {}) {
      const indexName = options.indexName || 'primary';
      const index = indexes[indexName];
      if (!index) throw new Error(`Index ${indexName} not registered`);

      const command = new ScanCommand({
        TableName: table,
        IndexName: indexName === 'primary' ? undefined : indexName,
        ExclusiveStartKey: options.exclusiveStartKey,
        ...params,
      });
      const { Items, LastEvaluatedKey } = await client.send(command);

      const items = Items as ItemOut[] & { lastKey: LastKey };
      items.lastKey = LastEvaluatedKey;
      return items;
    },

    async scanAll(options = {}, params = {}) {
      //* Keeps scanning until returned LastEvaluatedKey is undefined
      //* Supports starting from LastEvaluatedKey

      let items: ItemOut[] = [];
      let lastKey: LastKey | null = options.exclusiveStartKey ?? null;
      //? If lastKey is not provided, initialize as null in order to avoid conflict with while loop condition (stop when lastKey is exactly undefined)

      do {
        options.exclusiveStartKey = lastKey ?? undefined;

        const iterationItems = await this.scan(options, params);
        items.push(...iterationItems);
        lastKey = iterationItems.lastKey;
      } while (typeof lastKey !== 'undefined');

      return items;
    },

    async delete(key) {
      //* Delete does not fail if document does not exists
      const keyObject = parseKey(key);
      const command = new DeleteCommand({
        TableName: table,
        Key: keyObject,
      });
      await client.send(command);
    },

    // Transactions
    transaction: {
      put(item) {
        const parsedItem = preSaveParser(item);
        return {
          Put: {
            TableName: table,
            Item: parsedItem,
          },
        };
      },
      create(item) {
        const parsedItem = preSaveParser(item);
        const keyParams = makeCreateKeyParams(parsedItem);

        return {
          Put: {
            TableName: table,
            Item: parsedItem,
            ExpressionAttributeNames: keyParams.ExpressionAttributeNames,
            ExpressionAttributeValues: keyParams.ExpressionAttributeValues,
            ConditionExpression: keyParams.ConditionExpression,
          },
        };
      },
      putUpdate(item) {
        const parsedItem = preSaveParser(item);
        const keyParams = makePutUpdateKeyParams(parsedItem);

        return {
          Put: {
            TableName: table,
            Item: parsedItem,
            ExpressionAttributeNames: keyParams.ExpressionAttributeNames,
            ExpressionAttributeValues: keyParams.ExpressionAttributeValues,
            ConditionExpression: keyParams.ConditionExpression,
          },
        };
      },
      delete(key) {
        const keyObject = parseKey(key);
        return {
          Delete: {
            Key: keyObject,
            TableName: table,
          },
        };
      },
      async run(transactItems) {
        const command = new TransactWriteCommand({
          TransactItems: transactItems,
        });

        await client.send(command);
      },
    },
  };
}

type Index = {
  pk: string;
  sk?: string;
};
type IndexesType = {
  primary: Index;
  [indexName: string]: Index;
};
export type LastKey = ScanCommandOutput['LastEvaluatedKey'];

type Key<PrimaryIndex extends IndexesType['primary']> =
  | string
  | (PrimaryIndex['sk'] extends string
      ? {
          [key in PrimaryIndex['pk'] | PrimaryIndex['sk']]: string;
        }
      : {
          [key in PrimaryIndex['pk']]: string;
        });

type QueryOptions<Indexes extends IndexesType> = {
  indexName?: Extract<keyof Indexes, string>;
  exclusiveStartKey?: LastKey;
  eq?: string | number;
  lt?: string | number;
  lte?: string | number;
  gt?: string | number;
  gte?: string | number;
  between?: [string | number, string | number];
  beginsWith?: string | number;
};
type Client<
  ItemIn extends Record<string, unknown>,
  ItemOut extends Record<string, unknown>,
  Indexes extends IndexesType
> = {
  get: (
    key: Key<Indexes['primary']>,
    params?: Pick<
      Partial<ConstructorParameters<typeof GetCommand>[0]>,
      'ConsistentRead'
    >
  ) => Promise<ItemOut>;
  put: (
    item: ItemIn,
    params?: Pick<
      Partial<ConstructorParameters<typeof PutCommand>[0]>,
      | 'ConditionExpression'
      | 'ExpressionAttributeNames'
      | 'ExpressionAttributeValues'
    >
  ) => Promise<ItemOut>;
  create: (item: ItemIn) => Promise<ItemOut>;
  putUpdate: (item: ItemIn) => Promise<ItemOut>;
  query: (
    pk: string | number,
    options?: QueryOptions<Indexes>,
    params?: Pick<
      Partial<ConstructorParameters<typeof QueryCommand>[0]>,
      'ConsistentRead' | 'Limit' | 'ScanIndexForward'
    >
  ) => Promise<ItemOut[] & { lastKey: LastKey }>;
  queryAll: (
    pk: string | number,
    options?: QueryOptions<Indexes>,
    params?: Pick<
      Partial<ConstructorParameters<typeof QueryCommand>[0]>,
      'ConsistentRead' | 'ScanIndexForward'
    >
  ) => Promise<ItemOut[]>;
  // delete: https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_DeleteItem.html
  delete: (key: Key<Indexes['primary']>) => Promise<void>;
  // scan: https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Scan.html
  scan: (
    options?: {
      indexName?: Extract<keyof Indexes, string>;
      exclusiveStartKey?: LastKey;
    },
    params?: Pick<
      Partial<ConstructorParameters<typeof ScanCommand>[0]>,
      'ConsistentRead' | 'Limit'
    >
  ) => Promise<ItemOut[] & { lastKey: LastKey }>;
  scanAll: (
    options?: {
      indexName?: Extract<keyof Indexes, string>;
      exclusiveStartKey?: LastKey;
    },
    params?: Pick<
      Partial<ConstructorParameters<typeof ScanCommand>[0]>,
      'ConsistentRead'
    >
  ) => Promise<ItemOut[]>;
  // Transactions
  transaction: {
    put: (item: ItemIn) => TransactWriteItem;
    create: (item: ItemIn) => TransactWriteItem;
    putUpdate: (item: ItemIn) => TransactWriteItem;
    delete: (key: Key<Indexes['primary']>) => TransactWriteItem; //no se el por que para ocupar esto necesito no puedo ocuar el typo de las keys
    run: (transactItems: TransactWriteItem[]) => Promise<void>;
  };
  //* Full Docs: https://docs.aws.amazon.com/amazondynamodb/latest/APIReference/API_Operations_Amazon_DynamoDB.html
};
