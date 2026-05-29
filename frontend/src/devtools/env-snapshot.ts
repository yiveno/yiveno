import {
  indexedDBManager,
  DB_CONFIG,
  type StoreDump,
} from "@/infrastructure/indexeddb/manager";
import { logger } from "@/infrastructure/logging/logger";

const SESSION_FALLBACK_PREFIX = "_session_";

/**
 * 深拷贝值
 *
 * 优先使用 structuredClone，降级到 JSON 序列化
 */
const cloneValue = <T>(value: T): T => {
  const cloner = globalThis.structuredClone;
  if (typeof cloner === "function") return cloner(value);
  return JSON.parse(JSON.stringify(value)) as T;
};

/**
 * 获取 chrome.storage 中的所有数据
 */
async function storageGetAll(
  area: "local" | "session",
): Promise<Record<string, unknown>> {
  const storageArea = chrome.storage?.[area];
  if (!storageArea) {
    return {};
  }
  return await new Promise((resolve) => {
    storageArea.get(null, (result) => {
      if (chrome.runtime?.lastError) {
        logger.warn(
          "EnvSnapshot",
          `读取 ${area} storage 失败`,
          chrome.runtime.lastError,
        );
        resolve({});
        return;
      }
      resolve(cloneValue(result ?? {}));
    });
  });
}

/**
 * 清空 chrome.storage 中的所有数据
 */
async function storageClear(area: "local" | "session"): Promise<void> {
  const storageArea = chrome.storage?.[area];
  if (!storageArea) return;
  await new Promise<void>((resolve) => {
    storageArea.clear(() => {
      if (chrome.runtime?.lastError) {
        logger.warn(
          "EnvSnapshot",
          `清空 ${area} storage 失败`,
          chrome.runtime.lastError,
        );
      }
      resolve();
    });
  });
}

/**
 * 写入数据到 chrome.storage
 */
async function storageSet(
  area: "local" | "session",
  data: Record<string, unknown>,
): Promise<void> {
  const storageArea = chrome.storage?.[area];
  if (!storageArea || !data || Object.keys(data).length === 0) return;
  await new Promise<void>((resolve) => {
    storageArea.set(data, () => {
      if (chrome.runtime?.lastError) {
        logger.error(
          "EnvSnapshot",
          `${area} storage 写入失败`,
          chrome.runtime.lastError,
        );
      }
      resolve();
    });
  });
}

/**
 * 从 local storage 中提取 session 数据（降级方案）
 *
 * 当浏览器不支持 chrome.storage.session 时，session 数据会以特殊前缀存储在 local 中
 */
const extractSessionFromLocalFallback = (
  localData: Record<string, unknown>,
) => {
  const sessionData: Record<string, unknown> = {};
  for (const key of Object.keys(localData)) {
    if (key.startsWith(SESSION_FALLBACK_PREFIX)) {
      const sessionKey = key.replace(SESSION_FALLBACK_PREFIX, "");
      sessionData[sessionKey] = localData[key];
      delete localData[key];
    }
  }
  return sessionData;
};

/**
 * 扩展环境快照
 *
 * 包含 IndexedDB、chrome.storage.local 和 chrome.storage.session 的完整数据
 */
export interface ExtensionEnvSnapshot {
  metadata: {
    createdAt: string;
    schemaVersion: number;
    extensionId?: string;
    manifestVersion?: string;
  };
  indexedDB: StoreDump;
  chromeStorage: {
    local: Record<string, unknown>;
    session: Record<string, unknown>;
  };
}

/**
 * 快照导入结果
 */
export interface SnapshotImportResult {
  restoredStores: number;
  restoredRecords: number;
  storageLocalKeys: number;
  storageSessionKeys: number;
  schemaVersion: number;
}

/**
 * 导出扩展环境快照
 *
 * 包含 IndexedDB 和 chrome.storage 的所有数据
 */
export async function exportExtensionEnvironment(): Promise<ExtensionEnvSnapshot> {
  await indexedDBManager.initialize();

  const localData = await storageGetAll("local");
  const sessionData =
    chrome.storage?.session != null
      ? await storageGetAll("session")
      : extractSessionFromLocalFallback(localData);

  const indexedDBDump = await indexedDBManager.exportAllStores();

  const manifest = chrome.runtime?.getManifest?.();
  return {
    metadata: {
      createdAt: new Date().toISOString(),
      schemaVersion: DB_CONFIG.VERSION,
      extensionId: chrome.runtime?.id,
      manifestVersion: manifest?.version,
    },
    indexedDB: indexedDBDump,
    chromeStorage: {
      local: localData,
      session: sessionData,
    },
  };
}

/**
 * 导入扩展环境快照
 *
 * 恢复 IndexedDB 和 chrome.storage 的数据
 */
export async function importExtensionEnvironment(
  snapshot: ExtensionEnvSnapshot,
): Promise<SnapshotImportResult> {
  const indexedDBResult = await indexedDBManager.importAllStores(
    snapshot?.indexedDB ?? {},
  );

  const localKeys = await importLocalStorage(snapshot);
  const sessionKeys = await importSessionStorage(snapshot);

  return {
    ...indexedDBResult,
    storageLocalKeys: localKeys,
    storageSessionKeys: sessionKeys,
    schemaVersion: snapshot?.metadata?.schemaVersion ?? DB_CONFIG.VERSION,
  };
}

/**
 * 导入本地存储数据
 */
async function importLocalStorage(
  snapshot: ExtensionEnvSnapshot,
): Promise<number> {
  await storageClear("local");
  const localData = snapshot?.chromeStorage?.local ?? {};
  const localKeys = Object.keys(localData).length;
  await storageSet("local", localData);
  return localKeys;
}

/**
 * 导入会话存储数据
 */
async function importSessionStorage(
  snapshot: ExtensionEnvSnapshot,
): Promise<number> {
  const sessionData = snapshot?.chromeStorage?.session ?? {};
  if (chrome.storage?.session) {
    await storageClear("session");
    const sessionKeys = Object.keys(sessionData).length;
    await storageSet("session", sessionData);
    return sessionKeys;
  } else if (sessionData && Object.keys(sessionData).length > 0) {
    const sessionKeys = Object.keys(sessionData).length;
    const fallback = Object.fromEntries(
      Object.entries(sessionData).map(([key, value]) => [
        `${SESSION_FALLBACK_PREFIX}${key}`,
        value,
      ]),
    );
    await storageSet("local", fallback);
    return sessionKeys;
  }
  return 0;
}

/**
 * 启用环境快照桥接
 *
 * 将导出/导入函数挂载到 window 对象，供开发者工具使用
 *
 * @returns 清理函数
 */
export function enableEnvSnapshotBridge(): () => void {
  const target = window as EnvSnapshotWindow;
  target.__AB_EXPORT_ENV__ = exportExtensionEnvironment;
  target.__AB_IMPORT_ENV__ = importExtensionEnvironment;
  logger.info("EnvSnapshot", "开发者快照桥已启用");
  return () => {
    delete target.__AB_EXPORT_ENV__;
    delete target.__AB_IMPORT_ENV__;
  };
}

declare global {
  interface EnvSnapshotWindow extends Window {
    __AB_EXPORT_ENV__?: () => Promise<ExtensionEnvSnapshot>;
    __AB_IMPORT_ENV__?: (
      snapshot: ExtensionEnvSnapshot,
    ) => Promise<SnapshotImportResult>;
  }
}
