#!/usr/bin/env python3
"""
Debug script to test EPAM API directly
"""

import requests
import json

def test_epam_api():
    print("🔍 Testing EPAM API connection...")
    
    # Your EPAM API settings
    url = "https://ai-proxy.lab.epam.com/openai/deployments/claude-3-5-haiku@20241022/chat/completions?api-version=3.5 Haiku"
    headers = {
        "Content-Type": "application/json",
        "Authorization": "Bearer dial-qux0bkmzf5twpslx680o4gk0fqf",
        "User-Agent": "RepoCloner-AI-Analysis/1.0"
    }
    
    payload = {
        "messages": [
            {"role": "user", "content": "Hello, can you respond with 'API connection successful'?"}
        ],
        "temperature": 0
    }
    
    print(f"🌐 URL: {url}")
    print(f"🔧 Headers: {headers}")
    print(f"📋 Payload: {json.dumps(payload, indent=2)}")
    print()
    
    try:
        print("📡 Making request...")
        response = requests.post(url, headers=headers, json=payload, timeout=30)
        
        print(f"✅ Status Code: {response.status_code}")
        print(f"📋 Response Headers: {dict(response.headers)}")
        print()
        
        if response.status_code == 200:
            data = response.json()
            print(f"🎉 SUCCESS! Response: {json.dumps(data, indent=2)}")
            if 'choices' in data and len(data['choices']) > 0:
                content = data['choices'][0]['message']['content']
                print(f"💬 AI Response: {content}")
        else:
            print(f"❌ ERROR Response: {response.text}")
            
    except requests.exceptions.ConnectTimeout:
        print("❌ Connection timeout - Cannot reach EPAM API")
    except requests.exceptions.ConnectionError as e:
        print(f"❌ Connection error: {e}")
    except requests.exceptions.RequestException as e:
        print(f"❌ Request failed: {e}")
    except Exception as e:
        print(f"❌ Unexpected error: {e}")

if __name__ == "__main__":
    test_epam_api()