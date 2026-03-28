$ErrorActionPreference = "Stop"

$env:HTTP_PORT = "8080"
$env:MYSQL_DSN = "root:963487158835@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
$env:REDIS_ADDR = "127.0.0.1:6379"
$env:REDIS_PASSWORD = ""
$env:REDIS_DB = "0"

$baseUrl = "http://127.0.0.1:8080/api/v1"
$runID = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$workDir = "D:\MIT\newdev\backend"
$logOutPath = Join-Path $env:TEMP ("kxyz-m1-server-" + $runID + ".out.log")
$logErrPath = Join-Path $env:TEMP ("kxyz-m1-server-" + $runID + ".err.log")
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

    $username = "m1_user_$runID"
    $password = "Passw0rd!123"
    [void](Invoke-Api -Method Post -Path "/auth/register" -Body @{ username = $username; password = $password })
    $login = Invoke-Api -Method Post -Path "/auth/login" -Body @{ username = $username; password = $password }
    $token = [string]$login.token
    if ([string]::IsNullOrWhiteSpace($token)) {
        throw "login token missing"
    }

    [void](Invoke-Api -Method Put -Path "/users/me/alert-setting" -Token $token -Body @{
            email          = "m1-$runID@example.com"
            global_enabled = $true
            rules          = @{
                leftover = @{
                    enabled = $true
                    max     = 20
                }
                speed = @{
                    enabled = $true
                    max     = 10
                }
            }
        })

    [void](Invoke-Api -Method Put -Path "/users/me/alert-setting" -Token $token -Body @{
            email          = "m1-$runID@example.com"
            global_enabled = $true
            rules          = @{
                leftover = @{
                    enabled = $true
                    max     = 35
                }
                speed = @{
                    enabled = $true
                    max     = 10
                }
            }
        })

    $setting = Invoke-Api -Method Get -Path "/users/me/alert-setting" -Token $token
    $savedMax = [int]$setting.rules.leftover.max
    if ($savedMax -ne 35) {
        throw "acceptance failed: expected leftover.max=35, got $savedMax"
    }

    [PSCustomObject]@{
        ping            = $ping.message
        username        = $username
        leftover_max    = $savedMax
        server_out_log  = $logOutPath
        server_err_log  = $logErrPath
        acceptance_case = "M1 rules_json get/put"
    } | ConvertTo-Json -Depth 5
}
finally {
    if ($null -ne $server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}

