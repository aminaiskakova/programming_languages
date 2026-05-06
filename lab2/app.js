// ===== Хранение паролей =====
const STORAGE_KEY = "passwords";

// ===== DOM‑элементы =====
const urlInput = document.getElementById("urlInput");
const loginInput = document.getElementById("loginInput");
const passwordInput = document.getElementById("passwordInput");
const saveBtn = document.getElementById("saveBtn");
const useGeneratedBtn = document.getElementById("useGeneratedBtn");

const lengthInput = document.getElementById("lengthInput");
const lowerCheckbox = document.getElementById("lowerCheckbox");
const upperCheckbox = document.getElementById("upperCheckbox");
const numbersCheckbox = document.getElementById("numbersCheckbox");
const specialCheckbox = document.getElementById("specialCheckbox");
const generateBtn = document.getElementById("generateBtn");
const generatedPassword = document.getElementById("generatedPassword");

const passwordListUL = document.getElementById("passwordList");
const copyPopup = document.getElementById("copyPopup");

let currentEditId = null;

// ===== Вспомогательные функции =====
function loadPasswords() {
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? JSON.parse(raw) : [];
}

function savePasswords(list) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

function findPasswordById(id) {
  return loadPasswords().find(p => p.id === id);
}

// ===== Копирование в буфер обмена =====
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(() => {
    copyPopup.style.opacity = 1;
    setTimeout(() => {
      copyPopup.style.opacity = 0;
    }, 1500);
  }).catch(err => {
    console.error("Не удалось скопировать:", err);
    alert("Не удалось скопировать (браузер может не разрешать это)");
  });
}

// ===== Генератор паролей =====
function generatePassword() {
  const length = parseInt(lengthInput.value, 10);
  const useLower = lowerCheckbox.checked;   // строчные буквы
  const useUpper = upperCheckbox.checked;   // ЗАГЛАВНЫЕ
  const useNumbers = numbersCheckbox.checked;
  const useSpecial = specialCheckbox.checked;

  let chars = "";
  if (useLower) chars += "abcdefghijklmnopqrstuvwxyz";
  if (useUpper) chars += "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (useNumbers) chars += "0123456789";
  if (useSpecial) chars += "!@#$%^&*()-_=+[]{}|;:,.<>?";

  if (chars.length === 0) {
    alert("Выберите хотя бы один тип символов.");
    return "";
  }

  let pass = "";
  for (let i = 0; i < length; i++) {
    pass += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return pass;
}

generateBtn.addEventListener("click", () => {
  const pass = generatePassword();
  if (pass) generatedPassword.value = pass;
});

useGeneratedBtn.addEventListener("click", () => {
  if (generatedPassword.value) {
    passwordInput.value = generatedPassword.value;
  }
});

// ===== Отображение списка паролей =====
function renderPasswords() {
  const list = loadPasswords();
  passwordListUL.innerHTML = "";

  if (list.length === 0) {
    passwordListUL.innerHTML = "<li><p>Нет сохранённых паролей.</p></li>";
    return;
  }

  list.forEach((p) => {
    const li = document.createElement("li");
    li.className = "password-item";
    li.innerHTML = `
      <p><strong>URL:</strong> 
        <a href="${p.url}" target="_blank" rel="noopener">${p.url || p.service}</a>
      </p>
      <p><strong>Логин:</strong> ${p.login}</p>
      <p>
        <strong>Пароль:</strong> 
        <span id="pass_${p.id}">${"*".repeat(p.password.length)}</span>
        <button class="btn btn-secondary showBtn" data-id="${p.id}">Просмотреть</button>
        <button class="btn btn-secondary copyBtn" data-id="${p.id}" data-field="password">Копировать</button>
      </p>
      <p>
        <button class="btn btn-secondary editBtn" data-id="${p.id}">Редактировать</button>
        <button class="btn btn-secondary delBtn" data-id="${p.id}">Удалить</button>
      </p>
    `;
    passwordListUL.appendChild(li);
  });

  // кнопка "Редактировать"
  document.querySelectorAll(".editBtn").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.dataset.id;
      const p = findPasswordById(id);
      if (p) {
        urlInput.value = p.url || p.service || "";
        loginInput.value = p.login;
        passwordInput.value = p.password;
        currentEditId = id;
        saveBtn.textContent = "Сохранить изменения";
      }
    });
  });

  // кнопка "Удалить"
  document.querySelectorAll(".delBtn").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.dataset.id;
      const list = loadPasswords().filter(p => p.id !== id);
      savePasswords(list);
      renderPasswords();
    });
  });

  // кнопка "Копировать"
  document.querySelectorAll(".copyBtn").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.dataset.id;
      const p = findPasswordById(id);
      if (p) copyToClipboard(p.password);
    });
  });

  // кнопка "Просмотреть/Скрыть"
  document.querySelectorAll(".showBtn").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.dataset.id;
      const span = document.getElementById(`pass_${id}`);
      const p = findPasswordById(id);
      if (!p) return;

      if (span.textContent.startsWith("*")) {
        // показать пароль
        span.textContent = p.password;
        e.target.textContent = "Скрыть";
      } else {
        // скрыть пароль
        span.textContent = "*".repeat(p.password.length);
        e.target.textContent = "Просмотреть";
      }
    });
  });
}

// ===== Сохранение/редактирование пароля =====
saveBtn.addEventListener("click", () => {
  const url = urlInput.value.trim();
  const login = loginInput.value.trim();
  const password = passwordInput.value.trim();

  if (!url || !login || !password) {
    alert("Заполните все поля.");
    return;
  }

  const list = loadPasswords();
  const entry = {
    id: currentEditId || `pass_${Date.now()}`,
    url,
    login,
    password
  };

  if (currentEditId) {
    const idx = list.findIndex(p => p.id === currentEditId);
    if (idx !== -1) list[idx] = entry;
  } else {
    list.push(entry);
  }

  savePasswords(list);
  renderPasswords();

  // сброс формы
  urlInput.value = "";
  loginInput.value = "";
  passwordInput.value = "";
  currentEditId = null;
  saveBtn.textContent = "Сохранить";
});

// ===== Инициализация PWA — регистрируем сервис‑воркер =====
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("/service-worker.js")
      .then(reg => console.log("Service Worker registered", reg))
      .catch(err => console.log("Service Worker registration failed", err));
  });
}

// ===== Загрузка при запуске =====
renderPasswords();