<#  #>$ErrorActionPreference = "Stop"

$env:HTTP_PORT = "8080"
$env:MYSQL_DSN = "root:963487158835@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
$env:REDIS_ADDR = "127.0.0.1:6379"
$env:REDIS_PASSWORD = ""
$env:REDIS_DB = "0"

$baseUrl = "http://127.0.0.1:8080/api/v1"
$runID = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$logOutPath = Join-Path $env:TEMP ("kxyz-m1-server-" + $runID + ".out.log")
$logErrPath = Join-Path $env:TEMP ("kxyz-m1-server-" + $runID + ".err.log")
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

    $userA = "m1_user_a_$runID"
    $userB = "m1_user_b_$runID"
    $password = "Passw0rd!123"

    [void](Invoke-Api -Method Post -Path "/auth/register" -Body @{ username = $userA; password = $password })
    [void](Invoke-Api -Method Post -Path "/auth/register" -Body @{ username = $userB; password = $password })

    $loginA = Invoke-Api -Method Post -Path "/auth/login" -Body @{ username = $userA; password = $password }
    $loginB = Invoke-Api -Method Post -Path "/auth/login" -Body @{ username = $userB; password = $password }

    $tokenA = [string]$loginA.token
    $tokenB = [string]$loginB.token

    if ([string]::IsNullOrWhiteSpace($tokenA) -or [string]::IsNullOrWhiteSpace($tokenB)) {
        throw "login token missing"
    }

    $cutCommunity = Invoke-Api -Method Post -Path "/communities/create" -Token $tokenA -Body @{ name = "减脂圈"; description = "M1验收-减脂" }
    $bulkCommunity = Invoke-Api -Method Post -Path "/communities/create" -Token $tokenB -Body @{ name = "增肌圈"; description = "M1验收-增肌" }

    $cutCommunityID = [string]$cutCommunity.community_id
    $bulkCommunityID = [string]$bulkCommunity.community_id
    if ([string]::IsNullOrWhiteSpace($cutCommunityID) -or [string]::IsNullOrWhiteSpace($bulkCommunityID)) {
        throw "community_id missing after create"
    }

    [void](Invoke-Api -Method Post -Path ("/communities/" + $cutCommunityID + "/join") -Token $tokenB)

    $listA = Invoke-Api -Method Get -Path "/communities" -Token $tokenA
    $listB = Invoke-Api -Method Get -Path "/communities" -Token $tokenB

    $countA = @($listA.items).Count
    $countB = @($listB.items).Count
    if ($countA -ne 1 -or $countB -ne 2) {
        throw "acceptance failed: expected A=1 B=2, got A=$countA B=$countB"
    }

    [PSCustomObject]@{
        ping         = $ping.message
        user_a       = $userA
        user_b       = $userB
        community_a  = $cutCommunityID
        community_b  = $bulkCommunityID
        list_count_a = $countA
        list_count_b = $countB
        server_out_log = $logOutPath
        server_err_log = $logErrPath
    } | ConvertTo-Json -Depth 5
}
finally {
    if ($null -ne $server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}

