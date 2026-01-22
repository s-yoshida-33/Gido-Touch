// electron-builder-config.cjs
const path = require('path');

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
  // ffmpeg-staticのバイナリをasarの外に出す
  asarUnpack: [
    "**/node_modules/ffmpeg-static/**",
    "**/node_modules/ffprobe-static/**"
  ],
  // extraResourcesを動的に生成
  extraResources: [
    // メディアファイルはビルドに含めず、起動時にGitHub Releasesからダウンロードする運用に変更
  ],
  win: {
    target: [
      {
        target: "nsis",
        arch: ["x64"]
      }
    ],
    icon: "build/icon.ico",
    // ビルドファイル名
    artifactName: "GidoTouchSetup-${arch}-${version}.exe",
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
