"""
Orbital PDF Converter - Launcher
Starts the local server and opens the browser interface.
"""

import os
import sys
import time
import webbrowser
import threading
import uvicorn

def open_browser(port):
    time.sleep(1.2)
    url = f"http://127.0.0.1:{port}"
    print(f"\n[INFO] Opening Orbital PDF Converter in your default browser: {url}")
    try:
        webbrowser.open(url)
    except Exception as e:
        print(f"[WARN] Could not auto-open browser: {e}")

def main():
    port = int(os.environ.get("PORT", 8000))
    host = os.environ.get("HOST", "127.0.0.1")
    is_cloud = os.environ.get("PORT") is not None or host == "0.0.0.0"

    print("=" * 60)
    print("           ORBITAL PDF - RADIAL DRAG & DROP CONVERTER           ")
    print("=" * 60)
    print(" [+] Local & Private (Zero cloud uploads)")
    print(" [+] Drag & Drop into 7 Radial Formats: DOCX, XLSX, PNG, TXT, MD, HTML, ALL")
    print(" [+] Auto-download & Live Preview enabled")
    print("-" * 60)
    print(f" Starting server on: http://{host}:{port}")
    print(" Press Ctrl+C in this window anytime to stop the server.")
    print("=" * 60)

    # Launch browser only in local mode (not in headless cloud container)
    if not is_cloud:
        threading.Thread(target=open_browser, args=(port,), daemon=True).start()

    # Start Uvicorn server
    uvicorn.run(
        "app.server:app",
        host=host,
        port=port,
        log_level="info",
        reload=False
    )

if __name__ == "__main__":
    main()
