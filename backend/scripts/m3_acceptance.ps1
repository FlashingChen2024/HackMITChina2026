$ErrorActionPreference = "Stop"

$rootDir = Split-Path -Parent $PSScriptRoot

$env:HTTP_PORT = "18081"
$env:MYSQL_DSN = "root:963487158835@tcp(127.0.0.1:3306)/kxyz?charset=utf8mb4&parseTime=True&loc=Local"
$env:REDIS_ADDR = "127.0.0.1:6379"
$env:REDIS_PASSWORD = ""
$env:REDIS_DB = "0"

$baseUrl = "http://127.0.0.1:18081/api/v1"
$runID = [DateTimeOffset]::UtcNow.ToUnixTimeSeconds()
$logOutPath = Join-Path $env:TEMP ("kxyz-m3-server-" + $runID + ".out.log")
$logErrPath = Join-Path $env:TEMP ("kxyz-m3-server-" + $runID + ".err.log")

$server = Start-Process -FilePath "go" `
    -ArgumentList @("run", "./cmd/server") `
    -WorkingDirectory $rootDir `
    -PassThru `
    -WindowStyle Hidden `
    -RedirectStandardOutput $logOutPath `
    -RedirectStandardError $logErrPath

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

function New-DemoCase {
    param(
        [Parameter(Mandatory = $true)] [string]$CaseName,
        [Parameter(Mandatory = $true)] [int]$HeightCM,
        [Parameter(Mandatory = $true)] [double]$WeightKG,
        [Parameter(Mandatory = $true)] [string]$Gender,
        [Parameter(Mandatory = $true)] [int]$Age,
        [Parameter(Mandatory = $true)] [string]$Scenario
    )

    $username = ("m3_" + $CaseName + "_" + $runID)
    $password = "Passw0rd!123"

    [void](Invoke-Api -Method Post -Path "/auth/register" -Body @{ username = $username; password = $password })
    $login = Invoke-Api -Method Post -Path "/auth/login" -Body @{ username = $username; password = $password }
    $token = [string]$login.token
    $userID = [string]$login.user_id

    if ([string]::IsNullOrWhiteSpace($token) -or [string]::IsNullOrWhiteSpace($userID)) {
        throw "demo $CaseName auth failed"
    }

    [void](Invoke-Api -Method Put -Path "/users/me/profile" -Token $token -Body @{
        height_cm = $HeightCM
        weight_kg = $WeightKG
        gender    = $Gender
        age       = $Age
    })

    $seedRaw = go run ./scripts/cmd/seed_demo_meal/main.go $env:MYSQL_DSN $userID $Scenario
    if ([string]::IsNullOrWhiteSpace([string]$seedRaw)) {
        throw "demo $CaseName seed failed"
    }
    $seed = $seedRaw | ConvertFrom-Json

    $advice = Invoke-Api -Method Get -Path "/users/me/ai-advice?type=meal_review" -Token $token
    if ([string]::IsNullOrWhiteSpace([string]$advice.advice)) {
        throw "demo $CaseName advice empty"
    }

    return [PSCustomObject]@{
        case_name      = $CaseName
        username       = $username
        user_id        = $userID
        scenario       = $Scenario
        meal_id        = [string]$seed.meal_id
        total_kcal     = [double]$seed.total_kcal
        prompt         = [string]$advice.prompt
        advice         = [string]$advice.advice
        is_alert       = [bool]$advice.is_alert
    }
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

    $demoA = New-DemoCase -CaseName "demo_a" -HeightCM 165 -WeightKG 45 -Gender "female" -Age 18 -Scenario "A"
    $demoB = New-DemoCase -CaseName "demo_b" -HeightCM 170 -WeightKG 90 -Gender "male" -Age 45 -Scenario "B"

    if (-not $demoA.prompt.Contains("AdvancedPrompt") -or -not $demoB.prompt.Contains("AdvancedPrompt")) {
        throw "prompt does not contain AdvancedPrompt for both demos"
    }

    if (-not $demoA.prompt.Contains("165cm") -or -not $demoA.prompt.Contains("45.0kg") -or -not $demoA.prompt.Contains("18")) {
        throw "demo A prompt missing expected profile markers"
    }

    if (-not $demoB.prompt.Contains("170cm") -or -not $demoB.prompt.Contains("90.0kg") -or -not $demoB.prompt.Contains("45")) {
        throw "demo B prompt missing expected profile markers"
    }

    if (-not $demoA.prompt.Contains("300.0kcal")) {
        throw "demo A prompt missing expected meal calories 300.0kcal"
    }

    if (-not $demoB.prompt.Contains("1000.0kcal")) {
        throw "demo B prompt missing expected meal calories 1000.0kcal"
    }

    if ($demoA.advice -eq $demoB.advice) {
        throw "demo A/B advice should be different"
    }

    [PSCustomObject]@{
        ping           = $ping.message
        demo_a         = $demoA
        demo_b         = $demoB
        server_out_log = $logOutPath
        server_err_log = $logErrPath
    } | ConvertTo-Json -Depth 8
}
finally {
    if ($null -ne $server -and -not $server.HasExited) {
        Stop-Process -Id $server.Id -Force
    }
}
