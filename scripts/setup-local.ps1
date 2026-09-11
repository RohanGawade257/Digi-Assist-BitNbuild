$ErrorActionPreference = 'Stop'
$workspacePath = Split-Path -Parent $PSScriptRoot
$envPath = Join-Path $workspacePath '.env'
if (-not (Test-Path -LiteralPath $envPath)) {
    $randomBytes = New-Object byte[] 32
    $rng = [System.Security.Cryptography.RandomNumberGenerator]::Create()
    $rng.GetBytes($randomBytes)
    $rng.Dispose()
    $mongoPassword = [Convert]::ToBase64String($randomBytes).Replace('+','a').Replace('/','b').Replace('=','')
    $template = [System.IO.File]::ReadAllText((Join-Path $workspacePath '.env.example'))
    $template = $template.Replace('MONGO_ROOT_PASSWORD=', "MONGO_ROOT_PASSWORD=$mongoPassword")
    $template = $template.Replace('MONGODB_URI=', "MONGODB_URI=mongodb://guide_admin:${mongoPassword}@127.0.0.1:27018/digital_assistant?authSource=admin")
    [System.IO.File]::WriteAllText($envPath, $template)
    Write-Output 'Created .env with a random local database password. Provider slots remain empty.'
} else { Write-Output 'Existing .env preserved.' }
$secretsPath = Join-Path $workspacePath 'secrets'
if (-not (Test-Path -LiteralPath $secretsPath)) { New-Item -ItemType Directory -Path $secretsPath | Out-Null }
$policyPath = Join-Path $workspacePath 'config/quota-policy.json'
if (-not (Test-Path -LiteralPath $policyPath)) { Copy-Item -LiteralPath (Join-Path $workspacePath 'config/quota-policy.example.json') -Destination $policyPath }
Write-Output 'Local setup ready. Configure Firebase, providers and verified quota limits before live assistance.'
