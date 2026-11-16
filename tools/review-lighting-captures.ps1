[CmdletBinding()]
param([string]$Folder = 'test-results/baked-rooms')
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
foreach ($state in @('emergency','restored')) {
    $files = @(Get-ChildItem -LiteralPath $Folder -File | Where-Object Name -Like "*-$state.png" | Sort-Object Name)
    if ($files.Count -ne 12) { throw "Expected 12 $state room captures; found $($files.Count)." }
    $sheet = New-Object System.Drawing.Bitmap 1440,1200
    $drawing = [System.Drawing.Graphics]::FromImage($sheet)
    $drawing.Clear([System.Drawing.Color]::FromArgb(10,15,15))
    $drawing.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $font = New-Object System.Drawing.Font 'Arial',13
    for ($i = 0; $i -lt $files.Count; $i++) {
        $picture = [System.Drawing.Image]::FromFile($files[$i].FullName)
        $x = ($i % 3)*480; $y = [math]::Floor($i / 3)*300
        $drawing.DrawImage($picture,$x,$y,480,270)
        $drawing.DrawString($files[$i].BaseName,$font,[System.Drawing.Brushes]::Wheat,$x+10,$y+274)
        $picture.Dispose()
    }
    $sheet.Save((Join-Path (Resolve-Path $Folder) "$state-contact-sheet.jpg"),[System.Drawing.Imaging.ImageFormat]::Jpeg)
    $font.Dispose(); $drawing.Dispose(); $sheet.Dispose()
}
