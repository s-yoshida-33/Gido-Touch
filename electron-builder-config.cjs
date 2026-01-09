// electron-builder-config.cjs
const path = require('path');

// 環境変数 MALL_ID から対象のモールを取得（指定がない場合は undefined）
const TARGET_MALL_ID = process.env.MALL_ID;

const config = {
  appId: "com.tti.gido-touch",
  productName: "Gido Touch",
  copyright: "© 2025 Toei Techno International Inc.",
  directories: {
    output: "release",
    buildResources: "build"
  },
  files: [
    "dist/**/*",
    "electron/**/*",
    "package.json"
  ],
  // extraResourcesを動的に生成
  extraResources: [
    {
      from: "media",
      to: "media",
      filter: TARGET_MALL_ID 
        ? [`${TARGET_MALL_ID}/**/*`] // 特定モールのみ
        : ["**/*"] // 全て（デフォルト）
    }
  ],
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      }
    ],
    icon: "build/icon.ico",
    // ビルドファイル名にモールIDを含める
    artifactName: TARGET_MALL_ID 
      ? `GidoTouchSetup-${TARGET_MALL_ID}-\${arch}-\${version}.exe`
      : "GidoTouchSetup-${arch}-${version}.exe",
    extraFiles: [
      {
        from: "build/icon.ico",
        to: "icon.ico"
      }
    ]
  },
  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: false,
    createStartMenuShortcut: false,
    shortcutName: "Gido Touch",
    deleteAppDataOnUninstall: false,
    include: "build/installer.nsh",
    warningsAsErrors: false,
    runAfterFinish: true,
    allowElevation: false,
    perMachine: false,
    language: "1041",
    installerLanguages: ["ja_JP"],
    menuCategory: true,
    uninstallDisplayName: "Gido Touch アンインストール",
    unicode: true,
    differentialPackage: false
  },
  publish: [
    {
      provider: "github",
      owner: "s-yoshida-33",
      repo: "Gido-Touch",
      releaseType: "release"
    }
  ]
};

module.exports = config;
