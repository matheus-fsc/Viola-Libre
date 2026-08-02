import React from 'react';
import { DocumentoPage, Section, Lista, Link } from '../../components/DocumentoPage';
import { YouTubeJsConsentControl } from '../../components/YouTubeJsGate';

const CONTACT_EMAIL = 'suporte@violalibre.com.br';
const REPO_URL = 'https://github.com/matheus-fsc/Viola-Libre';
const LAST_UPDATED = '1 de agosto de 2026';

/**
 * Escrita a partir do que o código faz, não do que seria confortável dizer.
 *
 * As fontes de verdade, para quem for atualizar isto: `public/_headers` (o CSP enumera todo
 * terceiro que o navegador pode contatar), `src/services/api.ts` (o que vai pro servidor do
 * projeto, incluindo o hash de usuário) e as chamadas a localStorage/sessionStorage
 * espalhadas pelos serviços. Mudou uma dessas, esta página precisa mudar junto.
 */
export const PoliticaPrivacidade: React.FC = () => (
  <DocumentoPage
    title="Política de Privacidade — Viola Libre"
    lastUpdated={LAST_UPDATED}
    intro={
      <>
        O Viola Libre é um projeto comunitário, sem fins lucrativos e de código aberto. Não há
        anúncios, não há rastreadores de publicidade, não existe cadastro e nada é vendido a
        ninguém. Esta página descreve, sem rodeios, os dados que existem. Alguns existem, e
        dizer "não coletamos nada" seria mentira.
      </>
    }
  >
    <Section n={1} title="Não há conta nem cadastro">
      <p>
        Você usa o site inteiro sem informar nome, e-mail, telefone ou qualquer dado pessoal.
        Não existe tela de cadastro para o público.
      </p>
      <p>
        A única exceção é o acesso de <strong>editor</strong>, restrito a quem colabora na
        curadoria. Quem não é editor nunca passa por autenticação.
      </p>
    </Section>

    <Section n={2} title="O que fica guardado no seu aparelho">
      <p>
        A maior parte do que o site memoriza nunca sai do seu navegador. Fica no armazenamento
        local, e some se você limpar os dados do navegador ou trocar de aparelho:
      </p>
      <Lista>
        <li>suas cifras favoritas e as categorias que você criou;</li>
        <li>a cifra que você está montando em "Minhas Cifras";</li>
        <li>seu instrumento preferido, afinação e ordem de exibição das cordas;</li>
        <li>a última página visitada em cada aba, para você voltar de onde parou;</li>
        <li>caches temporários de busca, para o site não repetir pedidos ao servidor;</li>
        <li>o identificador anônimo descrito no item 3.</li>
      </Lista>
      <p>
        Nada disso é publicidade, e nada disso identifica você como pessoa.
      </p>
    </Section>

    <Section n={3} title="O identificador anônimo">
      <p>
        Para que seus favoritos sobrevivam a um F5 e possam ser reconhecidos pelo servidor, o
        site gera um <strong>identificador aleatório</strong> de 32 caracteres, sorteados por
        um gerador criptográfico, e o guarda no seu navegador.
      </p>
      <p>
        Esse identificador não deriva do seu aparelho, do seu IP nem de nada seu: é um número
        sorteado. Ele não está ligado a nome, e-mail ou perfil algum, e não permite descobrir
        quem você é. Serve só para o servidor saber que dois pedidos vieram do mesmo navegador.
      </p>
      <p>
        Limpar os dados do navegador apaga esse identificador, e com ele o vínculo entre você e
        os favoritos guardados no servidor.
      </p>
    </Section>

    <Section n={4} title="O que o servidor do projeto recebe">
      <p>
        Algumas ações precisam falar com o servidor do Viola Libre. Nesses casos ele recebe:
      </p>
      <Lista>
        <li>
          <strong>Favoritos:</strong> a lista de cifras que você favoritou, associada ao
          identificador anônimo do item 3, que é o que permite recuperá-la.
        </li>
        <li>
          <strong>Contagem de acessos:</strong> ao abrir uma cifra, um contador daquela música
          é incrementado. É um número por música, sem ligação com quem abriu.
        </li>
        <li>
          <strong>Contribuições da comunidade:</strong> marcações de tempo, sequências de
          acordes salvas e curadoria de posições, quando você escolhe enviá-las.
        </li>
      </Lista>
      <p>
        Como todo servidor, ele também registra requisições, inclusive endereços IP, para
        funcionar e para se defender de abuso. Esses registros não são usados para traçar
        perfis nem cruzados com o identificador anônimo.
      </p>
    </Section>

    <Section n={5} title="Serviços de terceiros">
      <p>
        O site depende de três serviços externos. Quando o seu navegador fala com eles, eles
        veem o seu endereço IP e aplicam as próprias políticas, sobre as quais o projeto não
        tem controle:
      </p>
      <Lista>
        <li>
          <strong>Cloudflare:</strong> entrega o site e o protege. Todo o tráfego passa por
          ele, então ele vê o seu endereço IP e registra o acesso do lado do servidor. Não há
          medidor de audiência: nenhum script de estatísticas é carregado no seu navegador.
        </li>
        <li>
          <strong>YouTube (Google):</strong> os vídeos das cifras. O script do YouTube é
          software proprietário e <strong>nunca</strong> é carregado por conta própria: ele só
          entra depois que você clica no botão que pede essa autorização, no lugar onde o vídeo
          apareceria. Enquanto você não autorizar, o YouTube não é contatado e nenhuma outra
          parte do site deixa de funcionar. Depois de autorizado, ele pode gravar cookies e
          coletar dados conforme a política de privacidade do Google.
          <YouTubeJsConsentControl />
        </li>
        <li>
          <strong>GitHub:</strong> hospeda os bancos de som usados para tocar os acordes. São
          baixados na primeira vez que você pede um som.
        </li>
      </Lista>
    </Section>

    <Section n={6} title="Buscadores">
      <p>
        As páginas públicas do site são abertas a buscadores como o Google, para que as cifras
        possam ser encontradas. Isso é <em>indexação</em>: o buscador lê as páginas públicas,
        exatamente como qualquer visitante faria.
      </p>
      <p>
        Não é coleta de dados seus por nossa parte, e nenhum dado de visitante é enviado a
        buscadores.
      </p>
    </Section>

    <Section n={7} title="Como apagar seus dados">
      <Lista>
        <li>
          <strong>Tudo que está no aparelho:</strong> limpe os dados do site no seu navegador.
          Isso apaga favoritos locais, preferências e o identificador anônimo.
        </li>
        <li>
          <strong>Favoritos no servidor:</strong> desfavoritar uma cifra a remove. Para apagar
          tudo de uma vez, escreva para o contato abaixo informando o identificador anônimo,
          que a tela de Favoritos permite exportar.
        </li>
      </Lista>
    </Section>

    <Section n={8} title="Crianças">
      <p>
        O site não é direcionado a crianças e não coleta dados pessoais de ninguém.
        Deliberadamente, não há o que coletar.
      </p>
    </Section>

    <Section n={9} title="Contato e transparência">
      <p>
        Dúvidas, pedidos de remoção ou correções nesta página:{' '}
        <Link href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</Link>.
      </p>
      <p>
        O código-fonte é aberto. Tudo o que está descrito aqui pode ser conferido no{' '}
        <Link href={REPO_URL}>repositório do projeto</Link>, inclusive a lista de serviços
        externos, que fica declarada no cabeçalho de segurança do site.
      </p>
    </Section>

    <Section n={10} title="Alterações">
      <p>
        Esta política pode mudar conforme o projeto muda. A data da última atualização fica
        sempre visível ao final desta página.
      </p>
    </Section>
  </DocumentoPage>
);
