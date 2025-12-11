# Video Compression Script for 1111.mp4
# This script compresses the video using ffmpeg

param(
    [string]$InputFile = "public\1111.mp4",
    [string]$OutputFile = "public\1111-compressed.mp4",
    [int]$CRF = 28,  # Quality: 18-28 (lower = better quality, higher = smaller file)
    [int]$MaxWidth = 512,  # Max width for loading animation
    [int]$MaxHeight = 512  # Max height for loading animation
)

Write-Host "=== Video Compression Script ===" -ForegroundColor Cyan
Write-Host ""

# Check if input file exists
if (-not (Test-Path $InputFile)) {
    Write-Host "ERROR: Input file not found: $InputFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please make sure the file exists in the public folder." -ForegroundColor Yellow
    exit 1
}

# Get original file size
$originalSize = (Get-Item $InputFile).Length / 1MB
Write-Host "Original file: $InputFile" -ForegroundColor Green
Write-Host "Original size: $([math]::Round($originalSize, 2)) MB" -ForegroundColor Green
Write-Host ""

# Check if ffmpeg is available
$ffmpegPath = Get-Command ffmpeg.exe -ErrorAction SilentlyContinue
if (-not $ffmpegPath) {
    Write-Host "FFmpeg not found in PATH." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install FFmpeg:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://ffmpeg.org/download.html" -ForegroundColor Yellow
    Write-Host "2. Or install via Chocolatey: choco install ffmpeg" -ForegroundColor Yellow
    Write-Host "3. Or install via winget: winget install ffmpeg" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "After installing, restart your terminal and run this script again." -ForegroundColor Yellow
    exit 1
}

Write-Host "FFmpeg found: $($ffmpegPath.Source)" -ForegroundColor Green
Write-Host ""

# Compression settings
Write-Host "Compression settings:" -ForegroundColor Cyan
Write-Host "  Quality (CRF): $CRF (lower = better quality)" -ForegroundColor White
Write-Host "  Max dimensions: ${MaxWidth}x${MaxHeight}" -ForegroundColor White
Write-Host "  Output: $OutputFile" -ForegroundColor White
Write-Host ""

# Build ffmpeg command
$ffmpegArgs = @(
    "-i", "`"$InputFile`"",
    "-vcodec", "libx264",
    "-crf", $CRF.ToString(),
    "-preset", "slow",  # Better compression
    "-vf", "scale='if(gt(iw,ih),$MaxWidth,-1)':'if(gt(iw,ih),-1,$MaxHeight)':force_original_aspect_ratio=decrease",
    "-movflags", "+faststart",  # Web optimization
    "-pix_fmt", "yuv420p",  # Compatibility
    "-an",  # Remove audio (not needed for loading animation)
    "-y",  # Overwrite output file
    "`"$OutputFile`""
)

Write-Host "Compressing video..." -ForegroundColor Yellow
Write-Host "This may take a few minutes..." -ForegroundColor Yellow
Write-Host ""

# Run ffmpeg
$process = Start-Process -FilePath $ffmpegPath.Source -ArgumentList $ffmpegArgs -NoNewWindow -Wait -PassThru

if ($process.ExitCode -eq 0) {
    Write-Host ""
    Write-Host "=== Compression Complete! ===" -ForegroundColor Green
    Write-Host ""
    
    # Get compressed file size
    if (Test-Path $OutputFile) {
        $compressedSize = (Get-Item $OutputFile).Length / 1MB
        $reduction = (($originalSize - $compressedSize) / $originalSize) * 100
        
        Write-Host "Original size: $([math]::Round($originalSize, 2)) MB" -ForegroundColor White
        Write-Host "Compressed size: $([math]::Round($compressedSize, 2)) MB" -ForegroundColor Green
        Write-Host "Size reduction: $([math]::Round($reduction, 1))%" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "Output file: $OutputFile" -ForegroundColor Green
        
        # Ask if user wants to replace original
        Write-Host ""
        $replace = Read-Host "Do you want to replace the original file? (y/n)"
        if ($replace -eq "y" -or $replace -eq "Y") {
            Move-Item -Path $OutputFile -Destination $InputFile -Force
            Write-Host "Original file replaced with compressed version." -ForegroundColor Green
        } else {
            Write-Host "Compressed file saved as: $OutputFile" -ForegroundColor Yellow
            Write-Host "You can manually replace the original when ready." -ForegroundColor Yellow
        }
    }
} else {
    Write-Host ""
    Write-Host "ERROR: Compression failed!" -ForegroundColor Red
    Write-Host "Exit code: $($process.ExitCode)" -ForegroundColor Red
    exit 1
}

