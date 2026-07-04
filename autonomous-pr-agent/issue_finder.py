import os
import logging
import asyncio
import tempfile
from pathlib import Path
from dotenv import load_dotenv
from github import Github

# Load environment variables
load_dotenv()

# Configure Logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("issue_finder.log")
    ]
)

# Import Antigravity SDK
try:
    from google.antigravity import Agent, LocalAgentConfig
    from google.antigravity.triggers import every, TriggerContext
    from google.antigravity.hooks import policy
except ImportError:
    logging.error("Google Antigravity SDK is not installed. Please run: pip install -r requirements.txt")
    raise

# Ensure credentials exist
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
TARGET_REPO = os.getenv("TARGET_REPO")
TARGET_BRANCH = os.getenv("TARGET_BRANCH", "main")

if not GEMINI_API_KEY:
    logging.warning("GEMINI_API_KEY is not set in environment or .env file.")
if not GITHUB_TOKEN:
    logging.warning("GITHUB_TOKEN is not set in environment or .env file.")
if not TARGET_REPO:
    logging.warning("TARGET_REPO is not set (e.g. owner/repo).")

# =============================================================================
# 1. Custom Tools for GitHub Issue Scanning & Posting
# =============================================================================

def clone_and_read_repository() -> str:
    """Clones the target repository to a temporary workspace for read-only inspection.
    
    Returns:
        The absolute path to the local directory containing the cloned repository.
    """
    if not TARGET_REPO or not GITHUB_TOKEN:
        raise ValueError("TARGET_REPO and GITHUB_TOKEN environment variables must be set.")
        
    # Create a unique directory in the temporary files system
    temp_dir = tempfile.mkdtemp(prefix="agent_inspect_")
    
    # Construct git clone URL with token
    clone_url = f"https://x-access-token:{GITHUB_TOKEN}@github.com/{TARGET_REPO}.git"
    
    logging.info(f"Cloning {TARGET_REPO} for inspection into {temp_dir}...")
    
    # Run cloning commands (fetch only main branch, depth 1 to save space/time)
    os.system(f"git clone --depth 1 --branch {TARGET_BRANCH} {clone_url} {temp_dir}")
    
    return temp_dir

def list_github_issues() -> list:
    """Lists all open issues in the target GitHub repository.
    
    Returns:
        A list of dictionaries, each containing 'number', 'title', and 'body' of an open issue.
    """
    if not TARGET_REPO or not GITHUB_TOKEN:
        raise ValueError("TARGET_REPO and GITHUB_TOKEN must be set.")
        
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(TARGET_REPO)
    issues = repo.get_issues(state="open")
    
    return [{"number": i.number, "title": i.title, "body": i.body} for i in issues]

def create_github_issue(title: str, body: str) -> str:
    """Creates a new issue in the target GitHub repository.
    
    Args:
        title: The title of the issue.
        body: The detailed description of the issue.
        
    Returns:
        A success message with the issue URL, or an error description.
    """
    if not TARGET_REPO or not GITHUB_TOKEN:
        raise ValueError("TARGET_REPO and GITHUB_TOKEN must be set.")
        
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(TARGET_REPO)
    try:
        issue = repo.create_issue(title=title, body=body)
        logging.info(f"Successfully created issue #{issue.number}: {issue.html_url}")
        return f"Successfully created Issue: {issue.html_url}"
    except Exception as e:
        logging.error(f"Failed to create issue: {e}")
        return f"Failed to create Issue: {e}"

# =============================================================================
# 2. Periodic Agent Trigger
# =============================================================================

async def find_issues_workflow(ctx: TriggerContext):
    """Trigger function that runs periodically to initiate the issue scanning workflow."""
    logging.info("TRIGGER: Autonomous issue finder check started.")
    
    prompt = (
        "Task: Perform an autonomous codebase sweep to find new issues/improvements.\n"
        "1. Call `clone_and_read_repository` to get a local workspace containing the codebase.\n"
        "2. Retrieve the list of currently open issues using `list_github_issues`.\n"
        "3. Read the codebase, analyze the code structure, check for potential bugs, poor patterns, missing tests, or missing comments/documentation.\n"
        "4. If you find a new issue, improvement, or optimization opportunity that is not already reported in the open issues list, open a new GitHub issue using `create_github_issue`.\n"
        "5. Keep issues constructive and highly detailed: name the affected files and lines, describe the problem, and suggest a proposed fix.\n"
        "6. Do not create duplicate issues. If you find nothing new or if all issues are already logged, stop."
    )
    
    await ctx.send(prompt)

# Set up periodic trigger (runs every 3600 seconds / 1 hour)
agent_trigger = every(3600, find_issues_workflow)

# =============================================================================
# 3. Agent Execution Setup
# =============================================================================

system_prompt = (
    "You are Antigravity Issue Finder, an autonomous AI agent designed to monitor a target codebase, "
    "identify bugs, design gaps, security issues, missing documentation, or code quality improvements, "
    "and log them as GitHub issues.\n\n"
    "Guidelines:\n"
    "1. Always check out a copy of the repository using `clone_and_read_repository` to inspect files.\n"
    "2. Before opening a new issue, search existing open issues using `list_github_issues` to ensure it is not a duplicate.\n"
    "3. Log constructive, clear, and actionable issues. Each issue should describe: the problem, the specific files/lines affected, and a proposed solution.\n"
    "4. Find at most 1-2 high-quality issues per trigger run. Do not flood the issue tracker."
)

config = LocalAgentConfig(
    system_instructions=system_prompt,
    tools=[clone_and_read_repository, list_github_issues, create_github_issue],
    triggers=[agent_trigger],
    policies=[
        policy.allow_all(),  # Allows reading files and running inspect commands autonomously
    ]
)

async def main():
    logging.info("Starting autonomous Issue Finder agent...")
    async with Agent(config) as agent:
        # Keep the process alive so triggers continue to fire in the background
        while True:
            await asyncio.sleep(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Agent execution terminated by user.")
