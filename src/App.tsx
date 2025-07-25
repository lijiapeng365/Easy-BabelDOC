/*
 * Easy-BabelDOC - 基于BabelDOC API的Web翻译应用
 * Copyright (C) 2024 lijiapeng365
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 * 
 * Based on BabelDOC: https://github.com/funstory-ai/BabelDOC
 * Source code: https://github.com/lijiapeng365/Easy-BabelDOC
 */

import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import { Toaster } from 'sonner'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Progress from './pages/Progress'
import Result from './pages/Result'
import History from './pages/History'
import Settings from './pages/Settings'
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
