# Requires Windows PowerShell 5.1 or newer. Passwords are entered only into JDK tools.
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version 2.0

function Invoke-Checked {
    param([string] $File, [string[]] $Arguments)
    & $File @Arguments
    if ($LASTEXITCODE -ne 0) {
        throw ('Tool failed with exit code {0}: {1}' -f $LASTEXITCODE, (Split-Path $File -Leaf))
    }
}

function Find-JdkBin {
    $Candidates = @()
    if ($env:JAVA_HOME) { $Candidates += (Join-Path $env:JAVA_HOME 'bin') }
    if ($env:ProgramFiles) { $Candidates += (Join-Path $env:ProgramFiles 'Android\Android Studio\jbr\bin') }
    if ($env:LOCALAPPDATA) { $Candidates += (Join-Path $env:LOCALAPPDATA 'Programs\Android Studio\jbr\bin') }
    $JavaCommand = Get-Command 'java.exe' -CommandType Application -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($JavaCommand) { $Candidates += (Split-Path $JavaCommand.Source -Parent) }
    if ($env:ProgramFiles) {
        $Adoptium = Join-Path $env:ProgramFiles 'Eclipse Adoptium'
        if (Test-Path -LiteralPath $Adoptium) {
            $Candidates += @(Get-ChildItem -LiteralPath $Adoptium -Directory | Sort-Object Name -Descending | ForEach-Object { Join-Path $_.FullName 'bin' })
        }
    }
    foreach ($Candidate in $Candidates) {
        if ((Test-Path -LiteralPath (Join-Path $Candidate 'java.exe')) -and
            (Test-Path -LiteralPath (Join-Path $Candidate 'keytool.exe')) -and
            (Test-Path -LiteralPath (Join-Path $Candidate 'jarsigner.exe'))) {
            return $Candidate
        }
    }
    throw 'A full JDK was not found. Install Temurin JDK 21 for Windows from https://adoptium.net/temurin/releases/?version=21 and enable JAVA_HOME or PATH. Then reopen this kit.'
}

function Assert-Hash {
    param([string] $Path, [string] $Expected)
    if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { throw ('Required kit file is missing: ' + $Path) }
    $Actual = (Get-FileHash -LiteralPath $Path -Algorithm SHA256).Hash
    if ($Actual -ine $Expected) { throw ('Checksum mismatch. Stop using this kit and download a fresh copy. File: ' + (Split-Path $Path -Leaf)) }
}

try {
    $Kit = Split-Path -Parent $MyInvocation.MyCommand.Path
    $Apk = Join-Path $Kit 'unilink-release-unsigned.apk'
    $Aab = Join-Path $Kit 'unilink-release-unsigned.aab'
    $ApkSigner = Join-Path $Kit 'tools\apksigner.jar'
    # These are the exact compiled inputs reviewed by the preparer, not debug builds.
    Assert-Hash $Apk '0c1f22b8956d9bce4b2ab83e5de1c7a483b8fa9f1ede241965b5924cb620e901'
    Assert-Hash $Aab '5c5ae6a41eae8da33d2162c35e65abc0c3d45cc5826f813c4246fab134549bd3'
    Assert-Hash $ApkSigner '00ef9948f843fe395d2440ae3ef41405b8040a6d5d46493bd1902ac0ee6deae7'
    $Jdk = Find-JdkBin
    $Java = Join-Path $Jdk 'java.exe'
    $Keytool = Join-Path $Jdk 'keytool.exe'
    $JarSigner = Join-Path $Jdk 'jarsigner.exe'
    if (-not $env:LOCALAPPDATA) { throw 'LOCALAPPDATA is missing. Run this kit in your own Windows user account.' }
    $KeyDirectory = Join-Path $env:LOCALAPPDATA 'UniLinkSigning'
    $Key = Join-Path $KeyDirectory 'unilink-upload.p12'
    $Alias = 'unilink-upload'
    Write-Host ''
    Write-Host 'UniLink owner-local signing' -ForegroundColor Cyan
    Write-Host ('JDK: ' + $Jdk)
    Write-Host ('Private upload key stays on this PC: ' + $Key)
    Write-Host 'No key, password, certificate or app is uploaded by this program.'
    Write-Host 'Type passwords only when keytool, apksigner or jarsigner asks. Input may look blank.'
    Write-Host ''

    if (-not (Test-Path -LiteralPath $Key)) {
        Write-Host 'This will create your first UniLink upload key. Keep its password and an encrypted backup.' -ForegroundColor Yellow
        $Confirmation = Read-Host 'Type CREATE to create the key on this PC, or press Enter to cancel'
        if ($Confirmation -cne 'CREATE') { throw 'Cancelled before creating a key.' }
        New-Item -ItemType Directory -Path $KeyDirectory -Force | Out-Null
        # Native keytool prompts for the password and its confirmation. No password variable or argument.
        Invoke-Checked $Keytool @('-genkeypair','-storetype','PKCS12','-keystore',$Key,'-alias',$Alias,'-keyalg','RSA','-keysize','3072','-validity','10000','-dname','CN=UniLink Upload')
    } else {
        Write-Host 'Reusing your existing local UniLink upload key. It will not be overwritten.'
    }

    $OutputRoot = Join-Path $Kit 'signed'
    New-Item -ItemType Directory -Path $OutputRoot -Force | Out-Null
    $Output = Join-Path $OutputRoot (Get-Date -Format 'yyyyMMdd-HHmmss-fff')
    New-Item -ItemType Directory -Path $Output -ErrorAction Stop | Out-Null
    $Certificate = Join-Path $Output 'UniLink-public-certificate.der'
    Write-Host ''
    Write-Host 'Exporting only the PUBLIC certificate. Enter your keystore password when asked.'
    Invoke-Checked $Keytool @('-exportcert','-keystore',$Key,'-storetype','PKCS12','-alias',$Alias,'-file',$Certificate)
    $CertificateHash = (Get-FileHash -LiteralPath $Certificate -Algorithm SHA256).Hash
    $Fingerprint = ([regex]::Matches($CertificateHash,'..') | ForEach-Object { $_.Value }) -join ':'
    $FingerprintFile = Join-Path $Output 'PUBLIC-CERTIFICATE-SHA256.txt'
    $Fingerprint | Set-Content -LiteralPath $FingerprintFile -Encoding Ascii

    $SignedApk = Join-Path $Output 'UniLink-release-signed.apk'
    Write-Host ''
    Write-Host 'Signing the installable RELEASE APK. Enter your keystore password when asked.'
    Invoke-Checked $Java @('-jar',$ApkSigner,'sign','--ks',$Key,'--ks-type','PKCS12','--ks-key-alias',$Alias,'--out',$SignedApk,$Apk)
    Invoke-Checked $Java @('-jar',$ApkSigner,'verify','--verbose','--print-certs',$SignedApk)

    $SignedAab = Join-Path $Output 'UniLink-upload-signed.aab'
    Write-Host ''
    Write-Host 'Signing the bundle for Google Play. Enter the same keystore password when asked.'
    Invoke-Checked $JarSigner @('-keystore',$Key,'-storetype','PKCS12','-signedjar',$SignedAab,'-digestalg','SHA-256',$Aab,$Alias)
    Invoke-Checked $JarSigner @('-verify',$SignedAab)

    $Hashes = @($SignedApk,$SignedAab) | ForEach-Object {
        $Hash = (Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()
        $Hash + '  ' + (Split-Path $_ -Leaf)
    }
    $Hashes | Set-Content -LiteralPath (Join-Path $Output 'SHA256SUMS.txt') -Encoding Ascii
    Write-Host ''
    Write-Host 'SUCCESS. Signed files are in:' -ForegroundColor Green
    Write-Host $Output
    Write-Host ''
    Write-Host 'Public certificate SHA-256 (safe to send for website verification):' -ForegroundColor Cyan
    Write-Host $Fingerprint
    Write-Host ''
    Write-Host 'Send only PUBLIC-CERTIFICATE-SHA256.txt to the UniLink website maintainer.'
    Write-Host 'Never send your private .p12 file or its password. Keep an encrypted backup outside this kit.'
    Write-Host 'Uninstall the old DEBUG test APK before installing this release APK: their signatures differ.'
    Write-Host 'The browser bar disappears only after the installed signing certificate is trusted by the website.'
    Write-Host 'For a Play installation, use the separate Play APP SIGNING certificate from Play Console App integrity.'
    exit 0
} catch {
    Write-Host ''
    Write-Host ('ERROR: ' + $_.Exception.Message) -ForegroundColor Red
    Write-Host 'No private key or password was uploaded. Keep any existing local key; do not delete it to retry.'
    exit 1
}
