import React from 'react';
import { DocumentoPage, Section, Link } from '../../components/DocumentoPage';
import { useIdioma, useT } from '../../i18n';

// Canal de contato para notice-and-takedown. Centralizado numa constante pra facilitar a troca.
const CONTACT_EMAIL = 'suporte@violalibre.com.br';

// Repositório open source do projeto: referência da licença do código.
const REPO_URL = 'https://github.com/matheus-fsc/Viola-Libre';

/**
 * Documento jurídico traduzido, com uma ressalva que a tradução exige.
 *
 * O site é brasileiro, o contato de remoção é brasileiro e a relação se dá aqui. Uma
 * tradução de termos que não diga qual versão vale deixa em aberto justamente a pergunta
 * que um documento desses existe para fechar. Por isso a nota de prevalência aparece só na
 * versão em inglês: no português ela não teria o que dizer.
 */
export const TermosDeUso: React.FC = () => {
  const t = useT();
  const idioma = useIdioma();

  return (
    <DocumentoPage
      title={t('documentos.termosTitulo')}
      lastUpdated={t('documentos.termosData')}
      intro={
        <>
          {t('documentos.termosIntro')}
          {idioma !== 'pt-BR' && (
            <em className="block mt-2 text-gray-600">{t('documentos.termosPrevalece')}</em>
          )}
        </>
      }
    >
      <Section n={1} title={t('documentos.termosSec1')}>
        <p>{t('documentos.termos1a')}</p>
        <p>{t('documentos.termos1b')}</p>
        <p>{t('documentos.termos1c')}</p>
      </Section>

      <Section n={2} title={t('documentos.termosSec2')}>
        <p>
          {t('documentos.termos2a')} <Link href={REPO_URL}>{t('documentos.termos2Link')}</Link>.
        </p>
        <p>{t('documentos.termos2b')}</p>
        <p>{t('documentos.termos2c')}</p>
      </Section>

      <Section n={3} title={t('documentos.termosSec3')}>
        <p>{t('documentos.termos3a')}</p>
        <p>
          {t('documentos.termos3b')}{' '}
          <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
        </p>
        <p>{t('documentos.termos3c')}</p>
      </Section>

      <Section n={4} title={t('documentos.termosSec4')}>
        <p>{t('documentos.termos4a')}</p>
        <p>{t('documentos.termos4b')}</p>
      </Section>

      <Section n={5} title={t('documentos.termosSec5')}>
        <p>{t('documentos.termos5a')}</p>
        <p>{t('documentos.termos5b')}</p>
      </Section>

      <Section n={6} title={t('documentos.termosSec6')}>
        <p>
          {t('documentos.termos6a')}{' '}
          <a href="/privacidade" className="text-[#0058e6] underline hover:text-[#3a8bfb] font-bold">
            {t('abas.privacidade')}
          </a>.
        </p>
      </Section>

      <Section n={7} title={t('documentos.termosSec7')}>
        <p>{t('documentos.termos7a')}</p>
      </Section>
    </DocumentoPage>
  );
};
