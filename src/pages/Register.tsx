import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/features/auth/useAuth"
import { useAuth } from "@/features/auth/AuthContext"
import { translateCognitoError } from "@/features/auth/errors"
import { setOnboardingIntent, type OnboardingIntent } from "@/features/auth/onboardingIntent"
import { ApiError } from "@/lib/api"
import { useNavigate, useLocation, Link } from "react-router-dom"
import { Check, ArrowLeft, Eye, EyeOff, BriefcaseBusiness, Blocks } from "lucide-react"
import ZoeLogo from "@/assets/zoe-logo.svg?react"
import Google from "@/assets/google-icon.svg?react"
import Microsoft from "@/assets/microsoft-icon.svg?react"
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

const stepsData = ["Objetivo", "Criar conta", "Verificação"]

function Stepper({ currentStep }: { currentStep: number }) {
  return (
    <div className="space-y-6">
      {stepsData.map((label, idx) => {
        const stepNum = idx + 1
        const isCompleted = stepNum < currentStep
        const isActive = stepNum === currentStep

        return (
          <div key={idx} className="relative flex items-start gap-4">
            {idx !== stepsData.length - 1 && (
              <div
                className={`absolute left-4 top-8 bottom-[-1.5rem] w-[2px] -translate-x-[1px] transition-colors duration-500 ${stepNum < currentStep ? 'bg-white' : 'bg-white/20'
                  }`}
              />
            )}

            <div
              className={`relative z-10 flex mix-blend-color w-8 h-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-500 ${isCompleted
                  ? 'bg-white border-white text-teal-600'
                  : isActive
                    ? 'bg-white/20 border-white text-white backdrop-blur-sm'
                    : 'bg-white/5 border-white/20 text-white/40'
                }`}
            >
              {isCompleted ? (
                <Check className="w-4 h-4" strokeWidth={3} />
              ) : (
                <span className="text-sm font-bold">{stepNum}</span>
              )}
            </div>

            <div className="pt-0.5 flex flex-col">
              <span
                className={`text-[10px] uppercase tracking-[0.15em] font-semibold ${isActive ? 'text-white/80' : isCompleted ? 'text-white/70' : 'text-white/30'
                  }`}
              >
                Passo {stepNum}
              </span>
              <span
                className={`text-sm font-semibold mt-0.5 ${isActive || isCompleted ? 'text-white' : 'text-white/30'
                  }`}
              >
                {label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function StepIntentionLarge({ onNext, initialValue }: { onNext: (intent: string) => void; initialValue: string }) {
  const [selected, setSelected] = useState(initialValue || "")

  const options = [
    {
      value: "monitor",
      emoji: <Eye className="w-7 h-7" />,
      title: "Monitorar marcas",
      desc: "Acompanhe e analise todas as menções da sua marca em redes sociais, vídeos, áudios e podcasts com inteligência artificial multimodal em tempo real.",
      features: ["Análise de sentimentos AI", "Alertas automáticos", "Relatórios e Dashboard"],
    },
    {
      value: "campaigns",
      emoji: <BriefcaseBusiness className="w-7 h-7" />,
      title: "Gerenciar contratos",
      desc: "Controle todo o ciclo de vida e pagamentos dos influenciadores, desde a descoberta da Creator Economy até os relatórios de conversão.",
      features: ["Contratos digitais ágeis", "Escrow 100% Seguro", "Timeline de publicações"],
    },
    {
      value: "both",
      emoji: <Blocks className="w-7 h-7" />,
      title: "Quero os dois (Completo)",
      desc: "Tenha a experiência suprema: 100% do poder da plataforma em suas mãos para uma estratégia de marketing inteligente e unificada.",
      badge: "Sugerido",
      features: ["Inteligência + Gestão", "Auditoria completa por IA", "Acesso ilimitado às ferramentas"],
    },
  ]

  return (
    <div className="w-full">
      <div className="mb-10">
        <h1 className="text-2xl sm:text-3xl font-extrabold text-midnight dark:text-[#E6E8EF]">O que você quer fazer com a Zoe?</h1>
        <p className="text-sm text-[#6B7280] mt-1">
          Personalizamos sua experiência com base no seu objetivo. Você poderá alterar depois.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            className={`group text-left p-5 rounded-xl flex flex-col h-full border-2 transition-all duration-200 cursor-pointer ${selected === opt.value
                ? "border-teal-500 bg-teal-50/50 shadow-lg shadow-teal-500/5 ring-4 ring-teal-500/10"
                : "border-[#E5E7EB] bg-white hover:border-teal-300 hover:shadow-md"
              }`}
          >
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center">
                <div
                  className={`p-2 rounded-lg transition-colors ${selected === opt.value ? "bg-teal-500 text-white" : "bg-gray-100 text-gray-600 group-hover:bg-teal-50 group-hover:text-teal-600"
                    }`}
                >
                  {opt.emoji}
                </div>
              </div>
              {opt.badge && (
                <span className="bg-teal-500/10 text-teal-600 text-xs px-2 py-0.5 font-bold rounded-full">
                  {opt.badge}
                </span>
              )}
            </div>
            <h3 className="text-xl mb-4 font-bold text-midnight dark:text-[#E6E8EF]">{opt.title}</h3>
            <p className="text-sm text-[#6B7280] flex-1 leading-relaxed">{opt.desc}</p>

            <hr className="my-6" />

            <ul className="space-y-1.5 mb-4">
              {opt.features.map((feat, i) => (
                <li key={i} className="flex items-center gap-2 text-sm text-midnight dark:text-[#E6E8EF] font-medium">
                  <div className="w-1 h-1 rounded-full bg-teal-500 shrink-0" />
                  {feat}
                </li>
              ))}
            </ul>

            <div
              className={`w-full py-2 rounded-lg text-center font-bold text-xs transition-all ${selected === opt.value
                  ? "bg-teal-500 text-white"
                  : "bg-gray-50 text-gray-400 group-hover:bg-teal-50 group-hover:text-teal-600 border border-gray-200"
                }`}
            >
              {selected === opt.value ? "Selecionado" : "Selecionar plano"}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-10 flex justify-end">
        <Button
          onClick={() => onNext(selected)}
          disabled={!selected}
          className="bg-teal-500 hover:bg-teal-500/90 text-white px-8 py-5 text-sm font-bold rounded-xl"
        >
          Continuar para conta
        </Button>
      </div>
    </div>
  )
}

const accountSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  surname: z.string().min(2, "Sobrenome obrigatório"),
  email: z.email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres").regex(/[A-Z]/, "Inclua uma maiúscula").regex(/\d/, "Inclua um número").regex(/[^A-Za-z0-9]/, "Inclua um símbolo"),
  confirmPassword: z.string().min(1, "Confirme sua senha"),
  terms: z.literal(true, { error: () => ({ message: "Aceite os termos" }) }),
}).refine((data) => data.password === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
})

type AccountData = z.infer<typeof accountSchema>

function StepAccount({ onNext, defaultEmail = "" }: { onNext: (data: AccountData) => void; defaultEmail?: string }) {
  const form = useForm<AccountData>({ resolver: zodResolver(accountSchema), defaultValues: { email: defaultEmail } })
  const [error, setError] = useState("")
  const [showPw, setShowPw] = useState(false)
  const password = form.watch("password") ?? ""

  const strength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0
  const strengthColors = ["bg-[#E5E7EB]", "bg-red-500", "bg-amber-500", "bg-green-500"]
  const strengthLabels = ["", "Fraca", "Média", "Forte"]

  return (
    <div className="flex gap-10 lg:gap-16 items-center w-full">
      {/* Left: Form */}
      <div className="flex-1 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-midnight dark:text-[#E6E8EF] mb-1">Crie sua conta</h1>
          <p className="text-sm text-[#6B7280]">Leva menos de um minuto para entrar.</p>
        </div>

        <form
          onSubmit={form.handleSubmit(async (data) => {
            try {
              setError("")
              const fullName = `${data.name} ${data.surname}`.trim()
              await auth.register(data.email, data.password, fullName)
              onNext(data)
            } catch (e: unknown) {
              const { code, message } = translateCognitoError(e)
              if (code === "UsernameExistsException") {
                // Conta já existe. Se ainda não foi confirmada, reenviar código resolve.
                // Se já está confirmada, resendCode lança "InvalidParameterException".
                try {
                  await auth.resendCode(data.email)
                  onNext(data)
                } catch (resendErr) {
                  const resendCode = (resendErr as { name?: string })?.name
                  if (resendCode === "InvalidParameterException" || resendCode === "NotAuthorizedException") {
                    setError("Esse e-mail já tem conta confirmada. Faça login.")
                  } else {
                    setError(translateCognitoError(resendErr).message)
                  }
                }
                return
              }
              setError(message)
            }
          })}
          className="space-y-4"
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="name">Nome</Label>
              <Input id="name" {...form.register("name")} placeholder="João" aria-invalid={!!form.formState.errors.name} />
              {form.formState.errors.name && <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="surname">Sobrenome</Label>
              <Input id="surname" {...form.register("surname")} placeholder="Oliveira" aria-invalid={!!form.formState.errors.surname} />
              {form.formState.errors.surname && <p className="text-xs text-destructive">{form.formState.errors.surname.message}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="email">E-mail corporativo</Label>
            <Input id="email" type="email" {...form.register("email")} placeholder="joao@empresa.com" aria-invalid={!!form.formState.errors.email} />
            {form.formState.errors.email && <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPw ? "text" : "password"}
                  {...form.register("password")}
                  placeholder="••••••••"
                  aria-invalid={!!form.formState.errors.password}
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              {password.length > 0 && (
                <div className="flex items-center gap-2">
                  <div className="flex gap-1 flex-1">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-colors ${i <= strength ? strengthColors[strength] : "bg-[#E5E7EB]"}`} />
                    ))}
                  </div>
                  <span className="text-xs text-muted-foreground">{strengthLabels[strength]}</span>
                </div>
              )}
              {form.formState.errors.password && <p className="text-xs text-destructive">{form.formState.errors.password.message}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="confirmPassword">Confirmar senha</Label>
              <Input
                id="confirmPassword"
                type={showPw ? "text" : "password"}
                {...form.register("confirmPassword")}
                placeholder="••••••••"
                aria-invalid={!!form.formState.errors.confirmPassword}
              />
              {form.formState.errors.confirmPassword && <p className="text-xs text-destructive">{form.formState.errors.confirmPassword.message}</p>}
            </div>
          </div>

          <label className="flex items-start gap-2 text-sm text-[#6B7280] pt-2">
            <input type="checkbox" {...form.register("terms")} className="mt-0.5 rounded border-[#E5E7EB] accent-teal-500" />
            <span>
              Ao criar conta, você aceita os{" "}
              <a href="#" className="text-teal-500 font-medium hover:underline">termos de uso</a> e a{" "}
              <a href="#" className="text-teal-500 font-medium hover:underline">política de privacidade</a>.
            </span>
          </label>
          {form.formState.errors.terms && <p className="text-xs text-destructive">{form.formState.errors.terms.message}</p>}

          {error && <p className="text-xs text-destructive">{error}</p>}

          <Button type="submit" className="w-full bg-teal-500 hover:bg-teal-500/90 text-white font-bold py-5">
            Criar minha conta
          </Button>
        </form>
      </div>

      {/* Divider */}
      <div className="hidden lg:flex flex-col items-center pt-14 shrink-0">
        <div className="w-px h-100 bg-[#E5E7EB]" />
      </div>

      {/* Right: Social login */}
      <div className="hidden lg:flex flex-col items-center gap-5 w-80 shrink-0">
        <span className="text-xs text-[#6B7280] font-medium">ou cadastre-se com</span>

        <Button variant="outline" disabled className="w-full justify-center bg-transparent gap-2">
          <Google className="w-4 h-4" /> Google
        </Button>
        <Button variant="outline" disabled className="w-full justify-center bg-transparent gap-2">
          <Microsoft className="w-4 h-4" /> Microsoft
        </Button>
      </div>
    </div>
  )
}

function StepVerification({
  email, password, onBack,
}: {
  email: string
  password: string | null
  onBack: () => void
}) {
  const nav = useNavigate()
  const { refresh } = useAuth()
  const [code, setCode] = useState(Array(6).fill(""))
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(30)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => {
      setResendTimer((t) => {
        if (t <= 1) {
          clearInterval(interval)
          return 0
        }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [resendTimer])

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...code]
    next[index] = value
    setCode(next)

    if (value && index < 5) {
      document.getElementById(`otp-${index + 1}`)?.focus()
    }

    if (value && index === 5) {
      const fullCode = next.join("")
      if (fullCode.length === 6) submitCode(fullCode)
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      document.getElementById(`otp-${index - 1}`)?.focus()
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6)
    if (!pasted) return
    const next = Array(6).fill("")
    pasted.split("").forEach((char, i) => { next[i] = char })
    setCode(next)
    const focusIdx = Math.min(pasted.length, 5)
    document.getElementById(`otp-${focusIdx}`)?.focus()
    if (pasted.length === 6) submitCode(pasted)
  }

  const submitCode = async (fullCode: string) => {
    try {
      setSubmitting(true)
      setError("")
      await auth.confirm(email, fullCode)

      // Sem senha (veio do fluxo "UserNotConfirmed" no login): manda pro login.
      if (!password) {
        nav("/login", { replace: true, state: { email } })
        return
      }

      // signIn programático e hidrata o contexto. O ProtectedRoute leva pro onboarding
      // automaticamente quando o user não tem memberships ainda.
      await auth.login(email, password)
      await refresh()
      nav("/dashboard", { replace: true })
    } catch (err) {
      const { message } = translateCognitoError(err)
      setError(err instanceof ApiError ? err.message : message)
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    try {
      await auth.resendCode(email)
    } catch { /* best-effort */ }
    setResendTimer(30)
  }

  return (
    <div className="space-y-8 text-center">
      <div>
        <div className="mx-auto w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-6">
          <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 0 1-2.25 2.25h-15a2.25 2.25 0 0 1-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25m19.5 0v.243a2.25 2.25 0 0 1-1.07 1.916l-7.5 4.615a2.25 2.25 0 0 1-2.36 0L3.32 8.91a2.25 2.25 0 0 1-1.07-1.916V6.75" />
          </svg>
        </div>
        <h1 className="text-3xl font-bold text-midnight dark:text-[#E6E8EF]">Confirme seu e-mail</h1>
        <p className="text-sm text-[#6B7280] mt-2">
          Mandamos um código de 6 dígitos para<br />
          <strong className="text-midnight dark:text-[#E6E8EF]">{email}</strong>
        </p>
      </div>

      <div className="flex justify-center gap-3" onPaste={handlePaste}>
        {code.map((digit, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={(e) => handleDigit(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={submitting}
            className="w-12 h-14 text-center text-2xl font-bold border-2 border-[#E5E7EB] rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all disabled:opacity-50"
          />
        ))}
      </div>
      {error && <p className="text-sm font-semibold text-red-500">{error}</p>}

      <div className="space-y-3">
        <p className="text-sm text-[#6B7280]">
          {resendTimer > 0 ? (
            `Reenviar código em ${resendTimer}s`
          ) : (
            <button onClick={handleResend} className="text-teal-500 font-bold hover:underline">
              Reenviar código
            </button>
          )}
        </p>
        <div className="pt-3 border-t border-gray-100">
          <button onClick={onBack} className="text-sm text-[#6B7280] hover:text-midnight dark:hover:text-[#E6E8EF] hover:underline transition-colors">
            Digitou o e-mail errado? Voltar
          </button>
        </div>
      </div>
    </div>
  )
}

export default function RegisterPage() {
  const location = useLocation()
  const initial = (location.state ?? null) as { email?: string; step?: number } | null

  const [step, setStep] = useState(initial?.step ?? 1)
  const [intent, setIntent] = useState("")
  const [email, setEmail] = useState(initial?.email ?? "")
  const [password, setPassword] = useState<string | null>(null)

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col lg:flex-row">
      {/* Left Sidebar with gradient */}
      <div className="lg:w-[320px] sticky top-0 relative bg-black border-b lg:border-r border-white/10 flex flex-col shrink-0 lg:h-dvh z-10 w-full overflow-hidden">
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

        {/* Dark overlay for text readability */}
        <div className="absolute inset-0 bg-black/40 pointer-events-none" />

        <div className="relative z-10 flex flex-col h-full justify-between p-6 lg:p-8 text-white [text-shadow:0_1px_3px_rgba(0,0,0,0.4)]">
          <div className="flex flex-col gap-8">
            <ZoeLogo className="w-18 h-full text-white drop-shadow-md" />

            <div className="hidden lg:block">
              <h2 className="text-xl font-bold tracking-tight mb-1.5">Comece grátis</h2>
              <p className="text-sm text-white/70 font-medium leading-relaxed">
                Complete essas rápidas etapas para configurar e acessar a sua dashboard.
              </p>
            </div>
          </div>

          <div className="hidden lg:block">
            <Stepper currentStep={step} />
          </div>

          {/* Mobile Stepper */}
          <div className="lg:hidden flex items-center justify-between mt-4">
            <div className="text-sm font-bold text-white">Passo {step} de 3</div>
            <div className="text-xs  text-white/70 font-medium mi">{stepsData[step - 1]}</div>
          </div>

          <div className="hidden lg:block text-sm font-medium text-white/70">
            Já tem uma conta?{" "}
            <Link to="/login" className="text-white font-bold hover:underline">
              Entre agora
            </Link>
          </div>
        </div>
      </div>

      {/* Right Content Area */}
      <div className="flex-1 p-4 sm:p-8 flex flex-col items-center">
        <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col">
          {/* Header Row */}
          <div className="flex items-center justify-between mb-6">
            {step > 1 ? (
              <button
                onClick={() => setStep(step - 1)}
                className="flex items-center gap-2 text-sm font-bold text-[#6B7280] hover:text-teal-500 transition-colors"
                aria-label="Voltar para etapa anterior"
              >
                <ArrowLeft className="w-4 h-4" /> Voltar
              </button>
            ) : (
              <div />
            )}
            <div className="lg:hidden text-sm text-[#6B7280]">
              Já tem conta?{" "}
              <Link to="/login" className="text-teal-500 font-bold hover:underline">Entrar</Link>
            </div>
          </div>

          {/* Dynamic Content */}
          <div className={`flex-1 flex w-full ${step === 1 ? "" : "justify-center items-center"}`}>
            {step === 1 && (
              <StepIntentionLarge
                initialValue={intent}
                onNext={(val) => {
                  setIntent(val)
                  setOnboardingIntent(val as OnboardingIntent)
                  setStep(2)
                }}
              />
            )}

            {step === 2 && (
              <div className="w-full ">
                <StepAccount
                  defaultEmail={email}
                  onNext={(data) => {
                    setEmail(data.email)
                    setPassword(data.password)
                    setStep(3)
                  }}
                />
              </div>
            )}

            {step === 3 && (
              <div className="w-full max-w-md">
                <StepVerification
                  email={email}
                  password={password}
                  onBack={() => setStep(2)}
                />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
