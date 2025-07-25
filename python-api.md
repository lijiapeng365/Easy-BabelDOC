


# BabelDOC Python API 详细文档

## 概述

BabelDOC 是一个专为科学论文 PDF 翻译和双语对比设计的 Python 库。本文档详细介绍了 BabelDOC 的 Python API，包括核心类、函数和使用方法。 [1](#0-0) 

## 安装

### 基本安装

```bash
uv tool install --python 3.12 BabelDOC
``` [2](#0-1) 

### 依赖要求

BabelDOC 需要 Python 3.10 或更高版本，支持到 Python 3.13。 [3](#0-2) 

## 核心 API

### 1. 高级翻译函数

#### `babeldoc.format.pdf.high_level.init()`

初始化 BabelDOC 系统，创建必要的缓存文件夹。 [4](#0-3) 

#### `babeldoc.format.pdf.high_level.translate(translation_config: TranslationConfig) -> TranslateResult`

同步翻译 PDF 文件。 [5](#0-4) 

#### `babeldoc.format.pdf.high_level.async_translate(translation_config: TranslationConfig)`

异步翻译 PDF 文件，支持实时进度报告和取消操作。该函数会产生进度事件，可用于更新进度条或其他 UI 元素。 [6](#0-5) 

事件类型包括：
- `progress_start`: 阶段开始
- `progress_update`: 进度更新
- `progress_end`: 阶段结束
- `finish`: 翻译完成
- `error`: 错误信息

### 2. 翻译配置类

#### `TranslationConfig`

翻译过程的核心配置类，包含所有翻译参数和选项。 [7](#0-6) 

**主要参数：**

- `translator`: 翻译器实例（BaseTranslator）
- `input_file`: 输入 PDF 文件路径
- `lang_in`: 源语言代码
- `lang_out`: 目标语言代码
- `doc_layout_model`: 文档布局分析模型
- `pages`: 要翻译的页面范围
- `output_dir`: 输出目录
- `debug`: 调试模式
- `working_dir`: 工作目录
- `no_dual`: 是否禁用双语输出
- `no_mono`: 是否禁用单语输出
- `qps`: 翻译服务的 QPS 限制
- `watermark_output_mode`: 水印输出模式
- `glossaries`: 术语表列表

**方法：**

- `should_translate_page(page_number: int) -> bool`: 判断指定页码是否需要翻译
- `get_output_file_path(filename: str) -> Path`: 获取输出文件路径
- `get_working_file_path(filename: str) -> Path`: 获取工作文件路径 [8](#0-7) 

### 3. 翻译结果类

#### `TranslateResult`

翻译操作的结果对象，包含生成的文件路径和统计信息。 [9](#0-8) 

**属性：**
- `mono_pdf_path`: 单语 PDF 文件路径
- `dual_pdf_path`: 双语 PDF 文件路径
- `no_watermark_mono_pdf_path`: 无水印单语 PDF 路径
- `no_watermark_dual_pdf_path`: 无水印双语 PDF 路径
- `total_seconds`: 翻译耗时
- `peak_memory_usage`: 峰值内存使用量
- `auto_extracted_glossary_path`: 自动提取的术语表路径

### 4. 翻译器类

#### `BaseTranslator`

所有翻译器的抽象基类。 [10](#0-9) 

#### `OpenAITranslator`

基于 OpenAI API 的翻译器实现。 [11](#0-10) 

**主要参数：**
- `lang_in`: 源语言
- `lang_out`: 目标语言  
- `model`: OpenAI 模型名称
- `base_url`: API 基础 URL
- `api_key`: API 密钥
- `ignore_cache`: 是否忽略缓存

**Token 统计：**
- `token_count`: 总 token 数量
- `prompt_token_count`: 提示 token 数量
- `completion_token_count`: 完成 token 数量 [12](#0-11) 

### 5. 文档布局模型

#### `DocLayoutModel`

文档布局分析模型，用于检测文档中的不同元素（文本、标题、列表、表格、图形）。 [13](#0-12) 

### 6. 术语表系统

#### `Glossary`

术语表类，用于管理翻译术语。 [14](#0-13) 

**主要方法：**
- `from_csv(file_path: Path, target_lang_out: str)`: 从 CSV 文件加载术语表
- `to_csv() -> str`: 导出为 CSV 格式
- `get_active_entries_for_text(text: str)`: 获取文本中的活跃术语 [15](#0-14) 

#### `GlossaryEntry`

术语条目类。 [16](#0-15) 

### 7. 水印输出模式

#### `WatermarkOutputMode`

定义水印输出选项的枚举类。 [17](#0-16) 

- `Watermarked`: 添加水印
- `NoWatermark`: 不添加水印
- `Both`: 同时输出有水印和无水印版本

## 使用示例

### 基本翻译示例

```python
import babeldoc.format.pdf.high_level as high_level
from babeldoc.format.pdf.translation_config import TranslationConfig
from babeldoc.translator.translator import OpenAITranslator
from babeldoc.docvision.doclayout import DocLayoutModel

# 初始化系统
high_level.init()

# 创建翻译器
translator = OpenAITranslator(
    lang_in="en",
    lang_out="zh",
    model="gpt-4o-mini",
    api_key="your-api-key"
)

# 加载文档布局模型
doc_layout_model = DocLayoutModel.load_onnx()

# 创建翻译配置
config = TranslationConfig(
    translator=translator,
    input_file="example.pdf",
    lang_in="en",
    lang_out="zh", 
    doc_layout_model=doc_layout_model
)

# 执行翻译
result = high_level.translate(config)
print(result)
```

### 异步翻译示例

```python
import asyncio
import babeldoc.format.pdf.high_level as high_level

async def translate_with_progress():
    # 配置同上...
    
    async for event in high_level.async_translate(config):
        if event["type"] == "progress_update":
            print(f"进度: {event['overall_progress']:.1f}%")
        elif event["type"] == "finish":
            print("翻译完成!")
            result = event["translate_result"]
            print(result)
            break
        elif event["type"] == "error":
            print(f"错误: {event['error']}")
            break

asyncio.run(translate_with_progress())
```

### 使用术语表

```python
from babeldoc.glossary import Glossary
from pathlib import Path

# 从 CSV 文件加载术语表
glossary = Glossary.from_csv(Path("terms.csv"), "zh")

# 在配置中使用术语表
config = TranslationConfig(
    # ... 其他参数
    glossaries=[glossary]
)
```

## 配置选项详解

### 页面选择

通过 `pages` 参数可以指定要翻译的页面范围： [18](#0-17) 

- `"1,2,3"`: 翻译第 1、2、3 页
- `"1-5"`: 翻译第 1 到 5 页
- `"1-"`: 从第 1 页翻译到末尾
- `"-3"`: 翻译前 3 页

### 兼容性选项 [19](#0-18) 

`enhance_compatibility` 选项会启用所有兼容性增强选项，包括：
- `skip_clean`: 跳过 PDF 清理步骤
- `dual_translate_first`: 在双语模式下优先显示翻译页面
- `disable_rich_text_translate`: 禁用富文本翻译

### 分割翻译

对于大型文档，可以使用分割策略： [20](#0-19) 

```python
split_strategy = TranslationConfig.create_max_pages_per_part_split_strategy(50)
config = TranslationConfig(
    # ... 其他参数
    split_strategy=split_strategy
)
```

## 进度监控

BabelDOC 提供详细的进度监控功能，包括各个翻译阶段的进度： [21](#0-20) 

## 错误处理

翻译过程中可能遇到的异常：
- `ExtractTextError`: 文本提取错误
- `CancelledError`: 翻译被取消
- OpenAI API 相关错误（自动重试） [22](#0-21) 

## Notes

BabelDOC 提供了功能完整的 Python API，支持同步和异步翻译、进度监控、术语表管理、文档分割等高级功能。API 设计注重灵活性和可扩展性，可以轻松集成到其他应用程序中。主要的高级函数位于 `babeldoc.format.pdf.high_level` 模块中，配置通过 `TranslationConfig` 类进行管理，翻译器实现了统一的 `BaseTranslator` 接口，支持多种翻译服务。
