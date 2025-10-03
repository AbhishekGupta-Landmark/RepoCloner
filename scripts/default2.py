# ANALYSIS_ID: quick-migration-1
# ANALYSIS_LABEL: Quick Migration Analysis
import os
import re
import json
import sys
import argparse
from typing import List, Dict
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
    for item in report.get("gpt4_kafka_results", []):
        if item.get("uses_kafka") == "yes" or item.get("uses_kafka") == "maybe":
            file_path = item.get("file", "")
            role = item.get("role", "unknown")
            explanation = item.get("explanation", "")
            
            transformed_report["inventory"].append({
                "file": file_path,
                "kafka_apis": [role],
                "summary": explanation
            })
            
            # Generate diff for this file
            diff_content = f"""--- a/{file_path}
+++ b/{file_path}
@@ Migration Required @@
-// Kafka implementation ({role})
+// Azure Service Bus implementation
+using Azure.Messaging.ServiceBus;
+
+// Replace Kafka {role} with Service Bus equivalent:
+// - Remove Confluent.Kafka package reference
+// - Add Azure.Messaging.ServiceBus package
+// - Update connection configuration
+// - Migrate message producers/consumers to ServiceBus{("Client" if role == "producer" else "Receiver")}
"""
            
            transformed_report["diffs"].append({
                "file": file_path,
                "diff": diff_content,
                "description": f"Migration guide for {role}: {explanation}",
                "key_changes": [
                    f"Replace Kafka {role} with Azure Service Bus",
                    "Update NuGet packages",
                    "Modify connection configuration"
                ]
            })
    
    # Map manual kafka files to inventory if not already present
    for file in report.get("manual_kafka_files", []):
        if not any(item["file"] == file for item in transformed_report["inventory"]):
            transformed_report["inventory"].append({
                "file": file,
                "kafka_apis": ["manual detection"],
                "summary": "Detected via keyword matching"
            })
            
            # Generate diff for manually detected files
            diff_content = f"""--- a/{file}
+++ b/{file}
@@ Kafka Migration Required @@
-// Kafka implementation detected
+// Migrate to Azure Service Bus
+using Azure.Messaging.ServiceBus;
"""
            
            transformed_report["diffs"].append({
                "file": file,
                "diff": diff_content,
                "description": "Kafka usage detected - migration to Azure Service Bus recommended",
                "key_changes": ["Review Kafka usage", "Plan Service Bus migration"]
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
    report_filename = f"migration-report-{analysis_id}.md"
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
        
        # Manual detection results
        if report.get("manual_kafka_files"):
            f.write("### Manual Keyword Detection\n\n")
            f.write("Files detected via keyword matching:\n\n")
            for file in report["manual_kafka_files"]:
                f.write(f"- `{file}`\n")
            f.write("\n")
        
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
