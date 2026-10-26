const labs = {
  "lab-1": { name: "Software Lab 1", number: "01", offset: 0 },
  "lab-2": { name: "Software Lab 2", number: "02", offset: 3 },
  "lab-3": { name: "Software Lab 3", number: "03", offset: 6 },
};

const dashboardHome = document.getElementById("dashboard-home");
const labWorkspace = document.getElementById("lab-workspace");
const breadcrumb = document.getElementById("breadcrumb");
const homeNav = document.getElementById("home-nav");
const labTitle = document.getElementById("lab-title");
const labEyebrow = document.getElementById("lab-eyebrow");
const mapLabLabel = document.getElementById("map-lab-label");
const machinesLabLabel = document.getElementById("machines-lab-label");
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

function setSection(section) {
  if (!activeLabId || !["map", "machines"].includes(section)) return;
  document.querySelectorAll("[data-lab-section]").forEach((panel) => {
    panel.hidden = panel.dataset.labSection !== section;
  });

  document.querySelectorAll(".lab-nav, .lab-tab").forEach((button) => {
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
  labEyebrow.textContent = `SOFTWARE LAB ${lab.number}`;
  mapLabLabel.textContent = lab.name;
  machinesLabLabel.textContent = lab.name;
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

  homeNav.classList.remove("active");
  document.querySelectorAll(".lab-nav").forEach((button) => { button.hidden = false; });
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
      const unavailable = ((pcNumber + lab.offset) % 9 === 0) || ((pcNumber + lab.offset) % 17 === 0);
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
  if (machineDataByLab.has(labId)) return machineDataByLab.get(labId);
  const lab = labs[labId];
  if (!lab) return [];

  const coreCount = lab.offset === 3 ? 16 : 8;
  const memoryTotalGb = lab.offset === 3 ? 32 : 16;
  const labNumber = String(Number(lab.number));
  const machines = Array.from({ length: 140 }, (_, index) => {
    const pcNumber = index + 1;
    const unavailable = ((pcNumber + lab.offset) % 9 === 0) || ((pcNumber + lab.offset) % 17 === 0);
    const id = String(pcNumber).padStart(3, "0");
    const cpuUsage = unavailable ? null : ((pcNumber * 13 + lab.offset * 11) % 75) + 12;
    const memoryUsedPercent = unavailable ? null : ((pcNumber * 11 + lab.offset * 5) % 70) + 15;

    return {
      pcNumber,
      id: `PC-${id}`,
      host: `sl${labNumber}-pc-${id}.institute.edu`,
      available: !unavailable,
      coreCount,
      cpuUsage,
      memoryTotalGb,
      memoryAvailableGb: unavailable ? null : memoryTotalGb * (100 - memoryUsedPercent) / 100,
      sessions: unavailable ? null : (pcNumber + lab.offset) % 4,
      checkedSecondsAgo: 10 + ((pcNumber * 5 + lab.offset) % 36),
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
  icon.textContent = "PC";
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
    row.append(createResourceCell(`${machine.cpuUsage}%`, `${machine.coreCount} cores`, machine.cpuUsage, machine.cpuUsage >= 70 ? "warn" : ""));
    const memoryPercent = (machine.memoryAvailableGb / machine.memoryTotalGb) * 100;
    row.append(createResourceCell(`${machine.memoryAvailableGb.toFixed(1)} GB`, `of ${machine.memoryTotalGb} GB`, memoryPercent, memoryPercent < 35 ? "warn" : ""));
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
  checked.textContent = machine.available ? `${machine.checkedSecondsAgo} sec ago` : "Check failed";
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

function renderMachineOverview(labId) {
  const lab = labs[labId];
  if (!lab) return;
  const machines = getMachinesForLab(labId);
  const availableCount = machines.filter((machine) => machine.available).length;
  const unavailableCount = machines.length - availableCount;
  const activeSessionCount = machines.reduce((total, machine) => total + (machine.sessions || 0), 0);

  machineTotal.textContent = String(machines.length);
  machineAvailable.textContent = String(availableCount);
  machineUnavailable.textContent = String(unavailableCount);
  machineSessions.textContent = String(activeSessionCount);
  machineListCaption.textContent = `${lab.name} · 140 computers · preview data`;
  machineSearch.value = "";
  machineFilter.value = "all";
  machinePage = 1;
  renderMachineRows();
}

function returnToDashboard() {
  activeLabId = null;
  dashboardHome.hidden = false;
  labWorkspace.hidden = true;
  homeNav.classList.add("active");
  document.querySelectorAll(".lab-nav").forEach((button) => { button.hidden = true; });

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

document.querySelectorAll(".lab-nav, .lab-tab").forEach((button) => {
  button.addEventListener("click", () => setSection(button.dataset.section));
});

document.getElementById("back-to-labs").addEventListener("click", returnToDashboard);
homeNav.addEventListener("click", returnToDashboard);
document.getElementById("brand-home").addEventListener("click", (event) => {
  event.preventDefault();
  returnToDashboard();
});

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
