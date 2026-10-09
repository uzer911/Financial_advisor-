"""
Pre-deployment setup:
1. Create IAM execution role for AgentCore Runtime
2. Create Bedrock Guardrail
3. Create Cognito User Pool + update .bedrock_agentcore.yaml with new auth config
4. Create ECR repository
5. Create S3 source bucket for CodeBuild
"""

import boto3
import json
import yaml
import sys
import os
import time

region = "eu-north-1"
account_id = "471613014056"
role_name = f"AmazonBedrockAgentCoreSDKRuntime-{region}"
ecr_repo = "bedrock-agentcore-personal_finance_agent"
s3_bucket = f"bedrock-agentcore-codebuild-sources-{account_id}-{region}"
yaml_path = r"c:\Users\LENOVO\Downloads\StrandsMultiAgent\StrandsMultiAgent\SourceCode\.bedrock_agentcore.yaml"

iam     = boto3.client("iam")
bedrock = boto3.client("bedrock", region_name=region)
ecr     = boto3.client("ecr", region_name=region)
s3      = boto3.client("s3", region_name=region)
cognito = boto3.client("cognito-idp", region_name=region)
secrets = boto3.client("secretsmanager", region_name=region)

import secrets as secrets_lib
import string

def generate_password(length=16):
    alphabet = string.ascii_letters + string.digits + "!@#$%^"
    while True:
        pw = ''.join(secrets_lib.choice(alphabet) for _ in range(length))
        if (any(c.isupper() for c in pw) and any(c.islower() for c in pw)
                and any(c.isdigit() for c in pw) and any(c in "!@#$%^" for c in pw)):
            return pw

# ── 1. IAM EXECUTION ROLE ─────────────────────────────────────────────────────
print("\n" + "="*60)
print("STEP 1: IAM Execution Role")
print("="*60)

trust_policy = {
    "Version": "2012-10-17",
    "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "bedrock-agentcore.amazonaws.com"},
        "Action": "sts:AssumeRole"
    }]
}

try:
    iam.create_role(
        RoleName=role_name,
        AssumeRolePolicyDocument=json.dumps(trust_policy)
    )
    print(f"✅ Created role: {role_name}")
except iam.exceptions.EntityAlreadyExistsException:
    iam.update_assume_role_policy(RoleName=role_name, PolicyDocument=json.dumps(trust_policy))
    print(f"✅ Role already exists, trust policy updated: {role_name}")

for policy_arn in [
    "arn:aws:iam::aws:policy/AmazonBedrockFullAccess",
    "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess",
    "arn:aws:iam::aws:policy/AmazonEC2ContainerRegistryReadOnly",
]:
    try:
        iam.attach_role_policy(RoleName=role_name, PolicyArn=policy_arn)
        print(f"  Attached: {policy_arn.split('/')[-1]}")
    except Exception:
        pass  # already attached

execution_role_arn = f"arn:aws:iam::{account_id}:role/{role_name}"
print(f"  ARN: {execution_role_arn}")
print("  Waiting 10s for IAM propagation...")
time.sleep(10)

# ── 2. BEDROCK GUARDRAIL ──────────────────────────────────────────────────────
print("\n" + "="*60)
print("STEP 2: Bedrock Guardrail")
print("="*60)

guardrail_name = "guardrail-no-bitcoin-advice"
guardrail_id = None

existing = bedrock.list_guardrails().get("guardrails", [])
for g in existing:
    if g["name"] == guardrail_name:
        guardrail_id = g["id"]
        print(f"✅ Guardrail already exists: {guardrail_id}")
        break

if not guardrail_id:
    resp = bedrock.create_guardrail(
        name=guardrail_name,
        description="Blocks crypto/bitcoin investment advice",
        contentPolicyConfig={"filtersConfig": [
            {"type": "SEXUAL",       "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "VIOLENCE",     "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "HATE",         "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "INSULTS",      "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "MISCONDUCT",   "inputStrength": "HIGH", "outputStrength": "HIGH"},
            {"type": "PROMPT_ATTACK","inputStrength": "HIGH", "outputStrength": "NONE"},
        ]},
        wordPolicyConfig={"wordsConfig": [
            {"text": "Bitcoin investment advice"},
            {"text": "cryptocurrency investment"},
            {"text": "Bitcoin"},
            {"text": "crypto investment tips"},
        ], "managedWordListsConfig": [{"type": "PROFANITY"}]},
        blockedInputMessaging="I cannot provide Bitcoin investment advice.",
        blockedOutputsMessaging="I cannot provide Bitcoin investment advice.",
    )
    guardrail_id = resp["guardrailId"]
    print(f"✅ Guardrail created: {guardrail_id}")

# ── 3. ECR REPOSITORY ─────────────────────────────────────────────────────────
print("\n" + "="*60)
print("STEP 3: ECR Repository")
print("="*60)

try:
    resp = ecr.create_repository(
        repositoryName=ecr_repo,
        imageTagMutability="MUTABLE",
    )
    print(f"✅ ECR repo created: {resp['repository']['repositoryUri']}")
except ecr.exceptions.RepositoryAlreadyExistsException:
    resp = ecr.describe_repositories(repositoryNames=[ecr_repo])
    print(f"✅ ECR repo already exists: {resp['repositories'][0]['repositoryUri']}")

# ── 4. S3 SOURCE BUCKET ───────────────────────────────────────────────────────
print("\n" + "="*60)
print("STEP 4: S3 CodeBuild Source Bucket")
print("="*60)

try:
    s3.create_bucket(
        Bucket=s3_bucket,
        CreateBucketConfiguration={"LocationConstraint": region}
    )
    # Enable versioning
    s3.put_bucket_versioning(
        Bucket=s3_bucket,
        VersioningConfiguration={"Status": "Enabled"}
    )
    print(f"✅ S3 bucket created: {s3_bucket}")
except s3.exceptions.BucketAlreadyOwnedByYou:
    print(f"✅ S3 bucket already exists: {s3_bucket}")
except Exception as e:
    print(f"⚠️  S3: {e}")

# ── 5. COGNITO USER POOL ──────────────────────────────────────────────────────
print("\n" + "="*60)
print("STEP 5: Cognito User Pool")
print("="*60)

pool_resp = cognito.create_user_pool(
    PoolName="agentpool",
    Policies={"PasswordPolicy": {
        "MinimumLength": 12, "RequireUppercase": True,
        "RequireLowercase": True, "RequireNumbers": True,
        "RequireSymbols": True, "TemporaryPasswordValidityDays": 1
    }},
    AdminCreateUserConfig={"AllowAdminCreateUserOnly": True},
)
pool_id = pool_resp["UserPool"]["Id"]
print(f"✅ User Pool created: {pool_id}")

client_resp = cognito.create_user_pool_client(
    UserPoolId=pool_id,
    ClientName="MCPServerPoolClient",
    GenerateSecret=False,
    ExplicitAuthFlows=["ALLOW_USER_PASSWORD_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
)
client_id = client_resp["UserPoolClient"]["ClientId"]
print(f"✅ App Client: {client_id}")

username = f"cloudageuser-{secrets_lib.token_hex(4)}"
temp_pw  = generate_password()
perm_pw  = generate_password()

cognito.admin_create_user(UserPoolId=pool_id, Username=username,
                          TemporaryPassword=temp_pw, MessageAction="SUPPRESS")
cognito.admin_set_user_password(UserPoolId=pool_id, Username=username,
                                Password=perm_pw, Permanent=True)
auth_resp = cognito.initiate_auth(
    ClientId=client_id,
    AuthFlow="USER_PASSWORD_AUTH",
    AuthParameters={"USERNAME": username, "PASSWORD": perm_pw}
)
bearer_token = auth_resp["AuthenticationResult"]["AccessToken"]

secret_name = f"agentcore-project-credentials-{secrets_lib.token_hex(4)}"
secrets.create_secret(
    Name=secret_name,
    SecretString=json.dumps({"username": username, "password": perm_pw,
                              "pool_id": pool_id, "client_id": client_id}),
)
print(f"✅ Credentials saved to Secrets Manager: {secret_name}")

discovery_url = f"https://cognito-idp.{region}.amazonaws.com/{pool_id}/.well-known/openid-configuration"

print("\n" + "="*60)
print("⚠️  SAVE THESE CREDENTIALS")
print("="*60)
print(f"Username:      {username}")
print(f"Password:      {perm_pw}")
print(f"Pool ID:       {pool_id}")
print(f"Client ID:     {client_id}")
print(f"Secret Name:   {secret_name}")
print(f"Bearer Token:  {bearer_token[:60]}...")
print("="*60)

# ── 6. UPDATE .bedrock_agentcore.yaml ────────────────────────────────────────
print("\n" + "="*60)
print("STEP 6: Updating .bedrock_agentcore.yaml")
print("="*60)

with open(yaml_path, "r") as f:
    config = yaml.safe_load(f)

agent = config["agents"]["personal_finance_agent"]

# Clear stale IDs from previous run
agent["bedrock_agentcore"]["agent_id"]  = None
agent["bedrock_agentcore"]["agent_arn"] = None
agent["bedrock_agentcore"]["agent_session_id"] = None

# Update auth with new Cognito
agent["authorizer_configuration"]["customJWTAuthorizer"]["allowedClients"] = [client_id]
agent["authorizer_configuration"]["customJWTAuthorizer"]["discoveryUrl"]   = discovery_url

# Ensure account + role are correct
agent["aws"]["account"] = account_id
agent["aws"]["region"]  = region
agent["aws"]["execution_role"] = execution_role_arn
agent["aws"]["ecr_repository"] = f"{account_id}.dkr.ecr.{region}.amazonaws.com/{ecr_repo}"
agent["aws"]["ecr_auto_create"] = False
agent["codebuild"]["source_bucket"] = s3_bucket

with open(yaml_path, "w") as f:
    yaml.dump(config, f, default_flow_style=False, allow_unicode=True)

print(f"✅ .bedrock_agentcore.yaml updated")

# ── SUMMARY ───────────────────────────────────────────────────────────────────
print("\n" + "="*60)
print("✅ ALL PREREQUISITES READY")
print("="*60)
print(f"  IAM Role:      {execution_role_arn}")
print(f"  Guardrail ID:  {guardrail_id}")
print(f"  ECR Repo:      {account_id}.dkr.ecr.{region}.amazonaws.com/{ecr_repo}")
print(f"  S3 Bucket:     {s3_bucket}")
print(f"  Cognito Pool:  {pool_id}")
print(f"  Client ID:     {client_id}")
print()
print("Now run:")
print("  cd SourceCode")
print("  agentcore launch personal_finance_agent")
