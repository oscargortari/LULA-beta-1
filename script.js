const canvas = document.getElementById("canvas");
const world = document.getElementById("world");

let cameraX = 0;
let cameraY = 0;
let zoom = 1;
let cameraZ = 0;
let spacePressed = false;
let panning = false;
let scene = null;
let camera = null;
let renderer = null;
let controls = null;

let lastMouseX =0;
let lastMouseY = 0;

let zAssignMode = false;
let lastZMouseY = null;
const homeButton = document.getElementById("homeButton");
const addNodeButton = document.getElementById("addNode");
const deleteNodeButton = document.getElementById("deleteNode");
const publishModeButton = document.getElementById("publishMode");
const svg = document.getElementById("connections");
const directionToggleButton = document.getElementById("directionToggle");
const saveProjectButton = document.getElementById("saveProject");
const loadProjectInput = document.getElementById("loadProject");
const newProjectButton = document.getElementById("newProject");
const openProjectButton = document.getElementById("openProject");
const currentFileLabel = document.getElementById("currentFile");
const editorToggleButton =
  document.getElementById("editorToggle");
  const view3DButton = document.getElementById("view3DButton");
let editorMode = true;
let view3DMode = false;

  const childZStep = 1.5;

document.body.classList.add("editor-mode");

let childDirection = 1;
let connections = [];
let nodeCount = 1;
let selectedNodes = [];

const selectionBox = document.getElementById("selectionBox");

let boxSelecting = false;
let boxStartX = 0;
let boxStartY = 0;

canvas.addEventListener("mousedown", (e) => {
  if (!e.metaKey) return;
  if (e.target.classList.contains("node")) return;

  e.preventDefault();

  boxSelecting = true;

  boxStartX = e.clientX;
  boxStartY = e.clientY;

  selectionBox.style.display = "block";
  selectionBox.style.left = boxStartX + "px";
  selectionBox.style.top = boxStartY + "px";
  selectionBox.style.width = "0px";
  selectionBox.style.height = "0px";
});

document.addEventListener("mousemove", (e) => {

  if (!boxSelecting) return;

  const left = Math.min(boxStartX, e.clientX);
  const top = Math.min(boxStartY, e.clientY);

  const width = Math.abs(e.clientX - boxStartX);
  const height = Math.abs(e.clientY - boxStartY);

  selectionBox.style.left = left + "px";
  selectionBox.style.top = top + "px";
  selectionBox.style.width = width + "px";
  selectionBox.style.height = height + "px";
});

document.addEventListener("mouseup", () => {
  if (!boxSelecting) return;

  const boxRect = selectionBox.getBoundingClientRect();
  clearSelection();

  document.querySelectorAll(".node").forEach(node => {
    const rect = node.getBoundingClientRect();

    const overlaps =
      rect.left < boxRect.right &&
      rect.right > boxRect.left &&
      rect.top < boxRect.bottom &&
      rect.bottom > boxRect.top;

    if (overlaps && !selectedNodes.includes(node)) {
      selectedNodes.push(node);
    }
  });

  updateSelectionStyles();

  selectionBox.style.display = "none";
  boxSelecting = false;
});

addNodeButton.addEventListener("click", () => {
  createNode(
    "Nodo " + nodeCount,
    window.innerWidth / 2 + nodeCount * 20,
    window.innerHeight / 2 + nodeCount * 20
  );

  nodeCount++;
});
function clearProject() {
  document.querySelectorAll(".node").forEach(node => node.remove());

  connections.forEach(connection => {
    if (connection.line) connection.line.remove();
  });

  connections = [];
  selectedNodes = [];

  localStorage.removeItem("autosaveProject");
  localStorage.setItem("hasOpenedBefore", "true");

  currentFileLabel.textContent = "Proyecto nuevo";

  updateConnections();
}
newProjectButton.addEventListener("click", () => {
  const confirmNew = confirm(
    "¿Crear un proyecto nuevo? Se borrará el autoguardado local."
  );

  if (!confirmNew) return;

  clearProject();
});
function showWelcome() {
  if (welcomeScreen) {
    welcomeScreen.classList.remove("hidden");
  }
}
homeButton.addEventListener("click", () => {
  showWelcome();
});
function createNode(text, x, y) {
  const node = document.createElement("div");
  node.dataset.id = crypto.randomUUID();
  node.dataset.z = 0;
  node.className = "node";
  node.textContent = text;

  node.style.left = x + "px";
  node.style.top = y + "px";

  node.contentEditable = false;

  node.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  node.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    if (e.shiftKey) {
  toggleMultiSelection(node);
} else {
  selectSingleNode(node);
}

    node.contentEditable = true;
    node.focus();

    const range = document.createRange();
    range.selectNodeContents(node);

    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  });

  node.addEventListener("blur", () => {
    node.contentEditable = false;
  });

  makeDraggable(node);

  world.appendChild(node);
  updateZDisplay();

  return node;
}

function createChildNode() {
  if (selectedNodes.length === 1) {
    const parent = selectedNodes[0];

    const spacingX = 240;
    const spacingY = 90;

    let attempt = 0;
    let x, y;

    do {
      const offsetY = attempt === 0
        ? 0
        : Math.ceil(attempt / 2) * spacingY * (attempt % 2 === 0 ? 1 : -1);

      x = parent.offsetLeft + childDirection * spacingX;
      y = parent.offsetTop + offsetY;

      attempt++;
    } while (isPositionOccupied(x, y) && attempt < 20);

const parentZ = Number(parent.dataset.z || 0);
const childZ = parentZ + childZStep;

const child = createNode("Nodo " + nodeCount, x, y);
child.dataset.z = childZ;

updateZDisplay();
createConnection(parent, child);
    nodeCount++;
  } else {
    const x = 250 + nodeCount * 30;
    const y = 200 + nodeCount * 30;

    createNode("Nodo " + nodeCount, x, y);

    nodeCount++;
  }
}

function isPositionOccupied(x, y) {
  const nodes = document.querySelectorAll(".node");

  return Array.from(nodes).some(node => {
    const nodeX = node.offsetLeft;
    const nodeY = node.offsetTop;

    const distanceX = Math.abs(nodeX - x);
    const distanceY = Math.abs(nodeY - y);

    return distanceX < 140 && distanceY < 60;
  });
}

function repelNearbyNodes(movedNode) {

  const nodes = document.querySelectorAll(".node");

  nodes.forEach(node => {

    if (node === movedNode) return;

    const dx = node.offsetLeft - movedNode.offsetLeft;
    const dy = node.offsetTop - movedNode.offsetTop;

    const distance = Math.sqrt(dx * dx + dy * dy);

    const minimumDistance = 90;

    if (distance < minimumDistance && distance > 0) {

      const push = (minimumDistance - distance) * 0.12;

      const nx = dx / distance;
      const ny = dy / distance;

      node.style.left =
        (node.offsetLeft + nx * push) + "px";

      node.style.top =
        (node.offsetTop + ny * push) + "px";
    }
  });

  updateConnections();
}

function moveChildrenWithParent(parent, deltaX, deltaY) {
  connections.forEach(connection => {
    if (connection.a === parent) {
      const child = connection.b;

      child.style.left = child.offsetLeft + deltaX * 0.6 + "px";
      child.style.top = child.offsetTop + deltaY * 0.6 + "px";

      repelNearbyNodes(child);
    }
  });

  updateConnections();
  refresh3DIfActive();
}

function makeDraggable(element) {
  let offsetX = 0;
  let offsetY = 0;
  let isDragging = false;

  element.addEventListener("mousedown", (e) => {
    isDragging = true;
    document.body.classList.add("dragging-map");
    offsetX = e.clientX - element.offsetLeft;
    offsetY = e.clientY - element.offsetTop;
    element.style.cursor = "grabbing";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;

    const oldX = element.offsetLeft;
const oldY = element.offsetTop;
    element.style.left = e.clientX - offsetX + "px";
    element.style.top = e.clientY - offsetY + "px";
    const deltaX = element.offsetLeft - oldX;
const deltaY = element.offsetTop - oldY;

moveChildrenWithParent(element, deltaX, deltaY);
    repelNearbyNodes(element);
    updateConnections();
    refresh3DIfActive();
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    element.style.cursor = "grab";
  });
}

directionToggleButton.addEventListener("click", () => {
  childDirection *= -1;
  directionToggleButton.textContent =
    childDirection === 1 ? "Dirección: →" : "Dirección: ←";
});

function clearSelection() {
  selectedNodes.forEach(node => {
    node.classList.remove("primary-selected");
    node.classList.remove("secondary-selected");
  });

  selectedNodes = [];
}

function updateSelectionStyles() {
  selectedNodes.forEach((node, index) => {
    node.classList.remove("primary-selected");
    node.classList.remove("secondary-selected");

    if (index === 0) {
      node.classList.add("primary-selected");
    } else {
      node.classList.add("secondary-selected");
    }
  });
}

function selectSingleNode(node) {
  clearSelection();
  selectedNodes.push(node);
  updateSelectionStyles();
}

function toggleMultiSelection(node) {
  if (selectedNodes.includes(node)) {
    selectedNodes = selectedNodes.filter(n => n !== node);
  } else {
    selectedNodes.push(node);
  }

  updateSelectionStyles();
}

document.addEventListener("keydown", (e) => {
    const activeElement = document.activeElement;
const isEditingText = activeElement && activeElement.contentEditable === "true";

if (isEditingText) {
  return;
}
  if (e.shiftKey && e.key.toLowerCase() === "l" && selectedNodes.length === 2) {
    e.preventDefault();
    createConnection(selectedNodes[0], selectedNodes[1]);
  }

  if (e.shiftKey && e.key.toLowerCase() === "u" && selectedNodes.length === 2) {
    e.preventDefault();
    deleteConnection(selectedNodes[0], selectedNodes[1]);
  }

  if (e.shiftKey && e.key.toLowerCase() === "n") {
    e.preventDefault();
    createChildNode();
  }
  if (e.key === "Backspace" && selectedNodes.length > 0) {
  e.preventDefault();

  selectedNodes.forEach(node => {

    connections = connections.filter(connection => {

      const usesNode =
        connection.a === node ||
        connection.b === node;

      if (usesNode && connection.line) {
        connection.line.remove();
        return false;
      }

      return true;
    });

    node.remove();
  });

  selectedNodes = [];
}
});

function deleteSelectedNodes() {
  selectedNodes.forEach(node => {
    connections = connections.filter(connection => {
      const usesNode = connection.a === node || connection.b === node;

      if (usesNode && connection.line) {
        connection.line.remove();
        return false;
      }

      return true;
    });

    node.remove();
    refresh3DIfActive();
  });

  selectedNodes = [];
}

publishModeButton.addEventListener("click", () => {
  exportOBJ();
});
function createConnection(a, b) {
  const line = document.createElementNS(
    "http://www.w3.org/2000/svg",
    "path"
  );

  svg.appendChild(line);

  connections.push({
    a: a,
    b: b,
    line: line
  });

  updateConnections();
  refresh3DIfActive();
}

function updateConnections() {
  connections.forEach(connection => {
    const a = connection.a;
    const b = connection.b;

    const pointA = getEdgePoint(a, b);
    const pointB = getEdgePoint(b, a);

    const dx = pointB.x - pointA.x;
   const curveStrength = Math.min(Math.abs(dx) * 0.25, 90);
   

    const c1x = pointA.x + Math.sign(dx || 1) * curveStrength;
    const c1y = pointA.y;

    const c2x = pointB.x - Math.sign(dx || 1) * curveStrength;
    const c2y = pointB.y;

    const path = `
      M ${pointA.x} ${pointA.y}
      C ${c1x} ${c1y}, ${c2x} ${c2y}, ${pointB.x} ${pointB.y}
    `;

    connection.line.setAttribute("d", path);
  });
}
function sanitizeOBJName(name) {
  return String(name)
    .trim()
    .replace(/\s+/g, "_")
    .replace(/[^\w\-]/g, "")
    .slice(0, 40);
}

function downloadTextFile(content, filename, mimeType) {
  const blob = new Blob([content], {
    type: mimeType
  });

  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();

  URL.revokeObjectURL(url);
}

function getEdgePoint(fromNode, toNode) {
  const from = {
    x: fromNode.offsetLeft,
    y: fromNode.offsetTop,
    w: fromNode.offsetWidth,
    h: fromNode.offsetHeight
  };

  const to = {
    x: toNode.offsetLeft,
    y: toNode.offsetTop,
    w: toNode.offsetWidth,
    h: toNode.offsetHeight
  };

  const fromCenterX = from.x + from.w / 2;
  const fromCenterY = from.y + from.h / 2;

  const toCenterX = to.x + to.w / 2;
  const toCenterY = to.y + to.h / 2;

  const dx = toCenterX - fromCenterX;
  const dy = toCenterY - fromCenterY;

  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDx / from.w > absDy / from.h) {
    // Sale por izquierda o derecha
    return {
      x: dx > 0 ? from.x + from.w : from.x,
      y: fromCenterY
    };
  } else {
    // Sale por arriba o abajo
    return {
      x: fromCenterX,
      y: dy > 0 ? from.y + from.h : from.y
    };
  }
}
function deleteConnection(a, b) {
  connections = connections.filter(connection => {
    const isSameConnection =
      (connection.a === a && connection.b === b) ||
      (connection.a === b && connection.b === a);

    if (isSameConnection && connection.line) {
      connection.line.remove();
      return false;
    }

    return true;
  });
}
function updateCamera() {
  world.style.transform = `translate(${cameraX}px, ${cameraY}px) scale(${zoom})`;
}
canvas.addEventListener("wheel", (e) => {
  e.preventDefault();

  if (e.shiftKey) {
    const oldZoom = zoom;
    const zoomSpeed = 0.01;

    if (e.deltaY < 0) zoom += zoomSpeed;
    else zoom -= zoomSpeed;

    zoom = Math.max(0.2, Math.min(zoom, 3));

    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    cameraX = centerX - ((centerX - cameraX) / oldZoom) * zoom;
    cameraY = centerY - ((centerY - cameraY) / oldZoom) * zoom;

    updateCamera();

  } else if (e.ctrlKey) {
    cameraZ += e.deltaY * 0.02;
    updateZDisplay();

  } else {
    cameraX -= e.deltaX;
    cameraY -= e.deltaY;
    updateCamera();
  }
});

document.addEventListener("keydown", (e) => {
  if (e.code === "Space") {
    spacePressed = true;
  }
  if (e.metaKey && e.key.toLowerCase() === "s") {
  e.preventDefault();
  saveProject();
 if (e.shiftKey && e.code === "KeyZ") {
  zAssignMode = true;
  lastZMouseY = null;
}
}
}
);

document.addEventListener("keyup", (e) => {
  if (e.code === "Space") {
    spacePressed = false;
    panning = false;
  }
  if (e.code === "KeyZ") {
  zAssignMode = false;
}
});

canvas.addEventListener("mousedown", (e) => {
  if (e.button !== 1) return;

  e.preventDefault();

  panning = true;
  lastMouseX = e.clientX;
  lastMouseY = e.clientY;
});

document.addEventListener("mousemove", (e) => {
  if (!panning) return;

  cameraX += e.clientX - lastMouseX;
  cameraY += e.clientY - lastMouseY;

  lastMouseX = e.clientX;
  lastMouseY = e.clientY;

  updateCamera();
});

document.addEventListener("mouseup", () => {
  document.body.classList.remove("dragging-map");
});
canvas.addEventListener("auxclick", (e) => {
  if (e.button === 1) {
    e.preventDefault();
  }
});

canvas.addEventListener("dblclick", (e) => {
  if (e.target === canvas || e.target === world) {
    clearSelection();
  }
});
function saveProject() {
  const nodes = Array.from(document.querySelectorAll(".node")).map(node => ({
    id: node.dataset.id,
    text: node.textContent,
    x: node.offsetLeft,
    y: node.offsetTop,
z: Number(node.dataset.z || 0)
  }));

  const savedConnections = connections.map(connection => ({
    a: connection.a.dataset.id,
    b: connection.b.dataset.id
  }));

  const project = {
    nodes,
    connections: savedConnections
  };

  const blob = new Blob(
    [JSON.stringify(project, null, 2)],
    { type: "application/json" }
  );

  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "mapa-nodos.json";
  link.click();
}
function loadProjectData(project) {
  document.querySelectorAll(".node").forEach(node => node.remove());
  connections.forEach(connection => connection.line.remove());
  connections = [];
  selectedNodes = [];

  const nodeMap = {};

  project.nodes.forEach(savedNode => {
    const node = createNode(savedNode.text, savedNode.x, savedNode.y);
    node.dataset.id = savedNode.id;
    node.dataset.z = savedNode.z || 0;
    nodeMap[savedNode.id] = node;
  });

  project.connections.forEach(savedConnection => {
    const a = nodeMap[savedConnection.a];
    const b = nodeMap[savedConnection.b];

    if (a && b) createConnection(a, b);
  });

  updateConnections();
}
saveProjectButton.addEventListener("click", saveProject);

loadProjectInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
if (!file) return;
currentFileLabel.textContent = "📄 " + file.name;

  const reader = new FileReader();

 reader.onload = () => {
  const project = JSON.parse(reader.result);
  loadProjectData(project);
  localStorage.setItem("hasOpenedBefore", "true");
};

reader.readAsText(file);
});

openProjectButton.addEventListener("click", () => {
  loadProjectInput.click();
});

editorToggleButton.addEventListener("click", () => {
  editorMode = !editorMode;

  document.body.classList.toggle("editor-mode", editorMode);
  document.body.classList.toggle("presentation-mode", !editorMode);

  updateModeButtons();

  if (view3DMode) {
    rebuildGraph3D(false);
  }
});

function updateZDisplay() {
  document.querySelectorAll(".node").forEach(node => {
    const nodeZ = Number(node.dataset.z || 0);

    const scale = Math.max(
      0.5,
      Math.min(1.8, 1 + nodeZ * 0.08)
    );

    node.style.transform = `scale(${scale})`;
    node.style.transformOrigin = "center center";

    node.title = "Z: " + nodeZ.toFixed(2);
    node.dataset.zLabel = "Z: " + nodeZ.toFixed(1);
  });
}

document.addEventListener("mousemove", (e) => {
  if (!zAssignMode) return;
  if (selectedNodes.length === 0) return;

  if (lastZMouseY === null) {
    lastZMouseY = e.clientY;
    return;
  }

  const deltaY = lastZMouseY - e.clientY;

  selectedNodes.forEach(node => {
    const currentZ = Number(node.dataset.z || 0);
    node.dataset.z = currentZ + deltaY * 0.1;
  });

  lastZMouseY = e.clientY;

  updateZDisplay();

  console.log(
    "Z actual:",
    selectedNodes.map(n => n.dataset.z)
  );
});

document.addEventListener("keydown", (e) => {
  if (e.shiftKey && e.code === "KeyZ") {
    e.preventDefault();
    zAssignMode = true;
    lastZMouseY = null;
  }
});

document.addEventListener("keyup", (e) => {
  if (e.code === "KeyZ") {
    zAssignMode = false;
    lastZMouseY = null;
  }
});

view3DButton.addEventListener("click", () => {
  view3DMode = !view3DMode;

  const container = document.getElementById("threeContainer");

  if (view3DMode) {
    container.style.display = "block";
    container.style.pointerEvents = "auto";

    if (!threeInitialized) {
      initialize3D();
      threeInitialized = true;
    } else {
      rebuildGraph3D();
    }
  } else {
    container.style.display = "none";
    container.style.pointerEvents = "none";
   
  }

  updateModeButtons();
});
let threeInitialized = false;
let last3DTarget = { x: 0, y: 0, z: 0 };
let animation3DId = null;

function initialize3D() {
  const container = document.getElementById("threeContainer");

  if (!container) {
    console.error("No existe #threeContainer");
    return;
  }

  container.innerHTML = "";

  const THREE = window.THREE;
  const OrbitControls = window.OrbitControls;

  scene = new THREE.Scene();
  scene.background = new THREE.Color(
  editorMode ? 0xececec : 0xffffff
);

 const width = window.innerWidth;
const height = window.innerHeight;

camera = new THREE.PerspectiveCamera(
  75,
  window.innerWidth / window.innerHeight,
  0.1,
  10000
);

camera.position.set(0, 0, 600);

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });

  renderer.setSize(window.innerWidth, window.innerHeight);
  container.appendChild(renderer.domElement);

  controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  buildGraph3D();
animate3D();
}
function buildGraph3D() {
  const THREE = window.THREE;
  const nodes = Array.from(document.querySelectorAll(".node"));

  if (nodes.length === 0) return;

  const rawPositions = nodes.map(node => ({
    node,
    x: node.offsetLeft,
    y: node.offsetTop,
    z: Number(node.dataset.z || 0)
  }));

  const minX = Math.min(...rawPositions.map(p => p.x));
  const maxX = Math.max(...rawPositions.map(p => p.x));
  const minY = Math.min(...rawPositions.map(p => p.y));
  const maxY = Math.max(...rawPositions.map(p => p.y));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const scaleFactor = 0.6;
  const nodeMeshes = new Map();

  rawPositions.forEach(p => {
    const x = (p.x - centerX) * scaleFactor;
    const y = -(p.y - centerY) * scaleFactor;
    const z = p.z * 50;

    const sphereRadius = 42;
const geometry = new THREE.SphereGeometry(sphereRadius, 32, 32);

    const material = new THREE.MeshBasicMaterial({
      color: 0x8f4fff,
      transparent: true,
      opacity: 0.28,
      wireframe: true
    });

    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(x, y, z);
    sphere.visible = editorMode;
scene.add(sphere);

    const label = createPreviewTextSprite(p.node.textContent);
    label.position.set(x, y, z + 1);
    scene.add(label);

   nodeMeshes.set(p.node, {
  position: new THREE.Vector3(x, y, z),
  text: p.node.textContent
});
  });

  connections.forEach(connection => {
  const a = nodeMeshes.get(connection.a);
  const b = nodeMeshes.get(connection.b);

  if (!a || !b) return;

  const startPadding = editorMode ? 44 : getLabelConnectionPadding(a.text);
  const endPadding = editorMode ? 44 : getLabelConnectionPadding(b.text);

  const start = getConnectionPointOutsideLabel(a.position, b.position, startPadding);
  const end = getConnectionPointOutsideLabel(b.position, a.position, endPadding);

  const tube = create3DConnectionTube(start, end, 0.8);

  tube.name = "Conexion_3D";
  tube.userData = {
    type: "connection",
    fromText: connection.a.textContent.trim(),
    toText: connection.b.textContent.trim()
  };

  scene.add(tube);
});
}
function getLabelConnectionPadding(text) {
  const cleanText = String(text || "Nodo").trim();

  // Mientras más largo el texto, más espacio necesita.
  // Pero queda mucho más cerca que el padding anterior de 58.
  return Math.max(24, Math.min(44, cleanText.length * 4.2));
}

function getConnectionPointOutsideLabel(from, to, padding = 28) {
  const THREE = window.THREE;

  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();

  if (length === 0) return from.clone();

  direction.normalize();

  return from.clone().add(direction.multiplyScalar(padding));
}
function createPreviewTextSprite(text) {
  const THREE = window.THREE;

  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 128;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#000000";
  ctx.font = "bold 72px Arial";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(text || "Nodo"), canvas.width / 2, canvas.height / 2);

  const texture = new THREE.CanvasTexture(canvas);

  const material = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false
  });

  const sprite = new THREE.Sprite(material);
  sprite.scale.set(120, 34, 1);

  return sprite;
}
function create3DConnectionTube(start, end, radius = 1) {
  const THREE = window.THREE;

  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  const geometry = new THREE.CylinderGeometry(radius, radius, length, 8);

  const material = new THREE.MeshBasicMaterial({
    color: 0x111111
  });

  const cylinder = new THREE.Mesh(geometry, material);

  cylinder.position.copy(start).add(end).multiplyScalar(0.5);

  cylinder.quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  return cylinder;
}
function get3DEdgePoint(from, to, centerX, centerY, scaleFactor) {
  const fromX = (from.offsetLeft - centerX) * scaleFactor;
  const fromY = -(from.offsetTop - centerY) * scaleFactor;
  const fromZ = Number(from.dataset.z || 0) * 50;

  const toX = (to.offsetLeft - centerX) * scaleFactor;
  const toY = -(to.offsetTop - centerY) * scaleFactor;
  const toZ = Number(to.dataset.z || 0) * 50;

  const dx = toX - fromX;
  const dy = toY - fromY;

  const nodeWidth = from.offsetWidth * scaleFactor;
  const nodeHeight = from.offsetHeight * scaleFactor;

  let x = fromX;
  let y = fromY;

  if (Math.abs(dx) > Math.abs(dy)) {
    x += dx > 0 ? nodeWidth / 2 : -nodeWidth / 2;
  } else {
    y += dy > 0 ? nodeHeight / 2 : -nodeHeight / 2;
  }

  return new THREE.Vector3(x, y, fromZ);
}

function rebuildGraph3D(shouldFitCamera = false) {
  if (!scene) return;

  while (scene.children.length > 0) {
    scene.remove(scene.children[0]);
  }

  buildGraph3D();

  if (shouldFitCamera) {
    fitPreviewCameraToGraph();
  }
}
function animate3D() {

  animation3DId =
    requestAnimationFrame(animate3D);

  if (controls) {
    controls.update();
  }

  if (
    renderer &&
    scene &&
    camera
  ) {
    renderer.render(
      scene,
      camera
    );
  }
}
function updateModeButtons() {
  editorToggleButton.textContent =
    editorMode ? "Editor ON" : "Editor OFF";

  view3DButton.textContent =
    view3DMode ? "2D" : "3D";

  editorToggleButton.classList.toggle("active-mode", editorMode);
  editorToggleButton.classList.toggle("inactive-mode", !editorMode);

  view3DButton.classList.toggle("active-mode", view3DMode);
  view3DButton.classList.toggle("inactive-mode", !view3DMode);
}
function refresh3DIfActive() {
  if (
    view3DMode &&
    typeof rebuildGraph3D === "function"
  ) {
    rebuildGraph3D();
  }
}
updateModeButtons();

const helpPanel = document.getElementById("helpPanel");
const helpContent = document.getElementById("helpContent");
const collapseHelpButton = document.getElementById("collapseHelpButton");

let helpCollapsed = false;

collapseHelpButton.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  helpCollapsed = !helpCollapsed;

  helpContent.style.display = helpCollapsed ? "none" : "block";
  collapseHelpButton.textContent = helpCollapsed ? "+" : "-";
});


function exportOBJ() {
  loadExportFont((font) => {
    const exporter = new window.OBJExporter();
    const exportScene = buildOBJTextOnlyScene(font);

    exportScene.updateMatrixWorld(true);

    const objText = exporter.parse(exportScene);
    const blob = new Blob([objText], { type: "text/plain" });
    downloadBlob(blob, "mapa-nodos.obj");
    showToast("OBJ exportado correctamente");
  });
}
function buildElegantExportScene(font) {
  const THREE = window.THREE;
  const exportScene = new THREE.Scene();

  const exportRoot = new THREE.Group();
  exportScene.add(exportRoot);

  const rawNodes = [];

  document.querySelectorAll(".node").forEach(node => {
    const x = parseFloat(node.style.left) || node.offsetLeft || 0;
    const y = parseFloat(node.style.top) || node.offsetTop || 0;
    const z = parseFloat(node.dataset.z || 0);

    rawNodes.push({
      node,
      label: node.textContent.trim() || "Nodo",
      raw: new THREE.Vector3(x, -y, z * 80)
    });
  });

  const center = new THREE.Vector3();

  rawNodes.forEach(item => center.add(item.raw));
  center.divideScalar(Math.max(rawNodes.length, 1));

  const exportScale = 0.08;

  const nodePositions = new Map();
  const nodeSizes = new Map();

  const textMaterial = new THREE.MeshBasicMaterial({
    color: 0x111111,
    side: THREE.DoubleSide
  });

  const plateMaterial = new THREE.MeshBasicMaterial({
    color: 0xb86cff,
    side: THREE.DoubleSide
  });

  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x111111
  });

  rawNodes.forEach(item => {
    const position = item.raw.clone().sub(center).multiplyScalar(exportScale);

    nodePositions.set(item.node, position);

    const textGeometry = new window.TextGeometry(item.label, {
      font,
      size: 3.2,
      depth: 0.25,
      curveSegments: 4,
      bevelEnabled: false
    });

    textGeometry.computeBoundingBox();

    const box = textGeometry.boundingBox;
    const textWidth = box.max.x - box.min.x;
    const textHeight = box.max.y - box.min.y;

    textGeometry.translate(
      -box.min.x - textWidth / 2,
      -box.min.y - textHeight / 2,
      0.35
    );

    const plateWidth = textWidth + 2.8;
    const plateHeight = textHeight + 1.8;

    nodeSizes.set(item.node, {
      width: plateWidth,
      height: plateHeight
    });

    const plateGeometry = new THREE.BoxGeometry(
      plateWidth,
      plateHeight,
      0.35
    );

    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    const group = new THREE.Group();
    group.position.copy(position);

    group.add(plate);
    group.add(textMesh);

    exportRoot.add(group);
  });

  connections.forEach(connection => {
    const a = nodePositions.get(connection.a);
    const b = nodePositions.get(connection.b);

    if (!a || !b) return;

    const aSize = nodeSizes.get(connection.a);
    const bSize = nodeSizes.get(connection.b);

    const start = getExportConnectionPoint(a, b, aSize);
    const end = getExportConnectionPoint(b, a, bSize);

    const tube = createExportConnectionTube(start, end, 0.08, lineMaterial);
    tube.position.z -= 0.3;

    exportRoot.add(tube);
  });

  return exportScene;
}
function buildOBJTextOnlyScene(font) {
  const THREE = window.THREE;
  const exportScene = new THREE.Scene();

  const nodes = Array.from(document.querySelectorAll(".node"));
  if (nodes.length === 0) return exportScene;

  const rawPositions = nodes.map(node => ({
    node,
    x: node.offsetLeft,
    y: node.offsetTop,
    z: Number(node.dataset.z || 0)
  }));

  const minX = Math.min(...rawPositions.map(p => p.x));
  const maxX = Math.max(...rawPositions.map(p => p.x));
  const minY = Math.min(...rawPositions.map(p => p.y));
  const maxY = Math.max(...rawPositions.map(p => p.y));

  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  // scaleFactor fijo: 1px de pantalla = 1 unidad 3D
  // El texto se fija a ~18% del tamaño de nodo típico (100px)
  const scaleFactor = 1;
  const textSize = 18;
  const tubeRadius = 1.2;

  const nodePositions = new Map();
  const nodeTextWidths = new Map();

  const textMaterial = new THREE.MeshBasicMaterial({
    color: 0x111111,
    side: THREE.DoubleSide
  });

  const lineMaterial = new THREE.MeshBasicMaterial({
    color: 0x111111
  });

  rawPositions.forEach(p => {
    const x = (p.x - centerX) * scaleFactor;
    const y = -(p.y - centerY) * scaleFactor;
    const z = p.z * 80;

    const position = new THREE.Vector3(x, y, z);
    nodePositions.set(p.node, position);

    const text = p.node.textContent.trim() || "Nodo";

    const geometry = new window.TextGeometry(text, {
      font,
      size: textSize,
      depth: textSize * 0.15,
      curveSegments: 5,
      bevelEnabled: false
    });

    geometry.computeBoundingBox();

    const box = geometry.boundingBox;
    const width = box.max.x - box.min.x;
    const height = box.max.y - box.min.y;

    geometry.translate(
      -box.min.x - width / 2,
      -box.min.y - height / 2,
      0
    );

    nodeTextWidths.set(p.node, width);

    const mesh = new THREE.Mesh(geometry, textMaterial);
    mesh.position.copy(position);

    exportScene.add(mesh);
  });

  connections.forEach(connection => {
    const a = nodePositions.get(connection.a);
    const b = nodePositions.get(connection.b);

    if (!a || !b) return;

    const aPadding = Math.max(textSize * 2, (nodeTextWidths.get(connection.a) || textSize * 4) * 0.6);
    const bPadding = Math.max(textSize * 2, (nodeTextWidths.get(connection.b) || textSize * 4) * 0.6);

    const start = getConnectionPointOutsideLabel(a, b, aPadding);
    const end = getConnectionPointOutsideLabel(b, a, bPadding);

    const tube = createExportConnectionTube(start, end, tubeRadius, lineMaterial);
    tube.position.z -= 2;

    exportScene.add(tube);
  });

  return exportScene;
}
function getExportConnectionPoint(from, to, size) {
  const THREE = window.THREE;

  const dir = new THREE.Vector3().subVectors(to, from);
  if (dir.length() === 0) return from.clone();

  dir.normalize();

  const padding = Math.max(size.width, size.height) * 0.55;

  return from.clone().add(dir.multiplyScalar(padding));
}
function createExportConnectionTube(start, end, radius, material) {
  const THREE = window.THREE;

  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();

  if (length === 0) return new THREE.Group();

const geometry = new THREE.CylinderGeometry(radius, radius, length, 12);

  const tube = new THREE.Mesh(geometry, material);

  const midpoint = new THREE.Vector3()
    .addVectors(start, end)
    .multiplyScalar(0.5);

  tube.position.copy(midpoint);

  const quaternion = new THREE.Quaternion();
  quaternion.setFromUnitVectors(
    new THREE.Vector3(0, 1, 0),
    direction.clone().normalize()
  );

  tube.quaternion.copy(quaternion);

  return tube;
}
function publishAllFormats() {
  exportOBJ();
}
function showToast(message) {
  let toast = document.getElementById("appToast");

  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    document.body.appendChild(toast);
  }

  toast.textContent = message;
  toast.classList.add("visible");

  clearTimeout(showToast.timeout);
  showToast.timeout = setTimeout(() => {
    toast.classList.remove("visible");
  }, 1800);
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function fitPreviewCameraToGraph() {
  const THREE = window.THREE;

  if (!scene || !camera || !controls) return;

  const box = new THREE.Box3().setFromObject(scene);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();

  box.getSize(size);
  box.getCenter(center);

  const maxSize = Math.max(size.x, size.y, size.z);
  const distance = Math.max(maxSize * 0.9, 120);

  camera.position.set(center.x, center.y, distance);
  camera.lookAt(center);

  controls.target.copy(center);
  controls.update();
}

let exportFont = null;

function loadExportFont(callback) {
  if (exportFont) {
    callback(exportFont);
    return;
  }

  const loader = new window.FontLoader();

  loader.load(
    "https://cdn.jsdelivr.net/npm/three@0.167.1/examples/fonts/helvetiker_bold.typeface.json",
    (font) => {
      exportFont = font;
      callback(font);
    }
  );
}

function create3DTextObject(text, font) {
  const THREE = window.THREE;

  const cleanText = String(text || "Nodo").trim();

  const geometry = new window.TextGeometry(cleanText, {
    font: font,
    size: 12,
    depth: 0.8,
    curveSegments: 4,
    bevelEnabled: false
  });

  geometry.computeBoundingBox();

  const box = geometry.boundingBox;
  const width = box.max.x - box.min.x;
  const height = box.max.y - box.min.y;

  geometry.translate(-width / 2, -height / 2, 0);

  const material = new THREE.MeshBasicMaterial({
    color: 0x000000
  });

  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = "Texto_3D";

  return mesh;
}
window.addEventListener("DOMContentLoaded", () => {
  const hasOpenedBefore = localStorage.getItem("hasOpenedBefore");

  if (!hasOpenedBefore) {

  fetch("./sample-project.json")
    .then(response => response.json())
    .then(project => {

      loadProjectData(project);

      currentFileLabel.textContent =
        "📄 Acontecimiento (ejemplo)";

      localStorage.setItem(
        "hasOpenedBefore",
        "true"
      );
    });

}
})
const welcomeScreen = document.getElementById("welcomeScreen");
const startSampleButton = document.getElementById("startSample");
const startBlankButton = document.getElementById("startBlank");

function hideWelcome() {
  if (welcomeScreen) {
    welcomeScreen.classList.add("hidden");
  }
}

function saveToLocalAutosave() {
  const project = {
    nodes: [...document.querySelectorAll(".node")].map(node => ({
      id: node.dataset.id,
      text: node.textContent,
      x: parseFloat(node.style.left),
      y: parseFloat(node.style.top),
      z: parseFloat(node.dataset.z || 0)
    })),
    connections: connections.map(connection => ({
      a: connection.a.dataset.id,
      b: connection.b.dataset.id
    }))
  };

  localStorage.setItem("autosaveProject", JSON.stringify(project));
}

function loadAutosaveIfExists() {
  const saved = localStorage.getItem("autosaveProject");
  if (!saved) return false;

  const project = JSON.parse(saved);
  loadProjectData(project);
  currentFileLabel.textContent = "Autoguardado local";
  return true;
}

startSampleButton?.addEventListener("click", () => {
  fetch("./sample-project.json")
    .then(response => response.json())
    .then(project => {
      loadProjectData(project);
      currentFileLabel.textContent = "Mapa de ejemplo";
      localStorage.setItem("hasOpenedBefore", "true");
      saveToLocalAutosave();
      hideWelcome();
    });
});

startBlankButton?.addEventListener("click", () => {
  localStorage.setItem("hasOpenedBefore", "true");
  hideWelcome();
});

window.addEventListener("DOMContentLoaded", () => {
  const hasOpenedBefore = localStorage.getItem("hasOpenedBefore");

  if (hasOpenedBefore && loadAutosaveIfExists()) {
    hideWelcome();
  }
});

setInterval(() => {
  const nodes = document.querySelectorAll(".node");

  if (nodes.length > 0) {
    saveToLocalAutosave();
  }
}, 5000);
