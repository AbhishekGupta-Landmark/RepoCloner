#!/bin/bash

echo "🚀 Setting up local development environment..."

# Install concurrently for running multiple processes
echo "📦 Installing concurrently..."
npm install --save-dev concurrently

echo "✅ Local development setup complete!"
echo ""
echo "🔧 To run the application locally:"
echo "1. Use the local Vite config:"
echo "   npm run build -- --config vite.config.local.ts"
echo ""  
echo "2. For development, run the server manually:"
echo "   npm run dev"
echo ""
echo "3. Then in another terminal, run the client:"
echo "   npx vite --config vite.config.local.ts"
echo ""
echo "Server: http://localhost:5000"
echo "Client: http://localhost:3000 (if running separately)"