import DashboardLayout from "@/components/DashboardLayout";
import { trpc } from "@/lib/trpc";
import { useCallback, useEffect, useRef, useState } from "react";
import { Mic, MicOff, Loader2, MessageSquare, Keyboard } from "lucide-react";

type Message = { role: "user" | "noah"; text: string };

const SpeechRecognition =
  (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

// ── Visualizador JARVIS — Esfera viva com particulas explosivas ──
function JarvisVisualizer({
  state,
  analyser,
}: {
  state: "idle" | "listening" | "processing" | "speaking";
  analyser: AnalyserNode | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number>(0);
  const particlesRef = useRef<any[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const dpr = window.devicePixelRatio || 1;
    const size = 500;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    const CENTER = size / 2;
    const SPHERE_RADIUS = 160;
    const NUM_PARTICLES = 180;

    if (particlesRef.current.length === 0) {
      for (let i = 0; i < NUM_PARTICLES; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(2 * Math.random() - 1);
        const r = Math.pow(Math.random(), 0.5) * SPHERE_RADIUS;
        particlesRef.current.push({
          theta,
          phi,
          r,
          homeR: r, // posicao "casa" pra voltar
          vTheta: (Math.random() - 0.5) * 0.01,
          vPhi: (Math.random() - 0.5) * 0.006,
          baseSize: 2.5 + Math.random() * 4, // PONTOS BEM MAIORES
          brightness: 0.4 + Math.random() * 0.6,
          phase: Math.random() * Math.PI * 2,
          energy: 0,
          // Velocidade de "salto" quando fala
          jumpVx: 0,
          jumpVy: 0,
          jumpVz: 0,
        });
      }
    }
    const particles = particlesRef.current;

    let t = 0;
    const dataArray = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    function draw() {
      ctx.clearRect(0, 0, size, size);
      t += 0.016;

      // Audio data
      let avgLevel = 0;
      let peakLevel = 0;
      let audioLevels: number[] = [];
      if (analyser && dataArray && state === "speaking") {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i];
          if (dataArray[i] / 255 > peakLevel) peakLevel = dataArray[i] / 255;
        }
        avgLevel = sum / dataArray.length / 255;
        const step = Math.max(1, Math.floor(dataArray.length / NUM_PARTICLES));
        for (let i = 0; i < NUM_PARTICLES; i++) {
          audioLevels.push(dataArray[Math.min(i * step, dataArray.length - 1)] / 255);
        }
      }

      const colors = {
        idle: { r: 59, g: 130, b: 246 },
        listening: { r: 212, g: 175, b: 55 },
        processing: { r: 249, g: 115, b: 22 },
        speaking: { r: 59, g: 130, b: 246 },
      };
      const c = colors[state];

      // Glow de fundo da esfera
      const bgGlow = ctx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, SPHERE_RADIUS + 40);
      const glowAlpha = state === "idle" ? 0.06 : state === "speaking" ? 0.12 + avgLevel * 0.15 : 0.1;
      bgGlow.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${glowAlpha * 1.5})`);
      bgGlow.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, ${glowAlpha * 0.4})`);
      bgGlow.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
      ctx.fillStyle = bgGlow;
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, SPHERE_RADIUS + 40, 0, Math.PI * 2);
      ctx.fill();

      // Borda esfera
      const borderPulse = state === "speaking" ? 1 + avgLevel * 0.3 : 1;
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, SPHERE_RADIUS * borderPulse, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${state === "idle" ? 0.06 : 0.12})`;
      ctx.lineWidth = state === "speaking" ? 1 + avgLevel * 2 : 1;
      ctx.stroke();

      // Calcular posicoes das particulas
      const sorted: { x: number; y: number; z: number; size: number; alpha: number; idx: number; glow: boolean }[] = [];

      for (let i = 0; i < particles.length; i++) {
        const p = particles[i];

        // Velocidade orbital varia com estado
        let speedMult = 1;
        if (state === "speaking") speedMult = 1.5 + avgLevel * 3;
        else if (state === "listening") speedMult = 2;
        else if (state === "processing") speedMult = 3.5;

        p.theta += p.vTheta * speedMult;
        p.phi += p.vPhi * speedMult;

        // Audio reactivo — SALTO EXPLOSIVO
        if (state === "speaking" && audioLevels.length > 0) {
          const level = audioLevels[i] || 0;
          p.energy = p.energy * 0.7 + level * 0.3; // reacao mais rapida

          // Quando o audio bate forte, da um "kick" aleatorio na particula
          if (level > 0.5 && Math.random() < 0.3) {
            const kickForce = level * 80;
            p.jumpVx += (Math.random() - 0.5) * kickForce;
            p.jumpVy += (Math.random() - 0.5) * kickForce;
            p.jumpVz += (Math.random() - 0.5) * kickForce;
          }
        } else {
          p.energy *= 0.92;
        }

        // Aplicar e desacelerar o salto
        p.jumpVx *= 0.92;
        p.jumpVy *= 0.92;
        p.jumpVz *= 0.92;

        // Raio base com expansao
        let currentR = p.r;
        if (state === "speaking") {
          currentR = p.r + p.energy * 70; // expansao MUITO maior
        } else if (state === "listening") {
          currentR = p.r + Math.sin(t * 1.5 + p.phase) * 25;
        } else if (state === "processing") {
          currentR = p.r + Math.sin(t * 4 + p.phase) * 12;
        } else {
          currentR = p.r + Math.sin(t * 0.5 + p.phase) * 8;
        }

        // 3D → 2D
        let x3d = currentR * Math.sin(p.phi) * Math.cos(p.theta) + p.jumpVx;
        let y3d = currentR * Math.sin(p.phi) * Math.sin(p.theta) + p.jumpVy;
        let z3d = currentR * Math.cos(p.phi) + p.jumpVz;

        // Conter dentro de um raio maximo (pode ultrapassar a esfera com o salto!)
        const maxR = SPHERE_RADIUS * (state === "speaking" ? 1.6 : 1.05);
        const actualDist = Math.sqrt(x3d * x3d + y3d * y3d + z3d * z3d);
        if (actualDist > maxR) {
          const scale2 = maxR / actualDist;
          x3d *= scale2;
          y3d *= scale2;
          z3d *= scale2;
          // Bounce back
          p.jumpVx *= -0.3;
          p.jumpVy *= -0.3;
          p.jumpVz *= -0.3;
        }

        // Projecao perspectiva
        const perspective = 500;
        const scale = perspective / (perspective + z3d);
        const screenX = CENTER + x3d * scale;
        const screenY = CENTER + y3d * scale;

        // Profundidade
        const depthFactor = (z3d + SPHERE_RADIUS * 1.6) / (3.2 * SPHERE_RADIUS);
        let dotSize = p.baseSize * scale * (0.5 + depthFactor * 0.5);
        let alpha = p.brightness * (0.2 + depthFactor * 0.8);

        // Speaking — pontos crescem e brilham mais
        let hasGlow = false;
        if (state === "speaking") {
          dotSize += p.energy * 8; // cresce MUITO quando o audio bate
          alpha = Math.min(1, alpha + p.energy * 0.6);
          hasGlow = p.energy > 0.3;
        } else if (state === "listening") {
          dotSize += Math.sin(t * 2 + p.phase) * 1.5;
          alpha = Math.min(1, 0.4 + Math.sin(t * 1.5 + p.phase) * 0.3);
        } else if (state === "idle") {
          alpha *= 0.4 + Math.sin(t * 0.6 + p.phase) * 0.25;
        }

        sorted.push({ x: screenX, y: screenY, z: z3d, size: dotSize, alpha, idx: i, glow: hasGlow });
      }

      // Ordenar por Z
      sorted.sort((a, b) => a.z - b.z);

      // Desenhar particulas
      for (const pt of sorted) {
        // Glow grande nos pontos que saltaram
        if (pt.glow) {
          const glowR = pt.size + 10;
          const g = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, glowR);
          g.addColorStop(0, `rgba(${c.r}, ${c.g}, ${c.b}, ${pt.alpha * 0.4})`);
          g.addColorStop(0.5, `rgba(${c.r}, ${c.g}, ${c.b}, ${pt.alpha * 0.1})`);
          g.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
          ctx.fillStyle = g;
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, glowR, 0, Math.PI * 2);
          ctx.fill();
        }

        // Ponto principal
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${pt.alpha})`;
        ctx.fill();

        // Halo sutil em todos os pontos da frente
        if (pt.z > 0 && pt.size > 3) {
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, pt.size + 4, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${pt.alpha * 0.1})`;
          ctx.fill();
        }
      }

      // MOLECULAS — linhas conectando pontos proximos (SEMPRE, todos os estados)
      const CONNECT_DIST = state === "speaking" ? 70 : state === "listening" ? 55 : 45;
      const LINE_BASE_ALPHA = state === "speaking" ? 0.25 : state === "listening" ? 0.15 : 0.08;
      const LINE_WIDTH = state === "speaking" ? 1.2 : 0.8;
      for (let i = 0; i < sorted.length; i++) {
        const a = sorted[i];
        for (let j = i + 1; j < sorted.length; j++) {
          const b = sorted[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECT_DIST) {
            const proximity = 1 - dist / CONNECT_DIST;
            // Profundidade media dos dois pontos — linhas no fundo mais fracas
            const avgDepth = ((a.z + b.z) / 2 + SPHERE_RADIUS * 1.6) / (3.2 * SPHERE_RADIUS);
            const lineAlpha = proximity * LINE_BASE_ALPHA * (0.3 + avgDepth * 0.7);
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = `rgba(${c.r}, ${c.g}, ${c.b}, ${lineAlpha})`;
            ctx.lineWidth = LINE_WIDTH * (0.5 + proximity * 0.5);
            ctx.stroke();
          }
        }
      }

      // Nucleo brilhante
      const coreSize = state === "idle" ? 12 : state === "speaking" ? 18 + avgLevel * 20 : 14;
      const coreGlow = ctx.createRadialGradient(CENTER, CENTER, 0, CENTER, CENTER, coreSize);
      const coreAlpha = state === "idle" ? 0.25 : state === "speaking" ? 0.4 + avgLevel * 0.4 : 0.35;
      coreGlow.addColorStop(0, `rgba(255, 255, 255, ${coreAlpha * 0.6})`);
      coreGlow.addColorStop(0.3, `rgba(${c.r}, ${c.g}, ${c.b}, ${coreAlpha})`);
      coreGlow.addColorStop(1, `rgba(${c.r}, ${c.g}, ${c.b}, 0)`);
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(CENTER, CENTER, coreSize, 0, Math.PI * 2);
      ctx.fill();

      frameRef.current = requestAnimationFrame(draw);
    }

    draw();
    return () => cancelAnimationFrame(frameRef.current);
  }, [state, analyser]);

  return (
    <canvas
      ref={canvasRef}
      style={{ width: 500, height: 500 }}
      className="cursor-pointer"
    />
  );
}

// ── Pagina principal ─────────────────────────────────────────────
export default function NoahVoice() {
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [mode, setMode] = useState<"voice" | "text">("voice");
  const [textInput, setTextInput] = useState("");
  const [statusText, setStatusText] = useState("");
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const chatMutation = trpc.noah.chat.useMutation();

  const hasSpeechApi = !!SpeechRecognition;

  // Criar AudioContext uma vez
  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
    }
    return audioCtxRef.current;
  }, []);

  // TTS via OpenAI com analyser pra visualizacao
  async function speak(text: string) {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setSpeaking(true);
    setStatusText("");

    try {
      const response = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      if (!response.ok) {
        console.error("[TTS] Status:", response.status);
        setSpeaking(false);
        if (mode === "voice" && hasSpeechApi) startListening();
        return;
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audioRef.current = audio;

      // Conectar ao analyser pra visualizacao
      const actx = getAudioContext();
      if (actx.state === "suspended") await actx.resume();
      const source = actx.createMediaElementSource(audio);
      const analyser = actx.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyser.connect(actx.destination);
      analyserRef.current = analyser;

      audio.onended = () => {
        setSpeaking(false);
        analyserRef.current = null;
        URL.revokeObjectURL(url);
        audioRef.current = null;
        if (mode === "voice" && hasSpeechApi) {
          setTimeout(() => startListening(), 500);
        }
      };

      audio.onerror = () => {
        setSpeaking(false);
        analyserRef.current = null;
        URL.revokeObjectURL(url);
        audioRef.current = null;
      };

      await audio.play();
    } catch (err) {
      console.error("[TTS] Erro:", err);
      setSpeaking(false);
      if (mode === "voice" && hasSpeechApi) startListening();
    }
  }

  function stopSpeaking() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    analyserRef.current = null;
    setSpeaking(false);
  }

  async function sendMessage(text: string) {
    if (!text.trim()) return;
    setMessages((prev) => [...prev, { role: "user", text: text.trim() }]);
    setProcessing(true);
    setTranscript("");
    setStatusText("Processando...");

    try {
      const result = await chatMutation.mutateAsync({ message: text.trim() });
      setMessages((prev) => [...prev, { role: "noah", text: result.answer }]);
      setStatusText("");
      await speak(result.answer);
    } catch (err: any) {
      console.error("[Noah] Erro:", err);
      setStatusText("Erro de conexão");
      setProcessing(false);
      setSpeaking(false);
    } finally {
      setProcessing(false);
    }
  }

  function startListening() {
    if (!hasSpeechApi || listening) return;
    const recognition = new SpeechRecognition();
    recognition.lang = "pt-BR";
    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => {
      setListening(true);
      setStatusText("Ouvindo...");
    };

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalTranscript += t;
        else interimTranscript += t;
      }
      setTranscript(finalTranscript || interimTranscript);
      if (finalTranscript) sendMessage(finalTranscript);
    };

    recognition.onerror = () => {
      setListening(false);
      setStatusText("");
    };
    recognition.onend = () => {
      setListening(false);
      if (!processing && !speaking) setStatusText("");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
    setListening(false);
  }

  function handleOrbClick() {
    if (speaking) {
      stopSpeaking();
      return;
    }
    if (mode === "voice") {
      if (listening) stopListening();
      else {
        stopSpeaking();
        startListening();
      }
    }
  }

  function handleTextSubmit() {
    if (!textInput.trim() || processing) return;
    sendMessage(textInput);
    setTextInput("");
  }

  const vizState = listening
    ? "listening"
    : processing
    ? "processing"
    : speaking
    ? "speaking"
    : "idle";

  return (
    <DashboardLayout activeSection="noah-voice">
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-120px)] gap-4 px-4 select-none">
        {/* Titulo */}
        <div className="text-center">
          <h1 className="text-2xl font-bold tracking-widest text-blue-400">
            N.O.A.H.
          </h1>
          <p className="text-[11px] text-muted-foreground tracking-wider uppercase mt-0.5">
            Neural Operational Assistant Hub
          </p>
        </div>

        {/* Visualizador JARVIS */}
        <div className="relative" onClick={handleOrbClick}>
          <JarvisVisualizer state={vizState} analyser={analyserRef.current} />

          {/* Icone central */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            {processing ? (
              <Loader2 className="h-8 w-8 text-orange-400 animate-spin" />
            ) : listening ? (
              <Mic className="h-8 w-8 text-primary animate-pulse" />
            ) : (
              <MicOff className="h-7 w-7 text-muted-foreground/30" />
            )}
          </div>
        </div>

        {/* Status */}
        <div className="text-center h-10">
          {transcript && listening && (
            <p className="text-sm text-muted-foreground italic">"{transcript}"</p>
          )}
          {statusText && !transcript && (
            <p className={`text-sm font-medium ${
              vizState === "listening" ? "text-primary" :
              vizState === "processing" ? "text-orange-400" :
              vizState === "speaking" ? "text-blue-400" :
              "text-muted-foreground"
            }`}>
              {statusText}
            </p>
          )}
          {vizState === "idle" && !statusText && (
            <p className="text-xs text-muted-foreground/50">
              {hasSpeechApi && mode === "voice"
                ? "Toque para falar"
                : "Digite abaixo"}
            </p>
          )}
        </div>

        {/* Toggle voz/texto */}
        <div className="flex gap-1.5">
          {hasSpeechApi && (
            <button
              onClick={() => { setMode("voice"); stopListening(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
                mode === "voice"
                  ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                  : "text-muted-foreground/50 hover:text-muted-foreground"
              }`}
            >
              <Mic className="h-3 w-3" /> Voz
            </button>
          )}
          <button
            onClick={() => { setMode("text"); stopListening(); stopSpeaking(); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all ${
              mode === "text"
                ? "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                : "text-muted-foreground/50 hover:text-muted-foreground"
            }`}
          >
            <Keyboard className="h-3 w-3" /> Texto
          </button>
        </div>

        {/* Input texto */}
        {mode === "text" && (
          <div className="flex gap-2 w-full max-w-md">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleTextSubmit()}
              placeholder="Fale com o Noah..."
              disabled={processing}
              className="flex-1 rounded-full bg-card border border-border/50 px-4 py-2.5 text-sm focus:outline-none focus:border-blue-500/50 transition-colors disabled:opacity-50"
            />
            <button
              onClick={handleTextSubmit}
              disabled={processing || !textInput.trim()}
              className="rounded-full bg-blue-600 text-white px-4 py-2.5 text-sm font-medium disabled:opacity-30 transition-colors hover:bg-blue-500"
            >
              Enviar
            </button>
          </div>
        )}

        {/* Sugestoes rapidas */}
        {messages.length === 0 && !processing && (
          <div className="flex flex-wrap gap-1.5 justify-center max-w-md mt-2">
            {[
              "Como estão as vendas?",
              "Resumo da operação",
              "Prioridade agora?",
              "ROAS dos ads",
            ].map((s) => (
              <button
                key={s}
                onClick={() => sendMessage(s)}
                disabled={processing}
                className="px-3 py-1 rounded-full text-[11px] border border-border/30 text-muted-foreground/60 hover:text-blue-400 hover:border-blue-500/30 transition-all disabled:opacity-30"
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {!hasSpeechApi && (
          <p className="text-[10px] text-muted-foreground/40 text-center max-w-xs mt-4">
            Use Google Chrome para ativar o modo voz
          </p>
        )}
      </div>
    </DashboardLayout>
  );
}
