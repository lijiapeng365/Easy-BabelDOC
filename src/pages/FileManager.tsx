import React, { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { 
  HardDrive, 
  Trash2, 
  RefreshCw, 
  AlertTriangle,
  CheckCircle,
  FileText,
  BarChart3
} from 'lucide-react'

interface FileStats {
  total_files: number
  total_size: number
  by_status: {
    [key: string]: {
      count: number
      size: number
    }
  }
}

interface CleanupResult {
  orphan_files: string[]
  orphan_records: Array<{
    task_id: string
    filename: string
    mono_missing: boolean
    dual_missing: boolean
  }>
  deleted_files: number
  deleted_records: number
}

const FileManager = () => {
  const [stats, setStats] = useState<FileStats | null>(null)
  const [cleanupResult, setCleanupResult] = useState<CleanupResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [scanning, setScanning] = useState(false)

  useEffect(() => {
    loadStats()
  }, [])

  const loadStats = async () => {
    setLoading(true)
    try {
      const response = await fetch('http://localhost:8000/api/files/stats')
      if (response.ok) {
        const data = await response.json()
        setStats(data)
      } else {
        toast.error('加载统计信息失败')
      }
    } catch (error) {
      console.error('Failed to load stats:', error)
      toast.error('网络错误，无法加载统计信息')
    } finally {
      setLoading(false)
    }
  }

  const scanFiles = async () => {
    setScanning(true)
    try {
      const response = await fetch('http://localhost:8000/api/files/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          delete_orphan_files: false,
          delete_orphan_records: false
        })
      })
      
      if (response.ok) {
        const data = await response.json()
        setCleanupResult(data)
        toast.success('文件扫描完成')
      } else {
        const error = await response.json()
        toast.error(error.detail || '扫描失败')
      }
    } catch (error) {
      console.error('Scan failed:', error)
      toast.error('网络错误，扫描失败')
    } finally {
      setScanning(false)
    }
  }

  const cleanupFiles = async (deleteFiles: boolean, deleteRecords: boolean) => {
    console.log('cleanupFiles called with:', { deleteFiles, deleteRecords })
    console.log('cleanupResult:', cleanupResult)
    
    if (!cleanupResult) {
      console.log('No cleanup result, returning early')
      toast.info('请先扫描文件')
      return
    }
    
    const fileCount = deleteFiles ? cleanupResult.orphan_files.length : 0
    const recordCount = deleteRecords ? cleanupResult.orphan_records.length : 0
    
    console.log('File count:', fileCount, 'Record count:', recordCount)
    
    if (fileCount === 0 && recordCount === 0) {
      console.log('No items to cleanup')
      toast.info('没有需要清理的项目')
      return
    }
    
    const message = `确定要删除 ${fileCount} 个孤儿文件和 ${recordCount} 条孤儿记录吗？`
    if (!window.confirm(message)) return
    
    setLoading(true)
    try {
      const requestBody = {
        delete_orphan_files: deleteFiles,
        delete_orphan_records: deleteRecords
      }
      console.log('Request body to be sent:', requestBody)
      console.log('JSON stringified body:', JSON.stringify(requestBody))
      
      const response = await fetch('http://localhost:8000/api/files/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      })
      
      if (response.ok) {
        const data = await response.json()
        
        // 构建成功消息
        let successMessage = `清理完成：删除了 ${data.deleted_files} 个文件和 ${data.deleted_records} 条记录`
        
        // 显示警告信息（如果有）
        if (data.warnings && data.warnings.length > 0) {
          data.warnings.forEach((warning: any) => {
            toast.info(warning.message, { duration: 4000 })
          })
        }
        
        // 显示错误信息（如果有）
        if (data.errors && data.errors.length > 0) {
          data.errors.forEach((error: any) => {
            let errorMessage = error.message
            if (error.type === 'permission_error') {
              errorMessage += '\n请关闭相关程序后重试'
            }
            toast.error(errorMessage, { duration: 6000 })
          })
          
          // 如果有错误，修改成功消息
          if (data.errors.length > 0) {
            const failedCount = data.errors.length
            successMessage += `\n${failedCount} 个文件删除失败`
          }
        }
        
        // 显示最终结果
        if (data.deleted_files > 0 || data.deleted_records > 0) {
          toast.success(successMessage)
        } else if (data.errors && data.errors.length > 0) {
          toast.error('清理失败，请查看详细错误信息')
        } else {
          toast.info('没有需要清理的项目')
        }
        
        // 重新加载数据
        loadStats()
        scanFiles()
      } else {
        const error = await response.json()
        toast.error(error.detail || '清理失败')
      }
    } catch (error) {
      console.error('Cleanup failed:', error)
      toast.error('网络错误，清理失败')
    } finally {
      setLoading(false)
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  if (loading && !stats) {
    return (
      <div className="max-w-6xl mx-auto">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-600 mx-auto mb-4"></div>
          <p className="text-gray-600">加载文件管理信息...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center justify-center">
          <HardDrive className="h-8 w-8 mr-2 text-pink-600" />
          文件管理
        </h1>
        <p className="text-gray-600">管理翻译文件和存储空间</p>
      </div>

      {/* 存储统计 */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <FileText className="h-8 w-8 text-blue-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">总文件数</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_files}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <HardDrive className="h-8 w-8 text-green-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">总存储大小</p>
                <p className="text-2xl font-bold text-gray-900">{formatFileSize(stats.total_size)}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center">
              <BarChart3 className="h-8 w-8 text-purple-600 mr-3" />
              <div>
                <p className="text-sm font-medium text-gray-600">已完成任务</p>
                <p className="text-2xl font-bold text-gray-900">{stats.by_status.completed?.count || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 按状态分类统计 */}
      {stats && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">按状态分类</h2>
          <div className="space-y-3">
            {Object.entries(stats.by_status).map(([status, data]) => (
              <div key={status} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    status === 'completed' ? 'bg-green-100 text-green-800' :
                    status === 'running' ? 'bg-blue-100 text-blue-800' :
                    status === 'error' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}>
                    {status === 'completed' ? '已完成' :
                     status === 'running' ? '进行中' :
                     status === 'error' ? '失败' : status}
                  </span>
                  <span className="text-sm text-gray-600">{data.count} 个任务</span>
                </div>
                <span className="text-sm font-medium text-gray-900">{formatFileSize(data.size)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件扫描和清理 */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">文件完整性检查</h2>
          <div className="flex space-x-3">
            <button
              onClick={loadStats}
              disabled={loading}
              className="bg-gray-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-gray-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              <span>刷新统计</span>
            </button>
            
            <button
              onClick={scanFiles}
              disabled={scanning}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${scanning ? 'animate-spin' : ''}`} />
              <span>扫描文件</span>
            </button>
          </div>
        </div>

        {cleanupResult && (
          <div className="space-y-6">
            {/* 孤儿文件 */}
            <div className="border border-orange-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <h3 className="font-medium text-orange-900">孤儿文件</h3>
                <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-sm">
                  {cleanupResult.orphan_files.length} 个
                </span>
              </div>
              
              {cleanupResult.orphan_files.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-orange-700 mb-2">
                    这些文件存在于文件系统中，但没有对应的历史记录：
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {cleanupResult.orphan_files.map((file, index) => (
                      <div key={index} className="text-xs text-gray-600 bg-gray-50 p-2 rounded">
                        {file}
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => cleanupFiles(true, false)}
                    disabled={loading}
                    className="bg-orange-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-orange-700 transition-colors disabled:opacity-50"
                  >删除孤儿文件</button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">没有发现孤儿文件</span>
                </div>
              )}
            </div>

            {/* 孤儿记录 */}
            <div className="border border-red-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-3">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <h3 className="font-medium text-red-900">孤儿记录</h3>
                <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                  {cleanupResult.orphan_records.length} 个
                </span>
              </div>
              
              {cleanupResult.orphan_records.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-sm text-red-700 mb-2">
                    这些记录的对应文件已丢失：
                  </p>
                  <div className="max-h-40 overflow-y-auto space-y-2">
                    {cleanupResult.orphan_records.map((record, index) => (
                      <div key={index} className="text-xs bg-gray-50 p-2 rounded">
                        <div className="font-medium text-gray-900">{record.filename}</div>
                        <div className="text-gray-600">任务ID: {record.task_id}</div>
                        <div className="flex space-x-2 mt-1">
                          {record.mono_missing && (
                            <span className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-xs">单语文件缺失</span>
                          )}
                          {record.dual_missing && (
                            <span className="bg-red-100 text-red-700 px-1 py-0.5 rounded text-xs">双语文件缺失</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={() => cleanupFiles(false, true)}
                    disabled={loading}
                    className="bg-red-600 text-white px-3 py-1 rounded text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    删除孤儿记录
                  </button>
                </div>
              ) : (
                <div className="flex items-center space-x-2 text-green-700">
                  <CheckCircle className="h-4 w-4" />
                  <span className="text-sm">所有记录的文件都存在</span>
                </div>
              )}
            </div>

            {/* 批量清理 */}
            {(cleanupResult.orphan_files.length > 0 || cleanupResult.orphan_records.length > 0) && (
              <div className="border border-gray-200 rounded-lg p-4">
                <h3 className="font-medium text-gray-900 mb-3">批量清理</h3>
                <button
                  onClick={() => cleanupFiles(true, true)}
                  disabled={loading}
                  className="bg-red-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                  <span>清理所有孤儿项目</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default FileManager