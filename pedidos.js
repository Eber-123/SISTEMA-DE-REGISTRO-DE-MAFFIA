const SUPABASE_URL = 'https://cczecqowdakqftojmidx.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjemVjcW93ZGFrcWZ0b2ptaWR4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MzI3MjAsImV4cCI6MjA5NjAwODcyMH0.yb34bWeGd-oN0MzepWSs1LDZ9NG_s8-WR1WtQ1rMO8U';

const supabaseHeaders = {
    'apikey': SUPABASE_KEY,
    'Authorization': `Bearer ${SUPABASE_KEY}`,
    'Content-Type': 'application/json'
};
// ============================================================
// DATOS BASE — se carga desde localStorage (platos.js)
// ============================================================
let PLATOS_DB = [];

function cargarPlatosDB() {
    const stored = JSON.parse(localStorage.getItem('platos')) || [];
    PLATOS_DB = stored
        .filter(p => p.estado === 'Activo')
        .map(p => ({
            id:        p.id,
            nombre:    p.nombre,
            precio:    p.precio,
            categoria: p.categoria,   // ← ESTO FALTABA
            activo:    true,
        }));
}

let ADICIONALES_DB = []; // Ahora es let, se llenará desde Supabase

async function cargarAdicionalesDB() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/adicionales?select=*&order=id.asc`,
            { headers: supabaseHeaders }
        );

        if (!response.ok) throw new Error(`Error HTTP: ${response.status}`);

        const data = await response.json();
        console.log('✅ Adicionales cargados:', data); // ← AGREGA ESTA LÍNEA

        ADICIONALES_DB = data.map(a => ({
            nombre: a.nombre,
            precio: parseFloat(a.precio) || 0
        }));

    } catch (error) {
        console.error('❌ Error cargando adicionales:', error); // ← Y CAMBIA ESTO
        ADICIONALES_DB = [
            { nombre: 'Porción extra de arroz', precio: 3.00 },
            { nombre: 'Salsa de soya extra',    precio: 1.50 },
        ];
    }
}

// ============================================================
// ESTADO EN MEMORIA (se sincroniza con localStorage)
// ============================================================
let pedidos = [];
let contadorPedido = 1;
let prioridadSeleccionada = 'normal';

// ─── helpers localStorage ────────────────────────────────────
function cargarPedidosStorage() {
    const raw = localStorage.getItem('pedidos');
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        return arr.map(p => ({ ...p, fecha: new Date(p.fecha) }));
    } catch { return []; }
}

const guardarPedidosStorage = () => {
    const toSave = pedidos.map(p => ({
        id: p.codigo,
        codigo: p.codigo,
        mesa: p.mesa,
        mozo: p.mozo,
        cliente: p.cliente || '',
        fecha: p.fecha instanceof Date ? p.fecha.toISOString() : p.fecha,

        platos: p.platos,

        total: p.total,
        observaciones: p.observacionGeneral || '',
        prioridad: p.prioridad,
        justificacion: p.justificacion || '',

        estado: mapearEstadoExterno(p.estado),
        estadoCocina: mapearEstadoCocina(p.estado),

        tiempoTotal: 20,

        // ✅ AQUÍ AGREGAS ESTO (AL FINAL DEL OBJETO)
        urgente: p.urgente || false,
        justificacionUrgente: p.justificacionUrgente || '',
    }));

    localStorage.setItem('pedidos', JSON.stringify(toSave));
    window.dispatchEvent(new StorageEvent('storage', { key: 'pedidos' }));
};

function mapearEstadoExterno(estadoInterno) {
    if (estadoInterno === 'pagado')    return 'Pagado';
    if (estadoInterno === 'entregado') return 'Entregado';
    if (estadoInterno === 'listo')     return 'Entregado';
    if (estadoInterno === 'cancelado') return 'Cancelado';
    return 'Activo';
}

function mapearEstadoCocina(estadoInterno) {
    const mapa = {
        registrado:  'Pendiente',
        cocina:      'Pendiente',
        preparacion: 'En preparación',
        listo:       'Listo',
        entregado:   'Listo',
        cancelado:   'Cancelado',
    };
    return mapa[estadoInterno] || 'Pendiente';
}

function mapearEstadoInterno(estadoCocina, estadoExterno) {
    if (estadoExterno === 'Pagado')    return 'entregado';
    if (estadoExterno === 'Entregado') return 'entregado';
    if (estadoExterno === 'Facturado') return 'entregado';
    if (estadoExterno === 'Cancelado') return 'cancelado';
    const mapa = {
        'Pendiente':      'cocina',
        'En preparación': 'preparacion',
        'Listo':          'listo',
    };
    return mapa[estadoCocina] || 'registrado';
}

function calcularContador() {
    const activos   = cargarPedidosStorage();
    const historial = JSON.parse(localStorage.getItem('pedidosHistorial')) || [];

    const todos = [...activos, ...historial];

    if (todos.length === 0) return 1;

    const nums = todos.map(p => {
        const n = parseInt((p.codigo || '').replace('PED', ''));
        return isNaN(n) ? 0 : n;
    });

    return Math.max(...nums) + 1;
}

// ============================================================
// LIMPIAR PEDIDOS ACTIVOS
// ============================================================
function limpiarPedidosActivos() {
    const activos = pedidos.filter(p =>
        p.estado !== 'cancelado' && p.estado !== 'entregado'
    ).length;

    if (activos === 0) {
        alert('No hay pedidos activos para eliminar.');
        return;
    }

    if (!confirm(`¿Eliminar los ${activos} pedido(s) activo(s)? Esta acción no se puede deshacer.`)) return;

    // Conservar solo cancelados y entregados
    pedidos = pedidos.filter(p =>
        p.estado === 'cancelado' || p.estado === 'entregado'
    );

    contadorPedido = calcularContador();
    actualizarCodigo();
    guardarPedidosStorage();
    renderizarPedidos();
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {   // 1. agregar async
    await cargarAdicionalesDB();  // 2. agregar esta línea ANTES de cargarPlatosDB
    cargarPlatosDB();

    pedidos = cargarPedidosStorage().map(p => ({
        ...p,
        platos:            p.platos || [],
        observacionGeneral: p.observaciones || '',
        estado: p.estado === 'Pagado'    ? 'pagado'
              : p.estado === 'Entregado' ? 'entregado'
              : p.estado === 'Cancelado' ? 'cancelado'
              : mapearEstadoInterno(p.estadoCocina, p.estado),
    }));
    contadorPedido = calcularContador();
    actualizarCodigo();
    actualizarFechaHora();
    renderizarPlatos();
    renderizarPedidos();

    document.getElementById('pedidoForm').addEventListener('submit', crearPedido);

    // ✅ Un solo listener para pedidos y platos
    window.addEventListener('storage', (e) => {
        if (e.key === 'pedidos') {
            sincronizarDesdeStorage();
        } 
        if (e.key === 'platos') {
            cargarPlatosDB();
            renderizarPlatos();
        }
    });

    // Bloquear teclas no numéricas en campo mesa
    document.getElementById('mesa').addEventListener('keydown', function(e) {
        if (['e','E','+','-','.'].includes(e.key)) e.preventDefault();
    });

    // Validación live mesa
    document.getElementById('mesa').addEventListener('input', function() {
        const val = parseInt(this.value);
        const err = document.getElementById('mesaError');
        if (this.value === '' || isNaN(val)) {
            err.textContent = '';
            this.classList.remove('error');
        } else if (val < 1 || val > 50) {
            err.textContent = 'El número de mesa debe estar entre 1 y 50';
            this.classList.add('error');
        } else {
            err.textContent = '';
            this.classList.remove('error');
        }
    });

    // Validación live mozo
    document.getElementById('mozo').addEventListener('input', function() {
        validarMozo(false);
    });
});

function sincronizarDesdeStorage() {
    const externos = cargarPedidosStorage();
    pedidos = pedidos.map(p => {
        const ext = externos.find(e => e.id === p.codigo || e.codigo === p.codigo);
        if (!ext) return p;
        return {
            ...p,
            estado: ext.estado === 'Pagado'    ? 'entregado'
                  : ext.estado === 'Cancelado' ? 'cancelado'
                  : mapearEstadoInterno(ext.estadoCocina, ext.estado),
        };
    });
    renderizarPedidos();
}

function actualizarCodigo() {
    const codigo = 'PED' + String(contadorPedido).padStart(3, '0');
    document.getElementById('codigoPedido').textContent = codigo;
}

function actualizarFechaHora() {
    const opciones = { year:'numeric', month:'2-digit', day:'2-digit', hour:'2-digit', minute:'2-digit', second:'2-digit' };
    const actualizar = () => {
        document.getElementById('fechaHora').textContent = new Date().toLocaleString('es-PE', opciones);
    };
    actualizar();
    setInterval(actualizar, 1000);
}

// ============================================================
// PLATOS
// ============================================================
function renderizarPlatos() {
    const contenedor = document.getElementById('platosDisponibles');
    contenedor.innerHTML = '';

    // Categorías en el orden deseado
    const CATEGORIAS = [
        { key: 'Entrada',              icono: '🥢', label: 'Entradas' },
        { key: 'Plato de fondo',       icono: '🍚', label: 'Platos de Fondo' },
        { key: 'Menú ejecutivo',       icono: '🥡', label: 'Menú Ejecutivo' },
        { key: 'Postre',               icono: '🍡', label: 'Postres' },
        { key: 'Bebida',               icono: '🍵', label: 'Bebidas' },
        { key: 'Especial de la casa',  icono: '🐉', label: 'Especial de la Casa' },
    ];

    const platosActivos = PLATOS_DB.filter(p => p.activo);

    if (platosActivos.length === 0) {
        contenedor.innerHTML = `<p style="color:var(--text-muted);font-size:13px;padding:10px 0;">
            No hay platos activos registrados.</p>`;
        return;
    }

    CATEGORIAS.forEach(cat => {
        const platosDeCategoria = platosActivos.filter(p => p.categoria === cat.key);
        if (platosDeCategoria.length === 0) return; // Ocultar categorías sin platos

        // Contenedor de categoría
        const seccion = document.createElement('div');
        seccion.className = 'categoria-seccion';
        seccion.style.cssText = `
            border: 1px solid rgba(255,255,255,0.15);
            border-radius: 8px;
            margin-bottom: 10px;
            overflow: hidden;
            background: rgba(0,0,0,0.18);
        `;

        // Cabecera (toggle)
        const header = document.createElement('div');
        header.className = 'categoria-header';
        header.style.cssText = `
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 10px 14px;
            cursor: pointer;
            background: rgba(255,255,255,0.07);
            user-select: none;
            transition: background 0.2s;
        `;
        header.innerHTML = `
            <span style="font-size:14px;font-weight:600;color:var(--text,#eee);letter-spacing:0.3px;">
                <span style="margin-right:8px;">${cat.icono}</span>${cat.label}
                <span style="
                    margin-left:10px;
                    background:rgba(255,255,255,0.12);
                    color:var(--text,#eee);
                    font-size:11px;
                    font-weight:500;
                    padding:2px 8px;
                    border-radius:12px;
                ">${platosDeCategoria.length}</span>
            </span>
            <span class="cat-chevron" style="
                font-size:13px;
                color:var(--text-muted,#aaa);
                transition: transform 0.25s;
                transform: rotate(0deg);
            ">▼</span>
        `;

        // Cuerpo de la categoría (lista de platos)
        const cuerpo = document.createElement('div');
        cuerpo.className = 'categoria-cuerpo';
        cuerpo.style.cssText = `
            display: none;
            padding: 8px 10px 10px 10px;
        `;

        // Toggle al hacer clic en el header
        header.addEventListener('click', () => {
            const abierto = cuerpo.style.display === 'block';
            cuerpo.style.display = abierto ? 'none' : 'block';
            header.querySelector('.cat-chevron').style.transform =
                abierto ? 'rotate(0deg)' : 'rotate(180deg)';
        });

        // Hover en header
        header.addEventListener('mouseenter', () => {
            header.style.background = 'rgba(255,255,255,0.11)';
        });
        header.addEventListener('mouseleave', () => {
            header.style.background = 'rgba(255,255,255,0.07)';
        });

        // Renderizar cada plato dentro de la categoría
        platosDeCategoria.forEach(plato => {
            const div = document.createElement('div');
            div.className = 'plato-item';
            div.id = `plato-item-${plato.id}`;
            div.innerHTML = `
                <div class="plato-header" onclick="togglePlato(${plato.id}, false)">
                    <input
                        class="plato-check"
                        type="checkbox"
                        id="chk-${plato.id}"
                        onclick="event.stopPropagation(); togglePlato(${plato.id}, true)"
                    >
                    <span class="plato-name">${plato.nombre}</span>
                    <span class="plato-precio">S/ ${plato.precio.toFixed(2)}</span>
                </div>
                <div class="plato-controls" id="ctrl-${plato.id}">
                    <div class="plato-qty-row">
                        <button type="button" class="qty-btn" onclick="cambiarQty(${plato.id}, -1)">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input class="qty-input" type="text" id="qty-${plato.id}" value="1"
                            oninput="validarQty(${plato.id})" inputmode="numeric">
                        <button type="button" class="qty-btn" onclick="cambiarQty(${plato.id}, 1)">
                            <i class="fas fa-plus"></i>
                        </button>
                        <span class="qty-subtotal">
                            Subtotal: <span id="sub-${plato.id}">S/ ${plato.precio.toFixed(2)}</span>
                        </span>
                    </div>
                    <div class="obs-list" id="obs-list-${plato.id}"></div>
                    <button type="button" class="btn-add-obs-main"
                        onclick="agregarObservacion(${plato.id})">
                        <i class="fas fa-plus"></i> Adicionar observación especial
                    </button>
                </div>
            `;
            cuerpo.appendChild(div);
        });

        seccion.appendChild(header);
        seccion.appendChild(cuerpo);
        contenedor.appendChild(seccion);
    });
}

function togglePlato(platoId, fromCheckbox) {
    const chk  = document.getElementById(`chk-${platoId}`);
    const ctrl = document.getElementById(`ctrl-${platoId}`);
    const item = document.getElementById(`plato-item-${platoId}`);
    if (!fromCheckbox) chk.checked = !chk.checked;
    if (chk.checked) {
        ctrl.classList.add('visible');
        item.classList.add('selected');
        calcularSubtotal(platoId);
    } else {
        ctrl.classList.remove('visible');
        item.classList.remove('selected');
    }
    calcularTotal();
    document.getElementById('platosError').textContent = '';
}

function cambiarQty(platoId, delta) {
    const input = document.getElementById(`qty-${platoId}`);
    let val = parseInt(input.value) || 1;
    val = Math.max(1, val + delta);
    input.value = val;
    calcularSubtotal(platoId);
    calcularTotal();
}

function validarQty(platoId) {
    const input = document.getElementById(`qty-${platoId}`);
    input.value = input.value.replace(/\D/g, '');
    if (parseInt(input.value) < 1 || input.value === '') input.value = '1';
    calcularSubtotal(platoId);
    calcularTotal();
}

function calcularSubtotal(platoId) {
    const plato = PLATOS_DB.find(p => String(p.id) === String(platoId));
    if (!plato) return;
    const qty    = parseInt(document.getElementById(`qty-${platoId}`)?.value) || 1;
    const extras = calcularExtrasObs(platoId);
    const sub    = (plato.precio + extras) * qty;
    const el     = document.getElementById(`sub-${platoId}`);
    if (el) el.textContent = `S/ ${sub.toFixed(2)}`;
}

function calcularExtrasObs(platoId) {
    const lista = document.getElementById(`obs-list-${platoId}`);
    if (!lista) return 0;
    let extra = 0;
    lista.querySelectorAll('.obs-select').forEach(sel => {
        const ad = ADICIONALES_DB.find(a => a.nombre === sel.value);
        if (ad) extra += ad.precio;
    });
    return extra;
}

function calcularTotal() {
    let total = 0;
    PLATOS_DB.filter(p => p.activo).forEach(plato => {
        const chk = document.getElementById(`chk-${plato.id}`);
        if (chk && chk.checked) {
            const qty    = parseInt(document.getElementById(`qty-${plato.id}`)?.value) || 1;
            const extras = calcularExtrasObs(plato.id);
            total += (plato.precio + extras) * qty;
        }
    });
    const el = document.getElementById('totalDisplay');
    if (el) el.textContent = `S/ ${total.toFixed(2)}`;
}

// ============================================================
// OBSERVACIONES POR PLATO
// ============================================================
function agregarObservacion(platoId) {
    const lista = document.getElementById(`obs-list-${platoId}`);
    const row   = document.createElement('div');
    row.className = 'obs-row';
    const opciones = ADICIONALES_DB.map(a =>
        `<option value="${a.nombre}">${a.nombre}${a.precio > 0 ? ` (+S/ ${a.precio.toFixed(2)})` : ''}</option>`
    ).join('');
    row.innerHTML = `
        <select class="obs-select" onchange="onObsChange(this, ${platoId})">
            <option value="">-- Observación/Adicional --</option>
            ${opciones}
            <option value="__custom__">Otro (escribir)...</option>
        </select>
        <button type="button" class="btn-del-obs" onclick="eliminarObservacion(this, ${platoId})"><i class="fas fa-times"></i></button>
    `;
    lista.appendChild(row);
}

function onObsChange(sel, platoId) {
    const row = sel.parentElement;
    row.querySelector('.obs-custom')?.remove();
    row.querySelector('.obs-counter')?.remove();
    row.querySelector('.obs-extra-costo')?.remove();

    if (sel.value === '__custom__') {
        const ta      = document.createElement('textarea');
        ta.className  = 'obs-custom';
        ta.rows       = 2;
        ta.maxLength  = 150;
        ta.placeholder = 'Describe la observación...';
        const counter = document.createElement('div');
        counter.className = 'obs-counter';
        counter.textContent = '0/150';
        ta.oninput = () => {
            const len = ta.value.length;
            counter.textContent = `${len}/150`;
            counter.classList.toggle('warn', len > 130);
        };
        row.appendChild(ta);
        row.appendChild(counter);
    } else {
        const ad = ADICIONALES_DB.find(a => a.nombre === sel.value);
        if (ad && ad.precio > 0) {
            const badge       = document.createElement('div');
            badge.className   = 'obs-extra-costo';
            badge.innerHTML   = `<i class="fas fa-plus-circle"></i> +S/ ${ad.precio.toFixed(2)} al subtotal`;
            row.appendChild(badge);
        }
    }
    calcularSubtotal(platoId);
    calcularTotal();
}

function eliminarObservacion(btn, platoId) {
    btn.parentElement.remove();
    calcularSubtotal(platoId);
    calcularTotal();
}

// ============================================================
// PRIORIDAD
// ============================================================
function setPrioridad(btn) {
    document.querySelectorAll('.prio-btn').forEach(b => { b.className = 'prio-btn'; });
    const p = btn.dataset.prio;
    prioridadSeleccionada = p;
    if (p === 'normal')  btn.classList.add('active-normal');
    if (p === 'alta')    btn.classList.add('active-alta');
    if (p === 'urgente') btn.classList.add('active-urgente');
    document.getElementById('justificacionBlock').classList.toggle('visible', p === 'urgente');
    document.getElementById('prioError').textContent = '';
}

// ============================================================
// VALIDACIONES
// ============================================================
function validarMozo(mostrarError = true) {
    const val = document.getElementById('mozo').value.trim();
    const err = document.getElementById('mozoError');
    if (!val) {
        if (mostrarError) { err.textContent = 'El nombre del mozo es obligatorio'; document.getElementById('mozo').classList.add('error'); }
        return false;
    }
    if (val.length < 3) {
        if (mostrarError) { err.textContent = 'Mínimo 3 caracteres'; document.getElementById('mozo').classList.add('error'); }
        return false;
    }
    if (/^\d+$/.test(val)) {
        if (mostrarError) { err.textContent = 'No puede ser solo números'; document.getElementById('mozo').classList.add('error'); }
        return false;
    }
    err.textContent = '';
    document.getElementById('mozo').classList.remove('error');
    return true;
}

function validarMesa() {
    const raw = document.getElementById('mesa').value.trim();
    const val = parseInt(raw);
    const err = document.getElementById('mesaError');
    if (!raw || isNaN(val) || val < 1 || val > 50) {
        err.textContent = 'Ingrese un número de mesa válido (1 – 50)';
        document.getElementById('mesa').classList.add('error');
        return false;
    }
    err.textContent = '';
    document.getElementById('mesa').classList.remove('error');
    return true;
}

function validarPlatos() {
    const seleccionados = PLATOS_DB.filter(p => p.activo && document.getElementById(`chk-${p.id}`)?.checked);
    if (seleccionados.length === 0) {
        document.getElementById('platosError').textContent = 'Seleccione al menos un plato';
        return false;
    }
    document.getElementById('platosError').textContent = '';
    return true;
}

function validarJustificacion() {
    if (prioridadSeleccionada !== 'urgente') return true;
    const sel = document.getElementById('justificacionSelect').value;
    const txt = document.getElementById('justificacionTexto').value.trim();
    const err = document.getElementById('justError');
    if (!sel)                              { err.textContent = 'Seleccione un motivo de urgencia'; return false; }
    if (txt.length < 10 && sel === 'Otro') { err.textContent = 'Detalle mínimo 10 caracteres';    return false; }
    err.textContent = '';
    return true;
}

// ============================================================
// CREAR O ACTUALIZAR PEDIDO (Lógica mejorada)
// ============================================================
function crearPedido(e) {
    e.preventDefault();
    
    // 1. Validaciones existentes
    const okMesa   = validarMesa();
    const okMozo   = validarMozo(true);
    const okPlatos = validarPlatos();
    const okJust   = validarJustificacion();
    if (!okMesa || !okMozo || !okPlatos || !okJust) return;

    const mesaVal       = parseInt(document.getElementById('mesa').value);
    const mozoVal       = document.getElementById('mozo').value.trim();
    const clienteVal    = document.getElementById('cliente').value.trim();
    const observaciones = document.getElementById('observaciones').value.trim();
    const ahora         = new Date();

    // 2. Recolectar platos seleccionados del formulario actual
    const nuevosPlatos = [];
    PLATOS_DB.filter(p => p.activo).forEach(plato => {
        const chk = document.getElementById(`chk-${plato.id}`);
        if (chk && chk.checked) {
            const qty     = parseInt(document.getElementById(`qty-${plato.id}`)?.value) || 1;
            const obsList = document.getElementById(`obs-list-${plato.id}`);
            const obsData = [];
            
            obsList.querySelectorAll('.obs-row').forEach(row => {
                const sel = row.querySelector('.obs-select');
                const ta  = row.querySelector('.obs-custom');
                let texto = (sel.value === '__custom__' && ta) ? ta.value.trim() : sel.value;
                
                if (texto) {
                    const ad = ADICIONALES_DB.find(a => a.nombre === texto);
                    obsData.push({ texto, extra: ad ? ad.precio : 0 });
                }
            });

            const extras = obsData.reduce((s, o) => s + o.extra, 0);
            nuevosPlatos.push({
                id: plato.id,
                nombre: plato.nombre,
                precioUnitario: plato.precio,
                cantidad: qty,
                subtotal: (plato.precio + extras) * qty,
                observaciones: obsData,
                platoId: plato.id,
                estadoPlato: 'Pendiente',
                tiempo: 20,
            });
        }
    });

    // 3. BUSCAR SI LA MESA YA TIENE UN PEDIDO ACTIVO (Para no duplicar)
    // Se considera activo si no está 'entregado' ni 'cancelado'
    let pedidoExistente = pedidos.find(p => 
        parseInt(p.mesa) === mesaVal && 
        p.estado !== 'entregado' && 
        p.estado !== 'cancelado'
    );

    if (pedidoExistente) {
        // --- CASO: ACTUALIZAR ---
        // Añadimos los nuevos platos al array existente
        pedidoExistente.platos = [...pedidoExistente.platos, ...nuevosPlatos];
        
        // Recalculamos el total sumando lo nuevo
        const nuevoSubtotal = nuevosPlatos.reduce((s, p) => s + p.subtotal, 0);
        pedidoExistente.total += nuevoSubtotal;

        // Añadimos nota si existe
        if (observaciones) {
            pedidoExistente.observacionGeneral += (pedidoExistente.observacionGeneral ? ' | ' : '') + observaciones;
        }

        // Si esta nueva adición es urgente, el pedido completo sube de prioridad
        if (prioridadSeleccionada === 'urgente') {
            pedidoExistente.prioridad = 'urgente';
            pedidoExistente.urgente = true;
            pedidoExistente.justificacionUrgente = "Adición: " + (document.getElementById('justificacionSelect').value || "Urgente");
        }

        alert(`Se han añadido platos al pedido existente de la Mesa ${mesaVal}`);

    } else {
        // --- CASO: CREAR NUEVO ---
        const total = nuevosPlatos.reduce((s, p) => s + p.subtotal, 0);
        const justSel = document.getElementById('justificacionSelect').value;
        const justTxt = document.getElementById('justificacionTexto').value.trim();
        const justificacion = prioridadSeleccionada === 'urgente' ? (justSel === 'Otro' ? justTxt : justSel) : '';

        const nuevoPedido = {
            codigo: `PED${String(contadorPedido).padStart(3, '0')}`,
            mesa: mesaVal,
            mozo: mozoVal,
            cliente: clienteVal,
            fecha: ahora,
            platos: nuevosPlatos,
            observacionGeneral: observaciones,
            prioridad: prioridadSeleccionada,
            justificacion,
            estado: 'registrado',
            total,
            estadoCocina: 'Pendiente',
            urgente: prioridadSeleccionada === 'urgente',
            justificacionUrgente: prioridadSeleccionada === 'urgente' ? justificacion : '',
        };

        pedidos.unshift(nuevoPedido);
        contadorPedido++;
        actualizarCodigo();
    }

    // 4. Persistir y Limpiar
    guardarPedidosStorage();
    renderizarPedidos();
    resetForm();
}

function resetForm() {
    // Limpiamos los inputs de texto
    document.getElementById('mesa').value = '';
    document.getElementById('mozo').value = '';
    document.getElementById('cliente').value = '';
    document.getElementById('observaciones').value = '';
    document.getElementById('justificacionSelect').value = '';
    document.getElementById('justificacionTexto').value = '';
    
    // Ocultamos bloques de urgencia
    document.getElementById('justificacionBlock').classList.remove('visible');
    
    // Reset de prioridad a normal
    prioridadSeleccionada = 'normal';
    document.querySelectorAll('.prio-btn').forEach(b => b.className = 'prio-btn');
    const btnNormal = document.querySelector('[data-prio="normal"]');
    if (btnNormal) btnNormal.classList.add('active-normal');
    
    // Reset visual de platos y total
    renderizarPlatos();
    document.getElementById('totalDisplay').textContent = 'S/ 0.00';
    
    // Enfocar mesa para el siguiente pedido
    document.getElementById('mesa').focus();
}

// ============================================================
// RENDER PEDIDOS
// ============================================================
const ESTADOS_FLUJO = {
    registrado:  { label: 'Registrado',       class: 'estado-registrado',  siguiente: 'cocina'  },
    cocina:      { label: 'Enviado a Cocina',  class: 'estado-cocina',      siguiente: null      },
    preparacion: { label: 'En Preparación',    class: 'estado-preparacion', siguiente: null      },
    listo:       { label: 'Listo para Servir', class: 'estado-listo',       siguiente: null      },
    entregado:   { label: 'Entregado',         class: 'estado-entregado',   siguiente: null      },
    cancelado:   { label: 'Cancelado',         class: 'estado-cancelado',   siguiente: null      },
};

function renderizarPedidos() {
    const cont = document.getElementById('pedidosList');
    if (pedidos.length === 0) {
        cont.innerHTML = `<div class="empty-state"><i class="fas fa-clipboard"></i>No hay pedidos activos</div>`;
        return;
    }

    const mesaCount = {};
    pedidos.forEach(p => {
        if (p.estado !== 'cancelado' && p.estado !== 'entregado')
            mesaCount[p.mesa] = (mesaCount[p.mesa] || 0) + 1;
    });

    cont.innerHTML = pedidos.map((p, i) => {
        const est     = ESTADOS_FLUJO[p.estado];
        const prio    = p.prioridad;
        const prioTag = `<span class="prio-tag prio-${prio}">${prio.charAt(0).toUpperCase()+prio.slice(1)}</span>`;
        const multimesa = mesaCount[p.mesa] > 1
            ? `<span style="color:var(--yellow);font-size:10px;"><i class="fas fa-exclamation-circle"></i> ${mesaCount[p.mesa]} pedidos en esta mesa</span>`
            : '';
        const fecha = p.fecha instanceof Date
            ? p.fecha.toLocaleString('es-PE', { day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit' })
            : p.fecha;

        const infoRow = `
            <div class="pc-info-row">
                <span class="pc-info-item"><span class="pc-info-label">Mesa</span> ${p.mesa}</span>
                <span class="pc-info-sep">·</span>
                <span class="pc-info-item"><span class="pc-info-label">Mozo</span> ${p.mozo}</span>
                ${p.cliente ? `<span class="pc-info-sep">·</span><span class="pc-info-item"><span class="pc-info-label">Cliente</span> ${p.cliente}</span>` : ''}
            </div>
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:3px;">
                <span style="font-size:11px;color:var(--text-muted);"><i class="fas fa-clock" style="margin-right:3px;"></i>${fecha}</span>
                ${multimesa}
            </div>
            ${p.justificacion ? `<div style="font-size:11px;color:var(--red);margin-top:4px;"><i class="fas fa-exclamation-triangle"></i> ${p.justificacion}</div>` : ''}
        `;

        const platosHtml = p.platos.map(pl => {
            const obsHtml = pl.observaciones.length > 0 ? `
                <div class="pc-plato-obs-block">
                    <span class="pc-obs-label">Obs. del plato:</span>
                    <div class="pc-obs-tags">
                        ${pl.observaciones.map(o => `<span class="pc-obs-tag">${o.texto}${o.extra > 0 ? ` <strong>+S/ ${o.extra.toFixed(2)}</strong>` : ''}</span>`).join('')}
                    </div>
                </div>` : '';
            return `
                <div class="pc-plato-item">
                    <div class="pc-plato-top">
                        <span class="pc-plato-nombre">${pl.nombre}</span>
                        <span class="pc-plato-detalle">x${pl.cantidad} · S/ ${pl.subtotal.toFixed(2)}</span>
                    </div>
                    ${obsHtml}
                </div>`;
        }).join('');

        const notaHtml = p.observacionGeneral ? `
            <div class="pc-section">
                <div class="pc-section-title"><i class="fas fa-comment"></i> Nota general del pedido</div>
                <div class="pc-nota-general">${p.observacionGeneral}</div>
            </div>` : '';

        const btnSiguiente = est.siguiente
            ? `<button class="btn-estado" onclick="avanzarEstado(${i})">${nextLabel(est.siguiente)}</button>`
            : '';
        const btnCancelar = (p.estado !== 'cancelado' && p.estado !== 'entregado')
            ? `<button class="btn-estado btn-cancelar" onclick="cancelarPedido(${i})"><i class="fas fa-times"></i> Cancelar</button>`
            : '';

        return `<div class="pedido-card">
            <div class="pc-header">
                <div style="display:flex;align-items:center;gap:8px;">
                    <span class="pedido-codigo">${p.codigo}</span>
                    ${prioTag}
                </div>
                <span class="estado-badge ${est.class}">${est.label}</span>
            </div>
            <div class="pc-meta">${infoRow}</div>
            <div class="pc-section">
                <div class="pc-section-title"><i class="fas fa-utensils"></i> Platos</div>
                <div class="pc-platos-list">${platosHtml}</div>
            </div>
            ${notaHtml}
            <div class="pedido-footer">
                <span class="pedido-total-lbl">Total: S/ ${p.total.toFixed(2)}</span>
                <div class="pedido-acciones">${btnSiguiente}${btnCancelar}</div>
            </div>
        </div>`;
    }).join('');
}

function nextLabel(estado) {
    const labels = {
        cocina: '<i class="fas fa-paper-plane"></i> Enviar a Cocina',
    };
    return labels[estado] || '';
}

function avanzarEstado(i) {
    const p     = pedidos[i];
    const flujo = ESTADOS_FLUJO[p.estado];
    if (flujo.siguiente) {
        p.estado = flujo.siguiente;
        guardarPedidosStorage();
        renderizarPedidos();
    }
}

function cancelarPedido(i) {
    if (confirm('¿Cancelar este pedido?')) {
        pedidos[i].estado = 'cancelado';
        
        // Animar desaparición
        const card = document.querySelectorAll('.pedido-card')[i];
        if (card) {
            card.style.transition = 'opacity 0.3s, transform 0.3s';
            card.style.opacity = '0';
            card.style.transform = 'translateX(20px)';
            
            setTimeout(() => {
                guardarPedidosStorage();
                renderizarPedidos();
            }, 300);
        } else {
            guardarPedidosStorage();
            renderizarPedidos();
        }
    }
}