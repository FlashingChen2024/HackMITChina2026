param(
    [string]$BaseUrl = "http://127.0.0.1:8080/api/v1",
    [int]$IntervalSeconds = 2
)

# 假的 MAC（device_id）
$DeviceId = "02:AA:BB:CC:DD:EE"

# 写死的用餐过程数据：随时间减少，模拟持续进食
$MealFrames = @(
    @{ grid_1 = 220.0; grid_2 = 180.0; grid_3 = 140.0; grid_4 = 95.0 },
    @{ grid_1 = 212.0; grid_2 = 172.0; grid_3 = 134.0; grid_4 = 90.0 },
    @{ grid_1 = 205.0; grid_2 = 165.0; grid_3 = 128.0; grid_4 = 86.0 },
    @{ grid_1 = 197.0; grid_2 = 159.0; grid_3 = 122.0; grid_4 = 82.0 },
    @{ grid_1 = 190.0; grid_2 = 153.0; grid_3 = 117.0; grid_4 = 78.0 },
    @{ grid_1 = 182.0; grid_2 = 147.0; grid_3 = 112.0; grid_4 = 74.0 },
    @{ grid_1 = 175.0; grid_2 = 141.0; grid_3 = 107.0; grid_4 = 70.0 },
    @{ grid_1 = 168.0; grid_2 = 136.0; grid_3 = 102.0; grid_4 = 67.0 },
    @{ grid_1 = 160.0; grid_2 = 130.0; grid_3 = 98.0;  grid_4 = 64.0 },
    @{ grid_1 = 152.0; grid_2 = 124.0; grid_3 = 94.0;  grid_4 = 60.0 }
)

$Uri = "$BaseUrl/hardware/telemetry"

Write-Host "Mock meal telemetry started."
Write-Host "Fake MAC / device_id: $DeviceId"
Write-Host "POST $Uri"
Write-Host "Press Ctrl+C to stop."

$index = 0
while ($true) {
    $weights = $MealFrames[$index]
    $body = @{
        device_id = $DeviceId
        timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
        weights   = $weights
    }

    try {
        $json = $body | ConvertTo-Json -Depth 5
        $resp = Invoke-RestMethod -Method Post -Uri $Uri -ContentType "application/json" -Body $json
        Write-Host "[$((Get-Date).ToString('HH:mm:ss'))] frame=$index sent, weights=$($weights | ConvertTo-Json -Compress), resp=$($resp | ConvertTo-Json -Compress)"
    }
    catch {
        Write-Warning "[$((Get-Date).ToString('HH:mm:ss'))] frame=$index failed: $($_.Exception.Message)"
    }

    Start-Sleep -Seconds $IntervalSeconds
    $index = ($index + 1) % $MealFrames.Count
}
