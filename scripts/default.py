import os
import re
import json
import requests
import subprocess
import sys
from typing import TypedDict, List, Dict, Any, Optional
from urllib.parse import quote, urlparse, parse_qs, urlencode, urlunparse
from langgraph.graph import StateGraph, END
from langchain_core.messages import HumanMessage, AIMessage, BaseMessage
from langchain_core.language_models.chat_models import BaseChatModel
from langchain_core.outputs import ChatResult, ChatGeneration

import argparse

# Parse command line arguments for AI configuration
def parse_args():
    parser = argparse.ArgumentParser(description='AI-powered repository analysis for Kafka to Azure Service Bus migration')
    parser.add_argument('repo_url', help='Repository URL to analyze')
    parser.add_argument('repo_path', help='Local path to clone/analyze repository')
    parser.add_argument('--model', default=os.environ.get("AI_MODEL", "gpt-4"), help='AI model to use')
    parser.add_argument('--api-version', default=os.environ.get("AI_API_VERSION", "2024-02-15-preview"), help='API version')
    parser.add_argument('--base-url', default=os.environ.get("AI_ENDPOINT_URL", "https://api.openai.com/v1/chat/completions"), help='API endpoint URL')
    parser.add_argument('--api-key', default=os.environ.get("AI_API_KEY"), help='AI API key (required)')
    return parser.parse_args()

# Safe defaults - no hardcoded credentials
DEFAULT_MODEL = "gpt-4"
DEFAULT_API_VERSION = "2024-02-15-preview"
DEFAULT_BASE_URL = "https://api.openai.com/v1/chat/completions"

class RepoAnalysisState(TypedDict):
    repo_url: str
    repo_path: str
    code_chunks: List[str]
    messages: List[BaseMessage]
    analysis: str
    kafka_inventory: List[dict]
    code_diffs: List[dict]
    # AI configuration (optional)
    model: str
    api_version: str
    base_url: str
    api_key: str

class ApiKeyOnlyChatModel(BaseChatModel):
    model_name: str
    base_url: str
    api_key: str
    api_version: Optional[str] = None

    def _generate(self, messages: List[BaseMessage], stop=None, run_manager=None, **kwargs):
        role_map = {"human": "user", "ai": "assistant", "system": "system"}
        
        # For deployment-based URLs (Azure OpenAI, EPAM proxy), don't include model in payload
        payload = {
            "messages": [
                {"role": role_map.get(m.type, m.type), "content": m.content}
                for m in messages
            ],
            "temperature": 0,
        }
        
        # Only add model name for direct OpenAI API calls (not deployment-based URLs)
        if 'deployments' not in self.base_url.lower():
            payload["model"] = self.model_name
        
        # Use EPAM-specific Api-Key header format (not standard OpenAI Bearer token)
        if 'epam' in self.base_url.lower():
            headers = {"Content-Type": "application/json", "Api-Key": self.api_key}
        else:
            # Standard OpenAI format for other providers
            headers = {"Content-Type": "application/json", "Authorization": f"Bearer {self.api_key}"}
        
        # Add API version header ONLY for Azure OpenAI (not EPAM proxy - it uses URL params)
        api_version = getattr(self, 'api_version', None)
        if api_version and 'azure' in self.base_url.lower() and 'epam' not in self.base_url.lower():
            headers["api-version"] = api_version
            
        # Special handling for EPAM proxy - may need additional headers
        if 'epam' in self.base_url.lower():
            # Add any additional headers needed for EPAM proxy
            headers["User-Agent"] = "RepoCloner-AI-Analysis/1.0"
            
        try:
            # For EPAM proxy, use the URL as-is since it already contains properly formatted parameters
            print(f"🌐 Making API request to: {self.base_url}")
            print(f"🔧 Headers: {headers}")
            print(f"📋 Payload: {payload}")
            
            resp = requests.post(self.base_url, headers=headers, json=payload, timeout=120)
            
            print(f"🔍 Response Status: {resp.status_code}")
            print(f"📄 Response Headers: {dict(resp.headers)}")
            
            if resp.status_code != 200:
                print(f"❌ Error Response Body: {resp.text}")
                resp.raise_for_status()
            
            data = resp.json()
            print(f"✅ Success! Response keys: {list(data.keys())}")
            content = data["choices"][0]["message"]["content"]
        except requests.exceptions.RequestException as e:
            error_details = f"Status: {getattr(e.response, 'status_code', 'Unknown')}, Response: {getattr(e.response, 'text', 'No response body')}"
            raise Exception(f"API request failed: {e}. Details: {error_details}")
        except Exception as e:
            print(f"❌ Unexpected error: {e}")
            raise
            
        ai_msg = AIMessage(content=content)
        return ChatResult(generations=[ChatGeneration(message=ai_msg)])

    @property
    def _llm_type(self) -> str:
        return "api-key-only-chat"

def clone_repo(state: RepoAnalysisState):
    repo_url = state["repo_url"]
    local_path = state["repo_path"]

    # Check if repository files already exist (cloned by main application)
    if os.path.exists(local_path) and os.listdir(local_path):
        print(f"Repository files already exist at {local_path} (cloned by main application)")
        return state
    
    if os.path.exists(os.path.join(local_path, ".git")):
        print(f"Repository already exists at {local_path}, checking for updates...")

        remote_commit = subprocess.check_output(
            ["git", "ls-remote", repo_url, "HEAD"]
        ).decode().split()[0]

        local_commit = subprocess.check_output(
            ["git", "rev-parse", "HEAD"],
            cwd=local_path
        ).decode().strip()

        if local_commit == remote_commit:
            print("Local repository is already up-to-date with origin.")
        else:
            print("Local repo is outdated, pulling latest changes...")
            subprocess.run(["git", "pull"], cwd=local_path, check=True)
    else:
        print(f"Cloning repository into {local_path}...")
        os.makedirs(local_path, exist_ok=True)
        subprocess.run(["git", "clone", "--depth", "1", repo_url, local_path], check=True)

    return state

def get_updated_state_with_code_chunks(state: RepoAnalysisState) -> RepoAnalysisState:
    repo_path = state["repo_path"]
    chunks = []
    EXCLUDED_EXTENSIONS = (".png", ".jpg", ".exe", ".dll", ".bin")

    max_chunk_size = 4000
    for root, dirs, files in os.walk(repo_path):
        if ".git" in dirs:
            dirs.remove(".git")
        for f in files:
            path = os.path.join(root, f)
            if f.lower().endswith(EXCLUDED_EXTENSIONS):
                continue
            try:
                with open(path, "rb") as test_fp:
                    start = test_fp.read(1024)
                    if b'\0' in start:
                        continue
                with open(path, "r", encoding="utf-8", errors="ignore") as fp:
                    content = fp.read()
                    for i in range(0, len(content), max_chunk_size):
                        chunk = content[i:i+max_chunk_size]
                        chunks.append(f"File: {os.path.relpath(path, repo_path)}\n{chunk}")
            except (IOError, OSError):
                continue

    print(f"📊 Total chunks loaded: {len(chunks)}")
    print(f"🔍 Phase 2: Starting AI-powered analysis...")
    return {**state, "code_chunks": chunks}

def analyze_code(state: RepoAnalysisState):
    llm = ApiKeyOnlyChatModel(
        model_name=state.get('model', DEFAULT_MODEL), 
        base_url=state.get('base_url', DEFAULT_BASE_URL), 
        api_key=state.get('api_key'),
        api_version=state.get('api_version')
    )
    summaries = []
    for chunk in state["code_chunks"]:
        prompt = f"Summarize the purpose and functionality of this code:\n\n{chunk}"
        resp = llm.invoke([HumanMessage(content=prompt)])
        summaries.append(resp.content)

    analysis = "\n\n".join(summaries)
    return {**state, "analysis": analysis}

def scan_for_kafka_usage_ai(state: RepoAnalysisState) -> RepoAnalysisState:
    llm = ApiKeyOnlyChatModel(
        model_name=state.get('model', DEFAULT_MODEL), 
        base_url=state.get('base_url', DEFAULT_BASE_URL), 
        api_key=state.get('api_key'),
        api_version=state.get('api_version')
    )
    inventory: List[Dict[str, Any]] = []
    code_chunks = state["code_chunks"]

    print(f"Scanning {len(code_chunks)} chunks for Kafka usage via AI...")

    for idx, chunk in enumerate(code_chunks):
        prompt = (
            "You are analyzing a .NET Core repository. "
            "Does this code use Kafka (e.g., Confluent.Kafka, Kafka APIs, producers, consumers, topics, partitions)? "
            "If yes, return a JSON object with fields: "
            "{'file': 'relative/path', 'kafka_apis': [...], 'summary': '...'}.\n"
            "If not, return {}.\n\n"
            f"Code chunk:\n{chunk}"
        )
        resp = llm.invoke([HumanMessage(content=prompt)])
        text = getattr(resp, "content", "") or str(resp)

        match = re.search(r"\{.*\}", text, flags=re.S)
        if match:
            try:
                data = json.loads(match.group(0))
                if data and "file" in data:
                    inventory.append(data)
            except Exception:
                pass

        if idx % 20 == 0:
            print(f"Processed {idx}/{len(code_chunks)} chunks")

    print(f"AI-identified Kafka usage in {len(inventory)} files.")
    return {**state, "kafka_inventory": inventory}

# Fallback report generation removed - reports only generated with working AI

def generate_code_diffs(state: RepoAnalysisState) -> RepoAnalysisState:
    llm = ApiKeyOnlyChatModel(
        model_name=state.get('model', DEFAULT_MODEL), 
        base_url=state.get('base_url', DEFAULT_BASE_URL), 
        api_key=state.get('api_key'),
        api_version=state.get('api_version')
    )
    inventory = state.get("kafka_inventory", [])
    repo_path = state["repo_path"]

    diffs = []
    for item in inventory:
        file_rel = item.get("file")
        if not file_rel:
            continue
        file_abs = os.path.join(repo_path, file_rel)

        if not os.path.exists(file_abs):
            continue

        try:
            with open(file_abs, "r", encoding="utf-8", errors="ignore") as fp:
                file_content = fp.read()
        except Exception:
            continue

        prompt = f"""
        You are a .NET Core expert.
        File: {file_rel}

        Original code:
        {file_content}


        Task:
        - Show a unified diff patch (`diff` style) that replaces Kafka usage with Azure.Messaging.ServiceBus.
        - Cover producers, consumers, config, and error handling.
        - Keep namespaces, classes, and non-Kafka code intact.
        - If no Kafka usage is present, return an empty diff.
        """
        resp = llm.invoke([HumanMessage(content=prompt)])
        diffs.append({"file": file_rel, "diff": resp.content})
    
    print(f"Generated diffs for {len(diffs)} files.")

    return {**state, "code_diffs": diffs}

def generate_report_streaming(state: RepoAnalysisState, report_path="migration-report.md"):
    """
    Streaming-style report generator to avoid token limit issues.
    Writes each section to disk incrementally instead of building one huge prompt.
    """

    llm = ApiKeyOnlyChatModel(
        model_name=state.get('model', DEFAULT_MODEL), 
        base_url=state.get('base_url', DEFAULT_BASE_URL), 
        api_key=state.get('api_key')
    )

    with open(report_path, "w", encoding="utf-8") as f:
        # Header
        f.write("# Kafka → Azure Service Bus Migration Report\n\n")

        # 1. Kafka Usage Inventory
        inventory = state.get("kafka_inventory", [])
        f.write("## 1. Kafka Usage Inventory\n\n")
        f.write("| File | APIs Used | Summary |\n")
        f.write("|------|-----------|---------|\n")
        for item in inventory:
            f.write(f"| {item.get('file')} | {', '.join(item.get('kafka_apis', []))} | {item.get('summary', '')} |\n")
        f.write("\n")

        # 2. Code Migration Diffs (all files, no token explosion)
        f.write("## 2. Code Migration Diffs\n\n")
        diffs = state.get("code_diffs", [])
        for diff in diffs:
            file_name = diff.get("file", "").lower()
            file_diff = diff.get("diff", "")

            # Ignore README.md or other excluded files
            if file_name == "readme.md":
                continue

            f.write(f"### {file_name}\n")
            f.write("```diff\n")
            f.write(file_diff.strip() + "\n")
            f.write("```\n\n")


    print(f"✅ Streaming migration report written to {report_path}")

    # Update state with a final message
    return {**state, "messages": state["messages"] + [AIMessage(content=f"Migration report generated at {report_path}.")]}

# Build workflow
graph = StateGraph(RepoAnalysisState)
graph.add_node("clone_repo", clone_repo)
graph.add_node("load_source_code", get_updated_state_with_code_chunks)
graph.add_node("analyze_code", analyze_code)
graph.add_node("scan_for_kafka_usage_ai", scan_for_kafka_usage_ai)
graph.add_node("generate_code_diffs", generate_code_diffs)
graph.add_node("generate_report", generate_report_streaming)

graph.set_entry_point("clone_repo")
graph.add_edge("clone_repo", "load_source_code")
graph.add_edge("load_source_code", "analyze_code")
graph.add_edge("analyze_code", "scan_for_kafka_usage_ai")
graph.add_edge("scan_for_kafka_usage_ai", "generate_code_diffs")
graph.add_edge("generate_code_diffs", "generate_report")
graph.add_edge("generate_report", END)

app = graph.compile()

# Run
def run_analysis(question: str = "Provide a summary of the repository and its Kafka usage."):
    initial_state: RepoAnalysisState = {
        "repo_url": "https://github.com/srigumm/dotnetcore-kafka-integration",
        "repo_path": "./cloned_repo",
        "code_chunks": [],
        "analysis": "",
        "kafka_inventory": [],
        "code_diffs": [],
        "messages": [HumanMessage(content=question)],
        "model": DEFAULT_MODEL,
        "api_version": DEFAULT_API_VERSION,
        "base_url": DEFAULT_BASE_URL,
        "api_key": "",
    }
    result = app.invoke(initial_state)
    print("\nAI Proxy Response:\n", result["messages"][-1].content)

# Main execution with proper argument parsing
if __name__ == "__main__":
    import time
    args = parse_args()
    
    # Generate unique report filename
    analysis_id = str(int(time.time() * 1000))
    report_filename = f"migration-report-{analysis_id}.md"
    report_path = os.path.join(args.repo_path, report_filename)
    
    print(f"🚀 Starting migration analysis...")
    print(f"📁 Repository URL: {args.repo_url}")
    print(f"📂 Repository Path: {args.repo_path}")
    print(f"🤖 Using Model: {args.model}")
    print(f"🔧 Using API Version: {args.api_version}")
    print(f"🌐 Using Endpoint: {args.base_url}")
    print(f"📊 Phase 1: Repository validation and code loading...")
    
    report_generated = False
    analysis_type = "Static Analysis"
    
    # Try AI analysis if we have credentials
    if args.api_key and args.base_url:
        try:
            print("🤖 Attempting AI analysis...")
            result = app.invoke({
                "repo_url": args.repo_url,
                "repo_path": args.repo_path,
                "code_chunks": [],
                "analysis": "",
                "kafka_inventory": [],
                "code_diffs": [],
                "messages": [HumanMessage(content="Analyze this repository for Kafka usage and generate migration report.")],
                # AI configuration from command-line arguments
                "model": args.model,
                "api_version": args.api_version,
                "base_url": args.base_url,
                "api_key": args.api_key
            })
            
            print("\n✅ AI Migration analysis completed!")
            print(f"📄 REPORT_GENERATED: {report_filename}")
            analysis_type = "AI Analysis"
            report_generated = True
        
        except Exception as e:
            print(f"\n❌ AI Analysis failed: {str(e)}")
            print("🔄 Falling back to static analysis...")
    else:
        print("⚠️ No AI credentials provided, using static analysis")
    
    # Only generate report if AI succeeded - no fallbacks
    if report_generated:
        print(f"✅ Analysis complete - Report available: {report_filename}")
        sys.exit(0)
    else:
        print("❌ No AI credentials provided or AI analysis failed - no report generated")
        print("💡 Configure AI settings in the application to generate reports")
        sys.exit(1)