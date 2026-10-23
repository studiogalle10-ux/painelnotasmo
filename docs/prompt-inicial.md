# Prompt inicial para o Claude Code

Cole isto na primeira sessão, dentro desta pasta:

```
Vamos construir o "Painel de NFs" da MO Transportes conforme docs/especificacao.md e CLAUDE.md.

Stack: React + Vite + TypeScript, Firebase (Firestore, Authentication, Hosting) no plano Spark gratuito, sem Cloud Functions.

Comece por:
1. Revisar os rascunhos firebase/firestore.rules e src/lib/chaveAcesso.ts e apontar problemas.
2. Criar o projeto Vite, a estrutura de pastas e a configuração do Firebase (firebase.json, índices).
3. Escrever testes unitários do parser da chave (válidas, DV errado, modelo 65, tamanho errado, CNPJ alfanumérico).
4. Implementar a transação de bipagem (entrada/saída) e testar no Firebase Emulator.
5. Construir /bipar, depois /tv, depois /admin.

Antes de cada etapa, mostre o plano e espere minha confirmação. Interface em português do Brasil.
```

## Checklist antes de começar
- [ ] Conta Google para o Firebase (de preferência uma conta da empresa, não pessoal)
- [ ] Projeto criado no console do Firebase, plano Spark
- [ ] Authentication ativado com e-mail e senha
- [ ] Firestore criado (região southamerica-east1, São Paulo)
- [ ] Conta no GitHub e repositório criado
- [ ] Node.js instalado no computador
- [ ] Algumas notas reais (ou fotos dos DANFEs) para testar a leitura
