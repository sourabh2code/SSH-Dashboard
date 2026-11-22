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

const machineSort = document.getElementById("machine-sort");
const machineSortDirection = document.getElementById("machine-sort-direction");
let sortAscending = true;

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

function updateURL(labId = null, section = "map", replace = false) {
  const url = new URL(window.location.href);

  url.searchParams.delete("lab");
  url.searchParams.delete("section");

  if (labId) {
    url.searchParams.set("lab", labId);
    url.searchParams.set("section", section);
  }

  const method = replace ? "replaceState" : "pushState";
  window.history[method]({}, "", url);
}

function restorePageFromURL() {
  const params = new URLSearchParams(window.location.search);

  const labId = params.get("lab");
  const section = params.get("section") || "map";

  if (labId && labs[labId]) {
    openLab(labId, false);
    setSection(["map", "machines"].includes(section) ? section : "map", false);
  } else {
    returnToDashboard(false);
  }
}

const API_URL = "http://127.0.0.1:8000/api/machines";
const liveMachines = new Map();

// Match actual lab hostnames, e.g. sl2-67 or sl2-pc-067
function getMachineKey(host) {
  const match = String(host).toLowerCase()
    .match(/^sl([123])-(?:pc-)?0*(\d{1,3})(?:\..*)?$/);

  if (!match) return null;

  const labId = `lab-${match[1]}`;
  const pcNumber = Number(match[2]);

  if (pcNumber < 1 || !layouts[labId] || ![...layouts[labId].left, ...layouts[labId].right].includes(pcNumber)) {
    return null;
  }

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


function setSection(section, updateHistory = true) {
  if (!activeLabId || !["map", "machines"].includes(section)) return;
  document.querySelectorAll("[data-lab-section]").forEach((panel) => {
    panel.hidden = panel.dataset.labSection !== section;
  });

  document.querySelectorAll(".lab-tab").forEach((button) => {
    const selected = button.dataset.section === section;
    button.classList.toggle("active", selected);
    if (button.hasAttribute("role")) button.setAttribute("aria-selected", String(selected));
  });

  if (updateHistory) {
  updateURL(activeLabId, section);
}
}

function openLab(labId, updateHistory = true) {
  const lab = labs[labId];
  if (!lab) return;

  activeLabId = labId;
  dashboardHome.hidden = true;
  labWorkspace.hidden = false;
  labTitle.textContent = lab.name;
  renderSeatMap(labId);
  renderMachineOverview(labId);

  if (breadcrumb) breadcrumb.replaceChildren();
  const workspace = document.createElement("span");
  workspace.textContent = "Workspace";
  const separator = document.createElement("span");
  separator.className = "crumb-separator";
  separator.textContent = "/";
  const current = document.createElement("b");
  current.textContent = lab.name;
  if (breadcrumb) breadcrumb.append(workspace, separator, current);

  setSection("map", false);

  if (updateHistory) {
    updateURL(labId, "map");
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

const layouts = {
    "lab-1": {
      left: Array.from({ length: 20 }, (_, i) => i + 64),
      right: Array.from({ length: 63 }, (_, i) => i + 1),
      columns: [5, 7],
      marked: []
    },
    "lab-2": {
      left: [
        ...Array.from({ length: 9 }, (_, r) =>
          Array.from({ length: 7 }, (_, c) => r * 14 + c + 1)
        ).flat(),
        ...Array.from({ length: 6 }, (_, i) => i + 127)
      ],
      right: [
        200,
        ...Array.from({ length: 9 }, (_, r) =>
          Array.from({ length: 7 }, (_, c) => r * 14 + c + 8)
        ).flat()
      ],
      columns: [7, 7],
      marked: [4, 9, 12, 16, 35, 53, 58, 63, 67, 72, 91, 94, 96, 97, 105, 112, 120, 132]
    },
    "lab-3": {
      left: Array.from({ length: 36 }, (_, i) => i + 1),
      right: Array.from({ length: 8 }, (_, i) => i + 37),
      columns: [4, 2],
      marked: [4, 9, 38, 41]
    }
  };

function renderSeatMap(labId) {
  
  const layout = layouts[labId];
  if (!layout) return;

  const banks = [leftSeatBank, rightSeatBank];
  cinemaRoom.setAttribute("aria-label", `${labs[labId].name} computer map`);
  cinemaRoom.className = `cinema-room layout-${labId}`;

  banks.forEach((bank, bankIndex) => {
    bank.replaceChildren();
    bank.style.setProperty("--cols", layout.columns[bankIndex]);

    const numbers = bankIndex === 0 ? layout.left : layout.right;

    numbers.forEach((pcNumber, index) => {
      const report = liveMachines.get(`${labId}-${pcNumber}`);
      const age = report ? Date.now() / 1000 - Number(report.timestamp) : Infinity;
      const unavailable = !report || !report.online || age > 90 || age < -30;

      const pc = document.createElement("span");
      const status = unavailable ? "Unavailable" : "Available";
      const marked = layout.marked.includes(pcNumber);

      pc.className = `pc-seat ${unavailable ? "is-unavailable" : "is-available"}`;
      if (pcNumber === 200) pc.classList.add("special-seat");

      pc.textContent = String(pcNumber);
      pc.title = `PC-${pcNumber} · ${status}`;
      pc.setAttribute("role", "img");
      pc.setAttribute("aria-label", `PC-${pcNumber}, ${status.toLowerCase()}`);

      bank.append(pc);
    });
  });
}





function getMachinesForLab(labId) {
  if (machineDataByLab.has(labId)) {
    return machineDataByLab.get(labId);
  }

  const lab = labs[labId];
  const layout = layouts[labId];

  if (!lab || !layout) return [];

  // Static machine inventory from actual seat layout
  const pcNumbers = [
    ...new Set([...layout.left, ...layout.right])
  ].sort((a, b) => a - b);

  const machines = pcNumbers.map((pcNumber) => {
    const hostName = `sl${Number(lab.number)}-${pcNumber}`;
    const report = liveMachines.get(`${labId}-${pcNumber}`);

    const age = report
      ? Math.floor(Date.now() / 1000 - Number(report.timestamp))
      : null;

    const available = Boolean(
      report &&
      report.online &&
      Number.isFinite(age) &&
      age >= -30 &&
      age <= 90
    );

    return {
      pcNumber,
      id: hostName,
      host: hostName,
      available,

      cpuUsage: available ? Number(report.cpu ?? 0) : 0,

      memoryTotalGb: available
        ? Number(report.ram_total_mb ?? 0) / 1024
        : 0,

      memoryAvailableGb: available
        ? Number(report.ram_available_mb ?? 0) / 1024
        : 0,

      diskUsage: available ? Number(report.disk ?? 0) : 0,

      diskTotalGb: available
        ? Number(report.disk_total_gb ?? 0)
        : 0,

      diskAvailableGb: available
        ? Number(report.disk_available_gb ?? 0)
        : 0,

      sessions: available ? Number(report.ssh_sessions ?? 0) : 0,

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

  labels.append(name);
  machineCell.append(icon, labels);
  pcCell.append(machineCell);
  row.append(pcCell);

  
  const statusCell = document.createElement("td");
  const status = document.createElement("span");
  status.className = `status ${machine.available ? "online" : "offline"}`;

  const dot = document.createElement("i");
  dot.className = "status-dot";
  dot.setAttribute("aria-hidden", "true");

  status.append(
    dot,
    document.createTextNode(machine.available ? "Available" : "Unavailable")
  );

  statusCell.append(status);
  row.append(statusCell);

  const cpuUsage = Number(machine.cpuUsage ?? 0);

  row.append(
    createResourceCell(
      `${cpuUsage.toFixed(1)}%`,
      "CPU usage",
      cpuUsage,
      cpuUsage >= 70 ? "warn" : ""
    )
  );

  
  const memoryTotalGb = Number(machine.memoryTotalGb ?? 0);
  const memoryAvailableGb = Number(machine.memoryAvailableGb ?? 0);

  // Calculate used memory
  const memoryUsedGb = Math.max(0, memoryTotalGb - memoryAvailableGb);

  // Calculate memory usage percentage
  const memoryPercent = memoryTotalGb > 0
    ? (memoryUsedGb / memoryTotalGb) * 100
    : 0;

  row.append(
    createResourceCell(
      `${memoryUsedGb.toFixed(1)} GB`,
      `of ${memoryTotalGb.toFixed(1)} GB`,
      memoryPercent,
      machine.available && memoryPercent > 65 ? "warn" : ""
    )
  );

  
  const diskUsage = Number(machine.diskUsage ?? 0);
  const diskAvailableGb = Number(machine.diskAvailableGb ?? 0);

  row.append(
    createResourceCell(
      `${diskUsage.toFixed(1)}%`,
      `${diskAvailableGb.toFixed(1)} GB free`,
      diskUsage,
      diskUsage >= 85 ? "warn" : ""
    )
  );

  const sessionCell = document.createElement("td");
  sessionCell.className = "sessions";

  const sessions = Number(machine.sessions ?? 0);
  const count = document.createElement("strong");
  count.textContent = String(sessions);

  sessionCell.append(
    count,
    document.createTextNode(
      sessions === 1 ? " session" : " sessions"
    )
  );

  row.append(sessionCell);

  const checked = document.createElement("td");
  checked.className = "last-check";

  checked.textContent = machine.checkedSecondsAgo !== null &&
                        machine.checkedSecondsAgo !== undefined
    ? `${machine.checkedSecondsAgo} sec ago`
    : "No report";

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


  
  const sortKey = machineSort.value;

  function getSortValue(machine) {
    switch (sortKey) {
      case "cpu":
        return machine.cpuUsage;

      case "memory":
        return machine.memoryTotalGb > 0
          ? ((machine.memoryTotalGb -
              machine.memoryAvailableGb) /
              machine.memoryTotalGb) * 100
          : 0;

      case "disk":
        return machine.diskUsage;

      case "sessions":
        return machine.sessions;

      default:
        return machine.pcNumber;
    }
  }

  filtered.sort((a, b) => {

    // Available machines first when sorting resources
    if (sortKey !== "default" &&
        a.available !== b.available) {
      return Number(b.available) - Number(a.available);
    }

    const valueA = getSortValue(a);
    const valueB = getSortValue(b);

    // Apply ascending or descending to values and ties
    const difference =
      (valueA - valueB) || (a.pcNumber - b.pcNumber);

    return sortAscending ? difference : -difference;
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


  machineSort.value = "default";
  sortAscending = true;

  machineSortDirection.textContent = "↑";
  machineSortDirection.title = "Ascending";
  machineSortDirection.setAttribute(
    "aria-label",
    "Change to descending order"
  );
  machineSortDirection.disabled = false;

  machinePage = 1;

  renderMachineStats(labId);
  renderMachineRows();
}


function returnToDashboard(updateHistory = true) {
  activeLabId = null;
  dashboardHome.hidden = false;
  labWorkspace.hidden = true;

  if (breadcrumb) breadcrumb.replaceChildren();
  const workspace = document.createElement("span");
  workspace.textContent = "Workspace";
  const separator = document.createElement("span");
  separator.className = "crumb-separator";
  separator.textContent = "/";
  const current = document.createElement("b");
  current.textContent = "Dashboard";
  if (breadcrumb) breadcrumb.append(workspace, separator, current);
  window.scrollTo({ top: 0, behavior: "smooth" });

  if (updateHistory) {
  updateURL();
  }
}

restorePageFromURL();

window.addEventListener("popstate", () => {
  restorePageFromURL();
});

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



machineSort.addEventListener("change", () => {
  machinePage = 1;
  renderMachineRows();
});


machineSortDirection.addEventListener("click", () => {
  sortAscending = !sortAscending;

  machineSortDirection.textContent =
    sortAscending ? "↑" : "↓";

  machineSortDirection.title =
    sortAscending ? "Ascending" : "Descending";

  machineSortDirection.setAttribute(
    "aria-label",
    sortAscending
      ? "Change to descending order"
      : "Change to ascending order"
  );

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