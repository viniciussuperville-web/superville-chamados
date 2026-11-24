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
    // confere o login e lê o chamado ao mesmo tempo (mais rápido)
    const [valido, p] = loginEChamado_(b.idToken, b.id);
    if (!valido) return resposta_({ ok: false, erro: "login" });
    if (!p) return resposta_({ ok: false, erro: "chamado" });
    const n = "#" + String(p.numero || 0).padStart(4, "0"), tipo = TIPOS[p.tipo] || p.tipo;
    let enviados = 0;
    if (b.evento === "novo") {
      enviados += enviar_(tokensEscritorio_(), { titulo: (p.prioridade === "urgente" ? "URGENTE · " : "") + "Chamado novo " + n, texto: tipo + " · Loja " + p.loja + " · " + (p.solicitanteNome || "") }, b.id);
    } else if (b.evento === "resolvido" && p.status === "concluido") {
      enviados += enviar_([p.pushToken, p.reabertoPorToken], p.tipo === "placa"
        ? { titulo: "Placa entregue! " + n, texto: "Entregue para " + (p.entreguePara || "a loja") + ". Toque aqui, anexe a foto da placa colocada e toque em Enviar foto." }
        : { titulo: "Chamado resolvido " + n, texto: tipo + " resolvido por " + (p.resolvidoPor || "escritório") + "." }, b.id);
      enviados += enviar_(tokensGestor_(), { titulo: "✅ Resolvido " + n + " · Loja " + p.loja, texto: tipo + " · por " + (p.resolvidoPor || "escritório") + (p.entreguePara ? " · entregue para " + p.entreguePara : "") }, b.id);
    } else if (b.evento === "reaberto" && p.contestado) {
      enviados += enviar_(tokensEscritorio_(), { titulo: "Chamado REABERTO " + n, texto: (p.reabertoPorNome || "A loja") + ": " + (p.motivoReabertura || "não recebeu") }, b.id);
    } else if (b.evento === "foto" && p.placaColocadaEm) {
      enviados += enviar_(tokensEscritorio_().concat(tokensGerentes_(p.loja)), { titulo: "📸 Placa colocada " + n + " · Loja " + p.loja, texto: (p.placaColocadaPor || "A loja") + " enviou a foto da placa na gôndola. Toque para ver." }, b.id);
    } else if (b.evento === "cancelado" && p.status === "cancelado") {
      enviados += enviar_(tokensGestor_(), { titulo: "🚫 Cancelado " + n + " · Loja " + p.loja, texto: tipo + " · por " + (p.canceladoPor || "escritório") }, b.id);
    }
    return resposta_({ ok: true, enviados: enviados });
  } catch (err) {
    console.error(err);
    return resposta_({ ok: false, erro: String(err) });
  }
}
function doGet() { return resposta_({ ok: true, servico: "avisos do Portal de Chamados" }); }
function resposta_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Confere o login e lê o chamado em paralelo
function loginEChamado_(idToken, id) {
  if (!idToken || !id) return [false, null];
  const rs = UrlFetchApp.fetchAll([
    { url: "https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=" + API_KEY, method: "post", contentType: "application/json", payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true },
    { url: FS + "/chamados/" + encodeURIComponent(id), headers: cab_(), muteHttpExceptions: true }]);
  const u = rs[0].getResponseCode() === 200 ? JSON.parse(rs[0].getContentText()).users : null;
  const p = rs[1].getResponseCode() === 200 ? valores_(JSON.parse(rs[1].getContentText()).fields || {}) : null;
  return [!!(u && u.length), p];
}

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
function consultar_(colecao, filtros) {
  const w = filtros.length === 1 ? filtros[0] : { compositeFilter: { op: "AND", filters: filtros } };
  const q = { structuredQuery: { from: [{ collectionId: colecao }], where: w } };
  const r = UrlFetchApp.fetch(FS + ":runQuery", { method: "post", contentType: "application/json", headers: cab_(), payload: JSON.stringify(q), muteHttpExceptions: true });
  if (r.getResponseCode() !== 200) { console.warn(r.getContentText()); return []; }
  return JSON.parse(r.getContentText()).filter(x => x.document).map(x => x.document);
}
const igual_ = (campo, v) => ({ fieldFilter: { field: { fieldPath: campo }, op: "EQUAL", value: typeof v === "boolean" ? { booleanValue: v } : { stringValue: v } } });
const nomes_ = docs => docs.map(d => d.name.split("/").pop());
// Escritório + gestor (inclui o celular "só avisos")
function tokensEscritorio_() {
  return nomes_(consultar_("tokens", [{ fieldFilter: { field: { fieldPath: "perfil" }, op: "IN",
    value: { arrayValue: { values: [{ stringValue: "escritorio" }, { stringValue: "gestor" }] } } } }]));
}
function tokensGestor_() { return nomes_(consultar_("tokens", [igual_("perfil", "gestor")])); }
// Gerentes da loja (celulares da conta da loja em que a pessoa entrou como Gerente)
function tokensGerentes_(loja) { return loja ? nomes_(consultar_("tokens", [igual_("loja", loja), igual_("gerente", true)])) : []; }

// A cada 5 minutos (acionador): avisa o gestor do chamado que passou do prazo sem ser resolvido
const ABRE_H = 7, FECHA_H = 21, LEGADO = { urgente: 30, normal: 120 };
function horaSP_(ms) { return Number(Utilities.formatDate(new Date(ms), "America/Sao_Paulo", "H")); }
function prazoMs_(p) {
  // mesmo cálculo do portal: começa no horário da loja (7h às 21h) e nunca passa das 21h do mesmo dia
  let ini = Number(p.criadoEm) || 0; const h = horaSP_(ini);
  const dia = ms => Utilities.formatDate(new Date(ms), "America/Sao_Paulo", "yyyy-MM-dd");
  const em = (d, hh) => new Date(d + "T" + String(hh).padStart(2, "0") + ":00:00-03:00").getTime();
  if (h < ABRE_H) ini = em(dia(ini), ABRE_H);
  else if (h >= FECHA_H) ini = em(dia(ini + 86400000), ABRE_H);
  const min = Number(p.prazoMin) || (p.prioridade === "urgente" ? LEGADO.urgente : LEGADO.normal);
  return Math.min(ini + min * 60000, em(dia(ini), FECHA_H));
}
function verificarAtrasos() {
  const gestor = tokensGestor_(); if (!gestor.length) return;
  const docs = consultar_("chamados", [{ fieldFilter: { field: { fieldPath: "status" }, op: "IN",
    value: { arrayValue: { values: [{ stringValue: "aberto" }, { stringValue: "andamento" }] } } } }]);
  const agora = Date.now();
  docs.forEach(d => {
    const p = valores_(d.fields || {}), id = d.name.split("/").pop();
    if (p.atrasoAvisadoEm || agora <= prazoMs_(p) || agora - prazoMs_(p) > 6 * 3600000) return;
    const n = "#" + String(p.numero || 0).padStart(4, "0");
    enviar_(gestor, { titulo: "⏰ Fora do prazo " + n + " · Loja " + p.loja, texto: (TIPOS[p.tipo] || p.tipo) + " · " + (p.responsavelNome ? "com " + p.responsavelNome : "ninguém assumiu ainda") }, id);
    UrlFetchApp.fetch(FS + "/chamados/" + id + "?updateMask.fieldPaths=atrasoAvisadoEm", { method: "patch", contentType: "application/json", headers: cab_(),
      payload: JSON.stringify({ fields: { atrasoAvisadoEm: { integerValue: String(agora) } } }), muteHttpExceptions: true });
  });
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
function testarAcesso() { acesso_(); console.log("Acesso OK · aparelhos do escritório: " + tokensEscritorio_().length + " · do gestor: " + tokensGestor_().length + " · de gerentes (Vila Romana): " + tokensGerentes_("Vila Romana").length); }
