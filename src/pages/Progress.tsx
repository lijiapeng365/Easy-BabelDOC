import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Activity as ProgressIcon, Clock, X, AlertCircle, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'

interface TranslationStatus {
  status: string
  progress: number
  stage: string
  message?: string
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

const Progress = () => {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const [status, setStatus] = useState<TranslationStatus | null>(null)
  const [logs, setLogs] = useState<string[]>([])
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!taskId) return

    // 获取初始状态
    fetchStatus()

    // 建立WebSocket连接
    const ws = new WebSocket(`ws://localhost:8000/api/translation/${taskId}/ws`)
    
    ws.onopen = () => {
      setIsConnected(true)
      console.log('WebSocket connected')
    }

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        handleWebSocketMessage(data)
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error)
      }
    }

    ws.onclose = () => {
      setIsConnected(false)
      console.log('WebSocket disconnected')
    }

    ws.onerror = (error) => {
      console.error('WebSocket error:', error)
      setIsConnected(false)
    }

    // 定期轮询状态（作为WebSocket的备用方案）
    const interval = setInterval(fetchStatus, 5000)

    return () => {
      ws.close()
      clearInterval(interval)
    }
  }, [taskId])

  const fetchStatus = async () => {
    if (!taskId) return

    try {
      const response = await fetch(`http://localhost:8000/api/translation/${taskId}/status`)
      if (response.ok) {
        const data = await response.json()
        setStatus(data)
        
        // 如果翻译完成，跳转到结果页面
        if (data.status === 'completed') {
          setTimeout(() => {
            navigate(`/result/${taskId}`)
          }, 2000)
        }
      }
    } catch (error) {
      console.error('Failed to fetch status:', error)
    }
  }

  const handleWebSocketMessage = (data: any) => {
    if (data.type === 'progress_update') {
      setStatus(prev => prev ? {
        ...prev,
        progress: data.overall_progress || 0,
        stage: data.stage || prev.stage,
        message: data.message || prev.message
      } : null)
      
      // 添加日志
      if (data.message) {
        setLogs(prev => [...prev, `${new Date().toLocaleTimeString()}: ${data.message}`])
      }
    } else if (data.type === 'finish') {
      setStatus(prev => prev ? {
        ...prev,
        status: 'completed',
        progress: 100,
        stage: '完成',
        result: data.translate_result,
        end_time: new Date().toISOString()
      } : null)
      
      toast.success('翻译完成！')
      setTimeout(() => {
        navigate(`/result/${taskId}`)
      }, 2000)
    } else if (data.type === 'error') {
      setStatus(prev => prev ? {
        ...prev,
        status: 'error',
        error: data.error,
        end_time: new Date().toISOString()
      } : null)
      
      toast.error('翻译失败')
    }
  }

  const cancelTranslation = async () => {
    if (!taskId || !window.confirm('确定要取消翻译吗？')) return

    try {
      // 这里应该调用取消API，但当前后端没有实现
      toast.info('取消功能暂未实现')
    } catch (error) {
      toast.error('取消失败')
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

  const getElapsedTime = () => {
    if (!status?.start_time) return 0
    const start = new Date(status.start_time).getTime()
    const end = status.end_time ? new Date(status.end_time).getTime() : Date.now()
    return (end - start) / 1000
  }

  if (!status) {
    return (
      <div className="max-w-4xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载翻译状态...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">翻译进度</h1>
        <p className="text-gray-600">任务ID: {taskId}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 左侧：进度显示 */}
        <div className="lg:col-span-2 space-y-6">
          {/* 主进度卡片 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                <ProgressIcon className="h-5 w-5 mr-2 text-pink-600" />
                翻译进度
              </h2>
              <div className="flex items-center space-x-2">
                <div className={`w-3 h-3 rounded-full ${
                  isConnected ? 'bg-green-500' : 'bg-red-500'
                }`}></div>
                <span className="text-sm text-gray-500">
                  {isConnected ? '实时连接' : '连接断开'}
                </span>
              </div>
            </div>

            {/* 圆形进度条 */}
            <div className="flex items-center justify-center mb-6">
              <div className="relative w-32 h-32">
                <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#f3f4f6"
                    strokeWidth="8"
                    fill="none"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="40"
                    stroke="#ec4899"
                    strokeWidth="8"
                    fill="none"
                    strokeDasharray={`${2 * Math.PI * 40}`}
                    strokeDashoffset={`${2 * Math.PI * 40 * (1 - status.progress / 100)}`}
                    className="transition-all duration-500 ease-out"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-2xl font-bold text-gray-900">
                    {Math.round(status.progress)}%
                  </span>
                </div>
              </div>
            </div>

            {/* 状态信息 */}
            <div className="text-center space-y-2">
              <div className="flex items-center justify-center space-x-2">
                {status.status === 'running' && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-pink-600"></div>
                )}
                {status.status === 'completed' && (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                )}
                {status.status === 'error' && (
                  <AlertCircle className="h-4 w-4 text-red-600" />
                )}
                <span className="font-medium text-gray-900">{status.stage}</span>
              </div>
              {status.message && (
                <p className="text-sm text-gray-600">{status.message}</p>
              )}
            </div>
          </div>

          {/* 错误信息 */}
          {status.error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-2">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <h3 className="font-medium text-red-900">翻译失败</h3>
              </div>
              <p className="text-sm text-red-700">{status.error}</p>
            </div>
          )}

          {/* 翻译日志 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">翻译日志</h3>
            <div className="bg-gray-50 rounded-lg p-4 max-h-64 overflow-y-auto">
              {logs.length > 0 ? (
                <div className="space-y-1">
                  {logs.map((log, index) => (
                    <div key={index} className="text-sm text-gray-700 font-mono">
                      {log}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500">暂无日志信息</p>
              )}
            </div>
          </div>
        </div>

        {/* 右侧：任务信息和操作 */}
        <div className="space-y-6">
          {/* 任务信息 */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
              <Clock className="h-5 w-5 mr-2 text-pink-600" />
              任务信息
            </h3>
            <div className="space-y-3">
              <div>
                <span className="text-sm font-medium text-gray-700">状态：</span>
                <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                  status.status === 'running' ? 'bg-blue-100 text-blue-800' :
                  status.status === 'completed' ? 'bg-green-100 text-green-800' :
                  status.status === 'error' ? 'bg-red-100 text-red-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {status.status === 'running' ? '进行中' :
                   status.status === 'completed' ? '已完成' :
                   status.status === 'error' ? '失败' : status.status}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">开始时间：</span>
                <span className="ml-2 text-sm text-gray-600">
                  {new Date(status.start_time).toLocaleString()}
                </span>
              </div>
              <div>
                <span className="text-sm font-medium text-gray-700">已用时间：</span>
                <span className="ml-2 text-sm text-gray-600">
                  {formatDuration(getElapsedTime())}
                </span>
              </div>
              {status.result && (
                <div>
                  <span className="text-sm font-medium text-gray-700">总耗时：</span>
                  <span className="ml-2 text-sm text-gray-600">
                    {formatDuration(status.result.total_seconds)}
                  </span>
                </div>
              )}
              {status.result && (
                <div>
                  <span className="text-sm font-medium text-gray-700">峰值内存：</span>
                  <span className="ml-2 text-sm text-gray-600">
                    {status.result.peak_memory_usage} MB
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 操作按钮 */}
          <div className="space-y-3">
            {status.status === 'running' && (
              <button
                onClick={cancelTranslation}
                className="w-full bg-red-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>取消翻译</span>
              </button>
            )}
            
            {status.status === 'completed' && (
              <button
                onClick={() => navigate(`/result/${taskId}`)}
                className="w-full bg-pink-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-pink-700 transition-colors"
              >
                查看结果
              </button>
            )}
            
            <button
              onClick={() => navigate('/')}
              className="w-full bg-gray-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-gray-700 transition-colors"
            >
              返回首页
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Progress