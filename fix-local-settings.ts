// Run this script to clear corrupted AI settings from your local storage
// Usage: npx tsx fix-local-settings.ts

import { storage } from './server/storage.js';

async function fixCorruptedSettings() {
  console.log('🔧 Clearing corrupted AI settings from local storage...');
  
  try {
    // Delete the corrupted settings
    const deleted = await storage.deleteAISettings();
    
    if (deleted) {
      console.log('✅ SUCCESS! Corrupted settings deleted.');
      console.log('');
      console.log('Next steps:');
      console.log('1. Restart your app (npm run dev)');
      console.log('2. Open Settings → AI Configuration');
      console.log('3. Enter your API key');
      console.log('4. Select "Claude 3.5 Haiku (EPAM)" from the dropdown');
      console.log('5. The apiVersion will be left EMPTY (this is correct)');
      console.log('6. Save settings');
      console.log('');
      console.log('The URL will work correctly without the apiVersion in settings.');
    } else {
      console.log('ℹ️ No corrupted settings found (already cleared).');
      console.log('');
      console.log('Your settings are clean. Try configuring AI settings again:');
      console.log('- API Key: your-key');
      console.log('- Model: Claude 3.5 Haiku (EPAM)');
      console.log('- Leave apiVersion empty');
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixCorruptedSettings();
