# Plano de Desenvolvimento do Scraper de Cifras (Python)

Este documento descreve a estratégia para extrair cifras de sites como o Cifra Club para alimentar o ecossistema do **Viola-Libre**.

## 🎯 Objetivo
Criar um script em Python capaz de navegar sistematicamente por diretórios de artistas, listar suas músicas e extrair o conteúdo das cifras (letra + acordes), estruturando os dados de forma legível para o frontend do Viola-Libre.

## 🏗️ Arquitetura e Tecnologias
- **Linguagem**: Python
- **Bibliotecas Recomendadas**:
  - `requests`: Para fazer as requisições HTTP (GET).
  - `BeautifulSoup` (`bs4`): Para fazer o parse do HTML e encontrar as tags específicas de forma rápida.
  - `Playwright` ou `Selenium` (Apenas se necessário): O usuário mencionou preocupação com métricas JS e bloqueios (bot detection). Se o `requests` simples com Headers falsos falhar, o Playwright simulando um navegador real é a melhor alternativa.
  - `time` e `random`: Para adicionar atrasos (delays) entre as requisições e evitar bloqueios de IP.
  - `json`: Para exportar e estruturar os dados salvos.

---

## 🗺️ Etapas do Scraping (Cifra Club)

### Passo 1: Mapeamento de Artistas
A ideia é iterar pelo alfabeto e pegar a lista completa de artistas.
- **Endpoint**: `https://www.cifraclub.com.br/letra/{letra}/lista/` (onde `{letra}` vai de A a Z e numéricos).
- **Extração**: Buscar os links ou nomes (slugs) dos artistas.
- **Ação**: O HTML possui divs de artistas como:
  ```html
  <div class="ZOQ KESFS oV7RP">...<p class="... primaryLabel">Nome do Artista</p></div>
  ```
  Mas o mais importante é pegar o `href` que leva para a página do artista (ex: `/as-bahgualadas/`).

### Passo 2: Listagem de Músicas do Artista
Acessar a página do artista e ir para a lista de músicas em ordem alfabética para garantir que pegamos todas as variações sem depender de paginações complexas.
- **Endpoint**: `https://www.cifraclub.com.br/{artista}/musicas.html?order=alphabetical`
- **Extração**: Pegar os links de todas as músicas na tabela (`data-is-alphabetically="true"`).
- **Ação**: Guardar todos os links no formato `/nome-do-artista/nome-da-musica/`.

### Passo 3: Extração da Cifra
Entrar na página específica da música e extrair o conteúdo principal.
- **Endpoint**: `https://www.cifraclub.com.br/{artista}/{musica}/`
- **Extração**: Localizar a tag `<pre>` que contém a cifra.
- **Estrutura dos Dados**:
  Dentro do `<pre>`, as notas musicais ficam em tags `<b>`. Exemplo:
  ```html
  <b>F</b> <b>Dm</b>        <b>Gm</b>                 <b class="js-modal-trigger">C7</b>
  É a todo momento a mesma desculpa.
  ```
- **Ação**:
  - Salvar o conteúdo bruto (HTML do `<pre>`) pode ser uma opção para renderizar direto no Viola-Libre com CSS próprio.
  - *Alternativa avançada*: Fazer um parser que converta as tags `<b>` num formato JSON customizado (ex: linhas com texto e propriedades de acordes em posições específicas (index) na string), facilitando a integração com o *Melody Sequence Editor*.

---

## 🛡️ Prevenção contra Bloqueios (Anti-Scraping)
O usuário levantou a preocupação com scripts detectando scraping (como o clique no botão "Baixar cifra").
1. **Evitar botões e cliques dinâmicos se o dado já estiver no HTML**: O botão de "Baixar cifra" gera um PDF/TXT via backend ou JS. Nós não precisamos dele. Como a cifra já vem escrita no HTML dentro do `<pre>`, basta extrair a tag HTML diretamente! Isso pula a verificação de JS do botão.
2. **User-Agents Aleatórios**: Sempre enviar cabeçalhos HTTP (`User-Agent`, `Accept-Language`, etc.) fingindo ser um navegador real.
3. **Rate Limiting**: Adicionar `time.sleep(random.uniform(1.5, 4.0))` entre requisições. Jamais fazer requisições concorrentes massivas do mesmo IP sem proxies.
4. **Cache Local**: Sempre salvar o HTML bruto baixado localmente antes de processar. Se o script quebrar, você não precisa fazer a requisição de novo.

---

## 📦 Próximos Passos (Implementação)
1. Criar um ambiente virtual (`python -m venv venv`).
2. Instalar `requests` e `beautifulsoup4`.
3. Fazer um script de "Prova de Conceito" (PoC) que faz as etapas 1 a 3 apenas para **1 artista** e salva a primeira música num `output.json`.
4. Refinar o parser para garantir que os espaços e quebras de linha das tags `<pre>` não sejam perdidos.
