import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/features/auth/useAuth"
import { applyRememberMe } from "@/lib/cognito"
import { useAuth, DEV_CREDENTIALS, useCognitoAuth } from "@/features/auth/AuthContext"
import { translateCognitoError } from "@/features/auth/errors"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { Eye, EyeOff} from "lucide-react"
import ZoeLogo from "@/assets/zoe-logo.svg?react"
import Google from "@/assets/google-icon.svg?react"
import Microsoft from "@/assets/microsoft-icon.svg?react"
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
})

const slides = [
  { headline: 'Hoje a Zoe analisou <span>12.847 menções</span> de marca em vídeo.', subtitle: "Inteligência multimodal em tempo real." },
  { headline: "Monitore sua marca. Em tempo real. Com <span>IA multimodal.</span>", subtitle: "Vídeo, áudio e texto — tudo em um só lugar." },
  { headline: "<span>Inteligência</span> e <span>gestão</span>  de marketing de influência.", subtitle: "Da descoberta ao relatório, sem sair da plataforma." },
]

export default function LoginPage() {
  const nav = useNavigate()
  const location = useLocation()
  const { isAuthenticated, devLogin, refresh } = useAuth()
  const form = useForm({ resolver: zodResolver(schema) })
  const [showPw, setShowPw] = useState(false)
  const [remember, setRemember] = useState(true)
  const [slide, setSlide] = useState(0)
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const returnTo = (location.state as { from?: string } | null)?.from ?? "/dashboard"

  useEffect(() => {
    if (isAuthenticated) nav(returnTo, { replace: true })
  }, [isAuthenticated, nav, returnTo])

  useEffect(() => {
    const timer = setTimeout(() => {
      setSlide((prev) => (prev + 1) % slides.length)
    }, 4000)
    return () => clearTimeout(timer)
  }, [slide])

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError("")
    setSubmitting(true)

    // Atalho de dev: credenciais mock funcionam mesmo com Cognito configurado, contanto que ele
    // recuse antes (UserNotFoundException). Se Cognito não estiver configurado, vai direto.
    const tryDevLogin = email === DEV_CREDENTIALS.email && password === DEV_CREDENTIALS.password

    if (tryDevLogin && !useCognitoAuth) {
      devLogin()
      nav(returnTo, { replace: true })
      return
    }

    try {
      applyRememberMe(remember)
      await auth.login(email, password)
      await refresh()
      nav(returnTo, { replace: true })
    } catch (err) {
      const { code, message } = translateCognitoError(err)
      if (code === "UserNotConfirmedException") {
        nav("/register", { state: { email, step: 3 }, replace: true })
        return
      }
      if (tryDevLogin) {
        devLogin()
        nav(returnTo, { replace: true })
        return
      }
      setError(message)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 relative bg-black flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <ShaderGradientCanvas style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
            <ShaderGradient
              animate="on"
              brightness={1}
              cAzimuthAngle={180}
              cDistance={2.41}
              cPolarAngle={95}
              cameraZoom={1}
              color1="#5DE0D4"
              color2="#006B60"
              color3="#00A799"
              envPreset="city"
              grain="on"
              lightType="3d"
              positionX={0}
              positionY={-2.1}
              positionZ={0}
              range="disabled"
              rangeEnd={40}
              rangeStart={0}
              reflection={0.1}
              rotationX={0}
              rotationY={0}
              rotationZ={225}
              shader="defaults"
              type="waterPlane"
              uAmplitude={0}
              uDensity={1.8}
              uFrequency={5.5}
              uSpeed={0.2}
              uStrength={3}
              uTime={0.2}
              wireframe={false}
            />
          </ShaderGradientCanvas>
        </div>

        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        <style>
          {`
          @keyframes progress-fill {
            0% { width: 0%; }
            100% { width: 100%; }
          }
          .slide-headline span {
            font-weight: 700;
            color: white;
            mix-blend-mode: difference;
            text-shadow: none;
          }
        `}
        </style>
        <div className="relative flex flex-col h-full justify-between text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">
          <div className="flex items-center gap-2">
            <ZoeLogo className="w-18 h-full text-white drop-shadow-lg" />
          </div>
          <div className=" flex flex-col justify-center ">
            <h2
              className="text-5xl font-bold leading-tight mb-3 slide-headline"
              dangerouslySetInnerHTML={{ __html: slides[slide].headline }}
            />
            <p className="text-white/80 text-lg font-medium">{slides[slide].subtitle}</p>
            <div className="flex gap-2 mt-8">
              {slides.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setSlide(i)}
                  className={`h-2 rounded-full overflow-hidden transition-all duration-500 relative ${i === slide ? "w-12 bg-white/30" : "w-2 bg-white/50 hover:bg-white/70"}`}
                  aria-label={`Ir para o slide ${i + 1}`}
                >
                  {i === slide && (
                    <div
                      className="absolute top-0 left-0 h-full bg-white"
                      style={{ animation: 'progress-fill 4000ms linear forwards' }}
                    />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <h1 className="text-3xl font-bold text-midnight dark:text-[#E6E8EF] mb-1">Entre na sua conta</h1>
          <p className="text-sm text-[#6B7280] mb-8">Bem-vindo(a) de volta.</p>

          <form onSubmit={onSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">E-mail</Label>
              <Input id="email" placeholder="seu@email.com" {...form.register("email")} />
              {form.formState.errors.email && (
                <p className="text-xs text-[#DC2626]">{form.formState.errors.email.message as string}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  placeholder="••••••••"
                  {...form.register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-midnight dark:hover:text-[#E6E8EF]"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-[#DC2626]">{form.formState.errors.password.message as string}</p>
              )}
            </div>

            <div className="flex items-center justify-between text-sm">
              <label className="flex items-center gap-2 text-[#6B7280]">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="rounded border-[#E5E7EB] accent-teal-500"
                />
                Manter conectado
              </label>
              <Link to="/forgot-password" className="text-teal-500 hover:underline">Esqueci a senha</Link>
            </div>

            {error && <p className="text-xs text-[#DC2626]">{error}</p>}

            <Button type="submit" disabled={submitting} className="w-full bg-teal-500 hover:bg-teal-500/90 text-white">
              {submitting ? "Entrando..." : "Entrar"}
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E7EB]" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[#6B7280]">ou</span></div>
          </div>

          <div className="flex gap-5 justify-center items-center" >
            <Button variant="outline" disabled>
              <Google className="w-4 h-4 mr-2"/> Entrar com Google
            </Button>
            <Button variant="outline" disabled>
              <Microsoft className="w-4 h-4 mr-2"/> Entrar com Microsoft
            </Button>
          </div>

          <p className="text-center text-sm text-[#6B7280] mt-15">
            Ainda não tem conta?{" "}
            <Link to="/register" className="text-teal-500 font-semibold hover:underline">Comece grátis</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
