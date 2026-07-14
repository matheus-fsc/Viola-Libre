import React from 'react';
import { useNavigate } from 'react-router-dom';

// Canal de contato para notice-and-takedown. Centralizado numa constante pra facilitar a troca.
const CONTACT_EMAIL = 'suporte@violalibre.com.br';

// Repositório open source do projeto — referência da licença do código.
const REPO_URL = 'https://github.com/matheus-fsc/Viola-Libre';

// Data da última atualização deste termo (mostrada ao final da página).
const LAST_UPDATED = '14 de julho de 2026';

const Section: React.FC<{ n: number; title: string; children: React.ReactNode }> = ({ n, title, children }) => (
  <section className="flex flex-col gap-2">
    <h2 className="text-sm sm:text-base font-bold text-[#002fa7] font-mono border-b border-dashed border-[#808080] pb-1">
      {n}. {title}
    </h2>
    <div className="flex flex-col gap-2 text-xs sm:text-sm leading-relaxed text-black/90">
      {children}
    </div>
  </section>
);

export const TermosDeUso: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="p-2 sm:p-4">
      <div className="bg-white border-2 border-[#808080] border-r-white border-bottom-white flex flex-col font-sans">

        {/* Cabeçalho do documento */}
        <div className="winxp-gradient-blue text-white px-3 py-1.5 flex justify-between items-center select-none">
          <span className="font-bold text-xs sm:text-sm font-mono">Termos de Uso — Viola Libre</span>
          <button
            onClick={() => navigate('/cifras')}
            className="px-2 py-0.5 bg-[#ece9d8] text-black border border-white border-r-[#808080] border-bottom-[#808080] active:border-t-[#808080] active:border-l-[#808080] font-bold text-[10px] sm:text-xs hover:bg-white cursor-pointer"
            title="Voltar ao aplicativo"
          >
            ← Voltar
          </button>
        </div>

        {/* Corpo do termo */}
        <div className="p-4 sm:p-6 flex flex-col gap-6 max-w-3xl">

          <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">
            O acesso e o uso do Viola Libre implicam ciência e concordância com os termos abaixo.
            Este é um documento simples, feito para ser lido — sem letras miúdas.
          </p>

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
              licença declarada no{' '}
              <a
                href={REPO_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[#0058e6] underline hover:text-[#3a8bfb] font-bold"
              >
                repositório do projeto no GitHub
              </a>.
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
              <a
                href={`mailto:${CONTACT_EMAIL}`}
                className="text-[#0058e6] underline hover:text-[#3a8bfb] font-bold break-all"
              >
                {CONTACT_EMAIL}
              </a>.
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

          <Section n={6} title="Alterações nos termos">
            <p>
              Estes termos podem ser atualizados a qualquer momento. A data da última atualização
              fica sempre visível ao final desta página.
            </p>
          </Section>

          <div className="border-t border-[#808080] pt-3 mt-1 text-[11px] sm:text-xs text-gray-500 font-mono select-none">
            Última atualização: {LAST_UPDATED}
          </div>

        </div>
      </div>
    </div>
  );
};
