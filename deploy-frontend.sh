#!/bin/bash
# ============================================================================
# Financial Advisor — Deploy Frontend to AWS Amplify
# Usage: ./deploy-frontend.sh
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGION="eu-north-1"
APP_NAME="finance-advisor-ui"

export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

echo "============================================"
echo "  Frontend Deployment to AWS Amplify"
echo "============================================"
echo ""

cd "$PROJECT_DIR"
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate
else
    source .venv/bin/activate
fi

# Read values from .env.local
AGENTCORE_ENDPOINT=$(grep "^NEXT_PUBLIC_AGENTCORE_ENDPOINT=" "$PROJECT_DIR/frontend/.env.local" | cut -d= -f2-)
COGNITO_USER_POOL_ID=$(grep "^NEXT_PUBLIC_COGNITO_USER_POOL_ID=" "$PROJECT_DIR/frontend/.env.local" | cut -d= -f2)
COGNITO_CLIENT_ID=$(grep "^NEXT_PUBLIC_COGNITO_CLIENT_ID=" "$PROJECT_DIR/frontend/.env.local" | cut -d= -f2)

echo "Endpoint    : ${AGENTCORE_ENDPOINT:0:80}..."
echo "Cognito Pool: $COGNITO_USER_POOL_ID"
echo "Client ID   : $COGNITO_CLIENT_ID"
echo ""

# ----------------------------------------------------------------------------
# Step 1: Build frontend
# ----------------------------------------------------------------------------
echo "--- Step 1: Building frontend ---"
cd "$PROJECT_DIR/frontend"
npm ci --silent 2>/dev/null || npm install --silent
npm run build
echo "Frontend built and exported to out/"
echo ""

# ----------------------------------------------------------------------------
# Step 2: Deploy to Amplify via Python script (avoid shell quoting issues)
# ----------------------------------------------------------------------------
echo "--- Step 2: Deploying to Amplify ---"
cd "$PROJECT_DIR"

cat > "$PROJECT_DIR/_deploy_frontend.py" << 'PYEOF'
import boto3, zipfile, os, requests, sys, time, tempfile

region   = os.environ["DEPLOY_REGION"]
app_name = os.environ["DEPLOY_APP_NAME"]
endpoint = os.environ["DEPLOY_ENDPOINT"]
pool_id  = os.environ["DEPLOY_POOL_ID"]
client_id= os.environ["DEPLOY_CLIENT_ID"]

client = boto3.client("amplify", region_name=region)

# Find or create Amplify app
apps   = client.list_apps().get("apps", [])
app_id = next((a["appId"] for a in apps if a["name"] == app_name), None)

env_vars = {
    "NEXT_PUBLIC_AGENTCORE_ENDPOINT":   endpoint,
    "NEXT_PUBLIC_COGNITO_USER_POOL_ID": pool_id,
    "NEXT_PUBLIC_COGNITO_CLIENT_ID":    client_id,
    "NEXT_PUBLIC_COGNITO_REGION":       region,
}

if not app_id:
    resp   = client.create_app(
        name=app_name, platform="WEB",
        environmentVariables=env_vars,
        customRules=[{"source": "/<*>", "target": "/index.html", "status": "404-200"}],
    )
    app_id = resp["app"]["appId"]
    client.create_branch(appId=app_id, branchName="main")
    print(f"Amplify app created: {app_id}")
else:
    # Update env vars on existing app
    client.update_app(appId=app_id, environmentVariables=env_vars)
    print(f"Using existing Amplify app: {app_id}")

# Cancel any stuck/pending jobs before creating a new deployment
jobs = client.list_jobs(appId=app_id, branchName="main").get("jobSummaries", [])
for job in jobs:
    if job["status"] in ("PENDING", "RUNNING"):
        client.stop_job(appId=app_id, branchName="main", jobId=job["jobId"])
        print(f"Cancelled stuck job: {job['jobId']}")

# Create deployment
deploy    = client.create_deployment(appId=app_id, branchName="main")
upload_url= deploy["zipUploadUrl"]
job_id    = deploy["jobId"]

# Zip the out/ directory
zip_path = os.path.join(tempfile.gettempdir(), "amplify-frontend.zip")
out_dir  = "frontend/out"
with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
    for root, dirs, files in os.walk(out_dir):
        for file in files:
            file_path = os.path.join(root, file)
            arcname   = os.path.relpath(file_path, out_dir)
            zf.write(file_path, arcname)
print(f"Zip created: {os.path.getsize(zip_path) / 1024:.1f} KB")

# Upload
resp = requests.put(upload_url, data=open(zip_path, "rb"))
if resp.status_code != 200:
    print(f"Upload failed: {resp.status_code}")
    sys.exit(1)
print("Artifacts uploaded")

# Start and wait
client.start_deployment(appId=app_id, branchName="main", jobId=job_id)
print(f"Deployment started (Job: {job_id})")

status = "PENDING"
while status in ("PENDING", "RUNNING"):
    time.sleep(10)
    job    = client.get_job(appId=app_id, branchName="main", jobId=job_id)
    status = job["job"]["summary"]["status"]
    print(f"  Status: {status}")

if status == "SUCCEED":
    print(f"")
    print(f"Deployment Successful!")
    print(f"URL: https://main.{app_id}.amplifyapp.com")
else:
    print(f"Deployment failed: {status}")
    sys.exit(1)
PYEOF

DEPLOY_REGION="$REGION" \
DEPLOY_APP_NAME="$APP_NAME" \
DEPLOY_ENDPOINT="$AGENTCORE_ENDPOINT" \
DEPLOY_POOL_ID="$COGNITO_USER_POOL_ID" \
DEPLOY_CLIENT_ID="$COGNITO_CLIENT_ID" \
    python "$PROJECT_DIR/_deploy_frontend.py"

rm -f "$PROJECT_DIR/_deploy_frontend.py"

echo ""
echo "============================================"
echo "  Frontend Deployment Complete!"
echo "============================================"
echo ""
