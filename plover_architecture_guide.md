# Plover Architecture & Animation Guide

This guide details the front-end design flow of the **How it Works** section, the backend systems required to build a functional version of Plover, and the exact files containing the website animations.

---

## 1. Front-End Flow of the "How It Works" Section

The section (found in [HowItWorks.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/HowItWorks.jsx)) guides a user through 4 key steps of using the Plover desktop application:

1. **Name your task (Step 1)**
   * **UI Description**: The user enters their goal and specifies the frequency.
   * **Animation Flow** ([PloverTaskDemo.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/PloverTaskDemo.jsx)): An overlay panel appears representing the desktop client. A macOS-style cursor enters, clicks into the text input, types *"Finish the methodology section of my thesis"*, clicks the `"One-off"` frequency pill, and then clicks the `"Break into steps →"` button.

2. **AI breaks it down (Step 2)**
   * **UI Description**: The AI decomposes the vague task into concrete checkable items. The user can add, edit, or remove these suggestions.
   * **Animation Flow** ([PloverTaskDemoStep2.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/PloverTaskDemoStep2.jsx)): The window expands vertically. Under the message *"Gemini suggested 5 steps — edit freely"*, five steps appear. The cursor moves to scroll the list, clicks `"+ Add a step"`, selects the new text input, types a 6th step (*"Format bibliography"*), and clicks `"Looks right →"`.

3. **Select your workflow (Step 3)**
   * **UI Description**: The user connects specific applications or active windows (e.g., Notion, Google Docs, browser tabs, or PDFs) for Plover to monitor.
   * **Animation Flow** ([PloverTaskDemoStep3.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/PloverTaskDemoStep3.jsx)): The UI displays *"Which window should I watch?"*. It lists active documents like *"Google Docs — Thesis draft"* and *"Notion — Research notes"*. The cursor selects the `"Watch"` button next to both, changing them to green checkmarks, then clicks `"Start tracking →"`.

4. **Watch it fill (Step 4)**
   * **UI Description**: Plover sits at the top of the user's screen as a translucent bar, filling up automatically as progress is detected in the monitored applications. It can be paused, resumed, or completed.
   * **Animation Flow** ([PloverTaskDemoStep4.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/PloverTaskDemoStep4.jsx)): The panel collapses into a compact floating widget. The progress indicator shows `observing` and begins filling from `0%` to `65%`. It transitions to `paused` state when the user is inactive. The cursor appears, clicks `"Resume"`, the bar resumes filling from `65%` to `100%`, and displays `Done` when finished.

---

## 2. Backend Mechanisms Required to Function

To build the actual Plover desktop app as described above, your development environment will need the following backend and OS-level components:

### A. Desktop Overlay & Window Management
* **Framework**: Tauri (Rust + React) or Electron. Tauri is recommended for lighter system resource footprints.
* **Overlay Window**: An borderless, frameless, transparent viewport window (`transparent: true`, `frame: false`, `alwaysOnTop: true`) positioned at the top of the screen. It should toggle click-through behaviors so it does not block OS mouse clicks when the user works beneath it.

### B. Active Window & Content Tracking (OS Integration)
* **API Hooks**:
  * **macOS**: Queries window names and browser URLs via AppleScript or the Accessibility API (`AXUIElement`).
  * **Windows**: Queries foreground window details using Win32 API calls (`GetForegroundWindow`, `GetWindowText`, and UI Automation Framework).
* **Workspace Monitoring**: The backend filters updates to only monitor the process ID, window title, or browser URL matching the user's chosen "watched windows" (e.g. Google Docs Chrome tab).

### C. LLM Planning & Task Decomposition (Backend API)
* **Task Generator**: When a task is submitted, the backend sends the input string to an LLM (e.g., Gemini 1.5 Flash) requesting a JSON structured list of 5-8 sub-tasks.
* **System Prompt**: *"Decompose the task '[USER_TASK]' into chronological, verifiable document-editing steps. Return only JSON format."*

### D. AI Progress Evaluation Engine (State Diffing)
* **Snapshotting**: Every 10–30 seconds, read the visible text content of the active watched window (either via accessibility tree text harvesting, files system watchers if local, or Google Docs/Notion API integrations).
* **Evaluation Cycle**: Pass the task list, the prior document state, and the newly captured document state to the LLM:
  * *"Given the previous document text and the new document text, evaluate which of the task steps have been completed. Return the updated checklist state and progress percentage."*
* **Progress Bar State**: Save the updated percentage locally (SQLite or local JSON store) and push it to the overlay bar UI.

---

## 3. Website Animation & Layout Files

If you want your IDE to parse and replicate the exact visual styles, easing curves, and timings of the current website animations, refer to these files:

* [HowItWorks.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/HowItWorks.jsx): The main section grid coordinating the scrolling offsets and triggers for each step demo.
* [PloverTaskDemo.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/PloverTaskDemo.jsx): Step 1 animation. Uses custom `requestAnimationFrame` tickers, cubic easing calculations, custom scale variables, and SVG cursor positioning.
* [PloverTaskDemoStep2.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/PloverTaskDemoStep2.jsx): Step 2 animation. Includes dynamic panel expanding heights, hover cursors, and custom text-typing delay offsets.
* [PloverTaskDemoStep3.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/PloverTaskDemoStep3.jsx): Step 3 animation. Features Google Docs/Notion watch card click transitions, viewport zoom calculations, and ripple elements.
* [PloverTaskDemoStep4.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/PloverTaskDemoStep4.jsx): Step 4 animation. Handles the linear interpolation of percentages, status string transitions (`observing` -> `paused` -> `complete`), and play/pause icon logic.
* [HeroVisual.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/HeroVisual.jsx): Contains the landing page hero's mockup demonstration (writing a document in real-time alongside a floating translucent widget widget tracking progress).
* [Motion.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/shared/Motion.jsx): General utility transitions, element visibility bounds checkers (`useInView`), and scroll tracker hooks.
* [Hero.jsx](file:///c:/Users/hhl_c/Documents/GitHub/plover-website/src/components/landing/Hero.jsx): Utilizes `framer-motion` libraries for initial text fade-ins and button slide transitions.
