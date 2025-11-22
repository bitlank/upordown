#!/bin/bash

if [ -f ".env" ]; then
  echo ".env already exists, no action taken"
  exit 1
fi

DB_ROOT_PASSWORD=$(openssl rand -base64 12)
DB_APP_PASSWORD=$(openssl rand -base64 12)
JWT_SECRET=$(openssl rand -hex 32)

cat > .env << EOF
NODE_ENV="prod"

# Database Credentials
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD}"
DB_APP_USER="upordown"
DB_APP_PASSWORD="${DB_APP_PASSWORD}"
DB_NAME="upordown"

# Backend JWT Secret
JWT_SECRET="${JWT_SECRET}"
EOF

echo ".env file created with random credentials"
