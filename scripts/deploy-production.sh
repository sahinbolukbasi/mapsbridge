#!/bin/bash

# MapsBridge Production Deployment Script
# This script automates the deployment process for production environment

set -e  # Exit on any error

echo "🚀 Starting MapsBridge Production Deployment..."

# Environment variables
export ENVIRONMENT="production"
export DEPLOYMENT_TAG="v$(date +%Y%m%d-%H%M%S)"

# 1. Build the application
echo "🏗️  Building applications..."
npm run build

# 2. Run tests
echo "🧪 Running tests..."
npm test
npm run test:backend

# 3. Build Docker image
echo "🐳 Building Docker image..."
docker build -t mapsbridge:$DEPLOYMENT_TAG -t mapsbridge:latest .

# 4. Push to registry
echo "📤 Pushing to container registry..."
docker push mapsbridge:$DEPLOYMENT_TAG
docker push mapsbridge:latest

# 5. Deploy to production (example using AWS ECS)
echo "☁️  Deploying to production environment..."
# Uncomment and configure for your deployment platform:
# aws ecs update-service --cluster mapsbridge-cluster --service mapsbridge-web --force-new-deployment

# 6. Run monitoring checks
echo "🔍 Running post-deployment checks..."
npm run monitor:synthetics

# 7. Verify deployment
echo "✅ Deployment completed successfully!"
echo "Deployment tag: $DEPLOYMENT_TAG"
echo "Environment: $ENVIRONMENT"

exit 0