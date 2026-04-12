import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/features/auth/useAuth"
import { useAuth, DEV_CREDENTIALS } from "@/features/auth/AuthContext"
import { useNavigate, Link } from "react-router-dom"
import { Eye, EyeOff, ChevronDown } from "lucide-react"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

const schema = z.object({
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
})

const slides = [
  { headline: 'Hoje a Zoe analisou <strong>12.847</strong> menções de marca em vídeo.', subtitle: "Inteligência multimodal em tempo real." },
  { headline: "Monitore sua marca. Em tempo real. Com IA multimodal.", subtitle: "Vídeo, áudio e texto — tudo em um só lugar." },
  { headline: "Inteligência e gestão de marketing de influência.", subtitle: "Da descoberta ao relatório, sem sair da plataforma." },
]

export default function LoginPage() {
  const nav = useNavigate()
  const { user, devLogin } = useAuth()
  const form = useForm({ resolver: zodResolver(schema) })
  const [showPw, setShowPw] = useState(false)
  const [slide, setSlide] = useState(0)
  const [error, setError] = useState("")

  useEffect(() => {
    if (user) nav("/dashboard", { replace: true })
  }, [user, nav])

  useEffect(() => {
    const timer = setInterval(() => setSlide(s => (s + 1) % slides.length), 4000)
    return () => clearInterval(timer)
  }, [])

  const onSubmit = form.handleSubmit(async ({ email, password }) => {
    setError("")
    // Mock credentials always work, even without Cognito
    if (email === DEV_CREDENTIALS.email && password === DEV_CREDENTIALS.password) {
      devLogin()
      nav("/dashboard")
      return
    }
    // Otherwise try real Cognito
    try {
      await auth.login(email, password)
      nav("/dashboard")
    } catch {
      setError("E-mail ou senha incorretos.")
    }
  })

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex w-1/2 bg-midnight text-white flex-col justify-between p-12">
        <div className="flex items-center gap-2">
          <ZoeLogo className="w-15 h-full text-teal-500" />
        </div>
        <div className="flex-1 flex flex-col justify-center max-w-md">
          <h2
            className="text-3xl font-bold leading-tight mb-3"
            dangerouslySetInnerHTML={{ __html: slides[slide].headline }}
          />
          <p className="text-white/60 text-sm">{slides[slide].subtitle}</p>
          <div className="flex gap-2 mt-8">
            {slides.map((_, i) => (
              <button
                key={i}
                onClick={() => setSlide(i)}
                className={`w-2 h-2 rounded-full transition-colors ${i === slide ? "bg-white" : "bg-white/40"}`}
              />
            ))}
          </div>
        </div>
        <div className="flex justify-center">
          <ChevronDown className="w-5 h-5 text-white/40" />
        </div>
      </div>

      {/* Right panel */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-[--color-midnight] mb-1">Entre na sua conta</h1>
          <p className="text-sm text-[#6B7280] mb-8">Bem-vinda de volta.</p>

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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[--color-midnight]"
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
                <input type="checkbox" className="rounded border-[#E5E7EB]" />
                Manter conectado
              </label>
              <a href="#" className="text-teal-500 hover:underline">Esqueci a senha</a>
            </div>

            {error && <p className="text-xs text-[#DC2626]">{error}</p>}

            <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-500/90 text-white">
              Entrar
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-[#E5E7EB]" /></div>
            <div className="relative flex justify-center"><span className="bg-white px-3 text-xs text-[#6B7280]">ou</span></div>
          </div>

          <div className="space-y-3">
            <Button variant="outline" className="w-full" disabled>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
              Continuar com Google
            </Button>
            <Button variant="outline" className="w-full" disabled>
              <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24"><rect x="1" y="1" width="10" height="10" fill="#F25022"/><rect x="13" y="1" width="10" height="10" fill="#7FBA00"/><rect x="1" y="13" width="10" height="10" fill="#00A4EF"/><rect x="13" y="13" width="10" height="10" fill="#FFB900"/></svg>
              Continuar com Microsoft
            </Button>
          </div>

          <p className="text-center text-sm text-[#6B7280] mt-8">
            Ainda não tem conta?{" "}
            <Link to="/register" className="text-teal-500 font-semibold hover:underline">Comece grátis</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
