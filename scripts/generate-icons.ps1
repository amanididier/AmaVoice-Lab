# Generate minimal Tauri icons (no Python required)
$ErrorActionPreference = "Stop"
$dir = "src-tauri\icons"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

Add-Type -AssemblyName System.Drawing

function New-Png($size, $path) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = "AntiAlias"
  $g.Clear([System.Drawing.Color]::FromArgb(0,0,0,0))
  $brush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255,108,158,255))
  $margin = [Math]::Max(1, [int]($size/10))
  $rect = New-Object System.Drawing.Rectangle $margin, $margin, ($size-2*$margin), ($size-2*$margin)
  $g.FillEllipse($brush, $rect)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

New-Png 32 "$dir\32x32.png"
New-Png 128 "$dir\128x128.png"
New-Png 256 "$dir\128x128@2x.png"
New-Png 512 "$dir\icon.png"

# Minimal valid 16x16 32bpp ICO
$icoPath = "$dir\icon.ico"
$bytes = [byte[]](
  0x00,0x00,0x01,0x00,0x01,0x00,0x10,0x10,0x00,0x00,0x01,0x00,0x20,0x00,0x68,0x04,
  0x00,0x00,0x16,0x00,0x00,0x00
)
$header = [byte[]](
  0x28,0x00,0x00,0x00, 0x10,0x00,0x00,0x00, 0x20,0x00,0x00,0x00,
  0x01,0x00, 0x20,0x00, 0x00,0x00,0x00,0x00, 0x00,0x04,0x00,0x00,
  0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00, 0x00,0x00,0x00,0x00
)
$xor = New-Object byte[] (16*16*4)
for ($y=0; $y -lt 16; $y++) {
  for ($x=0; $x -lt 16; $x++) {
    $i = ($y*16+$x)*4
    $cx=7.5; $cy=7.5; $dx=$x-$cx; $dy=$y-$cy
    if (($dx*$dx+$dy*$dy) -le 49) {
      $xor[$i]=255; $xor[$i+1]=158; $xor[$i+2]=108; $xor[$i+3]=255
    }
  }
}
$and = New-Object byte[] 64
$stream = [System.IO.File]::Create($icoPath)
$stream.Write($bytes,0,$bytes.Length)
$stream.Write($header,0,$header.Length)
$stream.Write($xor,0,$xor.Length)
$stream.Write($and,0,$and.Length)
$stream.Close()
Write-Host "Icons written to $dir"
Get-ChildItem $dir | Select-Object Name, Length
