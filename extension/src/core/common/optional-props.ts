/** 构建 exactOptionalPropertyTypes 兼容的可选字段。 */
export function optionalProp<K extends string, V>(
  key: K,
  value: V | undefined
): Partial<Record<K, V>> {
  if (value === undefined) {
    return {}
  }

  return { [key]: value } as Partial<Record<K, V>>
}
