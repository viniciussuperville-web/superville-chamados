// Portal de Chamados SuperVille — service worker
// Só cuida dos avisos do sistema (pop-up + som do celular). Não guarda cache: o portal sempre carrega a versão mais nova.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));

// Toque no aviso: volta para o portal e abre o chamado
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const id = (e.notification.data || {}).id || "";
  e.waitUntil((async () => {
    const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const c of abas) {
      if (c.url.startsWith(self.registration.scope)) {
        c.postMessage({ tipo: "abrirChamado", id });
        try { await c.focus(); } catch (err) {}
        return;
      }
    }
    await self.clients.openWindow(self.registration.scope + (id ? "?chamado=" + encodeURIComponent(id) : ""));
  })());
});

// Aviso com o portal FECHADO (push do Firebase Cloud Messaging, enviado pela função "avisos")
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch (err) {}
  const x = d.data || d.notification || d;
  e.waitUntil((async () => {
    // portal aberto e na frente: ele mesmo já mostra o pop-up e apita
    const abas = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    if (abas.some(c => c.visibilityState === "visible" && c.focused)) return;
    await self.registration.showNotification(x.titulo || x.title || "Portal de Chamados", {
      body: x.texto || x.body || "", icon: "icone-192.png", badge: "icone-192.png", tag: "chamado-" + (x.id || Date.now()),
      renotify: true, requireInteraction: true, vibrate: [300, 150, 300, 150, 300], data: { id: x.id || "" } });
  })());
});
