import React from 'react';
import { DocumentoPage, Section, Link } from '../../components/DocumentoPage';

// Canal de contato para notice-and-takedown. Centralizado numa constante pra facilitar a troca.
const CONTACT_EMAIL = 'suporte@violalibre.com.br';

// Repositório open source do projeto — referência da licença do código.
const REPO_URL = 'https://github.com/matheus-fsc/Viola-Libre';

// Data da última atualização deste termo (mostrada ao final da página).
const LAST_UPDATED = '14 de julho de 2026';

export const TermosDeUso: React.FC = () => (
  <DocumentoPage
    title="Termos de Uso — Viola Libre"
    lastUpdated={LAST_UPDATED}
    intro={
      <>
        O acesso e o uso do Viola Libre implicam ciência e concordância com os termos abaixo.
        Este é um documento simples, feito para ser lido — sem letras miúdas.
      </>
    }
  >
    <Section n={1} title="Natureza do projeto">
      <p>
        O Viola Libre é um projeto comunitário, de código aberto (open source) e sem fins lucrativos.
      </p>
      <p>
        Não há anúncios, monetização ou cobrança de qualquer tipo — nem agora, nem como plano futuro.
      </p>
      <p>
        Seu objetivo é ser uma ferramenta de teoria musical e visualização de acordes e cifras
        para viola caipira e outros instrumentos de corda.
      </p>
    </Section>

    <Section n={2} title="Propriedade de conteúdo">
      <p>
        O código-fonte, os algoritmos de visualização, o modelo de dados e as ferramentas de
        teoria e treino são de autoria própria e estão licenciados como open source, sob a
        licença declarada no <Link href={REPO_URL}>repositório do projeto no GitHub</Link>.
      </p>
      <p>
        Parte do conteúdo textual — como letras e cifras — pode não ser de autoria do site,
        tendo origem em terceiros ou sido enviada pela própria comunidade de usuários.
      </p>
      <p>
        O Viola Libre não reivindica propriedade sobre letras de música, que pertencem aos
        seus respectivos compositores e editoras.
      </p>
    </Section>

    <Section n={3} title="Notificação e remoção">
      <p>
        Qualquer titular de direitos que identifique conteúdo de sua autoria publicado aqui
        sem autorização pode solicitar a remoção.
      </p>
      <p>
        O canal de contato para essas solicitações é o e-mail:{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </p>
      <p>
        Nos comprometemos a avaliar e responder às solicitações em prazo razoável.
      </p>
    </Section>

    <Section n={4} title="Participação da comunidade">
      <p>
        Usuários podem contribuir com conteúdo, de forma identificada ou anônima.
      </p>
      <p>
        As contribuições ficam sujeitas a moderação e podem ser removidas a critério do projeto,
        especialmente mediante notificação de terceiros.
      </p>
    </Section>

    <Section n={5} title="Isenção de responsabilidade">
      <p>
        O site é fornecido "como está", sem garantia de disponibilidade contínua. A infraestrutura
        é de capacidade limitada e pode ficar indisponível a qualquer momento, sem aviso prévio.
      </p>
      <p>
        Também não há garantia de precisão musical ou teórica das cifras e do conteúdo educacional
        apresentado.
      </p>
    </Section>

    <Section n={6} title="Privacidade">
      <p>
        O tratamento de dados é descrito em documento próprio, a{' '}
        <a href="/privacidade" className="text-[#0058e6] underline hover:text-[#3a8bfb] font-bold">
          Política de Privacidade
        </a>.
      </p>
    </Section>

    <Section n={7} title="Alterações nos termos">
      <p>
        Estes termos podem ser atualizados a qualquer momento. A data da última atualização
        fica sempre visível ao final desta página.
      </p>
    </Section>
  </DocumentoPage>
);
