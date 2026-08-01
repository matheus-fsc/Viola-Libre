import React from 'react';
import { DocumentoPage, Section, Lista, Link } from '../../components/DocumentoPage';

const CONTACT_EMAIL = 'suporte@violalibre.com.br';

/**
 * Página deliberadamente incompleta: a lista de pessoas está vazia até que cada uma diga se
 * quer ser nomeada. Listar quem não pediu para aparecer é justamente o oposto do que a
 * página de privacidade promete — então o vazio aqui é a posição correta, não pendência.
 *
 * Os créditos de projetos externos não dependem de consulta: são licenças a cumprir.
 */
export const Agradecimentos: React.FC = () => (
  <DocumentoPage
    title="Agradecimentos — Viola Libre"
    intro={
      <>
        O Viola Libre existe por causa de gente que emprestou tempo, ouvido e conhecimento sem
        pedir nada em troca — e de trabalho aberto que outras pessoas deixaram disponível para
        quem viesse depois.
      </>
    }
  >
    <Section n={1} title="Comunidade">
      <p className="text-gray-600 italic">
        Esta lista ainda está sendo montada. Quem contribuiu está sendo consultado, um a um,
        sobre querer ou não ser nomeado aqui — ninguém entra sem ter dito que sim.
      </p>
      <p>
        Se você contribuiu e quer aparecer (ou prefere não aparecer), escreva para{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </p>
    </Section>

    <Section n={2} title="Projetos que tornaram isto possível">
      <p>
        O site se apoia em trabalho aberto de outras pessoas:
      </p>
      <Lista>
        <li>
          <Link href="https://github.com/gleitz/midi-js-soundfonts">midi-js-soundfonts</Link>{' '}
          — os bancos de som que fazem os acordes soarem.
        </li>
        <li>
          <Link href="https://react.dev">React</Link>,{' '}
          <Link href="https://vite.dev">Vite</Link> e{' '}
          <Link href="https://tailwindcss.com">Tailwind CSS</Link> — a base sobre a qual a
          interface foi construída.
        </li>
        <li>
          <Link href="https://lucide.dev">Lucide</Link> — os ícones.
        </li>
      </Lista>
    </Section>

    <Section n={3} title="A quem tocou antes">
      <p>
        À tradição da viola caipira e a quem a manteve viva sem esperar por site nenhum.
      </p>
    </Section>
  </DocumentoPage>
);
