import { Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Progress from './pages/Progress'
import Result from './pages/Result'
import Settings from './pages/Settings'
import History from './pages/History'
import FileManager from './pages/FileManager'

export default function App() {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      <main className="container mx-auto px-4 py-8">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/progress/:taskId" element={<Progress />} />
          <Route path="/result/:taskId" element={<Result />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/history" element={<History />} />
          <Route path="/file-manager" element={<FileManager />} />
        </Routes>
      </main>
      <Toaster position="top-right" richColors />
    </div>
  )
}
