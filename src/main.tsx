import { StrictMode, useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { FaceLandmarker, FilesetResolver } from '@mediapipe/tasks-vision'
import { attemptReducer, initialAttempt } from './lib/attempt'
import {
  loadRanking,
  normalizePlayerName,
  saveRankedAttempt,
  startRankedRun,
  validatePlayerName,
  type RankingEntry,
} from './lib/ranking'
import './styles.css'

type Phase = 'ready' | 'loading' | 'playing' | 'gameover' | 'error'
type Particle = { x: number; y: number; vx: number; vy: number; life: number; size: number }

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
  const runTokenRef = useRef<string | null>(null)
  const [phase, setPhase] = useState<Phase>('ready')
  const [message, setMessage] = useState('')
  const [score, setScore] = useState(0)
  const [speed, setSpeed] = useState(0)
  const [impact, setImpact] = useState(false)
  const [playerName, setPlayerName] = useState(() => localStorage.getItem('voo-bq-player') ?? '')
  const [attempt, dispatchAttempt] = useReducer(attemptReducer, initialAttempt)
  const [ranking, setRanking] = useState<RankingEntry[]>([])
  const [rankingState, setRankingState] = useState<'loading' | 'ready' | 'error'>('loading')

  const stopCamera = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    frameRef.current = null
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    landmarkerRef.current?.close()
    landmarkerRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  const refreshRanking = useCallback(async (signal?: AbortSignal) => {
    setRankingState('loading')
    try {
      setRanking(await loadRanking(signal))
      setRankingState('ready')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setRankingState('error')
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void refreshRanking(controller.signal)
    return () => controller.abort()
  }, [refreshRanking])

  const startGame = useCallback(async () => {
    stopCamera()
    dispatchAttempt({ type: 'reset' })
    runTokenRef.current = null
    setPhase('loading')
    setMessage('Preparando câmera…')
    setImpact(false)
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error('Este navegador não oferece suporte à câmera.')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      })
      streamRef.current = stream
      const video = videoRef.current
      if (!video) throw new Error('Não foi possível iniciar a prévia da câmera.')
      video.srcObject = stream
      await video.play()

      const vision = await FilesetResolver.forVisionTasks('https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm')
      landmarkerRef.current = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task',
        },
        runningMode: 'VIDEO',
        numFaces: 1,
      })

      try {
        runTokenRef.current = await startRankedRun()
      } catch {
        runTokenRef.current = null
      }

      targetYRef.current = GAME_HEIGHT / 2
      setScore(0)
      setSpeed(220)
      setMessage('')
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
    let lastSpeed = 220
    let particleClock = 0
    const particles: Particle[] = []
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const resetObstacle = () => {
      obstacleX = GAME_WIDTH + 90
      const gap = Math.max(108, 196 - elapsed * 1.25)
      gapY = gap / 2 + 52 + Math.random() * (GAME_HEIGHT - gap - 104)
    }

    const drawPortal = (x: number, y: number, width: number, height: number, top: boolean) => {
      const gradient = context.createLinearGradient(x, 0, x + width, 0)
      gradient.addColorStop(0, '#b9cbd5')
      gradient.addColorStop(.5, '#f2f7f8')
      gradient.addColorStop(1, '#8aa3b2')
      context.shadowColor = 'rgba(42, 165, 255, .42)'
      context.shadowBlur = 20
      context.fillStyle = gradient
      context.fillRect(x, y, width, height)
      context.shadowBlur = 0
      context.fillStyle = '#0862a0'
      context.fillRect(x + 11, y, 9, height)
      const capY = top ? y + height - 12 : y
      context.fillStyle = '#b8e85b'
      context.fillRect(x - 7, capY, width + 14, 12)
      context.fillStyle = 'rgba(255,255,255,.7)'
      context.fillRect(x - 7, top ? capY : capY + 10, width + 14, 2)
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

      const collision = obstacleX < 190 && obstacleX + 72 > 126
        && (birdY - 24 < gapY - gap / 2 || birdY + 24 > gapY + gap / 2)
      const displayedScore = Math.floor(scoreProgress)
      if (collision) {
        setScore(displayedScore)
        dispatchAttempt({ type: 'finish', score: displayedScore, runToken: runTokenRef.current })
        setImpact(true)
        window.setTimeout(() => setImpact(false), 520)
        stopCamera()
        setPhase('gameover')
        return
      }
      if (displayedScore !== lastScore) {
        lastScore = displayedScore
        setScore(displayedScore)
      }
      const roundedSpeed = Math.round(gameSpeed)
      if (roundedSpeed !== lastSpeed) {
        lastSpeed = roundedSpeed
        setSpeed(roundedSpeed)
      }

      const sky = context.createLinearGradient(0, 0, 0, GAME_HEIGHT)
      sky.addColorStop(0, '#041526')
      sky.addColorStop(.55, '#062844')
      sky.addColorStop(1, '#07385a')
      context.fillStyle = sky
      context.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

      context.strokeStyle = 'rgba(108, 190, 242, .10)'
      context.lineWidth = 1
      const gridOffset = (elapsed * gameSpeed * .12) % 48
      for (let x = -48 + gridOffset; x < GAME_WIDTH; x += 48) {
        context.beginPath(); context.moveTo(x, 0); context.lineTo(x, GAME_HEIGHT); context.stroke()
      }
      for (let y = 36; y < GAME_HEIGHT; y += 54) {
        context.beginPath(); context.moveTo(0, y); context.lineTo(GAME_WIDTH, y); context.stroke()
      }
      context.fillStyle = 'rgba(112, 199, 255, .16)'
      for (let i = 0; i < 18; i++) {
        const x = (i * 157 - elapsed * gameSpeed * (0.18 + (i % 3) * .08)) % (GAME_WIDTH + 120)
        const wrappedX = x < -120 ? x + GAME_WIDTH + 120 : x
        context.fillRect(wrappedX, 38 + (i * 73) % 450, 28 + (i % 4) * 18, 2)
      }

      if (!reducedMotion) {
        particleClock += delta
        if (particleClock > .035) {
          particleClock = 0
          particles.push({ x: 112, y: birdY + (Math.random() - .5) * 12, vx: -110 - Math.random() * 80, vy: (Math.random() - .5) * 18, life: 1, size: 2 + Math.random() * 4 })
        }
      }
      for (let index = particles.length - 1; index >= 0; index--) {
        const particle = particles[index]
        particle.x += particle.vx * delta
        particle.y += particle.vy * delta
        particle.life -= delta * 1.6
        if (particle.life <= 0) {
          particles.splice(index, 1)
          continue
        }
        context.globalAlpha = particle.life
        context.fillStyle = index % 2 ? '#b8e85b' : '#6cc7ff'
        context.beginPath(); context.arc(particle.x, particle.y, particle.size * particle.life, 0, Math.PI * 2); context.fill()
      }
      context.globalAlpha = 1

      drawPortal(obstacleX, 0, 72, gapY - gap / 2, true)
      drawPortal(obstacleX, gapY + gap / 2, 72, GAME_HEIGHT, false)

      context.save()
      context.translate(135, birdY)
      context.rotate(Math.max(-.35, Math.min(.35, velocity / 450)))
      context.shadowColor = 'rgba(184,232,91,.65)'
      context.shadowBlur = 22
      context.fillStyle = '#f1f6f7'
      context.beginPath(); context.ellipse(0, 0, 28, 20, 0, 0, Math.PI * 2); context.fill()
      context.shadowBlur = 0
      context.fillStyle = '#0872b8'
      context.beginPath(); context.moveTo(-18, -5); context.lineTo(-45, -19); context.lineTo(-35, 8); context.closePath(); context.fill()
      context.fillStyle = '#b8e85b'
      const flap = Math.sin(elapsed * 18) * 5
      context.beginPath(); context.moveTo(-4, 5); context.lineTo(-25, 25 + flap); context.lineTo(12, 15); context.closePath(); context.fill()
      context.fillStyle = '#ffc447'
      context.beginPath(); context.moveTo(24, -4); context.lineTo(42, 2); context.lineTo(24, 8); context.closePath(); context.fill()
      context.fillStyle = '#041526'
      context.beginPath(); context.arc(13, -7, 5, 0, Math.PI * 2); context.fill()
      context.restore()

      frameRef.current = requestAnimationFrame(draw)
    }

    resetObstacle()
    frameRef.current = requestAnimationFrame(draw)
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [phase, stopCamera])

  const saveAttempt = async () => {
    const nameError = validatePlayerName(playerName)
    if (nameError) {
      dispatchAttempt({ type: 'error', message: nameError })
      return
    }
    if (!attempt.runToken) return
    dispatchAttempt({ type: 'save' })
    try {
      const result = await saveRankedAttempt(playerName, attempt.score, attempt.runToken)
      localStorage.setItem('voo-bq-player', normalizePlayerName(playerName))
      dispatchAttempt({ type: 'saved' })
      setRanking((current) => [result.entry, ...current]
        .sort((a, b) => b.score - a.score || Date.parse(a.createdAt) - Date.parse(b.createdAt))
        .slice(0, 10))
      setRankingState('ready')
    } catch (error) {
      dispatchAttempt({ type: 'error', message: error instanceof Error ? error.message : 'Não foi possível salvar.' })
    }
  }

  const cameraLabel = phase === 'playing' ? 'câmera ativa' : phase === 'loading' ? 'iniciando' : 'câmera em espera'
  const decisionMade = attempt.status === 'saved' || attempt.status === 'discarded'

  return <main className="game-page">
    <header>
      <div className="brand"><span className="brand-mark">BQ</span><div><strong>Voo BQ</strong><small>Expô Bentinho</small></div></div>
      <span className={`camera-status camera-status--${phase}`}><i /> {cameraLabel}</span>
    </header>

    <section className="game-layout">
      <div className="info-rail">
        <div className="intro-copy">
          <p className="eyebrow">Minigame por movimento facial</p>
          <h1><span>Voe com o</span><em>rosto.</em></h1>
          <p>Suba e desça movendo o rosto diante da câmera. Sobreviva aos portais e registre seu voo entre os melhores da Expô.</p>
          {(phase === 'ready' || phase === 'error') && <button className="primary-action" onClick={startGame}>{phase === 'error' ? 'Tentar novamente' : 'Ativar câmera e jogar'}</button>}
          {phase === 'error' && <p className="error" role="alert">{message}</p>}
        </div>

        <aside className="leaderboard" aria-labelledby="ranking-title">
          <div className="leaderboard-heading"><div><span>Top 10 global</span><h2 id="ranking-title">Radar de pilotos</h2></div><button onClick={() => void refreshRanking()} aria-label="Atualizar ranking">↻</button></div>
          {rankingState === 'loading' && <p className="ranking-note">Buscando melhores voos…</p>}
          {rankingState === 'error' && <p className="ranking-note">Ranking fora do radar. Atualize para tentar novamente.</p>}
          {rankingState === 'ready' && ranking.length === 0 && <p className="ranking-note">O céu está livre. Salve o primeiro voo.</p>}
          {ranking.length > 0 && <ol>{ranking.map((entry, index) => <li key={entry.id}><span className="rank">{String(index + 1).padStart(2, '0')}</span><strong>{entry.playerName}</strong><b>{entry.score}</b></li>)}</ol>}
        </aside>
      </div>

      <div className={`game-box ${impact ? 'is-impact' : ''}`}>
        <canvas ref={canvasRef} width={GAME_WIDTH} height={GAME_HEIGHT} aria-label="Minigame controlado pelo movimento do rosto" />
        <video className={phase === 'playing' ? 'is-visible' : ''} ref={videoRef} autoPlay muted playsInline />
        {phase === 'playing' && <>
          <div className="score"><span>Pontos</span><strong>{score}</strong></div>
          <div className="telemetry"><span>Velocidade</span><strong>{speed}</strong><i style={{ width: `${Math.min(100, (speed - 220) / 2.8)}%` }} /></div>
          <p className="instruction">Mova o rosto para ajustar a altitude</p>
        </>}
        {phase === 'ready' && <div className="cover"><span>01 — calibrar</span><strong>Ative a câmera para decolar</strong><small>Nenhuma imagem sai deste dispositivo</small></div>}
        {phase === 'loading' && <div className="cover cover--loading"><span>Sincronizando</span><strong>Preparando reconhecimento facial…</strong><i /></div>}
        {phase === 'gameover' && <div className="game-over">
          <span>Fim de voo</span>
          <strong>{score} <small>pontos</small></strong>
          {!decisionMade && attempt.status !== 'unavailable' && <div className="save-panel">
            <label htmlFor="player-name">Nome no ranking</label>
            <div><input id="player-name" value={playerName} maxLength={18} onChange={(event) => setPlayerName(event.target.value)} placeholder="Seu nome" autoComplete="nickname" disabled={attempt.status === 'saving'} /><button onClick={() => void saveAttempt()} disabled={attempt.status === 'saving'}>{attempt.status === 'saving' ? 'Salvando…' : 'Salvar voo'}</button></div>
          </div>}
          {attempt.message && <p className={`attempt-message attempt-message--${attempt.status}`} role="status">{attempt.message}</p>}
          <div className="game-over-actions">
            {!decisionMade && <button className="secondary-action" onClick={() => dispatchAttempt({ type: 'discard' })}>Descartar tentativa</button>}
            {decisionMade && <button className="primary-action" onClick={startGame}>Jogar novamente</button>}
          </div>
        </div>}
        {impact && <div className="impact-flash" aria-hidden="true" />}
      </div>
    </section>
  </main>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>)
