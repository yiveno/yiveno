<script setup lang="ts">
const lastUpdated = '2025年1月21日'

useSeoMeta({
  title: '服务条款 - AcuityBookmarks',
  description: 'AcuityBookmarks 服务条款，了解使用我们书签管理服务的规则和条件。',
  ogTitle: '服务条款 - AcuityBookmarks',
  ogDescription: 'AcuityBookmarks 服务条款，了解使用我们书签管理服务的规则和条件。'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-white rounded-lg shadow-sm p-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">服务条款</h1>
        <p class="text-sm text-gray-500 mb-8">最后更新：{{ lastUpdated }}</p>

        <div class="prose prose-gray max-w-none">
          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">1. 服务说明</h2>
            <p class="text-gray-700 mb-4">
              欢迎使用 AcuityBookmarks（以下简称"本服务"）。本服务是一款浏览器书签管理扩展，帮助用户更好地组织和管理浏览器书签。
            </p>
            <p class="text-gray-700">
              使用本服务即表示您同意遵守本服务条款。如果您不同意本条款，请不要使用本服务。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">2. 用户账户</h2>
            <p class="text-gray-700 mb-4">
              您需要创建账户才能使用本服务的完整功能。您有责任：
            </p>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>提供准确、完整的注册信息</li>
              <li>保护账户安全，不与他人共享登录凭据</li>
              <li>对账户下的所有活动负责</li>
              <li>及时通知我们任何未经授权的账户使用</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">3. 使用规范</h2>
            <p class="text-gray-700 mb-4">使用本服务时，您同意不会：</p>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>违反任何适用的法律法规</li>
              <li>侵犯他人的知识产权或其他权利</li>
              <li>上传恶意软件或有害内容</li>
              <li>干扰或破坏服务的正常运行</li>
              <li>尝试未经授权访问系统或数据</li>
              <li>滥用服务资源或进行自动化操作</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">4. 数据和隐私</h2>
            <p class="text-gray-700 mb-4">
              我们重视您的隐私。您的书签数据和个人信息的收集、使用和保护详见我们的
              <NuxtLink to="/privacy" class="text-blue-600 hover:text-blue-800 underline">隐私政策</NuxtLink>。
            </p>
            <p class="text-gray-700">
              您保留对自己数据的所有权。您可以随时导出或删除您的数据。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">5. 知识产权</h2>
            <p class="text-gray-700 mb-4">
              本服务及其所有内容（包括但不限于软件、设计、文本、图形、标志）均受知识产权法保护，归 AcuityBookmarks 或其许可方所有。
            </p>
            <p class="text-gray-700">
              未经明确授权，您不得复制、修改、分发或创建衍生作品。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">6. 服务变更和终止</h2>
            <p class="text-gray-700 mb-4">
              我们保留随时修改、暂停或终止服务的权利，恕不另行通知。我们也可能因违反本条款而终止您的账户。
            </p>
            <p class="text-gray-700">
              服务终止后，您应停止使用服务并可能失去对数据的访问权限。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">7. 免责声明</h2>
            <p class="text-gray-700 mb-4">
              本服务按"现状"和"可用"基础提供，不提供任何明示或暗示的保证，包括但不限于：
            </p>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>服务的可用性、可靠性或及时性</li>
              <li>服务结果的准确性或完整性</li>
              <li>服务不会中断或无错误</li>
              <li>缺陷将被修复</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">8. 责任限制</h2>
            <p class="text-gray-700 mb-4">
              在法律允许的最大范围内，AcuityBookmarks 不对任何间接、偶然、特殊、后果性或惩罚性损害承担责任，包括但不限于利润损失、数据丢失或业务中断。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">9. 条款变更</h2>
            <p class="text-gray-700 mb-4">
              我们可能会不时更新本服务条款。重大变更将通过服务内通知或电子邮件通知您。
            </p>
            <p class="text-gray-700">
              变更生效后继续使用服务即表示您接受修订后的条款。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">10. 联系我们</h2>
            <p class="text-gray-700 mb-4">
              如果您对本服务条款有任何疑问，请通过以下方式联系我们：
            </p>
            <ul class="list-none text-gray-700 space-y-2">
              <li>📧 邮箱：support@acuitybookmarks.com</li>
              <li>🌐 网站：<NuxtLink to="/contact" class="text-blue-600 hover:text-blue-800 underline">联系我们</NuxtLink></li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>
