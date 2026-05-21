<script setup lang="ts">
const lastUpdated = '2025年1月21日'

useSeoMeta({
  title: '隐私政策 - AcuityBookmarks',
  description: 'AcuityBookmarks 隐私政策，了解我们如何收集、使用和保护您的个人信息。',
  ogTitle: '隐私政策 - AcuityBookmarks',
  ogDescription: 'AcuityBookmarks 隐私政策，了解我们如何收集、使用和保护您的个人信息。'
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 py-12">
    <div class="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div class="bg-white rounded-lg shadow-sm p-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">隐私政策</h1>
        <p class="text-sm text-gray-500 mb-8">最后更新：{{ lastUpdated }}</p>

        <div class="prose prose-gray max-w-none">
          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">1. 引言</h2>
            <p class="text-gray-700 mb-4">
              AcuityBookmarks（以下简称"我们"）重视您的隐私。本隐私政策说明我们如何收集、使用、存储和保护您的个人信息。
            </p>
            <p class="text-gray-700">
              使用我们的服务即表示您同意本隐私政策中描述的做法。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">2. 我们收集的信息</h2>
            
            <h3 class="text-xl font-semibold text-gray-800 mb-3 mt-6">2.1 您提供的信息</h3>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>账户信息：</strong>注册时提供的邮箱地址、用户名</li>
              <li><strong>书签数据：</strong>您保存的书签 URL、标题、描述、标签和文件夹结构</li>
              <li><strong>用户内容：</strong>您创建的笔记、评论或其他内容</li>
            </ul>

            <h3 class="text-xl font-semibold text-gray-800 mb-3 mt-6">2.2 自动收集的信息</h3>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>使用数据：</strong>功能使用情况、操作日志</li>
              <li><strong>设备信息：</strong>浏览器类型、操作系统、设备标识符</li>
              <li><strong>日志数据：</strong>IP 地址、访问时间、错误日志</li>
            </ul>

            <h3 class="text-xl font-semibold text-gray-800 mb-3 mt-6">2.3 我们不收集的信息</h3>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>浏览历史记录（除非您主动保存为书签）</li>
              <li>其他浏览器扩展的数据</li>
              <li>您访问的网页内容</li>
              <li>敏感个人信息（如身份证号、银行账户等）</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">3. 信息使用方式</h2>
            <p class="text-gray-700 mb-4">我们使用收集的信息用于：</p>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>提供服务：</strong>存储和同步您的书签数据</li>
              <li><strong>改进服务：</strong>分析使用模式，优化功能和性能</li>
              <li><strong>账户管理：</strong>验证身份、处理请求、提供支持</li>
              <li><strong>安全保护：</strong>检测和防止欺诈、滥用和安全威胁</li>
              <li><strong>通信：</strong>发送服务更新、技术通知（不包括营销邮件）</li>
              <li><strong>法律合规：</strong>遵守法律义务和执行我们的条款</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">4. 信息共享</h2>
            <p class="text-gray-700 mb-4">
              我们<strong>不会出售</strong>您的个人信息。我们仅在以下情况下共享信息：
            </p>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>服务提供商：</strong>与帮助我们运营服务的第三方（如云存储、分析工具），他们受合同约束保护您的数据</li>
              <li><strong>法律要求：</strong>响应法律程序、执法请求或保护权利和安全</li>
              <li><strong>业务转让：</strong>在合并、收购或资产出售的情况下</li>
              <li><strong>征得同意：</strong>在您明确同意的其他情况下</li>
            </ul>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">5. 数据存储和安全</h2>
            
            <h3 class="text-xl font-semibold text-gray-800 mb-3 mt-6">5.1 数据存储</h3>
            <p class="text-gray-700 mb-4">
              您的数据存储在安全的云服务器上（Supabase），位于符合数据保护法规的地区。
            </p>

            <h3 class="text-xl font-semibold text-gray-800 mb-3 mt-6">5.2 安全措施</h3>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>数据传输加密（HTTPS/TLS）</li>
              <li>数据存储加密</li>
              <li>访问控制和身份验证</li>
              <li>定期安全审计和更新</li>
              <li>备份和灾难恢复机制</li>
            </ul>

            <h3 class="text-xl font-semibold text-gray-800 mb-3 mt-6">5.3 数据保留</h3>
            <p class="text-gray-700 mb-4">
              我们保留您的数据直到您删除账户或请求删除。删除后，数据将在 30 天内从活动系统中移除，备份数据将在 90 天内删除。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">6. 您的权利</h2>
            <p class="text-gray-700 mb-4">您对自己的数据拥有以下权利：</p>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>访问权：</strong>查看我们持有的关于您的信息</li>
              <li><strong>更正权：</strong>更新或更正不准确的信息</li>
              <li><strong>删除权：</strong>请求删除您的个人数据</li>
              <li><strong>导出权：</strong>以可移植格式导出您的数据</li>
              <li><strong>反对权：</strong>反对某些数据处理活动</li>
              <li><strong>撤回同意：</strong>撤回之前给予的同意</li>
            </ul>
            <p class="text-gray-700">
              要行使这些权利，请通过 support@acuitybookmarks.com 联系我们。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">7. Cookie 和跟踪技术</h2>
            <p class="text-gray-700 mb-4">
              我们使用 Cookie 和类似技术来：
            </p>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li>维持登录状态</li>
              <li>记住您的偏好设置</li>
              <li>分析服务使用情况</li>
              <li>提高安全性</li>
            </ul>
            <p class="text-gray-700">
              您可以通过浏览器设置管理 Cookie 偏好，但这可能影响某些功能的使用。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">8. 第三方服务</h2>
            <p class="text-gray-700 mb-4">
              我们的服务使用以下第三方服务：
            </p>
            <ul class="list-disc list-inside text-gray-700 space-y-2 mb-4">
              <li><strong>Supabase：</strong>数据库和身份验证服务</li>
              <li><strong>Vercel：</strong>网站托管</li>
            </ul>
            <p class="text-gray-700">
              这些服务有自己的隐私政策，我们建议您查阅它们的政策。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">9. 儿童隐私</h2>
            <p class="text-gray-700 mb-4">
              我们的服务不面向 13 岁以下儿童。我们不会故意收集儿童的个人信息。如果您认为我们无意中收集了儿童信息，请联系我们，我们将立即删除。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">10. 隐私政策变更</h2>
            <p class="text-gray-700 mb-4">
              我们可能会不时更新本隐私政策。重大变更将通过服务内通知或电子邮件通知您。
            </p>
            <p class="text-gray-700">
              变更生效后继续使用服务即表示您接受修订后的隐私政策。
            </p>
          </section>

          <section class="mb-8">
            <h2 class="text-2xl font-semibold text-gray-900 mb-4">11. 联系我们</h2>
            <p class="text-gray-700 mb-4">
              如果您对本隐私政策或数据处理有任何疑问或顾虑，请联系我们：
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
