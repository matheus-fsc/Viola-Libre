# Política de segurança

## Como reportar uma vulnerabilidade

**Não abra uma issue pública.** Uma falha descrita em público fica explorável antes da
correção chegar a quem usa o site.

Use um destes canais privados:

1. **Reporte privado do GitHub** (preferido): na aba
   [Security](https://github.com/matheus-fsc/Viola-Libre/security) do repositório, clique
   em *Report a vulnerability*.
2. **E-mail:** `suporte@violalibre.com.br`, com "segurança" no assunto.

Ajuda muito incluir:

- o que é afetado (página, rota da API, componente);
- como reproduzir, passo a passo;
- o impacto que você enxerga (vazamento de dado, execução de script, abuso da API...).

## O que esperar

O Viola Libre é mantido sem fins lucrativos, por uma pessoa. Ainda assim:

- a confirmação de recebimento sai em até **7 dias**;
- você é avisado quando a correção for publicada;
- se quiser, seu nome entra nos créditos da correção.

## Escopo

Vale para o código deste repositório e para o site em
[violalibre.com.br](https://violalibre.com.br). O backend mora em outro repositório, mas
pode ser reportado pelos mesmos canais.

Fora de escopo: letras e cifras de terceiros (pedidos de remoção vão pelo e-mail dos
[Termos de Uso](./src/pages/termos/TermosDeUso.tsx)) e problemas que dependem de um
navegador ou sistema já sem suporte do fabricante.

## Versões com suporte

O site roda sempre a `main`. Só ela recebe correções.
