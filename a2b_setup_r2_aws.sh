#!/bin/bash
: "${HISTTIMEFORMAT:=}"
set -euo pipefail
[ -f ./a2p_bash_compat.sh ] && source ./a2p_bash_compat.sh
[ -f /tmp/a2p_env.sh ] && source /tmp/a2p_env.sh

AWS_DIR="$HOME/.aws"
CFG="$AWS_DIR/config"
CREDS="$AWS_DIR/credentials"

mkdir -p "$AWS_DIR"
chmod 700 "$AWS_DIR"

cat > "$CFG" <<'CFGEOF'
[default]
region = auto
output = json
CFGEOF

# Prompt for keys (hidden)
echo "Enter Cloudflare R2 Access Key ID:"
read -r AWS_ACCESS_KEY_ID

echo "Enter Cloudflare R2 Secret Access Key (input hidden):"
read -rs AWS_SECRET_ACCESS_KEY
echo

cat > "$CREDS" <<EOF2
[default]
aws_access_key_id = ${AWS_ACCESS_KEY_ID}
aws_secret_access_key = ${AWS_SECRET_ACCESS_KEY}
EOF2

chmod 600 "$CFG" "$CREDS"

echo "Saved: $CFG"
echo "Saved: $CREDS"
echo "Permissions:"
ls -la "$AWS_DIR"

echo
echo "Next: test with your R2 endpoint, e.g.:"
echo '  export R2_ACCOUNT_ID="YOUR_ACCOUNT_ID"'
echo '  export R2_ENDPOINT_URL="https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com"'
echo '  aws s3api list-buckets --endpoint-url "$R2_ENDPOINT_URL"'
