/**
 * Portal de Chamados SuperVille — AVISOS COM O APP FECHADO, SEM CUSTO
 * Roda no Google Apps Script (gratuito) e manda o aviso pelo Firebase Cloud Messaging (gratuito).
 *
 * Como instalar (uma vez só):
 *  1. script.google.com › Novo projeto › apague o que tiver e cole este arquivo inteiro.
 *  2. Engrenagem (Configurações do projeto) › Propriedades do script › Adicionar propriedade:
 *       nome: SA_JSON   valor: todo o conteúdo do arquivo .json da conta de serviço do Firebase
 *       (Firebase › Configurações do projeto › Contas de serviço › Gerar nova chave privada)
 *  3. Implantar › Nova implantação › tipo "App da Web" › Executar como: Eu ›
 *     Quem pode acessar: Qualquer pessoa › Implantar › autorize › copie a URL do app da Web.
 *
 * Segurança: só aceita pedidos de quem está logado no portal (confere o login no Firebase)
 * e só manda os avisos padrão sobre chamados que existem de verdade.
 */
const PROJETO = "superville-chamados";
const API_KEY = "AIzaSyDhVoik8SOe_TixIvxgmubNA3r3H4kmPtw";   // chave pública do portal (a mesma do index.html)
const TIPOS = { placa: "Placa de oferta", caixa: "Carga para os caixas", balanca: "Carga para balanças", cadastro: "Produto sem cadastro",
  ajuste: "Ajuste de estoque", nfe: "Emissão de nota fiscal", devolucao: "NF de devolução" };
const FS = "https://firestore.googleapis.com/v1/projects/" + PROJETO + "/databases/(default)/documents";

function doPost(e) {
  try {
    const b = JSON.parse(e.postData.contents || "{}");
    if (!usuarioValido_(b.idToken)) return resposta_({ ok: false, erro: "login" });
    const p = lerDoc_("chamados/" + b.id);
    if (!p) return resposta_({ ok: false, erro: "chamado" });
    const n = "#" + String(p.numero || 0).padStart(4, "0"), tipo = TIPOS[p.tipo] || p.tipo;
    let tokens = [], msg = null;
    if (b.evento === "novo") {
      tokens = tokensEscritorio_();
      msg = { titulo: (p.prioridade === "urgente" ? "URGENTE · " : "") + "Chamado novo " + n, texto: tipo + " · Loja " + p.loja + " · " + (p.solicitanteNome || "") };
    } else if (b.evento === "resolvido" && p.status === "concluido") {
      tokens = [p.pushToken, p.reabertoPorToken];
      msg = p.tipo === "placa"
        ? { titulo: "Placa entregue! " + n, texto: "Entregue para " + (p.entreguePara || "a loja") + ". Toque aqui e tire a foto da placa colocada." }
        : { titulo: "Chamado resolvido " + n, texto: tipo + " resolvido por " + (p.resolvidoPor || "escritório") + "." };
    } else if (b.evento === "reaberto" && p.contestado) {
      tokens = tokensEscritorio_();
      msg = { titulo: "Chamado REABERTO " + n, texto: (p.reabertoPorNome || "A loja") + ": " + (p.motivoReabertura || "não recebeu") };
    }
    const enviados = msg ? enviar_(tokens, msg, b.id) : 0;
    return resposta_({ ok: true, enviados: enviados });
  } catch (err) {
    console.error(err);
    return resposta_({ ok: false, erro: String(err) });
  }
}
function doGet() { return resposta_({ ok: true, servico: "avisos do Portal de Chamados" }); }
function resposta_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Confere se quem chamou está logado no portal
function usuarioValido_(idToken) {
  if (!idToken) return false;
  const r = UrlFetchApp.fetch("https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + API_KEY,
    { method: "post", contentType: "application/json", payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return false;
  const u = JSON.parse(r.getContentText()).users;
  return !!(u && u.length);
}

// Acesso ao Firebase com a conta de serviço (guardada nas Propriedades do script)
function acesso_() {
  const cache = CacheService.getScriptCache(), c = cache.get("tk");
  if (c) return c;
  const sa = JSON.parse(PropertiesService.getScriptProperties().getProperty("SA_JSON"));
  const agora = Math.floor(Date.now() / 1000);
  const b64 = o => Utilities.base64EncodeWebSafe(JSON.stringify(o)).replace(/=+$/, "");
  const corpo = b64({ alg: "RS256", typ: "JWT" }) + "." + b64({ iss: sa.client_email, aud: "https://oauth2.googleapis.com/token", iat: agora, exp: agora + 3600,
    scope: "https://www.googleapis.com/auth/datastore https://www.googleapis.com/auth/firebase.messaging" });
  const ass = Utilities.base64EncodeWebSafe(Utilities.computeRsaSha256Signature(corpo, sa.private_key)).replace(/=+$/, "");
  const r = UrlFetchApp.fetch("https://oauth2.googleapis.com/token", { method: "post",
    payload: { grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: corpo + "." + ass } });
  const tk = JSON.parse(r.getContentText()).access_token;
  cache.put("tk", tk, 3000);
  return tk;
}
const cab_ = () => ({ Authorization: "Bearer " + acesso_() });

// Lê um documento do Firestore e devolve um objeto simples
function lerDoc_(caminho) {
  const r = UrlFetchApp.fetch(FS + "/" + caminho, { headers: cab_(), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return null;
  return valores_(JSON.parse(r.getContentText()).fields || {});
}
function valores_(f) {
  const o = {};
  Object.keys(f).forEach(k => {
    const v = f[k];
    o[k] = "stringValue" in v ? v.stringValue : "integerValue" in v ? Number(v.integerValue) : "doubleValue" in v ? v.doubleValue
      : "booleanValue" in v ? v.booleanValue : null;
  });
  return o;
}
function tokensEscritorio_() {
  const q = { structuredQuery: { from: [{ collectionId: "tokens" }], where: { fieldFilter: { field: { fieldPath: "perfil" }, op: "IN",
    value: { arrayValue: { values: [{ stringValue: "escritorio" }, { stringValue: "gestor" }] } } } } } };
  const r = UrlFetchApp.fetch(FS + ":runQuery", { method: "post", contentType: "application/json", headers: cab_(), payload: JSON.stringify(q), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) return [];
  return JSON.parse(r.getContentText()).filter(x => x.document).map(x => x.document.name.split("/").pop());
}

// Manda o aviso para cada aparelho. Aparelho que não existe mais: apaga o endereço.
function enviar_(tokens, msg, id) {
  const lista = tokens.filter(Boolean).filter((t, i, a) => a.indexOf(t) === i);
  if (!lista.length) return 0;
  const reqs = lista.map(t => ({ url: "https://fcm.googleapis.com/v1/projects/" + PROJETO + "/messages:send", method: "post", contentType: "application/json",
    headers: cab_(), muteHttpExceptions: true,
    payload: JSON.stringify({ message: { token: t, data: { titulo: msg.titulo, texto: msg.texto, id: id || "" }, webpush: { headers: { Urgency: "high", TTL: "3600" } } } }) }));
  const rs = UrlFetchApp.fetchAll(reqs);
  let ok = 0;
  rs.forEach((r, i) => {
    if (r.getResponseCode() === 200) { ok++; return; }
    if ([400, 404].indexOf(r.getResponseCode()) >= 0 && /UNREGISTERED|INVALID_ARGUMENT|not a valid FCM/.test(r.getContentText()))
      UrlFetchApp.fetch(FS + "/tokens/" + encodeURIComponent(lista[i]), { method: "delete", headers: cab_(), muteHttpExceptions: true });
  });
  return ok;
}

// Para testar no editor: escolha "testarAcesso" e clique em Executar (deve mostrar "Acesso OK")
function testarAcesso() { acesso_(); console.log("Acesso OK · aparelhos do escritório: " + tokensEscritorio_().length); }
