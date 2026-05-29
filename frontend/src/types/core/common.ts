/**
 * 部分类型工具集合，供项目内复用。
 */
export type Optional<T> = {
  [P in keyof T]?: T[P];
};

/** 指定字段为必填的辅助类型。 */
export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

/** 递归地将所有属性设为可选。 */
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

/** 递归地将所有属性设为只读。 */
export type DeepReadonly<T> = {
  readonly [P in keyof T]: T[P] extends object ? DeepReadonly<T[P]> : T[P];
};

/** 取对象所有 value 类型。 */
export type ValueOf<T> = T[keyof T];

/**
 * 生成以点分隔的键路径，用于访问嵌套字段。
 */
export type KeyPath<T> = T extends object
  ? {
      [K in keyof T]: K extends string | number
        ? T[K] extends object
          ? `${K}` | `${K}.${KeyPath<T[K]>}`
          : `${K}`
        : never;
    }[keyof T]
  : never;

/** 一般函数类型定义。 */
export type Callback<Args extends unknown[] = [], Return = void> = (
  ...args: Args
) => Return;

/** 异步函数类型定义。 */
export type AsyncCallback<Args extends unknown[] = [], Return = void> = (
  ...args: Args
) => Promise<Return>;

export type Nullable<T> = T | null;
export type Maybe<T> = T | undefined;
export type OptionalNullable<T> = T | null | undefined;

/** 标识符统一类型。 */
export type ID = string | number;
/** 时间戳统一类型（毫秒）。 */
export type Timestamp = number;

/** JSON 结构中允许的值类型。 */
export type JSONValue =
  | string
  | number
  | boolean
  | null
  | JSONValue[]
  | { [key: string]: JSONValue };

/** JSON 对象结构。 */
export interface JSONObject {
  [key: string]: JSONValue;
}

export type Constructor<T = unknown> = new (...args: unknown[]) => T;
export type AbstractConstructor<T = unknown> = abstract new (
  ...args: unknown[]
) => T;

export type AnyFunction = (...args: unknown[]) => unknown;
export type AnyObject = Record<string, unknown>;

export type ArrayElement<T extends readonly unknown[]> =
  T extends ReadonlyArray<infer E> ? E : never;

export type PromiseValue<T> = T extends Promise<infer U> ? U : T;

export type OmitStrict<T, K extends keyof T> = Pick<T, Exclude<keyof T, K>>;
export type PickStrict<T, K extends keyof T> = Pick<T, K>;

/** 合并两个类型，B 的字段优先。 */
export type Merge<A, B> = Omit<A, keyof B> & B;

/** 将嵌套类型拍平成单层对象。 */
export type Flatten<T> = T extends infer U ? { [K in keyof U]: U[K] } : never;
