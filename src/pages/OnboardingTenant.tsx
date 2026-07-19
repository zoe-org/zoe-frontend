import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { useNavigate } from "react-router-dom"
import { ShaderGradientCanvas, ShaderGradient } from "@shadergradient/react"
import { LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/features/auth/AuthContext"
import {
  clearOnboardingIntent,
  featuresForIntent,
  getOnboardingIntent,
} from "@/features/auth/onboardingIntent"
import { tenantsApi } from "@/lib/api/tenants"
import { ApiError } from "@/lib/api"
import ZoeLogo from "@/assets/zoe-logo.svg?react"

const SLUG_PREFIX = "zoe.ai/"

const schema = z.object({
  name: z.string().min(2, "Nome obrigatório"),
  slug: z.string()
    .min(3, "Mínimo 3 caracteres")
    .max(50, "Máximo 50 caracteres")
    .regex(/^[a-z0-9-]+$/, "Use apenas letras minúsculas, números e hífens"),
})

type FormData = z.infer<typeof schema>

function suggestSlug(name: string): string {
  return name
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50)
}

export default function OnboardingTenantPage() {
  const nav = useNavigate()
  const { user, refresh, signOut } = useAuth()
  const [error, setError] = useState("")
  const [slugTouched, setSlugTouched] = useState(false)

  const form = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", slug: "" },
  })
  const nameValue = form.watch("name")
  const slugValue = form.watch("slug")

  const onNameChange = (value: string) => {
    form.setValue("name", value, { shouldValidate: form.formState.isSubmitted })
    if (!slugTouched) {
      form.setValue("slug", suggestSlug(value), { shouldValidate: form.formState.isSubmitted })
    }
  }

  const onSlugChange = (value: string) => {
    setSlugTouched(true)
    form.setValue("slug", value, { shouldValidate: form.formState.isSubmitted })
  }

  const onSubmit = form.handleSubmit(async (data) => {
    setError("")
    try {
      // Intent vem do StepIntentionLarge do Register (persistido em localStorage).
      // Sem intent (ex.: reload no meio do fluxo) cai no default = todas as features.
      const features = featuresForIntent(getOnboardingIntent())
      await tenantsApi.create({ ...data, features })
      clearOnboardingIntent()
      await refresh()
      nav("/dashboard", { replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          form.setError("slug", { message: "Esse identificador já está em uso." })
          return
        }
        setError(err.message)
        return
      }
      setError("Falha ao criar workspace.")
    }
  })

  const firstName = user?.name?.split(" ")[0]

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Background — ShaderGradient cobrindo a tela inteira */}
      <div className="absolute inset-0 pointer-events-none">
        <ShaderGradientCanvas style={{ position: "absolute", inset: 0, width: "100%", height: "100%", pointerEvents: "none" }}>
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
      <div className="absolute inset-0 bg-black/20 pointer-events-none" />

      {/* Header fixo com logo e logout */}
      <header className="relative z-10 flex items-center justify-between p-6 lg:px-10">
        <ZoeLogo className="w-14 h-auto text-white drop-shadow-md" />
        <button
          type="button"
          onClick={async () => { await signOut(); nav("/login", { replace: true }) }}
          className="flex items-center gap-1.5 text-sm font-medium text-white/90 hover:text-white transition-colors [text-shadow:0_1px_2px_rgba(0,0,0,0.2)]"
        >
          <LogOut className="w-4 h-4" />
          Sair
        </button>
      </header>

      {/* Card centralizado */}
      <main className="relative z-10 flex items-center justify-center px-4 pb-10 min-h-[calc(100vh-7rem)]">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-2xl shadow-black/20 p-8 sm:p-10">
            <div className="mb-6">
              <span className="text-[10px] uppercase tracking-[0.18em] font-semibold text-teal-700">
                Último passo
              </span>
              <h1 className="text-2xl sm:text-3xl font-bold text-midnight dark:text-[#E6E8EF] mt-2">
                {firstName ? `Bem-vindo(a), ${firstName}` : "Crie seu workspace"}
              </h1>
              <p className="text-sm text-[#6B7280] mt-2">
                Dá um nome pro workspace da sua empresa. Esse é o espaço onde tudo da Zoe vai acontecer.
              </p>
            </div>

            <form onSubmit={onSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="name">Nome do workspace</Label>
                <Input
                  id="name"
                  placeholder="Acme S.A."
                  value={nameValue ?? ""}
                  onChange={(e) => onNameChange(e.target.value)}
                  aria-invalid={!!form.formState.errors.name}
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-neg">{form.formState.errors.name.message}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="slug">Identificador</Label>
                <div className="flex rounded-md border border-input bg-transparent focus-within:ring-1 focus-within:ring-ring focus-within:border-ring overflow-hidden">
                  <span className="inline-flex items-center px-3 bg-[#F3F4F6] text-[#6B7280] text-sm select-none border-r border-input">
                    {SLUG_PREFIX}
                  </span>
                  <input
                    id="slug"
                    placeholder="acme"
                    value={slugValue ?? ""}
                    onChange={(e) => onSlugChange(e.target.value)}
                    aria-invalid={!!form.formState.errors.slug}
                    className="flex-1 px-3 py-1 text-sm bg-transparent outline-none placeholder:text-muted-foreground"
                  />
                </div>
                <p className="text-[11px] text-[#6B7280]">Letras minúsculas, números e hífens.</p>
                {form.formState.errors.slug && (
                  <p className="text-xs text-neg">{form.formState.errors.slug.message}</p>
                )}
              </div>

              {error && <p className="text-xs text-neg">{error}</p>}

              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
                className="w-full bg-teal-500 hover:bg-teal-500/90 text-white"
              >
                {form.formState.isSubmitting ? "Criando workspace..." : "Criar workspace"}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-white/90 mt-6 [text-shadow:0_1px_2px_rgba(0,0,0,0.3)]">
            Foi convidado(a)? <span className="font-semibold">Use o link no e-mail</span> em vez de criar um workspace novo.
          </p>
        </div>
      </main>
    </div>
  )
}
