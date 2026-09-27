/**
 * AUTO ANGEL — app.js
 * Toda a informação dinâmica do site (veículos, peças, novidades, favoritos
 * e chat privado) vem do Supabase em tempo real, sem recarregar a página.
 * Só a logo e a foto de fundo do hero ficam fixas no HTML.
 *
 * Tabelas esperadas no Supabase (ver SETUP.sql):
 *   veiculos, pecas, novidades, usuarios, favoritos, mensagens
 */

(function () {
  "use strict";

  // ---------------------------------------------------------------------
  // 1. LIGAÇÃO AO SUPABASE
  // ---------------------------------------------------------------------
  var cfg = window.APP_CONFIG || {};
  var sb = null;

  if (window.supabase && cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
      cfg.SUPABASE_URL.indexOf("SEU-PROJETO") === -1) {
    sb = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY, {
      realtime: { params: { eventsPerSecond: 10 } }
    });
  } else {
    console.warn("[AutoAngel] Supabase ainda não configurado — preencha js/config.js.");
  }

  // ---------------------------------------------------------------------
  // 2. ESTADO LOCAL (cache em memória, sempre espelhando o Supabase)
  // ---------------------------------------------------------------------
  var state = {
    veiculos: [],
    pecas: [],
    novidades: [],
    favoritos: [],              // linhas da tabela 'favoritos' do usuário atual
    usuario: carregarSessao(),  // {id, nome, telefone} ou null
    termoPesquisa: ""
  };

  var WHATS_NUM = "244930297768";

  // ---------------------------------------------------------------------
  // 3. HELPERS GERAIS
  // ---------------------------------------------------------------------
  function el(html) {
    var t = document.createElement("template");
    t.innerHTML = html.trim();
    return t.content.firstElementChild;
  }

  function formatarPreco(valor, moeda) {
    if (valor === null || valor === undefined || valor === "") return "";
    var num = Number(valor);
    if (isNaN(num)) return "";
    return num.toLocaleString("pt-PT") + " " + (moeda || "AOA");
  }

  function primeiraFoto(fotos, fallbackTexto) {
    var lista = normalizarFotos(fotos);
    if (lista.length) return '<img src="' + escapeAttr(lista[0]) + '" alt="' + escapeAttr(fallbackTexto || "") + '" loading="lazy">';
    return '<div class="card-foto__vazio" aria-hidden="true">Sem foto</div>';
  }

  function normalizarFotos(fotos) {
    if (!fotos) return [];
    if (Array.isArray(fotos)) return fotos.filter(Boolean);
    if (typeof fotos === "string") {
      try {
        var parsed = JSON.parse(fotos);
        if (Array.isArray(parsed)) return parsed.filter(Boolean);
      } catch (e) { /* string simples de uma foto só */ }
      return [fotos];
    }
    return [];
  }

  function escapeAttr(s) {
    return String(s || "").replace(/"/g, "&quot;");
  }

  function escapeHtml(s) {
    return String(s || "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function linkWhats(mensagem) {
    return "https://wa.me/" + WHATS_NUM + "?text=" + encodeURIComponent(mensagem);
  }

  function debounce(fn, ms) {
    var timer;
    return function () {
      var args = arguments, ctx = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, ms);
    };
  }

  // ---------------------------------------------------------------------
  // 4. SESSÃO DO UTILIZADOR (login simples: nome + telefone + senha)
  // ---------------------------------------------------------------------
  function carregarSessao() {
    try {
      var raw = localStorage.getItem("autoangel_usuario");
      return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
  }

  function guardarSessao(usuario) {
    state.usuario = usuario;
    localStorage.setItem("autoangel_usuario", JSON.stringify(usuario));
  }

  function limparSessao() {
    state.usuario = null;
    state.favoritos = [];
    localStorage.removeItem("autoangel_usuario");
  }

  // ---------------------------------------------------------------------
  // 5. CARREGAMENTO + TEMPO REAL — VEÍCULOS
  // ---------------------------------------------------------------------
  function carregarVeiculos() {
    if (!sb) return;
    sb.from("veiculos").select("*").eq("ativo", true).order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) { console.error(res.error); return; }
        state.veiculos = res.data || [];
        renderVeiculos();
      });
  }

  function renderVeiculos() {
    var grid = document.getElementById("veiculosGrid");
    var lista = filtrar(state.veiculos, ["titulo", "marca", "modelo", "descricao"]);
    if (!lista.length) {
      grid.innerHTML = '<p class="state-msg">' + (state.veiculos.length ? "Nenhum resultado para a pesquisa." : "Nenhum veículo disponível de momento. O catálogo é alimentado diretamente pela Auto Angel.") + "</p>";
      return;
    }
    grid.innerHTML = lista.map(function (v) {
      var specs = [v.ano, v.km ? v.km.toLocaleString("pt-PT") + " km" : null, v.combustivel, v.cambio].filter(Boolean).join(" · ");
      var fav = isFavorito("veiculo", v.id);
      return (
        '<article class="vehicle-card" data-id="' + v.id + '">' +
          '<div class="card-foto">' + primeiraFoto(v.fotos, v.titulo) +
            '<button type="button" class="fav-btn ' + (fav ? "fav-btn--ativo" : "") + '" data-fav data-tipo="veiculo" data-id="' + v.id + '" aria-label="Adicionar aos favoritos">♥</button>' +
          "</div>" +
          '<div class="vehicle-card__body">' +
            "<h3>" + escapeHtml(v.titulo || ((v.marca || "") + " " + (v.modelo || ""))) + "</h3>" +
            (specs ? '<p class="vehicle-card__specs">' + escapeHtml(specs) + "</p>" : "") +
            (v.preco ? '<p class="vehicle-card__preco">' + formatarPreco(v.preco, v.moeda) + "</p>" : "") +
            '<div class="card-actions">' +
              '<a class="btn btn--outline btn--sm" href="' + linkWhats("Olá Auto Angel, tenho interesse no veículo: " + (v.titulo || "")) + '" target="_blank" rel="noopener">WhatsApp</a>' +
            "</div>" +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  // ---------------------------------------------------------------------
  // 6. CARREGAMENTO + TEMPO REAL — PEÇAS & ACESSÓRIOS
  // ---------------------------------------------------------------------
  function carregarPecas() {
    if (!sb) return;
    sb.from("pecas").select("*").eq("ativo", true).order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) { console.error(res.error); return; }
        state.pecas = res.data || [];
        renderPecas();
      });
  }

  function renderPecas() {
    var grid = document.getElementById("pecasGrid");
    var lista = filtrar(state.pecas, ["nome", "categoria", "descricao"]);
    if (!lista.length) {
      grid.innerHTML = '<p class="state-msg">' + (state.pecas.length ? "Nenhum resultado para a pesquisa." : "Nenhuma peça cadastrada de momento. O catálogo é alimentado diretamente pela Auto Angel.") + "</p>";
      return;
    }
    grid.innerHTML = lista.map(function (p) {
      var fav = isFavorito("peca", p.id);
      return (
        '<article class="part-card" data-id="' + p.id + '">' +
          '<div class="part-card__photo">' + primeiraFoto(p.fotos, p.nome) +
            '<button type="button" class="fav-btn ' + (fav ? "fav-btn--ativo" : "") + '" data-fav data-tipo="peca" data-id="' + p.id + '" aria-label="Adicionar aos favoritos">♥</button>' +
          "</div>" +
          '<h3 class="part-card__name">' + escapeHtml(p.nome) + "</h3>" +
          (p.exibir_preco && p.preco ? '<p class="vehicle-card__preco" style="padding:0 1.1rem;">' + formatarPreco(p.preco, p.moeda) + "</p>" : "") +
          '<div class="part-card__links">' +
            '<a class="part-card__zap" href="' + linkWhats("Olá Auto Angel, tenho interesse em " + (p.nome || "uma peça") + ". Podem enviar mais informações?") + '" target="_blank" rel="noopener">WhatsApp</a>' +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  // ---------------------------------------------------------------------
  // 7. CARREGAMENTO + TEMPO REAL — NOVIDADES & PUBLICAÇÕES
  // ---------------------------------------------------------------------
  function carregarNovidades() {
    if (!sb) return;
    sb.from("novidades").select("*").eq("ativo", true).order("created_at", { ascending: false })
      .then(function (res) {
        if (res.error) { console.error(res.error); return; }
        state.novidades = res.data || [];
        renderNovidades();
      });
  }

  function renderNovidades() {
    var grid = document.getElementById("novidadesGrid");
    var lista = filtrar(state.novidades, ["titulo", "conteudo"]);
    if (!lista.length) {
      grid.innerHTML = '<p class="state-msg">' + (state.novidades.length ? "Nenhum resultado para a pesquisa." : "Sem publicações no momento.") + "</p>";
      return;
    }
    grid.innerHTML = lista.map(function (n) {
      var fav = isFavorito("novidade", n.id);
      // Cada publicação decide, no painel, se mostra preço e/ou descrição.
      var mostraPreco = !!n.exibir_preco && n.preco;
      var mostraDesc = !!n.exibir_descricao;
      return (
        '<article class="post-card" data-id="' + n.id + '">' +
          '<div class="card-foto">' + primeiraFoto(n.imagem_url ? [n.imagem_url] : n.fotos, n.titulo) +
            '<button type="button" class="fav-btn ' + (fav ? "fav-btn--ativo" : "") + '" data-fav data-tipo="novidade" data-id="' + n.id + '" aria-label="Adicionar aos favoritos">♥</button>' +
          "</div>" +
          '<div class="post-card__body">' +
            "<h3>" + escapeHtml(n.titulo) + "</h3>" +
            (mostraDesc && n.conteudo ? "<p>" + escapeHtml(n.conteudo) + "</p>" : "") +
            (mostraPreco ? '<p class="vehicle-card__preco">' + formatarPreco(n.preco, n.moeda) + "</p>" : "") +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  // ---------------------------------------------------------------------
  // 8. PESQUISA ÚNICA E AUTOMÁTICA (filtra os três grids ao escrever,
  //    sem botão e sem recarregar a página)
  // ---------------------------------------------------------------------
  function filtrar(lista, campos) {
    var termo = state.termoPesquisa.trim().toLowerCase();
    if (!termo) return lista;
    return lista.filter(function (item) {
      return campos.some(function (c) {
        return (item[c] || "").toString().toLowerCase().indexOf(termo) !== -1;
      });
    });
  }

  function ligarPesquisa() {
    var input = document.getElementById("inputPesquisa");
    var aplicar = debounce(function () {
      state.termoPesquisa = input.value;
      renderVeiculos();
      renderPecas();
      renderNovidades();
    }, 180);
    input.addEventListener("input", aplicar);
  }

  // ---------------------------------------------------------------------
  // 9. FAVORITOS (sincronizados em tempo real na tabela 'favoritos')
  // ---------------------------------------------------------------------
  function isFavorito(tipo, id) {
    return state.favoritos.some(function (f) { return f.item_tipo === tipo && f.item_id === id; });
  }

  function carregarFavoritos() {
    if (!sb || !state.usuario) { state.favoritos = []; atualizarBadgeFav(); return; }
    sb.from("favoritos").select("*").eq("usuario_id", state.usuario.id)
      .then(function (res) {
        if (res.error) { console.error(res.error); return; }
        state.favoritos = res.data || [];
        atualizarBadgeFav();
        renderVeiculos(); renderPecas(); renderNovidades();
      });
  }

  function atualizarBadgeFav() {
    var badge = document.getElementById("favCount");
    if (state.favoritos.length > 0) {
      badge.hidden = false;
      badge.textContent = state.favoritos.length;
    } else {
      badge.hidden = true;
    }
  }

  function alternarFavorito(tipo, id) {
    if (!sb) return;
    if (!state.usuario) {
      abrirModal("chatPanel");
      var erro = document.getElementById("loginErro");
      erro.hidden = false;
      erro.textContent = "Identifique-se para guardar favoritos.";
      return;
    }
    var existente = state.favoritos.find(function (f) { return f.item_tipo === tipo && f.item_id === id; });
    if (existente) {
      sb.from("favoritos").delete().eq("id", existente.id).then(function (res) {
        if (res.error) console.error(res.error);
      });
    } else {
      sb.from("favoritos").insert({ usuario_id: state.usuario.id, item_tipo: tipo, item_id: id }).then(function (res) {
        if (res.error) console.error(res.error);
      });
    }
    // A UI é atualizada pelo listener em tempo real (ligarRealtimeUsuario),
    // garantindo que fica igual em qualquer aba/dispositivo aberto.
  }

  document.addEventListener("click", function (e) {
    var btn = e.target.closest("[data-fav]");
    if (!btn) return;
    alternarFavorito(btn.getAttribute("data-tipo"), btn.getAttribute("data-id"));
  });

  // ---------------------------------------------------------------------
  // 10. MODAL DE FAVORITOS — widget (favoritos.html) injetado na mesma página
  // ---------------------------------------------------------------------
  function abrirFavoritosWidget() {
    abrirModal("favoritosModal");
    var host = document.getElementById("favoritosWidgetHost");
    if (host.getAttribute("data-carregado") === "1") { renderFavoritosFallback(host); return; }

    fetch("favoritos.html")
      .then(function (r) { if (!r.ok) throw new Error("sem favoritos.html"); return r.text(); })
      .then(function (html) {
        host.innerHTML = html;
        host.setAttribute("data-carregado", "1");
        // Expõe os dados atuais para o widget favoritos.html poder usá-los,
        // caso ele queira renderizar por conta própria.
        window.AUTOANGEL_FAVORITOS = { favoritos: state.favoritos, veiculos: state.veiculos, pecas: state.pecas, novidades: state.novidades, usuario: state.usuario, supabase: sb };
        document.dispatchEvent(new CustomEvent("autoangel:favoritos-widget-pronto"));
      })
      .catch(function () {
        // favoritos.html ainda não existe — usa lista simples embutida como reserva.
        renderFavoritosFallback(host);
      });
  }

  function renderFavoritosFallback(host) {
    if (!state.usuario) {
      host.innerHTML = '<p class="state-msg">Identifique-se no Chat privado para ver os seus favoritos.</p>';
      return;
    }
    if (!state.favoritos.length) {
      host.innerHTML = '<p class="state-msg">Ainda não tem favoritos guardados.</p>';
      return;
    }
    var itens = state.favoritos.map(function (f) {
      var origem = f.item_tipo === "veiculo" ? state.veiculos : f.item_tipo === "peca" ? state.pecas : state.novidades;
      var item = origem.find(function (x) { return x.id === f.item_id; });
      if (!item) return "";
      var nome = item.titulo || item.nome || "Item";
      return (
        '<div class="fav-item">' +
          '<div class="card-foto card-foto--pequena">' + primeiraFoto(item.fotos || item.imagem_url, nome) + "</div>" +
          '<div class="fav-item__body"><strong>' + escapeHtml(nome) + "</strong>" +
          (item.preco ? "<span>" + formatarPreco(item.preco, item.moeda) + "</span>" : "") + "</div>" +
          '<button type="button" data-fav data-tipo="' + f.item_tipo + '" data-id="' + f.item_id + '" class="btn btn--outline btn--sm">Remover</button>' +
        "</div>"
      );
    }).join("");
    host.innerHTML = '<div class="fav-list">' + itens + "</div>";
  }

  // ---------------------------------------------------------------------
  // 11. LOGIN SIMPLES (nome, telefone, senha) — tabela 'usuarios'
  // ---------------------------------------------------------------------
  function ligarLogin() {
    var form = document.getElementById("formLogin");
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!sb) return;
      var fd = new FormData(form);
      var nome = fd.get("nome").toString().trim();
      var telefone = fd.get("telefone").toString().trim();
      var senha = fd.get("senha").toString();
      var erro = document.getElementById("loginErro");
      erro.hidden = true;

      sb.from("usuarios").select("*").eq("telefone", telefone).maybeSingle().then(function (res) {
        if (res.error) { erro.hidden = false; erro.textContent = "Erro ao entrar. Tente novamente."; return; }

        if (res.data) {
          if (res.data.senha !== senha) {
            erro.hidden = false; erro.textContent = "Palavra-passe incorreta.";
            return;
          }
          entrarComoUsuario(res.data);
        } else {
          sb.from("usuarios").insert({ nome: nome, telefone: telefone, senha: senha }).select().single()
            .then(function (res2) {
              if (res2.error) { erro.hidden = false; erro.textContent = "Não foi possível criar a conta."; return; }
              entrarComoUsuario(res2.data);
            });
        }
      });
    });

    document.getElementById("btnSair").addEventListener("click", function () {
      limparSessao();
      atualizarUIChat();
      atualizarBadgeFav();
    });
  }

  function entrarComoUsuario(usuario) {
    guardarSessao({ id: usuario.id, nome: usuario.nome, telefone: usuario.telefone });
    atualizarUIChat();
    carregarFavoritos();
    ligarRealtimeUsuario();
    carregarMensagens();
  }

  function atualizarUIChat() {
    var form = document.getElementById("formLogin");
    var box = document.getElementById("chatBox");
    if (state.usuario) {
      form.hidden = true;
      box.hidden = false;
    } else {
      form.hidden = false;
      box.hidden = true;
    }
  }

  // ---------------------------------------------------------------------
  // 12. CHAT PRIVADO EM TEMPO REAL — tabela 'mensagens'
  // ---------------------------------------------------------------------
  function carregarMensagens() {
    if (!sb || !state.usuario) return;
    sb.from("mensagens").select("*").eq("usuario_id", state.usuario.id).order("created_at", { ascending: true })
      .then(function (res) {
        if (res.error) { console.error(res.error); return; }
        renderMensagens(res.data || []);
      });
  }

  function renderMensagens(lista) {
    var box = document.getElementById("chatMensagens");
    box.innerHTML = lista.map(function (m) {
      var classe = m.remetente === "admin" ? "msg msg--admin" : "msg msg--cliente";
      return '<div class="' + classe + '">' + escapeHtml(m.conteudo) + "</div>";
    }).join("");
    box.scrollTop = box.scrollHeight;
  }

  function adicionarMensagemNaTela(m) {
    var box = document.getElementById("chatMensagens");
    var classe = m.remetente === "admin" ? "msg msg--admin" : "msg msg--cliente";
    box.appendChild(el('<div class="' + classe + '">' + escapeHtml(m.conteudo) + "</div>"));
    box.scrollTop = box.scrollHeight;
  }

  function ligarChat() {
    document.getElementById("formChat").addEventListener("submit", function (e) {
      e.preventDefault();
      if (!sb || !state.usuario) return;
      var input = document.getElementById("chatInput");
      var texto = input.value.trim();
      if (!texto) return;
      input.value = "";
      sb.from("mensagens").insert({ usuario_id: state.usuario.id, remetente: "cliente", conteudo: texto })
        .then(function (res) { if (res.error) console.error(res.error); });
      // A mensagem enviada aparece via realtime (INSERT abaixo), sem duplicar aqui.
    });
  }

  // ---------------------------------------------------------------------
  // 13. TEMPO REAL — Supabase Realtime (sem recarregar a página)
  // ---------------------------------------------------------------------
  function ligarRealtimePublico() {
    if (!sb) return;

    sb.channel("public:veiculos")
      .on("postgres_changes", { event: "*", schema: "public", table: "veiculos" }, carregarVeiculos)
      .subscribe();

    sb.channel("public:pecas")
      .on("postgres_changes", { event: "*", schema: "public", table: "pecas" }, carregarPecas)
      .subscribe();

    sb.channel("public:novidades")
      .on("postgres_changes", { event: "*", schema: "public", table: "novidades" }, carregarNovidades)
      .subscribe();
  }

  function ligarRealtimeUsuario() {
    if (!sb || !state.usuario) return;

    sb.channel("favoritos:" + state.usuario.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "favoritos", filter: "usuario_id=eq." + state.usuario.id }, carregarFavoritos)
      .subscribe();

    sb.channel("mensagens:" + state.usuario.id)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "mensagens", filter: "usuario_id=eq." + state.usuario.id }, function (payload) {
        adicionarMensagemNaTela(payload.new);
      })
      .subscribe();
  }

  // ---------------------------------------------------------------------
  // 14. MODAIS (favoritos / chat) — abrir, fechar, backdrop
  // ---------------------------------------------------------------------
  function abrirModal(id) {
    document.getElementById(id).hidden = false;
    document.body.style.overflow = "hidden";
  }
  function fecharModal(id) {
    document.getElementById(id).hidden = true;
    document.body.style.overflow = "";
  }

  function ligarModais() {
    document.getElementById("btnAbrirFavoritos").addEventListener("click", function (e) {
      e.preventDefault();
      abrirFavoritosWidget();
    });
    document.querySelectorAll("[data-fechar-favoritos]").forEach(function (b) {
      b.addEventListener("click", function () { fecharModal("favoritosModal"); });
    });

    document.getElementById("btnAbrirChat").addEventListener("click", function () {
      abrirModal("chatPanel");
    });
    document.querySelectorAll("[data-fechar-chat]").forEach(function (b) {
      b.addEventListener("click", function () { fecharModal("chatPanel"); });
    });

    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") { fecharModal("favoritosModal"); fecharModal("chatPanel"); }
    });
  }

  // ---------------------------------------------------------------------
  // 15. INICIALIZAÇÃO
  // ---------------------------------------------------------------------
  function iniciar() {
    ligarPesquisa();
    ligarModais();
    ligarLogin();
    ligarChat();

    carregarVeiculos();
    carregarPecas();
    carregarNovidades();
    ligarRealtimePublico();

    if (state.usuario) {
      atualizarUIChat();
      carregarFavoritos();
      ligarRealtimeUsuario();
      carregarMensagens();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar);
  } else {
    iniciar();
  }
})();