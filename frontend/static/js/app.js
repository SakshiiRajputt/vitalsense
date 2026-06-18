/* VitalSense – Frontend App */

const API = "http://127.0.0.1:5000/api";

// State
let allPatients = [];
let deleteTargetId = null;

// DOM Refs
const patientTable  = document.getElementById("patientTable");
const patientBody   = document.getElementById("patientBody");
const loadingState  = document.getElementById("loadingState");
const emptyState    = document.getElementById("emptyState");
const searchInput   = document.getElementById("searchInput");

const formModal     = document.getElementById("formModal");
const patientForm   = document.getElementById("patientForm");
const modalTitle    = document.getElementById("modalTitle");
const patientIdFld  = document.getElementById("patientId");
const formErrors    = document.getElementById("formErrors");
const saveBtn       = document.getElementById("saveBtn");
const saveBtnText   = document.getElementById("saveBtnText");
const saveBtnSpinner= document.getElementById("saveBtnSpinner");

const remarksModal  = document.getElementById("remarksModal");
const remarksBody   = document.getElementById("remarksBody");
const deleteModal   = document.getElementById("deleteModal");
const deletePatientName = document.getElementById("deletePatientName");

// Utilities
function openModal(el)  { el.classList.add("open"); }
function closeModal(el) { el.classList.remove("open"); }

let toastTimer;
function showToast(msg, type = "success") {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
}

function setLoading(saving) {
  saveBtn.disabled = saving;
  saveBtnText.style.display  = saving ? "none" : "inline";
  saveBtnSpinner.style.display = saving ? "inline-block" : "none";
}

function riskFromRemarks(remarks = "") {
  const lower = remarks.toLowerCase();
  if (lower.includes("high risk"))     return "high";
  if (lower.includes("moderate risk")) return "moderate";
  if (lower.includes("low risk"))      return "low";
  return null;
}

function glucoseClass(v)     { return v > 125 ? "high" : v > 99 ? "medium" : "normal"; }
function haemoglobinClass(v) { return v < 8   ? "high" : v < 12 ? "medium" : "normal"; }
function cholesterolClass(v) { return v > 240  ? "high" : v > 200 ? "medium" : "normal"; }

function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// Stats bar
function updateStats(patients) {
  document.getElementById("statTotal").textContent = patients.length;
  const risks = patients.map(p => riskFromRemarks(p.remarks));
  document.getElementById("statHigh").textContent    = risks.filter(r => r === "high").length;
  document.getElementById("statModerate").textContent= risks.filter(r => r === "moderate").length;
  document.getElementById("statLow").textContent     = risks.filter(r => r === "low").length;
}

// Render table
function renderTable(patients) {
  updateStats(patients);

  if (!patients.length) {
    patientTable.style.display = "none";
    emptyState.style.display   = "";
    return;
  }
  emptyState.style.display   = "none";
  patientTable.style.display = "";

  patientBody.innerHTML = patients.map((p, i) => {
    const risk = riskFromRemarks(p.remarks);
    const badgeHtml = risk
      ? `<span class="risk-badge risk-${risk}">${risk.toUpperCase()} RISK</span><br/>`
      : "";
    const remarksHtml = p.remarks
      ? `${badgeHtml}<span class="remarks-preview" data-id="${p.id}" title="Click to view full assessment">${escHtml(p.remarks)}</span>`
      : `<span class="remarks-pending">Generating…</span>`;

    return `<tr>
      <td class="patient-num">${i + 1}</td>
      <td>
        <div class="patient-name">${escHtml(p.full_name)}</div>
        <div class="patient-email">${escHtml(p.email)}</div>
      </td>
      <td>${formatDate(p.date_of_birth)}</td>
      <td><span class="blood-val ${glucoseClass(p.glucose)}">${p.glucose}</span></td>
      <td><span class="blood-val ${haemoglobinClass(p.haemoglobin)}">${p.haemoglobin}</span></td>
      <td><span class="blood-val ${cholesterolClass(p.cholesterol)}">${p.cholesterol}</span></td>
      <td>${remarksHtml}</td>
      <td>
        <div class="actions">
          <button class="btn-icon" data-edit="${p.id}" title="Edit">✏</button>
          <button class="btn-icon del" data-delete="${p.id}" data-name="${escHtml(p.full_name)}" title="Delete">✕</button>
        </div>
      </td>
    </tr>`;
  }).join("");
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}

// Load patients
async function loadPatients() {
  loadingState.style.display = "";
  patientTable.style.display = "none";
  emptyState.style.display   = "none";

  try {
    const res  = await fetch(`${API}/patients`);
    const data = await res.json();
    allPatients = data.patients || [];
    loadingState.style.display = "none";
    renderTable(allPatients);
  } catch {
    loadingState.style.display = "none";
    emptyState.style.display   = "";
    emptyState.querySelector("p:last-child").textContent = "Could not connect to server.";
  }
}

// Search
searchInput.addEventListener("input", () => {
  const q = searchInput.value.trim().toLowerCase();
  if (!q) { renderTable(allPatients); return; }
  renderTable(allPatients.filter(p =>
    p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q)
  ));
});

// Form helpers
function openAddModal() {
  patientForm.reset();
  patientIdFld.value = "";
  modalTitle.textContent = "New Patient";
  saveBtnText.textContent = "Save Patient";
  hideErrors();
  openModal(formModal);
  document.getElementById("full_name").focus();
}

function openEditModal(patient) {
  patientIdFld.value = patient.id;
  document.getElementById("full_name").value    = patient.full_name;
  document.getElementById("date_of_birth").value= patient.date_of_birth;
  document.getElementById("email").value        = patient.email;
  document.getElementById("glucose").value      = patient.glucose;
  document.getElementById("haemoglobin").value  = patient.haemoglobin;
  document.getElementById("cholesterol").value  = patient.cholesterol;
  modalTitle.textContent  = "Edit Patient";
  saveBtnText.textContent = "Update Patient";
  hideErrors();
  openModal(formModal);
}

function showErrors(errors) {
  formErrors.style.display = "";
  formErrors.innerHTML = `<ul>${errors.map(e => `<li>${escHtml(e)}</li>`).join("")}</ul>`;
}
function hideErrors() {
  formErrors.style.display = "none";
  formErrors.innerHTML = "";
}

// Form submit (Create / Update)
patientForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideErrors();

  const id = patientIdFld.value;
  const payload = {
    full_name:     document.getElementById("full_name").value.trim(),
    date_of_birth: document.getElementById("date_of_birth").value,
    email:         document.getElementById("email").value.trim(),
    glucose:       document.getElementById("glucose").value,
    haemoglobin:   document.getElementById("haemoglobin").value,
    cholesterol:   document.getElementById("cholesterol").value,
  };

  setLoading(true);
  try {
    const url    = id ? `${API}/patients/${id}` : `${API}/patients`;
    const method = id ? "PUT" : "POST";
    const res    = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!data.success) {
      showErrors(data.errors || ["An unexpected error occurred."]);
    } else {
      closeModal(formModal);
      showToast(id ? "Patient updated successfully." : "Patient added — AI remarks generated.");
      await loadPatients();
    }
  } catch {
    showErrors(["Network error. Please check the server is running."]);
  } finally {
    setLoading(false);
  }
});

// Delete
document.getElementById("confirmDelete").addEventListener("click", async () => {
  if (!deleteTargetId) return;
  try {
    const res  = await fetch(`${API}/patients/${deleteTargetId}`, { method: "DELETE" });
    const data = await res.json();
    if (data.success) {
      closeModal(deleteModal);
      showToast("Patient record deleted.");
      await loadPatients();
    } else {
      showToast("Could not delete patient.", "error");
    }
  } catch {
    showToast("Network error.", "error");
  }
});

// Event delegation (table buttons + remarks click)
document.addEventListener("click", (e) => {
  // Edit button
  const editId = e.target.dataset.edit;
  if (editId) {
    const patient = allPatients.find(p => p.id === parseInt(editId));
    if (patient) openEditModal(patient);
    return;
  }

  // Delete button
  const delId = e.target.dataset.delete;
  if (delId) {
    deleteTargetId = parseInt(delId);
    deletePatientName.textContent = e.target.dataset.name;
    openModal(deleteModal);
    return;
  }

  // Remarks preview click
  if (e.target.classList.contains("remarks-preview")) {
    const pid = e.target.dataset.id;
    const patient = allPatients.find(p => p.id === parseInt(pid));
    if (patient && patient.remarks) {
      const risk = riskFromRemarks(patient.remarks);
      const badge = risk
        ? `<span class="risk-badge risk-${risk}">${risk.toUpperCase()} RISK</span><br/><br/>`
        : "";
      remarksBody.innerHTML = `
        <p style="font-weight:500;color:var(--text);margin-bottom:8px">${escHtml(patient.full_name)}</p>
        ${badge}
        <p>${escHtml(patient.remarks)}</p>
        <p style="margin-top:16px;font-size:0.75rem;color:var(--text-dim)">⬡ AI-generated assessment · For clinical decision support only</p>
      `;
      openModal(remarksModal);
    }
    return;
  }
});

// Modal close handlers
document.getElementById("openAddModal").addEventListener("click", openAddModal);
document.getElementById("closeFormModal").addEventListener("click", () => closeModal(formModal));
document.getElementById("cancelForm").addEventListener("click", () => closeModal(formModal));
document.getElementById("closeRemarksModal").addEventListener("click", () => closeModal(remarksModal));
document.getElementById("closeRemarksBtn").addEventListener("click", () => closeModal(remarksModal));
document.getElementById("closeDeleteModal").addEventListener("click", () => closeModal(deleteModal));
document.getElementById("cancelDelete").addEventListener("click", () => closeModal(deleteModal));

// Close on overlay click
[formModal, remarksModal, deleteModal].forEach(modal => {
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal(modal);
  });
});

// Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") {
    [formModal, remarksModal, deleteModal].forEach(closeModal);
  }
});

// Init
loadPatients();
