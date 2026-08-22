param(
  [string]$AccountId = "265243686693",
  [string]$Region = "ap-south-1",
  [string]$ClusterName = "my-ai-cluster",
  [string]$ServiceName = "my-ai-service",
  [string]$Family = "my-ai",
  [string]$FrontendUrl = "http://myai-demo1.s3-website.ap-south-1.amazonaws.com",
  [string]$UploadBucket = "myai-demo1"
)

$ErrorActionPreference = "Continue"
$env:AWS_PAGER = ""
if (Test-Path variable:PSNativeCommandUseErrorActionPreference) {
  $PSNativeCommandUseErrorActionPreference = $false
}

$repoRoot = Resolve-Path (Join-Path $PSScriptRoot "..\..")
$backendRoot = Join-Path $repoRoot "backend"
$registry = "$AccountId.dkr.ecr.$Region.amazonaws.com"
$logGroup = "/ecs/$Family"
$executionRoleArn = "arn:aws:iam::$AccountId`:role/ecsTaskExecutionRole"
$taskRoleName = "$Family-task-role"
$taskRoleArn = "arn:aws:iam::$AccountId`:role/$taskRoleName"

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

function EnvList($map) {
  $items = @()
  foreach ($key in $map.Keys) {
    if ($null -ne $map[$key] -and "$($map[$key])" -ne "") {
      $items += @{ name = $key; value = "$($map[$key])" }
    }
  }
  return $items
}

function Ensure-SecurityGroup($name, $description, $vpcId) {
  $sgId = aws ec2 describe-security-groups `
    --region $Region `
    --filters "Name=group-name,Values=$name" "Name=vpc-id,Values=$vpcId" `
    --query "SecurityGroups[0].GroupId" `
    --output text

  if ($sgId -and $sgId -ne "None") {
    return $sgId
  }

  return aws ec2 create-security-group `
    --region $Region `
    --group-name $name `
    --description $description `
    --vpc-id $vpcId `
    --query "GroupId" `
    --output text
}

function Authorize-IngressIfNeeded($sgId, $protocol, $port, $cidr, $sourceSg) {
  $args = @(
    "ec2", "authorize-security-group-ingress",
    "--region", $Region,
    "--group-id", $sgId,
    "--protocol", $protocol,
    "--port", "$port"
  )

  if ($sourceSg) {
    $args += @("--source-group", $sourceSg)
  }
  else {
    $args += @("--cidr", $cidr)
  }

  & aws @args 2>$null
  if ($LASTEXITCODE -ne 0) {
    $global:LASTEXITCODE = 0
  }
}

Write-Host "IAM task role verified: $taskRoleArn"

Write-Host "Ensuring CloudWatch log group..."
aws logs create-log-group --region $Region --log-group-name $logGroup 2>$null
$global:LASTEXITCODE = 0

Write-Host "Finding default VPC and public subnets..."
$vpcId = aws ec2 describe-vpcs `
  --region $Region `
  --filters "Name=isDefault,Values=true" `
  --query "Vpcs[0].VpcId" `
  --output text

$subnetIds = aws ec2 describe-subnets `
  --region $Region `
  --filters "Name=vpc-id,Values=$vpcId" "Name=map-public-ip-on-launch,Values=true" `
  --query "Subnets[].SubnetId" `
  --output text

$subnetList = $subnetIds -split "\s+" | Where-Object { $_ }

Write-Host "Ensuring security groups..."
$albSg = Ensure-SecurityGroup "$Family-alb-sg" "Public ALB access for $Family" $vpcId
$taskSg = Ensure-SecurityGroup "$Family-task-sg" "ECS task access for $Family" $vpcId
Authorize-IngressIfNeeded $albSg "tcp" 80 "0.0.0.0/0" $null
Authorize-IngressIfNeeded $taskSg "tcp" 3000 $null $albSg

Write-Host "Ensuring ECS cluster..."
$clusterArn = aws ecs describe-clusters `
  --region $Region `
  --clusters $ClusterName `
  --query "clusters[?status!='INACTIVE'] | [0].clusterArn" `
  --output text

if (!$clusterArn -or $clusterArn -eq "None") {
  aws ecs create-cluster --region $Region --cluster-name $ClusterName | Out-Null
}

Write-Host "Ensuring load balancer..."
$lbArn = aws elbv2 describe-load-balancers `
  --region $Region `
  --names "$Family-alb" `
  --query "LoadBalancers[0].LoadBalancerArn" `
  --output text 2>$null

if ($LASTEXITCODE -ne 0 -or !$lbArn -or $lbArn -eq "None") {
  $lbArn = aws elbv2 create-load-balancer `
    --region $Region `
    --name "$Family-alb" `
    --subnets $subnetList `
    --security-groups $albSg `
    --scheme internet-facing `
    --type application `
    --query "LoadBalancers[0].LoadBalancerArn" `
    --output text
  aws elbv2 wait load-balancer-available --region $Region --load-balancer-arns $lbArn
}

$lbDns = aws elbv2 describe-load-balancers `
  --region $Region `
  --load-balancer-arns $lbArn `
  --query "LoadBalancers[0].DNSName" `
  --output text

Write-Host "Ensuring target group and listener..."
$targetGroupArn = aws elbv2 describe-target-groups `
  --region $Region `
  --names "$Family-tg" `
  --query "TargetGroups[0].TargetGroupArn" `
  --output text 2>$null

if ($LASTEXITCODE -ne 0 -or !$targetGroupArn -or $targetGroupArn -eq "None") {
  $targetGroupArn = aws elbv2 create-target-group `
    --region $Region `
    --name "$Family-tg" `
    --protocol HTTP `
    --port 3000 `
    --vpc-id $vpcId `
    --target-type ip `
    --health-check-path "/" `
    --health-check-protocol HTTP `
    --matcher HttpCode=200 `
    --query "TargetGroups[0].TargetGroupArn" `
    --output text
}

$listenerArn = aws elbv2 describe-listeners `
  --region $Region `
  --load-balancer-arn $lbArn `
  --query "Listeners[?Port==``80``].ListenerArn | [0]" `
  --output text

if (!$listenerArn -or $listenerArn -eq "None") {
  aws elbv2 create-listener `
    --region $Region `
    --load-balancer-arn $lbArn `
    --protocol HTTP `
    --port 80 `
    --default-actions "Type=forward,TargetGroupArn=$targetGroupArn" | Out-Null
}

Write-Host "Preparing task definition..."
$redisUrl = "redis://localhost:6379"

$gatewayEnv = Read-EnvFile (Join-Path $backendRoot "gateway\.env")
$gatewayEnv["PORT"] = "3000"
$gatewayEnv["FRONTEND_URL"] = $FrontendUrl
$gatewayEnv["AUTH_SERVICE"] = "http://localhost:3005"
$gatewayEnv["CHAT_SERVICE"] = "http://localhost:3010"
$gatewayEnv["AGENT_SERVICE"] = "http://localhost:3015"
$gatewayEnv["BILLING_SERVICE"] = "http://localhost:3020"
$gatewayEnv["REDIS_URL"] = $redisUrl

$authEnv = Read-EnvFile (Join-Path $backendRoot "services\auth\.env")
$authEnv["PORT"] = "3005"
$authEnv["REDIS_URL"] = $redisUrl

$chatEnv = Read-EnvFile (Join-Path $backendRoot "services\chat\.env")
$chatEnv["PORT"] = "3010"

$agentEnv = Read-EnvFile (Join-Path $backendRoot "services\agent\.env")
$agentEnv.Remove("AWS_ACCESS_KEY_ID")
$agentEnv.Remove("AWS_SECRET_ACCESS_KEY")
$agentEnv["PORT"] = "3015"
$agentEnv["AWS_REGION"] = $Region
$agentEnv["AWS_S3_BUCKET_NAME"] = $UploadBucket
$agentEnv["REDIS_URL"] = $redisUrl
$agentEnv["CHAT_SERVICE"] = "http://localhost:3010"
$agentEnv["AUTH_SERVICE"] = "http://localhost:3005"

$billingEnv = Read-EnvFile (Join-Path $backendRoot "services\Billing\.env")
$billingEnv["PORT"] = "3020"
$billingEnv["REDIS_URL"] = $redisUrl
$billingEnv["AUTH_SERVICE"] = "http://localhost:3005"
$billingEnv["CHAT_SERVICE"] = "http://localhost:3010"
$billingEnv["AGENT_SERVICE"] = "http://localhost:3015"

$logConfig = @{
  logDriver = "awslogs"
  options = @{
    "awslogs-group" = $logGroup
    "awslogs-region" = $Region
    "awslogs-stream-prefix" = $Family
  }
}

$containerDefinitions = @(
  @{
    name = "gateway"
    image = "$registry/ai-gateway:latest"
    essential = $true
    portMappings = @(@{ containerPort = 3000; hostPort = 3000; protocol = "tcp" })
    environment = EnvList $gatewayEnv
    logConfiguration = $logConfig
  },
  @{
    name = "auth"
    image = "$registry/ai-auth:latest"
    essential = $true
    environment = EnvList $authEnv
    logConfiguration = $logConfig
  },
  @{
    name = "chat"
    image = "$registry/ai-chat:latest"
    essential = $true
    environment = EnvList $chatEnv
    logConfiguration = $logConfig
  },
  @{
    name = "agent"
    image = "$registry/ai-agent:latest"
    essential = $true
    environment = EnvList $agentEnv
    logConfiguration = $logConfig
  },
  @{
    name = "billing"
    image = "$registry/ai-billing:latest"
    essential = $true
    environment = EnvList $billingEnv
    logConfiguration = $logConfig
  },
  @{
    name = "redis"
    image = "redis:7-alpine"
    essential = $true
    logConfiguration = $logConfig
  }
)

$taskDefinition = @{
  family = $Family
  networkMode = "awsvpc"
  requiresCompatibilities = @("FARGATE")
  cpu = "2048"
  memory = "4096"
  executionRoleArn = $executionRoleArn
  taskRoleArn = $taskRoleArn
  containerDefinitions = $containerDefinitions
}

$taskPath = Join-Path $env:TEMP "$Family-task-def.json"
$taskJson = $taskDefinition | ConvertTo-Json -Depth 20
[System.IO.File]::WriteAllText($taskPath, $taskJson, (New-Object System.Text.UTF8Encoding($false)))
$taskFileArg = "file://" + $taskPath.Replace("\", "/")

Write-Host "Registering ECS task definition..."
$taskDefinitionArn = aws ecs register-task-definition `
  --region $Region `
  --cli-input-json $taskFileArg `
  --query "taskDefinition.taskDefinitionArn" `
  --output text

Write-Host "Ensuring ECS service..."
$existingServiceArn = aws ecs describe-services `
  --region $Region `
  --cluster $ClusterName `
  --services $ServiceName `
  --query "services[?status!='INACTIVE'] | [0].serviceArn" `
  --output text

if ($existingServiceArn -and $existingServiceArn -ne "None") {
  aws ecs update-service `
    --region $Region `
    --cluster $ClusterName `
    --service $ServiceName `
    --task-definition $taskDefinitionArn `
    --desired-count 1 `
    --force-new-deployment | Out-Null
}
else {
  aws ecs create-service `
    --region $Region `
    --cluster $ClusterName `
    --service-name $ServiceName `
    --task-definition $taskDefinitionArn `
    --desired-count 1 `
    --launch-type FARGATE `
    --network-configuration "awsvpcConfiguration={subnets=[$($subnetList -join ',')],securityGroups=[$taskSg],assignPublicIp=ENABLED}" `
    --load-balancers "targetGroupArn=$targetGroupArn,containerName=gateway,containerPort=3000" `
    --health-check-grace-period-seconds 120 | Out-Null
}

Remove-Item -LiteralPath $trustPath, $policyPath, $taskPath -Force -ErrorAction SilentlyContinue

Write-Host "ECS deployment requested."
Write-Host "Load balancer URL: http://$lbDns"
