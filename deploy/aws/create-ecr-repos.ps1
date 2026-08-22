param(
  [string]$Region = "ap-south-1",
  [string[]]$Repositories = @(
    "ai-gateway",
    "ai-auth",
    "ai-chat",
    "ai-agent",
    "ai-billing"
  )
)

$ErrorActionPreference = "Stop"

foreach ($repo in $Repositories) {
  $exists = aws ecr describe-repositories `
    --region $Region `
    --repository-names $repo `
    --query "repositories[0].repositoryName" `
    --output text 2>$null

  if ($LASTEXITCODE -eq 0 -and $exists -eq $repo) {
    Write-Host "ECR repository already exists: $repo"
    continue
  }

  Write-Host "Creating ECR repository: $repo"
  aws ecr create-repository `
    --region $Region `
    --repository-name $repo `
    --image-scanning-configuration scanOnPush=true `
    --encryption-configuration encryptionType=AES256 `
    --output table
}
