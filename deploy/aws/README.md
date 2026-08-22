# AWS deployment helpers

These scripts are for this project layout:

- `frontend`: Vite React app
- `backend/gateway`: public API gateway
- `backend/services/auth`: auth service
- `backend/services/chat`: chat service
- `backend/services/agent`: agent service
- `backend/services/Billing`: billing service

## Prerequisites

Run these from a normal PowerShell window as your Windows user, not from the Codex sandbox:

```powershell
aws configure
aws sts get-caller-identity
docker info
```

If your AWS account uses IAM Identity Center, use:

```powershell
aws configure sso
aws sso login
```

## Create ECR repositories

```powershell
cd "C:\Users\AASIF\OneDrive\Desktop\my ai"
.\deploy\aws\create-ecr-repos.ps1 -Region ap-south-1
```

## Build and push backend images

Replace `YOUR_ACCOUNT_ID` with the account id from `aws sts get-caller-identity`.

```powershell
.\deploy\aws\build-and-push-backend.ps1 -AccountId YOUR_ACCOUNT_ID -Region ap-south-1
```

## Deploy frontend to S3

Run this after the ECS gateway has a load balancer URL.

```powershell
$env:VITE_FIREBASE_API_KEY="your firebase browser api key"
$env:VITE_RAZORPAY_KEY_ID="your razorpay public key"

.\deploy\aws\deploy-frontend-s3.ps1 `
  -BucketName your-unique-frontend-bucket-name `
  -GatewayUrl http://your-gateway-load-balancer-dns `
  -Region ap-south-1
```

## ECS notes

Expose only the `gateway` service publicly with an Application Load Balancer.
Keep `auth`, `chat`, `agent`, and `billing` private in ECS.

Use ECS Service Connect or AWS Cloud Map so the gateway can call:

```env
AUTH_SERVICE=http://auth:3005
CHAT_SERVICE=http://chat:3010
AGENT_SERVICE=http://agent:5000
BILLING_SERVICE=http://billing:3020
```

Put secrets in ECS task environment variables or AWS Secrets Manager, not in frontend files.
