import { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Key, Globe, Upload, Trash2, Save, Eye, EyeOff, TestTube, X } from 'lucide-react'
import { toast } from 'sonner'

interface GlossaryItem {
  id: string
  name: string
  upload_time: string
  size: number
}

const Settings = () => {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState('')
  const [showApiKey, setShowApiKey] = useState(false)
  const [defaultSourceLang, setDefaultSourceLang] = useState('auto')
  const [defaultTargetLang, setDefaultTargetLang] = useState('zh')
  const [defaultModel, setDefaultModel] = useState('gpt-4o')
  const [customModel, setCustomModel] = useState('')
  const [useCustomModel, setUseCustomModel] = useState(false)
  const [defaultQps, setDefaultQps] = useState(1)
  const [glossaries, setGlossaries] = useState<GlossaryItem[]>([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isTestingConnection, setIsTestingConnection] = useState(false)
  const [showTestModal, setShowTestModal] = useState(false)
  const [testResults, setTestResults] = useState<{[key: string]: 'success' | 'error' | 'testing'}>({})

  const languages = [
    { code: 'auto', name: '自动检测' },
    { code: 'zh', name: '中文' },
    { code: 'en', name: '英文' },
    { code: 'ja', name: '日文' },
    { code: 'ko', name: '韩文' },
    { code: 'fr', name: '法文' },
    { code: 'de', name: '德文' },
    { code: 'es', name: '西班牙文' },
    { code: 'ru', name: '俄文' },
    { code: 'it', name: '意大利文' },
    { code: 'pt', name: '葡萄牙文' },
    { code: 'ar', name: '阿拉伯文' },
    { code: 'hi', name: '印地文' },
    { code: 'th', name: '泰文' },
    { code: 'vi', name: '越南文' }
  ]

  const models = [
    { value: 'gpt-4o', name: 'GPT-4o' },
    { value: 'gpt-4o-mini', name: 'GPT-4o Mini' },
    { value: 'gpt-4-turbo', name: 'GPT-4 Turbo' },
    { value: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
  ]

  useEffect(() => {
    loadSettings()
    loadGlossaries()
  }, [])

  const loadSettings = () => {
    // 从localStorage加载设置
    const savedApiKey = localStorage.getItem('babeldoc_api_key') || ''
    const savedBaseUrl = localStorage.getItem('babeldoc_base_url') || ''
    const savedSourceLang = localStorage.getItem('babeldoc_default_source_lang') || 'auto'
    const savedTargetLang = localStorage.getItem('babeldoc_default_target_lang') || 'zh'
    const savedModel = localStorage.getItem('babeldoc_default_model') || 'gpt-4o'
    const savedCustomModel = localStorage.getItem('babeldoc_custom_model') || ''
    const savedUseCustomModel = localStorage.getItem('babeldoc_use_custom_model') === 'true'
    const savedQps = parseInt(localStorage.getItem('babeldoc_default_qps') || '1')

    setApiKey(savedApiKey)
    setBaseUrl(savedBaseUrl)
    setDefaultSourceLang(savedSourceLang)
    setDefaultTargetLang(savedTargetLang)
    setDefaultModel(savedModel)
    setCustomModel(savedCustomModel)
    setUseCustomModel(savedUseCustomModel)
    setDefaultQps(savedQps)
  }

  const loadGlossaries = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/glossaries')
      if (response.ok) {
        const data = await response.json()
        setGlossaries(data)
      }
    } catch (error) {
      console.error('Failed to load glossaries:', error)
    }
  }

  const saveSettings = async () => {
    setSaving(true)
    
    try {
      // 验证自定义模型
      if (useCustomModel && !customModel.trim()) {
        toast.error('请输入自定义模型名称')
        setSaving(false)
        return
      }
      
      // 保存到localStorage
      localStorage.setItem('babeldoc_api_key', apiKey)
      localStorage.setItem('babeldoc_base_url', baseUrl)
      localStorage.setItem('babeldoc_default_source_lang', defaultSourceLang)
      localStorage.setItem('babeldoc_default_target_lang', defaultTargetLang)
      localStorage.setItem('babeldoc_default_model', useCustomModel ? customModel.trim() : defaultModel)
      localStorage.setItem('babeldoc_custom_model', customModel.trim())
      localStorage.setItem('babeldoc_use_custom_model', useCustomModel.toString())
      localStorage.setItem('babeldoc_default_qps', defaultQps.toString())
      
      toast.success('设置已保存')
    } catch (error) {
      toast.error('保存设置失败')
    } finally {
      setSaving(false)
    }
  }

  const handleGlossaryUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (!file.name.endsWith('.txt')) {
      toast.error('请选择.txt格式的词汇表文件')
      return
    }

    setUploading(true)
    
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('http://localhost:8000/api/glossary/upload', {
        method: 'POST',
        body: formData
      })

      if (response.ok) {
        toast.success('词汇表上传成功')
        loadGlossaries() // 重新加载词汇表列表
      } else {
        const error = await response.json()
        toast.error(error.detail || '上传失败')
      }
    } catch (error) {
      console.error('Upload failed:', error)
      toast.error('上传过程中发生错误')
    } finally {
      setUploading(false)
      // 清空文件输入
      event.target.value = ''
    }
  }

  const deleteGlossary = async (glossaryId: string) => {
    if (!window.confirm('确定要删除这个词汇表吗？')) return

    try {
      const response = await fetch(`http://localhost:8000/api/glossary/${glossaryId}`, {
        method: 'DELETE'
      })

      if (response.ok) {
        toast.success('词汇表已删除')
        loadGlossaries() // 重新加载词汇表列表
      } else {
        toast.error('删除失败')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('删除过程中发生错误')
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error('请先输入API密钥')
      return
    }

    setIsTestingConnection(true)
    setShowTestModal(true)
    setTestResults({})

    // 获取所有要测试的模型
    const modelsToTest = [
      'gpt-4o',
      'gpt-4o-mini', 
      'gpt-4-turbo',
      'gpt-3.5-turbo'
    ]
    
    if (customModel.trim()) {
      modelsToTest.push(customModel.trim())
    }

    // 测试每个模型
    for (const modelName of modelsToTest) {
      setTestResults(prev => ({ ...prev, [modelName]: 'testing' }))
      
      try {
        const testBaseUrl = (baseUrl.trim() || 'https://api.openai.com/v1').replace(/\/$/, '')
        const response = await fetch(`${testBaseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: modelName,
            messages: [{ role: 'user', content: 'test' }],
            max_tokens: 1
          })
        })

        if (response.ok) {
          setTestResults(prev => ({ ...prev, [modelName]: 'success' }))
        } else {
          setTestResults(prev => ({ ...prev, [modelName]: 'error' }))
        }
      } catch (error) {
        setTestResults(prev => ({ ...prev, [modelName]: 'error' }))
      }
    }

    setIsTestingConnection(false)
  }

  const closeTestModal = () => {
    setShowTestModal(false)
    setTestResults({})
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center">
          <SettingsIcon className="h-8 w-8 mr-2 text-pink-600" />
          设置
        </h1>
        <p className="text-gray-600">配置API密钥、默认参数和词汇表</p>
      </div>

      <div className="space-y-8">
        {/* API设置 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Key className="h-6 w-6 mr-2 text-pink-600" />
              API设置
            </h2>
            <button
              onClick={handleTestConnection}
              disabled={isTestingConnection}
              className="px-4 py-2 bg-pink-600 text-white rounded-lg hover:bg-pink-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isTestingConnection ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>测试中...</span>
                </>
              ) : (
                <>
                  <TestTube className="h-4 w-4" />
                  <span>测试连接</span>
                </>
              )}
            </button>
          </div>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI API密钥
              </label>
              <div className="relative">
                <input
                  type={showApiKey ? 'text' : 'password'}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="请输入您的OpenAI API密钥"
                  className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
                <button
                  type="button"
                  onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600"
                >
                  {showApiKey ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                API密钥将安全地存储在本地浏览器中
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                OpenAI Base URL
              </label>
              <input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1（留空使用默认）"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
              <p className="text-xs text-gray-500 mt-1">
                自定义API端点，支持第三方OpenAI兼容服务
              </p>
            </div>
          </div>
        </div>

        {/* 默认翻译设置 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
            <Globe className="h-6 w-6 mr-2 text-pink-600" />
            默认翻译设置
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                默认源语言
              </label>
              <select
                value={defaultSourceLang}
                onChange={(e) => setDefaultSourceLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                {languages.map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                默认目标语言
              </label>
              <select
                value={defaultTargetLang}
                onChange={(e) => setDefaultTargetLang(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                {languages.filter(lang => lang.code !== 'auto').map(lang => (
                  <option key={lang.code} value={lang.code}>{lang.name}</option>
                ))}
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                默认模型
              </label>
              
              {/* 模型类型选择 */}
              <div className="mb-3">
                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="modelType"
                      checked={!useCustomModel}
                      onChange={() => setUseCustomModel(false)}
                      className="mr-2 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">预设模型</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="modelType"
                      checked={useCustomModel}
                      onChange={() => setUseCustomModel(true)}
                      className="mr-2 text-pink-600 focus:ring-pink-500"
                    />
                    <span className="text-sm text-gray-700">自定义模型</span>
                  </label>
                </div>
              </div>
              
              {/* 模型选择/输入 */}
              {useCustomModel ? (
                <input
                  type="text"
                  value={customModel}
                  onChange={(e) => setCustomModel(e.target.value)}
                  placeholder="请输入自定义模型名称，如：gpt-4-1106-preview"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                />
              ) : (
                <select
                  value={defaultModel}
                  onChange={(e) => setDefaultModel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
                >
                  {models.map(model => (
                    <option key={model.value} value={model.value}>{model.name}</option>
                  ))}
                </select>
              )}
              
              <p className="text-xs text-gray-500 mt-1">
                {useCustomModel 
                  ? "支持任何兼容OpenAI API的模型名称" 
                  : "选择预设的OpenAI模型"}
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                默认QPS（每秒请求数）
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={defaultQps}
                onChange={(e) => setDefaultQps(parseInt(e.target.value) || 1)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>

        {/* 词汇表管理 */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              <Upload className="h-6 w-6 mr-2 text-pink-600" />
              词汇表管理
            </h2>
            
            <div className="relative">
              <input
                type="file"
                accept=".txt"
                onChange={handleGlossaryUpload}
                disabled={uploading}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
              />
              <button
                disabled={uploading}
                className="bg-pink-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {uploading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>上传中...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-4 w-4" />
                    <span>上传词汇表</span>
                  </>
                )}
              </button>
            </div>
          </div>
          
          <div className="mb-4">
            <p className="text-sm text-gray-600">
              支持.txt格式的词汇表文件，每行一个词条，格式：原文|译文
            </p>
          </div>
          
          {glossaries.length > 0 ? (
            <div className="space-y-3">
              {glossaries.map(glossary => (
                <div key={glossary.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:border-pink-300 transition-colors">
                  <div className="flex-1">
                    <h3 className="font-medium text-gray-900">{glossary.name}</h3>
                    <div className="flex items-center space-x-4 text-sm text-gray-500 mt-1">
                      <span>大小: {formatFileSize(glossary.size)}</span>
                      <span>上传时间: {new Date(glossary.upload_time).toLocaleString()}</span>
                    </div>
                  </div>
                  
                  <button
                    onClick={() => deleteGlossary(glossary.id)}
                    className="text-red-600 hover:text-red-800 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    title="删除词汇表"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <Upload className="h-12 w-12 mx-auto mb-2 text-gray-300" />
              <p>暂无词汇表</p>
              <p className="text-sm">点击上方按钮上传词汇表文件</p>
            </div>
          )}
        </div>

        {/* 保存按钮 */}
        <div className="flex justify-center">
          <button
            onClick={saveSettings}
            disabled={saving}
            className="bg-pink-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                <span>保存中...</span>
              </>
            ) : (
              <>
                <Save className="h-5 w-5" />
                <span>保存设置</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* 测试连接模态框 */}
      {showTestModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900">模型连接测试</h3>
              <button
                onClick={closeTestModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="space-y-3">
              {Object.entries(testResults).map(([modelName, status]) => (
                <div key={modelName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <span className="font-medium text-gray-700">{modelName}</span>
                  <div className="flex items-center">
                    {status === 'testing' && (
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-600"></div>
                    )}
                    {status === 'success' && (
                      <div className="text-green-600 font-semibold">✓ 连接成功</div>
                    )}
                    {status === 'error' && (
                      <div className="text-red-600 font-semibold">✗ 连接失败</div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                onClick={closeTestModal}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-lg hover:bg-gray-400"
              >
                关闭
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 许可证信息 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">许可证信息</h2>
        <div className="space-y-4 text-sm text-gray-600">
          <div>
            <h3 className="font-medium text-gray-900 mb-2">Easy-BabelDOC</h3>
            <p>版本: 1.0.0</p>
            <p>作者: lijiapeng365</p>
            <p>许可证: GNU Affero General Public License (AGPL) v3</p>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-2">重要声明</h4>
            <p className="mb-2">
              本软件基于 <a href="https://github.com/funstory-ai/BabelDOC" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">BabelDOC</a> 开发，使用 AGPL-3.0 许可证。
            </p>
            <p className="mb-2">
              根据 AGPL-3.0 要求，如果您修改本软件并通过网络提供服务，必须向用户提供修改后的源代码。
            </p>
            <p>
              完整源代码可在 <a href="https://github.com/lijiapeng365/Easy-BabelDOC" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">GitHub</a> 获取。
            </p>
          </div>
          
          <div className="border-t pt-4">
            <h4 className="font-medium text-gray-900 mb-2">第三方组件</h4>
            <p>本软件使用了多个开源组件，详细信息请查看项目的 package.json 和 requirements.txt 文件。</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Settings