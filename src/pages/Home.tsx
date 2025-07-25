import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Upload, FileText, Settings, Play, Info } from 'lucide-react'
import { toast } from 'sonner'

interface UploadedFile {
  file_id: string
  filename: string
  size: number
  upload_time: string
}

interface TranslationConfig {
  lang_in: string
  lang_out: string
  model: string
  base_url: string
  pages: string
  qps: number
  no_dual: boolean
  no_mono: boolean
  debug: boolean
  glossary_ids: string[]
}

const Home = () => {
  const navigate = useNavigate()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadedFile, setUploadedFile] = useState<UploadedFile | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [availableModels, setAvailableModels] = useState<{value: string, name: string}[]>([])
  
  const [config, setConfig] = useState<TranslationConfig>({
    lang_in: 'en',
    lang_out: 'zh',
    model: 'gpt-4o-mini',
    base_url: '',
    pages: '',
    qps: 1,
    no_dual: false,
    no_mono: false,
    debug: false,
    glossary_ids: []
  })

  // 加载保存的设置
  useEffect(() => {
    const loadSettings = () => {
      const savedBaseUrl = localStorage.getItem('babeldoc_base_url') || ''
      const savedDefaultSourceLang = localStorage.getItem('babeldoc_default_source_lang') || 'en'
      const savedDefaultTargetLang = localStorage.getItem('babeldoc_default_target_lang') || 'zh'
      const savedDefaultModel = localStorage.getItem('babeldoc_default_model') || 'gpt-4o-mini'
      const savedDefaultQps = parseInt(localStorage.getItem('babeldoc_default_qps') || '1')

      setConfig(prev => ({
        ...prev,
        base_url: savedBaseUrl,
        lang_in: savedDefaultSourceLang,
        lang_out: savedDefaultTargetLang,
        model: savedDefaultModel,
        qps: savedDefaultQps
      }))
      
      // 更新可用模型列表
      setAvailableModels(getAvailableModels())
    }

    loadSettings()

    // 监听localStorage变化，当设置页面更新自定义模型时实时更新
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'babeldoc_custom_model' || e.key === 'babeldoc_use_custom_model' || e.key === 'babeldoc_default_model') {
        loadSettings()
      }
    }

    window.addEventListener('storage', handleStorageChange)
    
    return () => {
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  // 获取可用的模型列表（包括自定义模型）
  const getAvailableModels = () => {
    const defaultModels = [
      { value: 'gpt-4o-mini', name: 'GPT-4o Mini' },
      { value: 'gpt-4o', name: 'GPT-4o' },
      { value: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
      { value: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
    ]

    // 检查是否有自定义模型
    const savedCustomModel = localStorage.getItem('babeldoc_custom_model') || ''
    const savedUseCustomModel = localStorage.getItem('babeldoc_use_custom_model') === 'true'
    
    if (savedUseCustomModel && savedCustomModel.trim()) {
      return [
        ...defaultModels,
        { value: savedCustomModel.trim(), name: `${savedCustomModel.trim()} (自定义)` }
      ]
    }
    
    return defaultModels
  }

  const handleFileSelect = async (file: File) => {
    if (!file.type.includes('pdf')) {
      toast.error('请选择PDF文件')
      return
    }

    setIsUploading(true)
    const formData = new FormData()
    formData.append('file', file)

    try {
      const response = await fetch('http://localhost:8000/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('上传失败')
      }

      const result = await response.json()
      setUploadedFile(result)
      toast.success('文件上传成功')
    } catch (error) {
      toast.error('文件上传失败')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    if (files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
  }

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }

  const startTranslation = async () => {
    if (!uploadedFile) {
      toast.error('请先上传PDF文件')
      return
    }

    // 从localStorage读取API密钥
    const apiKey = localStorage.getItem('babeldoc_api_key') || ''
    if (!apiKey) {
      toast.error('请先在设置页面配置OpenAI API密钥')
      return
    }

    setIsTranslating(true)

    try {
      // 处理base_url，确保没有末尾斜杠
      const processedConfig = {
        ...config,
        api_key: apiKey,
        base_url: config.base_url.trim() ? config.base_url.trim().replace(/\/$/, '') : ''
      }

      const response = await fetch('http://localhost:8000/api/translate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          file_id: uploadedFile.file_id,
          ...processedConfig
        })
      })

      if (!response.ok) {
        throw new Error('翻译启动失败')
      }

      const result = await response.json()
      toast.success('翻译任务已启动')
      navigate(`/progress/${result.task_id}`)
    } catch (error) {
      toast.error('翻译启动失败')
      console.error('Translation error:', error)
    } finally {
      setIsTranslating(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">PDF 翻译工具</h1>
        <p className="text-gray-600">专为科学论文PDF翻译和双语对比设计</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* 左侧：文件上传区域 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Upload className="h-5 w-5 mr-2 text-pink-600" />
              文件上传
            </h2>
            
            {!uploadedFile ? (
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  dragOver
                    ? 'border-pink-400 bg-pink-50'
                    : 'border-gray-300 hover:border-pink-400 hover:bg-pink-50'
                }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
              >
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 mb-2">
                  {isUploading ? '上传中...' : '拖拽PDF文件到此处，或点击选择文件'}
                </p>
                <p className="text-sm text-gray-500">支持PDF格式，最大100MB</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileInputChange}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="border border-gray-200 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <FileText className="h-8 w-8 text-red-500" />
                  <div className="flex-1">
                    <p className="font-medium text-gray-900">{uploadedFile.filename}</p>
                    <p className="text-sm text-gray-500">
                      {formatFileSize(uploadedFile.size)} • 上传于 {new Date(uploadedFile.upload_time).toLocaleString()}
                    </p>
                  </div>
                  <button
                    onClick={() => setUploadedFile(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 快速开始指引 */}
          <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
            <h3 className="text-lg font-semibold text-blue-900 mb-3 flex items-center">
              <Info className="h-5 w-5 mr-2" />
              使用指南
            </h3>
            <ol className="text-sm text-blue-800 space-y-2">
              <li>1. 在设置页面配置API密钥和其他参数</li>
              <li>2. 上传需要翻译的PDF文件</li>
              <li>3. 配置翻译参数（语言、模型等）</li>
              <li>4. 点击开始翻译，实时查看进度</li>
              <li>5. 翻译完成后下载结果文件</li>
            </ol>
          </div>
        </div>

        {/* 右侧：翻译配置面板 */}
        <div className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Settings className="h-5 w-5 mr-2 text-pink-600" />
              翻译配置
            </h2>
            
            <div className="space-y-4">
              {/* 语言配置 */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    源语言
                  </label>
                  <select
                    value={config.lang_in}
                    onChange={(e) => setConfig({ ...config, lang_in: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="en">英语</option>
                    <option value="zh">中文</option>
                    <option value="ja">日语</option>
                    <option value="ko">韩语</option>
                    <option value="fr">法语</option>
                    <option value="de">德语</option>
                    <option value="es">西班牙语</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    目标语言
                  </label>
                  <select
                    value={config.lang_out}
                    onChange={(e) => setConfig({ ...config, lang_out: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                  >
                    <option value="zh">中文</option>
                    <option value="en">英语</option>
                    <option value="ja">日语</option>
                    <option value="ko">韩语</option>
                    <option value="fr">法语</option>
                    <option value="de">德语</option>
                    <option value="es">西班牙语</option>
                  </select>
                </div>
              </div>

              {/* 模型选择 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  翻译模型
                </label>
                <select
                  value={config.model}
                  onChange={(e) => setConfig({ ...config, model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  {availableModels.map((model) => (
                    <option key={model.value} value={model.value}>
                      {model.name}
                    </option>
                  ))}
                </select>
              </div>



              {/* 页面范围 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  页面范围（可选）
                </label>
                <input
                  type="text"
                  value={config.pages}
                  onChange={(e) => setConfig({ ...config, pages: e.target.value })}
                  placeholder="例如：1-5 或 1,3,5 或留空翻译全部"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              {/* QPS设置 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  请求频率 (QPS)
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={config.qps}
                  onChange={(e) => setConfig({ ...config, qps: parseInt(e.target.value) || 1 })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              </div>

              {/* 输出选项 */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  输出选项
                </label>
                <div className="space-y-2">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.no_dual}
                      onChange={(e) => setConfig({ ...config, no_dual: e.target.checked })}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">禁用双语输出</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.no_mono}
                      onChange={(e) => setConfig({ ...config, no_mono: e.target.checked })}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">禁用单语输出</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={config.debug}
                      onChange={(e) => setConfig({ ...config, debug: e.target.checked })}
                      className="rounded border-gray-300 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">调试模式</span>
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* 开始翻译按钮 */}
          <button
            onClick={startTranslation}
            disabled={!uploadedFile || isTranslating}
            className="w-full bg-pink-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-pink-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center space-x-2"
          >
            <Play className="h-5 w-5" />
            <span>{isTranslating ? '启动中...' : '开始翻译'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}

export default Home