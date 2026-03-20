$ErrorActionPreference = "Stop"

$env:HTTP_PORT = "18080"
$env:MYSQL_DSN = "root:963487158835@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
$env:REDIS_ADDR = "127.0.0.1:6379"
$env:REDIS_PASSWORD = ""
$env:REDIS_DB = "0"

function Load-EnvFileMap {
    param(
        [Parameter(Mandatory = $true)] [string]$Path
    )

    $map = @{}
    if (-not (Test-Path $Path)) {
        return $map
    }

    foreach ($line in Get-Content -Path $Path -Encoding utf8) {
        $trimmed = $line.Trim()
        if ($trimmed -eq "" -or $trimmed.StartsWith("#")) {
            continue
        }
        $parts = $trimmed.Split("=", 2)
        if ($parts.Count -ne 2) {
            continue
        }
        $key = $parts[0].Trim()
        $value = $parts[1].Trim()
        if ($key -ne "") {
            $map[$key] = $value
        }
    }

    return $map
}

$envFileMap = Load-EnvFileMap -Path "D:\MIT\backend\.env"
foreach ($key in @("AI_BASE_URL", "AI_MODEL", "AI_API_KEY", "AI_TEMPERATURE")) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($key)) -and $envFileMap.ContainsKey($key)) {
        [Environment]::SetEnvironmentVariable($key, $envFileMap[$key])
    }
}

$baseUrl = "http://127.0.0.1:18080/api/v1"
$runID = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$logOutPath = Join-Path $env:TEMP ("kxyz-m2-server-" + $runID + ".out.log")
$logErrPath = Join-Path $env:TEMP ("kxyz-m2-server-" + $runID + ".err.log")
$server = Start-Process -FilePath "go" -ArgumentList @("run", "./cmd/server") -WorkingDirectory "D:\MIT\backend" -PassThru -WindowStyle Hidden -RedirectStandardOutput $logOutPath -RedirectStandardError $logErrPath

function Invoke-Api {
    param(
        [Parameter(Mandatory = $true)] [string]$Method,
        [Parameter(Mandatory = $true)] [string]$Path,
        [object]$Body,
        [string]$Token = ""
    )

    $headers = @{}
    if ($Token -ne "") {
        $headers["Authorization"] = "Bearer $Token"
    }

    if ($null -ne $Body) {
        $json = $Body | ConvertTo-Json -Depth 10
        return Invoke-RestMethod -Method $Method -Uri ($baseUrl + $Path) -Headers $headers -ContentType "application/json" -Body $json
    }

    return Invoke-RestMethod -Method $Method -Uri ($baseUrl + $Path) -Headers $headers
}

try {
    $healthy = $false
    for ($i = 0; $i -lt 40; $i++) {
        try {
            $ping = Invoke-RestMethod -Method Get -Uri ($baseUrl + "/ping")
            if ($ping.message -eq "pong") {
                $healthy = $true
                break
            }
        }
        catch {
            Start-Sleep -Seconds 1
        }
    }

    if (-not $healthy) {
        throw "server start timeout, out_log=$logOutPath err_log=$logErrPath"
    }

    $username = "m2_user_$runID"
    $password = "Passw0rd!123"
    [void](Invoke-Api -Method Post -Path "/auth/register" -Body @{ username = $username; password = $password })
    $login = Invoke-Api -Method Post -Path "/auth/login" -Body @{ username = $username; password = $password }
    $token = [string]$login.token
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "login token missing"
    }

    $deviceID = "ESP32_M2_$runID"
    [void](Invoke-Api -Method Post -Path "/devices/bind" -Token $token -Body @{ device_id = $deviceID })

    $community = Invoke-Api -Method Post -Path "/communities/create" -Token $token -Body @{
        name        = "M2 Chain $runID"
        description = "M2 E2E acceptance"
    }
    $communityID = [string]$community.community_id
    if ([string]::IsNullOrWhiteSpace($communityID)) {
        throw "community_id missing after create"
    }

    $t0 = [DateTime]::UtcNow.AddHours(2)
    $t1 = $t0.AddSeconds(20)
    $t2 = $t1.AddMinutes(5)
    $t3 = $t1.AddMinutes(20)

    $telemetry1 = Invoke-Api -Method Post -Path "/hardware/telemetry" -Body @{
        device_id  = $deviceID
        timestamp  = $t0.ToString("o")
        weights    = @{ grid_1 = 220.0; grid_2 = 160.0; grid_3 = 140.0; grid_4 = 100.0 }
    }
    $telemetry2 = Invoke-Api -Method Post -Path "/hardware/telemetry" -Body @{
        device_id  = $deviceID
        timestamp  = $t1.ToString("o")
        weights    = @{ grid_1 = 210.0; grid_2 = 150.0; grid_3 = 130.0; grid_4 = 90.0 }
    }
    $telemetry3 = Invoke-Api -Method Post -Path "/hardware/telemetry" -Body @{
        device_id  = $deviceID
        timestamp  = $t2.ToString("o")
        weights    = @{ grid_1 = 120.0; grid_2 = 70.0; grid_3 = 40.0; grid_4 = 20.0 }
    }
    $telemetry4 = Invoke-Api -Method Post -Path "/hardware/telemetry" -Body @{
        device_id  = $deviceID
        timestamp  = $t3.ToString("o")
        weights    = @{ grid_1 = 0.0; grid_2 = 0.0; grid_3 = 0.0; grid_4 = 0.0 }
    }

    if ($telemetry1.current_state -ne "SERVING") {
        throw "unexpected state after telemetry1: $($telemetry1.current_state)"
    }
    if ($telemetry2.current_state -ne "EATING") {
        throw "unexpected state after telemetry2: $($telemetry2.current_state)"
    }
    if ($telemetry4.current_state -ne "IDLE") {
        throw "unexpected state after telemetry4: $($telemetry4.current_state)"
    }

    $mealList = Invoke-Api -Method Get -Path "/meals" -Token $token
    $items = @($mealList.items)
    if ($items.Count -eq 0) {
        throw "no meals found after telemetry sequence"
    }

    $targetMeal = $null
    $threshold = $t0.AddMinutes(-1)
    foreach ($item in $items) {
        $startTime = [DateTime]::Parse([string]$item.start_time).ToUniversalTime()
        if ($startTime -ge $threshold) {
            $targetMeal = $item
            break
        }
    }
    if ($null -eq $targetMeal) {
        $targetMeal = $items[0]
    }

    $mealID = [string]$targetMeal.meal_id
    if ([string]::IsNullOrWhiteSpace($mealID)) {
        throw "meal_id missing in meals response"
    }

    [void](Invoke-Api -Method Put -Path ("/meals/" + $mealID + "/foods") -Token $token -Body @{
        grids = @(
            @{ grid_index = 1; food_name = "Chicken Breast"; unit_cal_per_100g = 165.0 },
            @{ grid_index = 2; food_name = "Brown Rice"; unit_cal_per_100g = 116.0 },
            @{ grid_index = 3; food_name = "Broccoli"; unit_cal_per_100g = 33.0 },
            @{ grid_index = 4; food_name = "Seaweed Soup"; unit_cal_per_100g = 15.0 }
        )
    })

    $advice = Invoke-Api -Method Get -Path "/users/me/ai-advice" -Token $token
    if ([string]::IsNullOrWhiteSpace([string]$advice.advice)) {
        throw "ai advice empty"
    }

    $dashboard = Invoke-Api -Method Get -Path ("/communities/" + $communityID + "/dashboard") -Token $token
    $foodStats = @($dashboard.food_avg_stats)
    if ($foodStats.Count -eq 0) {
        throw "dashboard food_avg_stats empty"
    }

    $hasChicken = $false
    foreach ($row in $foodStats) {
        if ([string]$row.food_name -eq "Chicken Breast" -and [double]$row.avg_served_g -gt 0) {
            $hasChicken = $true
            break
        }
    }
    if (-not $hasChicken) {
        throw "dashboard does not contain expected Chicken Breast stats"
    }

    [PSCustomObject]@{
        ping             = $ping.message
        username         = $username
        device_id        = $deviceID
        community_id     = $communityID
        meal_id          = $mealID
        telemetry_states = @(
            [string]$telemetry1.current_state,
            [string]$telemetry2.current_state,
            [string]$telemetry3.current_state,
            [string]$telemetry4.current_state
        )
        ai_advice_type   = [string]$advice.type
        ai_advice_sample = [string]$advice.advice
        dashboard_rows   = $foodStats.Count
        server_out_log   = $logOutPath
        server_err_log   = $logErrPath
    } | ConvertTo-Json -Depth 8
}
finally {
    if ($null -ne $server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
