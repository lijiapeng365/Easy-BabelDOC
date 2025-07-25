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

# 初始化BabelDOC
try:
    high_level.init()
except:
    print("BabelDOC initialization skipped (development mode)")

@app.get("/")
async def root():
    return {"message": "BabelDOC API Server", "version": "1.0.0"}

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
        active_translations[task_id] = {
            "status": "running",
            "config": request.model_dump(),
            "start_time": datetime.now().isoformat(),
            "progress": 0,
            "stage": "初始化"
        }
        
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
                elif event["type"] == "finish":
                    result = event["translate_result"]
                    # 处理TranslateResult对象，使用属性访问而不是字典方法
                    active_translations[task_id].update({
                        "status": "completed",
                        "progress": 100,
                        "stage": "完成",
                        "result": {
                            "mono_pdf_path": getattr(result, "mono_pdf_path", None),
                            "dual_pdf_path": getattr(result, "dual_pdf_path", None),
                            "total_seconds": getattr(result, "total_seconds", 0),
                            "peak_memory_usage": getattr(result, "peak_memory_usage", 0)
                        },
                        "end_time": datetime.now().isoformat()
                    })
                elif event["type"] == "error":
                    active_translations[task_id].update({
                        "status": "error",
                        "error": event.get("error", "未知错误"),
                        "end_time": datetime.now().isoformat()
                    })
                
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
    return list(active_translations.values())

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)