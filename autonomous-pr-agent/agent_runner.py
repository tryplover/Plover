import os
import logging
import asyncio
import tempfile
import shutil
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
        logging.FileHandler("agent.log")
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
# 1. Custom Tools for Git & GitHub Operations
# =============================================================================

def checkout_repository(branch_name: str) -> str:
    """Clones the target repository and checks out a new feature branch for modifications.
    
    Args:
        branch_name: The name of the new branch to create, e.g. "fix-issue-123".
        
    Returns:
        The absolute path to the local directory containing the cloned repository.
    """
    if not TARGET_REPO or not GITHUB_TOKEN:
        raise ValueError("TARGET_REPO and GITHUB_TOKEN environment variables must be set.")
        
    # Create a unique directory in the temporary files system
    temp_dir = tempfile.mkdtemp(prefix="agent_workspace_")
    
    # Construct git clone URL with token
    clone_url = f"https://x-access-token:{GITHUB_TOKEN}@github.com/{TARGET_REPO}.git"
    
    logging.info(f"Cloning {TARGET_REPO} into {temp_dir}...")
    
    # Run cloning commands
    os.system(f"git clone --depth 1 --branch {TARGET_BRANCH} {clone_url} {temp_dir}")
    os.system(f"git -C {temp_dir} checkout -b {branch_name}")
    
    return temp_dir

def submit_pull_request(workspace_path: str, branch_name: str, commit_message: str, pr_title: str, pr_body: str) -> str:
    """Commits local workspace changes, pushes them to GitHub, and creates a Pull Request.
    
    Args:
        workspace_path: The absolute path of the local repository workspace.
        branch_name: The branch name containing the changes.
        commit_message: The git commit message.
        pr_title: The title of the GitHub Pull Request.
        pr_body: The description of the Pull Request.
        
    Returns:
        A success message with the PR URL, or an error description.
    """
    if not TARGET_REPO or not GITHUB_TOKEN:
        raise ValueError("TARGET_REPO and GITHUB_TOKEN environment variables must be set.")
        
    p = Path(workspace_path)
    if not p.exists():
        return f"Error: Workspace path {workspace_path} does not exist."
        
    # Configure git local credentials
    os.system(f"git -C {workspace_path} config user.name 'Antigravity Autonomous Agent'")
    os.system(f"git -C {workspace_path} config user.email 'agent@antigravity.ai'")
    
    # Stage all changes
    os.system(f"git -C {workspace_path} add .")
    
    # Check if there are changes to commit
    status = os.popen(f"git -C {workspace_path} status --porcelain").read().strip()
    if not status:
        return "No changes detected in workspace. Nothing to commit."
        
    # Commit and push
    os.system(f"git -C {workspace_path} commit -m '{commit_message}'")
    os.system(f"git -C {workspace_path} push origin {branch_name}")
    
    # Create PR via GitHub API
    g = Github(GITHUB_TOKEN)
    repo = g.get_repo(TARGET_REPO)
    try:
        pr = repo.create_pull_request(
            title=pr_title,
            body=pr_body,
            head=branch_name,
            base=TARGET_BRANCH
        )
        logging.info(f"Successfully created PR #{pr.number}: {pr.html_url}")
        return f"Successfully created Pull Request: {pr.html_url}"
    except Exception as e:
        logging.error(f"Failed to create PR: {e}")
        return f"Failed to create Pull Request. Git branch was pushed, but API call failed: {e}"
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

# =============================================================================
# 2. Periodic Agent Trigger
# =============================================================================

async def check_issues_and_resolve(ctx: TriggerContext):
    """Trigger function that runs periodically to initiate the issue resolution workflow."""
    logging.info("TRIGGER: Autonomous PR agent check started.")
    
    prompt = (
        "Task: Check open GitHub issues and resolve one.\n"
        "1. Call `list_github_issues` to retrieve the list of currently open issues.\n"
        "2. If there are no open issues, log a message and stop.\n"
        "3. Select one open issue to work on.\n"
        "4. Call `checkout_repository` with a descriptive branch name like `resolve-issue-<num>`.\n"
        "5. Read the codebase in the workspace and implement a clean fix to resolve the selected issue.\n"
        "6. Run tests or validation commands (e.g. npm test, pnpm test, compile checks) to verify correctness using `run_command` in the workspace folder.\n"
        "7. If verification passes, call `submit_pull_request` to commit, push, and open a PR.\n"
        "8. In the PR body, make sure to include 'Closes #<issue_number>' or 'Fixes #<issue_number>' so GitHub closes it automatically upon merging.\n"
        "9. If tests fail or you cannot easily solve it, clean up and stop."
    )
    
    await ctx.send(prompt)

# Set up periodic trigger (runs every 3600 seconds / 1 hour)
agent_trigger = every(3600, check_issues_and_resolve)

# =============================================================================
# 3. Agent Execution Setup
# =============================================================================

system_prompt = (
    "You are Antigravity PR Agent, an autonomous coding agent designed to resolve open GitHub issues. "
    "Your goal is to inspect open issues in the target repository, implement robust fixes, run verification tests, "
    "and submit Pull Requests that automatically close the issues.\n\n"
    "Guidelines:\n"
    "1. Retrieve open issues using `list_github_issues` to find a task to work on.\n"
    "2. Always check out a workspace branch first using `checkout_repository` with a name related to the issue (e.g., `resolve-issue-12`).\n"
    "3. Apply your modifications inside the workspace to resolve the selected issue.\n"
    "4. Run validation/test commands to verify correctness of your changes.\n"
    "5. Submit a pull request using `submit_pull_request` with a title and body that clearly mentions 'Closes #<issue_number>' or 'Fixes #<issue_number>' so GitHub closes it automatically upon merging."
)

config = LocalAgentConfig(
    system_instructions=system_prompt,
    tools=[checkout_repository, list_github_issues, submit_pull_request],
    triggers=[agent_trigger],
    policies=[
        policy.allow_all(),  # Allows file writes and run_command autonomously
    ]
)

async def main():
    logging.info("Starting autonomous PR agent...")
    async with Agent(config) as agent:
        # Keep the process alive so triggers continue to fire in the background
        while True:
            await asyncio.sleep(1)

if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logging.info("Agent execution terminated by user.")
