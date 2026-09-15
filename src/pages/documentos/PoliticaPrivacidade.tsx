import React from 'react';
import { DocumentoPage, Section, Lista, Link } from '../../components/DocumentoPage';
import { YouTubeJsConsentControl } from '../../components/YouTubeJsGate';
import { useIdioma, useT } from '../../i18n';

const CONTACT_EMAIL = 'suporte@violalibre.com.br';
const REPO_URL = 'https://github.com/matheus-fsc/Viola-Libre';

/**
 * Escrita a partir do que o código faz, não do que seria confortável dizer.
 *
 * As fontes de verdade, para quem for atualizar isto: `public/_headers` (o CSP enumera todo
 * terceiro que o navegador pode contatar), `src/services/api.ts` (o que vai pro servidor do
 * projeto, incluindo o hash de usuário) e as chamadas a localStorage/sessionStorage
 * espalhadas pelos serviços. Mudou uma dessas, esta página precisa mudar junto.
 *
 * E precisa mudar NOS DOIS IDIOMAS: o texto vive em `documentos.priv*`, e o tipo do
 * dicionário reprova a build se um lado ficar para trás. Uma política de privacidade que
 * diverge entre idiomas é pior que uma só.
 */
export const PoliticaPrivacidade: React.FC = () => {
  const t = useT();
  const idioma = useIdioma();

  return (
    <DocumentoPage
      title={t('documentos.privTitulo')}
      lastUpdated={t('documentos.privData')}
      intro={
        <>
          {t('documentos.privIntro')}
          {idioma !== 'pt-BR' && (
            <em className="block mt-2 text-gray-600">{t('documentos.termosPrevalece')}</em>
          )}
        </>
      }
    >
      <Section n={1} title={t('documentos.privSec1')}>
        <p>{t('documentos.priv1a')}</p>
        <p>
          {t('documentos.priv1bAntes')} <strong>{t('documentos.priv1bForte')}</strong>
          {t('documentos.priv1bDepois')}
        </p>
      </Section>

      <Section n={2} title={t('documentos.privSec2')}>
        <p>{t('documentos.priv2a')}</p>
        <Lista>
          <li>{t('documentos.priv2i1')}</li>
          <li>{t('documentos.priv2i2')}</li>
          <li>{t('documentos.priv2i3')}</li>
          <li>{t('documentos.priv2i4')}</li>
          <li>{t('documentos.priv2i5')}</li>
          <li>{t('documentos.priv2i6')}</li>
        </Lista>
        <p>{t('documentos.priv2b')}</p>
      </Section>

      <Section n={3} title={t('documentos.privSec3')}>
        <p>
          {t('documentos.priv3aAntes')} <strong>{t('documentos.priv3aForte')}</strong>{' '}
          {t('documentos.priv3aDepois')}
        </p>
        <p>{t('documentos.priv3b')}</p>
        <p>{t('documentos.priv3c')}</p>
      </Section>

      <Section n={4} title={t('documentos.privSec4')}>
        <p>{t('documentos.priv4a')}</p>
        <Lista>
          <li>
            <strong>{t('documentos.priv4Favoritos')}</strong> {t('documentos.priv4FavoritosTexto')}
          </li>
          <li>
            <strong>{t('documentos.priv4Acessos')}</strong> {t('documentos.priv4AcessosTexto')}
          </li>
          <li>
            <strong>{t('documentos.priv4Contribuicoes')}</strong>{' '}
            {t('documentos.priv4ContribuicoesTexto')}
          </li>
        </Lista>
        <p>{t('documentos.priv4b')}</p>
      </Section>

      <Section n={5} title={t('documentos.privSec5')}>
        <p>{t('documentos.priv5a')}</p>
        <Lista>
          <li>
            <strong>{t('documentos.priv5Cloudflare')}</strong> {t('documentos.priv5CloudflareTexto')}
          </li>
          <li>
            <strong>{t('documentos.priv5YouTube')}</strong> {t('documentos.priv5YouTubeAntes')}{' '}
            <strong>{t('documentos.priv5YouTubeForte')}</strong>{' '}
            {t('documentos.priv5YouTubeDepois')}
            {/* A chave liga/desliga mora aqui e nas Preferências: é o mesmo componente, então
                as duas telas nunca discordam sobre o que está autorizado. */}
            <YouTubeJsConsentControl />
          </li>
          <li>
            <strong>{t('documentos.priv5GitHub')}</strong> {t('documentos.priv5GitHubTexto')}
          </li>
        </Lista>
      </Section>

      <Section n={6} title={t('documentos.privSec6')}>
        <p>
          {t('documentos.priv6aAntes')} <em>{t('documentos.priv6aEnfase')}</em>
          {t('documentos.priv6aDepois')}
        </p>
        <p>{t('documentos.priv6b')}</p>
      </Section>

      <Section n={7} title={t('documentos.privSec7')}>
        <Lista>
          <li>
            <strong>{t('documentos.priv7Aparelho')}</strong> {t('documentos.priv7AparelhoTexto')}
          </li>
          <li>
            <strong>{t('documentos.priv7Servidor')}</strong> {t('documentos.priv7ServidorTexto')}
          </li>
        </Lista>
      </Section>

      <Section n={8} title={t('documentos.privSec8')}>
        <p>{t('documentos.priv8a')}</p>
      </Section>

      <Section n={9} title={t('documentos.privSec9')}>
        <p>
          {t('documentos.priv9a')}{' '}
          <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
        </p>
        <p>
          {t('documentos.priv9bAntes')}{' '}
          <Link href={REPO_URL}>{t('documentos.priv9bLink')}</Link>
          {t('documentos.priv9bDepois')}
        </p>
      </Section>

      <Section n={10} title={t('documentos.privSec10')}>
        <p>{t('documentos.priv10a')}</p>
      </Section>
    </DocumentoPage>
  );
};
