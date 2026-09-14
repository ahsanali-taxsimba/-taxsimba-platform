#!/bin/bash

# Exit on error
set -e

# Log start
echo "🚀 Starting deployment script..."

# Stop PM2 process with ID 9
#echo "🛑 Stopping PM2 process 6..."
#pm2 stop 5

# Pull latest code from master branch
#echo "📥 Pulling latest changes from origin/master..."
#git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🛠️ Building project..."
npm run build

# Restart the PM2 process
echo "▶️ Starting PM2 process 2..."
pm2 restart 2

# Save PM2 process list
echo "💾 Saving PM2 state..."
pm2 save

# Log end
echo "✅ Deployment completed successfully."
