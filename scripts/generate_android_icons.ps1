Add-Type -AssemblyName System.Drawing

$srcPath = "public/tps-logo.png"
if (-not (Test-Path $srcPath)) {
    Write-Error "Source image $srcPath not found"
    exit 1
}

$srcBmp = [System.Drawing.Bitmap]::new($srcPath)

# Densities for adaptive icon foreground (108dp)
# mdpi=108, hdpi=162, xhdpi=216, xxhdpi=324, xxxhdpi=432
$adaptiveDensities = @{
    "mipmap-mdpi"    = 108
    "mipmap-hdpi"    = 162
    "mipmap-xhdpi"   = 216
    "mipmap-xxhdpi"  = 324
    "mipmap-xxxhdpi" = 432
}

# Densities for legacy launcher icons (48dp)
# mdpi=48, hdpi=72, xhdpi=96, xxhdpi=144, xxxhdpi=192
$legacyDensities = @{
    "mipmap-mdpi"    = 48
    "mipmap-hdpi"    = 72
    "mipmap-xhdpi"   = 96
    "mipmap-xxhdpi"  = 144
    "mipmap-xxxhdpi" = 192
}

# Ratio of emblem size relative to the canvas
# For 108dp adaptive canvas: safe zone is 66dp-72dp. Sizing emblem to ~52% (56dp)
# ensures it occupies ~78% of the visible squircle/circle with perfect breathing room.
$adaptiveRatio = 0.52
$legacyRatio = 0.72

foreach ($folder in $adaptiveDensities.Keys) {
    $dir = "android/app/src/main/res/$folder"
    if (-not (Test-Path $dir)) {
        New-Item -ItemType Directory -Path $dir -Force | Out-Null
    }

    # 1. Generate ic_launcher_foreground.png (108dp canvas, transparent background)
    $canvasSize = $adaptiveDensities[$folder]
    $emblemSize = [int][Math]::Round($canvasSize * $adaptiveRatio)
    $offset = [int][Math]::Round(($canvasSize - $emblemSize) / 2.0)

    $fgBmp = [System.Drawing.Bitmap]::new($canvasSize, $canvasSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($fgBmp)
    $g.Clear([System.Drawing.Color]::Transparent)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $destRect = [System.Drawing.Rectangle]::new($offset, $offset, $emblemSize, $emblemSize)
    $g.DrawImage($srcBmp, $destRect)
    $g.Dispose()

    $fgPath = "$dir/ic_launcher_foreground.png"
    $fgBmp.Save($fgPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $fgBmp.Dispose()
    Write-Host "Created $fgPath (${canvasSize}x${canvasSize}, emblem: ${emblemSize}x${emblemSize})"

    # 2. Generate legacy ic_launcher.png (white rounded squircle background + centered emblem)
    $legSize = $legacyDensities[$folder]
    $legEmblemSize = [int][Math]::Round($legSize * $legacyRatio)
    $legOffset = [int][Math]::Round(($legSize - $legEmblemSize) / 2.0)

    $legBmp = [System.Drawing.Bitmap]::new($legSize, $legSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gLeg = [System.Drawing.Graphics]::FromImage($legBmp)
    $gLeg.Clear([System.Drawing.Color]::Transparent)
    $gLeg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gLeg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gLeg.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gLeg.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Draw rounded white rectangle for squircle shape
    $cornerRad = [int][Math]::Round($legSize * 0.22)
    $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $d = $cornerRad * 2
    $r = [System.Drawing.Rectangle]::new(0, 0, $legSize - 1, $legSize - 1)
    $path.AddArc($r.X, $r.Y, $d, $d, 180, 90)
    $path.AddArc($r.Right - $d, $r.Y, $d, $d, 270, 90)
    $path.AddArc($r.Right - $d, $r.Bottom - $d, $d, $d, 0, 90)
    $path.AddArc($r.X, $r.Bottom - $d, $d, $d, 90, 90)
    $path.CloseFigure()

    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $gLeg.FillPath($whiteBrush, $path)
    $whiteBrush.Dispose()
    $path.Dispose()

    $legDestRect = [System.Drawing.Rectangle]::new($legOffset, $legOffset, $legEmblemSize, $legEmblemSize)
    $gLeg.DrawImage($srcBmp, $legDestRect)
    $gLeg.Dispose()

    $legPath = "$dir/ic_launcher.png"
    $legBmp.Save($legPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $legBmp.Dispose()
    Write-Host "Created $legPath (${legSize}x${legSize})"

    # 3. Generate legacy ic_launcher_round.png (white circular background + centered emblem)
    $roundBmp = [System.Drawing.Bitmap]::new($legSize, $legSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gRound = [System.Drawing.Graphics]::FromImage($roundBmp)
    $gRound.Clear([System.Drawing.Color]::Transparent)
    $gRound.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gRound.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gRound.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gRound.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $whiteBrush = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::White)
    $gRound.FillEllipse($whiteBrush, 0, 0, $legSize - 1, $legSize - 1)
    $whiteBrush.Dispose()

    $gRound.DrawImage($srcBmp, $legDestRect)
    $gRound.Dispose()

    $roundPath = "$dir/ic_launcher_round.png"
    $roundBmp.Save($roundPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $roundBmp.Dispose()
    Write-Host "Created $roundPath (${legSize}x${legSize})"
}

$srcBmp.Dispose()
Write-Host "All Android launcher icons successfully updated!"
