import { Link } from "react-router-dom"
import { LegalPage, PrivacyContact, Section } from "@/components/legal/LegalPage"

/**
 * Política de Privacidade descrevendo o que o sistema faz; passa pela revisão jurídica antes do primeiro cliente.
 */
export default function PrivacyPage() {
  return (
    <LegalPage title="Política de Privacidade">
      <p className="m-0 text-ink-muted">
        A Zoe conecta marcas e criadores de conteúdo: contratos, pagamento em custódia, envio e
        aprovação de entregas. Esta política explica quais dados pessoais tratamos para isso, por
        que, com quem compartilhamos e como você exerce seus direitos, conforme a Lei Geral de
        Proteção de Dados (Lei nº 13.709/2018).
      </p>

      <Section title="1. Quais dados tratamos">
        <p className="m-0"><strong>Da sua conta:</strong> nome e e-mail. A senha é guardada pelo
          provedor de autenticação — a Zoe não a conhece.</p>
        <p className="m-0"><strong>Se você é criador:</strong> CPF ou CNPJ, país, área de atuação,
          faixa de audiência, temas, apresentação, portfólio e redes sociais que você informar; os
          vídeos de pré-aprovação e os links das publicações que enviar; contratos, decisões sobre
          as entregas e pagamentos.</p>
        <p className="m-0"><strong>Se você representa uma marca:</strong> nome e CNPJ da empresa, e
          nome, e-mail e papel de cada membro do workspace.</p>
        <p className="m-0"><strong>Registros de uso:</strong> quem fez cada ação relevante e quando —
          assinatura, aprovação, pagamento. Esses registros guardam o fato, não o conteúdo dos seus
          dados.</p>
        <p className="m-0"><strong>O que a Zoe não guarda:</strong> dados bancários e documentos de
          verificação de identidade ficam com o provedor de pagamentos.</p>
      </Section>

      <Section title="2. Para que usamos">
        <p className="m-0"><strong>Cumprir o contrato entre marca e criador</strong> (art. 7º, V):
          montar e assinar o contrato, reservar e liberar o pagamento, receber e revisar entregas,
          avisar cada parte do que depende dela.</p>
        <p className="m-0"><strong>Cumprir obrigações legais</strong> (art. 7º, II): emitir notas
          fiscais e guardar contratos e registros de pagamento pelo prazo que a lei exige.</p>
        <p className="m-0"><strong>Segurança e prevenção de fraude</strong> (art. 7º, IX): controlar
          acesso e manter a trilha de quem movimentou valores.</p>
        <p className="m-0">Não usamos seus dados para publicidade e não os vendemos.</p>
      </Section>

      <Section title="3. Com quem compartilhamos">
        <p className="m-0"><strong>A marca que contrata você</strong> vê o que o trabalho exige:
          nome, perfil, redes, entregas e o contrato. Seu CPF ou CNPJ aparece apenas no documento
          do contrato, que identifica as partes.</p>
        <p className="m-0">Usamos fornecedores que tratam dados em nosso nome, só para a finalidade
          de cada serviço:</p>
        <ul className="m-0 pl-5 list-disc flex flex-col gap-1">
          <li><strong>Stripe</strong> — pagamentos, custódia, conta de recebimento e verificação de identidade.</li>
          <li><strong>Clicksign</strong> — assinatura eletrônica dos contratos.</li>
          <li><strong>Amazon Web Services</strong> — hospedagem, autenticação e armazenamento dos vídeos enviados.</li>
          <li><strong>Resend</strong> — envio dos e-mails de aviso.</li>
          <li><strong>Nota Gateway</strong> — emissão de notas fiscais.</li>
        </ul>
        <p className="m-0">Alguns desses fornecedores processam dados fora do Brasil, com as
          garantias exigidas pela lei para transferência internacional (art. 33).</p>
      </Section>

      <Section title="4. Por quanto tempo guardamos">
        <p className="m-0">Os dados do seu perfil ficam enquanto a conta existir ou até você pedir a
          exclusão. Contratos, entregas, pagamentos e notas fiscais são guardados pelo prazo que a
          lei exige, mesmo depois de um pedido de exclusão (art. 16, I) — apagá-los destruiria
          documentos de que você e a marca podem precisar.</p>
      </Section>

      <Section title="5. Seus direitos">
        <p className="m-0">Você pode, a qualquer momento (art. 18):</p>
        <ul className="m-0 pl-5 list-disc flex flex-col gap-1">
          <li>confirmar que tratamos seus dados e <strong>acessá-los</strong>;</li>
          <li><strong>corrigir</strong> dados incompletos ou desatualizados;</li>
          <li>receber seus dados em formato legível por máquina (<strong>portabilidade</strong>);</li>
          <li>pedir a <strong>eliminação</strong> dos dados que não precisamos guardar por lei;</li>
          <li>saber com quem compartilhamos seus dados.</li>
        </ul>
        <p className="m-0">Criadores fazem isso direto na própria área: <strong>Baixar meus
          dados</strong> e <strong>Pedir exclusão dos dados</strong> ficam no fim da página, e o
          perfil pode ser corrigido no cadastro. Para qualquer outro pedido, fale com <PrivacyContact />.</p>
      </Section>

      <Section title="6. Segurança">
        <p className="m-0">A comunicação é criptografada, o acesso é restrito por papel e cada
          workspace só vê os próprios dados. Nenhum valor passa por conta da Zoe: o dinheiro fica
          com o provedor de pagamentos regulado.</p>
      </Section>

      <Section title="7. Mudanças nesta política">
        <p className="m-0">Quando o texto mudar, a versão e a data acima mudam junto. Veja também os{" "}
          <Link to="/terms" className="text-teal-500 hover:underline">Termos de Uso</Link>.</p>
      </Section>
    </LegalPage>
  )
}
