const URL_BACKEND = "https://script.google.com/macros/s/AKfycbxy3rSnf2JcxCrFvzxxr3aX_Uh-jTMqKb3sl5Q5YW4MrJXp7q6eYJlOIeT_3-0cBxfJ/exec";
const SESSION_TOKEN_KEY = "smb_session_token";

// --- TRADUCTOR GOOGLE ---
function googleTranslateElementInit() {
  new google.translate.TranslateElement({
    pageLanguage: 'es', 
    includedLanguages: 'es,en', 
    layout: google.translate.TranslateElement.InlineLayout.SIMPLE,
    autoDisplay: false
  }, 'google_translate_element');
}

// --- CIERRE DE SESIÓN ---
window.logout = async function() {
  console.log("Cerrando sesión...");
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  
  if (token) {
    try {
      // Notificamos al backend para invalidar el token
      await fetch(URL_BACKEND, {
        method: "POST",
        body: JSON.stringify({
          accion: "cerrarSesion",
          token: token
        })
      });
    } catch (error) {
      console.error("Error al notificar cierre de sesión al servidor:", error);
    }
  }

  localStorage.removeItem('usuarioBateria');
  localStorage.removeItem('perfilBateria');
  sessionStorage.clear();

  document.querySelectorAll('.page').forEach(p => {
    p.classList.remove('active');
    p.style.display = '';
    p.removeAttribute('data-restringido');
  });

  document.getElementById('mainContent').classList.remove('d-flex');
  document.getElementById('mainContent').classList.add('d-none');
  document.getElementById('loginScreen').classList.remove('d-none');

  const user = document.getElementById('userInput');
  const pass = document.getElementById('passInput');
  const status = document.getElementById('loginStatus');

  if (user) user.value = '';
  if (pass) pass.value = '';
  if (status) status.innerHTML = '';

  const chat = document.getElementById('gemini-chat-container');
  if (chat) chat.style.display = 'none';

  const chatBtn = document.getElementById('chat-toggle-btn');
  if (chatBtn) chatBtn.classList.add('d-none');

  // Limpiar URL sin recargar
  window.history.replaceState(null, null, window.location.href.split('#')[0]);
};

// --- LÓGICA DE ARRANQUE SEGURA ---
window.addEventListener('load', async function() {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);

  if (!token) {
    logout();
    return;
  }

  try {
    const respuesta = await fetch(URL_BACKEND, {
      method: "POST",
      body: JSON.stringify({
        accion: "validarSesion",
        token: token
      })
    });

    const res = await respuesta.json();

    if (res && res.valido) {
      localStorage.setItem('usuarioBateria', res.email);
      aplicarPermisos(res.perfil);

      document.getElementById('loginScreen').classList.add('d-none');
      document.getElementById('mainContent').classList.remove('d-none');
      document.getElementById('mainContent').classList.add('d-flex');

      const chatBtn = document.getElementById('chat-toggle-btn');
      if (chatBtn) chatBtn.classList.remove('d-none');

      inicializarProgresoYReveals();
    } else {
      logout();
    }
  } catch (err) {
    console.error("Error validando sesión:", err);
    logout();
  }
});

// --- VALIDACIÓN DE ACCESO SEGURA ---
async function validarEntrada() {
  var userInput = document.getElementById('userInput').value.trim();
  var passInput = document.getElementById('passInput').value.trim();
  var status = document.getElementById('loginStatus');

  if (!userInput || !passInput) {
    status.innerHTML = '<div class="alert alert-warning">Completa ambos campos.</div>';
    return;
  }

  status.innerHTML = '<div class="spinner-border spinner-border-sm text-primary"></div> Verificando...';

  try {
    const respuesta = await fetch(URL_BACKEND, {
        method: "POST",
        mode: "cors", // Cambia a 'cors' explícitamente
        headers: {
          "Content-Type": "text/plain" // Google Apps Script prefiere esto a veces
        },
        body: JSON.stringify({
          accion: "login",
          usuario: userInput,
          pass: passInput
        })
      });

    const res = await respuesta.json();
    console.log("Respuesta servidor:", res);

    if (res && res.autorizado === true) {
      const modalEl = document.getElementById('loginModal');
      if (modalEl) {
        const modalInstance = bootstrap.Modal.getOrCreateInstance(modalEl);
        modalInstance.hide();
      }

      if (res.token) sessionStorage.setItem(SESSION_TOKEN_KEY, res.token);
      if (res.email) localStorage.setItem('usuarioBateria', res.email);

      aplicarPermisos(res.perfil || "basico");

      document.getElementById('loginScreen').classList.add('d-none');
      const main = document.getElementById('mainContent');
      main.classList.remove('d-none');
      main.classList.add('d-flex');

      const chatBtn = document.getElementById('chat-toggle-btn');
      if (chatBtn) chatBtn.classList.remove('d-none');

      status.innerHTML = '';
      inicializarProgresoYReveals();
    } else {
      status.innerHTML = '<div class="alert alert-danger mt-2">' + (res.error || "Acceso denegado") + '</div>';
    }
  } catch (error) {
    console.error("Error servidor:", error);
    status.innerHTML = '<div class="alert alert-danger">Error de comunicación con el servidor.</div>';
  }
}

// --- GESTIÓN DE USUARIOS (PANEL ADMIN) ---
async function crearUsuarioDesdePanel() {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) return;

  const usuarioInput = document.getElementById('nuevoUsuario');
  const correoInput = document.getElementById('nuevoCorreo');
  const passInput = document.getElementById('nuevoPass');
  const perfilInput = document.getElementById('nuevoPerfil');

  if (!usuarioInput || !correoInput || !passInput || !perfilInput) {
    console.error("Algún input no existe en el DOM");
    return;
  }

  let mensaje = document.getElementById('mensajeCrearUsuario');
  if (!mensaje) {
    mensaje = document.createElement("div");
    mensaje.id = "mensajeCrearUsuario";
    mensaje.className = "mt-4 small";
    const cardBody = usuarioInput.closest(".card-body");
    if (cardBody) cardBody.appendChild(mensaje);
  }

  const usuario = usuarioInput.value.trim();
  const correo = correoInput.value.trim().toLowerCase();
  const pass = passInput.value.trim();
  const perfil = perfilInput.value;

  if (!usuario || !correo || !pass) {
    mensaje.innerHTML = '<div class="alert alert-warning">Completa todos los campos.</div>';
    return;
  }

  mensaje.innerHTML = '<div class="spinner-border spinner-border-sm text-dark"></div> Creando...';

  try {
    const respuesta = await fetch(URL_BACKEND, {
      method: "POST",
      body: JSON.stringify({
        accion: "crearUsuario",
        token: token,
        usuario: usuario,
        correo: correo,
        pass: pass,
        perfil: perfil
      })
    });

    const res = await respuesta.json();

    if (res.ok) {
      mensaje.innerHTML = '<div class="alert alert-success">' + res.mensaje + '</div>';
      usuarioInput.value = "";
      correoInput.value = "";
      passInput.value = "";
    } else {
      mensaje.innerHTML = '<div class="alert alert-danger">' + res.error + '</div>';
    }
  } catch (err) {
    console.error(err);
    mensaje.innerHTML = '<div class="alert alert-danger">Error de servidor.</div>';
  }
}

// --- FUNCIONES VISUALES Y COMPONENTES ---

function toggleChat() {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) {
    logout();
    return;
  }
  const chat = document.getElementById('gemini-chat-container');
  if (!chat) return;
  if (chat.style.display === 'none' || chat.style.display === '') {
    chat.style.display = 'flex';
    const input = document.getElementById('chat-input');
    if (input) input.focus();
  } else {
    chat.style.display = 'none';
  }
}

function toggleTheme() {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) return;
  const isDark = document.body.classList.toggle('dark');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  actualizarIcono(isDark);
}

function actualizarIcono(isDark) {
  const icon = document.querySelector('.btn-theme-toggle i');
  if (!icon) return;
  if (isDark) {
    icon.classList.replace('bi-moon-stars-fill', 'bi-sun-fill');
  } else {
    icon.classList.replace('bi-sun-fill', 'bi-moon-stars-fill');
  }
}

function togglePassword() {
  const passInput = document.getElementById('passInput');
  const icon = document.getElementById('toggleIcon');
  if (passInput.type === 'password') {
    passInput.type = 'text';
    icon.classList.replace('bi-eye', 'bi-eye-slash');
  } else {
    passInput.type = 'password';
    icon.classList.replace('bi-eye-slash', 'bi-eye');
  }
}

function toggleNuevoPass() {
  const passInput = document.getElementById('nuevoPass');
  const icon = document.getElementById('toggleNuevoPassIcon');
  if (!passInput) return;
  if (passInput.type === 'password') {
    passInput.type = 'text';
    icon.classList.replace('bi-eye', 'bi-eye-slash');
  } else {
    passInput.type = 'password';
    icon.classList.replace('bi-eye-slash', 'bi-eye');
  }
}

// --- BUSCADOR ---
function searchContent() {
  const token = sessionStorage.getItem(SESSION_TOKEN_KEY);
  if (!token) return;

  var query = document.getElementById('searchInput').value.toLowerCase().trim();
  var dropdown = document.getElementById('searchDropdown');

  if (!dropdown) return;
  dropdown.innerHTML = '';

  if (query.length < 2) {
    dropdown.classList.add('d-none');
    clearHighlights();
    return;
  }

  var pages = document.querySelectorAll('.page');
  pages.forEach(function(page) {
    if (page.innerText.toLowerCase().includes(query)) {
      var titleEl = page.querySelector('h4, h2, h1');
      var title = titleEl ? titleEl.innerText : page.id;
      var item = document.createElement('div');
      item.className = 'list-group-item list-group-item-action small cursor-pointer';
      item.innerHTML = `<i class="bi bi-search me-2"></i> ${title}`;
      item.onclick = function() {
        showPage(page.id);
        dropdown.classList.add('d-none');
        setTimeout(() => { highlight(query); }, 50);
      };
      dropdown.appendChild(item);
    }
  });

  dropdown.classList.remove('d-none');
  window.scrollTo(0, 0);
}

function highlight(query) {
  if (!query) return;
  clearHighlights();
  const activePage = document.querySelector('.page.active');
  if (!activePage) return;
  const regex = new RegExp(`(${query})`, 'gi');
  const walk = document.createTreeWalker(activePage, NodeFilter.SHOW_TEXT, null, false);
  let node;
  const nodesToProcess = [];
  while (node = walk.nextNode()) {
    if (node.nodeValue.toLowerCase().includes(query)) {
      nodesToProcess.push(node);
    }
  }
  nodesToProcess.forEach(node => {
    const span = document.createElement('span');
    span.className = 'highlight-wrapper';
    span.innerHTML = node.nodeValue.replace(regex, '<mark class="custom-highlight">$1</mark>');
    node.parentNode.replaceChild(span, node);
  });
}

function clearHighlights() {
  const wrappers = document.querySelectorAll('.highlight-wrapper');
  wrappers.forEach(wrapper => {
    wrapper.replaceWith(wrapper.textContent);
  });
}

// --- CONTROL DE PERMISOS Y NAVEGACIÓN ---
function aplicarPermisos(perfil) {
  perfil = (perfil || "basico").toLowerCase().trim();
  localStorage.setItem('perfilBateria', perfil);

  const restricciones = {
    'basico': ['impro' , 'material' , 'admin'],
    'plus': ['admin'],
    'premium': ['admin'],
    'admin': []
  };

  const seccionesAOcultar = restricciones[perfil] || restricciones['basico'];
  const navLinks = document.querySelectorAll('.nav-link');

  navLinks.forEach(link => {
    link.parentElement.classList.remove('d-none');
    const onclickAttr = link.getAttribute('onclick') || "";
    seccionesAOcultar.forEach(id => {
      if (onclickAttr.includes(`'${id}'`)) {
        link.parentElement.classList.add('d-none');
      }
    });
  });

  const todasLasPaginas = document.querySelectorAll('.page');
  todasLasPaginas.forEach(p => {
    if (seccionesAOcultar.includes(p.id)) {
      p.style.display = 'none';
      p.classList.remove('active');
      p.setAttribute('data-restringido', 'true');
    } else {
      p.style.display = '';
      p.removeAttribute('data-restringido');
    }
  });

  showPage('home');
}

function showPage(pageId) {
  const secciones = document.querySelectorAll('.page');
  secciones.forEach(sec => {
    sec.classList.add('d-none'); 
    sec.classList.remove('active');
    
    const elementosAnimados = sec.querySelectorAll('.scroll-animate, .reveal');
    elementosAnimados.forEach(el => {
      el.classList.remove('visible');
      if(el.classList.contains('reveal')) el.classList.remove('active');
    });
  });

  const seccionDestino = document.getElementById(pageId);
  if (seccionDestino) {
    seccionDestino.classList.remove('d-none');
    seccionDestino.classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    setTimeout(() => {
      const elementosParaAnimar = seccionDestino.querySelectorAll('.scroll-animate, .reveal');
      elementosParaAnimar.forEach(el => {
        if (el.classList.contains('scroll-animate')) el.classList.add('visible');
        if (el.classList.contains('reveal')) el.classList.add('active');
      });
    }, 50); 
  }
}

// --- UTILIDADES ---
function adquirirPlan(nombrePlan) {
  let monto = "";
  if (nombrePlan === 'Basico') monto = "$15.000";
  if (nombrePlan === 'Plus') monto = "$30.000";
  if (nombrePlan === 'Premium') monto = "$50.000";

  document.getElementById('modalPlanNombre').innerText = nombrePlan;
  document.getElementById('modalPlanMonto').innerText = monto + " / mes";

  const numeroTelefono = "2964601006";
  const mensajeTexto = `¡Hola Lucas! Acabo de realizar la transferencia para suscribirme al *Plan ${nombrePlan}* (${monto}). Acá te dejo el comprobante para habilitar mi cuenta.`;
  const urlWhatsapp = `https://wa.me/${numeroTelefono}?text=${encodeURIComponent(mensajeTexto)}`;
  
  document.getElementById('btnEnviarWhatsapp').href = urlWhatsapp;

  const pagoModalEl = document.getElementById('pagoModal');
  if (pagoModalEl) {
    const modalInstance = bootstrap.Modal.getOrCreateInstance(pagoModalEl);
    modalInstance.show();
  }
}

function reproducirVideo(idVideo) {
  const iframe = document.getElementById('videoIframe');
  if (!iframe) return;
  iframe.src = "https://www.youtube.com/embed/" + idVideo + "?autoplay=1&rel=0";
  const modalElement = document.getElementById('videoModal');
  if (modalElement) bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function detenerVideo() {
  const iframe = document.getElementById('videoIframe');
  if (iframe) iframe.src = "";
}

function abrirPDF(fileId) {
  const iframe = document.getElementById('pdfViewer');
  const modalElement = document.getElementById('pdfModal');
  if (!iframe || !modalElement) return;
  iframe.src = "https://drive.google.com/file/d/" + fileId + "/preview";
  bootstrap.Modal.getOrCreateInstance(modalElement).show();
}

function cerrarPDF() {
  const iframe = document.getElementById('pdfViewer');
  if (iframe) iframe.src = "";
}

// --- INICIALIZACIONES Y OBSERVERS ---
function inicializarProgresoYReveals() {
  const elementosOcultos = document.querySelectorAll(".reveal");
  const opciones = { 
    root: null, 
    threshold: 0.25, 
    rootMargin: "0px 0px -150px 0px" 
  };

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("active");
      } else {
        entry.target.classList.remove("active");
      }
    });
  }, opciones);

  elementosOcultos.forEach(el => observer.observe(el));

  let progreso = JSON.parse(localStorage.getItem('drumclass_progreso')) || ['paso-1'];
  progreso.forEach(idPaso => {
    const elemento = document.getElementById(idPaso);
    if (elemento) elemento.classList.remove('locked');
  });

  document.querySelectorAll('.unlock-trigger').forEach(trigger => {
    const nuevoTrigger = trigger.cloneNode(true);
    trigger.parentNode.replaceChild(nuevoTrigger, trigger);

    nuevoTrigger.addEventListener('click', function () {
      const proximoID = this.getAttribute('data-next');
      const proximoElemento = document.getElementById(proximoID);

      if (proximoElemento && proximoElemento.classList.contains('locked')) {
        proximoElemento.classList.remove('locked');
        proximoElemento.classList.add('just-unlocked');
        
        if (!progreso.includes(proximoID)) {
          progreso.push(proximoID);
          localStorage.setItem('drumclass_progreso', JSON.stringify(progreso));
        }
      }
    });
  });
}

// Cierres de modales y dropdowns
document.addEventListener('click', function(e) {
  const searchInput = document.getElementById('searchInput');
  const searchDropdown = document.getElementById('searchDropdown');
  if (searchInput && !searchInput.contains(e.target) && searchDropdown && !searchDropdown.contains(e.target)) {
    searchDropdown.classList.add('d-none');
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const modalVideo = document.getElementById('videoModal');
  if (modalVideo) modalVideo.addEventListener('hidden.bs.modal', detenerVideo);

  const modalPDF = document.getElementById('pdfModal');
  if (modalPDF) modalPDF.addEventListener('hidden.bs.modal', cerrarPDF);

  const targetElements = document.querySelectorAll('.card, .card2, .info-box, .instruccion-tecnica, h4, .card-progression');
  
  targetElements.forEach((el, index) => {
    el.classList.add("scroll-animate");
    if (el.classList.contains("card")) {
      let delayClass = 'delay-' + ((index % 3) + 1);
      el.classList.add(delayClass);
    }
  });

  const observerOptions = { root: null, rootMargin: "0px", threshold: 0.15 };
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      } else {
        entry.target.classList.remove("visible");
      }
    });
  }, observerOptions);

  targetElements.forEach(el => observer.observe(el));

  // Rutina secundaria (fallback) para verificar visibilidad
  const verificarVisibilidad = setInterval(() => {
    const mainContent = document.getElementById('mainContent');
    if (mainContent && !mainContent.classList.contains('d-none')) {
      clearInterval(verificarVisibilidad);
      inicializarProgresoYReveals();
    }
  }, 500);

  // Navegación horizontal táctil
  const nav = document.querySelector('.navbar-collapse');
  if(nav) {
    let isDown = false, startX, scrollLeft;
    nav.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - nav.offsetLeft;
      scrollLeft = nav.scrollLeft;
    });
    nav.addEventListener('mouseleave', () => { isDown = false; });
    nav.addEventListener('mouseup', () => { isDown = false; });
    nav.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const walk = (e.pageX - nav.offsetLeft - startX) * 2;
      nav.scrollLeft = scrollLeft - walk;
    });
  }
});
