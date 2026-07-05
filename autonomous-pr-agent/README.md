# Autonomous PR Agent (Built with Google Antigravity SDK)

This repository houses an autonomous coding agent that sweeps a target codebase for fixes/features and files GitHub issues describing them. **Google Jules** then picks up those issues (via the `jules` label) and opens the resolving PRs.

## Architecture

- **Issue Finder (`issue_finder.py`)** — runs continuously, sweeps the target repo, and files GitHub issues formatted as Jules-executable task specs (Context / Files / Desired behavior / Verification / Out of scope). Every issue is labeled `jules` by default (override with `JULES_LABEL` env var).
- **Resolver** — handled by **[Google Jules](https://jules.google)**, which watches for `jules`-labeled issues, spins up a Cloud VM, runs the change, and opens the PR. This replaces the old `agent_runner.py` resolver, which is deprecated.

**Why the split:** issue finding is cheap (one Gemini pass per sweep, no code execution). PR resolution is expensive (VM, multi-file edits, test runs) — Jules gives us a sandboxed executor with 15 free tasks/day and no polling loop to babysit.

### Deprecated: `agent_runner.py`

Kept in the tree only for reference / fallback if Jules quota runs out. Do not run it in production. All new work goes through the Issue Finder → Jules pipeline.

---

## Getting Started

### 1. Create a New GitHub Repository
To save this agent code to its own repository:
1. Go to [GitHub - New Repository](https://github.com/new).
2. Create a repository named `autonomous-pr-agent` (keep it private if you wish).
3. Do **not** initialize it with a README, `.gitignore`, or License.

### 2. Push this Local Code to Your New Repository
Run the following commands in your terminal to initialize and push this local folder:
```bash
# Navigate to the agent's folder
cd /Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/autonomous-pr-agent

# Initialize a new git repository
git init
git add .
git commit -m "Initial commit of autonomous agent boilerplate"
git branch -M main

# Link to your new repository and push (replace OWNER with your GitHub username)
git remote add origin https://github.com/OWNER/autonomous-pr-agent.git
git push -u origin main
```

---

## Setup & Running

### 1. Install Dependencies
Make sure you have python 3.10+ installed. It is highly recommended to run in a virtual environment:
```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 2. Configuration
Copy the `.env.example` file to `.env`:
```bash
cp .env.example .env
```
Fill in the environment variables:
* `GEMINI_API_KEY`: Your Gemini API Key from [Google AI Studio](https://aistudio.google.com/app/api-keys).
* `GITHUB_TOKEN`: A GitHub Personal Access Token (classic or fine-grained) with read & write repository permissions.
* `TARGET_REPO`: The repository path you want the agent to monitor (e.g. `OWNER/REPO`).

### 3. Enable Jules on the target repo

1. Sign in at [jules.google](https://jules.google) and connect it to `TARGET_REPO`.
2. Confirm Jules is configured to watch the label used by the Issue Finder — `jules` by default, or whatever `JULES_LABEL` is set to in `.env`.

### 4. Start the Issue Finder

```bash
python issue_finder.py
```
It runs continuously, sweeping the target repo on the configured interval and filing Jules-labeled issues. Jules picks them up asynchronously and opens PRs — nothing else to run locally.

> **Deprecated:** `python agent_runner.py` still exists but should not be used. Jules replaces it.

---

## How to Start a New Chat Session in this Project
To interact with the coding assistant specifically for this agent:
1. Open the `/Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/autonomous-pr-agent` folder directly in your IDE (VS Code, Cursor, etc.).
2. Open the Gemini/Antigravity chat panel.
3. Start typing your prompts there. The agent will have access to the agent's context and configuration.
