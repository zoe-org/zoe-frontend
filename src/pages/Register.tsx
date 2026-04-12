import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { auth } from "@/features/auth/useAuth"
import { useNavigate, Link } from "react-router-dom"
import { Check } from "lucide-react"

function StepIntention({ onNext }: { onNext: (intent: string) => void }) {
  const [selected, setSelected] = useState("")

  const options = [
    { value: "monitor", emoji: "🔵", title: "Monitorar minha marca", desc: "Veja em tempo real o que falam sobre você em vídeos e podcasts." },
    { value: "campaigns", emoji: "🟦", title: "Gerenciar campanhas", desc: "Contratos digitais, escrow seguro e workflow.", badge: "mais completo" },
    { value: "both", emoji: "🩵", title: "Quero os dois", desc: "Inteligência + gestão com auditoria por IA." },
  ]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[--color-midnight]">O que você quer fazer com a Zoe?</h1>
        <p className="text-sm text-[#6B7280] mt-1">Você pode mudar isso depois.</p>
      </div>
      <div className="space-y-3">
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => setSelected(opt.value)}
            className={`w-full text-left p-4 rounded-lg border-2 transition-colors ${
              selected === opt.value
                ? "border-teal-500 bg-[#F0FDFA]"
                : "border-[#E5E7EB] hover:border-teal-500/30"
            }`}
          >
            <div className="flex items-start gap-3">
              <span className="text-xl">{opt.emoji}</span>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-[--color-midnight]">{opt.title}</span>
                  {opt.badge && (
                    <span className="text-[10px] font-medium bg-teal-500/10 text-teal-500 px-1.5 py-0.5 rounded">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-sm text-[#6B7280] mt-0.5">{opt.desc}</p>
              </div>
              {selected === opt.value && <Check className="w-5 h-5 text-[#00A799] shrink-0" />}
            </div>
          </button>
        ))}
      </div>
      <Button
        onClick={() => onNext(selected)}
        disabled={!selected}
        className="w-full bg-[#00A799] hover:bg-[#00A799]/90 text-white"
      >
        Continuar
      </Button>
    </div>
  )
}

const accountSchema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  email: z.string().email("E-mail inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  company: z.string().min(1, "Empresa obrigatória"),
  role: z.string().min(1, "Cargo obrigatório"),
  terms: z.literal(true, { error: () => ({ message: "Aceite os termos" }) }),
})

type AccountData = z.infer<typeof accountSchema>

function StepAccount({ onNext }: { onNext: (data: AccountData) => void }) {
  const form = useForm<AccountData>({ resolver: zodResolver(accountSchema) })
  const [error, setError] = useState("")
  const password = form.watch("password") ?? ""

  const strength = password.length >= 12 ? 3 : password.length >= 8 ? 2 : password.length >= 4 ? 1 : 0
  const strengthColors = ["bg-[#E5E7EB]", "bg-[#DC2626]", "bg-[#D97706]", "bg-[#16A34A]"]
  const strengthLabels = ["", "Fraca", "Média", "Forte"]

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-[--color-midnight]">Crie sua conta</h1>
        <p className="text-sm text-[#6B7280] mt-1">Leva menos de um minuto.</p>
      </div>
      <form
        onSubmit={form.handleSubmit(async (data) => {
          try {
            setError("")
            await auth.register(data.email, data.password)
            onNext(data)
          } catch (e: unknown) {
            setError(e instanceof Error ? e.message : "Erro ao criar conta.")
          }
        })}
        className="space-y-4"
      >
        <div className="space-y-1.5">
          <Label>Nome completo</Label>
          <Input {...form.register("name")} />
          {form.formState.errors.name && <p className="text-xs text-[#DC2626]">{form.formState.errors.name.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>E-mail corporativo</Label>
          <Input type="email" {...form.register("email")} />
          {form.formState.errors.email && <p className="text-xs text-[#DC2626]">{form.formState.errors.email.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Senha</Label>
          <Input type="password" {...form.register("password")} />
          {password.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex gap-1 flex-1">
                {[1, 2, 3].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full ${i <= strength ? strengthColors[strength] : "bg-[#E5E7EB]"}`} />
                ))}
              </div>
              <span className="text-xs text-[#6B7280]">{strengthLabels[strength]}</span>
            </div>
          )}
          {form.formState.errors.password && <p className="text-xs text-[#DC2626]">{form.formState.errors.password.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Empresa ou agência</Label>
          <Input {...form.register("company")} />
          {form.formState.errors.company && <p className="text-xs text-[#DC2626]">{form.formState.errors.company.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label>Cargo</Label>
          <select
            {...form.register("role")}
            className="w-full h-9 px-3 text-sm border border-[#E5E7EB] rounded-md bg-white"
          >
            <option value="">Selecione...</option>
            <option value="marketing">Marketing</option>
            <option value="growth">Growth</option>
            <option value="founder">Fundador(a)</option>
            <option value="agency">Agência</option>
            <option value="other">Outro</option>
          </select>
          {form.formState.errors.role && <p className="text-xs text-[#DC2626]">{form.formState.errors.role.message}</p>}
        </div>
        <label className="flex items-start gap-2 text-sm text-[#6B7280]">
          <input type="checkbox" {...form.register("terms")} className="mt-0.5 rounded border-[#E5E7EB]" />
          <span>Aceito os <a href="#" className="text-[#00A799] hover:underline">termos</a> e a <a href="#" className="text-[#00A799] hover:underline">política de privacidade</a></span>
        </label>
        {form.formState.errors.terms && <p className="text-xs text-[#DC2626]">{form.formState.errors.terms.message}</p>}

        {error && <p className="text-xs text-[#DC2626]">{error}</p>}

        <Button type="submit" className="w-full bg-[#00A799] hover:bg-[#00A799]/90 text-white">
          Criar minha conta
        </Button>
      </form>
    </div>
  )
}

function StepVerification({ email, onBack }: { email: string; onBack: () => void }) {
  const nav = useNavigate()
  const [code, setCode] = useState(Array(6).fill(""))
  const [error, setError] = useState("")
  const [resendTimer, setResendTimer] = useState(30)
  const [submitting, setSubmitting] = useState(false)

  useState(() => {
    const interval = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0 }
        return t - 1
      })
    }, 1000)
    return () => clearInterval(interval)
  })

  const handleDigit = (index: number, value: string) => {
    if (!/^\d?$/.test(value)) return
    const next = [...code]
    next[index] = value
    setCode(next)

    if (value && index < 5) {
      const el = document.getElementById(`otp-${index + 1}`)
      el?.focus()
    }

    if (value && index === 5) {
      const fullCode = next.join("")
      if (fullCode.length === 6) {
        submitCode(fullCode)
      }
    }
  }

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !code[index] && index > 0) {
      const el = document.getElementById(`otp-${index - 1}`)
      el?.focus()
    }
  }

  const submitCode = async (fullCode: string) => {
    try {
      setSubmitting(true)
      setError("")
      await auth.confirm(email, fullCode)
      nav("/dashboard")
    } catch {
      setError("Código inválido. Tente novamente.")
      setSubmitting(false)
    }
  }

  const handleResend = async () => {
    try {
      await auth.register(email, "")
    } catch {}
    setResendTimer(30)
  }

  return (
    <div className="space-y-6 text-center">
      <div>
        <h1 className="text-2xl font-bold text-[--color-midnight]">Confirme seu e-mail</h1>
        <p className="text-sm text-[#6B7280] mt-1">Mandamos um código de 6 dígitos pra <strong>{email}</strong></p>
      </div>
      <div className="flex justify-center gap-2">
        {code.map((digit, i) => (
          <input
            key={i}
            id={`otp-${i}`}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={digit}
            onChange={e => handleDigit(i, e.target.value)}
            onKeyDown={e => handleKeyDown(i, e)}
            disabled={submitting}
            className="w-11 h-13 text-center text-xl font-bold border border-[#E5E7EB] rounded-md focus:ring-2 focus:ring-[#00A799] outline-none"
          />
        ))}
      </div>
      {error && <p className="text-xs text-[#DC2626]">{error}</p>}
      <p className="text-sm text-[#6B7280]">
        {resendTimer > 0
          ? `Reenviar em ${resendTimer}s`
          : <button onClick={handleResend} className="text-[#00A799] hover:underline">Não recebeu? Reenviar</button>
        }
      </p>
      <button onClick={onBack} className="text-sm text-[#00A799] hover:underline">
        Usar e-mail diferente
      </button>
    </div>
  )
}

export default function RegisterPage() {
  const [step, setStep] = useState(1)
  const [email, setEmail] = useState("")

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between mb-2 text-xs text-[#6B7280]">
          <span>Passo {step} de 3</span>
        </div>
        <div className="h-1.5 bg-[#E5E7EB] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#00A799] rounded-full transition-all"
            style={{ width: `${(step / 3) * 100}%` }}
          />
        </div>
      </div>

      <div className="w-full max-w-md bg-white rounded-xl border border-[#E5E7EB] p-8 shadow-sm">
        {step === 1 && <StepIntention onNext={() => setStep(2)} />}
        {step === 2 && (
          <StepAccount
            onNext={(data) => {
              setEmail(data.email)
              setStep(3)
            }}
          />
        )}
        {step === 3 && <StepVerification email={email} onBack={() => setStep(2)} />}
      </div>

      {step === 1 && (
        <p className="text-sm text-[#6B7280] mt-6">
          Já tem conta?{" "}
          <Link to="/login" className="text-[#00A799] font-semibold hover:underline">Entrar</Link>
        </p>
      )}
    </div>
  )
}
