#!/usr/bin/env python3
"""
AI Test Coverage Analyzer
Analyzes C# source code and generates comprehensive test coverage reports using AI
"""

import os
import sys
import argparse
import requests
from typing import List, Dict, Optional

# Fix Windows console encoding for emoji support
if sys.platform == 'win32':
    import codecs
    if sys.stdout.encoding != 'utf-8':
        sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    if sys.stderr.encoding != 'utf-8':
        sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')


def find_cs_files(root: str) -> List[str]:
    """Find all C# source files excluding test files"""
    cs_files = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d.lower() not in ("bin", "obj", "migrations")]
        for f in files:
            if f.endswith(".cs") and not (f.endswith("Tests.cs") or f.endswith("Test.cs")):
                cs_files.append(os.path.join(dirpath, f))
    return cs_files


def find_test_files(root: str) -> List[str]:
    """Find all test files"""
    test_files = []
    for dirpath, dirs, files in os.walk(root):
        dirs[:] = [d for d in dirs if d.lower() not in ("bin", "obj", "migrations")]
        for f in files:
            if f.endswith("Tests.cs") or f.endswith("Test.cs"):
                test_files.append(os.path.join(dirpath, f))
    return test_files


def read_file(path: str) -> str:
    """Read file content safely"""
    try:
        with open(path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception:
        return ""


def call_llm(messages: List[Dict], api_key: str, base_url: str) -> str:
    """Call AI API to analyze code"""
    headers = {
        "Content-Type": "application/json",
        "Api-Key": api_key
    }
    payload = {
        "messages": messages,
        "temperature": 0,
    }
    resp = requests.post(base_url, headers=headers, json=payload, timeout=120)
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def analyze_and_generate_tests(source_path: str, test_path: Optional[str], api_key: str, base_url: str, root_dir: str) -> Dict:
    """Analyze source code and generate test cases using AI - returns structured JSON"""
    source_code = read_file(source_path)
    test_code = read_file(test_path) if test_path else "No test file found."
    
    relative_source = os.path.relpath(source_path, root_dir)
    
    prompt = (
        "You are an expert C# developer and test engineer. "
        "Analyze the following C# source code and its test file (if any). "
        "Identify missing or weakly tested logic, and generate xUnit or NUnit test cases to improve coverage. "
        "If no test file exists, generate a new one. "
        "Be thorough and include edge cases and error handling. "
        "Focus on business logic, integration points, and error scenarios.\n\n"
        f"Source file:\n{source_code}\n\n"
        f"Test file:\n{test_code}\n"
        "\n---\n"
        "CRITICAL: Your response must be ONLY valid JSON - nothing else!\n"
        "- NO markdown code blocks (no ```json or ```)\n"
        "- NO explanatory text before or after\n"
        "- NO comments\n"
        "- ONLY the raw JSON object\n\n"
        "Count the existing test cases and newly generated test cases. "
        "Return this exact JSON structure:\n"
        "{\n"
        '  "testCasesFound": <number>,\n'
        '  "newTestCasesAdded": <number>,\n'
        '  "generatedTestCode": "<complete C# test code with proper class names>",\n'
        '  "summary": "<brief summary>",\n'
        '  "recommendations": "<recommendations for improving the code>",\n'
        '  "keyImprovements": "<key improvements made>",\n'
        '  "note": "<any important notes>",\n'
        '  "testCaseCategories": "<categories of test cases generated>"\n'
        "}\n\n"
        "IMPORTANT: Do NOT use generic names like 'UnitTest1'. Create proper test class names based on the source file."
    )
    
    messages = [{"role": "user", "content": prompt}]
    response = call_llm(messages, api_key, base_url)
    
    # Parse JSON response - simple but robust
    import json
    
    def is_valid_result(obj):
        """Verify JSON has required fields"""
        return (isinstance(obj, dict) and 
                'testCasesFound' in obj and 
                'newTestCasesAdded' in obj and 
                'generatedTestCode' in obj)
    
    result = None
    
    # Strategy 1: Direct deserialization (AI should return pure JSON)
    try:
        candidate = json.loads(response.strip())
        if is_valid_result(candidate):
            result = candidate
    except json.JSONDecodeError:
        pass
    
    # Strategy 2: Strip markdown code blocks if present
    if not result and '```' in response:
        start_idx = response.find('```')
        end_idx = response.rfind('```')
        
        if start_idx != -1 and end_idx != -1 and end_idx > start_idx:
            content = response[start_idx + 3:end_idx]
            
            # Remove 'json' language identifier
            if content.strip().startswith('json'):
                content = content.strip()[4:]
            
            try:
                candidate = json.loads(content.strip())
                if is_valid_result(candidate):
                    result = candidate
            except json.JSONDecodeError:
                pass
    
    # Strategy 3: Scan for JSON object in response (handles prose before/after)
    if not result:
        decoder = json.JSONDecoder()
        idx = 0
        while idx < len(response):
            try:
                candidate, end_idx = decoder.raw_decode(response[idx:])
                if is_valid_result(candidate):
                    result = candidate
                    break
                idx += end_idx
            except json.JSONDecodeError:
                idx += 1
                if idx >= len(response):
                    break
    
    # If we got a valid result, process it
    if result:
        
        # Validate and fix test class names - NO generic names allowed
        generated_code = result.get("generatedTestCode", "")
        source_file_name = os.path.basename(source_path).replace('.cs', '')
        
        # Replace generic test class names with proper names based on source file
        # Handle ALL class declaration variations: public/internal/protected, sealed, static, abstract, etc.
        import re
        generic_class_names = ['UnitTest1', 'UnitTest', 'Tests', 'Test', 'TestClass', 'UnitTests']
        
        for generic_name in generic_class_names:
            # Match: (any access modifiers/attributes) class (GenericName)
            # Captures everything before 'class' to preserve modifiers
            pattern = r'((?:public|internal|protected|private)?\s*(?:sealed|static|abstract|partial)?\s*)class\s+' + generic_name + r'\b'
            replacement = r'\1class ' + f'{source_file_name}Tests'
            generated_code = re.sub(pattern, replacement, generated_code, flags=re.IGNORECASE)
        
        result["generatedTestCode"] = generated_code
        return result
    
    # Fallback if no valid JSON was found
    print(f"WARNING: Failed to parse AI response as JSON. Response preview: {response[:200]}...")
    return {
        "testCasesFound": 0,
        "newTestCasesAdded": 0,
        "generatedTestCode": response,
        "summary": "AI response parsing failed",
        "recommendations": "",
        "keyImprovements": "",
        "note": "",
        "testCaseCategories": ""
    }


def map_sources_to_tests(cs_files: List[str], test_files: List[str]) -> Dict[str, Optional[str]]:
    """Map source files to their corresponding test files"""
    mapping = {}
    test_file_set = {os.path.basename(f): f for f in test_files}
    
    for src in cs_files:
        base = os.path.basename(src)
        test_name1 = base.replace('.cs', 'Tests.cs')
        test_name2 = base.replace('.cs', 'Test.cs')
        mapping[src] = test_file_set.get(test_name1) or test_file_set.get(test_name2)
    
    return mapping


def generate_json_report(report: List[Dict], output_path: str, repo_url: str, root_dir: str):
    """Generate JSON test coverage report"""
    import time
    import json
    
    # Calculate totals
    total_found = sum(entry['analysis']['testCasesFound'] for entry in report)
    total_new = sum(entry['analysis']['newTestCasesAdded'] for entry in report)
    
    # Build file reports
    file_reports = []
    for entry in report:
        source_rel = os.path.relpath(entry['source'], root_dir)
        test_rel = os.path.relpath(entry['test'], root_dir) if entry['test'] else 'None'
        analysis = entry['analysis']
        
        # Calculate coverage percentage (8 lines per test heuristic)
        lines_in_file = len(read_file(entry['source']).split('\n'))
        old_coverage = min(100, (analysis['testCasesFound'] * 8 * 100) // lines_in_file) if lines_in_file > 0 else 0
        new_coverage = min(100, ((analysis['testCasesFound'] + analysis['newTestCasesAdded']) * 8 * 100) // lines_in_file) if lines_in_file > 0 else 0
        
        file_reports.append({
            "file": source_rel,
            "testFile": test_rel,
            "testCasesFound": analysis['testCasesFound'],
            "newTestCasesAdded": analysis['newTestCasesAdded'],
            "generatedTests": analysis['generatedTestCode'],
            "oldCoveragePercentage": old_coverage,
            "newCoveragePercentage": new_coverage,
            "summary": analysis.get('summary', ''),
            "recommendations": analysis.get('recommendations', ''),
            "keyImprovements": analysis.get('keyImprovements', ''),
            "note": analysis.get('note', ''),
            "testCaseCategories": analysis.get('testCaseCategories', '')
        })
    
    # Build final report structure
    report_data = {
        "repository": repo_url,
        "generatedAt": time.strftime('%Y-%m-%d %H:%M:%S'),
        "totalFilesAnalyzed": len(report),
        "totalOriginalTestCases": total_found,
        "totalNewTestCasesAdded": total_new,
        "totalTestCasesAfterImprovements": total_found + total_new,
        "fileReports": file_reports
    }
    
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report_data, f, indent=2)
    
    print(f"✅ Test Coverage Report generated: {output_path}")


def parse_args():
    """Parse command line arguments"""
    parser = argparse.ArgumentParser(description='AI Test Coverage Analyzer for C# projects')
    parser.add_argument('--repo-path', required=True, help='Path to the cloned repository')
    parser.add_argument('--repo-url', required=True, help='Repository URL')
    parser.add_argument('--api-key', required=True, help='AI API key')
    parser.add_argument('--base-url', required=True, help='AI API base URL')
    parser.add_argument('--model', help='AI model name (optional)')
    return parser.parse_args()


def main():
    args = parse_args()
    
    # Fail fast if AI is not configured
    if not args.api_key:
        print("ERROR: AI API key is required. Cannot proceed without AI configuration.", file=sys.stderr)
        sys.exit(1)
    
    root_dir = args.repo_path
    if not os.path.isdir(root_dir):
        print(f"ERROR: Provided path is not a directory or doesn't exist: {root_dir}", file=sys.stderr)
        sys.exit(1)
    
    try:
        print(f"🔍 Scanning repository: {root_dir}")
        cs_files = find_cs_files(root_dir)
        test_files = find_test_files(root_dir)
        
        print(f"📁 Found {len(cs_files)} source files")
        print(f"🧪 Found {len(test_files)} test files")
        
        mapping = map_sources_to_tests(cs_files, test_files)
        
        report = []
        for idx, (src, test) in enumerate(mapping.items(), 1):
            print(f"🤖 Analyzing {idx}/{len(mapping)}: {os.path.relpath(src, root_dir)} ...")
            
            try:
                analysis_result = analyze_and_generate_tests(src, test, args.api_key, args.base_url, root_dir)
                test_path = test or os.path.join(os.path.dirname(src), os.path.basename(src).replace('.cs', 'Tests.cs'))
                
                report.append({
                    "source": src,
                    "test": test_path,
                    "analysis": analysis_result
                })
            except Exception as e:
                error_msg = str(e)
                if "connection" in error_msg.lower() or "network" in error_msg.lower() or "timeout" in error_msg.lower():
                    print(f"ERROR: Network connection failed. Please check your VPN connection and try again. Details: {e}", file=sys.stderr)
                else:
                    print(f"ERROR: AI API call failed for {src}: {e}", file=sys.stderr)
                # Continue with other files even if one fails
                continue
        
        # Generate JSON report
        import time
        analysis_id = str(int(time.time() * 1000))
        json_report = os.path.join(root_dir, f"test-coverage-report-{analysis_id}.json")
        
        generate_json_report(report, json_report, args.repo_url, root_dir)
        
        print(f"✅ Analysis complete. Generated report: {json_report}")
        
    except Exception as e:
        # Catch all errors including network/VPN failures
        error_msg = str(e)
        if "connection" in error_msg.lower() or "network" in error_msg.lower() or "timeout" in error_msg.lower():
            print(f"ERROR: Network connection failed. Please check your VPN connection and try again. Details: {e}", file=sys.stderr)
        else:
            print(f"ERROR: Test coverage analysis failed: {e}", file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
