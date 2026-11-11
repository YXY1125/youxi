param(
    [Parameter(Mandatory = $true)][string]$SdkRoot,
    [string]$OutputPath = "..\..\outputs\stress-smash-android.apk"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
$BuildRoot = Join-Path $PSScriptRoot "build"
$AssetsDir = Join-Path $BuildRoot "assets"
$ClassesDir = Join-Path $BuildRoot "classes"
$DexDir = Join-Path $BuildRoot "dex"
$GenDir = Join-Path $BuildRoot "gen"
$BuildToolsDir = Get-ChildItem -LiteralPath (Join-Path $SdkRoot "build-tools") -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1

if (-not $BuildToolsDir) { throw "Android build-tools not found under $SdkRoot" }

$PlatformDir = Get-ChildItem -LiteralPath (Join-Path $SdkRoot "platforms") -Directory |
    Sort-Object Name -Descending |
    Select-Object -First 1
if (-not $PlatformDir) { throw "Android platform not found under $SdkRoot" }

$AndroidJarSource = Join-Path $PlatformDir.FullName "android.jar"
$Aapt2 = Join-Path $BuildToolsDir.FullName "aapt2.exe"
$D8 = Join-Path $BuildToolsDir.FullName "d8.bat"
$ZipAlign = Join-Path $BuildToolsDir.FullName "zipalign.exe"
$ApkSigner = Join-Path $BuildToolsDir.FullName "apksigner.bat"

if (Test-Path -LiteralPath $BuildRoot) { Remove-Item -LiteralPath $BuildRoot -Recurse -Force }
New-Item -ItemType Directory -Force $AssetsDir,$ClassesDir,$DexDir,$GenDir | Out-Null
Copy-Item -Path (Join-Path $ProjectRoot "dist\*") -Destination $AssetsDir -Recurse -Force
$AndroidJar = Join-Path $BuildRoot "android.jar"
Copy-Item -LiteralPath $AndroidJarSource -Destination $AndroidJar -Force

$CompiledResources = Join-Path $BuildRoot "resources.zip"
$UnsignedApk = Join-Path $BuildRoot "app-unsigned.apk"
$AlignedApk = Join-Path $BuildRoot "app-aligned.apk"
$Keystore = Join-Path $PSScriptRoot ".debug-signing-key.jks"

& $Aapt2 compile --dir (Join-Path $PSScriptRoot "res") -o $CompiledResources
if ($LASTEXITCODE -ne 0) { throw "aapt2 compile failed" }

& $Aapt2 link -o $UnsignedApk -I $AndroidJar --manifest (Join-Path $PSScriptRoot "AndroidManifest.xml") `
    --java $GenDir --min-sdk-version 23 --target-sdk-version 35 -A $AssetsDir $CompiledResources
if ($LASTEXITCODE -ne 0) { throw "aapt2 link failed" }

$MainJava = Join-Path $PSScriptRoot "src\com\codex\stresssmash\MainActivity.java"
$RJava = Join-Path $GenDir "com\codex\stresssmash\R.java"
& javac -encoding UTF-8 -source 8 -target 8 -bootclasspath $AndroidJar -d $ClassesDir $MainJava $RJava
if ($LASTEXITCODE -ne 0) { throw "javac failed" }

$ClassFiles = Get-ChildItem -LiteralPath $ClassesDir -Filter "*.class" -Recurse | ForEach-Object FullName
& $D8 --lib $AndroidJar --min-api 23 --output $DexDir $ClassFiles
if ($LASTEXITCODE -ne 0) { throw "d8 failed" }

Add-Type -AssemblyName System.IO.Compression.FileSystem
$ApkZip = [System.IO.Compression.ZipFile]::Open($UnsignedApk, [System.IO.Compression.ZipArchiveMode]::Update)
try {
    [System.IO.Compression.ZipFileExtensions]::CreateEntryFromFile(
        $ApkZip,
        (Join-Path $DexDir "classes.dex"),
        "classes.dex",
        [System.IO.Compression.CompressionLevel]::Optimal
    ) | Out-Null
} finally {
    $ApkZip.Dispose()
}

& $ZipAlign -f -p 4 $UnsignedApk $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "zipalign failed" }

if (-not (Test-Path -LiteralPath $Keystore)) {
    & keytool -genkeypair -keystore $Keystore -storepass android -keypass android `
        -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10000 `
        -dname "CN=Stress Smash Debug,O=Codex,C=CN"
    if ($LASTEXITCODE -ne 0) { throw "keytool failed" }
}

$ResolvedOutput = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $OutputPath))
$OutputDir = Split-Path -Parent $ResolvedOutput
New-Item -ItemType Directory -Force $OutputDir | Out-Null
& $ApkSigner sign --ks $Keystore --ks-pass pass:android --key-pass pass:android --out $ResolvedOutput $AlignedApk
if ($LASTEXITCODE -ne 0) { throw "apksigner failed" }
& $ApkSigner verify --verbose --print-certs $ResolvedOutput
if ($LASTEXITCODE -ne 0) { throw "APK signature verification failed" }

Write-Output $ResolvedOutput
