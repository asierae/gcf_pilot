<#
    Generates the favicon set from the master logo (gold hexagon + arrow on navy).

    Usage:
        powershell -ExecutionPolicy Bypass -File scripts/generate-favicons.ps1 `
            -Source "C:\path\to\AVERA_logo_512x512.png"

    Outputs into public/:
        favicon.svg, favicon.ico (16/32/48), favicon-16x16.png, favicon-32x32.png,
        favicon-48x48.png, apple-touch-icon.png (180), icon-192.png, icon-512.png
#>
param(
    [string]$Source = "$PSScriptRoot\..\AVERA_logo_512x512.png",
    [string]$OutputDir = "$PSScriptRoot\..\public"
)

Add-Type -AssemblyName System.Drawing

$sourcePath = (Resolve-Path $Source).Path
$outDir = (Resolve-Path $OutputDir).Path
$master = [System.Drawing.Bitmap]::FromFile($sourcePath)

function New-ScaledBitmap {
    param([System.Drawing.Bitmap]$Bitmap, [int]$Size)

    $current = $Bitmap
    while ($current.Width -ge $Size * 2) {
        $half = New-Object System.Drawing.Bitmap ([int]($current.Width / 2)), ([int]($current.Height / 2))
        $graphics = [System.Drawing.Graphics]::FromImage($half)
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($current, 0, 0, $half.Width, $half.Height)
        $graphics.Dispose()
        if (-not [object]::ReferenceEquals($current, $Bitmap)) { $current.Dispose() }
        $current = $half
    }

    # Always return a bitmap the caller owns: cloning keeps the master usable.
    if ($current.Width -eq $Size) { return $current.Clone() }

    $final = New-Object System.Drawing.Bitmap $Size, $Size
    $graphics = [System.Drawing.Graphics]::FromImage($final)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.DrawImage($current, 0, 0, $Size, $Size)
    $graphics.Dispose()
    if (-not [object]::ReferenceEquals($current, $Bitmap)) { $current.Dispose() }
    return $final
}

$pngSizes = [ordered]@{
    'favicon-16x16.png'      = 16
    'favicon-32x32.png'      = 32
    'favicon-48x48.png'      = 48
    'apple-touch-icon.png'   = 180
    'icon-192.png'           = 192
    'icon-512.png'           = 512
}

foreach ($entry in $pngSizes.GetEnumerator()) {
    $bitmap = New-ScaledBitmap -Bitmap $master -Size $entry.Value
    $target = Join-Path $outDir $entry.Key
    $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
    $bitmap.Dispose()
    Write-Host ("wrote {0} ({1}x{1})" -f $entry.Key, $entry.Value)
}

# --- favicon.ico: 16/32/48 frames, PNG-compressed (Vista+ / every current browser)
$icoSizes = 16, 32, 48
$frames = foreach ($size in $icoSizes) { New-ScaledBitmap -Bitmap $master -Size $size }
$blobs = foreach ($frame in $frames) {
    $stream = New-Object System.IO.MemoryStream
    $frame.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png)
    , $stream.ToArray()
}
foreach ($frame in $frames) { $frame.Dispose() }

$icoPath = Join-Path $outDir 'favicon.ico'
$file = [System.IO.File]::Create($icoPath)
$writer = New-Object System.IO.BinaryWriter($file)
$writer.Write([UInt16]0)                       # reserved
$writer.Write([UInt16]1)                       # 1 = icon
$writer.Write([UInt16]$blobs.Count)            # image count
$offset = 6 + (16 * $blobs.Count)
for ($i = 0; $i -lt $blobs.Count; $i++) {
    $size = $icoSizes[$i]
    $writer.Write([Byte]$(if ($size -ge 256) { 0 } else { $size }))  # width
    $writer.Write([Byte]$(if ($size -ge 256) { 0 } else { $size }))  # height
    $writer.Write([Byte]0)                     # palette colours
    $writer.Write([Byte]0)                     # reserved
    $writer.Write([UInt16]1)                   # colour planes
    $writer.Write([UInt16]32)                  # bits per pixel
    $writer.Write([UInt32]$blobs[$i].Length)   # bytes in resource
    $writer.Write([UInt32]$offset)             # offset
    $offset += $blobs[$i].Length
}
foreach ($blob in $blobs) { $writer.Write([Byte[]]$blob) }
$writer.Flush()
$writer.Close()
Write-Host ("wrote favicon.ico ({0} frames)" -f $blobs.Count)

# --- favicon.svg: vector redraw of the same mark, geometry measured off the master
# Coordinates are in a 64x64 box (master pixels / 8).
$cx = 31.81
$cy = 31.06
$rx = 16.19   # horizontal reach of the hexagon (stroke centreline)
$ry = 17.94   # vertical reach

$vertices = @(
    @($cx, ($cy - $ry)),                 # top
    @(($cx + $rx), ($cy - $ry / 2)),     # upper right
    @(($cx + $rx), ($cy + $ry / 2)),     # lower right
    @($cx, ($cy + $ry)),                 # bottom
    @(($cx - $rx), ($cy + $ry / 2)),     # lower left
    @(($cx - $rx), ($cy - $ry / 2))      # upper left
)

$points = ($vertices | ForEach-Object { '{0:0.##},{1:0.##}' -f $_[0], $_[1] }) -join ' '

$svg = @"
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img" aria-label="Avera Capital Access">
  <title>Avera Capital Access</title>
  <defs>
    <linearGradient id="bg" x1="1" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#032c4a" />
      <stop offset="0.55" stop-color="#001a2d" />
      <stop offset="1" stop-color="#000b18" />
    </linearGradient>
    <linearGradient id="gold" x1="0.35" y1="0" x2="0.65" y2="1">
      <stop offset="0" stop-color="#ffe27b" />
      <stop offset="0.55" stop-color="#f0b52f" />
      <stop offset="1" stop-color="#d99a20" />
    </linearGradient>
  </defs>
  <rect width="64" height="64" fill="url(#bg)" />
  <polygon points="$points" fill="none" stroke="url(#gold)" stroke-width="2.125" stroke-linejoin="round" />
  <path d="M21.5 34.75 31.81 21.25 42.12 34.75 M31.81 21.25 V41.25" fill="none" stroke="url(#gold)"
        stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round" />
</svg>
"@

$svgPath = Join-Path $outDir 'favicon.svg'
[System.IO.File]::WriteAllText($svgPath, $svg, (New-Object System.Text.UTF8Encoding($false)))
Write-Host 'wrote favicon.svg'

$master.Dispose()
Write-Host 'Done.'
