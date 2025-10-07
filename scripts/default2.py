# ANALYSIS_ID: quick-migration-1
# ANALYSIS_LABEL: Quick Migration Analysis
import os
import re
import json
import sys
import argparse
from typing import List, Dict, Any, Union
from openai import AzureOpenAI

# ========== Configuration ==========

def parse_args():
    parser = argparse.ArgumentParser(description='GPT-4 assisted Kafka to Azure Service Bus migration analysis')
    parser.add_argument('repo_url', help='Repository URL to analyze')
    parser.add_argument('repo_path', help='Local path to cloned repository')
    # All AI configuration must come from CLI arguments - no defaults
    parser.add_argument('--model', required=True, help='AI model to use (required)')
    parser.add_argument('--api-version', help='API version (optional)')
    parser.add_argument('--base-url', required=True, help='API endpoint URL (required)')
    parser.add_argument('--api-key', required=True, help='AI API key (required)')
    return parser.parse_args()

# Max number of characters from a file snippet to send to GPT‑4
GPT4_SNIPPET_MAX_CHARS = 2000

# ========== File Scanning ==========

def scan_project_files(root_dir: str) -> Dict[str, List[str]]:
    """Scan and classify project files."""
    # Exclude generated report files (don't send our own reports to AI)
    EXCLUDED_REPORT_PATTERNS = (
        "migration-report-", 
        "quick-migration-report-", 
        "test-coverage-report-"
    )
    
    files = {
        "cs_files": [],
        "csproj_files": [],
        "config_files": [],
        "test_files": [],
        "startup_files": [],
        "infra_files": [],
        "doc_files": []
    }
    for dirpath, _, filenames in os.walk(root_dir):
        for fname in filenames:
            full = os.path.join(dirpath, fname)
            # Store relative paths (not absolute Windows paths)
            relative = os.path.relpath(full, root_dir)
            
            # Skip generated report files
            if fname.lower().endswith('.md') and any(fname.startswith(pattern) for pattern in EXCLUDED_REPORT_PATTERNS):
                continue
            
            if fname.lower().endswith(".cs"):
                files["cs_files"].append(relative)
                if "test" in fname.lower() or "tests" in dirpath.lower():
                    files["test_files"].append(relative)
                if fname.lower() in ("startup.cs", "program.cs"):
                    files["startup_files"].append(relative)
            elif fname.lower().endswith(".csproj"):
                files["csproj_files"].append(relative)
            elif fname.lower().startswith("appsettings") and fname.lower().endswith(".json"):
                files["config_files"].append(relative)
            elif fname.lower().endswith((".yaml", ".yml", ".tf", ".dockerfile")) or "docker" in fname.lower():
                files["infra_files"].append(relative)
            elif fname.lower().endswith((".md", ".txt")):
                files["doc_files"].append(relative)
    return files

# ========== Manual Keyword-based Detection ==========

MANUAL_KAFKA_KEYWORDS = [
    "Confluent.Kafka",
    "ProducerBuilder",
    "ConsumerBuilder",
    "Consume(",
    "Subscribe(",
    "ProduceAsync(",
    "bootstrap.servers",
    "IKafkaProducer",
    "IKafkaConsumer"
]

def detect_config_keys(file_paths: List[str], root_dir: str) -> List[Dict[str, object]]:
    """
    Detect Kafka-related config keys in config files.
    Args:
        file_paths: List of absolute file paths
        root_dir: Root directory for converting to relative paths
    Returns:
        List of dicts with relative file paths and keys
    """
    kafka_keys = []
    kafka_key_substrings = [
        "kafka", "bootstrapservers", "groupid", "enableautocommit",
        "autooffsetreset", "sasl", "kerberos", "partitioneof"
    ]

    def flatten_dict(d, parent_key=''):
        items = []
        for k, v in d.items():
            new_key = f"{parent_key}:{k}" if parent_key else k
            if isinstance(v, dict):
                items.extend(flatten_dict(v, new_key).items())
            else:
                items.append((new_key.lower(), v))
        return dict(items)

    for file in file_paths:
        found_keys = set()
        try:
            if file.endswith(".json"):
                with open(file, "r", encoding="utf-8") as f:
                    try:
                        raw = f.read()
                        # Remove comments if any (not valid JSON)
                        raw = re.sub(r"//.*", "", raw)
                        data = json.loads(raw)
                        flat = flatten_dict(data)

                        for key in flat:
                            if any(sub in key for sub in kafka_key_substrings):
                                found_keys.add(key)
                    except json.JSONDecodeError:
                        continue
            elif file.endswith(".cs"):
                with open(file, "r", encoding="utf-8") as f:
                    content = f.read()
                    for keyword in kafka_key_substrings:
                        matches = re.findall(rf'["\']([^"\']*{keyword}[^"\']*)["\']', content, re.IGNORECASE)
                        for match in matches:
                            found_keys.add(match.strip('"\''))
        except Exception:
            continue

        if found_keys:
            # Convert to relative path before storing
            relative_path = os.path.relpath(file, root_dir)
            kafka_keys.append({
                "file": relative_path,
                "keys_to_migrate": sorted(found_keys)
            })

    return kafka_keys

def manual_detect_kafka(content: str) -> bool:
    for kw in MANUAL_KAFKA_KEYWORDS:
        if kw in content:
            return True
    return False

# ========== GPT‑4 Assisted Detection ==========

def ask_gpt4_for_kafka_usage(code_snippet: str, client: AzureOpenAI, model: str) -> Dict[str, str]:
    """Ask GPT‑4 whether the snippet uses Kafka, and what role(s).
Returns a dict like:
 {
   "uses_kafka": "yes" / "no" / "maybe",
   "role": "producer" / "consumer" / "both" / "unknown",
   "explanation": "..."
 }
"""
    
    # Craft the prompt
    prompt = f"""You are an expert in C# messaging systems. I will give you a code snippet in C#. 
Please analyze it and tell me:
1. Does it use Kafka? (yes / no / maybe)
2. If yes or maybe, is it acting as a producer, a consumer, or both?
3. What clues in the snippet point to that role (line numbers, methods, API names, etc.)?

Here is the snippet:

{code_snippet}
"""

    resp = client.chat.completions.create(
        model=model,
        temperature=0,
        messages=[
            {"role": "system", "content": "You are a helpful assistant for code analysis."},
            {"role": "user", "content": prompt}
        ],
        max_tokens=200
    )

    content = resp.choices[0].message.content
    if content is None:
        content = ""
    else:
        content = content.strip()

    # Try parsing the JSON
    try:
        parsed = json.loads(content)
        return {
            "uses_kafka": parsed.get("uses_kafka", "unknown"),
            "role": parsed.get("role", "unknown"),
            "explanation": parsed.get("explanation", ""),
            "raw_response": parsed.get("explanation", "")
        }
    except json.JSONDecodeError:
        # Fallback: if GPT's output is not valid JSON, return raw response
        return {
            "uses_kafka": "unknown",
            "role": "unknown",
            "explanation": content,
            "raw_response": content
        }

def get_snippet_from_file(file_path: str, max_chars: int) -> str:
    """Return the first up to max_chars of the file for sending to GPT4."""
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            data = f.read()
            # If very long, maybe take middle or relevant sections
            if len(data) > max_chars:
                # Maybe take first and last parts
                return data[: max_chars//2] + "\n// ... (omitted) ...\n" + data[-max_chars//2 :]
            else:
                return data
    except Exception as e:
        return ""

def parse_json_response(content: str) -> Dict:
    """Robust JSON parsing for AI responses."""
    content = content.strip()
    
    # Strategy 1: Direct JSON parse
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        pass
    
    # Strategy 2: Extract from markdown code blocks
    if "```json" in content or "```" in content:
        match = re.search(r'```(?:json)?\s*\n(.*?)\n```', content, re.DOTALL)
        if match:
            try:
                return json.loads(match.group(1))
            except json.JSONDecodeError:
                pass
    
    # Strategy 3: Find JSON object in text
    try:
        decoder = json.JSONDecoder()
        idx = content.find('{')
        if idx != -1:
            obj, _ = decoder.raw_decode(content[idx:])
            return obj
    except (json.JSONDecodeError, ValueError):
        pass
    
    return {}

def ask_gpt4_for_migration_code(file_path: str, code_content: str, client: AzureOpenAI, model: str) -> Dict[str, Union[str, List[str]]]:
    """Ask GPT-4 to generate actual migration code for Kafka to Azure Service Bus.
    Returns a dict with:
    {
      "migrated_code": "...",
      "description": "...",
      "key_changes": [...]
    }
    """
    
    prompt = f"""You are an expert C# developer specializing in Kafka to Azure Service Bus migrations.

I will give you a C# file that uses Apache Kafka (Confluent.Kafka). Your task is to:
1. Analyze the code carefully
2. Generate the EXACT migrated code replacing Kafka with Azure Service Bus
3. Return ONLY valid JSON with this structure:

{{
  "migrated_code": "the actual migrated C# code here",
  "description": "brief description of what was migrated",
  "key_changes": ["change 1", "change 2", "change 3"]
}}

File: {file_path}

Code:
```csharp
{code_content}
```

IMPORTANT: Return ONLY valid JSON - nothing else! The migrated_code field should contain actual working C# code."""

    try:
        resp = client.chat.completions.create(
            model=model,
            temperature=0,
            messages=[
                {"role": "system", "content": "You are a code migration expert. Always return valid JSON only."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=2000
        )

        content = resp.choices[0].message.content
        if content is None:
            return {"migrated_code": "", "description": "AI returned no response", "key_changes": []}
        
        content = content.strip()
        
        # Try parsing JSON with our robust parser
        result = parse_json_response(content)
        if result and "migrated_code" in result:
            return {
                "migrated_code": result.get("migrated_code", ""),
                "description": result.get("description", "Migration generated"),
                "key_changes": result.get("key_changes", [])
            }
        else:
            return {"migrated_code": "", "description": "Failed to parse AI response", "key_changes": []}
            
    except Exception as e:
        return {"migrated_code": "", "description": f"Error: {str(e)}", "key_changes": []}

# ========== .csproj NuGet Parsing ==========

def parse_csproj_nugets(csproj_file: str) -> List[Dict[str,str]]:
    results = []
    try:
        with open(csproj_file, "r", encoding="utf-8") as f:
            content = f.read()
        # Simple regex
        matches = re.findall(r"<PackageReference Include=\"([^\"]+)\" Version=\"([^\"]+)\"", content, re.IGNORECASE)
        for pkg, version in matches:
            results.append({"package": pkg, "version": version})
    except Exception as e:
        print(f"Error parsing {csproj_file}: {e}", file=sys.stderr)
    return results

# ========== Report Generation ==========

def generate_report(root_dir: str, client: AzureOpenAI, model: str) -> Dict:
    files = scan_project_files(root_dir)
    report = {
        "manual_kafka_files": [],
        "gpt4_kafka_results": [],
        "csproj_changes": [],
        "unit_test_impact": [],
        "infra_files_kafka": [],
        "doc_references": [],
        "config_files": []
    }

    # Manual detection on .cs and config files
    for f in files["cs_files"] + files["config_files"]:
        try:
            full_path = os.path.join(root_dir, f)
            with open(full_path, "r", encoding="utf-8") as rf:
                content = rf.read()
        except:
            continue

        if manual_detect_kafka(content):
            report["manual_kafka_files"].append(f)

    # GPT‑4 analysis for files flagged via manual detection OR startup / wrappers
    candidates = set(report["manual_kafka_files"])
    # also consider wrappers / startup files if not already included
    for f in files["startup_files"]:
        if f not in candidates:
            candidates.add(f)
    # maybe also test files
    for f in files["test_files"]:
        if f not in candidates:
            candidates.add(f)

    for f in list(candidates):
        full_path = os.path.join(root_dir, f)
        snippet = get_snippet_from_file(full_path, GPT4_SNIPPET_MAX_CHARS)
        if snippet.strip() == "":
            continue
        result = ask_gpt4_for_kafka_usage(snippet, client, model)
        report["gpt4_kafka_results"].append({
            "file": f,
            "uses_kafka": result["uses_kafka"],
            "role": result["role"],
            "explanation": result["explanation"]    
        })

    # Parse csproj changes: remove Kafka packages
    for csproj in files["csproj_files"]:
        full_path = os.path.join(root_dir, csproj)
        nugets = parse_csproj_nugets(full_path)
        for item in nugets:
            pkg = item["package"]
            version = item["version"]
            if "kafka" in pkg.lower() or "confluent.kafka" in pkg.lower():
                report["csproj_changes"].append({
                    "file": csproj,
                    "remove": f"{pkg} ({version})",
                    "add": "Azure.Messaging.ServiceBus (latest)"
                })

    # Unit tests impact
    for tf in files["test_files"]:
        try:
            full_path = os.path.join(root_dir, tf)
            with open(full_path, "r", encoding="utf-8") as f:
                c = f.read()
        except:
            continue
        if manual_detect_kafka(c):
            report["unit_test_impact"].append({
                "file": tf,
                "note": "Contains Kafka usage — may need mocks or refactor for Service Bus"
            })

    # Infra files
    for inf in files["infra_files"]:
        try:
            full_path = os.path.join(root_dir, inf)
            with open(full_path, "r", encoding="utf-8") as f:
                c = f.read().lower()
        except:
            continue
        if "kafka" in c:
            report["infra_files_kafka"].append(inf)

    # Docs
    for doc in files["doc_files"]:
        try:
            full_path = os.path.join(root_dir, doc)
            with open(full_path, "r", encoding="utf-8") as f:
                c = f.read().lower()
        except:
            continue
        if "kafka" in c or "confluent" in c:
            report["doc_references"].append(doc)

    # Config files with Kafka keys (need to convert relative to full paths)
    config_full_paths = [os.path.join(root_dir, f) for f in files["config_files"]]
    report["config_files"] = detect_config_keys(config_full_paths, root_dir)

    return report

# ========== Main ==========

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

    # Initialize Azure OpenAI client
    try:
        # Extract base URL and api_version if full chat completions URL was provided
        base_url = args.base_url
        api_version = args.api_version
        
        if '/openai/' in base_url or '/chat/completions' in base_url:
            # Extract just the base URL (e.g., https://ai-proxy.lab.epam.com)
            from urllib.parse import urlparse, parse_qs
            parsed = urlparse(base_url)
            base_url = f"{parsed.scheme}://{parsed.netloc}"
            
            # Extract api-version from URL if not provided as CLI arg
            if not api_version and parsed.query:
                query_params = parse_qs(parsed.query)
                if 'api-version' in query_params:
                    api_version = query_params['api-version'][0]
        
        client = AzureOpenAI(
            api_key=args.api_key,
            api_version=api_version,
            azure_endpoint=base_url
        )
    except Exception as e:
        print(f"ERROR: Failed to initialize AI client: {e}", file=sys.stderr)
        sys.exit(1)

    # Generate report
    try:
        report = generate_report(root_dir, client, args.model)
    except Exception as e:
        # Catch all errors including network/VPN failures
        error_msg = str(e)
        if "connection" in error_msg.lower() or "network" in error_msg.lower() or "timeout" in error_msg.lower():
            print(f"ERROR: Network connection failed. Please check your VPN connection and try again. Details: {e}", file=sys.stderr)
        else:
            print(f"ERROR: AI API call failed: {e}", file=sys.stderr)
        sys.exit(1)
    
    # Transform report to match the expected format
    import time
    transformed_report = {
        "meta": {
            "repoUrl": args.repo_url,
            "generatedAt": str(int(time.time() * 1000))
        },
        "inventory": [],
        "diffs": [],
        "keyChanges": []
    }
    
    # Map GPT4 kafka results to inventory AND diffs
    ai_found_files = []
    for item in report.get("gpt4_kafka_results", []):
        if item.get("uses_kafka") == "yes" or item.get("uses_kafka") == "maybe":
            file_path = item.get("file", "")
            role = item.get("role", "unknown")
            explanation = item.get("explanation", "")
            ai_found_files.append(file_path)
            
            transformed_report["inventory"].append({
                "file": file_path,
                "kafka_apis": [role],
                "summary": explanation
            })
            
            # Get actual file content and generate real migration code with AI
            full_path = os.path.join(root_dir, file_path)
            file_content = get_snippet_from_file(full_path, 4000)  # Larger snippet for migration
            
            if file_content.strip():
                migration_result = ask_gpt4_for_migration_code(file_path, file_content, client, args.model)
                
                migrated_code = migration_result.get("migrated_code", "")
                description = migration_result.get("description", f"Migration guide for {role}")
                key_changes = migration_result.get("key_changes", [f"Replace Kafka {role} with Azure Service Bus"])
                
                # Generate actual diff with real code
                diff_content = f"""--- a/{file_path}
+++ b/{file_path}
@@ {description} @@
-{file_content[:500]}...
+{migrated_code[:500] if migrated_code else '// Migration code generation failed'}...
"""
                
                transformed_report["diffs"].append({
                    "file": file_path,
                    "diff": diff_content,
                    "description": description,
                    "key_changes": key_changes if key_changes else [f"Replace Kafka {role} with Azure Service Bus"],
                    "migrated_code": migrated_code  # Full migrated code
                })
            else:
                # Fallback if file can't be read
                transformed_report["diffs"].append({
                    "file": file_path,
                    "diff": f"--- a/{file_path}\n+++ b/{file_path}\n@@ File not readable @@",
                    "description": f"Could not read file for migration",
                    "key_changes": [f"Replace Kafka {role} with Azure Service Bus"]
                })
    
    # Add keyword-detected files to inventory if AI didn't find them
    # But don't label them as "manual detection" - just show them as detected
    for file in report.get("manual_kafka_files", []):
        if not any(item["file"] == file for item in transformed_report["inventory"]):
            transformed_report["inventory"].append({
                "file": file,
                "kafka_apis": ["Kafka"],
                "summary": "Contains Kafka API usage"
            })
            
            # Get actual file content and generate real migration code with AI
            full_path = os.path.join(root_dir, file)
            file_content = get_snippet_from_file(full_path, 4000)
            
            if file_content.strip():
                migration_result = ask_gpt4_for_migration_code(file, file_content, client, args.model)
                
                migrated_code = migration_result.get("migrated_code", "")
                description = migration_result.get("description", "Kafka to Azure Service Bus migration")
                key_changes = migration_result.get("key_changes", ["Replace Kafka with Azure Service Bus"])
                
                # Generate actual diff with real code
                diff_content = f"""--- a/{file}
+++ b/{file}
@@ {description} @@
-{file_content[:500]}...
+{migrated_code[:500] if migrated_code else '// Migration code generation failed'}...
"""
                
                transformed_report["diffs"].append({
                    "file": file,
                    "diff": diff_content,
                    "description": description,
                    "key_changes": key_changes if key_changes else ["Replace Kafka with Azure Service Bus"],
                    "migrated_code": migrated_code
                })
            else:
                # Fallback
                transformed_report["diffs"].append({
                    "file": file,
                    "diff": f"--- a/{file}\n+++ b/{file}\n@@ File not readable @@",
                    "description": "Could not read file for migration",
                    "key_changes": ["Replace Kafka with Azure Service Bus"]
                })
    
    # Add NuGet package changes as diffs
    for change in report.get("csproj_changes", []):
        csproj_file = change.get("file", "")
        remove_pkg = change.get("remove", "")
        add_pkg = change.get("add", "")
        
        diff_content = f"""--- a/{csproj_file}
+++ b/{csproj_file}
@@ NuGet Package Update @@
-    <PackageReference Include="{remove_pkg}" />
+    <PackageReference Include="{add_pkg}" />
"""
        
        transformed_report["diffs"].append({
            "file": csproj_file,
            "diff": diff_content,
            "description": f"Update NuGet package: Remove {remove_pkg}, Add {add_pkg}",
            "key_changes": [f"Remove {remove_pkg}", f"Add {add_pkg}"]
        })
    
    # Generate markdown report file with embedded JSON
    import time
    analysis_id = str(int(time.time() * 1000))
    report_filename = f"quick-migration-report-{analysis_id}.md"
    report_path = os.path.join(root_dir, report_filename)
    
    with open(report_path, "w", encoding="utf-8") as f:
        f.write("# Quick Migration Analysis Report\n\n")
        f.write("*AI-powered Kafka to Azure Service Bus migration analysis using GPT-4*\n\n")
        f.write(f"**Repository:** {args.repo_url}\n\n")
        f.write(f"**Analysis Type:** Quick Migration Analysis\n\n")
        f.write("---\n\n")
        
        # Summary section
        f.write("## Summary\n\n")
        inventory_count = len(transformed_report.get("inventory", []))
        diffs_count = len(transformed_report.get("diffs", []))
        f.write(f"- **Files with Kafka usage:** {inventory_count}\n")
        f.write(f"- **Migration changes required:** {diffs_count}\n\n")
        
        # Manual detection section removed - only show AI results
        
        # GPT-4 analysis results
        if report.get("gpt4_kafka_results"):
            f.write("### AI-Powered Analysis Results\n\n")
            for item in report["gpt4_kafka_results"]:
                if item.get("uses_kafka") in ["yes", "maybe"]:
                    f.write(f"**File:** `{item.get('file', 'N/A')}`\n")
                    f.write(f"- **Role:** {item.get('role', 'unknown')}\n")
                    f.write(f"- **Explanation:** {item.get('explanation', 'N/A')}\n\n")
        
        # NuGet package changes
        if report.get("csproj_changes"):
            f.write("### NuGet Package Changes\n\n")
            for change in report["csproj_changes"]:
                f.write(f"**File:** `{change.get('file', 'N/A')}`\n")
                f.write(f"- Remove: `{change.get('remove', 'N/A')}`\n")
                f.write(f"- Add: `{change.get('add', 'N/A')}`\n\n")
        
        # Unit test impact
        if report.get("test_file_count", 0) > 0:
            f.write(f"### Unit Test Impact\n\n")
            f.write(f"Found {report['test_file_count']} test files that may need updates.\n\n")
        
        # Infrastructure files
        if report.get("infra_files"):
            f.write("### Infrastructure Files\n\n")
            for file in report["infra_files"]:
                f.write(f"- `{file}`\n")
            f.write("\n")
        
        # Configuration keys
        if report.get("config_keys"):
            f.write("### Configuration Keys\n\n")
            for item in report["config_keys"]:
                f.write(f"**File:** `{item.get('file', 'N/A')}`\n")
                f.write(f"- Keys: {', '.join([f'`{k}`' for k in item.get('keys', [])])}\n\n")
        
        # Documentation references
        if report.get("doc_files"):
            f.write("### Documentation References\n\n")
            for file in report["doc_files"]:
                f.write(f"- `{file}`\n")
            f.write("\n")
        
        # Embed structured JSON for UI parsing
        f.write("---\n\n")
        f.write("## Structured Data (JSON)\n\n")
        f.write("```json\n")
        f.write(json.dumps(transformed_report, indent=2))
        f.write("\n```\n")
    
    print(f"✅ Quick Migration Analysis Report generated: {report_path}")
    # Also output JSON to stdout for compatibility
    print(json.dumps(transformed_report, indent=2))

if __name__ == "__main__":
    main()
