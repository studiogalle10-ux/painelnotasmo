# Painel de NFs na TV — MO Transportes

Especificação v1.2 (Firebase, versão simples) · 23/10/2026

## 1. Visão geral

Sistema web onde cada NF-e é registrada só pela bipagem do código de barras do DANFE e aparece num painel na TV do galpão, separada em **Preparação**, **Urgência** e **Em rota**. Objetivo: dar visibilidade às notas paradas e acabar com atrasos de despacho.

- **Regra de ouro:** sem preenchimento manual. Bipou, a nota entrou.
- **v1 independente:** não depende do sistema de conferência de volumes nem do SitraWeb.
- **Um PC, duas telas:** o leitor USB fica no PC; na tela principal fica a página de bipar e na TV (segunda tela, HDMI) o painel em tela cheia. Roda online, então outro computador também pode abrir.
- **Fluxo:** 1ª bipagem → Preparação. 5 dias sem saída → Urgência. 2ª bipagem → Em rota. Em rota sai sozinha da TV depois de X dias, ou antes, pelo botão "Dar baixa".

## 2. Stack e serviços

| Peça | Serviço | Para quê | Custo |
| --- | --- | --- | --- |
| Front-end | React + Vite + TypeScript | Telas TV e bipagem | Grátis |
| Banco + tempo real | Firebase Firestore | Notas, emissores, eventos; TV atualiza sozinha | Plano Spark (grátis, sem pausa) |
| Login | Firebase Authentication (e-mail e senha) | Uma conta só do painel; a tela pede só a senha | Grátis |
| Hospedagem | Firebase Hosting (alternativa: Netlify) | Publicar o site | Grátis |
| Nome do emissor | BrasilAPI (CNPJ), chamada direto do navegador | CNPJ → razão social, com cache | Grátis |
| Domínio | ex.: painel.motransportes10.com.br | Endereço fixo | Já existe |
| TV | Segunda tela do PC (HDMI) | Janela do painel em tela cheia | — |

**Importante:** ficar no plano Spark. Cloud Functions exigem o plano Blaze (pago com cartão), então toda a lógica roda no front com transações do Firestore e Security Rules. Confirmar os limites atuais do Spark na página de preços do Firebase.

## 3. Regras de negócio

Urgência é uma coluna separada na TV, mas **não é status gravado**: é calculada a partir da data da 1ª bipagem.

| Coluna | Status gravado | Condição | Visual |
| --- | --- | --- | --- |
| Preparação | `preparacao` | Bipada há menos de 5 dias | Card normal; amarelo a partir do 4º dia |
| Urgência | `preparacao` | Bipada há 5+ dias e sem saída | Vermelho, mais antiga primeiro |
| Em rota | `em_rota` | 2ª bipagem (saída), até X dias | Discreto, com horário de saída |
| (fora da TV) | `baixada` | Botão "Dar baixa" | Não aparece |

### Lógica da bipagem (tela única, transação do Firestore em `notas/{chave}`)

1. Documento não existe → cria em Preparação. Som de sucesso.
2. Existe com `preparacao` → muda para `em_rota`, grava `saidaEm`. Som de saída.
3. Existe com `em_rota` ou `baixada` → não muda nada, avisa "nota já despachada". Som de erro.
4. Chave inválida (DV errado ou modelo ≠ 55) → rejeita antes de gravar, pede nova leitura.
5. Mesma chave em menos de 10 s no mesmo aparelho → ignora a repetição (controle no front).

### Outras regras

- Os 5 dias contam da 1ª bipagem (chegada na MO), não da emissão.
- Os dois números (dias de urgência e dias de Em rota) ficam em `config/geral` e mudam no botão "Ajustes" da tela de bipar.
- Toda ação grava evento (quem, quando, aparelho).
- Nota nunca é apagada (senão voltaria à TV na próxima bipagem).
- Em rota some da TV depois de `diasEmRotaNaTv` dias (padrão 1) ou ao dar baixa; continua no banco.

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
- Três colunas: Preparação, Urgência, Em rota, com contador.
- Card: NF/série, emissor, UF, data/hora da bipagem, dias parada.
- Leitura a 3–5 m: fonte grande, tema escuro, alto contraste.
- Sem rolagem manual: rola sozinha ou pagina.
- Relógio, data, indicador de conexão.
- Listener em tempo real (onSnapshot) + recálculo das colunas a cada minuto + recarga da página a cada 30 min.

### /bipar (tela principal do PC)
- Campo único sempre com foco; leitor digita chave + Enter.
- Opção de digitar a chave quando o código está danificado.
- Feedback grande e colorido + som distinto por resultado.
- Lista "Em rota na TV" com botão "Dar baixa".
- Botão "Ajustes": dias de urgência e dias de Em rota na TV.
- Últimas 10 bipagens do computador.


## 6. Dados (Firestore)

| Coleção | ID do documento | Campos | Observação |
| --- | --- | --- | --- |
| `notas` | chave de 44 caracteres | uf, aamm, cnpjEmitente, modelo, serie, numero, tpEmis, codigoNumerico, status, recebidaEm, recebidaPor, saidaEm, saidaPor, baixadaEm, baixadaPor, ultimoEventoId | Urgência calculada no front; `ultimoEventoId` liga a gravação ao evento (exigido pelas regras) |
| `emitentes` | CNPJ | razaoSocial, nomeFantasia, consultadoEm | Cache da BrasilAPI; não consultar quando o emitente for CPF |
| `eventos` | automático | chave, tipo (entrada/saida/baixa), usuario, aparelho, detalhe, criadoEm | Nunca apagado; `aparelho` = ID gerado e salvo no localStorage |
| `config` | `geral` | diasUrgencia = 5, diasEmRotaNaTv = 1 | Editável em "Ajustes" |

- TV consulta: `status == 'preparacao'` e, separadamente, `status == 'em_rota' && saidaEm >= agora − diasEmRotaNaTv` (criar índice composto).
- Transação de bipagem grava `notas/{chave}` e `eventos/{novo}` juntos.
- Backup: exportação periódica (script simples que lê as coleções e salva JSON no Drive) — definir na fase de manutenção.

## 7. Fases futuras

1. **CT-e:** XMLs do SitraWeb (Aleff) numa pasta do Google Drive → Google Apps Script a cada 5–10 min lê os arquivos novos e grava no Firestore (via REST com conta de serviço) os dados de destinatário, destino, volumes, peso e chaves das NF-es; completa os cards. Prever coleção `ctes`.
2. **Conferência de volumes:** levar o sistema de etiquetas/bipagem de carga para o mesmo projeto Firebase, ligado pela NF, com o mesmo login dos funcionários. Saída automática ao concluir a conferência.
3. **Entregue (opcional).**

## 8. Pontos a decidir

- [ ] 5 dias corridos ou úteis?
- [x] Em rota: sai sozinha após X dias (ajustável) ou pelo botão "Dar baixa".
- [ ] Quantas notas cabem na TV (rolar ou paginar)?
- [x] Sem admin nem usuários: uma senha só do painel (conta `painel@painelmotnsp.firebaseapp.com`, criada no console do Firebase).
- [ ] Firebase Hosting ou Netlify.
- [x] TV ligada no PC pelo HDMI.

**Contas necessárias:** conta Google (Firebase) e GitHub.
