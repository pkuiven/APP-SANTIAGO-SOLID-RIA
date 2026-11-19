
"use strict";

const $ = id => document.getElementById(id);

const PROFILE_KEY = "santiagoProfile";
const CALLS_KEY = "santiagoCalls";

const DEFAULT_PHOTO = "https://placehold.co/120x120/e8f3ed/26734d?text=Foto";
const DEFAULT_CENTER = [-29.1915, -54.8678];

let profile = load(PROFILE_KEY, null);
let calls = load(CALLS_KEY, []).map(call => ({
    ...call,
    id: String(call.id ?? Date.now() + Math.random()),
    requesterId: call.requesterId || "",
    acceptedById: call.acceptedById || "",
    categories: Array.isArray(call.categories)
        ? call.categories
        : [call.category || "Outros"],
    status: call.status === "atendido"
        ? "done"
        : call.status === "aberto"
            ? "open"
            : call.status || "open"
}));

let map = null;
let markers = null;
let temporaryMarker = null;
let selectedLocation = null;
let selecting = false;
let selectedPhoto = "";

// ===== ARMAZENAMENTO =====

function load(key, fallback) {
    try {
        return JSON.parse(localStorage.getItem(key)) ?? fallback;
    } catch {
        return fallback;
    }
}

function store(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
        return true;
    } catch (error) {
        console.error(error);
        alert("Não foi possível salvar. Verifique o armazenamento do navegador.");
        return false;
    }
}

function persistCalls() {
    return store(CALLS_KEY, calls);
}

function refreshIcons() {
    if (window.lucide) {
        lucide.createIcons();
    }
}

function scrollTop() {
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function safe(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function createId(prefix = "id") {
    return window.crypto?.randomUUID
        ? crypto.randomUUID()
        : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

// ===== NAVEGAÇÃO =====

function showLanding() {
    $("landingScreen").classList.remove("hidden");
    $("registerScreen").classList.add("hidden");
    $("appScreen").classList.add("hidden");
    refreshIcons();
    scrollTop();
}

function openRegister() {
    $("landingScreen").classList.add("hidden");
    $("appScreen").classList.add("hidden");
    $("registerScreen").classList.remove("hidden");

    $("registerForm").reset();

    if (profile) {
        $("personName").value = profile.name || "";
        $("street").value = profile.street || "";
        $("neighborhood").value = profile.neighborhood || "";
        $("houseNumber").value = profile.houseNumber || "";
        $("phone").value = profile.phone || "";
        selectedPhoto = profile.photo || "";
    } else {
        selectedPhoto = "";
    }

    $("photoPreview").src = selectedPhoto || DEFAULT_PHOTO;

    refreshIcons();
    scrollTop();
}

["joinBtn", "heroJoinBtn", "aboutJoinBtn", "finalJoinBtn"]
    .forEach(id => {
        $(id).addEventListener("click", openRegister);
    });

$("backLandingBtn").addEventListener("click", showLanding);

// ===== FOTO DE PERFIL =====

$("profilePhoto").addEventListener("change", event => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) {
        alert("Escolha uma imagem válida de até 5 MB.");
        event.target.value = "";
        return;
    }

    const reader = new FileReader();

    reader.onload = () => {
        const image = new Image();

        image.onload = () => {
            const side = Math.min(image.width, image.height);

            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = 250;

            const ctx = canvas.getContext("2d");

            ctx.drawImage(
                image,
                (image.width - side) / 2,
                (image.height - side) / 2,
                side,
                side,
                0,
                0,
                250,
                250
            );

            selectedPhoto = canvas.toDataURL("image/jpeg", 0.72);
            $("photoPreview").src = selectedPhoto;
        };

        image.onerror = () => alert("Não foi possível abrir essa imagem.");
        image.src = reader.result;
    };

    reader.onerror = () => alert("Erro ao ler a imagem.");
    reader.readAsDataURL(file);
});

// ===== CADASTRO =====

$("registerForm").addEventListener("submit", event => {
    event.preventDefault();

    const newProfile = {
        id: profile?.id || createId("user"),
        name: $("personName").value.trim(),
        street: $("street").value.trim(),
        neighborhood: $("neighborhood").value.trim(),
        houseNumber: $("houseNumber").value.trim(),
        phone: $("phone").value.trim(),
        photo: selectedPhoto || profile?.photo || ""
    };

    if (
        !newProfile.name ||
        !newProfile.street ||
        !newProfile.neighborhood ||
        !newProfile.houseNumber
    ) {
        alert("Preencha todos os campos obrigatórios.");
        return;
    }

    if (!store(PROFILE_KEY, newProfile)) return;

    profile = newProfile;
    showApp();
});

// ===== APLICATIVO =====

function showApp() {
    if (!profile) {
        openRegister();
        return;
    }

    $("landingScreen").classList.add("hidden");
    $("registerScreen").classList.add("hidden");
    $("appScreen").classList.remove("hidden");

    $("welcomeName").textContent = profile.name.split(/\s+/)[0];
    $("userPhoto").src = profile.photo || DEFAULT_PHOTO;
    $("callNeighborhood").value = profile.neighborhood || "";

    renderCalls();
    refreshIcons();
    scrollTop();

    setTimeout(() => {
        if (!map) {
            initMap();
        } else {
            map.invalidateSize();
            renderMarkers();
        }
    }, 250);
}

$("editProfileBtn").addEventListener("click", openRegister);

$("logoutBtn").addEventListener("click", () => {
    if (!confirm("Deseja sair deste perfil neste navegador? Seus chamados locais serão mantidos.")) {
        return;
    }

    profile = null;
    selectedPhoto = "";

    localStorage.removeItem(PROFILE_KEY);
    showLanding();
});

// ===== MAPA =====

function initMap() {
    if (!window.L || !$("map")) {
        $("map").innerHTML =
            '<p class="empty">O mapa não carregou. Verifique sua conexão e atualize a página.</p>';
        return;
    }

    map = L.map("map").setView(DEFAULT_CENTER, 14);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: "&copy; OpenStreetMap contributors"
    }).addTo(map);

    markers = L.layerGroup().addTo(map);

    map.on("click", event => {
        if (!selecting) return;

        selectedLocation = [
            event.latlng.lat,
            event.latlng.lng
        ];

        if (temporaryMarker) {
            map.removeLayer(temporaryMarker);
        }

        temporaryMarker = L.marker(selectedLocation)
            .addTo(map)
            .bindPopup("Ponto de referência selecionado")
            .openPopup();

        $("locationStatus").textContent =
            "Ponto de referência selecionado no mapa.";

        $("selectLocation").innerHTML =
            '<i data-lucide="map-pin"></i> Alterar localização';

        selecting = false;
        refreshIcons();
    });

    renderMarkers();
}

$("selectLocation").addEventListener("click", () => {
    if (!map) {
        alert("O mapa ainda não está disponível. Verifique sua conexão.");
        return;
    }

    selecting = true;

    $("locationStatus").textContent =
        "Clique no mapa para marcar um ponto público próximo.";

    $("selectLocation").innerHTML =
        '<i data-lucide="mouse-pointer-click"></i> Clique no mapa';

    refreshIcons();

    map.getContainer().scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
});

// ===== PUBLICAR CHAMADO =====

$("callForm").addEventListener("submit", event => {
    event.preventDefault();

    if (!profile) {
        openRegister();
        return;
    }

    const categories = [
        ...document.querySelectorAll('input[name="category"]:checked')
    ].map(input => input.value);

    const description = $("callDescription").value.trim();
    const neighborhood = $("callNeighborhood").value.trim();

    if (!categories.length) {
        alert("Selecione pelo menos uma categoria.");
        return;
    }

    if (!description || !neighborhood) {
        alert("Preencha a descrição e o bairro.");
        return;
    }

    if (!selectedLocation) {
        alert("Escolha um ponto de referência no mapa.");
        return;
    }

    const call = {
        id: createId("call"),
        categories,
        description,
        neighborhood,
        requester: profile.name,
        requesterId: profile.id,
        status: "open",
        acceptedBy: "",
        acceptedById: "",
        progress: "",
        coordinates: [...selectedLocation],
        createdAt: new Date().toLocaleString("pt-BR")
    };

    calls.unshift(call);

    if (!persistCalls()) {
        calls.shift();
        return;
    }

    selectedLocation = null;
    selecting = false;

    if (temporaryMarker && map) {
        map.removeLayer(temporaryMarker);
    }

    temporaryMarker = null;

    $("locationStatus").textContent = "Nenhum local selecionado.";

    $("selectLocation").innerHTML =
        '<i data-lucide="map"></i> Escolher localização';

    $("callForm").reset();
    $("callNeighborhood").value = profile.neighborhood || "";

    renderCalls();
    refreshIcons();

    alert("Chamado publicado neste navegador!");
});


// ===== LISTAGEM DE CHAMADOS =====

function renderCalls() {
    if (!$("callsList")) return;

    const filter = $("statusFilter").value;

    const filtered = calls.filter(call =>
        filter === "all" || call.status === filter
    );

    $("openCount").textContent =
        calls.filter(c => c.status === "open").length;

    $("acceptedCount").textContent =
        calls.filter(c => c.status === "accepted").length;

    $("doneCount").textContent =
        calls.filter(c => c.status === "done").length;

    $("callsList").innerHTML = "";

    if (!filtered.length) {
        $("callsList").innerHTML = `
            <div class="empty">
                <i data-lucide="inbox"></i>
                <h3>Nenhum chamado encontrado</h3>
                <p>Quando houver novos pedidos, eles aparecerão aqui.</p>
            </div>
        `;
    }

    filtered.forEach(call => {
        const card = document.createElement("article");
        card.className = "call-card";

        const statusLabel = {
            open: "Aberto",
            accepted: "Em atendimento",
            done: "Concluído"
        }[call.status] || "Aberto";

        const categoryHTML = call.categories
            .map(category => `<span class="category-tag">${safe(category)}</span>`)
            .join("");

        const isRequester = call.requesterId && profile?.id
            ? call.requesterId === profile.id
            : call.requester === profile?.name;

        const isHelper = call.acceptedById && profile?.id
            ? call.acceptedById === profile.id
            : call.acceptedBy === profile?.name;

        let actions = "";

        if (call.status === "open" && !isRequester) {
            actions += `
                <button type="button" data-action="accept" data-id="${safe(call.id)}">
                    <i data-lucide="handshake"></i> Aceitar chamado
                </button>
            `;
        }

        if (call.status === "accepted") {
            actions += `
                <p class="helper-info">
                    <i data-lucide="user-round-check"></i>
                    Em atendimento por ${safe(call.acceptedBy || "voluntário")}
                </p>
            `;

            if (isHelper || isRequester) {
                actions += `
                    <button type="button" class="secondary"
                        data-action="progress" data-id="${safe(call.id)}">
                        <i data-lucide="refresh-cw"></i> Atualizar andamento
                    </button>
                `;
            }

            if (isHelper) {
                actions += `
                    <button type="button" class="complete-btn"
                        data-action="complete" data-id="${safe(call.id)}">
                        <i data-lucide="check-circle"></i> Concluir chamado
                    </button>
                `;
            }

            if (call.progress) {
                actions += `
                    <p class="progress-info">
                        <i data-lucide="clipboard-list"></i>
                        Andamento: ${safe(call.progress)}
                    </p>
                    <p>Atualizado: ${safe(call.updatedAt || "")}</p>
                `;
            }
        }

        if (call.status === "done") {
            actions += `
                <p class="done-info">
                    <i data-lucide="check-circle"></i>
                    Necessidade atendida!
                </p>
            `;

            if (call.progress) {
                actions += `<p>Último andamento: ${safe(call.progress)}</p>`;
            }
        }

        card.innerHTML = `
            <div class="call-top">
                <div class="call-categories">${categoryHTML}</div>
                <span class="status status-${safe(call.status)}">${statusLabel}</span>
            </div>

            <h3>${safe(call.description)}</h3>

            <div class="call-details">
                <p><i data-lucide="map-pin"></i> ${safe(call.neighborhood)}</p>
                <p><i data-lucide="user-round"></i> ${safe(call.requester)}</p>
                <p><i data-lucide="calendar"></i> ${safe(call.createdAt)}</p>
            </div>

            <div class="call-actions">${actions}</div>
        `;

        $("callsList").appendChild(card);
    });

    renderMarkers();
    refreshIcons();
}

// ===== AÇÕES DOS CHAMADOS =====

$("callsList").addEventListener("click", event => {
    const button = event.target.closest("button[data-action]");

    if (!button) return;

    const { action, id } = button.dataset;

    if (action === "accept") acceptCall(id);
    if (action === "progress") updateProgress(id);
    if (action === "complete") completeCall(id);
});

$("statusFilter").addEventListener("change", renderCalls);

function acceptCall(id) {
    const call = calls.find(item => item.id === id);

    if (!call || !profile || call.status !== "open") {
        alert("Este chamado não está mais disponível.");
        return;
    }

    if (call.requesterId === profile.id) {
        alert("Você não pode aceitar seu próprio chamado.");
        return;
    }

    const old = {
        status: call.status,
        acceptedBy: call.acceptedBy,
        acceptedById: call.acceptedById
    };

    call.status = "accepted";
    call.acceptedBy = profile.name;
    call.acceptedById = profile.id;

    if (!persistCalls()) {
        Object.assign(call, old);
        return;
    }

    renderCalls();
}

function updateProgress(id) {
    const call = calls.find(item => item.id === id);

    if (!call || !profile || call.status !== "accepted") return;

    const allowed =
        call.requesterId === profile.id ||
        call.acceptedById === profile.id;

    if (!allowed) {
        alert("Você não tem permissão para atualizar este chamado.");
        return;
    }

    const value = prompt(
        "Informe o andamento do pedido:",
        call.progress || ""
    );

    if (value === null || !value.trim()) return;

    const oldProgress = call.progress;
    const oldDate = call.updatedAt;

    call.progress = value.trim().slice(0, 240);
    call.updatedAt = new Date().toLocaleString("pt-BR");

    if (!persistCalls()) {
        call.progress = oldProgress;
        call.updatedAt = oldDate;
        return;
    }

    renderCalls();
}

function completeCall(id) {
    const call = calls.find(item => item.id === id);

    if (!call || !profile || call.status !== "accepted") return;

    if (call.acceptedById !== profile.id) {
        alert("Somente o voluntário responsável pode concluir este chamado.");
        return;
    }

    if (!confirm("Deseja marcar este chamado como concluído?")) return;

    call.status = "done";

    if (!persistCalls()) {
        call.status = "accepted";
        return;
    }

    renderCalls();
}

// ===== MARCADORES DO MAPA =====

function renderMarkers() {
    if (!map || !markers) return;

    markers.clearLayers();

    calls.forEach(call => {
        if (
            call.status === "done" ||
            !Array.isArray(call.coordinates) ||
            call.coordinates.length !== 2
        ) {
            return;
        }

        const marker = L.marker(call.coordinates).addTo(markers);

        marker.bindPopup(`
            <strong>${call.categories.map(safe).join(", ")}</strong>
            <p>${safe(call.description)}</p>
            <p>${safe(call.neighborhood)}</p>
            <p>Status: ${safe(
                { open: "Aberto", accepted: "Em atendimento" }[call.status] || call.status
            )}</p>
        `);
    });
}

// ===== INICIALIZAÇÃO =====

refreshIcons();

if (profile) {
    showApp();
} else {
    showLanding();
}
