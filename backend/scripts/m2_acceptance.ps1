$ErrorActionPreference = "Stop"

$env:HTTP_PORT = "18080"
$env:MYSQL_DSN = "root:963487158835@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
$env:REDIS_ADDR = "127.0.0.1:6379"
$env:REDIS_PASSWORD = ""
$env:REDIS_DB = "0"

$baseUrl = "http://127.0.0.1:18080/api/v1"
$runID = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$workDir = "D:\MIT\newdev\backend"
$logOutPath = Join-Path $env:TEMP ("kxyz-m2-server-" + $runID + ".out.log")
$logErrPath = Join-Path $env:TEMP ("kxyz-m2-server-" + $runID + ".err.log")
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

    $username = "laochen_$runID"
    $password = "Passw0rd!123"
    [void](Invoke-Api -Method Post -Path "/auth/register" -Body @{ username = $username; password = $password })
    $login = Invoke-Api -Method Post -Path "/auth/login" -Body @{ username = $username; password = $password }
    $token = [string]$login.token
    $userID = [string]$login.user_id
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "login token missing"
    }

    [void](Invoke-Api -Method Put -Path "/users/me/alert-setting" -Token $token -Body @{
            email          = "laochen-$runID@example.com"
            global_enabled = $true
            rules          = @{
                speed = @{
                    enabled = $true
                    min     = 0
                    max     = 10
                }
            }
        })

    $deviceID = "ESP32_M2_$runID"
    [void](Invoke-Api -Method Post -Path "/devices/bind" -Token $token -Body @{ device_id = $deviceID })

    $base = [DateTime]::UtcNow.AddHours(1)
    $t0 = $base
    $t1 = $base.AddSeconds(20)
    $t2 = $base.AddSeconds(50)
    $t3 = $base.AddSeconds(80)

    [void](Invoke-Api -Method Post -Path "/hardware/telemetry" -Body @{
            device_id = $deviceID
            timestamp = $t0.ToString("o")
            weights   = @{ grid_1 = 100.0; grid_2 = 0.0; grid_3 = 0.0; grid_4 = 0.0 }
        })
    [void](Invoke-Api -Method Post -Path "/hardware/telemetry" -Body @{
            device_id = $deviceID
            timestamp = $t1.ToString("o")
            weights   = @{ grid_1 = 95.0; grid_2 = 0.0; grid_3 = 0.0; grid_4 = 0.0 }
        })
    [void](Invoke-Api -Method Post -Path "/hardware/telemetry" -Body @{
            device_id = $deviceID
            timestamp = $t2.ToString("o")
            weights   = @{ grid_1 = 50.0; grid_2 = 0.0; grid_3 = 0.0; grid_4 = 0.0 }
        })
    [void](Invoke-Api -Method Post -Path "/hardware/telemetry" -Body @{
            device_id = $deviceID
            timestamp = $t3.ToString("o")
            weights   = @{ grid_1 = 0.0; grid_2 = 0.0; grid_3 = 0.0; grid_4 = 0.0 }
        })

    Start-Sleep -Milliseconds 600
    $outText = Get-Content -Raw -Path $logOutPath -Encoding UTF8
    $errText = Get-Content -Raw -Path $logErrPath -Encoding UTF8
    $logText = $outText + "`n" + $errText
    $hasWarning = ($logText -like ("*{0}*50.0g/min*10.0g/min*" -f $userID))
    if (-not $hasWarning) {
        throw ("acceptance failed: warning log not found, out_log={0}" -f $logOutPath)
    }

    [PSCustomObject]@{
        ping               = $ping.message
        username           = $username
        user_id            = $userID
        device_id          = $deviceID
        expected_warning   = "contains user_id + 50.0g/min + 10.0g/min"
        warning_log_found  = $hasWarning
        server_out_log     = $logOutPath
        server_err_log     = $logErrPath
        acceptance_case    = "M2 check meal alerts speed threshold"
    } | ConvertTo-Json -Depth 8
}
finally {
    if ($null -ne $server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
