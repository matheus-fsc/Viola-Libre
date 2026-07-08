import { z } from 'zod';

// IMPORTANTE: este módulo é só side-effect e DEVE ser o primeiro import do main.tsx.
//
// O Zod v4 captura `globalConfig.jitless` e faz o probe de `new Function` no momento
// em que o schema é CONSTRUÍDO (z.object(...)), não no primeiro .parse(). Como há
// schemas criados no topo de módulos (ex.: api.ts), o probe dispara durante a fase de
// imports. Se o z.config() ficasse no corpo do main.tsx, rodaria tarde demais — depois
// de os schemas já terem sido construídos e o probe já ter violado a CSP estrita
// (script-src sem 'unsafe-eval'). Setando aqui, num módulo importado antes de tudo,
// o jitless já está ativo quando qualquer schema é construído.
z.config({ jitless: true });
