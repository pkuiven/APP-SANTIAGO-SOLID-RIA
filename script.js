
const STORAGE_KEY = "santiagoCalls";

let calls = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
let currentFilter = "Todos";

const form = document.getElementById("callForm");
const callsList = document.getElementById("callsList");

function saveCalls() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(calls));
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function updateStats() {
  document.getElementById("totalCalls").textContent = calls.length;

  document.getElementById("completedCalls").textContent =
    calls.filter(c => c.status === "Concluído").length;

  document.getElementById("openCalls").textContent =
    calls.filter(c => c.status === "Aberto").length;
}

function renderCalls() {
  const filtered = calls.filter(c =>
    currentFilter === "Todos" || c.status === currentFilter
  );

  if (!filtered.length) {
    callsList.innerHTML = `
      <div class="empty">
        <i data-lucide="inbox"></i>
        <p>Nenhum chamado encontrado.</p>
      </div>
    `;
    refreshIcons();
    updateStats();
    return;
  }

  callsList.innerHTML = filtered.map(call => `
    <article class="call-card">
      <div class="call-top">
        <span class="call-category">${escapeHTML(call.category)}</span>
        <span class="status">${call.status}</span>
      </div>

      <h3>${escapeHTML(call.category)}</h3>
      <p>${escapeHTML(call.description)}</p>

      <div class="call-location">
        <i data-lucide="map-pin"></i>
        ${escapeHTML(call.location)}
      </div>

      <small>Publicado por ${escapeHTML(call.name)}</small>

      <div class="call-actions">
        ${call.status === "Aberto" ? `
          <button class="complete" onclick="completeCall('${call.id}')">
            <i data-lucide="check"></i> Concluir
          </button>
        ` : ""}

        <button onclick="deleteCall('${call.id}')">
          <i data-lucide="trash-2"></i> Excluir
        </button>
      </div>
    </article>
  `).join("");

  refreshIcons();
  updateStats();
}

function completeCall(id) {
  calls = calls.map(c =>
    c.id === id ? { ...c, status: "Concluído" } : c
  );

  saveCalls();
  renderCalls();
}

function deleteCall(id) {
  if (!confirm("Deseja excluir este chamado?")) return;

  calls = calls.filter(c => c.id !== id);
  saveCalls();
  renderCalls();
}

form.addEventListener("submit", event => {
  event.preventDefault();

  const call = {
    id: crypto.randomUUID(),
    name: document.getElementById("name").value.trim(),
    category: document.getElementById("category").value,
    description: document.getElementById("description").value.trim(),
    location: document.getElementById("location").value.trim(),
    status: "Aberto",
    createdAt: new Date().toISOString()
  };

  calls.unshift(call);
  saveCalls();
  renderCalls();
  form.reset();
});

document.querySelectorAll(".filter").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelector(".filter.active")?.classList.remove("active");
    button.classList.add("active");

    currentFilter = button.dataset.filter;
    renderCalls();
  });
});

function refreshIcons() {
  if (window.lucide) {
    lucide.createIcons();
  }
}

function waitForIcons() {
  if (window.lucide) {
    refreshIcons();
  } else {
    setTimeout(waitForIcons, 100);
  }
}

renderCalls();
waitForIcons();
