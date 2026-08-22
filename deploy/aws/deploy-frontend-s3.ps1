param(
  [Parameter(Mandatory = $true)]
  [string]$BucketName,

  [Parameter(Mandatory = $true)]
  [string]$GatewayUrl,

  [string]$Region = "ap-south-1"
)

$ErrorActionPreference = "Continue"
$env:AWS_PAGER = ""
if (Test-Path variable:PSNativeCommandUseErrorActionPreference) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$frontendRoot = Join-Path $repoRoot "frontend"
$envFile = Join-Path $frontendRoot ".env.production"
$localEnvFile = Join-Path $frontendRoot ".env"

function Read-EnvFile($path) {
  $envs = [ordered]@{}
  if (!(Test-Path $path)) {
    return $envs
  }

  foreach ($line in Get-Content $path) {
    if ($line -match '^\s*#' -or $line -notmatch '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$') {
      continue
    }

    $key = $matches[1]
    $value = $matches[2].Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    $envs[$key] = $value
  }

  return $envs
}

Push-Location $frontendRoot
try {
$frontendEnv = Read-EnvFile $localEnvFile
$frontendEnv["VITE_SERVER_URL"] = $GatewayUrl

if ($env:VITE_FIREBASE_API_KEY) {
  $frontendEnv["VITE_FIREBASE_API_KEY"] = $env:VITE_FIREBASE_API_KEY
}

if ($env:VITE_RAZORPAY_KEY_ID) {
  $frontendEnv["VITE_RAZORPAY_KEY_ID"] = $env:VITE_RAZORPAY_KEY_ID
}

  @"
VITE_SERVER_URL="$($frontendEnv["VITE_SERVER_URL"])"
VITE_FIREBASE_API_KEY="$($frontendEnv["VITE_FIREBASE_API_KEY"])"
VITE_RAZORPAY_KEY_ID="$($frontendEnv["VITE_RAZORPAY_KEY_ID"])"
"@ | Set-Content -Encoding UTF8 $envFile

  npm run build

  $bucketExists = aws s3api head-bucket --bucket $BucketName 2>$null
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Creating S3 bucket: $BucketName"
    if ($Region -eq "us-east-1") {
      aws s3api create-bucket --bucket $BucketName --region $Region
    }
    else {
      aws s3api create-bucket `
        --bucket $BucketName `
        --region $Region `
        --create-bucket-configuration LocationConstraint=$Region
    }
  }

  aws s3 website s3://$BucketName/ --index-document index.html --error-document index.html
  aws s3api put-public-access-block `
    --bucket $BucketName `
    --public-access-block-configuration BlockPublicAcls=false,IgnorePublicAcls=false,BlockPublicPolicy=false,RestrictPublicBuckets=false

  $policyPath = Join-Path $env:TEMP "$BucketName-public-read-policy.json"
@"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::$BucketName/*"
    }
  ]
}
"@ | Set-Content -Encoding UTF8 $policyPath

  aws s3api put-bucket-policy --bucket $BucketName --policy "file://$policyPath"
  aws s3 sync .\dist s3://$BucketName/
  Remove-Item -LiteralPath $policyPath -Force -ErrorAction SilentlyContinue

  Write-Host "Frontend uploaded."
  Write-Host "S3 website endpoint: http://$BucketName.s3-website.$Region.amazonaws.com"
}
finally {
  Pop-Location
}
