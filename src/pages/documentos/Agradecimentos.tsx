import React from 'react';
import { DocumentoPage, Section, Lista, Link } from '../../components/DocumentoPage';
import { useT } from '../../i18n';

const CONTACT_EMAIL = 'suporte@violalibre.com.br';

/**
 * Página deliberadamente incompleta: a lista de pessoas está vazia até que cada uma diga se
 * quer ser nomeada. Listar quem não pediu para aparecer é justamente o oposto do que a
 * página de privacidade promete, então o vazio aqui é a posição correta, não pendência.
 *
 * Os créditos de projetos externos não dependem de consulta: são licenças a cumprir.
 *
 * NOME DE PESSOA E DE PROJETO NÃO SE TRADUZ. O que vai para o dicionário é o texto em
 * volta; «Ernopolis», «Nino Coutinho», «React» e «Lucide» continuam escritos como são.
 */
export const Agradecimentos: React.FC = () => {
  const t = useT();
  return (
    <DocumentoPage
      title={t('documentos.agradecimentosTitulo')}
      intro={t('documentos.agradecimentosIntro')}
    >
      <Section n={1} title={t('documentos.agradSecAmigos')}>
        <Lista>
          <li>
            <Link href="https://ernopolis.neocities.org/">Ernopolis</Link>
            {t('documentos.agradErnopolis')}
          </li>
          <li>
            Nino Coutinho (<Link href="https://www.youtube.com/@johndowland/videos">YouTube</Link>,{' '}
            <Link href="https://www.tiktok.com/@coutinhonino">TikTok</Link>)
            {t('documentos.agradNino')}
          </li>
        </Lista>
        <p className="text-gray-600 italic mt-1">{t('documentos.agradListaEmMontagem')}</p>
        <p>
          {t('documentos.agradEscrevaPara')}{' '}
          <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
        </p>
      </Section>

      <Section n={2} title={t('documentos.agradSecArtistas')}>
        <p>{t('documentos.agradArtistas1')}</p>
        <p>{t('documentos.agradArtistas2')}</p>
        <p>{t('documentos.agradArtistas3')}</p>
      </Section>

      <Section n={3} title={t('documentos.agradSecProjetos')}>
        <p>{t('documentos.agradProjetosIntro')}</p>
        <Lista>
          <li>
            <Link href="https://github.com/gleitz/midi-js-soundfonts">midi-js-soundfonts</Link>
            {t('documentos.agradSoundfonts')}
          </li>
          <li>
            <Link href="https://react.dev">React</Link>,{' '}
            <Link href="https://vite.dev">Vite</Link> {t('comum.e')}{' '}
            <Link href="https://tailwindcss.com">Tailwind CSS</Link>
            {t('documentos.agradBase')}
          </li>
          <li>
            <Link href="https://lucide.dev">Lucide</Link>
            {t('documentos.agradIcones')}
          </li>
        </Lista>
      </Section>

      <Section n={4} title={t('documentos.agradSecAntes')}>
        <p>{t('documentos.agradAntes')}</p>
      </Section>
    </DocumentoPage>
  );
};
