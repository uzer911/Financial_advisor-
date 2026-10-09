#!/bin/bash
# ============================================================================
# Financial Advisor — Deploy to AgentCore
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGION="eu-north-1"

# Force UTF-8 so rich/emoji output doesn't crash on Windows terminals
export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

echo "============================================"
echo "  Financial Advisor — Deploy to AgentCore"
echo "============================================"
echo ""

cd "$PROJECT_DIR"
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
else
    source .venv/bin/activate
fi

# Get AWS account
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text)
echo "AWS Account: $AWS_ACCOUNT"
echo "Region: $REGION"
echo ""

# Look up the Cognito pool and client ID dynamically
POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region "$REGION" \
    --query "UserPools[?Name=='agentpool'].Id" --output text)
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" \
    --region "$REGION" --query "UserPoolClients[0].ClientId" --output text)

if [ -z "$POOL_ID" ] || [ "$POOL_ID" = "None" ]; then
    echo "ERROR: Cognito user pool 'agentpool' not found. Run ./setup.sh first."
    exit 1
fi

echo "Cognito Pool  : $POOL_ID"
echo "Cognito Client: $CLIENT_ID"
echo ""

# ----------------------------------------------------------------------------
# Step 1: Deploy via AgentCore Starter Toolkit
# Write the deploy logic to a temp .py file to avoid inline -c quoting issues
# and Windows path/encoding problems with tee /tmp/
# ----------------------------------------------------------------------------
echo "--- Step 1: Deploying agent to AgentCore ---"

cat > "$PROJECT_DIR/_deploy_agent.py" << 'PYEOF'
import boto3
import time
import os
import json

region  = os.environ["DEPLOY_REGION"]
account = os.environ["DEPLOY_ACCOUNT"]
pool_id   = os.environ["DEPLOY_POOL_ID"]
client_id = os.environ["DEPLOY_CLIENT_ID"]

ecr_image     = f"{account}.dkr.ecr.{region}.amazonaws.com/bedrock-agentcore-personal_finance_agent:latest"
role_arn      = f"arn:aws:iam::{account}:role/AmazonBedrockAgentCoreSDKRuntime-{region}"
discovery_url = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/openid-configuration"

authorizer = {
    "customJWTAuthorizer": {
        "allowedClients": [client_id],
        "discoveryUrl": discovery_url,
    }
}

client = boto3.client("bedrock-agentcore-control", region_name=region)

# Check if runtime already exists
existing_arn = None
runtimes = client.list_agent_runtimes().get("agentRuntimes", [])
for r in runtimes:
    if r["agentRuntimeName"] == "personal_finance_agent":
        existing_arn = r["agentRuntimeArn"]
        existing_id  = r["agentRuntimeId"]
        print(f"Updating existing runtime: {existing_id}")
        break

if existing_arn:
    resp = client.update_agent_runtime(
        agentRuntimeId=existing_id,
        agentRuntimeArtifact={
            "containerConfiguration": {
                "containerUri": ecr_image
            }
        },
        roleArn=role_arn,
        networkConfiguration={"networkMode": "PUBLIC"},
        authorizerConfiguration=authorizer,
    )
    agent_arn = existing_arn
    agent_id  = existing_id
else:
    print("Creating new AgentCore runtime...")
    resp = client.create_agent_runtime(
        agentRuntimeName="personal_finance_agent",
        agentRuntimeArtifact={
            "containerConfiguration": {
                "containerUri": ecr_image
            }
        },
        roleArn=role_arn,
        networkConfiguration={"networkMode": "PUBLIC"},
        authorizerConfiguration=authorizer,
    )
    agent_arn = resp["agentRuntimeArn"]
    agent_id  = resp["agentRuntimeId"]

print(f"Waiting for runtime to become READY...")
for i in range(40):
    status = client.get_agent_runtime(agentRuntimeId=agent_id)["status"]
    print(f"  Status: {status}")
    if status == "READY":
        break
    if status in ("FAILED", "DELETING"):
        print(f"ERROR: Runtime entered status {status}")
        exit(1)
    time.sleep(15)

print(f"Agent ARN: {agent_arn}")
print(f"Agent ID: {agent_id}")
PYEOF

# Run the deploy script and capture output
DEPLOY_OUTPUT="$PROJECT_DIR/_deploy_output.txt"
DEPLOY_REGION="$REGION" DEPLOY_ACCOUNT="$AWS_ACCOUNT" \
DEPLOY_POOL_ID="$POOL_ID" DEPLOY_CLIENT_ID="$CLIENT_ID" \
    python "$PROJECT_DIR/_deploy_agent.py" 2>&1 | tee "$DEPLOY_OUTPUT"

# Clean up temp script
rm -f "$PROJECT_DIR/_deploy_agent.py"

# Extract the runtime ARN from output
AGENT_ARN=$(grep "Agent ARN:" "$DEPLOY_OUTPUT" | awk '{print $NF}' || echo "")
AGENT_ID=$(grep "Agent ID:"  "$DEPLOY_OUTPUT" | awk '{print $NF}' || echo "")

# Clean up output file
rm -f "$DEPLOY_OUTPUT"

if [ -z "$AGENT_ARN" ]; then
    echo ""
    echo "ERROR: Could not extract agent ARN from deployment output."
    echo "Check the output above for errors."
    echo ""
    echo "Expected NEXT_PUBLIC_AGENTCORE_ENDPOINT format:"
    echo "https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/{URL_ENCODED_ARN}/invocations"
    exit 1
fi

echo ""
echo "Agent deployed successfully"
echo "  ARN: $AGENT_ARN"
echo "  ID:  $AGENT_ID"

# ----------------------------------------------------------------------------
# Step 2: Update frontend .env.local with the new runtime endpoint
# ----------------------------------------------------------------------------
echo ""
echo "--- Step 2: Updating frontend configuration ---"

# URL-encode the ARN using Python
ENCODED_ARN=$(python -c "import urllib.parse, sys; print(urllib.parse.quote(sys.argv[1], safe=''))" "$AGENT_ARN")

# Read existing Cognito values so we don't overwrite them
POOL_ID=$(aws cognito-idp list-user-pools --max-results 20 --region "$REGION" \
    --query "UserPools[?Name=='agentpool'].Id" --output text)
CLIENT_ID=$(aws cognito-idp list-user-pool-clients --user-pool-id "$POOL_ID" \
    --region "$REGION" --query "UserPoolClients[0].ClientId" --output text)

cat > "$PROJECT_DIR/frontend/.env.local" << EOF
# AgentCore Runtime Endpoint
NEXT_PUBLIC_AGENTCORE_ENDPOINT=https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/$ENCODED_ARN/invocations

# Cognito configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID
NEXT_PUBLIC_COGNITO_REGION=$REGION
EOF

echo "frontend/.env.local updated"

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
echo ""
echo "============================================"
echo "  Deployment Complete!"
echo "============================================"
echo ""
echo "Agent Runtime : $AGENT_ID"
echo "Endpoint      : https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/$ENCODED_ARN/invocations"
echo ""
echo "Next step: deploy the frontend"
echo "  ./deploy-frontend.sh"
echo ""
