import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminPage } from './pages/AdminPage'
import { GamePage } from './pages/GamePage'
import { RankingPage } from './pages/RankingPage'

export function App() {
  return <Routes>
    <Route path="/" element={<GamePage />} />
    <Route path="/jogo" element={<GamePage />} />
    <Route path="/ranking" element={<RankingPage />} />
    <Route path="/adm" element={<AdminPage />} />
    <Route path="*" element={<Navigate to="/" replace />} />
  </Routes>
}
