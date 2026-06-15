/* ===========================
   CUENTA.JS - Módulo Facturación
   MAFFIA Restaurante Oriental
   =========================== */

// ============================================================
// UTILIDADES GENERALES
// ============================================================

function getLS(key) {
    try {
        const data = JSON.parse(localStorage.getItem(key)) || [];

        // 🔥 NORMALIZAR pedidos
        if (key === 'pedidos') {
            data.forEach(p => {
                if (!p.codigo && p.id) p.codigo = p.id;
                if (!p.id && p.codigo) p.id = p.codigo;
            });
        }

        return data;
    } catch {
        return [];
    }
}

function setLS(key, data) {
    localStorage.setItem(key, JSON.stringify(data));
}

function generarCodigoFactura() {
    const facturas = getLS('facturas');
    const num = facturas.length + 1;
    return 'FAC' + String(num).padStart(3, '0');
}

function formatMoney(val) {
    return 'S/ ' + parseFloat(val || 0).toFixed(2);
}

function parseMoney(str) {
    return parseFloat((str || '').replace('S/ ', '').replace(',', '.')) || 0;
}

function getFechaHora() {
    return new Date().toLocaleString('es-PE', {
        day: '2-digit', month: '2-digit', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
    });
}

function formatFecha(fecha) {
    if (!fecha) return '—';
    try {
        return new Date(fecha).toLocaleString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    } catch { return '—'; }
}

function showToast(msg, tipo = 'success') {
    const toast    = document.getElementById('toast');
    const toastMsg = document.getElementById('toast-msg');
    const icon     = toast.querySelector('.toast-icon');
    toast.className = 'toast ' + tipo;
    toastMsg.textContent = msg;
    icon.className = 'toast-icon fas ' + (tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle');
    toast.classList.remove('hidden');
    clearTimeout(window._toastTimer);
    window._toastTimer = setTimeout(() => toast.classList.add('hidden'), 3500);
}

function clearErrors() {
    document.querySelectorAll('.field-error').forEach(el => el.textContent = '');
}

function showError(id, msg) {
    const el = document.getElementById(id);
    if (el) el.textContent = msg;
}

// ============================================================
// DETECTAR SI UN PEDIDO ESTÁ LISTO PARA FACTURAR
// Acepta todas las variantes que pueden escribir cocina.js
// y pedidos.js en localStorage.
// ============================================================

function pedidoFacturable(p) {
    const est = (p.estado       || '').toLowerCase().trim();
    const coc = (p.estadoCocina || '').toLowerCase().trim();

    // Excluir cancelados y ya facturados
    if (est === 'cancelado' || est === 'facturado') return false;

    // Variantes de "listo" escritas por cocina.js y pedidos.js:
    // - cocina.js  → p.estado = 'Entregado'  (con mayúscula)
    // - pedidos.js → mapearEstadoExterno('entregado') = 'Pagado'
    // - estadoCocina puede quedar en 'Listo' aunque estado sea 'Activo'
    const estadosOk = ['entregado', 'listo', 'pagado'];
    if (estadosOk.includes(est)) return true;
    if (coc === 'listo')         return true;

    return false;
}

// ============================================================
// NORMALIZAR PLATOS
// Compatibilidad con cualquier estructura guardada por los módulos.
// ============================================================

function normalizarPlatos(pedido) {
    if (Array.isArray(pedido.platos) && pedido.platos.length > 0) {
        return pedido.platos.map(p => ({
            nombre:         p.nombre         || 'Sin nombre',
            cantidad:       parseInt(p.cantidad)                       || 1,
            precioUnitario: parseFloat(p.precioUnitario || p.precio)   || 0,
            subtotal:       parseFloat(p.subtotal       || p.precio)   || 0,
            observacion:    Array.isArray(p.observaciones)
                                ? p.observaciones.map(o => o.texto || o).join(', ')
                                : (p.observacion || p.modificaciones || ''),
        }));
    }
    if (Array.isArray(pedido.items) && pedido.items.length > 0) {
        return pedido.items.map(item => ({
            nombre:         item.nombre         || 'Sin nombre',
            cantidad:       parseInt(item.cantidad)                          || 1,
            precioUnitario: parseFloat(item.precioUnitario || item.precio)   || 0,
            subtotal:       parseFloat(item.subtotal       || item.precio)   || 0,
            observacion:    item.modificaciones || '',
        }));
    }
    return [];
}

// ============================================================
// ESTADO GLOBAL DEL MÓDULO
// ============================================================

let mesaActual           = null;
let pedidosSeleccionados = [];
let facturaEnEdicion     = null;

// ============================================================
// TABS
// ============================================================

document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(t => t.classList.add('hidden'));
        btn.classList.add('active');
        document.getElementById('tab-' + btn.dataset.tab).classList.remove('hidden');
        if (btn.dataset.tab === 'cuentas-guardadas') renderFacturas();
    });
});

// ============================================================
// PASO 1 — BUSCAR MESA
// ============================================================

document.getElementById('btn-buscar-mesa').addEventListener('click', buscarMesa);
document.getElementById('input-mesa').addEventListener('keydown', e => {
    if (e.key === 'Enter') buscarMesa();
});

function buscarMesa() {
    clearErrors();
    const inputEl = document.getElementById('input-mesa');
    const mesa    = parseInt(inputEl.value);

    if (!inputEl.value.trim()) {
        showError('error-mesa', 'Ingrese un número de mesa.');
        return;
    }
    if (isNaN(mesa) || mesa < 1 || mesa > 50) {
        showError('error-mesa', 'El número de mesa debe estar entre 1 y 50.');
        return;
    }

    const pedidos = getLS('pedidos');

    // Filtrar pedidos de esta mesa que estén listos para facturar
const pedidosMesa = pedidos.filter(p => {
    const est = (p.estado || '').toLowerCase();
    return parseInt(p.mesa) === mesa &&
           est !== 'pagado' &&
           est !== 'facturado' &&
           est !== 'cancelado' &&
           pedidoFacturable(p);
});

    // Excluir los ya incluidos en facturas activas (no anuladas)
    const facturas     = getLS('facturas');
    const yaFacturados = new Set();
    facturas.forEach(f => {
        if (f.estado !== 'Anulada') {
            (f.pedidosIds || []).forEach(id => yaFacturados.add(String(id)));
        }
    });

    const disponibles = pedidosMesa.filter(p =>
        !yaFacturados.has(String(p.id)) && !yaFacturados.has(String(p.codigo))
    );

    if (disponibles.length === 0) {
        showError('error-mesa',
            pedidosMesa.length > 0
                ? 'Todos los pedidos de esta mesa ya fueron facturados.'
                : 'No hay pedidos listos para cobrar en esta mesa. Primero márcalos como Listos en Cocina.'
        );
        document.getElementById('paso-pedidos').classList.add('hidden');
        document.getElementById('paso-pago').classList.add('hidden');
        return;
    }

    mesaActual = mesa;
    renderPedidosMesa(disponibles);
    document.getElementById('paso-pedidos').classList.remove('hidden');
    document.getElementById('label-mesa-seleccionada').textContent = 'Mesa #' + mesa;
}

// ============================================================
// PASO 2 — MOSTRAR PEDIDOS DE LA MESA
// ============================================================

function renderPedidosMesa(pedidos) {
    const container = document.getElementById('lista-pedidos-mesa');
    container.innerHTML = '';

    pedidos.forEach(pedido => {
        const platosNorm   = normalizarPlatos(pedido);
        const fechaMostrar = pedido.fechaHora || formatFecha(pedido.fecha);

        const filas = platosNorm.map(p => `
            <tr>
                <td style="padding:5px 8px">${p.nombre}</td>
                <td style="text-align:center;padding:5px 8px">${p.cantidad}</td>
                <td style="text-align:right;padding:5px 8px">${formatMoney(p.precioUnitario)}</td>
                <td style="text-align:right;font-weight:600;padding:5px 8px">${formatMoney(p.subtotal)}</td>
                <td style="font-size:0.75rem;color:var(--text-muted);font-style:italic;padding:5px 8px">${p.observacion || ''}</td>
            </tr>
        `).join('');

        const card = document.createElement('div');
        card.className = 'pedido-item-card';
        card.innerHTML = `
            <div class="pedido-item-header">
                <span class="pedido-code">
                    <i class="fas fa-hashtag"></i> ${pedido.codigo}
                </span>
                <span class="pedido-meta">
                    <i class="fas fa-user"></i> ${pedido.mozo || '—'} &nbsp;|&nbsp;
                    <i class="fas fa-clock"></i> ${fechaMostrar}
                </span>
                <span class="prioridad-${(pedido.prioridad || 'normal').toLowerCase()}">
                    <i class="fas fa-flag"></i> ${pedido.prioridad || 'Normal'}
                </span>
            </div>
            <table style="width:100%;border-collapse:collapse;margin-top:8px">
                <thead>
                    <tr style="font-size:0.72rem;color:var(--text-muted);text-transform:uppercase;border-bottom:1px solid var(--dark-border)">
                        <th style="text-align:left;padding:4px 8px">Plato</th>
                        <th style="text-align:center;padding:4px 8px">Cant.</th>
                        <th style="text-align:right;padding:4px 8px">P. Unit.</th>
                        <th style="text-align:right;padding:4px 8px">Subtotal</th>
                        <th style="padding:4px 8px">Obs.</th>
                    </tr>
                </thead>
                <tbody style="font-size:0.85rem">${filas}</tbody>
            </table>
        `;
        container.appendChild(card);
    });

    // Guardar con platos normalizados para los cálculos
    pedidosSeleccionados = pedidos.map(p => ({
        ...p,
        platos: normalizarPlatos(p),
        codigo: String(p.codigo),
    }));

    armarResumen();
    document.getElementById('paso-pago').classList.remove('hidden');

    setTimeout(() => {
        document.getElementById('paso-pago').scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
}

// ============================================================
// PASO 3 — RESUMEN Y CÁLCULOS
// ============================================================

function armarResumen() {
    const tablaContainer = document.getElementById('tabla-resumen-items');
    tablaContainer.innerHTML = '';
    if (pedidosSeleccionados.length === 0) return;

    // Agrupar platos iguales de todos los pedidos
    const agrupados = {};
    pedidosSeleccionados.forEach(pedido => {
        (pedido.platos || []).forEach(p => {
            const key = p.nombre;
            if (agrupados[key]) {
                agrupados[key].cantidad += parseInt(p.cantidad)    || 1;
                agrupados[key].subtotal  += parseFloat(p.subtotal) || 0;
            } else {
                agrupados[key] = {
                    nombre:         p.nombre,
                    cantidad:       parseInt(p.cantidad)         || 1,
                    precioUnitario: parseFloat(p.precioUnitario) || 0,
                    subtotal:       parseFloat(p.subtotal)       || 0,
                };
            }
        });
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'tabla-resumen-wrap';
    wrapper.innerHTML = `
        <div class="resumen-item-row resumen-header-row">
            <span class="ri-nombre">Plato</span>
            <span class="ri-cant">Cant.</span>
            <span class="ri-precio">P. Unit.</span>
            <span class="ri-subtotal">Subtotal</span>
        </div>
    `;

    Object.values(agrupados).forEach(item => {
        const row = document.createElement('div');
        row.className = 'resumen-item-row';
        row.innerHTML = `
            <span class="ri-nombre">${item.nombre}</span>
            <span class="ri-cant">x${item.cantidad}</span>
            <span class="ri-precio">${formatMoney(item.precioUnitario)}</span>
            <span class="ri-subtotal">${formatMoney(item.subtotal)}</span>
        `;
        wrapper.appendChild(row);
    });

    tablaContainer.appendChild(wrapper);
    recalcular();
}

function recalcular() {
    // Sumar subtotales de todos los platos
    let subtotal = 0;
    pedidosSeleccionados.forEach(pedido => {
        (pedido.platos || []).forEach(p => {
            subtotal += parseFloat(p.subtotal) || 0;
        });
    });

    // Descuento
    let descuento = 0;
    if (document.getElementById('chk-descuento').checked) {
        const tipo  = document.getElementById('tipo-descuento').value;
        const valor = parseFloat(document.getElementById('input-descuento').value) || 0;
        descuento = (tipo === 'porcentaje') ? (subtotal * valor / 100) : valor;
        descuento = Math.max(0, Math.min(descuento, subtotal));
    }

    // IGV
    const conIgv = document.getElementById('chk-igv').checked;
    const base   = subtotal - descuento;
    const igv    = conIgv ? base * 0.18 : 0;
    const total  = base + igv;

    document.getElementById('val-subtotal').textContent  = formatMoney(subtotal);
    document.getElementById('val-descuento').textContent = '- ' + formatMoney(descuento);
    document.getElementById('val-igv').textContent       = formatMoney(igv);
    document.getElementById('val-total').textContent     = formatMoney(total);

    calcularVuelto();
}

// ============================================================
// DESCUENTO — listeners
// ============================================================

document.getElementById('chk-descuento').addEventListener('change', function () {
    document.getElementById('descuento-form').classList.toggle('hidden', !this.checked);
    if (!this.checked) {
        document.getElementById('input-descuento').value          = '';
        document.getElementById('input-justificacion-desc').value = '';
    }
    recalcular();
});

document.getElementById('tipo-descuento').addEventListener('change', recalcular);
document.getElementById('input-descuento').addEventListener('input',  recalcular);
document.getElementById('chk-igv').addEventListener('change',          recalcular);

// ============================================================
// MÉTODO DE PAGO — listeners
// ============================================================

document.querySelectorAll('input[name="metodo-pago"]').forEach(radio => {
    radio.addEventListener('change', function () {
        const metodoSeleccionado = this.value; // "Efectivo", "Tarjeta", "Yape", etc.

        // 1. Lista de todos tus contenedores de campos
        const contenedores = {
            'Efectivo': 'fields-efectivo',
            'Tarjeta': 'fields-tarjeta',
            'Yape': 'fields-yape',
            'Plin': 'fields-plin',
            'Transferencia': 'fields-transferencia'
        };

        // 2. Iterar sobre el objeto para mostrar el seleccionado y ocultar los demás
        Object.keys(contenedores).forEach(key => {
            const idContenedor = contenedores[key];
            const el = document.getElementById(idContenedor);
            
            if (el) {
                // Si la llave coincide con el radio presionado, le quita 'hidden'
                el.classList.toggle('hidden', key !== metodoSeleccionado);
            }
        });

        // 3. Limpiar campos de efectivo si se cambia a otro método
        if (metodoSeleccionado !== 'Efectivo') {
            const inputRecibido = document.getElementById('input-monto-recibido');
            const displayVuelto = document.getElementById('display-vuelto');
            if (inputRecibido) inputRecibido.value = '';
            if (displayVuelto) displayVuelto.value = '';
        }
    });
});

// Listener para el cálculo de vuelto (Efectivo)
const inputMonto = document.getElementById('input-monto-recibido');
if (inputMonto) {
    inputMonto.addEventListener('input', calcularVuelto);
}

function calcularVuelto() {
    // Asumiendo que parseMoney y formatMoney ya existen en tu cuenta.js
    const total      = parseMoney(document.getElementById('val-total').textContent);
    const monto      = parseFloat(document.getElementById('input-monto-recibido').value) || 0;
    const vueltoEl   = document.getElementById('display-vuelto');

    if (!vueltoEl) return;
    if (total <= 0) { vueltoEl.value = ''; return; }

    if (monto >= total) {
        vueltoEl.value       = formatMoney(monto - total);
        vueltoEl.style.color = 'var(--success-color, #2ecc71)'; // Usando tus variables de CSS
    } else if (monto > 0) {
        vueltoEl.value       = '⚠ Monto insuficiente';
        vueltoEl.style.color = 'var(--danger-color, #e74c3c)';
    } else {
        vueltoEl.value = '';
    }
}

// ============================================================
// CONFIRMAR PAGO — validaciones completas
// ============================================================

document.getElementById('btn-confirmar-pago').addEventListener('click', confirmarPago);

function confirmarPago() {
    clearErrors();
    let valido = true;

    if (pedidosSeleccionados.length === 0) {
        showToast('No hay pedidos para facturar.', 'error');
        return;
    }

    // --- Validar descuento ---
    if (document.getElementById('chk-descuento').checked) {
        const tipo      = document.getElementById('tipo-descuento').value;
        const valorDesc = parseFloat(document.getElementById('input-descuento').value);
        const justDesc  = document.getElementById('input-justificacion-desc').value.trim();
        const subtotal  = parseMoney(document.getElementById('val-subtotal').textContent);

        if (isNaN(valorDesc) || valorDesc < 0) {
            showError('error-descuento', 'El descuento no puede ser negativo.');
            valido = false;
        } else if (tipo === 'monto' && valorDesc > subtotal) {
            showError('error-descuento', 'El descuento no puede superar el subtotal.');
            valido = false;
        } else if (tipo === 'porcentaje' && (valorDesc < 0 || valorDesc > 100)) {
            showError('error-descuento', 'El porcentaje debe estar entre 0 y 100.');
            valido = false;
        }
        if (justDesc.length < 10) {
            showError('error-justificacion-desc', 'La justificación debe tener al menos 10 caracteres.');
            valido = false;
        }
    }

    // --- Validar método de pago ---
    const metodoPago = document.querySelector('input[name="metodo-pago"]:checked');
    if (!metodoPago) {
        showError('error-metodo-pago', 'Seleccione un método de pago.');
        valido = false;
    }

    // --- Validar efectivo ---
    if (metodoPago && metodoPago.value === 'Efectivo') {
        const total = parseMoney(document.getElementById('val-total').textContent);
        const monto = parseFloat(document.getElementById('input-monto-recibido').value);
        if (isNaN(monto) || monto < 0) {
            showError('error-monto-recibido', 'Ingrese el monto recibido.');
            valido = false;
        } else if (monto < total) {
            showError('error-monto-recibido', 'El monto recibido es menor al total a pagar.');
            valido = false;
        }
    }

    if (!valido) return;

    // --- Construir factura ---
    const subtotal  = parseMoney(document.getElementById('val-subtotal').textContent);
    const descuento = parseMoney(document.getElementById('val-descuento').textContent.replace('- ', ''));
    const igv       = parseMoney(document.getElementById('val-igv').textContent);
    const total     = parseMoney(document.getElementById('val-total').textContent);

    const factura = {
        id:         generarCodigoFactura(),
        mesa:       mesaActual,
        pedidosIds: pedidosSeleccionados.map(p => String(p.codigo)),
        pedidos:    pedidosSeleccionados,
        subtotal,
        descuento,
        justificacionDescuento: document.getElementById('chk-descuento').checked
            ? document.getElementById('input-justificacion-desc').value.trim()
            : '',
        conIgv:    document.getElementById('chk-igv').checked,
        igv,
        total,
        metodoPago: metodoPago.value,
        montoRecibido: metodoPago.value === 'Efectivo'
            ? parseFloat(document.getElementById('input-monto-recibido').value) || 0
            : null,
        vuelto: metodoPago.value === 'Efectivo'
            ? Math.max(0, (parseFloat(document.getElementById('input-monto-recibido').value) || 0) - total)
            : null,
        estado:    'Pagada',
        fechaHora: getFechaHora(),
    };

    // Guardar factura
    const facturas = getLS('facturas');
    facturas.push(factura);
    setLS('facturas', facturas);

    // Marcar pedidos como Facturado para evitar doble facturación
const pedidosLS = getLS('pedidos');
const historial = getLS('pedidosHistorial'); // nuevo storage
const idsFacturados = new Set(factura.pedidosIds);

// separar pedidos
const pedidosRestantes = [];
const pedidosPagados = [];

pedidosLS.forEach(p => {
    if (idsFacturados.has(String(p.codigo))) {
        p.estado = 'pagado';
        pedidosPagados.push(p); // se van a historial
    } else {
        pedidosRestantes.push(p); // siguen activos
    }
});

// guardar ambos
// guardar ambos
setLS('pedidos', pedidosRestantes);
setLS('pedidosHistorial', [...historial, ...pedidosPagados]);

showToast('¡Pago confirmado! Factura ' + factura.id + ' generada.', 'success');
mostrarTicket(factura);
resetFormulario();
}

// ============================================================
// RESET FORMULARIO
// ============================================================

function resetFormulario() {
    mesaActual           = null;
    pedidosSeleccionados = [];

    document.getElementById('input-mesa').value               = '';
    document.getElementById('paso-pedidos').classList.add('hidden');
    document.getElementById('paso-pago').classList.add('hidden');
    document.getElementById('lista-pedidos-mesa').innerHTML   = '';
    document.getElementById('tabla-resumen-items').innerHTML  = '';

    document.getElementById('chk-descuento').checked          = false;
    document.getElementById('descuento-form').classList.add('hidden');
    document.getElementById('input-descuento').value          = '';
    document.getElementById('input-justificacion-desc').value = '';

    document.getElementById('chk-igv').checked                = true;

    document.querySelectorAll('input[name="metodo-pago"]').forEach(r => r.checked = false);
    document.getElementById('efectivo-fields').classList.add('hidden');
    document.getElementById('input-monto-recibido').value     = '';
    document.getElementById('display-vuelto').value           = '';

    document.getElementById('val-subtotal').textContent       = 'S/ 0.00';
    document.getElementById('val-descuento').textContent      = '- S/ 0.00';
    document.getElementById('val-igv').textContent            = 'S/ 0.00';
    document.getElementById('val-total').textContent          = 'S/ 0.00';

    clearErrors();
}

document.getElementById('btn-cancelar-cuenta').addEventListener('click', resetFormulario);

// ============================================================
// TICKET DE PAGO
// ============================================================

function mostrarTicket(factura) {
    const contenido = document.getElementById('ticket-contenido');

    const itemsHTML = factura.pedidos.flatMap(p =>
        (p.platos || []).map(pl => `
            <div class="ticket-item-row">
                <span>${pl.nombre} x${pl.cantidad}</span>
                <span>${formatMoney(pl.subtotal)}</span>
            </div>
        `)
    ).join('');

    contenido.innerHTML = `
        <div class="ticket-row">
            <span><i class="fas fa-hashtag"></i> Factura</span>
            <span><b>${factura.id}</b></span>
        </div>
        <div class="ticket-row">
            <span><i class="fas fa-table"></i> Mesa</span>
            <span>${factura.mesa}</span>
        </div>
        <div class="ticket-row">
            <span><i class="fas fa-clock"></i> Fecha</span>
            <span>${factura.fechaHora}</span>
        </div>
        <div class="ticket-line"></div>
        ${itemsHTML}
        <div class="ticket-line"></div>
        <div class="ticket-row">
            <span>Subtotal</span>
            <span>${formatMoney(factura.subtotal)}</span>
        </div>
        ${factura.descuento > 0 ? `
        <div class="ticket-row" style="color:var(--danger)">
            <span>Descuento</span>
            <span>- ${formatMoney(factura.descuento)}</span>
        </div>` : ''}
        ${factura.conIgv ? `
        <div class="ticket-row">
            <span>IGV (18%)</span>
            <span>${formatMoney(factura.igv)}</span>
        </div>` : ''}
        <div class="ticket-row total-ticket">
            <span>TOTAL</span>
            <span>${formatMoney(factura.total)}</span>
        </div>
        <div class="ticket-line"></div>
        <div class="ticket-row">
            <span>Método de pago</span>
            <span>${factura.metodoPago}</span>
        </div>
        ${factura.metodoPago === 'Efectivo' ? `
        <div class="ticket-row">
            <span>Monto recibido</span>
            <span>${formatMoney(factura.montoRecibido)}</span>
        </div>
        <div class="ticket-row" style="color:var(--success)">
            <span>Vuelto</span>
            <span>${formatMoney(factura.vuelto)}</span>
        </div>` : ''}
    `;

    document.getElementById('modal-ticket').classList.remove('hidden');
}

document.getElementById('btn-cerrar-ticket').addEventListener('click', () => {
    document.getElementById('modal-ticket').classList.add('hidden');
});

document.getElementById('btn-imprimir-ticket').addEventListener('click', () => {
    window.print();
});

// ============================================================
// LISTA DE FACTURAS GUARDADAS
// ============================================================

function renderFacturas() {
    const facturas     = getLS('facturas');
    const container    = document.getElementById('lista-facturas');
    const busqueda     = document.getElementById('buscador-facturas').value.toLowerCase();
    const filtroEstado = document.getElementById('filtro-estado-factura').value;

    const filtradas = facturas.filter(f => {
        const matchBusqueda =
            (f.id || '').toLowerCase().includes(busqueda) ||
            String(f.mesa).includes(busqueda);
        const matchEstado = !filtroEstado || f.estado === filtroEstado;
        return matchBusqueda && matchEstado;
    }).reverse();

    if (filtradas.length === 0) {
        container.innerHTML = `<div class="empty-state">
            <i class="fas fa-file-invoice"></i>
            <p>No se encontraron facturas.</p>
        </div>`;
        return;
    }

    container.innerHTML = '';
    filtradas.forEach(f => {
        const estadoClass = f.estado === 'Pagada'  ? 'estado-pagada'
                          : f.estado === 'Anulada' ? 'estado-anulada'
                          : 'estado-pendiente';
        const estadoIcon  = f.estado === 'Pagada'  ? 'fa-check-circle'
                          : f.estado === 'Anulada' ? 'fa-ban'
                          : 'fa-clock';

        const card = document.createElement('div');
        card.className = 'factura-card';
        card.innerHTML = `
            <div class="factura-card-header">
                <span class="factura-code"><i class="fas fa-file-invoice"></i> ${f.id}</span>
                <span class="estado-badge ${estadoClass}">
                    <i class="fas ${estadoIcon}"></i> ${f.estado}
                </span>
                <span class="factura-total">${formatMoney(f.total)}</span>
            </div>
            <div class="factura-info">
                <span><i class="fas fa-table"></i> Mesa ${f.mesa}</span>
                <span><i class="fas fa-clock"></i> ${f.fechaHora}</span>
                <span><i class="fas fa-wallet"></i> ${f.metodoPago}</span>
                <span><i class="fas fa-receipt"></i> ${(f.pedidosIds || []).length} pedido(s)</span>
            </div>
            <div class="factura-actions">
                <button class="btn-secondary btn-sm" onclick="verDetalleFactura('${f.id}')">
                    <i class="fas fa-eye"></i> Ver Detalle
                </button>
                ${f.estado !== 'Anulada' ? `
                <button class="btn-danger btn-sm" onclick="iniciarAnulacion('${f.id}')">
                    <i class="fas fa-ban"></i> Anular
                </button>` : `
                <span style="font-size:0.75rem;color:var(--text-dim);padding:0.35rem 0.5rem">
                    <i class="fas fa-info-circle"></i>
                    ${f.motivoAnulacion ? 'Motivo: ' + f.motivoAnulacion : 'Anulada'}
                </span>`}
            </div>
        `;
        container.appendChild(card);
    });
}

document.getElementById('buscador-facturas').addEventListener('input', renderFacturas);
document.getElementById('filtro-estado-factura').addEventListener('change', renderFacturas);

// ============================================================
// VER DETALLE DE FACTURA
// ============================================================

function verDetalleFactura(id) {
    const f = getLS('facturas').find(fa => fa.id === id);
    if (f) mostrarTicket(f);
}
window.verDetalleFactura = verDetalleFactura;

// ============================================================
// ANULAR FACTURA
// ============================================================

function iniciarAnulacion(id) {
    facturaEnEdicion = id;
    document.getElementById('input-motivo-anulacion').value       = '';
    document.getElementById('error-motivo-anulacion').textContent = '';
    document.getElementById('modal-anular').classList.remove('hidden');
}
window.iniciarAnulacion = iniciarAnulacion;

document.getElementById('btn-cancelar-anulacion').addEventListener('click', () => {
    facturaEnEdicion = null;
    document.getElementById('modal-anular').classList.add('hidden');
});

document.getElementById('btn-confirmar-anulacion').addEventListener('click', () => {
    const motivo = document.getElementById('input-motivo-anulacion').value.trim();
    if (motivo.length < 10) {
        showError('error-motivo-anulacion', 'El motivo debe tener al menos 10 caracteres.');
        return;
    }

    const facturas = getLS('facturas');
    const idx = facturas.findIndex(f => f.id === facturaEnEdicion);
    if (idx === -1) return;

    if (facturas[idx].estado === 'Anulada') {
        showToast('Esta factura ya está anulada.', 'error');
        document.getElementById('modal-anular').classList.add('hidden');
        return;
    }

    facturas[idx].estado          = 'Anulada';
    facturas[idx].motivoAnulacion = motivo;
    facturas[idx].fechaAnulacion  = getFechaHora();
    setLS('facturas', facturas);

    // Revertir pedidos a Entregado para que puedan refacturarse
    const pedidosLS   = getLS('pedidos');
    const idsAnulados = new Set(facturas[idx].pedidosIds || []);
    pedidosLS.forEach(p => {
        if (idsAnulados.has(String(p.id)) || idsAnulados.has(String(p.codigo))) {
            p.estado       = 'Entregado';
            p.estadoCocina = 'Listo';
        }
    });
    setLS('pedidos', pedidosLS);

    document.getElementById('modal-anular').classList.add('hidden');
    facturaEnEdicion = null;
    showToast('Factura anulada correctamente.', 'success');
    renderFacturas();
});

// Cerrar modales haciendo clic en el fondo
document.getElementById('modal-ticket').addEventListener('click', function (e) {
    if (e.target === this) this.classList.add('hidden');
});
document.getElementById('modal-anular').addEventListener('click', function (e) {
    if (e.target === this) this.classList.add('hidden');
});

// ============================================================
// INICIALIZACIÓN
// ============================================================

document.addEventListener('DOMContentLoaded', () => {
    if (!localStorage.getItem('pedidos'))  setLS('pedidos',  []);
    if (!localStorage.getItem('platos'))   setLS('platos',   []);
    if (!localStorage.getItem('facturas')) setLS('facturas', []);
});