#!/usr/bin/env node

// Simple script to run the server without cross-env dependency issues
process.env.NODE_ENV = 'development';

// Import and run the server
import('./server/index.ts').catch(console.error);