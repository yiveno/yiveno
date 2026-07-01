#!/usr/bin/env bun

/**
 * 清理dist文件夹中的不必要文件，减少Chrome扩展包大小
 * 移除PWA相关文件，只保留Chrome扩展所需的文件
 */

void (async () => {
  const fs = await import('fs')
  const path = await import('path')
  const { execSync } = await import('child_process')
  const loggerMod = await import('./logger.cjs')
  const { createLogger } = loggerMod.default ?? loggerMod

  const distDir = path.join(__dirname, '../../dist')
  const rootDir = path.join(__dirname, '../../')

  // 统一脚本日志：使用脚本级 logger（移除 console 代理，避免 no-console 告警）
  const __scriptLogger__ = createLogger('CleanDist')

  // 需要删除的PWA文件列表
  const filesToRemove = [
    'android-chrome-192x192.png',
    'android-chrome-512x512.png',
    'apple-touch-icon.png',
    'favicon-16x16.png',
    'favicon-32x32.png',
    'favicon.ico',
    // 'logo.svg' // 保留SVG Logo用于扩展页面
    'site.webmanifest',
    // 删除大体积 PNG logo，已替换为 WebP
    'logo.png',
    'logo-dark.png'
  ]

  __scriptLogger__.info('🧹 开始清理dist文件夹...')

  // 检查dist目录是否存在
  if (!fs.existsSync(distDir)) {
    __scriptLogger__.info('❌ dist目录不存在，跳过清理')
    process.exit(0)
  }

  // 删除PWA相关文件
  filesToRemove.forEach(file => {
    const filePath = path.join(distDir, file)
    if (fs.existsSync(filePath)) {
      try {
        fs.unlinkSync(filePath)
        __scriptLogger__.info(`✅ 删除PWA文件: ${file}`)
      } catch (err) {
        __scriptLogger__.warn(`⚠️ 无法删除文件: ${file}`, err.message)
      }
    }
  })
// if (fs.existsSync(assetsDir)) {
//   fontFilesToRemove.forEach(fontFile => {
//     const fontPath = path.join(assetsDir, fontFile);
//     if (fs.existsSync(fontPath)) {
//       try {
//         fs.unlinkSync(fontPath);
//         console.log(`✅ 删除字体文件: ${fontFile}`);
//       } catch (err) {
//         console.warn(`⚠️ 无法删除字体文件: ${fontFile}`, err.message);
//       }
//     }
//   });
// }

// 复制必要的扩展文件到dist目录
__scriptLogger__.info('📋 复制扩展文件到dist目录...');

// 从 frontend/public/manifest.json 读取manifest内容
const publicManifestPath = path.join(__dirname, '../public/manifest.json');
let manifestContent;

  try {
    const manifestData = fs.readFileSync(publicManifestPath, 'utf8');
    manifestContent = JSON.parse(manifestData);
    __scriptLogger__.info('✅ 从 public/manifest.json 读取配置');
    // 不再覆盖 CSP 配置，直接使用 public/manifest.json 中的配置
    // CSP 配置已在 public/manifest.json 中正确设置，避免构建时覆盖导致的问题
    __scriptLogger__.info('✅ 使用 public/manifest.json 中的 CSP 配置（不覆盖）');
  } catch (err) {
    __scriptLogger__.warn('⚠️ 无法读取 public/manifest.json，使用默认配置:', err.message);
  // 备用的默认配置（不包含side_panel）
  manifestContent = {
    "manifest_version": 3,
    "name": "Yiveno",
    "version": "1.0",
    "description": "Unlock the knowledge in your bookmarks. AI-powered organization, content-aware search.",
    "permissions": [
      "bookmarks",
      "storage",
      "activeTab",
      "scripting",
      "notifications",
      "tabs",
      "windows",
      "alarms"
    ],
    "host_permissions": [
      "https://localhost:8787/*",
      "https://127.0.0.1:8787/*"
    ],
    "action": {
      "default_popup": "popup.html",
      "default_icon": {
        "16": "images/icon16.png",
        "48": "images/icon48.png",
        "128": "images/icon128.png"
      }
    },
    "background": {
      "service_worker": "background.js"
    },
    "commands": {
      "open-management": {
        "suggested_key": {
          "default": "Alt+B",
          "mac": "Alt+B"
        },
        "description": "打开书签管理页面"
      },
      "smart-bookmark": {
        "suggested_key": {
          "default": "Alt+S",
          "mac": "Alt+S"
        },
        "description": "AI智能整理书签"
      },
    },
    "icons": {
      "16": "images/icon16.png",
      "48": "images/icon48.png",
      "128": "images/icon128.png"
    },
    "content_security_policy": {
        "extension_pages": "default-src 'self'; script-src 'self'; object-src 'none'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com; img-src 'self' data: https: http:; connect-src 'self' https://localhost:8787 https://127.0.0.1:8787 https://yiveno.cqw547847.workers.dev https://api.yiveno.com https://*.supabase.co https://*.supabase.io data: blob: wss:"
    },
    "web_accessible_resources": [
      {
        "resources": [
          "management.html",
          "side-panel.html",
          "settings.html",
          "auth.html"
        ],
        "matches": ["<all_urls>"],
        "use_dynamic_url": true
      }
    ]
  };
}

// 按构建环境限制 auth-sync 注入域名（dev 与生产站彻底隔离）
const authSyncRuntimeEnv = process.env.VITE_RUNTIME_ENV === 'prod' ? 'prod' : 'dev';
const authSyncMatchesByEnv = {
  dev: [
    'http://localhost:3000/*',
    'https://localhost:3000/*',
    'http://localhost:3001/*',
    'https://localhost:3001/*',
  ],
  prod: ['https://yiveno.com/*', 'https://www.yiveno.com/*'],
};

/** @param {Record<string, unknown>} manifest */
function applyAuthSyncManifestPatch(manifest) {
  if (!manifest?.content_scripts?.length) {
    return;
  }
  for (const script of manifest.content_scripts) {
    if (!Array.isArray(script.js)) {
      continue;
    }
    const isAuthSync = script.js.some(
      (file) => file === 'auth-sync.bundle.js' || file === 'auth-sync.js',
    );
    if (!isAuthSync) {
      continue;
    }
    script.matches = [...authSyncMatchesByEnv[authSyncRuntimeEnv]];
    script.js = ['auth-sync.bundle.js'];
    delete script.type;
    __scriptLogger__.info(
      `✅ auth-sync 注入域名已设为 ${authSyncRuntimeEnv} 环境（${script.matches.length} 条）`,
    );
    return;
  }
}

applyAuthSyncManifestPatch(manifestContent);

const manifestPath = path.join(distDir, 'manifest.json');
try {
  fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
  __scriptLogger__.info('✅ 创建 manifest.json');
} catch (err) {
  __scriptLogger__.warn('⚠️ 创建 manifest.json 失败:', err.message);
}

// 复制images文件夹
const imagesSrc = path.join(__dirname, '../public/images');
const imagesDest = path.join(distDir, 'images');
if (fs.existsSync(imagesSrc)) {
  try {
    // 强制删除已存在的images文件夹，确保干净的复制
    if (fs.existsSync(imagesDest)) {
      fs.rmSync(imagesDest, { recursive: true, force: true });
    }
    fs.cpSync(imagesSrc, imagesDest, { recursive: true });
    __scriptLogger__.info('✅ 复制 images 文件夹');

    // 删除未使用的图标尺寸，保留 16/48/128
    const unusedIcons = ['icon24.png', 'icon32.png', 'icon256.png'];
    unusedIcons.forEach(fname => {
      const fpath = path.join(imagesDest, fname);
      if (fs.existsSync(fpath)) {
        try {
          fs.unlinkSync(fpath);
          __scriptLogger__.info(`✅ 移除未使用的图标: ${fname}`);
        } catch (err) {
          __scriptLogger__.warn(`⚠️ 无法移除未使用的图标: ${fname}`, err.message);
        }
      }
    });
  } catch (err) {
    __scriptLogger__.warn('⚠️ 复制 images 文件夹失败:', err.message);
  }
}

// 复制 _locales 文件夹（国际化翻译文件）
const localesSrc = path.join(__dirname, '../public/_locales');
const localesDest = path.join(distDir, '_locales');
if (fs.existsSync(localesSrc)) {
  try {
    // 强制删除已存在的 _locales 文件夹，确保干净的复制
    if (fs.existsSync(localesDest)) {
      fs.rmSync(localesDest, { recursive: true, force: true });
    }
    fs.cpSync(localesSrc, localesDest, { recursive: true });
    __scriptLogger__.info('✅ 复制 _locales 文件夹');
  } catch (err) {
    __scriptLogger__.warn('⚠️ 复制 _locales 文件夹失败:', err.message);
  }
}

// // 复制background.js
// const backgroundSrc = path.join(rootDir, 'background.js')
// const backgroundDest = path.join(distDir, 'background.js')
// if (fs.existsSync(backgroundSrc)) {
//   try {
//     fs.copyFileSync(backgroundSrc, backgroundDest)
//     __scriptLogger__.info('✅ 复制 background.js')
//   } catch (err) {
//     __scriptLogger__.warn('⚠️ 复制 background.js 失败:', err.message)
//   }
// }

// NOTE: Noto 字体改为使用 CDN 外部加载（完全外部化），
// clean-dist 不再把大体积 Noto 字体复制到 dist 中以减小扩展包体积。
// 运行时会按需从 CDN 加载所需语言字体并在 IndexedDB 中缓存（详见 frontend/src/utils/fontLoader.ts）。

// 移动所有页面到根目录（从 pages 目录迁移后的处理）
const pagesToMove = [
  { src: 'src/pages/popup/index.html', dest: 'popup.html' },
  { src: 'src/pages/management/index.html', dest: 'management.html' },
  { src: 'src/pages/side-panel/index.html', dest: 'side-panel.html' },
  { src: 'src/pages/settings/index.html', dest: 'settings.html' },
  { src: 'src/pages/auth/index.html', dest: 'auth.html' },
  { src: 'src/pages/subscription/index.html', dest: 'subscription.html' },
  { src: 'src/pages/onboarding/index.html', dest: 'onboarding.html' },
  { src: 'src/pages/save-popup/index.html', dest: 'save-popup.html' }
]

let movedAnyPage = false
pagesToMove.forEach(({ src, dest }) => {
  const srcPath = path.join(distDir, src)
  const destPath = path.join(distDir, dest)
  
  if (fs.existsSync(srcPath)) {
    try {
      // 读取HTML内容
      let htmlContent = fs.readFileSync(srcPath, 'utf8')
      
      // 修复资源路径：将 ../../../ 替换为 ./
      htmlContent = htmlContent.replace(/\.\.\/(\.\.\/)+/g, './')
      
      // 写入目标位置
      fs.writeFileSync(destPath, htmlContent, 'utf8')
      __scriptLogger__.info(`✅ 移动 ${dest} 到根目录`)
      movedAnyPage = true
    } catch (err) {
      __scriptLogger__.warn(`⚠️ 移动 ${dest} 失败:`, err.message)
    }
  }
})

// 如果移动了任何页面，删除原来的嵌套目录结构
if (movedAnyPage) {
  const srcDir = path.join(distDir, 'src')
  if (fs.existsSync(srcDir)) {
    try {
      fs.rmSync(srcDir, { recursive: true, force: true })
      __scriptLogger__.info('✅ 清理 src 目录结构')
    } catch (err) {
      __scriptLogger__.warn('⚠️ 清理 src 目录失败:', err.message)
    }
  }
}

__scriptLogger__.info('🎉 dist文件夹清理和文件复制完成！');

// 复制 ONNX Runtime WASM 到 dist/assets（扩展内本地加载，不依赖外部 CDN）
// 依赖可能安装在 frontend/node_modules 或 monorepo 根 node_modules
const onnxWasmSrcCandidates = [
  path.join(__dirname, '../node_modules/onnxruntime-web/dist'),
  path.join(__dirname, '../../node_modules/onnxruntime-web/dist'),
];
const onnxWasmSrc = onnxWasmSrcCandidates.find(candidate => fs.existsSync(candidate));
const onnxWasmFiles = [
  'ort-wasm-simd-threaded.asyncify.wasm',
  'ort-wasm-simd-threaded.asyncify.mjs',
];
const assetsDir = path.join(distDir, 'assets');
if (!onnxWasmSrc) {
  __scriptLogger__.warn('⚠️ 未找到 onnxruntime-web/dist，跳过 ONNX WASM 复制');
} else if (!fs.existsSync(assetsDir)) {
  __scriptLogger__.warn('⚠️ dist/assets 不存在，跳过 ONNX WASM 复制');
} else {
  onnxWasmFiles.forEach(fname => {
    const src = path.join(onnxWasmSrc, fname);
    const dest = path.join(assetsDir, fname);
    if (!fs.existsSync(src)) {
      __scriptLogger__.warn(`⚠️ 源文件不存在，跳过: ${fname}`);
      return;
    }
    try {
      fs.copyFileSync(src, dest);
      __scriptLogger__.info(`✅ 复制 ONNX WASM: ${fname}`);
    } catch (err) {
      __scriptLogger__.warn(`⚠️ 复制 ONNX WASM 失败: ${fname}`, err.message);
    }
  });
}

// 始终用 IIFE 重建 auth-sync.js（主构建/watch 可能残留 ES module 版本）
const frontendDir = path.join(__dirname, '..');
try {
  __scriptLogger__.info('📦 构建 auth-sync.js (IIFE)...');
  execSync('bun run build:auth-sync', {
    cwd: frontendDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      NODE_ENV: process.env.NODE_ENV || 'development',
      VITE_RUNTIME_ENV: authSyncRuntimeEnv,
    },
  });
  const legacyAuthSyncPath = path.join(distDir, 'auth-sync.js');
  if (fs.existsSync(legacyAuthSyncPath)) {
    fs.unlinkSync(legacyAuthSyncPath);
    __scriptLogger__.info('✅ 删除旧版 auth-sync.js（避免 Chrome 加载 ES module 缓存）');
  }
  const legacyAuthSyncMap = path.join(distDir, 'auth-sync.js.map');
  if (fs.existsSync(legacyAuthSyncMap)) {
    fs.unlinkSync(legacyAuthSyncMap);
  }

  const authSyncPath = path.join(distDir, 'auth-sync.bundle.js');
  if (fs.existsSync(authSyncPath)) {
    const head = fs.readFileSync(authSyncPath, 'utf8').trimStart().slice(0, 12);
    if (head.startsWith('(function')) {
      __scriptLogger__.info('✅ auth-sync.bundle.js 已为 IIFE 格式');
    } else {
      __scriptLogger__.warn(`⚠️ auth-sync.bundle.js 格式异常，开头为: ${head}`);
    }
  }
} catch (err) {
  __scriptLogger__.warn('⚠️ auth-sync IIFE 构建失败:', err.message);
}

// 最后再写一次 manifest（避免构建流程覆盖 content_scripts 配置）
try {
  applyAuthSyncManifestPatch(manifestContent);
  fs.writeFileSync(manifestPath, JSON.stringify(manifestContent, null, 2));
  __scriptLogger__.info('✅ 最终 manifest.json 已落盘');
} catch (err) {
  __scriptLogger__.warn('⚠️ 最终 manifest 写入失败:', err.message);
}

// 更新 offscreen.html 里的 offscreen.js 版本号，强制 Chrome 加载新版本（避免缓存问题）
const offscreenHtmlPath = path.join(distDir, 'offscreen.html');
if (fs.existsSync(offscreenHtmlPath)) {
  try {
    const buildTs = Date.now();
    let offscreenHtml = fs.readFileSync(offscreenHtmlPath, 'utf8');
    // 替换 offscreen.js 的版本号（无论是否已有 ?v= 参数）
    offscreenHtml = offscreenHtml.replace(
      /src="offscreen\.js(\?v=\d+)?"/,
      `src="offscreen.js?v=${buildTs}"`
    );
    fs.writeFileSync(offscreenHtmlPath, offscreenHtml, 'utf8');
    __scriptLogger__.info(`✅ 更新 offscreen.html 版本号: v=${buildTs}`);
  } catch (err) {
    __scriptLogger__.warn('⚠️ 更新 offscreen.html 版本号失败:', err.message);
  }
}

// 生产构建时删除 sourcemap 文件（减小扩展包体积）
if (process.env.NODE_ENV === 'production') {
  const glob = await import('fast-glob')
  const mapFiles = await glob.default(`${distDir}/**/*.map`)
  let removedMaps = 0
  for (const mapFile of mapFiles) {
    try {
      fs.unlinkSync(mapFile)
      removedMaps++
    } catch {
      // 忽略
    }
  }
  if (removedMaps > 0) {
    __scriptLogger__.info(`✅ 删除 ${removedMaps} 个 sourcemap 文件`)
  }
}

// 校验 dist 内 Embedding 模型与 ONNX WASM 完整性
try {
  __scriptLogger__.info('🔍 校验 dist Embedding 产物完整性...')
  execSync('bun scripts/validate-dist-embedding.mjs', {
    cwd: path.join(__dirname, '..'),
    stdio: 'inherit',
  })
} catch (err) {
  __scriptLogger__.error('❌ dist Embedding 完整性校验失败，扩展包不可用')
  process.exit(1)
}

// 显示清理后的文件夹大小
try {
  const cp = await import('child_process')
  const size = cp.execSync(`du -sh "${distDir}"`, { encoding: 'utf8' })
    .trim()
    .split('\t')[0]
  __scriptLogger__.info(`📦 最终dist文件夹大小: ${size}`)
} catch {
  __scriptLogger__.info('ℹ️ 无法获取文件夹大小信息')
}

})()
