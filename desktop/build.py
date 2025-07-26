#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple build script for Easy-BabelDOC desktop app
"""

import subprocess
import sys
from pathlib import Path

def main():
    """Build the desktop application"""
    print("Building Easy-BabelDOC desktop app...")
    
    # Check prerequisites
    if not Path("dist/index.html").exists():
        print("Error: Frontend not built. Run 'npm run build' first.")
        return False
    
    if not Path("backend/main.py").exists():
        print("Error: Backend files not found.")
        return False
    
    # Build with PyInstaller
    cmd = [
        sys.executable, "-m", "PyInstaller",
        "--onefile",
        "--noconsole", 
        "--name", "Easy-BabelDOC",
        "--add-data", "dist;dist",
        "--add-data", "backend;backend",
        "--hidden-import", "fastapi",
        "--hidden-import", "fastapi.routing",
        "--hidden-import", "fastapi.middleware",
        "--hidden-import", "fastapi.middleware.cors",
        "--hidden-import", "fastapi.staticfiles",
        "--hidden-import", "fastapi.responses",
        "--hidden-import", "uvicorn",
        "--hidden-import", "uvicorn.lifespan.on",
        "--hidden-import", "uvicorn.protocols.websockets.auto", 
        "--hidden-import", "uvicorn.protocols.http.auto",
        "--hidden-import", "uvicorn.loops.auto",
        "--hidden-import", "pydantic",
        "--hidden-import", "aiofiles",
        "--hidden-import", "websockets",
        "--hidden-import", "multipart",
        "--hidden-import", "webview",
        "desktop/main.py"
    ]
    
    try:
        subprocess.run(cmd, check=True)
        print("\nBuild completed successfully!")
        print("Output: dist/Easy-BabelDOC.exe")
        return True
    except subprocess.CalledProcessError as e:
        print(f"Build failed: {e}")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)