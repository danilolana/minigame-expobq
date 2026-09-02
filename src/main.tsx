import { StrictMode, useCallback, useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import './styles.css'

type Phase = 'ready' | 'loading' | 'playing' | 'gameover' | 'error'

const GAME_WIDTH = 960
const GAME_HEIGHT = 540

function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const landmarkerRef = useRef<FaceLandmarker | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const frameRef = useRef<number | null>(null)
  const lastVideoTimeRef = useRef(-1)
  const targetYRef = useRef(GAME_HEIGHT / 2)
  const [phase, setPhase] = useState<Phase>('ready')
  const [message, setMessage] = useState('')
  const [score, setScore] = useState(0)
  const [speed, setSpeed] = useState(0)

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    landmarkerRef.current?.close()
    landmarkerRef.current = null
  }, [])

  const startGame = useCallback(async () => {
    stopCamera()
    setPhase('loading')
    setMessage('Preparando câmera…')
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não oferece suporte à câmera.')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Não foi possível iniciar a prévia da câmera.')
      video.srcObject = stream
      await video.play()
      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm')
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task' },
        runningMode: 'VIDEO',
        numFaces: 1,
      })
      targetYRef.current = GAME_HEIGHT / 2
      setScore(0)
      setSpeed(0)
      setPhase('playing')
    } catch (error) {
      stopCamera()
      setMessage(error instanceof Error ? error.message : 'Não foi possível usar a câmera.')
      setPhase('error')
    }
  }, [stopCamera])

  useEffect(() => stopCamera, [stopCamera])

  useEffect(() => {
    if (phase !== 'playing' || !canvasRef.current) return
    const canvas = canvasRef.current
    const context = canvas.getContext('2d')
    if (!context) return
    let birdY = GAME_HEIGHT / 2
    let velocity = 0
    let obstacleX = GAME_WIDTH + 100
    let gapY = GAME_HEIGHT / 2
    let scoreProgress = 0
    let elapsed = 0
    let lastTime = performance.now()
    let lastScore = 0

    const resetObstacle = () => {
      obstacleX = GAME_WIDTH + 90
      const gap = Math.max(108, 196 - elapsed * 1.25)
      gapY = gap / 2 + 52 + Math.random() * (GAME_HEIGHT - gap - 104)
    }
    const draw = (time: number) => {
      const delta = Math.min((time - lastTime) / 1000, 0.05)
      lastTime = time
      elapsed += delta
      const video = videoRef.current
      const detector = landmarkerRef.current
      if (video && detector && video.readyState >= 2 && video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime
        const result = detector.detectForVideo(video, performance.now())
        const nose = result.faceLandmarks[0]?.[1]
        if (nose) targetYRef.current = 70 + nose.y * (GAME_HEIGHT - 140)
      }
      velocity += (targetYRef.current - birdY) * 8 * delta
      velocity *= 0.84
      birdY = Math.max(30, Math.min(GAME_HEIGHT - 30, birdY + velocity * delta))
      const gameSpeed = Math.min(500, 220 + elapsed * 8)
      const gap = Math.max(108, 196 - elapsed * 1.25)
      scoreProgress += gameSpeed * delta / 18
      obstacleX -= gameSpeed * delta
      if (obstacleX < -80) resetObstacle()
      const collision = obstacleX < 190 && obstacleX + 72 > 126 && (birdY - 24 < gapY - gap / 2 || birdY + 24 > gapY + gap / 2)
      const displayedScore = Math.floor(scoreProgress)
      if (collision) {
        setScore(displayedScore)
        setPhase('gameover')
        return
      }
      if (displayedScore !== lastScore) { lastScore = displayedScore; setScore(displayedScore) }
      setSpeed(Math.round(gameSpeed))

      context.fillStyle = '#061d33'; context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)
      context.strokeStyle = 'rgba(155,207,74,.10)'; context.lineWidth = 1
      for (let x = 0; x < GAME_WIDTH; x += 48) { context.beginPath(); context.moveTo(x, 0); context.lineTo(x, GAME_HEIGHT); context.stroke() }
      for (let y = 0; y < GAME_HEIGHT; y += 48) { context.beginPath(); context.moveTo(0, y); context.lineTo(GAME_WIDTH, y); context.stroke() }
      context.fillStyle = '#dce7eb'; context.fillRect(obstacleX, 0, 72, gapY - gap / 2); context.fillRect(obstacleX, gapY + gap / 2, 72, GAME_HEIGHT)
      context.fillStyle = '#07518b'; context.fillRect(obstacleX + 10, 0, 10, gapY - gap / 2); context.fillRect(obstacleX + 10, gapY + gap / 2, 10, GAME_HEIGHT)
      context.fillStyle = '#9bcf4a'; context.fillRect(obstacleX - 6, gapY - gap / 2 - 12, 84, 12); context.fillRect(obstacleX - 6, gapY + gap / 2, 84, 12)
      context.save(); context.translate(135, birdY); context.rotate(Math.max(-.35, Math.min(.35, velocity / 450)))
      context.fillStyle = '#f1f5f6'; context.beginPath(); context.ellipse(0, 0, 28, 20, 0, 0, Math.PI * 2); context.fill()
      context.fillStyle = '#07518b'; context.beginPath(); context.moveTo(-18, -5); context.lineTo(-45, -19); context.lineTo(-35, 8); context.closePath(); context.fill()
      context.fillStyle = '#9bcf4a'; context.beginPath(); context.moveTo(-4, 5); context.lineTo(-25, 27); context.lineTo(12, 15); context.closePath(); context.fill()
      context.fillStyle = '#efb72f'; context.beginPath(); context.moveTo(24, -4); context.lineTo(42, 2); context.lineTo(24, 8); context.closePath(); context.fill()
      context.fillStyle = '#061d33'; context.beginPath(); context.arc(13, -7, 5, 0, Math.PI * 2); context.fill(); context.restore()
      frameRef.current = requestAnimationFrame(draw)
    }
    resetObstacle()
    frameRef.current = requestAnimationFrame(draw)
    return () => { if (frameRef.current !== null) cancelAnimationFrame(frameRef.current) }
  }, [phase])

  return <main className="game-page">
    <header><div className="brand"><span className="brand-mark">BQ</span><div><strong>Voo BQ</strong><small>Expô Bentinho</small></div></div><span className="camera-status"><i /> câmera</span></header>
    <section className="game-layout">
      <div className="intro-copy"><p className="eyebrow">Minigame por movimento facial</p><h1>Voe com o <em>rosto.</em></h1><p>Suba e desça movendo o rosto diante da câmera. Quanto mais você sobrevive, mais veloz e estreito fica o caminho. Uma batida encerra a partida.</p>{(phase === 'ready' || phase === 'error') && <button onClick={startGame}>{phase === 'error' ? 'Tentar novamente' : 'Ativar câmera e jogar'}</button>}{phase === 'error' && <p className="error">{message}</p>}</div>
      <div className="game-box"><canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} aria-label="Minigame controlado pelo movimento do rosto" /><video ref={videoRef} autoPlay muted playsInline />{phase === 'playing' && <><div className="score">Pontos <strong>{score}</strong><small>Velocidade {speed}</small></div><p className="instruction">Mova o rosto para controlar o pássaro</p></>}{phase === 'ready' && <div className="cover">Ative a câmera para começar</div>}{phase === 'loading' && <div className="cover">Preparando reconhecimento facial…</div>}{phase === 'gameover' && <div className="game-over"><span>Game Over</span><strong>{score} pontos</strong><p>Uma batida encerra a partida.</p><button onClick={startGame}>Jogar novamente</button></div>}</div>
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
