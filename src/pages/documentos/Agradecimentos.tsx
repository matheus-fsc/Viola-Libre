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
        pedir nada em troca, e de trabalho aberto que outras pessoas deixaram disponível para
        quem viesse depois.
      </>
    }
  >
    <Section n={1} title="Amigos">
      <Lista>
        <li>
          <Link href="https://ernopolis.neocities.org/">Ernópolis</Link> — o amigo responsável
          por este site existir. Sem ele, nada teria acontecido. Contribuiu com a fagulha
          inicial e com o incômodo de que todos merecem um ambiente livre para aprender, tocar
          e compartilhar música. Ainda contribui com seu conhecimento musical, testa e contribui
          ativamente para a melhoria da plataforma. Prospector da espiculação — ele mesmo
          difundidor do termo{' '}
          <em>espicular</em>, a arte de ser curioso e sempre buscar mais conhecimento.
        </li>
      </Lista>
      <p className="text-gray-600 italic mt-1">
        Esta lista continua sendo montada. Quem contribuiu está sendo consultado, um a um,
        sobre querer ou não ser nomeado aqui. Ninguém entra sem ter dito que sim.
      </p>
      <p>
        Se você contribuiu e quer aparecer (ou prefere não aparecer), escreva para{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </p>
    </Section>

    <Section n={2} title="A todos os artistas e compositores">
      <p>
        Um agradecimento que não cabe em lista nenhuma: a todos os artistas e compositores que,
        de forma generalizada e imensurável, moldaram e continuam moldando a cultura e a arte
        que escrevem a história da humanidade.
      </p>
      <p>
        A música é o tempero que dá sabor à existência — não só de paz e amor, mas de todos os
        efeitos históricos que ela carrega e não deixa morrer na lembrança de cada um. Cada
        melodia composta, cada verso cantado, cada acorde inventado é um pedaço de memória
        coletiva que atravessa gerações e mantém vivo aquilo que os livros sozinhos não
        conseguem preservar.
      </p>
      <p>
        Este projeto existe porque antes dele existiu música. E a música existiu porque alguém
        teve a coragem de criar.
      </p>
    </Section>

    <Section n={3} title="Projetos que tornaram isto possível">
      <p>
        O site se apoia em trabalho aberto de outras pessoas:
      </p>
      <Lista>
        <li>
          <Link href="https://github.com/gleitz/midi-js-soundfonts">midi-js-soundfonts</Link>,
          os bancos de som que fazem os acordes soarem.
        </li>
        <li>
          <Link href="https://react.dev">React</Link>,{' '}
          <Link href="https://vite.dev">Vite</Link> e{' '}
          <Link href="https://tailwindcss.com">Tailwind CSS</Link>, a base sobre a qual a
          interface foi construída.
        </li>
        <li>
          <Link href="https://lucide.dev">Lucide</Link>, os ícones.
        </li>
      </Lista>
    </Section>

    <Section n={4} title="A quem tocou antes">
      <p>
        À tradição da viola caipira e a quem a manteve viva sem esperar por site nenhum.
      </p>
    </Section>
  </DocumentoPage>
);
