const status = document.getElementById("status");
const projects = document.getElementById("projects");
async function refresh() {
  const recents = await window.desktop.recents();
  projects.replaceChildren();
  if (!recents.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "还没有最近项目。新建一份演示，或打开已有的项目文件夹。";
    projects.append(empty);
  }
  for (const project of recents) {
    const button = document.createElement("button");
    button.className = "project";
    const title = document.createElement("strong");
    title.textContent = project.name;
    const path = document.createElement("small");
    path.textContent = project.path;
    button.append(title, path);
    button.addEventListener("click", () => run(() => window.desktop.reopen(project.path)));
    projects.append(button);
  }
}
async function run(action) {
  document.querySelectorAll("button").forEach((button) => (button.disabled = true));
  status.textContent = "正在打开项目…";
  try {
    const result = await action();
    status.textContent = result.ok ? "" : result.error;
    await refresh();
  } catch (error) {
    status.textContent = String(error);
  } finally {
    document.querySelectorAll("button").forEach((button) => (button.disabled = false));
  }
}
document.getElementById("open").addEventListener("click", () => run(() => window.desktop.open()));
document
  .getElementById("create")
  .addEventListener("click", () => run(() => window.desktop.create()));
refresh().catch((error) => (status.textContent = String(error)));
