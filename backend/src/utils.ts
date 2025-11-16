export function getEnvOrThrow(name: string): string {
  return (
    process.env[name] ||
    (() => {
      throw new Error(`${name} is not set`);
    })()
  );
}

export function parseEnum<E extends Record<string, string>>(
  e: E,
  value: string,
): E[keyof E] | undefined {
  const val = value as E[keyof E];
  return Object.values(e).includes(val) ? val : undefined;
}

export function parseEnumOrThrow<E extends Record<string, string>>(
  e: E,
  value: string,
): E[keyof E] {
  return (
    parseEnum(e, value) ??
    (() => {
      throw new Error(`Invalid enum value ${value}`);
    })()
  );
}

export function groupBy<T, K>(items: T[], keyFn: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();

  for (const item of items) {
    const key = keyFn(item);
    let values = map.get(key);

    if (!values) {
      values = [];
      map.set(key, values);
    }

    values.push(item);
  }

  return map;
}
