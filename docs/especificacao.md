# Painel de NFs na TV — MO Transportes (marca VART)

Especificação v1.3 (Firebase, versão simples) · 27/10/2026

## 1. Visão geral

Sistema web onde cada NF-e é registrada só pela bipagem do código de barras do DANFE e aparece num painel na TV do galpão, separada em **Em Ocorrência**, **Depósito** e **Urgência**. Objetivo: dar visibilidade às notas paradas e acabar com atrasos de despacho.

- **Regra de ouro:** sem preenchimento manual para registrar. Bipou, a nota entrou. Logo depois o operador escolhe o destino (cidade e UF) numa busca com todas as cidades do IBGE.
- **v1 independente:** não depende do sistema de conferência de volumes nem do SitraWeb.
- **Um PC, duas telas:** o leitor USB fica no PC; na tela principal fica a página de bipar e na TV (segunda tela, HDMI) o painel em tela cheia. Roda online, então outro computador também pode abrir.
- **Fluxo:** 1ª bipagem → Depósito + quadro do destino (obrigatório) e ocorrência (opcional). Com ocorrência → Em Ocorrência. 4 dias parada sem ocorrência → Urgência. 2ª bipagem → saiu, some da TV.

## 2. Stack e serviços

| Peça | Serviço | Para quê | Custo |
| --- | --- | --- | --- |
| Front-end | React + Vite + TypeScript | Telas TV e bipagem | Grátis |
| Banco + tempo real | Firebase Firestore | Notas, emissores, eventos; TV atualiza sozinha | Plano Spark (grátis, sem pausa) |
| Login | Firebase Authentication (e-mail e senha) | Uma conta só do painel; a tela pede usuário (`motransportes`) e senha | Grátis |
| Hospedagem | Firebase Hosting (alternativa: Netlify) | Publicar o site | Grátis |
| Nome do emissor | BrasilAPI (CNPJ), chamada direto do navegador | CNPJ → razão social, com cache | Grátis |
| Domínio | ex.: painel.motransportes10.com.br | Endereço fixo | Já existe |
| TV | Segunda tela do PC (HDMI) | Janela do painel em tela cheia | — |

**Importante:** ficar no plano Spark. Cloud Functions exigem o plano Blaze (pago com cartão), então toda a lógica roda no front com transações do Firestore e Security Rules. Confirmar os limites atuais do Spark na página de preços do Firebase.

## 3. Regras de negócio

As colunas **não são status gravado**: saem da ocorrência e da data da 1ª bipagem. Na TV, da esquerda para a direita:

| Coluna | Status gravado | Condição | Visual |
| --- | --- | --- | --- |
| Em Ocorrência | `preparacao` | Tem ocorrência (aguardando algo que não é culpa da MO), com qualquer número de dias | Âmbar, com o motivo |
| Depósito | `preparacao` | Sem ocorrência, há menos de 4 dias | Card normal; amarelo no último dia antes da urgência |
| Urgência | `preparacao` | Sem ocorrência, 4+ dias parada | Vermelho, mais antiga primeiro |
| (fora da TV) | `em_rota` | 2ª bipagem (saiu) | Não aparece |

Card sem destino mostra **SEM DESTINO** (ex.: a página fechou antes de salvar o quadro).

### Lógica da bipagem (tela única, transação do Firestore em `notas/{chave}`)

1. Documento não existe → cria no Depósito e abre o quadro do destino. Som de sucesso.
2. Existe com `preparacao` → muda para `em_rota`, grava `saidaEm`. Som de saída. Some da TV.
3. Existe com `em_rota` → não muda nada, avisa "nota já saiu". Som de erro.
4. Chave inválida (DV errado ou modelo ≠ 55) → rejeita antes de gravar, pede nova leitura.
5. Mesma chave em menos de 10 s no mesmo aparelho → ignora a repetição (controle no front).
6. Com o quadro aberto, bipagem não é registrada (nem no campo principal nem caindo dentro do quadro): avisa para salvar o destino e bipar de novo.

### Destino e ocorrência

- Destino: digitar parte do nome (sem acento, pode terminar com a UF: "bom jesus rs") e escolher na lista; só aceita cidade da lista do IBGE, a UF vem junto. Obrigatório para fechar o quadro da nota nova.
- Ocorrência: texto livre até 300 caracteres. Manda a nota para Em Ocorrência; "Resolver" tira a ocorrência e a nota volta a contar para Depósito/Urgência.
- A lista "No depósito" da tela de bipar permite informar/alterar destino e ocorrência a qualquer momento.

### Outras regras

- Os 4 dias contam da 1ª bipagem (chegada na MO), não da emissão.
- O número de dias da urgência fica em `config/geral` (`diasUrgencia`, padrão 4) e muda no botão "Ajustes" da tela de bipar.
- Toda ação grava evento (quem, quando, aparelho).
- Nota nunca é apagada (senão voltaria à TV na próxima bipagem).
- Nota que saiu some da TV na hora; continua no banco.

## 4. Chave de acesso (44 posições)

| Posição | Tam. | Campo | Uso |
| --- | --- | --- | --- |
| 1–2 | 2 | Código UF do emissor | UF de origem |
| 3–6 | 4 | AAMM de emissão | Mês/ano |
| 7–20 | 14 | CNPJ do emissor | Razão social |
| 21–22 | 2 | Modelo (55 = NF-e) | Aceitar só 55 |
| 23–25 | 3 | Série | Exibir |
| 26–34 | 9 | Número da NF | Título do card |
| 35 | 1 | Tipo de emissão | Guardar |
| 36–43 | 8 | Código numérico | Guardar |
| 44 | 1 | Dígito verificador | Validar |

**DV (módulo 11):** 43 primeiros caracteres, da direita para a esquerda, pesos 2..9 em ciclo; soma; resto = soma mod 11; resto 0 ou 1 → DV 0; senão DV = 11 − resto.

**CNPJ alfanumérico:** desde julho/2026 podem existir CNPJs com letras. Aceitar letras nas posições do CNPJ e conferir na Nota Técnica vigente a regra oficial do DV nesse formato (o rascunho usa valor = código ASCII − 48; confirmar para a chave).

**Nome do emissor:**
1. Buscar `emitentes/{cnpj}`.
2. Se não existir, o navegador consulta `https://brasilapi.com.br/api/cnpj/v1/{cnpj}` e salva o documento.
3. Se falhar, a nota entra com o CNPJ formatado; nova tentativa na próxima bipagem desse CNPJ.
4. Exibir nome fantasia; senão razão social.

## 5. Telas

### /tv (só leitura)
- Aberta pelo botão "Abrir TV" da tela de bipar; arrastar a janela para a TV e clicar nela para tela cheia.
- Três colunas: Em Ocorrência, Depósito, Urgência, com contador.
- Card: NF/série, dias parada, destino (ou SEM DESTINO), emissor e UF, motivo da ocorrência ou data/hora da bipagem.
- Leitura a 3–5 m: fonte grande, tema escuro, alto contraste.
- Sem rolagem manual: rola sozinha ou pagina.
- Relógio, data, indicador de conexão.
- Listener em tempo real (onSnapshot) + recálculo das colunas a cada minuto + recarga da página a cada 30 min.

### /bipar (tela principal do PC)
- Campo único sempre com foco; leitor digita chave + Enter.
- Opção de digitar a chave quando o código está danificado.
- Feedback grande e colorido + som distinto por resultado.
- Quadro da nota nova: destino (obrigatório) e ocorrência.
- Lista "No depósito" (o que está na TV): sem destino primeiro; botões Informar destino / Ocorrência / Editar / Resolver.
- Botão "Ajustes": dias para ir para Urgência.
- Últimas 10 bipagens do computador.


## 6. Dados (Firestore)

| Coleção | ID do documento | Campos | Observação |
| --- | --- | --- | --- |
| `notas` | chave de 44 caracteres | uf, aamm, cnpjEmitente, modelo, serie, numero, tpEmis, codigoNumerico, status, recebidaEm, recebidaPor, saidaEm, saidaPor, destinoCidade, destinoUf, destinoIbge, ocorrencia, ocorrenciaEm, ultimoEventoId | Urgência calculada no front; `ultimoEventoId` liga a gravação ao evento (exigido pelas regras) |
| `emitentes` | CNPJ | razaoSocial, nomeFantasia, consultadoEm | Cache da BrasilAPI; não consultar quando o emitente for CPF |
| `eventos` | automático | chave, tipo (entrada/saida/destino/ocorrencia/resolucao), usuario, aparelho, detalhe, criadoEm | Nunca apagado; `aparelho` = ID gerado e salvo no localStorage |
| `config` | `geral` | diasUrgencia = 4 | Editável em "Ajustes" |

- TV e lista "No depósito" consultam `status == 'preparacao'` ordenado por `recebidaEm`.
- Transação de bipagem grava `notas/{chave}` e `eventos/{novo}` juntos.
- Backup: exportação periódica (script simples que lê as coleções e salva JSON no Drive) — definir na fase de manutenção.

## 7. Fases futuras

1. **CT-e:** XMLs do SitraWeb (Aleff) numa pasta do Google Drive → Google Apps Script a cada 5–10 min lê os arquivos novos e grava no Firestore (via REST com conta de serviço) os dados de destinatário, destino, volumes, peso e chaves das NF-es; completa os cards. Prever coleção `ctes`.
2. **Conferência de volumes:** levar o sistema de etiquetas/bipagem de carga para o mesmo projeto Firebase, ligado pela NF, com o mesmo login dos funcionários. Saída automática ao concluir a conferência.
3. **Entregue (opcional).**

## 8. Pontos a decidir

- [ ] 4 dias corridos ou úteis? (hoje: corridos)
- [x] Sem coluna Em rota: a 2ª bipagem tira a nota da TV.
- [x] Destino digitado pelo operador (cidade + UF da lista do IBGE) até integrar o CT-e.
- [ ] Quantas notas cabem na TV (rolar ou paginar)?
- [x] Sem admin nem usuários: uma senha só do painel (conta `painel@painelmotnsp.firebaseapp.com`, criada no console do Firebase).
- [ ] Firebase Hosting ou Netlify.
- [x] TV ligada no PC pelo HDMI.

**Contas necessárias:** conta Google (Firebase) e GitHub.
