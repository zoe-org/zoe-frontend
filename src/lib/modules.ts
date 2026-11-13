/**
 * Interruptor do módulo Operations. Desligado, o código segue no repositório mas a
 * plataforma se comporta como se só o Intelligence existisse: sem menu, sem rotas,
 * sem opção de contratar, sem escolha no cadastro.
 *
 * Para religar: `VITE_OPERATIONS_ENABLED=true` no .env.local (e na Vercel).
 * O ponto central é `hasFeature` no AuthContext; o resto da UI só consulta esta flag
 * onde não passa por feature (rotas, cadastro, onboarding, abas de plano).
 */
export const OPERATIONS_ENABLED = import.meta.env.VITE_OPERATIONS_ENABLED === "true"
