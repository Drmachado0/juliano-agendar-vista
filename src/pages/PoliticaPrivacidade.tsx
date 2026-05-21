import { Helmet } from "react-helmet-async";
import { Link } from "react-router-dom";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { ShieldCheck, ArrowLeft } from "lucide-react";
import { openPreferences } from "@/lib/consent";

const ULTIMA_ATUALIZACAO = "02 de maio de 2026";

export default function PoliticaPrivacidade() {
  return (
    <>
      <Helmet>
        <title>Política de Privacidade · Dr. Juliano Machado</title>
        <meta
          name="description"
          content="Política de Privacidade e tratamento de dados pessoais do site Dr. Juliano Machado, em conformidade com a LGPD."
        />
        <link rel="canonical" href="https://drjulianomachado.com/politica-de-privacidade" />
        <meta property="og:title" content="Política de Privacidade · Dr. Juliano Machado" />
        <meta property="og:description" content="Como o site Dr. Juliano Machado coleta, utiliza e protege seus dados pessoais, em conformidade com a LGPD." />
        <meta property="og:url" content="https://drjulianomachado.com/politica-de-privacidade" />
        <meta property="og:type" content="article" />
        <meta name="robots" content="index, follow" />
      </Helmet>

      <div className="min-h-screen bg-background">
        <Header />

        <main className="container mx-auto px-4 py-12 md:py-20 max-w-3xl">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Voltar à página inicial
          </Link>

          <header className="mb-10">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <h1 className="text-3xl md:text-4xl font-bold text-foreground font-serif">
                  Política de Privacidade
                </h1>
                <p className="text-sm text-muted-foreground mt-1">
                  Última atualização: {ULTIMA_ATUALIZACAO}
                </p>
              </div>
            </div>
            <p className="text-muted-foreground leading-relaxed">
              Esta Política descreve como o site <strong>drjulianomachado.com</strong> coleta,
              utiliza, compartilha e protege seus dados pessoais, em conformidade com a Lei Geral
              de Proteção de Dados (Lei nº 13.709/2018 — LGPD).
            </p>
          </header>

          <article className="space-y-10 text-muted-foreground leading-relaxed">
            <Section title="1. Controlador dos dados">
              <p>
                <strong className="text-foreground">Dr. Juliano Machado</strong> — Médico Oftalmologista.
                <br />
                Endereços de atendimento: Paragominas/PA (Clinicor e Hospital Geral) e Belém/PA
                (Instituto de Olhos da Bahia e Vitria).
                <br />
                Contato:{" "}
                <a
                  href="https://wa.me/559184043477"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp +55 (91) 93618-0476
                </a>
                .
              </p>
            </Section>

            <Section title="2. Encarregado pelo tratamento (DPO)">
              <p>
                Solicitações relativas a dados pessoais podem ser enviadas pelo WhatsApp{" "}
                <a
                  href="https://wa.me/559184043477"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  +55 (91) 93618-0476
                </a>
                , identificando o assunto como “LGPD”.
              </p>
            </Section>

            <Section title="3. Dados que coletamos">
              <ul className="list-disc pl-6 space-y-1">
                <li>
                  <strong className="text-foreground">Identificação</strong>: nome completo, data de nascimento.
                </li>
                <li>
                  <strong className="text-foreground">Contato</strong>: telefone (WhatsApp) e e-mail.
                </li>
                <li>
                  <strong className="text-foreground">Agendamento</strong>: tipo de atendimento, convênio,
                  local, data e horário desejados, observações fornecidas.
                </li>
                <li>
                  <strong className="text-foreground">Navegação</strong>: endereço IP, identificadores de
                  dispositivo e cookies (quando autorizados).
                </li>
              </ul>
            </Section>

            <Section title="4. Finalidades do tratamento">
              <ul className="list-disc pl-6 space-y-1">
                <li>Execução do agendamento e prestação do atendimento médico.</li>
                <li>Envio de confirmações e lembretes por WhatsApp/e-mail.</li>
                <li>Solicitação de avaliações após o atendimento (quando aplicável).</li>
                <li>Comunicações de marketing e campanhas (mediante consentimento).</li>
                <li>Análise estatística de uso do site para melhoria contínua.</li>
                <li>Cumprimento de obrigações legais e regulatórias.</li>
              </ul>
            </Section>

            <Section title="5. Bases legais (LGPD, art. 7º)">
              <ul className="list-disc pl-6 space-y-1">
                <li><strong className="text-foreground">Execução de contrato</strong>: agendamento e atendimento.</li>
                <li><strong className="text-foreground">Consentimento</strong>: cookies de marketing/analytics e comunicações promocionais.</li>
                <li><strong className="text-foreground">Legítimo interesse</strong>: segurança da informação e prevenção a fraudes.</li>
                <li><strong className="text-foreground">Obrigação legal/regulatória</strong>: registros médicos exigidos pelos conselhos de classe.</li>
              </ul>
            </Section>

            <Section title="6. Compartilhamento de dados">
              <p>Compartilhamos dados apenas com operadores estritamente necessários:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li><strong className="text-foreground">Lovable Cloud</strong> (infraestrutura e banco de dados).</li>
                <li><strong className="text-foreground">Evolution API / WhatsApp</strong> (comunicação com pacientes).</li>
                <li><strong className="text-foreground">Google</strong> (Analytics, Tag Manager, Calendar, Ads).</li>
                <li><strong className="text-foreground">Meta</strong> (Pixel para mensuração de campanhas).</li>
                <li>Sistemas internos da clínica para gestão de prontuário.</li>
              </ul>
            </Section>

            <Section title="7. Cookies utilizados">
              <p>O site utiliza três categorias de cookies:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li><strong className="text-foreground">Necessários</strong> — sessão, segurança, preferências básicas. Não exigem consentimento.</li>
                <li><strong className="text-foreground">Analytics</strong> — Google Tag Manager e Google Analytics, para medir uso e desempenho.</li>
                <li><strong className="text-foreground">Marketing</strong> — Meta Pixel e Google Ads, para mensuração de campanhas e personalização.</li>
              </ul>
              <div className="mt-4">
                <Button variant="outline" onClick={openPreferences}>
                  Gerenciar minhas preferências
                </Button>
              </div>
            </Section>

            <Section title="8. Direitos do titular (art. 18 da LGPD)">
              <p>Você pode, a qualquer momento, solicitar:</p>
              <ul className="list-disc pl-6 space-y-1 mt-2">
                <li>Confirmação da existência de tratamento.</li>
                <li>Acesso aos seus dados.</li>
                <li>Correção de dados incompletos, inexatos ou desatualizados.</li>
                <li>Anonimização, bloqueio ou eliminação de dados desnecessários.</li>
                <li>Portabilidade dos dados.</li>
                <li>Eliminação dos dados tratados com base em consentimento.</li>
                <li>Informação sobre compartilhamento.</li>
                <li>Revogação do consentimento.</li>
              </ul>
              <p className="mt-2">
                Para exercer qualquer direito, entre em contato pelo{" "}
                <a
                  href="https://wa.me/559184043477"
                  className="text-primary hover:underline"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  WhatsApp +55 (91) 93618-0476
                </a>
                .
              </p>
            </Section>

            <Section title="9. Retenção e segurança">
              <p>
                Os dados são mantidos pelo tempo necessário ao cumprimento das finalidades acima ou
                conforme exigência legal/regulatória. Adotamos medidas técnicas e organizacionais
                (criptografia em trânsito e em repouso, controle de acesso, autenticação multifator
                para administradores) para proteger seus dados.
              </p>
            </Section>

            <Section title="10. Transferência internacional">
              <p>
                Alguns operadores (Google, Meta) podem processar dados fora do Brasil. Sempre que
                isso ocorrer, exigimos garantias adequadas de proteção compatíveis com a LGPD.
              </p>
            </Section>

            <Section title="11. Atualizações desta política">
              <p>
                Esta Política pode ser atualizada periodicamente. Mudanças relevantes serão
                comunicadas no site e, quando exigirem novo consentimento, o banner será reexibido.
              </p>
            </Section>
          </article>
        </main>

        <Footer />
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-xl md:text-2xl font-semibold text-foreground mb-3 font-serif">
        {title}
      </h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
