#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
简化的桌面应用主程序
"""

import webview
import threading
import time
import socket
import sys
import os
from pathlib import Path
import uvicorn
import asyncio

# 检测运行环境并设置正确的backend路径
if getattr(sys, 'frozen', False):
    # 运行在PyInstaller打包的exe中
    backend_path = str(Path(sys._MEIPASS) / "backend")
else:
    # 开发环境
    backend_path = str(Path(__file__).parent.parent / "backend")

sys.path.insert(0, backend_path)

# 导入FastAPI应用
import importlib.util
backend_main_path = Path(backend_path) / "main.py"
spec = importlib.util.spec_from_file_location("backend_main", backend_main_path)
backend_main = importlib.util.module_from_spec(spec)
spec.loader.exec_module(backend_main)
app = backend_main.app

def find_free_port(start_port=8000):
    """找到可用端口"""
    for port in range(start_port, start_port + 100):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.bind(('127.0.0.1', port))
                return port
        except OSError:
            continue
    raise RuntimeError("找不到可用端口")

def run_server(port):
    """运行服务器"""
    config = uvicorn.Config(app=app, host="127.0.0.1", port=port, log_level="error")
    server = uvicorn.Server(config)
    
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    loop.run_until_complete(server.serve())

def wait_for_server(port, timeout=10):
    """等待服务器启动"""
    for _ in range(timeout * 2):
        try:
            with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
                s.settimeout(1)
                if s.connect_ex(('127.0.0.1', port)) == 0:
                    return True
        except:
            pass
        time.sleep(0.5)
    return False

def main():
    """主函数"""
    try:
        # 找到可用端口
        port = find_free_port()
        print(f"使用端口: {port}")
        
        # 启动服务器
        server_thread = threading.Thread(target=run_server, args=(port,), daemon=True)
        server_thread.start()
        
        # 等待服务器启动
        if not wait_for_server(port):
            raise RuntimeError("服务器启动失败")
        
        # 创建窗口
        webview.create_window(
            title="Easy-BabelDOC",
            url=f"http://127.0.0.1:{port}",
            width=1200,
            height=800,
            min_size=(800, 600)
        )
        
        # 启动应用
        webview.start(debug=False)
        
    except Exception as e:
        print(f"启动失败: {e}")
        input("按回车键退出...")

if __name__ == "__main__":
    main()