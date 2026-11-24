// Portal de Chamados SuperVille — avisos no celular com o portal FECHADO (push).
// Roda no Firebase (Cloud Functions). Quando um chamado muda, manda o aviso para o aparelho certo:
//  - chamado novo ............................ escritório e gestor
//  - chamado resolvido ....................... quem abriu (e quem reabriu, se for o caso)
//  - placa de oferta entregue ................ quem abriu, pedindo a foto da placa colocada
//  - loja tocou em "Não recebi" (reabriu) .... escritório e gestor
const { onDocumentCreated, onDocumentUpdated } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
setGlobalOptions({ region: "southamerica-east1", maxInstances: 3 });
const db = getFirestore();

const TIPOS = {
  placa: "Placa de oferta", caixa: "Carga para os caixas", balanca: "Carga para balanças", cadastro: "Produto sem cadastro",
  ajuste: "Ajuste de estoque", nfe: "Emissão de nota fiscal", devolucao: "NF de devolução"
};
const num4 = n => "#" + String(n || 0).padStart(4, "0");

async function tokensEscritorio() {
  const s = await db.collection("tokens").where("perfil", "in", ["escritorio", "gestor"]).get();
  return s.docs.map(d => d.id);
}

// Envia só dados: o service worker do portal (sw.js) monta o aviso, com som e vibração
async function enviar(tokens, msg) {
  const lista = [...new Set(tokens.filter(Boolean))];
  if (!lista.length) return;
  const data = { titulo: msg.titulo, texto: msg.texto, id: msg.id || "" };
  const r = await getMessaging().sendEachForMulticast({ tokens: lista, data, webpush: { headers: { Urgency: "high", TTL: "3600" } } });
  // aparelho que desinstalou o app ou trocou de endereço: apaga para não tentar de novo
  const apagar = [];
  r.responses.forEach((x, i) => {
    const c = x.error?.code || "";
    if (c.includes("registration-token-not-registered") || c.includes("invalid-registration-token") || c.includes("invalid-argument")) apagar.push(lista[i]);
  });
  await Promise.all(apagar.map(t => db.collection("tokens").doc(t).delete().catch(() => {})));
}

exports.avisoChamadoNovo = onDocumentCreated("chamados/{id}", async ev => {
  const p = ev.data?.data(); if (!p) return;
  const urg = p.prioridade === "urgente";
  await enviar(await tokensEscritorio(), {
    id: ev.params.id,
    titulo: `${urg ? "URGENTE · " : ""}Chamado novo ${num4(p.numero)}`,
    texto: `${TIPOS[p.tipo] || p.tipo} · Loja ${p.loja} · ${p.solicitanteNome || ""}`
  });
});

exports.avisoChamadoMudou = onDocumentUpdated("chamados/{id}", async ev => {
  const a = ev.data.before.data(), p = ev.data.after.data(), id = ev.params.id;
  // resolvido: avisa quem abriu (e quem reabriu)
  if (a.status !== "concluido" && p.status === "concluido") {
    const placa = p.tipo === "placa";
    await enviar([p.pushToken, p.reabertoPorToken], {
      id,
      titulo: placa ? `Placa entregue! ${num4(p.numero)}` : `Chamado resolvido ${num4(p.numero)}`,
      texto: placa ? `Entregue para ${p.entreguePara || "a loja"}. Toque aqui e tire a foto da placa colocada.`
                   : `${TIPOS[p.tipo] || p.tipo} resolvido por ${p.resolvidoPor || "escritório"}.`
    });
  }
  // a loja tocou em "Não recebi": volta para o escritório
  if (a.status === "concluido" && ["aberto", "andamento"].includes(p.status) && p.reabertoEm && p.reabertoEm !== a.reabertoEm) {
    await enviar(await tokensEscritorio(), {
      id,
      titulo: `Chamado REABERTO ${num4(p.numero)}`,
      texto: `${p.reabertoPorNome || "A loja"}: ${p.motivoReabertura || "não recebeu"}`
    });
  }
});
