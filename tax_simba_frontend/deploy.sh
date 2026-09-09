#!/bin/bash

# -------------------------------
# 🚀 Simple Deploy Script
# Pulls from 'development', rebuilds, and restarts the app
# -------------------------------

set -e  # Stop script on any error

#echo "🔄 Pulling latest code from 'development' branch..."
#git pull origin development

#echo "🛑 Stopping PM2 process (ID: 1)..."
#pm2 stop 0

echo "📦 Installing dependencies..."
npm install

echo "🛠️ Building the application..."
npm run build

echo "🚀 Restarting PM2 process (ID: 14)..."
pm2 restart 14

echo "✅ Deployment complete!"
