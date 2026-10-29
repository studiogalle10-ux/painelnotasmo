// Roteiro do vídeo tutorial. Cada cena vira um trecho com narração própria.
// tela: captura feita por capturar.mjs (saida/telas/<tela>.png); tipo: cena desenhada (abertura, instalar...).
// destaques: caixas (de saida/telas/caixas.json) contornadas em azul; foco: para onde a câmera aproxima.
// fala: texto lido pela voz (escrito do jeito que deve soar). voz: número do áudio em vozes/NN.mp3 (fixo).

export const CENAS = [
  {
    id: 'abertura', voz: '01', tipo: 'abertura',
    fala: 'Olá! Neste vídeo você vai aprender a usar o Painel de Notas Fiscais da Vart. É bem simples: bipou, a nota aparece na TV do galpão.',
  },
  {
    id: 'instalar', voz: '02', tipo: 'instalar', titulo: 'Instalar no computador',
    legenda: 'Chrome ou Edge → botão Instalar na barra de endereço',
    fala: 'Primeiro, instale o painel no computador. Abra o endereço que aparece na tela, no Chrome ou no Edge, e clique no botão Instalar, no canto da barra de endereço.',
  },
  {
    id: 'fixar', voz: '03', tipo: 'fixar', titulo: 'Fixar na barra de tarefas',
    legenda: 'Botão direito no ícone do V → Fixar na barra de tarefas',
    fala: 'Depois, clique com o botão direito no ícone do V, na barra de tarefas, e escolha: Fixar na barra de tarefas. Pronto! O painel abre com um clique, como um programa.',
  },
  {
    id: 'bipar', voz: '05', tela: 'bipar', titulo: 'Tela de bipar',
    legenda: 'O campo fica sempre pronto para o leitor',
    destaques: ['campo'], foco: 'campo',
    fala: 'Esta é a tela de bipar. O campo do meio fica sempre pronto para o leitor. Não precisa clicar em nada: é só bipar o código de barras da DANFE.',
  },
  {
    id: 'entrada', voz: '06', tela: 'entrada', titulo: '1ª bipagem: entrada',
    legenda: 'A nota entra no Depósito e pede o destino',
    destaques: ['resultado', 'quadro'], foco: 'quadro',
    fala: 'Na primeira bipagem, a nota entra no Depósito. A tela fica verde, toca um som, e abre um quadro pedindo o destino da entrega. O destino é obrigatório.',
  },
  {
    id: 'cidade', voz: '07', tela: 'cidade', titulo: 'Destino da entrega',
    legenda: 'Digite o começo da cidade e escolha na lista',
    destaques: ['lista'], foco: 'lista',
    fala: 'Digite só o começo do nome da cidade, pode ser sem acento. A lista mostra as cidades do Brasil, já com o estado. Use as setas e aperte Enter, ou clique na cidade certa.',
  },
  {
    id: 'ocorrencia', voz: '08', tela: 'ocorrencia', titulo: 'Ocorrência (opcional)',
    legenda: 'Só quando a nota precisa aguardar algo',
    destaques: ['ocorrencia', 'salvar'], foco: 'ocorrencia',
    fala: 'O campo ocorrência é opcional. Use só quando a nota precisar esperar alguma coisa, por exemplo: falta volume, aguardando o fornecedor. Depois, clique em Salvar.',
  },
  {
    id: 'bloqueio', voz: '09', tela: 'bloqueio', titulo: 'Quadro aberto',
    legenda: 'Com o quadro aberto, a bipagem não conta',
    destaques: ['resultado'], foco: 'resultado',
    fala: 'Atenção: enquanto o quadro estiver aberto, nenhuma bipagem é registrada. Termine e salve o destino primeiro. Depois, bipe de novo.',
  },
  {
    id: 'lista', voz: '10', tela: 'salvo', titulo: 'No depósito',
    legenda: 'Informar destino · Editar · Resolver',
    destaques: ['semDestino', 'comOcorrencia'], foco: 'lista',
    fala: 'Embaixo, a lista No depósito mostra tudo o que está na TV. Nota sem destino aparece em vermelho, com o botão Informar destino. A nota com ocorrência pode ser editada, e quando o problema acabar, clique em Resolver.',
  },
  {
    id: 'abrir-tv', voz: '11', tela: 'bipar', titulo: 'Abrir a TV',
    legenda: 'Abrir TV → arraste para a televisão → clique para tela cheia',
    destaques: ['abrirTv'], foco: 'abrirTv',
    fala: 'Para ligar o painel na televisão, clique em Abrir TV, arraste a janela para a tela da TV e clique nela uma vez, para ficar em tela cheia.',
  },
  {
    id: 'tv', voz: '12', tela: 'tv', titulo: 'A TV do galpão',
    legenda: 'Em Ocorrência · Depósito · Urgência (4+ dias)',
    destaques: ['colOcorrencia', 'colDeposito', 'colUrgencia'],
    fala: 'Esta é a TV do galpão, com três colunas. À esquerda, Em Ocorrência: notas esperando algo que não depende da gente. No meio, Depósito: as notas normais. À direita, Urgência: notas paradas há quatro dias ou mais. Essas precisam de atenção!',
  },
  {
    id: 'cartao', voz: '13', tela: 'tv', titulo: 'O cartão da nota',
    legenda: 'Amarelo: perto de virar urgência',
    destaques: ['cartaoNormal', 'cartaoAlerta'], foco: 'colDeposito',
    fala: 'Cada cartão mostra o número da nota, há quantos dias ela está parada, a cidade de destino e quem emitiu. Quando a nota está perto de virar urgência, o cartão fica amarelo. E se tiver muitas notas, a coluna troca de página sozinha.',
  },
  {
    id: 'saida', voz: '14', tela: 'saida', titulo: '2ª bipagem: saída',
    legenda: 'Bipou de novo: a nota saiu e some da TV',
    destaques: ['resultado'], foco: 'resultado',
    fala: 'Quando a nota sair para entrega, é só bipar de novo. A tela mostra: Saiu. E a nota some da TV na hora.',
  },
  {
    id: 'danificado', voz: '15', tela: 'bipar', titulo: 'Código danificado',
    legenda: 'Digite os 44 números da chave de acesso',
    destaques: ['digitar'], foco: 'digitar',
    fala: 'Se o código de barras estiver danificado, clique em Código danificado, e digite os quarenta e quatro números da chave de acesso.',
  },
  {
    id: 'fim', voz: '16', tipo: 'fim',
    fala: 'É isso! Qualquer dúvida, fale com o suporte da Vart pelos e-mails que aparecem na tela. Bom trabalho!',
  },
];
