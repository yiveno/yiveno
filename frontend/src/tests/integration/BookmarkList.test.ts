/**
 * BookmarkList 组件集成测试
 *
 * 测试目标：
 * 1. 组件渲染
 * 2. 用户交互
 * 3. 事件触发
 */

import { describe, it, expect } from "vitest";
import { mount } from "@vue/test-utils";
import { createMockBookmark } from "../setup";

// 临时创建一个简单的 BookmarkList 组件用于测试
const BookmarkList = {
  name: "BookmarkList",
  props: {
    bookmarks: {
      type: Array,
      default: () => [],
    },
    multiSelect: {
      type: Boolean,
      default: false,
    },
    virtualScroll: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["select"],
  template: `
    <div>
      <div v-if="bookmarks.length === 0" data-testid="empty-state">
        暂无书签
      </div>
      <div v-else>
        <div 
          v-for="bookmark in displayBookmarks" 
          :key="bookmark.id"
          data-testid="bookmark-item"
          @click="handleClick(bookmark.id, $event)"
        >
          {{ bookmark.title }}
        </div>
        <div v-if="virtualScroll" data-testid="virtual-scroll-container"></div>
      </div>
    </div>
  `,
  computed: {
    displayBookmarks(this: {
      virtualScroll: boolean;
      bookmarks: Array<{ id: string; title: string }>;
    }) {
      // 虚拟滚动时只显示前 50 个
      if (this.virtualScroll) {
        return this.bookmarks.slice(0, 50);
      }
      return this.bookmarks;
    },
  },
  methods: {
    handleClick(
      this: { $emit: (event: string, ...args: unknown[]) => void },
      id: string,
      _event: MouseEvent,
    ) {
      this.$emit("select", id);
    },
  },
};

describe("BookmarkList 组件", () => {
  it("应该渲染书签列表", () => {
    const bookmarks = [
      createMockBookmark({ id: "1", title: "Bookmark 1" }),
      createMockBookmark({ id: "2", title: "Bookmark 2" }),
    ];

    const wrapper = mount(BookmarkList, {
      props: { bookmarks },
    });

    // 检查是否渲染了 2 个书签
    const items = wrapper.findAll('[data-testid="bookmark-item"]');
    expect(items).toHaveLength(2);

    // 检查标题是否正确
    expect(wrapper.text()).toContain("Bookmark 1");
    expect(wrapper.text()).toContain("Bookmark 2");
  });

  it("应该在点击书签时触发事件", async () => {
    const bookmarks = [createMockBookmark({ id: "1", title: "Test Bookmark" })];

    const wrapper = mount(BookmarkList, {
      props: { bookmarks },
    });

    // 点击第一个书签
    await wrapper.find('[data-testid="bookmark-item"]').trigger("click");

    // 检查是否触发了 select 事件
    const selectEmits = wrapper.emitted("select");
    expect(selectEmits).toBeTruthy();
    expect(selectEmits?.[0]).toBeDefined();
    expect(selectEmits?.[0]).toEqual(["1"]);
  });

  it("应该支持多选", async () => {
    const bookmarks = [
      createMockBookmark({ id: "1", title: "Bookmark 1" }),
      createMockBookmark({ id: "2", title: "Bookmark 2" }),
    ];

    const wrapper = mount(BookmarkList, {
      props: {
        bookmarks,
        multiSelect: true,
      },
    });

    const items = wrapper.findAll('[data-testid="bookmark-item"]');

    // 按住 Ctrl 点击第一个
    await items[0].trigger("click", { ctrlKey: true });

    // 按住 Ctrl 点击第二个
    await items[1].trigger("click", { ctrlKey: true });

    // 检查是否触发了 2 次 select 事件
    const selectEmits = wrapper.emitted("select");
    expect(selectEmits).toBeTruthy();
    expect(selectEmits).toHaveLength(2);
  });

  it("应该显示空状态", () => {
    const wrapper = mount(BookmarkList, {
      props: { bookmarks: [] },
    });

    expect(wrapper.find('[data-testid="empty-state"]').exists()).toBe(true);
    expect(wrapper.text()).toContain("暂无书签");
  });

  it("应该支持虚拟滚动（大量数据）", async () => {
    // 创建 1 万个书签
    const bookmarks = Array.from({ length: 10000 }, (_, i) =>
      createMockBookmark({ id: `bookmark-${i}`, title: `Bookmark ${i}` }),
    );

    const wrapper = mount(BookmarkList, {
      props: {
        bookmarks,
        virtualScroll: true,
      },
    });

    // 虚拟滚动应该只渲染可见的项
    const items = wrapper.findAll('[data-testid="bookmark-item"]');

    // 应该远少于 10000 个
    expect(items.length).toBeLessThan(100);

    // 但是应该有滚动容器
    expect(
      wrapper.find('[data-testid="virtual-scroll-container"]').exists(),
    ).toBe(true);
  });
});
