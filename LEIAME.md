# Portal de Chamados SuperVille — Implantação

Portal para a loja abrir chamados ao escritório administrativo sem subir pessoalmente. **Regra: só entra no portal o que o escritório resolve mexendo no sistema** (placas, cargas de caixa e balança, cadastro, ajuste de estoque, notas fiscais). Suprimentos, troco, DP e fornecedores seguem pelos seus próprios departamentos.
Piloto: **Vila Romana (Coriolano)**. Funciona em **Android, iPhone (iOS) e computador**, pelo navegador.

## Situação (09/11/2026)
- ✅ Repositório `superville-chamados` criado e publicado no GitHub Pages: https://viniciussuperville-web.github.io/superville-chamados/
- ✅ Firebase `superville-chamados` criado: login por e-mail/senha ativo, domínio do GitHub autorizado, Firestore em São Paulo e regras de segurança publicadas (passo 8)
- ✅ `FIREBASE_CONFIG` já preenchido no `index.html`
- ⏳ Falta: cadastrar os usuários (passo 7): você (gestor), cada pessoa do escritório e **uma conta por loja**
- Modo demonstração para treino: https://viniciussuperville-web.github.io/superville-chamados/?demo

## Sumário
1. Como funciona
2. Quem vê o quê (perfis)
3. Tipos de chamado
4. Testar em modo demonstração
5. Base de produtos (produtos.csv)
6. Criar o Firebase
7. Cadastrar os usuários
8. Regras de segurança do Firestore
9. Publicar no GitHub Pages
10. Instalar no celular (iPhone e Android)
11. Roteiro do piloto
12. Expandir para outras lojas

---

## 1. Como funciona

Status: **Aberto → Em andamento → Resolvido e entregue** (ou Cancelado).

1. A loja abre o chamado pelo celular, informando no bloco **Solicitante** o nome e o cargo de quem está pedindo (já vem preenchido no celular de cada pessoa).
2. Uma pessoa do escritório toca em **Assumir**. A partir daí, **só ela resolve** aquele chamado.
3. Ela resolve, entrega na loja e marca **Resolvido e entregue**, informando para quem entregou. **Resolvido = já entregue.**
4. Se não chegou, quem abriu toca em **Não recebi**. O chamado volta para a **mesma pessoa** do escritório e conta no painel como "Reaberto pela loja".

**Urgente:** prazo de 30 min em qualquer tipo. A loja precisa escrever o motivo. No escritório aparece um alerta vermelho no topo da Fila, que apita a cada 45s até alguém assumir.

Prazos, setores e lojas ficam no topo do `index.html`, no bloco **CONFIGURAÇÃO**.
A lista de balanças de cada loja fica em `BALANCAS`, com a mesma numeração do sistema de carga. Vila Romana: 09 a 25, 49, 55, 56, 57, 58 e 60 (23 balanças). Ao expandir, inclua a lista de cada loja nova.

## 2. Quem vê o quê (perfis)

**Contas:** cada loja tem **uma conta só** (ex.: Loja Vila Romana). O escritório tem **uma conta por pessoa**, e o gestor (Vinicius) tem a dele.

**Primeiro acesso na loja:** no celular de cada pessoa, alguém entra uma vez com o e-mail e a senha da loja. O portal fica logado nesse celular e pergunta **"Quem está usando este celular?"** (nome e cargo). Esses dados ficam guardados no aparelho e já vêm preenchidos no bloco Solicitante de cada chamado. Se outra pessoa usar o mesmo celular, ela toca em **"Não é você? Trocar"**.

| Quem | Vê | Pode |
|---|---|---|
| **Encarregado / Apoio** (conta da loja) | Só os chamados que **ele mesmo** abriu (pelo celular e pelo nome) | Abrir, cancelar enquanto ninguém assumiu, "Não recebi" |
| **Gerente** (conta da loja) | Os chamados que ele abriu **+ todos os resolvidos da loja** | O mesmo nos chamados dele; nos dos outros, só consulta |
| **Escritório** (um usuário por pessoa) | **Todos** os chamados, com nome e cargo de quem pediu | Assumir; resolver, cancelar, reabrir e conversar com a loja **só nos chamados que assumiu** |
| **Gestor** (Vinicius) | **Todos** os chamados + **Painel** | Tudo: agir em qualquer chamado e **transferir** o responsável |

> Como a conta é da loja, a separação entre as pessoas da mesma loja é feita **pelo celular e pelo nome**, não por senha. Quem tem a senha da loja consegue ver os chamados daquela loja. Por isso a senha da loja fica só com você e com o gerente, e o primeiro acesso é feito por um de vocês. Outras lojas e o escritório continuam protegidos pelas regras do banco.

O Painel (só gestor) mostra, além do volume e dos prazos, os rankings **Quem mais solicita** (nome e cargo) e **Quem resolve** (escritório).

## 3. Tipos de chamado

| Tipo | Campos obrigatórios | Prazo |
|---|---|---|
| Placa de oferta | Setor, prioridade e, por produto: código, modelo, tamanho, quantidade | 4h (urgente 30 min) |
| Carga para os caixas | Setor, prioridade e, por produto: código e motivo da carga. Opcional por produto: **Fazer placa** (modelo, tamanho, quantidade). Em "promoção" ou "preço de clube" a placa já vem marcada | 1h (urgente 30 min) |
| Carga para balanças | Setor, prioridade, **qual balança** (uma, várias ou todas) e, por produto: código e problema | 1h (urgente 30 min) |
| Produto sem cadastro | Setor, prioridade, código de barras, descrição do rótulo, **foto do rótulo** | 1 dia (urgente 30 min) |
| Ajuste de estoque | Setor, prioridade e, por produto: código, estoque no sistema, quantidade física e motivo. O portal mostra a diferença na hora e não deixa abrir se as duas forem iguais | 1 dia (urgente 30 min) |
| Emissão de nota fiscal | Setor, destinatário e, por item: código e quantidade | Sempre imediata (30 min) |
| NF de devolução | Setor, prioridade, tipo de devolução, fornecedor, NF de origem e, por produto: código e quantidade | 2 dias (urgente 30 min) |

Todo chamado começa pelo bloco **Solicitante** (nome e cargo: Encarregado, Apoio ou Gerente), seguido de setor e prioridade.
Foto e observação são opcionais, menos a foto do rótulo (Produto sem cadastro) e a observação em chamado urgente, que vira o motivo.
Ao lado de cada código há um botão de **câmera** para ler o código de barras (Android e iPhone).

## 4. Testar em modo demonstração

Endereço: https://viniciussuperville-web.github.io/superville-chamados/?demo (os dados ficam só no navegador).

1. Entre como **Loja Vila Romana (demo)** → informe um nome e cargo → abra chamados (teste um urgente).
2. Em outra aba, entre como **Escritório 1 (demo)** → assuma e resolva.
3. Entre como **Escritório 2 (demo)** → confira que ele **não** consegue resolver o chamado do Escritório 1.
4. Na conta da loja, toque em **"Não é você? Trocar"** → entre como `Marcos (demo)`, cargo **Gerente** → ele vê os resolvidos da loja.
5. Entre como **Gestor (demo)** → teste **Transferir responsável** e a aba **Painel**.

## 5. Base de produtos (produtos.csv)

O `produtos.csv` que acompanha o portal já é a **base do gerador de cartazes** (relatório de produtos de 05/10/2026, loja Coriolano): **33.649 produtos**, 24.189 com código de barras.

Ao digitar o código, o portal mostra descrição, PLU e seção. Aceita:
- **PLU sem o dígito:** `29730`
- **PLU com o dígito:** `297301` ou `29730-1`
- **Código de barras:** digitado ou lido pela câmera

Em 1.776 casos o mesmo número serve para dois produtos. Exemplo: `29254` é o PERFLEX (`29254-2`) e também o PÃO VANDERLEIA (`2925-4` sem hífen). Nesses casos o portal mostra os dois e a pessoa toca no certo; o chamado não abre enquanto não escolher.

**Para atualizar a base:** gere de novo o "Relatório de Produtos (por descrição)" no sistema e me mande o PDF, que eu converto. Depois substitua o `produtos.csv` no GitHub. Se o sistema exportar direto em CSV/Excel, serve também: o portal reconhece cabeçalhos com "cod / plu", "ean / barras" e "desc / produto".

## 6. Criar o Firebase

1. **console.firebase.google.com → Adicionar projeto** → nome `superville-chamados` → (Analytics pode desativar) → **Criar projeto**.
2. Na tela inicial do projeto, clique no ícone **Web `</>`** → apelido `chamados` → **Registrar app**.
3. Copie os valores do `firebaseConfig` e cole no bloco `FIREBASE_CONFIG` no topo do `index.html`.
4. Menu lateral **Criação → Authentication → Vamos começar → E-mail/senha → Ativar → Salvar**.
5. Menu lateral **Criação → Firestore Database → Criar banco de dados** → local `southamerica-east1 (São Paulo)` → **Iniciar no modo de produção → Criar**.

## 7. Cadastrar os usuários

São três tipos de conta: **você (gestor)**, **cada pessoa do escritório** e **uma conta por loja**. Para cada conta:

1. **Authentication → Usuários → Adicionar usuário** → e-mail e senha → **Adicionar usuário**. Copie o **UID** da linha criada.
2. **Firestore Database → Dados → + Iniciar coleção** (na primeira vez) → ID da coleção: `usuarios`.
3. **ID do documento** = o UID copiado. Campos (todos do tipo *string*):

| Campo | Conta da loja | Escritório | Gestor (você) |
|---|---|---|---|
| `nome` | `Loja Vila Romana` | Nome da pessoa | Seu nome |
| `perfil` | `solicitante` | `escritorio` | `gestor` |
| `cargo` | `Loja` | `Escritório` | `Gestor` |
| `loja` | `Vila Romana` | deixe vazio | deixe vazio |

> `loja` precisa ser escrito exatamente igual ao que está em `LOJAS` no arquivo.
> Sugestão de e-mail da conta da loja: `loja.vilaromana@gruposuperville.com.br` (ou outro e-mail que só você e o gerente acessem).

## 8. Regras de segurança do Firestore

As regras garantem no servidor o mesmo que a tela mostra: mesmo que alguém tente burlar, não lê nem altera o que não pode.

**Firestore Database → Regras** → apague o conteúdo → cole o texto abaixo → **Publicar**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function logado() { return request.auth != null; }
    function perfil() { return get(/databases/$(database)/documents/usuarios/$(request.auth.uid)).data; }
    function gestor() { return logado() && perfil().perfil == 'gestor'; }
    function escritorio() { return logado() && perfil().perfil == 'escritorio'; }
    function acessoTotal() { return gestor() || escritorio(); }

    match /usuarios/{uid} {
      allow read: if logado() && (request.auth.uid == uid || acessoTotal());
      allow write: if false;
    }

    match /chamados/{id} {
      // Escritório e gestor veem tudo; a conta da loja vê os chamados da própria loja
      // (a separação entre pessoas da mesma loja é feita na tela, pelo celular e pelo nome)
      allow read: if acessoTotal()
        || (logado() && perfil().perfil == 'solicitante' && perfil().loja == resource.data.loja);

      allow create: if logado() && perfil().perfil == 'solicitante'
        && request.resource.data.loja == perfil().loja
        && request.resource.data.solicitanteUid == request.auth.uid
        && request.resource.data.status == 'aberto';

      // Gestor: tudo. Escritório: só chamado livre (para assumir) ou já assumido por ele.
      // Loja: só chamados da própria loja, sem mexer em responsável, loja ou conta que abriu.
      allow update: if gestor()
        || (escritorio()
            && (resource.data.responsavelUid == null || resource.data.responsavelUid == request.auth.uid)
            && (request.resource.data.responsavelUid == request.auth.uid
                || request.resource.data.responsavelUid == resource.data.responsavelUid))
        || (logado() && perfil().perfil == 'solicitante' && perfil().loja == resource.data.loja
            && request.resource.data.loja == resource.data.loja
            && request.resource.data.solicitanteUid == resource.data.solicitanteUid
            && request.resource.data.responsavelUid == resource.data.responsavelUid);

      allow delete: if false;
    }

    match /config/contador {
      allow read, write: if logado();
    }
  }
}
```

As regras acima já estão publicadas no projeto `superville-chamados`.

## 9. Publicar no GitHub Pages

1. No GitHub (conta `viniciussuperville-web`): **New repository** → `superville-chamados` → **Public** → **Create repository**.
2. **Add file → Upload files** → envie `index.html`, `manifest.webmanifest`, `produtos.csv`, `favicon.png`, `apple-touch-icon.png`, `icone-192.png`, `icone-512.png` e a pasta `fontes/` (Montserrat) → **Commit changes**. (Os logos já estão dentro do `index.html`.)
3. **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → **Save**.
4. Endereço: `https://viniciussuperville-web.github.io/superville-chamados/`
5. No Firebase: **Authentication → Configurações → Domínios autorizados → Adicionar domínio** → `viniciussuperville-web.github.io`.

O endereço precisa ser **https** (o GitHub Pages já é). Sem https, a câmera não abre no iPhone.

## 10. Instalar no celular (iPhone e Android)

**iPhone (iOS):**
1. Abra o link no **Safari** (precisa ser o Safari).
2. Toque em **Compartilhar** (quadrado com seta para cima) → **Adicionar à Tela de Início** → **Adicionar**.
3. Abra pelo ícone **Chamados**. Ele abre em tela cheia, como um aplicativo.
4. **Faça o primeiro acesso (e-mail e senha da loja) já pelo ícone**, não pelo Safari: no iPhone o ícone guarda o login separado do Safari. Feito isso, ele fica logado.
5. Na primeira leitura de código, permita a câmera. Se negou sem querer: **Ajustes → Safari → Câmera → Permitir**.

**Android:**
1. Abra o link no **Chrome** → menu **⋮** → **Adicionar à tela inicial** (ou **Instalar app**).

**Limites atuais (iPhone e Android):**
- O aviso sonoro de chamado novo toca **com o portal aberto**. No iPhone o som só é liberado depois do primeiro toque na tela.
- Notificação com o app fechado (push) não está incluída. Dá para adicionar depois com Firebase Cloud Messaging.

## 11. Roteiro do piloto (Vila Romana)

1. **Dia 0:** criar a conta da Loja Vila Romana, a de cada pessoa do escritório e a sua (gestor). Instalar o portal no celular de cada encarregado, apoio e gerente, fazer o primeiro acesso com a conta da loja, cada um informa nome e cargo, e abrir um chamado teste de cada tipo junto com eles.
2. **Comunicado:** a partir de [data], placas, produto sem cadastro e notas fiscais só pelo portal. Urgente só com motivo real. Ninguém sobe no escritório para essas demandas.
3. **Semana 1:** o gestor acompanha o **Painel** todo dia: atrasados, tempo até assumir e quem resolve.
4. **Fim da semana 2:** revisar com a loja e o escritório. Os prazos são realistas? Quantos urgentes eram urgentes de verdade? Houve chamados reabertos? Faltou algum tipo de chamado?
5. Ajustar e só então expandir.

## 12. Expandir para outras lojas

1. No `index.html`, edite `LOJAS = ["Vila Romana", "Vila Leopoldina", "Santo Amaro", "Pio XI"]` e suba o arquivo de novo no GitHub.
2. Crie a conta da nova loja (passo 7) com o campo `loja` correspondente e inclua as balanças dela em `BALANCAS`.
3. O escritório e o gestor passam a ver um filtro de loja na Fila automaticamente.
