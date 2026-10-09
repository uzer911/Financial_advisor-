#!/bin/bash
# ============================================================================
# Financial Advisor — Cleanup All AWS Resources
# Usage: ./cleanup.sh
# ============================================================================

# No set -e here — we want cleanup to continue even if individual steps fail
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
REGION="eu-north-1"

export PYTHONIOENCODING=utf-8
export PYTHONUTF8=1

echo "============================================"
echo "  Financial Advisor — Resource Cleanup"
echo "============================================"
echo ""
echo "This will DELETE all AWS resources for this project."
echo "Region: $REGION"
echo ""
read -p "Are you sure? (yes/no): " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Cancelled."
    exit 0
fi

cd "$PROJECT_DIR"
if [ -f ".venv/bin/activate" ]; then
    source .venv/bin/activate 2>/dev/null || true
else
    source .venv/bin/activate 2>/dev/null || true
fi

echo ""

# Step 1: AgentCore Runtime
echo "--- Step 1: AgentCore Runtime ---"
python -c "
import boto3
client = boto3.client('bedrock-agentcore-control', region_name='$REGION')
try:
    for rt in client.list_agent_runtimes().get('agentRuntimes', []):
        if 'personal_finance_agent' in rt['agentRuntimeName']:
            client.delete_agent_runtime(agentRuntimeId=rt['agentRuntimeId'])
            print('Deleted runtime:', rt['agentRuntimeId'])
except Exception as e:
    print('Runtime cleanup skipped:', e)
" 2>/dev/null || true
echo ""

# Step 2: Bedrock Guardrail
echo "--- Step 2: Bedrock Guardrail ---"
python -c "
from utils.guardrail import delete_guardrail
delete_guardrail()
" 2>/dev/null || true
echo ""

# Step 3: Cognito User Pool
echo "--- Step 3: Cognito User Pool ---"
python -c "
import boto3
client = boto3.client('cognito-idp', region_name='$REGION')
for pool in client.list_user_pools(MaxResults=20).get('UserPools', []):
    if pool['Name'] == 'agentpool':
        client.delete_user_pool(UserPoolId=pool['Id'])
        print('Deleted Cognito pool:', pool['Id'])
" 2>/dev/null || true
echo ""

# Step 4: IAM Roles
echo "--- Step 4: IAM Roles ---"
ROLE_NAME="AmazonBedrockAgentCoreSDKRuntime-$REGION"
for POLICY in \
    "arn:aws:iam::aws:policy/AmazonBedrockFullAccess" \
    "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess" \
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly"; do
    aws iam detach-role-policy --role-name "$ROLE_NAME" --policy-arn "$POLICY" 2>/dev/null || true
done
aws iam delete-role --role-name "$ROLE_NAME" 2>/dev/null && \
    echo "Deleted role: $ROLE_NAME" || true

# CodeBuild role
CODEBUILD_ROLE=$(aws iam list-roles --query "Roles[?contains(RoleName,'AgentCoreSDKCodeBuild')].RoleName" --output text 2>/dev/null || echo "")
if [ -n "$CODEBUILD_ROLE" ] && [ "$CODEBUILD_ROLE" != "None" ]; then
    for POLICY in $(aws iam list-attached-role-policies --role-name "$CODEBUILD_ROLE" --query 'AttachedPolicies[].PolicyArn' --output text 2>/dev/null); do
        aws iam detach-role-policy --role-name "$CODEBUILD_ROLE" --policy-arn "$POLICY" 2>/dev/null || true
    done
    aws iam delete-role --role-name "$CODEBUILD_ROLE" 2>/dev/null && \
        echo "Deleted CodeBuild role: $CODEBUILD_ROLE" || true
fi
echo ""

# Step 5: S3 Buckets
echo "--- Step 5: S3 Buckets ---"
for BUCKET in $(aws s3 ls 2>/dev/null | awk '{print $3}' | grep "bedrock-agentcore"); do
    aws s3 rb "s3://$BUCKET" --force --region "$REGION" 2>/dev/null && \
        echo "Deleted bucket: $BUCKET" || true
done
echo ""

# Step 6: ECR Repository
echo "--- Step 6: ECR Repository ---"
for REPO in $(aws ecr describe-repositories --region "$REGION" \
    --query 'repositories[?contains(repositoryName,`bedrock-agentcore`)].repositoryName' \
    --output text 2>/dev/null); do
    aws ecr delete-repository --repository-name "$REPO" --force --region "$REGION" 2>/dev/null && \
        echo "Deleted ECR repo: $REPO" || true
done
echo ""

# Step 7: CodeBuild Project
echo "--- Step 7: CodeBuild ---"
for PROJECT in $(aws codebuild list-projects --region "$REGION" --query 'projects' \
    --output text 2>/dev/null | tr '\t' '\n' | grep "bedrock-agentcore"); do
    aws codebuild delete-project --name "$PROJECT" --region "$REGION" 2>/dev/null && \
        echo "Deleted CodeBuild project: $PROJECT" || true
done
echo ""

# Step 8: Amplify App
echo "--- Step 8: Amplify App ---"
for APP_ID in $(aws amplify list-apps --region "$REGION" \
    --query "apps[?contains(name,'finance-advisor')].appId" --output text 2>/dev/null); do
    aws amplify delete-app --app-id "$APP_ID" --region "$REGION" 2>/dev/null && \
        echo "Deleted Amplify app: $APP_ID" || true
done
echo ""

# Step 9: Secrets Manager
echo "--- Step 9: Secrets Manager ---"
python -c "
import boto3
client = boto3.client('secretsmanager', region_name='$REGION')
try:
    secrets = client.list_secrets(Filters=[{'Key':'name','Values':['agentcore-project-credentials']}])
    for s in secrets.get('SecretList', []):
        if not s.get('DeletedDate'):
            client.delete_secret(SecretId=s['Name'], ForceDeleteWithoutRecovery=True)
            print('Deleted secret:', s['Name'])
except Exception as e:
    print('Secrets cleanup skipped:', e)
" 2>/dev/null || true
echo ""

# Step 10: Clear local .bedrock_agentcore.yaml agent IDs
echo "--- Step 10: Resetting local config ---"
python -c "
import yaml, os
path = '.bedrock_agentcore.yaml'
if os.path.exists(path):
    with open(path) as f:
        config = yaml.safe_load(f)
    for agent in config.get('agents', {}).values():
        agent.get('bedrock_agentcore', {}).update({'agent_id': None, 'agent_arn': None})
        agent.get('codebuild', {}).update({'project_name': None, 'execution_role': None, 'source_bucket': None})
        agent['aws']['ecr_repository'] = None
        agent['aws']['ecr_auto_create'] = True
    with open(path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    print('Reset .bedrock_agentcore.yaml')
" 2>/dev/null || true
echo ""

echo "============================================"
echo "  Cleanup Complete!"
echo "============================================"
echo ""
echo "Run ./setup.sh to start fresh."
echo ""
