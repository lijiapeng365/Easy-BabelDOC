import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { History as HistoryIcon, Clock, FileText, Download, Trash2, Eye, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'

interface HistoryItem {
  task_id: string
  filename: string
  status: string
  source_lang: string
  target_lang: string
  model: string
  start_time: string
  end_time?: string
  progress: number
  error?: string
  result?: {
    mono_pdf_path: string
    dual_pdf_path: string
    total_seconds: number
    peak_memory_usage: number
  }
  file_status?: {
    mono_exists: boolean
    dual_exists: boolean
    mono_size: number
    dual_size: number
  }
}

const History = () => {
  const navigate = useNavigate()
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedItems, setSelectedItems] = useState<string[]>([])
  const [filter, setFilter] = useState<'all' | 'completed' | 'running' | 'error'>('all')
  const [sortBy, setSortBy] = useState<'time' | 'status' | 'filename'>('time')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    loadHistory()
  }, [])

  const loadHistory = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/translations')
      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      } else {
        toast.error('加载历史记录失败')
      }
    } catch (error) {
      console.error('Failed to load history:', error)
      toast.error('网络错误，无法加载历史记录')
    } finally {
      setLoading(false)
    }
  }

  const getLanguageName = (code: string) => {
    const languages: { [key: string]: string } = {
      'auto': '自动检测',
      'zh': '中文',
      'en': '英文',
      'ja': '日文',
      'ko': '韩文',
      'fr': '法文',
      'de': '德文',
      'es': '西班牙文',
      'ru': '俄文'
    }
    return languages[code] || code
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'running':
        return <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
      case 'error':
        return <AlertCircle className="h-5 w-5 text-red-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'completed':
        return '已完成'
      case 'running':
        return '进行中'
      case 'error':
        return '失败'
      default:
        return status
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'running':
        return 'bg-blue-100 text-blue-800'
      case 'error':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
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

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const filteredHistory = history.filter(item => {
    if (filter === 'all') return true
    return item.status === filter
  })

  const sortedHistory = [...filteredHistory].sort((a, b) => {
    let comparison = 0
    
    switch (sortBy) {
      case 'time':
        comparison = new Date(a.start_time).getTime() - new Date(b.start_time).getTime()
        break
      case 'status':
        comparison = a.status.localeCompare(b.status)
        break
      case 'filename':
        comparison = a.filename.localeCompare(b.filename)
        break
    }
    
    return sortOrder === 'asc' ? comparison : -comparison
  })

  const toggleSelectItem = (taskId: string) => {
    setSelectedItems(prev => 
      prev.includes(taskId) 
        ? prev.filter(id => id !== taskId)
        : [...prev, taskId]
    )
  }

  const selectAll = () => {
    if (selectedItems.length === sortedHistory.length) {
      setSelectedItems([])
    } else {
      setSelectedItems(sortedHistory.map(item => item.task_id))
    }
  }

  const deleteSelected = async () => {
    if (selectedItems.length === 0) return
    
    if (!window.confirm(`确定要删除选中的 ${selectedItems.length} 条记录吗？`)) return
    
    try {
      const response = await fetch('http://localhost:8000/api/translations', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(selectedItems)
      })
      
      if (response.ok) {
        toast.success(`已删除 ${selectedItems.length} 条记录`)
        setSelectedItems([])
        // 重新加载历史记录
        loadHistory()
      } else {
        const error = await response.json()
        toast.error(error.detail || '删除失败')
      }
    } catch (error) {
      console.error('Delete failed:', error)
      toast.error('网络错误，删除失败')
    }
  }

  const viewDetails = (taskId: string, status: string) => {
    if (status === 'completed') {
      navigate(`/result/${taskId}`)
    } else if (status === 'running') {
      navigate(`/progress/${taskId}`)
    } else {
      navigate(`/result/${taskId}`)
    }
  }

  const downloadResult = async (taskId: string, type: 'mono' | 'dual') => {
    try {
      const response = await fetch(`http://localhost:8000/api/translation/${taskId}/download/${type}`)
      
      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.style.display = 'none'
        a.href = url
        a.download = `${taskId}_${type}.pdf`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
        
        toast.success(`${type === 'mono' ? '单语' : '双语'}PDF下载成功`)
      } else {
        const error = await response.json().catch(() => ({ detail: '下载失败' }))
        toast.error(error.detail || '下载失败')
      }
    } catch (error) {
      console.error('Download failed:', error)
      toast.error('网络错误，下载失败')
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载历史记录...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center">
          <HistoryIcon className="h-8 w-8 mr-2 text-pink-600" />
          翻译历史
        </h1>
        <p className="text-gray-600">查看和管理您的翻译记录</p>
      </div>

      {/* 筛选和排序 */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
          <div className="flex items-center space-x-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">状态筛选：</label>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value as any)}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="all">全部</option>
                <option value="completed">已完成</option>
                <option value="running">进行中</option>
                <option value="error">失败</option>
              </select>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-700 mr-2">排序：</label>
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [by, order] = e.target.value.split('-')
                  setSortBy(by as any)
                  setSortOrder(order as any)
                }}
                className="px-3 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-pink-500 focus:border-transparent"
              >
                <option value="time-desc">时间（新到旧）</option>
                <option value="time-asc">时间（旧到新）</option>
                <option value="filename-asc">文件名（A-Z）</option>
                <option value="filename-desc">文件名（Z-A）</option>
                <option value="status-asc">状态（A-Z）</option>
                <option value="status-desc">状态（Z-A）</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            {selectedItems.length > 0 && (
              <button
                onClick={deleteSelected}
                className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700 transition-colors flex items-center space-x-1"
              >
                <Trash2 className="h-4 w-4" />
                <span>删除选中 ({selectedItems.length})</span>
              </button>
            )}
            
            <button
              onClick={loadHistory}
              className="bg-gray-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-gray-700 transition-colors flex items-center space-x-1"
            >
              <RefreshCw className="h-4 w-4" />
              <span>刷新</span>
            </button>
          </div>
        </div>
      </div>

      {/* 历史记录列表 */}
      {sortedHistory.length > 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* 表头 */}
          <div className="bg-gray-50 px-6 py-3 border-b border-gray-200">
            <div className="flex items-center">
              <input
                type="checkbox"
                checked={selectedItems.length === sortedHistory.length && sortedHistory.length > 0}
                onChange={selectAll}
                className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded mr-4"
              />
              <span className="text-sm font-medium text-gray-700">选择全部</span>
            </div>
          </div>
          
          {/* 记录列表 */}
          <div className="divide-y divide-gray-200">
            {sortedHistory.map((item) => (
              <div key={item.task_id} className="px-6 py-4 hover:bg-gray-50 transition-colors">
                <div className="flex items-center space-x-4">
                  <input
                    type="checkbox"
                    checked={selectedItems.includes(item.task_id)}
                    onChange={() => toggleSelectItem(item.task_id)}
                    className="h-4 w-4 text-pink-600 focus:ring-pink-500 border-gray-300 rounded"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <FileText className="h-5 w-5 text-gray-400" />
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 truncate">
                            {item.filename}
                          </h3>
                          <p className="text-xs text-gray-500">
                            {getLanguageName(item.source_lang)} → {getLanguageName(item.target_lang)} | {item.model}
                          </p>
                        </div>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <div className="flex items-center space-x-2">
                          {getStatusIcon(item.status)}
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(item.status)}`}>
                            {getStatusText(item.status)}
                          </span>
                        </div>
                        
                        {item.status === 'running' && (
                          <div className="text-sm text-gray-600">
                            {Math.round(item.progress)}%
                          </div>
                        )}
                        
                        <div className="text-sm text-gray-500">
                          {new Date(item.start_time).toLocaleString()}
                        </div>
                        
                        {item.result && (
                      <div className="text-sm text-gray-500">
                        {formatDuration(item.result.total_seconds)}
                      </div>
                    )}
                    
                    {/* 文件状态显示 */}
                    {item.file_status && item.status === 'completed' && (
                      <div className="flex items-center space-x-2 text-xs">
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                          item.file_status.mono_exists ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <span>单语:</span>
                          {item.file_status.mono_exists ? (
                            <span>✓ {formatFileSize(item.file_status.mono_size)}</span>
                          ) : (
                            <span>✗ 缺失</span>
                          )}
                        </div>
                        <div className={`flex items-center space-x-1 px-2 py-1 rounded ${
                          item.file_status.dual_exists ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <span>双语:</span>
                          {item.file_status.dual_exists ? (
                            <span>✓ {formatFileSize(item.file_status.dual_size)}</span>
                          ) : (
                            <span>✗ 缺失</span>
                          )}
                        </div>
                      </div>
                    )}
                      </div>
                    </div>
                    
                    {item.error && (
                      <div className="mt-2 text-sm text-red-600 bg-red-50 p-2 rounded">
                        错误：{item.error}
                      </div>
                    )}
                    
                    {item.status === 'running' && (
                      <div className="mt-2">
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${item.progress}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => viewDetails(item.task_id, item.status)}
                      className="text-pink-600 hover:text-pink-800 p-2 rounded-lg hover:bg-pink-50 transition-colors"
                      title="查看详情"
                    >
                      <Eye className="h-4 w-4" />
                    </button>
                    
                    {item.status === 'completed' && item.result && (
                      <>
                        {/* 单语PDF下载按钮 */}
                        {item.file_status?.mono_exists && (
                          <button
                            onClick={() => downloadResult(item.task_id, 'mono')}
                            className="text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-blue-50 transition-colors"
                            title={`下载单语PDF (${formatFileSize(item.file_status.mono_size)})`}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* 双语PDF下载按钮 */}
                        {item.file_status?.dual_exists && (
                          <button
                            onClick={() => downloadResult(item.task_id, 'dual')}
                            className="text-green-600 hover:text-green-800 p-2 rounded-lg hover:bg-green-50 transition-colors"
                            title={`下载双语PDF (${formatFileSize(item.file_status.dual_size)})`}
                          >
                            <Download className="h-4 w-4" />
                          </button>
                        )}
                        
                        {/* 文件缺失提示 */}
                        {(!item.file_status?.mono_exists || !item.file_status?.dual_exists) && (
                          <div className="text-xs text-red-600 bg-red-50 px-2 py-1 rounded">
                            部分文件缺失
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
          <HistoryIcon className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">暂无翻译记录</h3>
          <p className="text-gray-600 mb-6">开始您的第一次翻译吧！</p>
          <button
            onClick={() => navigate('/')}
            className="bg-pink-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-pink-700 transition-colors"
          >
            开始翻译
          </button>
        </div>
      )}
    </div>
  )
}

export default History