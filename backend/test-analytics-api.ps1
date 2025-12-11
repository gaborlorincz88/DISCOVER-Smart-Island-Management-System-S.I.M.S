$response = Invoke-WebRequest -Uri 'http://localhost:3003/api/analytics/comprehensive?period=30d' -Method GET
$json = $response.Content | ConvertFrom-Json

Write-Host "=== Analytics API Test ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Heatmap Data Count: $($json.heatmapData.Count)" -ForegroundColor Yellow
Write-Host "Hourly Stats Count: $($json.hourlyStats.Count)" -ForegroundColor Yellow
Write-Host "Daily Stats Count: $($json.dailyStats.Count)" -ForegroundColor Yellow
Write-Host ""

if ($json.heatmapData.Count -gt 0) {
    Write-Host "✓ Heatmap data exists!" -ForegroundColor Green
    Write-Host "Sample heatmap point:" -ForegroundColor Gray
    $json.heatmapData[0] | Format-List
} else {
    Write-Host "✗ No heatmap data found!" -ForegroundColor Red
}


