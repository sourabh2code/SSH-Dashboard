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

let activeLabId = null;
let activeSection = "map";

function setSection(section) {
  if (!activeLabId || !["map", "machines"].includes(section)) return;
  activeSection = section;

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
