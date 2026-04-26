const editor = ace.edit("ace");
editor.setTheme("ace/theme/monokai");
editor.session.setMode("ace/mode/javascript");

const sessions = {};
const initial = {};
const changed = {};
const history = {};
const errors = {};
let currentFilename = null;

async function switchSession(filename, revert=False, version="current") {
  document.querySelector("#logs").innerHTML = "";
  if (!(filename in sessions)) {
    revert = true;
    sessions[filename] = ace.createEditSession("");
    if (filename.endsWith(".js")) {
      sessions[filename].setMode("ace/mode/javascript");
    }
    sessions[filename].on('change', function (delta) {
      const c = sessions[filename].getValue() != initial[filename];
      console.log(changed)
      if (c !== changed[filename]) {
        changed[filename] = c;
        loadFileList();
      }
    });

  }

  if (revert) {
    let url = "/files/code/" + filename;
    if (version !== "current") {
      url += "?version=" + version;
    }
    const res = await fetch(url);
    const data = res.status === 200 ? await res.text() : "";
    initial[filename] = data;
    sessions[filename].setValue(data);
  }

  editor.setSession(sessions[filename])
  window.history.pushState(filename, null, "/edit/" + filename);
  currentFilename = filename;
  loadHistory(filename, version);
  showErrors();
  updateLogs();
  document.querySelector("#filename").innerText = filename;
}

async function loadFileList() {
  const res = await fetch("/files/code/");
  const files = await res.json();
  const list = document.querySelector('#files ul')
  list.innerHTML = "";
  for(let f of files) {
    const filename = f.filename;
    errors[filename] = f.error;
    const li = document.createElement("li");
    const button = document.createElement("button");
    button.innerText = filename;
    li.appendChild(button);
    if (f.error) {
      const err = document.createElement("span");
      err.innerText = "!";
      err.className = "error";
      li.appendChild(err)
    }
    if (changed[filename]) {
      const star = document.createElement("span");
      star.innerText = "*";
      li.appendChild(star)
    }

    list.appendChild(li);
  }
  showErrors();
}

function showHistory(filename, currentVersion="current") {
  document.querySelector("#version").innerHTML = "";
  function add(version, mtime) {
    const option = document.createElement("option")
    option.innerText = version;
    if (mtime) {
      option.innerText += " (" + new Date(mtime) + ")"
    }
    option.value = version;
    document.querySelector("#version").appendChild(option)
    option.addEventListener("click", () => {
      switchSession(filename, true, version)
    })
  }
  add("current");
  for (let v of history[filename] || []) {
    add(v.version, v.mtime)
  }
  document.querySelector("#version").value = currentVersion;
}

async function loadHistory(filename, currentVersion) {
  showHistory(filename, currentVersion);
  const res = await fetch("/history/code/" + filename)
  history[filename] = await res.json();
  showHistory(filename, currentVersion);
}

function showErrors() {
  const error = errors[currentFilename];
  document.querySelector("#errors").innerHTML = error || "";

  if (error) {
    const match = /\s+at (.*):(\d+):(\d+)/.exec(error);
    if (match) {
      editor.getSession().setAnnotations([{
        row: parseInt(match[2])-1,
        column: parseInt(match[3])-1,
        text: error.split("\n")[0],
        type: "error" // also "warning" and "information"
      }]);
    }
  }
}

async function updateLogs() {
  const filename = currentFilename;
  const res = await fetch("/logs/code/" + filename)
  const logs = await res.text();
  if (filename === currentFilename && document.querySelector("#logs").innerText !== logs) {
    document.querySelector("#logs").innerText = logs;
    document.querySelector("#logs").scrollTop = document.querySelector("#logs").scrollHeight;
  }
}

function loadFromUrl() {
  const bits = window.location.href.split("/");
  const filename = bits[bits.length - 1];
  if (filename) {
    switchSession(filename, false);
  }
}

async function save() {
  if (!currentFilename) {
    currentFilename = prompt("Filename?");
    sessions[currentFilename] = editor.session;
  }
  const res = await fetch("/files/code/" + currentFilename, {method: "PUT", body: editor.session.getValue()});
  if (res.status == 201) {
    alert("Saved")
    changed[currentFilename] = false;
    showHistory(currentFilename);
  } else {
    alert(`Failed to save ${res.status}: ${await res.text()}`);
  }
  loadFileList();
  switchSession(currentFilename, true);
}

async function revert() {
  if (confirm("Revert current file (lose unsaved changes)?")) {
    switchSession(currentFilename, true);
  }
}

async function deleteFile() {
  if (confirm("DELETE the current file?")) {
    const res = await fetch("/files/code/" + currentFilename, {method: "DELETE"});
    if (res.status == 201) {
      alert("DELETED");
      changed[currentFilename] = true;
    } else {
      alert(`Failed to delete ${res.status}: ${await res.text()}`);
    }
    loadFileList();
  }
}

function newFile() {
  switchSession(prompt("Filename?"), true);
}


document.querySelector("#revert").addEventListener("click", revert);
document.querySelector("#save").addEventListener("click", save);
document.querySelector("#delete").addEventListener("click", deleteFile);
document.querySelector("#new").addEventListener("click", newFile);

document.querySelector('#uploadfile input').addEventListener("change", (e) => {
  const file = document.querySelector('#uploadfile input').files[0];
  const filename = file.name;
  const reader = new FileReader();
  reader.readAsArrayBuffer(file);
  reader.onload = async (evt) => {
    const res = await fetch("/files/code/" + filename, { body: evt.target.result, method: "PUT" });
    if (res.status == 201) {
      loadFileList();
      alert("Uploaded!")
    } else {
      alert(`Failed to upload ${res.status}: ${await res.text()}`);
    }
    document.querySelector('#uploadfile input').value = "";
  }
  reader.onerror = (evt) => {
    alert("Failed to read file")
  }

});

document.querySelector('#files ul').addEventListener("click", (e) => {
  if (e.target.tagName !== "BUTTON") return;
  const filename = e.target.innerText;
  if (filename.endsWith(".txt") || filename.endsWith(".js")) {
    switchSession(filename, false);
  } else {
    window.open("/files/code/" + filename, "_blank")
  }
});

addEventListener("popstate", loadFromUrl);


loadFileList();
// Refresh the file list every 30s
setInterval(loadFileList, 30000);
setInterval(updateLogs, 5000)
loadFromUrl();
