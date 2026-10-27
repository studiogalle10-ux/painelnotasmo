# Painel de NFs — MO Transportes

Sistema web para registrar NF-e só por bipagem do código de barras do DANFE e exibir num painel na TV do galpão.

## Leia primeiro
- `docs/especificacao.md` — especificação completa (regras, telas, dados).
- `docs/prompt-inicial.md` — ordem de trabalho.

## Stack
- React + Vite + TypeScript
- Firebase: Firestore (banco + tempo real), Authentication (login), Hosting (site)
- Plano Spark (gratuito). NÃO usar Cloud Functions: exigem o plano Blaze (pago).

## Regras do projeto
- Interface e mensagens em português do Brasil.
- Regra de ouro: nenhum preenchimento manual para registrar nota. Bipou, entrou. Depois da 1ª bipagem o operador só escolhe o destino (cidade + UF da lista do IBGE) e, se precisar, escreve uma ocorrência.
- Colunas da TV calculadas no front, nunca gravadas: com `ocorrencia` → Em Ocorrência; senão dias desde `recebidaEm` >= `diasUrgencia` → Urgência; senão Depósito. 2ª bipagem (`em_rota`) tira da TV.
- A chave de acesso (44 caracteres) é o ID do documento em `notas` — garante que a nota não duplica.
- Entrada/saída sempre via transação do Firestore.
- Datas como Timestamp do Firestore; exibir em America/Sao_Paulo.
- Toda ação gera documento em `eventos`.
- Segurança pelas Firestore Security Rules: só a conta única do painel (`EMAIL_PAINEL`) lê e grava. Sem admin nem papéis.
- Antes de cada etapa, apresente o plano e aguarde confirmação.

## Rascunhos incluídos (revisar antes de usar)
- `firebase/firestore.rules` — regras de segurança.
- `src/lib/chaveAcesso.ts` — parser e validação da chave de 44 dígitos.
