const labs = {
  "lab-1": { name: "Software Lab 1", number: "01", offset: 0 },
  "lab-2": { name: "Software Lab 2", number: "02", offset: 3 },
  "lab-3": { name: "Software Lab 3", number: "03", offset: 6 },
};

const dashboardHome = document.getElementById("dashboard-home");
const labWorkspace = document.getElementById("lab-workspace");
const breadcrumb = document.getElementById("breadcrumb");
const labTitle = document.getElementById("lab-title");
const leftSeatBank = document.getElementById("seat-bank-left");
const rightSeatBank = document.getElementById("seat-bank-right");
const cinemaRoom = document.getElementById("cinema-room");
const machineTotal = document.getElementById("machine-total");
const machineAvailable = document.getElementById("machine-available");
const machineUnavailable = document.getElementById("machine-unavailable");
const machineSessions = document.getElementById("machine-sessions");
const machineRows = document.getElementById("machine-rows");
const machineSearch = document.getElementById("machine-search");
const machineFilter = document.getElementById("machine-filter");
const machineEmpty = document.getElementById("machine-empty");
const machinePageSummary = document.getElementById("machine-page-summary");
const machinePageCount = document.getElementById("machine-page-count");
const machinePrev = document.getElementById("machine-prev");
const machineNext = document.getElementById("machine-next");
const machineListCaption = document.getElementById("machine-list-caption");

let activeLabId = null;
let machinePage = 1;
const machinePageSize = 10;
const machineDataByLab = new Map();


const API_URL = "http://127.0.0.1:8000/api/machines";
const liveMachines = new Map();

// Match actual lab hostnames, e.g. sl2-67 or sl2-pc-067
function getMachineKey(host) {
  const match = String(host).toLowerCase()
    .match(/^sl([123])-(?:pc-)?0*(\d{1,3})(?:\..*)?$/);

  if (!match) return null;

  const labId = `lab-${match[1]}`;
  const pcNumber = Number(match[2]);

  if (pcNumber < 1 || pcNumber > 140) return null;

  return `${labId}-${pcNumber}`;
}

async function fetchMachineData() {
  try {
    const response = await fetch(API_URL, { cache: "no-store" });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reports = await response.json();
    if (!Array.isArray(reports)) throw new Error("Invalid API response");

    liveMachines.clear();

    for (const machine of reports) {
      const key = getMachineKey(machine.host);
      if (key) liveMachines.set(key, machine);
    }

    machineDataByLab.clear();

    if (activeLabId) {
      renderSeatMap(activeLabId);
      renderMachineStats(activeLabId);
      renderMachineRows();
    }
  } catch (error) {
    console.error("Unable to fetch machine data:", error);
    machineDataByLab.clear();

    if (activeLabId) {
      renderSeatMap(activeLabId);
      renderMachineStats(activeLabId);
      renderMachineRows();
    }
    // Keep previous reports; their timestamps still determine freshness.
  }
}

fetchMachineData();
setInterval(fetchMachineData, 30000);


function setSection(section) {
  if (!activeLabId || !["map", "machines"].includes(section)) return;
  document.querySelectorAll("[data-lab-section]").forEach((panel) => {
    panel.hidden = panel.dataset.labSection !== section;
  });

  document.querySelectorAll(".lab-tab").forEach((button) => {
    const selected = button.dataset.section === section;
    button.classList.toggle("active", selected);
    if (button.hasAttribute("role")) button.setAttribute("aria-selected", String(selected));
  });
}

function openLab(labId) {
  const lab = labs[labId];
  if (!lab) return;

  activeLabId = labId;
  dashboardHome.hidden = true;
  labWorkspace.hidden = false;
  labTitle.textContent = lab.name;
  renderSeatMap(labId);
  renderMachineOverview(labId);

  breadcrumb.replaceChildren();
  const workspace = document.createElement("span");
  workspace.textContent = "Workspace";
  const separator = document.createElement("span");
  separator.className = "crumb-separator";
  separator.textContent = "/";
  const current = document.createElement("b");
  current.textContent = lab.name;
  breadcrumb.append(workspace, separator, current);

  setSection("map");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function renderSeatMap(labId) {
  const lab = labs[labId];
  if (!lab) return;

  cinemaRoom.setAttribute("aria-label", `${lab.name} computer map, 140 PCs`);
  [leftSeatBank, rightSeatBank].forEach((bank, bankIndex) => {
    bank.replaceChildren();
    const firstPcNumber = bankIndex * 70 + 1;

    for (let index = 0; index < 70; index += 1) {
      const pcNumber = firstPcNumber + index;
      const row = Math.floor(index / 7);
      const column = (index % 7) + 1;
      const report = liveMachines.get(`${labId}-${pcNumber}`);
      const age = report ? Date.now() / 1000 - Number(report.timestamp) : Infinity;
      const unavailable = !report || !report.online || age > 90 || age < -30;
      const pc = document.createElement("span");
      const status = unavailable ? "Unavailable" : "Available";

      pc.className = `pc-seat ${unavailable ? "is-unavailable" : "is-available"}`;
      pc.textContent = String(pcNumber).padStart(3, "0");
      pc.title = `PC-${String(pcNumber).padStart(3, "0")} · ${status}`;
      pc.setAttribute("role", "img");
      pc.setAttribute("aria-label", `Row ${String.fromCharCode(65 + row)}, column ${column}, PC-${String(pcNumber).padStart(3, "0")}, ${status.toLowerCase()}`);
      bank.append(pc);
    }
  });
}


function getMachinesForLab(labId) {
  if (machineDataByLab.has(labId)) {
    return machineDataByLab.get(labId);
  }

  const lab = labs[labId];
  if (!lab) return [];

  const machines = Array.from({ length: 140 }, (_, index) => {
    const pcNumber = index + 1;
    const id = String(pcNumber).padStart(3, "0");

    const report = liveMachines.get(`${labId}-${pcNumber}`);
    const age = report
      ? Math.max(0, Math.floor(Date.now() / 1000 - Number(report.timestamp)))
      : null;

    const available = Boolean(
      report && report.online && Number.isFinite(age) && age <= 90
    );

    return {
      pcNumber,
      id: `PC-${id}`,
      host: report?.host || `sl${lab.number}-${pcNumber}`,
      available,
      coreCount: null,
      cpuUsage: available ? Number(report.cpu) : null,
      memoryTotalGb: available ? Number(report.ram_total_mb) / 1024 : null,
      memoryAvailableGb: available ? Number(report.ram_available_mb) / 1024 : null,
      sessions: available ? Number(report.ssh_sessions) : null,
      checkedSecondsAgo: age
    };
  });

  machineDataByLab.set(labId, machines);
  return machines;
}


function createResourceCell(primaryText, secondaryText, percent, tone = "") {
  const cell = document.createElement("td");
  const resource = document.createElement("div");
  resource.className = "resource machine-resource";
  const line = document.createElement("div");
  line.className = "resource-line";
  const primary = document.createElement("span");
  primary.textContent = primaryText;
  const secondary = document.createElement("strong");
  secondary.textContent = secondaryText;
  line.append(primary, secondary);
  resource.append(line);

  const bar = document.createElement("div");
  bar.className = "bar";
  const fill = document.createElement("div");
  fill.className = `bar-fill ${tone}`.trim();
  fill.style.width = `${Math.max(0, Math.min(100, percent || 0))}%`;
  bar.append(fill);
  resource.append(bar);
  cell.append(resource);
  return cell;
}

function createMachineRow(machine) {
  const row = document.createElement("tr");
  row.dataset.machineId = machine.id.toLowerCase();
  row.dataset.status = machine.available ? "available" : "unavailable";

  const pcCell = document.createElement("td");
  const machineCell = document.createElement("div");
  machineCell.className = "machine-cell";
  const icon = document.createElement("span");
  icon.className = "machine-icon pc-machine-icon";
  icon.innerHTML = '<img src="images/PC.png" alt="" width="28" height="28">';
  icon.setAttribute("aria-hidden", "true");
  const labels = document.createElement("span");
  const name = document.createElement("span");
  name.className = "machine-name";
  name.textContent = machine.id;
  const host = document.createElement("span");
  host.className = "machine-host";
  host.textContent = machine.host;
  labels.append(name, host);
  machineCell.append(icon, labels);
  pcCell.append(machineCell);
  row.append(pcCell);

  const statusCell = document.createElement("td");
  const status = document.createElement("span");
  status.className = `status ${machine.available ? "online" : "offline"}`;
  const dot = document.createElement("i");
  dot.className = "status-dot";
  dot.setAttribute("aria-hidden", "true");
  status.append(dot, document.createTextNode(machine.available ? "Available" : "Unavailable"));
  statusCell.append(status);
  row.append(statusCell);

  
  if (machine.available) {
    row.append(
      createResourceCell(
        `${machine.cpuUsage.toFixed(1)}%`,
        "CPU usage",
        machine.cpuUsage,
        machine.cpuUsage >= 70 ? "warn" : ""
      )
    );

    const memoryPercent =
      (machine.memoryAvailableGb / machine.memoryTotalGb) * 100;

    row.append(
      createResourceCell(
        `${machine.memoryAvailableGb.toFixed(1)} GB`,
        `of ${machine.memoryTotalGb.toFixed(1)} GB`,
        memoryPercent,
        memoryPercent < 35 ? "warn" : ""
      )
    );
  } else {
    row.append(createResourceCell("—", "No metrics", 0));
    row.append(createResourceCell("—", "No metrics", 0));
  }


  const sessionCell = document.createElement("td");
  sessionCell.className = "sessions";
  if (machine.available) {
    const count = document.createElement("strong");
    count.textContent = String(machine.sessions);
    sessionCell.append(count, document.createTextNode(machine.sessions === 1 ? " session" : " sessions"));
  } else {
    sessionCell.textContent = "—";
  }
  row.append(sessionCell);

  const checked = document.createElement("td");
  checked.className = "last-check";
  checked.textContent = machine.checkedSecondsAgo !== null ? `${machine.checkedSecondsAgo} sec ago` : "No report";
  row.append(checked);
  return row;
}

function renderMachineRows() {
  if (!activeLabId) return;
  const machines = getMachinesForLab(activeLabId);
  const query = machineSearch.value.trim().toLowerCase();
  const statusFilter = machineFilter.value;
  const filtered = machines.filter((machine) => {
    const matchesSearch = machine.id.toLowerCase().includes(query) || machine.host.toLowerCase().includes(query);
    const matchesStatus = statusFilter === "all" || (statusFilter === "available" ? machine.available : !machine.available);
    return matchesSearch && matchesStatus;
  });

  const pageCount = Math.max(1, Math.ceil(filtered.length / machinePageSize));
  machinePage = Math.min(machinePage, pageCount);
  const startIndex = (machinePage - 1) * machinePageSize;
  const pageMachines = filtered.slice(startIndex, startIndex + machinePageSize);
  const fragment = document.createDocumentFragment();
  pageMachines.forEach((machine) => fragment.append(createMachineRow(machine)));
  machineRows.replaceChildren(fragment);

  machineEmpty.hidden = filtered.length > 0;
  machinePageSummary.textContent = filtered.length
    ? `Showing ${startIndex + 1}–${Math.min(startIndex + machinePageSize, filtered.length)} of ${filtered.length} PCs`
    : "Showing 0 PCs";
  machinePageCount.textContent = `Page ${machinePage} of ${pageCount}`;
  machinePrev.disabled = machinePage <= 1;
  machineNext.disabled = machinePage >= pageCount;
}


function renderMachineStats(labId) {
  const lab = labs[labId];
  if (!lab) return;

  const machines = getMachinesForLab(labId);

  const availableCount = machines.filter(m => m.available).length;
  const unavailableCount = machines.length - availableCount;

  const activeSessionCount = machines.reduce(
    (total, machine) => total + (machine.sessions || 0), 0
  );

  machineTotal.textContent = String(machines.length);
  machineAvailable.textContent = String(availableCount);
  machineUnavailable.textContent = String(unavailableCount);

  if (machineSessions) {
    machineSessions.textContent = String(activeSessionCount);
  }

  machineListCaption.textContent =
    `${lab.name} · ${machines.length} computers · live monitoring`;
}

function renderMachineOverview(labId) {
  machineSearch.value = "";
  machineFilter.value = "all";
  machinePage = 1;

  renderMachineStats(labId);
  renderMachineRows();
}


function returnToDashboard() {
  activeLabId = null;
  dashboardHome.hidden = false;
  labWorkspace.hidden = true;

  breadcrumb.replaceChildren();
  const workspace = document.createElement("span");
  workspace.textContent = "Workspace";
  const separator = document.createElement("span");
  separator.className = "crumb-separator";
  separator.textContent = "/";
  const current = document.createElement("b");
  current.textContent = "Dashboard";
  breadcrumb.append(workspace, separator, current);
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll("[data-open-lab]").forEach((button) => {
  button.addEventListener("click", () => openLab(button.dataset.openLab));
});

document.querySelectorAll(".lab-tab").forEach((button) => {
  button.addEventListener("click", () => setSection(button.dataset.section));
});

document.getElementById("back-to-labs").addEventListener("click", returnToDashboard);

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && activeLabId) returnToDashboard();
});

machineSearch.addEventListener("input", () => {
  machinePage = 1;
  renderMachineRows();
});
machineFilter.addEventListener("change", () => {
  machinePage = 1;
  renderMachineRows();
});
machinePrev.addEventListener("click", () => {
  if (machinePage > 1) {
    machinePage -= 1;
    renderMachineRows();
  }
});
machineNext.addEventListener("click", () => {
  machinePage += 1;
  renderMachineRows();
});