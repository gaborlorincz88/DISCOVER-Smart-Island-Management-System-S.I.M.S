Write-Host "Generating test analytics data..." -ForegroundColor Cyan

$places = @(
    @{id=1; name='Citadella - Victoria'; category='Historical Sites'; lat=36.0448; lng=14.2394},
    @{id=2; name='Ggantija Temples'; category='Historical Sites'; lat=36.0470; lng=14.2675},
    @{id=3; name='Ta Pinu Shrine'; category='Churches'; lat=36.0554; lng=14.2297},
    @{id=4; name='Azure Window'; category='Natural'; lat=36.0563; lng=14.1895},
    @{id=5; name='Ramla Bay'; category='Beaches'; lat=36.0655; lng=14.2858}
)

$searches = @('beach', 'church', 'hotel', 'restaurant', 'bus', 'diving', 'hiking', 'ferry')
$trips = @('My Gozo Trip', 'Weekend Getaway', 'Family Vacation', 'Historical Tour')

# Generate view_place events
Write-Host "Generating view_place events..." -ForegroundColor Yellow
for ($i = 0; $i -lt 50; $i++) {
    $place = $places[$i % $places.Length]
    $body = @{
        event_type = 'view_place'
        event_data = @{
            place_id = $place.id
            place_name = $place.name
            category = $place.category
            latitude = $place.lat
            longitude = $place.lng
        }
    } | ConvertTo-Json -Compress
    
    try {
        Invoke-RestMethod -Uri 'http://localhost:3003/api/analytics/event' -Method POST -ContentType 'application/json' -Body $body | Out-Null
        Write-Host "." -NoNewline -ForegroundColor Green
    } catch {
        Write-Host "X" -NoNewline -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 50
}
Write-Host ""

# Generate search_query events
Write-Host "Generating search_query events..." -ForegroundColor Yellow
for ($i = 0; $i -lt 30; $i++) {
    $query = $searches[$i % $searches.Length]
    $body = @{
        event_type = 'search_query'
        event_data = @{
            query = $query
        }
    } | ConvertTo-Json -Compress
    
    try {
        Invoke-RestMethod -Uri 'http://localhost:3003/api/analytics/event' -Method POST -ContentType 'application/json' -Body $body | Out-Null
        Write-Host "." -NoNewline -ForegroundColor Green
    } catch {
        Write-Host "X" -NoNewline -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 50
}
Write-Host ""

# Generate create_trip events
Write-Host "Generating create_trip events..." -ForegroundColor Yellow
for ($i = 0; $i -lt 20; $i++) {
    $tripName = $trips[$i % $trips.Length]
    $body = @{
        event_type = 'create_trip'
        event_data = @{
            trip_name = $tripName
        }
    } | ConvertTo-Json -Compress
    
    try {
        Invoke-RestMethod -Uri 'http://localhost:3003/api/analytics/event' -Method POST -ContentType 'application/json' -Body $body | Out-Null
        Write-Host "." -NoNewline -ForegroundColor Green
    } catch {
        Write-Host "X" -NoNewline -ForegroundColor Red
    }
    Start-Sleep -Milliseconds 50
}
Write-Host ""

Write-Host "`nDone! Generated 100 test events." -ForegroundColor Green
Write-Host "Now open http://localhost:3003/analytics.html to see the results!" -ForegroundColor Cyan


