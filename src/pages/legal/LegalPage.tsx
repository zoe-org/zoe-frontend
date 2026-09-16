import { Link } from "react-router-dom"
import ZoeLogo from "@/assets/zoe-logo.svg?react"
import { LEGAL_VERSION, PRIVACY_CONTACT_EMAIL } from "@/pages/legal/legal"

/**
 * Moldura dos documentos legais. Pública e fora do AppShell: é lida antes de existir conta —
 * no cadastro e no convite —, e quem abre pelo link do checkbox não pode cair num login.
 */
export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh" style={{ background: "var(--bg, #FAFBFC)" }}>
      <header className="border-b border-border-soft" style={{ background: "var(--surface)" }}>
        <div className="max-w-[760px] mx-auto px-6 py-4 flex items-center justify-between gap-4">
          <Link to="/" aria-label="Zoe"><ZoeLogo className="h-6 w-auto" /></Link>
          <nav className="flex gap-4 text-[12.5px]">
            <Link to="/termos" className="text-ink-muted hover:underline">Termos de Uso</Link>
            <Link to="/privacidade" className="text-ink-muted hover:underline">Privacidade</Link>
          </nav>
        </div>
      </header>

      <main className="max-w-[760px] mx-auto px-6 py-10">
        <h1 className="font-display m-0 mb-1.5" style={{ fontSize: 30, color: "var(--ink)" }}>{title}</h1>
        <p className="text-[12.5px] text-ink-muted m-0 mb-8">
          Versão {LEGAL_VERSION.split("-").reverse().join("/")}
        </p>
        <article className="legal-doc flex flex-col gap-6 text-[14px] leading-relaxed" style={{ color: "var(--ink)" }}>
          {children}
        </article>
      </main>
    </div>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-[16px] font-semibold m-0 mb-2" style={{ color: "var(--ink)" }}>{title}</h2>
      <div className="flex flex-col gap-2 text-ink-muted [&_strong]:text-[var(--ink)]">{children}</div>
    </section>
  )
}

/** Canal de contato, ou o aviso de que ainda não foi definido — nunca um endereço inventado. */
export function PrivacyContact() {
  return PRIVACY_CONTACT_EMAIL ? (
    <a href={`mailto:${PRIVACY_CONTACT_EMAIL}`} className="text-teal-500 font-medium hover:underline">
      {PRIVACY_CONTACT_EMAIL}
    </a>
  ) : (
    <strong>o canal de contato do encarregado, que será publicado aqui</strong>
  )
}
