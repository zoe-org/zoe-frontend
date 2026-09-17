import { Link } from "react-router-dom"
import { LegalPage, PrivacyContact, Section } from "@/components/legal/LegalPage"

/**
 * Termos de Uso. Dizem, em linguagem direta, as regras que o produto já aplica — quem paga o
 * quê, onde o dinheiro fica, o que a aprovação significa. Texto de produto, não parecer: passa
 * pela revisão jurídica junto com os contratos.
 */
export default function TermsPage() {
  return (
    <LegalPage title="Termos de Uso">
      <p className="m-0 text-ink-muted">
        Estes termos valem para quem usa a Zoe — marcas, agências e criadores de conteúdo. Ao criar
        uma conta ou aceitar um convite, você concorda com eles e com a{" "}
        <Link to="/privacy" className="text-teal-500 hover:underline">Política de Privacidade</Link>.
      </p>

      <Section title="1. O que a Zoe faz">
        <p className="m-0">A Zoe organiza a contratação de criadores por marcas: convite, contrato
          digital, pagamento em custódia, envio e aprovação das entregas e emissão de nota fiscal.
          O contrato é firmado entre a marca e o criador; a Zoe intermedeia e é remunerada por uma
          taxa.</p>
      </Section>

      <Section title="2. Sua conta">
        <p className="m-0">Você é responsável pelas informações que fornece e pelo sigilo do seu
          acesso. Informe dados verdadeiros — o CPF ou CNPJ identifica você no contrato e na nota
          fiscal.</p>
        <p className="m-0">O criador entra na Zoe por convite de uma marca e tem conta própria: não
          acessa os dados do workspace de quem o convidou.</p>
      </Section>

      <Section title="3. Pagamento e custódia">
        <p className="m-0"><strong>O criador recebe o valor integral do contrato.</strong> A taxa da
          plataforma e o custo de processamento do pagamento são pagos pela marca, em acréscimo, e a
          composição aparece antes de o valor ser reservado.</p>
        <p className="m-0"><strong>A Zoe não guarda o dinheiro.</strong> O valor é reservado e mantido
          pelo provedor de pagamentos regulado, e só é liberado ao criador depois da aprovação da
          entrega, conforme o contrato.</p>
        <p className="m-0">Para receber, o criador precisa concluir a conta de recebimento com o
          provedor de pagamentos. Ele pode assinar e produzir antes disso; o pagamento é que aguarda
          a conta ficar pronta.</p>
      </Section>

      <Section title="4. Entregas e aprovação">
        <p className="m-0">A entrega vale pelo link da publicação no ar, não por arquivo enviado. A
          aprovação é sempre feita por uma pessoa da marca. Quando o contrato prevê, a entrega é
          aprovada automaticamente se o prazo de revisão vencer sem resposta da marca.</p>
        <p className="m-0">O criador é responsável pelo conteúdo que publica e por identificá-lo como
          publicidade, conforme o CONAR e as regras de cada plataforma.</p>
      </Section>

      <Section title="5. Uso indevido">
        <p className="m-0">É proibido usar a Zoe para fraude, para acessar dados de outros usuários
          ou para publicar conteúdo ilícito. Contas nessas situações podem ser suspensas.</p>
      </Section>

      <Section title="6. Disponibilidade">
        <p className="m-0">A Zoe está em evolução e pode ter interrupções. Valores em custódia não
          dependem da disponibilidade da Zoe: permanecem com o provedor de pagamentos.</p>
      </Section>

      <Section title="7. Encerramento e seus dados">
        <p className="m-0">Você pode pedir a exclusão dos seus dados como descrito na Política de
          Privacidade. Contratos, pagamentos e notas fiscais são mantidos pelo prazo legal. Dúvidas:{" "}
          <PrivacyContact />.</p>
      </Section>

      <Section title="8. Lei aplicável">
        <p className="m-0">Estes termos seguem a legislação brasileira.</p>
      </Section>
    </LegalPage>
  )
}
