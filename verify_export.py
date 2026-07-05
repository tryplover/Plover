from playwright.sync_api import sync_playwright
import os

def run_cuj(page):
    # Navigate to the app (assuming it's running on localhost:5173 for dev)
    # The app uses electron-vite, usually it's 5173 or similar.
    # However, I don't have the dev server running yet.
    # I'll check package.json to see the dev command.
    page.goto("http://localhost:5173")
    page.wait_for_timeout(2000)

    # Navigate to Settings
    # Based on other parts of the app, there might be a sidebar or similar.
    # Looking at the code, Settings is likely at /settings or reachable via a link.
    # I'll try to find a link or button to Settings.
    try:
        page.get_by_role("link", { "name": "Settings" }).click()
    except:
        # Fallback if no link, maybe it's already there or we can go directly
        page.goto("http://localhost:5173/#/settings")

    page.wait_for_timeout(1000)

    # Verify "Data portability" section exists
    page.get_by_role("heading", name="Data portability").scroll_into_view_if_needed()
    page.wait_for_timeout(500)

    # Click "Export my data"
    # Note: dialog.showSaveDialog will likely hang in a headless environment if not mocked
    # But since we are just verifying the UI, we can at least see the button.
    # In a real Electron environment, Playwright might have issues with native dialogs.
    export_btn = page.get_by_role("button", name="Export my data")
    export_btn.click()
    page.wait_for_timeout(1000)

    # Take screenshot
    page.screenshot(path="/home/jules/verification/screenshots/settings_export.png")
    page.wait_for_timeout(1000)

if __name__ == "__main__":
    os.makedirs("/home/jules/verification/screenshots", exist_ok=True)
    os.makedirs("/home/jules/verification/videos", exist_ok=True)
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(
            record_video_dir="/home/jules/verification/videos"
        )
        page = context.new_page()
        try:
            # I need to start the dev server first, but the instructions say
            # "Execute this command. You may need to run it as a background process"
            # I'll try to run it in a separate bash session or before this script.
            run_cuj(page)
        except Exception as e:
            print(f"Error during CUJ: {e}")
            page.screenshot(path="/home/jules/verification/screenshots/error.png")
        finally:
            context.close()
            browser.close()
