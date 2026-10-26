const labs = {
  "lab-1": { name: "Software Lab 1", number: "01" },
  "lab-2": { name: "Software Lab 2", number: "02" },
  "lab-3": { name: "Software Lab 3", number: "03" },
};

const dashboardHome = document.getElementById("dashboard-home");
const labWorkspace = document.getElementById("lab-workspace");
const breadcrumb = document.getElementById("breadcrumb");
const homeNav = document.getElementById("home-nav");
const labTitle = document.getElementById("lab-title");
const labEyebrow = document.getElementById("lab-eyebrow");
const mapLabLabel = document.getElementById("map-lab-label");
const machinesLabLabel = document.getElementById("machines-lab-label");

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
