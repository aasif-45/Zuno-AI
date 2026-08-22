param(
  [Parameter(Mandatory = $true)]
  [string]$AccountId,

  [string]$Region = "ap-south-1",

  [string]$Tag = "latest"
)

$ErrorActionPreference = "Stop"

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backendRoot = Join-Path $repoRoot "backend"
$registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"

$images = @(
  @{ Name = "ai-gateway"; Dockerfile = "gateway/Dockerfile" },
  @{ Name = "ai-auth"; Dockerfile = "services/auth/Dockerfile" },
  @{ Name = "ai-chat"; Dockerfile = "services/chat/Dockerfile" },
  @{ Name = "ai-agent"; Dockerfile = "services/agent/Dockerfile" },
  @{ Name = "ai-billing"; Dockerfile = "services/Billing/Dockerfile" }
)

Write-Host "Logging Docker into ECR: $registry"
aws ecr get-login-password --region $Region |
  docker login --username AWS --password-stdin $registry

Push-Location $backendRoot
try {
  foreach ($image in $images) {
    $localName = "$($image.Name):$Tag"
    $remoteName = "$registry/$($image.Name):$Tag"

    Write-Host "Building $localName from $($image.Dockerfile)"
    docker build -f $image.Dockerfile -t $localName .

    Write-Host "Tagging $remoteName"
    docker tag $localName $remoteName

    Write-Host "Pushing $remoteName"
    docker push $remoteName
  }
}
finally {
  Pop-Location
}
