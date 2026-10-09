#!/bin/bash
# ============================================================================
# Financial Advisor — Full Project Setup
# Run this once after a fresh clone or after cleanup.sh
# Usage: ./setup.sh
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGION="eu-north-1"
RUNTIME_NAME="personal_finance_agent"

export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

echo "============================================"
echo "  Financial Advisor — Automated Setup"
echo "============================================"
echo "Project directory: $PROJECT_DIR"
echo "AWS Region: $REGION"
echo ""

# ----------------------------------------------------------------------------
# Step 1: Python virtual environment
# ----------------------------------------------------------------------------
echo "--- Step 1: Python backend ---"
cd "$PROJECT_DIR"

PYTHON_BIN=""
for candidate in python3.12 python3.13 python3.14 \
    "/c/ProgramData/anaconda3/python.exe" \
    "/c/Users/LENOVO/AppData/Local/Python/bin/python3.exe" \
    python3 python; do
    if command -v "$candidate" &>/dev/null; then
        PY_VERSION=$("$candidate" --version 2>&1 | awk '{print $2}' | cut -d. -f1,2)
        if [[ "$PY_VERSION" == 3.12 || "$PY_VERSION" == 3.13 || "$PY_VERSION" == 3.14 ]]; then
            PYTHON_BIN="$candidate"
            break
        fi
    fi
done

if [ -z "$PYTHON_BIN" ]; then
    echo "ERROR: Python 3.12+ not found."
    exit 1
fi
echo "Using Python: $PYTHON_BIN ($($PYTHON_BIN --version))"

if [ ! -d ".venv" ]; then
    $PYTHON_BIN -m venv .venv
fi

if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
else
    source .venv/bin/activate
fi
echo "Virtual environment activated"

pip install --quiet -r requirements.txt
echo "Python dependencies installed"
echo ""

# ----------------------------------------------------------------------------
# Step 2: Verify AWS credentials
# ----------------------------------------------------------------------------
echo "--- Step 2: AWS configuration ---"
AWS_ACCOUNT=$(aws sts get-caller-identity --query Account --output text 2>/dev/null || echo "")
if [ -z "$AWS_ACCOUNT" ]; then
    echo "ERROR: AWS credentials not configured. Run 'aws configure' first."
    exit 1
fi
aws configure set region "$REGION"
echo "AWS Account: $AWS_ACCOUNT  Region: $REGION"
echo ""

# ----------------------------------------------------------------------------
# Step 3: IAM role
# ----------------------------------------------------------------------------
echo "--- Step 3: IAM role ---"
ROLE_NAME="AmazonBedrockAgentCoreSDKRuntime-$REGION"

if aws iam get-role --role-name "$ROLE_NAME" &>/dev/null 2>&1; then
    echo "IAM role '$ROLE_NAME' already exists"
else
    aws iam create-role \
        --role-name "$ROLE_NAME" \
        --assume-role-policy-document '{
            "Version":"2012-10-17",
            "Statement":[{"Effect":"Allow","Principal":{"Service":"bedrock-agentcore.amazonaws.com"},"Action":"sts:AssumeRole"}]
        }' --output text --query 'Role.Arn' > /dev/null
    echo "IAM role created"
fi

for POLICY in \
    "arn:aws:iam::aws:policy/AmazonBedrockFullAccess" \
    "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess" \
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"; do
    aws iam attach-role-policy --role-name "$ROLE_NAME" --policy-arn "$POLICY" 2>/dev/null || true
done
echo "Policies attached"
echo ""

# ----------------------------------------------------------------------------
# Step 4: Bedrock Guardrail
# ----------------------------------------------------------------------------
echo "--- Step 4: Bedrock Guardrail ---"
python -c "
from utils.guardrail import create_guardrail
result = create_guardrail()
print('Guardrail ready:', result[0] if result else 'skipped')
" 2>/dev/null || echo "Guardrail creation skipped"
echo ""

# ----------------------------------------------------------------------------
# Step 5: Cognito user pool — write result to a temp file to avoid stdout mixing
# ----------------------------------------------------------------------------
echo "--- Step 5: Cognito authentication ---"

cat > "$PROJECT_DIR/_setup_cognito.py" << 'PYEOF'
import json, sys, boto3
from utils.agentcore_utils import setup_cognito_user_pool

# Check if pool already exists
cognito = boto3.client("cognito-idp", region_name="eu-north-1")
pools = cognito.list_user_pools(MaxResults=20).get("UserPools", [])
for pool in pools:
    if pool["Name"] == "agentpool":
        clients = cognito.list_user_pool_clients(UserPoolId=pool["Id"]).get("UserPoolClients", [])
        client_id = clients[0]["ClientId"] if clients else ""
        # Write just the JSON to a separate file — no mixed stdout
        with open("_cognito_result.json", "w") as f:
            json.dump({"pool_id": pool["Id"], "client_id": client_id}, f)
        print(f"Existing Cognito pool found: {pool['Id']}")
        sys.exit(0)

result = setup_cognito_user_pool()
if result:
    with open("_cognito_result.json", "w") as f:
        json.dump({"pool_id": result["pool_id"], "client_id": result["client_id"]}, f)
    print(f"Cognito pool created: {result['pool_id']}")
PYEOF

python "$PROJECT_DIR/_setup_cognito.py"
rm -f "$PROJECT_DIR/_setup_cognito.py"

POOL_ID=$(python -c "import json; d=json.load(open('_cognito_result.json')); print(d['pool_id'])")
CLIENT_ID=$(python -c "import json; d=json.load(open('_cognito_result.json')); print(d['client_id'])")
rm -f "$PROJECT_DIR/_cognito_result.json"

echo "Pool ID   : $POOL_ID"
echo "Client ID : $CLIENT_ID"
echo ""

# ----------------------------------------------------------------------------
# Step 6: Frontend dependencies + .env.local
# ----------------------------------------------------------------------------
echo "--- Step 6: Frontend setup ---"
cd "$PROJECT_DIR/frontend"

if [ ! -d "node_modules" ]; then
    npm install --silent
    echo "Frontend dependencies installed"
else
    echo "Frontend dependencies already present"
fi

# Write .env.local with placeholder endpoint (updated after deploy.sh)
cat > .env.local << EOF
# AgentCore Runtime Endpoint — updated automatically by ./deploy.sh
NEXT_PUBLIC_AGENTCORE_ENDPOINT=https://bedrock-agentcore.$REGION.amazonaws.com/runtimes/PLACEHOLDER/invocations

# Cognito configuration
NEXT_PUBLIC_COGNITO_USER_POOL_ID=$POOL_ID
NEXT_PUBLIC_COGNITO_CLIENT_ID=$CLIENT_ID
NEXT_PUBLIC_COGNITO_REGION=$REGION
EOF
echo "frontend/.env.local written"
cd "$PROJECT_DIR"
echo ""

# ----------------------------------------------------------------------------
# Summary
# ----------------------------------------------------------------------------
echo "============================================"
echo "  Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "  1. Run notebooks up to Phase 3.1 (%%writefile main.py cell)"
echo "  2. ./deploy.sh      — deploys agent to AgentCore (~5 min)"
echo "  3. ./deploy-frontend.sh  — deploys frontend to Amplify"
echo ""
echo "Retrieve login credentials:"
echo "  python -c \"from utils import retrieve_credentials_from_secrets_manager; print(retrieve_credentials_from_secrets_manager())\""
echo ""
