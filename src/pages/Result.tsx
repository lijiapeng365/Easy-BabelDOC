import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Download, FileText, Clock, MemoryStick, CheckCircle, AlertCircle, Home } from 'lucide-react'
import { toast } from 'sonner'

interface TranslationResult {
  status: string
  progress: number
  stage: string
  start_time: string
  end_time?: string
  error?: string
  result?: {
    mono_pdf_path: string
    dual_pdf_path: string
    total_seconds: number
    peak_memory_usage: number
  }
}

const Result = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [result, setResult] = useState<TranslationResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [downloading, setDownloading] = useState<string | null>(null)

  useEffect(() => {
    if (!taskId) return
    fetchResult()
  }, [taskId])

  const fetchResult = async () => {
    if (!taskId) return

    try {
      const response = await fetch(`http://localhost:8000/api/translation/${taskId}/status`)
      if (response.ok) {
        const data = await response.json()
        setResult(data)
        
        if (data.status !== 'completed' && data.status !== 'error') {
          // 如果任务还在进行中，跳转到进度页面
          navigate(`/progress/${taskId}`)
        }
      } else {
        toast.error('获取翻译结果失败')
      }
    } catch (error) {
      console.error('Failed to fetch result:', error)
      toast.error('网络错误')
    } finally {
      setLoading(false)
    }
  }

  const downloadFile = async (type: 'mono' | 'dual') => {
    if (!taskId || !result?.result) return

    setDownloading(type)
    
    try {
      const response = await fetch(`http://localhost:8000/api/translation/${taskId}/download/${type}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = type === 'mono' ? 'translated.pdf' : 'dual_language.pdf'
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success('文件下载成功')
      } else {
        toast.error('文件下载失败')
      }
    } catch (error) {
      console.error('Download failed:', error)
      toast.error('下载过程中发生错误')
    } finally {
      setDownloading(null)
    }
  }

  const formatDuration = (seconds: number) => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes}:${secs.toString().padStart(2, '0')}`
  }

  const formatMemory = (mb: number) => {
    if (mb >= 1024) {
      return `${(mb / 1024).toFixed(1)} GB`
    }
    return `${mb} MB`
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载翻译结果...</p>
        </div>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">未找到翻译结果</h2>
          <p className="text-gray-600 mb-6">任务ID可能无效或已过期</p>
          <button
            onClick={() => navigate('/')}
            className="bg-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-pink-700 transition-colors"
          >
            返回首页
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <div className="flex items-center justify-center space-x-2 mb-2">
          {result.status === 'completed' ? (
            <CheckCircle className="h-8 w-8 text-green-600" />
          ) : (
            <AlertCircle className="h-8 w-8 text-red-600" />
          )}
          <h1 className="text-3xl font-bold text-gray-900">
            {result.status === 'completed' ? '翻译完成' : '翻译失败'}
          </h1>
        </div>
        <p className="text-gray-600">任务ID: {taskId}</p>
      </div>

      {result.status === 'completed' && result.result ? (
        <div className="space-y-8">
          {/* 下载区域 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
              <Download className="h-6 w-6 mr-2 text-pink-600" />
              下载翻译结果
            </h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 单语PDF */}
              <div className="border border-gray-200 rounded-lg p-6 hover:border-pink-300 transition-colors">
                <div className="flex items-center space-x-3 mb-4">
                  <FileText className="h-8 w-8 text-pink-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">单语PDF</h3>
                    <p className="text-sm text-gray-600">仅包含翻译后的内容</p>
                  </div>
                </div>
                <button
                  onClick={() => downloadFile('mono')}
                  disabled={downloading === 'mono'}
                  className="w-full bg-pink-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {downloading === 'mono' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>下载中...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>下载单语PDF</span>
                    </>
                  )}
                </button>
              </div>

              {/* 双语PDF */}
              <div className="border border-gray-200 rounded-lg p-6 hover:border-pink-300 transition-colors">
                <div className="flex items-center space-x-3 mb-4">
                  <FileText className="h-8 w-8 text-blue-600" />
                  <div>
                    <h3 className="font-semibold text-gray-900">双语PDF</h3>
                    <p className="text-sm text-gray-600">包含原文和翻译对照</p>
                  </div>
                </div>
                <button
                  onClick={() => downloadFile('dual')}
                  disabled={downloading === 'dual'}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {downloading === 'dual' ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>下载中...</span>
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4" />
                      <span>下载双语PDF</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* 翻译统计 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-6">翻译统计</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="bg-green-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">100%</div>
                <div className="text-sm text-gray-600">完成进度</div>
              </div>
              
              <div className="text-center">
                <div className="bg-blue-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatDuration(result.result.total_seconds)}
                </div>
                <div className="text-sm text-gray-600">总耗时</div>
              </div>
              
              <div className="text-center">
                <div className="bg-purple-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                  <MemoryStick className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">
                  {formatMemory(result.result.peak_memory_usage)}
                </div>
                <div className="text-sm text-gray-600">峰值内存</div>
              </div>
              
              <div className="text-center">
                <div className="bg-pink-100 rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-2">
                  <FileText className="h-6 w-6 text-pink-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900">2</div>
                <div className="text-sm text-gray-600">输出文件</div>
              </div>
            </div>
          </div>

          {/* 时间信息 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">时间信息</h2>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">开始时间：</span>
                <span className="font-medium text-gray-900">
                  {new Date(result.start_time).toLocaleString()}
                </span>
              </div>
              
              {result.end_time && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">结束时间：</span>
                  <span className="font-medium text-gray-900">
                    {new Date(result.end_time).toLocaleString()}
                  </span>
                </div>
              )}
              
              <div className="flex justify-between items-center">
                <span className="text-gray-600">总耗时：</span>
                <span className="font-medium text-gray-900">
                  {formatDuration(result.result.total_seconds)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* 错误信息 */
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2 mb-4">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <h2 className="text-xl font-semibold text-red-900">翻译失败</h2>
          </div>
          
          {result.error && (
            <div className="mb-4">
              <h3 className="font-medium text-red-900 mb-2">错误信息：</h3>
              <p className="text-red-700 bg-red-100 p-3 rounded border">{result.error}</p>
            </div>
          )}
          
          <div className="space-y-2 text-sm text-red-700">
            <div>
              <span className="font-medium">开始时间：</span>
              {new Date(result.start_time).toLocaleString()}
            </div>
            {result.end_time && (
              <div>
                <span className="font-medium">失败时间：</span>
                {new Date(result.end_time).toLocaleString()}
              </div>
            )}
          </div>
        </div>
      )}

      {/* 操作按钮 */}
      <div className="mt-8 flex justify-center space-x-4">
        <button
          onClick={() => navigate('/')}
          className="bg-gray-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center space-x-2"
        >
          <Home className="h-4 w-4" />
          <span>返回首页</span>
        </button>
        
        <button
          onClick={() => navigate('/history')}
          className="bg-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-pink-700 transition-colors"
        >
          查看历史
        </button>
      </div>
    </div>
  )
}

export default Result