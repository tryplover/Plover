# Autonomous PR Agent (Built with Google Antigravity SDK)

This repository houses an autonomous coding agent designed to run continuously in the background, sweep target codebases for fixes/features, run verification tests, and automatically open Pull Requests on GitHub.

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

### 3. Start the Agent Runner
Run the agent:
```bash
python agent_runner.py
```
The agent will run continuously, polling/triggering according to the interval specified in `agent_runner.py`.

---

## How to Start a New Chat Session in this Project
To interact with the coding assistant specifically for this agent:
1. Open the `/Users/liyuxiao/Documents/GitHub/BuildWithGeminiHackathon/autonomous-pr-agent` folder directly in your IDE (VS Code, Cursor, etc.).
2. Open the Gemini/Antigravity chat panel.
3. Start typing your prompts there. The agent will have access to the agent's context and configuration.
