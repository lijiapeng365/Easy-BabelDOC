#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Easy-BabelDOC - 基于BabelDOC API的Web翻译应用
Copyright (C) 2024 lijiapeng365

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

Based on BabelDOC: https://github.com/funstory-ai/BabelDOC
Source code: https://github.com/lijiapeng365/Easy-BabelDOC
"""

from fastapi import FastAPI, File, UploadFile, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
import os
import json
import uuid
import asyncio
from pathlib import Path
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import aiofiles
from datetime import datetime

# 导入BabelDOC相关模块
try:
    import babeldoc.format.pdf.high_level as high_level
    from babeldoc.format.pdf.translation_config import TranslationConfig
    from babeldoc.translator.translator import OpenAITranslator
    from babeldoc.docvision.doclayout import DocLayoutModel
    from babeldoc.glossary import Glossary
except ImportError:
    print("Warning: BabelDOC not installed. Some features will not work.")
    # 创建模拟类用于开发
    class MockTranslationConfig:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)
    
    class MockTranslator:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)
    
    class MockDocLayoutModel:
        @staticmethod
        def load_onnx():
            return MockDocLayoutModel()
    
    class MockGlossary:
        @staticmethod
        def from_csv(file_path, target_lang):
            return MockGlossary()
    
    TranslationConfig = MockTranslationConfig
    OpenAITranslator = MockTranslator
    DocLayoutModel = MockDocLayoutModel
    Glossary = MockGlossary
    
    class MockHighLevel:
        @staticmethod
        def init():
            pass
        
        @staticmethod
        def translate(config):
            return {"mono_pdf_path": "mock.pdf", "dual_pdf_path": "mock_dual.pdf"}
        
        @staticmethod
        async def async_translate(config):
            for i in range(101):
                yield {
                    "type": "progress_update",
                    "overall_progress": i,
                    "stage": "翻译中",
                    "message": f"进度 {i}%"
                }
                await asyncio.sleep(0.1)
            yield {
                "type": "finish",
                "translate_result": {
                    "mono_pdf_path": "mock.pdf",
                    "dual_pdf_path": "mock_dual.pdf",
                    "total_seconds": 10.5,
                    "peak_memory_usage": 256
                }
            }
    
    high_level = MockHighLevel()

app = FastAPI(title="BabelDOC API", version="1.0.0")

# CORS配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 创建必要的目录
UPLOADS_DIR = Path("uploads")
OUTPUTS_DIR = Path("outputs")
GLOSSARIES_DIR = Path("glossaries")

for dir_path in [UPLOADS_DIR, OUTPUTS_DIR, GLOSSARIES_DIR]:
    dir_path.mkdir(exist_ok=True)

# 数据模型
class TranslationRequest(BaseModel):
    file_id: str
    lang_in: str
    lang_out: str
    model: str = "gpt-4o-mini"
    api_key: str
    base_url: Optional[str] = None
    pages: Optional[str] = None
    qps: Optional[int] = 1
    no_dual: bool = False
    no_mono: bool = False
    debug: bool = False
    glossary_ids: List[str] = []

class TranslatorConfig(BaseModel):
    api_key: str
    model: str = "gpt-4o-mini"
    base_url: Optional[str] = None
    qps: int = 1

class GlossaryInfo(BaseModel):
    id: str
    name: str
    target_lang: str
    created_at: str
    entry_count: int

# 全局变量
active_translations: Dict[str, Dict] = {}
connected_clients: Dict[str, WebSocket] = {}

# 历史记录文件路径
HISTORY_FILE = Path("translation_history.json")

# 加载历史记录
def load_history() -> List[Dict]:
    """从文件加载翻译历史"""
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, 'r', encoding='utf-8') as f:
                return json.load(f)
        except:
            return []
    return []

# 保存历史记录
def convert_paths_to_strings(obj):
    """递归地将所有Path对象转换为字符串"""
    if isinstance(obj, Path):
        return str(obj)
    elif isinstance(obj, dict):
        return {key: convert_paths_to_strings(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_paths_to_strings(item) for item in obj]
    elif isinstance(obj, tuple):
        return tuple(convert_paths_to_strings(item) for item in obj)
    elif isinstance(obj, set):
        return {convert_paths_to_strings(item) for item in obj}
    else:
        return obj

def save_history(history):
    """保存历史记录到文件"""
    try:
        # 在保存前转换所有Path对象为字符串
        clean_history = convert_paths_to_strings(history)
        print(f"准备保存历史记录，共 {len(clean_history)} 条")
        
        with open(HISTORY_FILE, 'w', encoding='utf-8') as f:
            json.dump(clean_history, f, ensure_ascii=False, indent=2)
        print("历史记录保存成功")
    except Exception as e:
        print(f"保存历史记录失败: {e}")
        import traceback
        traceback.print_exc()

# 添加历史记录
def add_to_history(task_data: Dict):
    """添加任务到历史记录"""
    history = load_history()
    # 检查是否已存在
    for i, item in enumerate(history):
        if item.get('task_id') == task_data.get('task_id'):
            history[i] = task_data
            save_history(history)
            return
    # 新增记录
    history.append(task_data)
    save_history(history)

# 初始化BabelDOC
try:
    high_level.init()
except:
    print("BabelDOC initialization skipped (development mode)")

# 原来的根路由已被前端路由替代

@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    """上传PDF文件"""
    if not file.filename.endswith('.pdf'):
        raise HTTPException(status_code=400, detail="只支持PDF文件")
    
    file_id = str(uuid.uuid4())
    file_path = UPLOADS_DIR / f"{file_id}.pdf"
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # 获取文件信息
    file_size = len(content)
    
    return {
        "file_id": file_id,
        "filename": file.filename,
        "size": file_size,
        "upload_time": datetime.now().isoformat()
    }

@app.post("/api/translate")
async def start_translation(request: TranslationRequest):
    """开始翻译任务"""
    task_id = str(uuid.uuid4())
    
    # 验证文件存在
    file_path = UPLOADS_DIR / f"{request.file_id}.pdf"
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    # 创建翻译配置
    try:
        translator = OpenAITranslator(
            lang_in=request.lang_in,
            lang_out=request.lang_out,
            model=request.model,
            api_key=request.api_key,
            base_url=request.base_url
        )
        
        doc_layout_model = DocLayoutModel.load_onnx()
        
        # 加载术语表
        glossaries = []
        for glossary_id in request.glossary_ids:
            glossary_path = GLOSSARIES_DIR / f"{glossary_id}.csv"
            if glossary_path.exists():
                glossary = Glossary.from_csv(glossary_path, request.lang_out)
                glossaries.append(glossary)
        
        config = TranslationConfig(
            translator=translator,
            input_file=str(file_path),
            lang_in=request.lang_in,
            lang_out=request.lang_out,
            doc_layout_model=doc_layout_model,
            pages=request.pages,
            output_dir=str(OUTPUTS_DIR / task_id),
            debug=request.debug,
            no_dual=request.no_dual,
            no_mono=request.no_mono,
            qps=request.qps,
            glossaries=glossaries
        )
        
        # 记录翻译任务
        task_data = {
            "task_id": task_id,
            "status": "running",
            "filename": request.model_dump().get('file_id', 'unknown') + '.pdf',
            "source_lang": request.lang_in,
            "target_lang": request.lang_out,
            "model": request.model,
            "start_time": datetime.now().isoformat(),
            "progress": 0,
            "stage": "初始化",
            "config": request.model_dump()
        }
        
        active_translations[task_id] = task_data
        add_to_history(task_data)
        
        # 启动异步翻译任务
        asyncio.create_task(run_translation(task_id, config))
        
        return {"task_id": task_id, "status": "started"}
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"翻译启动失败: {str(e)}")

async def run_translation(task_id: str, config):
    """运行翻译任务"""
    try:
        async for event in high_level.async_translate(config):
            # 更新任务状态
            if task_id in active_translations:
                if event["type"] == "progress_update":
                    active_translations[task_id].update({
                        "progress": event.get("overall_progress", 0),
                        "stage": event.get("stage", "处理中"),
                        "message": event.get("message", "")
                    })
                    # 更新历史记录
                    add_to_history(active_translations[task_id])
                elif event["type"] == "finish":
                    result = event["translate_result"]
                    # 处理TranslateResult对象，使用属性访问而不是字典方法
                    # 确保路径转换为字符串以避免JSON序列化错误
                    mono_path = getattr(result, "mono_pdf_path", None)
                    dual_path = getattr(result, "dual_pdf_path", None)
                    
                    active_translations[task_id].update({
                        "status": "completed",
                        "progress": 100,
                        "stage": "完成",
                        "result": {
                            "mono_pdf_path": str(mono_path) if mono_path else None,
                            "dual_pdf_path": str(dual_path) if dual_path else None,
                            "total_seconds": getattr(result, "total_seconds", 0),
                            "peak_memory_usage": getattr(result, "peak_memory_usage", 0)
                        },
                        "end_time": datetime.now().isoformat()
                    })
                    # 更新历史记录
                    add_to_history(active_translations[task_id])
                elif event["type"] == "error":
                    active_translations[task_id].update({
                        "status": "error",
                        "error": event.get("error", "未知错误"),
                        "end_time": datetime.now().isoformat()
                    })
                    # 更新历史记录
                    add_to_history(active_translations[task_id])
                
                # 通知WebSocket客户端
                if task_id in connected_clients:
                    try:
                        await connected_clients[task_id].send_text(json.dumps(event))
                    except:
                        pass
                        
    except Exception as e:
        if task_id in active_translations:
            active_translations[task_id].update({
                "status": "error",
                "error": str(e),
                "end_time": datetime.now().isoformat()
            })
            # 更新历史记录
            add_to_history(active_translations[task_id])

@app.get("/api/translation/{task_id}/status")
async def get_translation_status(task_id: str):
    """获取翻译任务状态"""
    if task_id not in active_translations:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    return active_translations[task_id]

@app.websocket("/api/translation/{task_id}/ws")
async def websocket_endpoint(websocket: WebSocket, task_id: str):
    """WebSocket连接用于实时进度更新"""
    await websocket.accept()
    connected_clients[task_id] = websocket
    
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        if task_id in connected_clients:
            del connected_clients[task_id]

@app.get("/api/translation/{task_id}/download/{file_type}")
async def download_result(task_id: str, file_type: str):
    """下载翻译结果文件"""
    if task_id not in active_translations:
        raise HTTPException(status_code=404, detail="任务不存在")
    
    task = active_translations[task_id]
    if task["status"] != "completed":
        raise HTTPException(status_code=400, detail="翻译未完成")
    
    result = task.get("result", {})
    
    if file_type == "mono":
        file_path = result.get("mono_pdf_path")
    elif file_type == "dual":
        file_path = result.get("dual_pdf_path")
    else:
        raise HTTPException(status_code=400, detail="无效的文件类型")
    
    if not file_path or not Path(file_path).exists():
        raise HTTPException(status_code=404, detail="文件不存在")
    
    return FileResponse(
        path=file_path,
        filename=f"{task_id}_{file_type}.pdf",
        media_type="application/pdf"
    )

@app.post("/api/glossary/upload")
async def upload_glossary(file: UploadFile = File(...), target_lang: str = "zh"):
    """上传术语表文件"""
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")
    
    glossary_id = str(uuid.uuid4())
    file_path = GLOSSARIES_DIR / f"{glossary_id}.csv"
    
    async with aiofiles.open(file_path, 'wb') as f:
        content = await file.read()
        await f.write(content)
    
    # 计算条目数量
    try:
        content_str = content.decode('utf-8')
        entry_count = len(content_str.strip().split('\n')) - 1  # 减去标题行
    except:
        entry_count = 0
    
    # 保存术语表信息
    glossary_info = {
        "id": glossary_id,
        "name": file.filename,
        "target_lang": target_lang,
        "created_at": datetime.now().isoformat(),
        "entry_count": entry_count
    }
    
    info_path = GLOSSARIES_DIR / f"{glossary_id}.json"
    async with aiofiles.open(info_path, 'w', encoding='utf-8') as f:
        await f.write(json.dumps(glossary_info, ensure_ascii=False, indent=2))
    
    return glossary_info

@app.get("/api/glossaries")
async def list_glossaries():
    """获取术语表列表"""
    glossaries = []
    
    for info_file in GLOSSARIES_DIR.glob("*.json"):
        try:
            async with aiofiles.open(info_file, 'r', encoding='utf-8') as f:
                content = await f.read()
                glossary_info = json.loads(content)
                glossaries.append(glossary_info)
        except:
            continue
    
    return sorted(glossaries, key=lambda x: x["created_at"], reverse=True)

@app.delete("/api/glossary/{glossary_id}")
async def delete_glossary(glossary_id: str):
    """删除术语表"""
    csv_path = GLOSSARIES_DIR / f"{glossary_id}.csv"
    json_path = GLOSSARIES_DIR / f"{glossary_id}.json"
    
    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="术语表不存在")
    
    csv_path.unlink()
    if json_path.exists():
        json_path.unlink()
    
    return {"message": "术语表已删除"}

@app.get("/api/translations")
async def list_translations():
    """获取翻译历史"""
    history = load_history()
    
    # 检查每个任务的文件状态
    for task in history:
        task_id = task.get('task_id')
        result = task.get('result', {})
        
        # 检查文件是否存在
        file_status = {
            'mono_exists': False,
            'dual_exists': False,
            'mono_size': 0,
            'dual_size': 0
        }
        
        if task.get('status') == 'completed' and result:
            mono_path = result.get('mono_pdf_path')
            dual_path = result.get('dual_pdf_path')
            
            if mono_path and Path(mono_path).exists():
                file_status['mono_exists'] = True
                file_status['mono_size'] = Path(mono_path).stat().st_size
            
            if dual_path and Path(dual_path).exists():
                file_status['dual_exists'] = True
                file_status['dual_size'] = Path(dual_path).stat().st_size
        
        task['file_status'] = file_status
    
    # 按时间倒序排列
    return sorted(history, key=lambda x: x.get('start_time', ''), reverse=True)

@app.delete("/api/translation/{task_id}")
async def delete_translation(task_id: str):
    """删除翻译记录"""
    history = load_history()
    original_length = len(history)
    
    # 过滤掉指定的任务
    history = [item for item in history if item.get('task_id') != task_id]
    
    if len(history) == original_length:
        raise HTTPException(status_code=404, detail="翻译记录不存在")
    
    save_history(history)
    
    # 同时从内存中删除
    if task_id in active_translations:
        del active_translations[task_id]
    
    return {"message": "翻译记录已删除"}

@app.delete("/api/translations")
async def delete_multiple_translations(task_ids: List[str]):
    """批量删除翻译记录"""
    history = load_history()
    original_length = len(history)
    
    # 过滤掉指定的任务
    history = [item for item in history if item.get('task_id') not in task_ids]
    
    deleted_count = original_length - len(history)
    
    if deleted_count == 0:
        raise HTTPException(status_code=404, detail="没有找到要删除的翻译记录")
    
    save_history(history)
    
    # 同时从内存中删除
    for task_id in task_ids:
        if task_id in active_translations:
            del active_translations[task_id]
    
    return {"message": f"已删除 {deleted_count} 条翻译记录"}

class CleanupRequest(BaseModel):
    delete_orphan_files: bool = False
    delete_orphan_records: bool = False

@app.post("/api/files/cleanup")
async def cleanup_files(request: CleanupRequest):
    """清理孤儿文件和记录"""
    print(f"\n=== 开始文件清理 ===")
    print(f"delete_orphan_files: {request.delete_orphan_files}")
    print(f"delete_orphan_records: {request.delete_orphan_records}")
    
    history = load_history()
    print(f"历史记录数量: {len(history)}")
    
    cleanup_result = {
        "orphan_files": [],
        "orphan_records": [],
        "deleted_files": 0,
        "deleted_records": 0,
        "errors": [],
        "warnings": []
    }
    
    # 获取所有历史记录中的文件路径
    history_files = set()
    for task in history:
        result = task.get('result', {})
        if result:
            mono_path = result.get('mono_pdf_path')
            dual_path = result.get('dual_pdf_path')
            if mono_path:
                history_files.add(Path(str(mono_path)))
            if dual_path:
                history_files.add(Path(str(dual_path)))
    
    print(f"历史记录中的文件数量: {len(history_files)}")
    for f in history_files:
        print(f"  历史文件: {f}")
    
    # 扫描outputs目录中的所有文件
    existing_files = set()
    print(f"OUTPUTS_DIR: {OUTPUTS_DIR}")
    print(f"OUTPUTS_DIR存在: {OUTPUTS_DIR.exists()}")
    
    if OUTPUTS_DIR.exists():
        for file_path in OUTPUTS_DIR.rglob("*.pdf"):
            existing_files.add(file_path)
            print(f"  发现文件: {file_path}")
    
    print(f"实际存在的文件数量: {len(existing_files)}")
    
    # 找出孤儿文件（存在于文件系统但不在历史记录中）
    orphan_files = existing_files - history_files
    cleanup_result["orphan_files"] = [str(f) for f in orphan_files]
    
    print(f"孤儿文件数量: {len(orphan_files)}")
    for f in orphan_files:
        print(f"  孤儿文件: {f}")
    
    # 找出孤儿记录（历史记录中存在但文件不存在）
    orphan_records = []
    for task in history:
        if task.get('status') == 'completed':
            result = task.get('result', {})
            if result:
                mono_path = result.get('mono_pdf_path')
                dual_path = result.get('dual_pdf_path')
                
                mono_missing = mono_path and not Path(mono_path).exists()
                dual_missing = dual_path and not Path(dual_path).exists()
                
                if mono_missing or dual_missing:
                    orphan_records.append({
                        'task_id': task.get('task_id'),
                        'filename': task.get('filename'),
                        'mono_missing': mono_missing,
                        'dual_missing': dual_missing
                    })
    
    cleanup_result["orphan_records"] = orphan_records
    print(f"孤儿记录数量: {len(orphan_records)}")
    
    # 执行清理操作
    if request.delete_orphan_files:
        print(f"\n开始删除 {len(orphan_files)} 个孤儿文件...")
        for file_path in orphan_files:
            try:
                print(f"正在删除文件: {file_path}")
                print(f"文件存在: {file_path.exists()}")
                print(f"文件大小: {file_path.stat().st_size if file_path.exists() else 'N/A'}")
                
                file_path.unlink()
                cleanup_result["deleted_files"] += 1
                print(f"✓ 成功删除: {file_path}")
            except PermissionError as e:
                error_msg = f"文件被占用无法删除: {file_path.name}"
                print(f"✗ {error_msg}: {e}")
                cleanup_result["errors"].append({
                    "type": "permission_error",
                    "file": str(file_path),
                    "message": error_msg
                })
            except FileNotFoundError as e:
                warning_msg = f"文件已不存在: {file_path.name}"
                print(f"⚠ {warning_msg}: {e}")
                cleanup_result["warnings"].append({
                    "type": "file_not_found",
                    "file": str(file_path),
                    "message": warning_msg
                })
            except Exception as e:
                error_msg = f"删除文件时发生未知错误: {file_path.name}"
                print(f"✗ {error_msg}: {e}")
                cleanup_result["errors"].append({
                    "type": "unknown_error",
                    "file": str(file_path),
                    "message": error_msg,
                    "detail": str(e)
                })
                import traceback
                traceback.print_exc()
    
    if request.delete_orphan_records:
        print(f"\n开始删除 {len(orphan_records)} 个孤儿记录...")
        # 删除有缺失文件的记录
        task_ids_to_delete = [record['task_id'] for record in orphan_records]
        if task_ids_to_delete:
            updated_history = [task for task in history if task.get('task_id') not in task_ids_to_delete]
            save_history(updated_history)
            cleanup_result["deleted_records"] = len(task_ids_to_delete)
            print(f"✓ 成功删除 {len(task_ids_to_delete)} 个记录")
    
    print(f"\n=== 清理完成 ===")
    print(f"删除的文件数: {cleanup_result['deleted_files']}")
    print(f"删除的记录数: {cleanup_result['deleted_records']}")
    
    return cleanup_result

@app.get("/api/files/stats")
async def get_file_stats():
    """获取文件存储统计信息"""
    stats = {
        "total_files": 0,
        "total_size": 0,
        "by_status": {
            "completed": {"count": 0, "size": 0},
            "running": {"count": 0, "size": 0},
            "error": {"count": 0, "size": 0}
        }
    }
    
    history = load_history()
    
    for task in history:
        status = task.get('status', 'unknown')
        if status not in stats["by_status"]:
            stats["by_status"][status] = {"count": 0, "size": 0}
        
        stats["by_status"][status]["count"] += 1
        
        if status == 'completed':
            result = task.get('result', {})
            if result:
                mono_path = result.get('mono_pdf_path')
                dual_path = result.get('dual_pdf_path')
                
                for path in [mono_path, dual_path]:
                    if path and Path(path).exists():
                        file_size = Path(path).stat().st_size
                        stats["total_size"] += file_size
                        stats["by_status"][status]["size"] += file_size
                        stats["total_files"] += 1
    
    return stats

# 配置静态文件服务（用于桌面应用）
import sys
from pathlib import Path

# 检测运行环境并设置静态文件目录
if getattr(sys, 'frozen', False):
    # 在PyInstaller打包的exe中运行
    static_dir = Path(sys._MEIPASS) / "dist"
else:
    # 开发环境 - 从backend目录向上找到项目根目录
    static_dir = Path(__file__).parent.parent / "dist"

print(f"Static directory path: {static_dir}")
print(f"Static directory exists: {static_dir.exists()}")
if static_dir.exists():
    print(f"Contents: {list(static_dir.iterdir())}")

# 如果前端构建文件存在，则配置静态文件服务
if static_dir.exists() and (static_dir / "index.html").exists():
    print("Configuring static file serving...")
    
    # 挂载静态资源目录
    if (static_dir / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(static_dir / "assets")), name="assets")
        print("Mounted /assets")
    
    @app.get("/", response_class=FileResponse)
    async def serve_frontend():
        """服务前端页面"""
        print("Serving frontend index.html")
        return FileResponse(str(static_dir / "index.html"))
    
    @app.get("/{path:path}")
    async def catch_all(path: str):
        """处理前端路由"""
        print(f"Handling path: {path}")
        
        # 如果是API路由，跳过
        if path.startswith("api/"):
            raise HTTPException(status_code=404, detail="API endpoint not found")
        
        # 检查是否是静态文件
        file_path = static_dir / path
        if file_path.exists() and file_path.is_file():
            print(f"Serving static file: {file_path}")
            return FileResponse(str(file_path))
        
        # 其他路由返回index.html（SPA路由）
        print("Serving SPA route with index.html")
        return FileResponse(str(static_dir / "index.html"))
else:
    print("Frontend files not found - static file serving disabled")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
