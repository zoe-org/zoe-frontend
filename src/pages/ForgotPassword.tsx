import { useState, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/features/auth/useAuth"
import { translateCognitoError } from "@/features/auth/errors"
import { Link } from "react-router-dom"
import { Eye, EyeOff, ArrowLeft } from "lucide-react"
import ZoeLogo from "@/assets/zoe-logo.svg?react"
import { ShaderGradientCanvas, ShaderGradient } from '@shadergradient/react'

const requestSchema = z.object({
  email: z.email("E-mail inválido"),
})

const resetSchema = z.object({
  newPassword: z.string().min(8, "Mínimo 8 caracteres").regex(/[A-Z]/, "Inclua uma maiúscula").regex(/\d/, "Inclua um número").regex(/[^A-Za-z0-9]/, "Inclua um símbolo"),
  confirmPassword: z.string().min(1, "Confirme sua senha"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não coincidem",
  path: ["confirmPassword"],
})

type ResetData = z.infer<typeof resetSchema>

function GradientPanel() {
  return (
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
      <div className="relative flex flex-col h-full justify-between text-white [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]">
        <div className="flex items-center gap-2">
          <ZoeLogo className="w-18 h-full text-white drop-shadow-lg" />
        </div>
        <div className="flex flex-col justify-center">
          <h2 className="text-5xl font-bold leading-tight mb-3">Sua conta, sua marca, sempre segura.</h2>
          <p className="text-white/80 text-lg font-medium">Vamos te ajudar a voltar a acessar a Zoe.</p>
        </div>
      </div>
    </div>
  )
}

/** Etapa 1: pede o e-mail e dispara o código via Cognito. */
function StepRequest({ onSent }: { onSent: (email: string) => void }) {
  const form = useForm({ resolver: zodResolver(requestSchema) })
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const onSubmit = form.handleSubmit(async ({ email }) => {
    setError("")
    setSubmitting(true)
    try {
      await auth.forgotPassword(email)
      onSent(email)
    } catch (err) {
      const { code, message } = translateCognitoError(err)
      // Não revelar se a conta existe ou não — segue pro próximo passo normalmente.
      if (code === "UserNotFoundException") {
        onSent(email)
        return
      }
      setError(message)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <>
      <h1 className="text-3xl font-bold text-midnight dark:text-[#E6E8EF] mb-1">Esqueceu sua senha?</h1>
      <p className="text-sm text-[#6B7280] mb-8">
        Informe seu e-mail e enviaremos um código para redefinir sua senha.
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" placeholder="seu@email.com" {...form.register("email")} aria-invalid={!!form.formState.errors.email} />
          {form.formState.errors.email && (
            <p className="text-xs text-neg">{form.formState.errors.email.message as string}</p>
          )}
        </div>

        {error && <p className="text-xs text-neg">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full bg-teal-500 hover:bg-teal-500/90 text-white">
          {submitting ? "Enviando..." : "Enviar código"}
        </Button>
      </form>
    </>
  )
}

/** Etapa 2: código de 6 dígitos + nova senha, confirmados via Cognito. */
function StepConfirm({ email, onDone, onBack }: { email: string; onDone: () => void; onBack: () => void }) {
  const form = useForm<ResetData>({ resolver: zodResolver(resetSchema) })
  const [code, setCode] = useState(Array(6).fill(""))
  const [showPw, setShowPw] = useState(false)
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(30)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (resendTimer <= 0) return
    const interval = setInterval(() => {
      setResendTimer((t) => (t <= 1 ? 0 : t - 1))
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
    document.getElementById(`otp-${Math.min(pasted.length, 5)}`)?.focus()
  }

  const handleResend = async () => {
    try {
      await auth.forgotPassword(email)
    } catch { /* best-effort */ }
    setResendTimer(30)
  }

  const onSubmit = form.handleSubmit(async ({ newPassword }) => {
    const fullCode = code.join("")
    if (fullCode.length !== 6) {
      setError("Informe o código de 6 dígitos.")
      return
    }
    setError("")
    setSubmitting(true)
    try {
      await auth.confirmForgotPassword(email, fullCode, newPassword)
      onDone()
    } catch (err) {
      setError(translateCognitoError(err).message)
    } finally {
      setSubmitting(false)
    }
  })

  return (
    <>
      <h1 className="text-3xl font-bold text-midnight dark:text-[#E6E8EF] mb-1">Redefinir senha</h1>
      <p className="text-sm text-[#6B7280] mb-6">
        Mandamos um código de 6 dígitos para <strong className="text-midnight dark:text-[#E6E8EF]">{email}</strong>
      </p>

      <form onSubmit={onSubmit} className="space-y-4">
        <div className="flex justify-center gap-2" onPaste={handlePaste}>
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
              className="w-11 h-13 text-center text-xl font-bold border-2 border-[#E5E7EB] rounded-xl focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10 outline-none transition-all disabled:opacity-50"
            />
          ))}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="newPassword">Nova senha</Label>
          <div className="relative">
            <Input
              id="newPassword"
              type={showPw ? "text" : "password"}
              placeholder="••••••••"
              {...form.register("newPassword")}
              aria-invalid={!!form.formState.errors.newPassword}
            />
            <button
              type="button"
              onClick={() => setShowPw(!showPw)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-midnight dark:hover:text-[#E6E8EF]"
            >
              {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {form.formState.errors.newPassword && (
            <p className="text-xs text-neg">{form.formState.errors.newPassword.message as string}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="confirmPassword">Confirmar nova senha</Label>
          <Input
            id="confirmPassword"
            type={showPw ? "text" : "password"}
            placeholder="••••••••"
            {...form.register("confirmPassword")}
            aria-invalid={!!form.formState.errors.confirmPassword}
          />
          {form.formState.errors.confirmPassword && (
            <p className="text-xs text-neg">{form.formState.errors.confirmPassword.message as string}</p>
          )}
        </div>

        {error && <p className="text-xs text-neg">{error}</p>}

        <Button type="submit" disabled={submitting} className="w-full bg-teal-500 hover:bg-teal-500/90 text-white">
          {submitting ? "Redefinindo..." : "Redefinir senha"}
        </Button>
      </form>

      <div className="flex items-center justify-between mt-4 text-sm">
        <button onClick={onBack} className="flex items-center gap-1 text-[#6B7280] hover:text-midnight dark:hover:text-[#E6E8EF]">
          <ArrowLeft className="w-3.5 h-3.5" /> Voltar
        </button>
        <p className="text-[#6B7280]">
          {resendTimer > 0 ? (
            `Reenviar em ${resendTimer}s`
          ) : (
            <button onClick={handleResend} className="text-teal-500 font-semibold hover:underline">
              Reenviar código
            </button>
          )}
        </p>
      </div>
    </>
  )
}

function StepDone({ email }: { email: string }) {
  return (
    <div className="text-center">
      <div className="mx-auto w-16 h-16 rounded-2xl bg-teal-50 flex items-center justify-center mb-6">
        <svg className="w-8 h-8 text-teal-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
        </svg>
      </div>
      <h1 className="text-3xl font-bold text-midnight dark:text-[#E6E8EF] mb-1">Senha redefinida</h1>
      <p className="text-sm text-[#6B7280] mb-8">Sua senha foi alterada com sucesso. Entre com sua nova senha.</p>
      <Link to="/login" state={{ email }}>
        <Button className="w-full bg-teal-500 hover:bg-teal-500/90 text-white">Ir para o login</Button>
      </Link>
    </div>
  )
}

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<"request" | "confirm" | "done">("request")
  const [email, setEmail] = useState("")

  return (
    <div className="min-h-screen flex">
      <GradientPanel />

      <div className="w-full lg:w-1/2 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          {step === "request" && (
            <StepRequest onSent={(e) => { setEmail(e); setStep("confirm") }} />
          )}
          {step === "confirm" && (
            <StepConfirm email={email} onBack={() => setStep("request")} onDone={() => setStep("done")} />
          )}
          {step === "done" && <StepDone email={email} />}

          {step !== "done" && (
            <p className="text-center text-sm text-[#6B7280] mt-10">
              Lembrou sua senha?{" "}
              <Link to="/login" className="text-teal-500 font-semibold hover:underline">Voltar ao login</Link>
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
