/**
 * Chrome API 类型定义（测试环境）
 *
 * 为测试环境提供 Chrome API 的全局类型声明
 */

declare global {
  namespace chrome {
    namespace alarms {
      interface Alarm {
        name: string
        scheduledTime: number
        periodInMinutes?: number
        delayInMinutes?: number
      }

      interface AlarmCreateInfo {
        when?: number
        delayInMinutes?: number
        periodInMinutes?: number
      }

      interface AlarmsStatic {
        create(name: string, alarmInfo: AlarmCreateInfo): Promise<void>
        get(name: string): Promise<Alarm | undefined>
        getAll(): Promise<Alarm[]>
        clear(name: string): Promise<boolean>
        clearAll(): Promise<boolean>

        onAlarm: {
          addListener(callback: (alarm: Alarm) => void): void
          removeListener(callback: (alarm: Alarm) => void): void
          // 测试用的自定义方法
          trigger?: (alarm: Alarm) => void
        }
      }

      const alarms: AlarmsStatic
    }

    namespace bookmarks {
      interface BookmarkTreeNode {
        id: string
        title?: string
        url?: string
        dateAdded?: number
        dateGroupModified?: number
        index?: number
        parentId?: string
        children?: BookmarkTreeNode[]
        isFolder?: boolean
      }

      interface CreateInfo {
        index?: number
        parentId?: string
        title?: string
        url?: string
      }

      interface BookmarksStatic {
        create(bookmark: CreateInfo): Promise<BookmarkTreeNode>
        get(id: string | string[]): Promise<BookmarkTreeNode[]>
        getTree(): Promise<BookmarkTreeNode[]>
        remove(id: string): Promise<void>
        update(id: string, changes: Partial<BookmarkTreeNode>): Promise<BookmarkTreeNode>
        move(
          id: string,
          destination: { parentId: string; index?: number }
        ): Promise<BookmarkTreeNode>

        onChanged: {
          addListener(callback: (id: string, info: BookmarkTreeNode) => void): void
          removeListener(callback: (id: string, info: BookmarkTreeNode) => void): void
        }

        onCreated: {
          addListener(callback: (id: string, bookmark: BookmarkTreeNode) => void): void
          removeListener(callback: (id: string, bookmark: BookmarkTreeNode) => void): void
        }

        onRemoved: {
          addListener(
            callback: (
              id: string,
              info: { parentId: string; index: number; node: BookmarkTreeNode }
            ) => void
          ): void
          removeListener(
            callback: (
              id: string,
              info: { parentId: string; index: number; node: BookmarkTreeNode }
            ) => void
          ): void
        }
      }

      const bookmarks: BookmarksStatic
    }

    namespace runtime {
      interface MessageSender {
        id?: string
        url?: string
        tab?: {
          id?: number
          url?: string
          title?: string
          favIconUrl?: string
        }
      }

      interface Port {
        name: string
        disconnect(): void
        postMessage(message: unknown): void
        onMessage: {
          addListener(
            callback: (
              message: unknown,
              sender: MessageSender,
              sendResponse: (response: unknown) => void
            ) => void
          ): void
          removeListener(
            callback: (
              message: unknown,
              sender: MessageSender,
              sendResponse: (response: unknown) => void
            ) => void
          ): void
        }
        onDisconnect: {
          addListener(callback: (port: Port) => void): void
          removeListener(callback: (port: Port) => void): void
        }
      }

      interface RuntimeStatic {
        sendMessage(message: unknown, callback?: (response: unknown) => void): void
        connect(extensionId?: string, connectInfo?: { name?: string }): Port
        getManifest(): { version: string }
        getURL(path: string): string
        id: string

        onMessage: {
          addListener(
            callback: (
              message: unknown,
              sender: MessageSender,
              sendResponse: (response: unknown) => void
            ) => boolean | void
          ): void
          removeListener(
            callback: (
              message: unknown,
              sender: MessageSender,
              sendResponse: (response: unknown) => void
            ) => void
          ): void
        }
      }

      const runtime: RuntimeStatic
    }

    namespace storage {
      interface StorageArea {
        get(keys: string | string[] | object): Promise<object>
        set(items: object): Promise<void>
        remove(keys: string | string[]): Promise<void>
        clear(): Promise<void>

        onChanged: {
          addListener(
            callback: (
              changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } },
              areaName: string
            ) => void
          ): void
          removeListener(
            callback: (
              changes: { [key: string]: { oldValue?: unknown; newValue?: unknown } },
              areaName: string
            ) => void
          ): void
        }
      }

      interface StorageStatic {
        local: StorageArea
        sync: StorageArea
        session: StorageArea
      }

      const storage: StorageStatic
    }

    namespace tabs {
      interface Tab {
        id: number
        url?: string
        title?: string
        favIconUrl?: string
        active?: boolean
        windowId?: number
      }

      interface TabsStatic {
        get(tabId: number): Promise<Tab>
        query(queryInfo: object): Promise<Tab[]>
        create(createProperties: object): Promise<Tab>
        update(tabId: number, updateProperties: object): Promise<Tab>
        remove(tabIds: number | number[]): Promise<void>

        onActivated: {
          addListener(callback: (activeInfo: { tabId: number; windowId: number }) => void): void
          removeListener(callback: (activeInfo: { tabId: number; windowId: number }) => void): void
        }

        onUpdated: {
          addListener(callback: (tabId: number, changeInfo: object, tab: Tab) => void): void
          removeListener(callback: (tabId: number, changeInfo: object, tab: Tab) => void): void
        }
      }

      const tabs: TabsStatic
    }

    namespace offscreen {
      interface CreateDocumentParameters {
        url: string
        reasons: ('DOM_SCRAPING' | 'WEB_WORKER' | 'TESTING')[]
        justification: string
      }

      interface OffscreenStatic {
        createDocument(parameters: CreateDocumentParameters): Promise<void>
        hasDocument(): Promise<boolean>
        closeDocument(): Promise<void>
      }

      const offscreen: OffscreenStatic
    }
  }
}

export {}
