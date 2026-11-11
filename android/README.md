# Android APK

这是一个最小原生 Android WebView 壳，离线加载项目根目录的 `dist/` 游戏资源。

## 构建

安装 Android SDK Platform 35 和 Build Tools 35 后运行：

```powershell
.\build-apk.ps1 -SdkRoot "C:\path\to\android-sdk"
```

生成的 APK 默认保存到项目工作区的 `outputs/stress-smash-android.apk`。APK 使用本地调试签名，可直接侧载安装测试；若要上架应用商店，应改用正式发布密钥重新签名。
