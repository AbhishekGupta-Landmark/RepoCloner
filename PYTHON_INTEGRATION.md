# Python Script Integration for RepoCloner

This document describes the Python script execution feature that runs automatically when you click the "Clone Repository" button.

## Overview

When you clone a repository using RepoCloner, a Python script is automatically executed after the successful cloning process. This allows you to perform custom analysis, setup tasks, or any other post-clone operations.

## How It Works

1. **Clone Repository**: When you click the "Clone Repository" button, the system:
   - Clones the repository to a local directory
   - Performs technology detection
   - **Executes a Python script** with repository information
   - Creates the repository record

2. **Python Script Execution**: The script receives:
   - Repository URL as first argument (`sys.argv[1]`)
   - Local repository path as second argument (`sys.argv[2]`)
   - Working directory set to the cloned repository

## Default Script Features

The default Python script (`scripts/default.py`) provides:

### Repository Analysis
- **File Statistics**: Count of files, directories, and total size
- **Language Detection**: Identifies programming languages based on file extensions
- **Large File Detection**: Finds files larger than 1MB
- **Security Scanning**: Looks for potentially sensitive configuration files

### Report Generation
- **Console Output**: Formatted analysis report displayed in logs
- **JSON Report**: Saves detailed analysis to `.repocloner_analysis.json`

### Example Output
```
🐍 RepoCloner Python Analysis Script Started
📊 REPOSITORY ANALYSIS REPORT
================================================================
🔗 Repository: https://github.com/user/repo.git
📁 Local Path: /temp/clone_1234567890
📈 FILE STATISTICS:
   Total Files: 150
   Repository Size: 2.5 MB

💻 DETECTED LANGUAGES:
   JavaScript: 45 files
   TypeScript: 32 files
   CSS: 15 files

💡 RECOMMENDATIONS:
   • JavaScript/TypeScript project detected. Check for package.json and security vulnerabilities.
```

## Custom Scripts

### Using Your Own Script

You can customize the Python script execution by:

1. **Modifying the default script**: Edit `scripts/default.py`
2. **Creating a new script**: Place your script in the `scripts/` directory
3. **Using script content**: Programmatically provide script content

### Script Requirements

Your Python script should:
- Accept repository URL as `sys.argv[1]`
- Accept repository path as `sys.argv[2]`
- Handle errors gracefully
- Return appropriate exit codes (0 for success, non-zero for failure)

### Example Custom Script

```python
#!/usr/bin/env python3
import os
import sys
from datetime import datetime

def main():
    repo_url = sys.argv[1] if len(sys.argv) > 1 else "Unknown"
    repo_path = sys.argv[2] if len(sys.argv) > 2 else os.getcwd()
    
    print(f"Processing repository: {repo_url}")
    print(f"Location: {repo_path}")
    
    # Your custom logic here
    # - Setup development environment
    # - Run security scans
    # - Generate documentation
    # - Send notifications
    # - etc.
    
    return 0

if __name__ == "__main__":
    sys.exit(main())
```

## Configuration

### Python Environment

The system automatically detects Python installation:
- Tries `python` command first
- Falls back to `python3` if needed
- Reports version and availability in logs

### Script Execution

- **Timeout**: 30 seconds (configurable)
- **Working Directory**: Set to cloned repository path
- **Output Capture**: Both stdout and stderr are logged
- **Error Handling**: Script failures don't prevent repository cloning

## API Integration

### Python Script Service

The `pythonScriptService` provides several methods:

```typescript
// Execute post-clone script
await pythonScriptService.executePostCloneScript(repositoryPath, repositoryUrl);

// Execute custom script
await pythonScriptService.executePythonScript({
  scriptPath: '/path/to/script.py',
  workingDirectory: repositoryPath,
  args: ['arg1', 'arg2'],
  timeout: 60000
});

// Check Python availability
await pythonScriptService.checkPythonAvailability();
```

### Integration Points

Python scripts are executed in these workflows:
- **GitHub Personal Account Creation**: After analysis clone
- **GitLab Personal Account Creation**: After analysis clone  
- **Standard Cloning**: After successful clone and technology detection

## Logs and Monitoring

### Log Messages

The system provides detailed logging:
```
INFO: Starting Python script execution
INFO: Using Python script from file: /scripts/default.py
INFO: Executing Python script: python /scripts/default.py https://github.com/user/repo.git /temp/clone_123
INFO: Python script executed successfully
INFO: Python script output: 🐍 RepoCloner Python Analysis Script Started...
```

### Error Handling

If Python execution fails:
- Error is logged but doesn't stop the cloning process
- Repository is still created and available
- Error details are captured in logs

## Security Considerations

### Script Execution Safety

- Scripts run in isolated environment
- Timeout prevents infinite execution
- Working directory is restricted to repository path
- No elevated privileges required

### Input Validation

- Repository URLs are validated before passing to scripts
- File paths are sanitized
- Arguments are properly escaped

## Troubleshooting

### Common Issues

1. **Python Not Found**
   - Install Python and ensure it's in your PATH
   - Check logs for Python detection messages

2. **Script Timeout**
   - Increase timeout in script options
   - Optimize script performance

3. **Permission Errors**
   - Ensure Python has read access to repository
   - Check file permissions in temp directory

### Debug Information

Enable detailed logging to see:
- Python version detection
- Script execution commands
- Full script output
- Error stack traces

## Examples

### Repository Setup Script
```python
# Automatically install dependencies after cloning
import subprocess
import os

def setup_node_project(repo_path):
    package_json = os.path.join(repo_path, 'package.json')
    if os.path.exists(package_json):
        subprocess.run(['npm', 'install'], cwd=repo_path)
        print("✅ Node.js dependencies installed")

def setup_python_project(repo_path):
    requirements = os.path.join(repo_path, 'requirements.txt')
    if os.path.exists(requirements):
        subprocess.run(['pip', 'install', '-r', requirements], cwd=repo_path)
        print("✅ Python dependencies installed")
```

### Security Audit Script
```python
# Scan for security vulnerabilities
import json
import subprocess

def audit_npm_packages(repo_path):
    try:
        result = subprocess.run(['npm', 'audit', '--json'], 
                              cwd=repo_path, capture_output=True, text=True)
        audit_data = json.loads(result.stdout)
        vulnerabilities = audit_data.get('metadata', {}).get('vulnerabilities', {})
        
        total = sum(vulnerabilities.values())
        if total > 0:
            print(f"⚠️ Found {total} npm vulnerabilities")
        else:
            print("✅ No npm vulnerabilities found")
    except Exception as e:
        print(f"Could not audit npm packages: {e}")
```

This integration provides a powerful way to customize the repository cloning workflow and automate post-clone tasks specific to your development needs.