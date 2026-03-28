$ErrorActionPreference = "Stop"

$env:HTTP_PORT = "18081"
$env:MYSQL_DSN = "root:963487158835@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
$env:REDIS_ADDR = "127.0.0.1:6379"
$env:REDIS_PASSWORD = ""
$env:REDIS_DB = "0"

$baseUrl = "http://127.0.0.1:18081/api/v1"
$runID = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$workDir = "D:\MIT\newdev\backend"
$logOutPath = Join-Path $env:TEMP ("kxyz-m3-server-" + $runID + ".out.log")
$logErrPath = Join-Path $env:TEMP ("kxyz-m3-server-" + $runID + ".err.log")
$server = Start-Process -FilePath "go" -ArgumentList @("run", "./cmd/server") -WorkingDirectory $workDir -PassThru -WindowStyle Hidden -RedirectStandardOutput $logOutPath -RedirectStandardError $logErrPath

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
        $json = $Body | ConvertTo-Json -Depth 20
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

    $username = "m3_user_$runID"
    $password = "Passw0rd!123"
    [void](Invoke-Api -Method Post -Path "/auth/register" -Body @{ username = $username; password = $password })
    $login = Invoke-Api -Method Post -Path "/auth/login" -Body @{ username = $username; password = $password }
    $token = [string]$login.token
    $userID = [string]$login.user_id
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "login token missing"
    }

    $now = Get-Date
    $startClock = $now.AddMinutes(-1).ToString("HH:mm")
    $endClock = $now.AddMinutes(1).ToString("HH:mm")
    $endToday = Get-Date -Hour $now.AddMinutes(1).Hour -Minute $now.AddMinutes(1).Minute -Second 0
    $targetCheck = $endToday.AddMinutes(1).AddSeconds(5)

    [void](Invoke-Api -Method Put -Path "/users/me/alert-setting" -Token $token -Body @{
            email          = "m3-$runID@example.com"
            global_enabled = $true
            rules          = @{
                meal_times = @{
                    enabled   = $true
                    breakfast = @{ start = "07:00"; end = "09:30" }
                    lunch     = @{ start = $startClock; end = $endClock }
                    dinner    = @{ start = "18:00"; end = "20:00" }
                }
            }
        })

    while ((Get-Date) -lt $targetCheck) {
        Start-Sleep -Seconds 1
    }

    $deadline = (Get-Date).AddSeconds(120)
    $found = $false
    while ((Get-Date) -lt $deadline) {
        $logText = (Get-Content -Raw -Path $logOutPath -Encoding UTF8) + "`n" + (Get-Content -Raw -Path $logErrPath -Encoding UTF8)
        if ($logText -like ("*{0}*" -f $userID)) {
            $found = $true
            break
        }
        Start-Sleep -Seconds 2
    }

    if (-not $found -and $null -ne $server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
        Start-Sleep -Milliseconds 500
        $logText = (Get-Content -Raw -Path $logOutPath -Encoding UTF8) + "`n" + (Get-Content -Raw -Path $logErrPath -Encoding UTF8)
        if ($logText -like ("*{0}*" -f $userID)) {
            $found = $true
        }
    }

    if (-not $found) {
        throw ("acceptance failed: missed-meal warning not found, out_log={0} err_log={1}" -f $logOutPath, $logErrPath)
    }

    [PSCustomObject]@{
        ping             = $ping.message
        username         = $username
        user_id          = $userID
        lunch_start      = $startClock
        lunch_end        = $endClock
        warning_found    = $found
        server_out_log   = $logOutPath
        server_err_log   = $logErrPath
        acceptance_case  = "M3 meal_times cron missed lunch"
    } | ConvertTo-Json -Depth 8
}
finally {
    if ($null -ne $server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
