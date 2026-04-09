import { Routes, Route, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import AuroraBackground from './components/AuroraBackground'
import BackgroundAnimation from './components/BackgroundAnimation'
import Home from './pages/Home'
import Board from './pages/Board'
import About from './pages/About'

export default function App() {
  const location = useLocation()
  const onBoard = location.pathname === '/board'

  return (
    <>
      {!onBoard && <AuroraBackground />}
      {!onBoard && <BackgroundAnimation />}
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/board" element={<Board />} />
        <Route path="/about" element={<About />} />
      </Routes>
    </>
  )
}
