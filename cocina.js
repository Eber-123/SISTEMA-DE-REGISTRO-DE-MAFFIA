// cocina.js - Módulo 3: Tablero de Cocina -MAFFIA Restaurante Oriental
class ControlCocina {
    constructor() {
        this.pedidos = [];
        this.platos  = [];          // ← catálogo de platos para enriquecer ítems
        this.filtro  = 'todos';
        this.orden   = 'hora';
        this.init();
    }

    init() {
        this.cargarDatos();
        this.registrarEventos();
        this.actualizarVista();
        setInterval(() => {
            this.cargarDatos();
            this.actualizarVista();
        }, 15000);
    }

    // ── Carga pedidos Y catálogo de platos ──────────────────────────────────
    cargarDatos() {
        this.pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
        this.pedidos.forEach(p => {
    if (!p.codigo && p.id) p.codigo = p.id;
    if (!p.id && p.codigo) p.id = p.codigo;
});
        this.platos  = JSON.parse(localStorage.getItem('platos'))  || [];
        
    }
    

    guardarPedidos() {
        localStorage.setItem('pedidos', JSON.stringify(this.pedidos));
        this.actualizarVista();
        window.dispatchEvent(new StorageEvent('storage', { key: 'pedidos' }));
    }

    registrarEventos() {
        window.addEventListener('storage', (e) => {
            // Reacciona tanto a cambios en pedidos como en el catálogo de platos
            if (e.key === 'pedidos' || e.key === 'platos') {
                this.cargarDatos();
                this.actualizarVista();
            }
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                this.filtro = btn.dataset.filter;
                this.actualizarVista();
            });
        });

        const sortSelect = document.getElementById('sortSelect');
        if (sortSelect) {
            sortSelect.addEventListener('change', () => {
                this.orden = sortSelect.value;
                this.actualizarVista();
            });
        }
    }

    // ── Helpers ─────────────────────────────────────────────────────────────

    formatearFecha(fecha) {
        if (!fecha) return '';
        const d = new Date(fecha);
        if (isNaN(d.getTime())) return fecha;
        return d.toLocaleString('es-PE', {
            day: '2-digit', month: '2-digit', year: 'numeric',
            hour: '2-digit', minute: '2-digit'
        });
    }

    estadoGeneral(pedido) {
        if (!pedido.platos || pedido.platos.length === 0) {
            return pedido.estadoCocina || 'Pendiente';
        }

        const estados = pedido.platos.map(
            i => i.estadoPlato || pedido.estadoCocina || 'Pendiente'
        );

        if (estados.every(e => e === 'Listo')) return 'Listo';
        if (estados.some(e => e === 'En preparación' || e === 'Listo')) return 'En preparación';
        return 'Pendiente';
    }

    progresoEstado(estado) {
        if (estado === 'Listo')          return 100;
        if (estado === 'En preparación') return 50;
        return 10;
    }

    /**
     * INTEGRACIÓN PLATOS
     * Devuelve la info de cocina (alérgenos + modificable) para un ítem.
     * Prioridad: datos ya guardados en el ítem → catálogo en memoria.
     * Así funciona aunque el módulo de platos no esté cargado en la misma
     * pestaña.
     */
    _infoCocinaItem(item) {
        // 1. Intentar con lo que ya viene en el ítem del pedido
        let alergenos = [];
        if (Array.isArray(item.alergenos)) {
            alergenos = item.alergenos.filter(a => a && a.toLowerCase() !== 'ninguno');
        } else if (typeof item.alergenos === 'string' && item.alergenos.trim()) {
            alergenos = item.alergenos.split(',').map(a => a.trim())
                            .filter(a => a && a.toLowerCase() !== 'ninguno');
        }

        // Añadir otroAlergeno si existe
        const otro = (item.otroAlergeno || '').trim();
        if (otro && !alergenos.includes(otro)) alergenos.push(otro);

        // Modificaciones permitidas del catálogo (field "modificable")
        let modificable = (item.modificable || '').trim();

        // 2. Si falta algún dato, buscar en el catálogo
        const sinAlergenos   = alergenos.length === 0;
        const sinModificable = !modificable;

        if ((sinAlergenos || sinModificable) && item.platoId) {
            const catalogo = this.platos.find(p => String(p.id) === String(item.platoId));
            if (catalogo) {
                if (sinAlergenos) {
                    alergenos = (catalogo.alergenos || [])
                        .filter(a => a && a.toLowerCase() !== 'ninguno');
                    const otroC = (catalogo.otroAlergeno || '').trim();
                    if (otroC && !alergenos.includes(otroC)) alergenos.push(otroC);
                }
                if (sinModificable) {
                    modificable = (catalogo.modificable || '').trim();
                }
            }
        }

        // Observación del mozo para ese plato específico (escrita al tomar el pedido)
        const observacion = (item.modificaciones || item.observacion || item.obs || '').trim();

        return { alergenos, modificable, observacion };
    }

    // ── Acciones ─────────────────────────────────────────────────────────────
cambiarEstadoPlato(pedidoId, itemIndex, nuevoEstado) {
    const pedido = this.pedidos.find(p => p.codigo === pedidoId);
    if (!pedido) return;

    if (pedido.estado === 'Cancelado') {
        this.mostrarToast('No se puede modificar un pedido cancelado', 'error');
        return;
    }

    const estadoActual = pedido.platos[itemIndex].estadoPlato || 'Pendiente';
    
    // Definir orden de progresión
    const orden = ['Pendiente', 'En preparación', 'Listo'];
    const indiceActual = orden.indexOf(estadoActual);
    const indiceNuevo = orden.indexOf(nuevoEstado);
    
    // Solo permitir avanzar, no retroceder
    if (indiceNuevo < indiceActual) {
        this.mostrarToast('No se puede retroceder a un estado anterior', 'error');
        return;
    }

    pedido.platos[itemIndex].estadoPlato = nuevoEstado;
    pedido.estadoCocina = this.estadoGeneral(pedido);
    this.guardarPedidos();
    this.mostrarToast(`Plato marcado como ${nuevoEstato}`, 'ok');
}

    cambiarEstadoPedido(pedidoId, nuevoEstado) {
        const pedido = this.pedidos.find(p => p.codigo === pedidoId);
        if (!pedido) return;

        if (pedido.estado === 'Cancelado') {
            this.mostrarToast('No se puede modificar un pedido cancelado', 'error');
            return;
        }


        if (nuevoEstado === 'Listo') {
            const yaEnCocina = pedido.platos && pedido.platos.some(
                i => i.estadoPlato === 'En preparación' || i.estadoPlato === 'Listo'
            );
            if (!yaEnCocina && pedido.estadoCocina === 'Pendiente') {
                this.mostrarToast('El pedido debe iniciar preparación antes de marcarse como Listo', 'error');
                return;
            }
        }

        if (pedido.platos) {
            pedido.platos.forEach(item => {
                if (nuevoEstado === 'Listo') {
                    item.estadoPlato = 'Listo';
                } else if (nuevoEstado === 'En preparación') {
                    if (!item.estadoPlato || item.estadoPlato === 'Pendiente') {
                        item.estadoPlato = 'En preparación';
                    }
                }
            });
        }

        // 
        if (nuevoEstado === 'Listo') {
            pedido.estado = 'Entregado';
        } else {
            pedido.estado = nuevoEstado;
        }

        pedido.estadoCocina = nuevoEstado;

        this.guardarPedidos(); // ✔️ guarda cambios

        const mensajes = {
            'En preparación': 'Pedido enviado a preparación',
            'Listo': 'Pedido marcado como listo para servir'
        };
        this.mostrarToast(mensajes[nuevoEstado] || '', 'ok');
    }

        mostrarToast(mensaje, tipo = 'ok') {
            const toast = document.getElementById('toastCocina');
            if (!toast) return;
            
            // Limpiar clases anteriores
            toast.className = 'toast-cocina';
            
            // Agregar clase según tipo
            if (tipo === 'ok') {
                toast.classList.add('toast-success');
            } else if (tipo === 'error') {
                toast.classList.add('toast-error');
            }
            
            // Crear contenido con icono
            const icono = tipo === 'ok' ? 'fa-check-circle' : 'fa-exclamation-circle';
            toast.innerHTML = `
                <div class="toast-inner">
                    <i class="fas ${icono}"></i>
                    <span>${mensaje}</span>
                </div>
            `;
            
            toast.classList.add('show');
            
            clearTimeout(this._toastTimer);
            this._toastTimer = setTimeout(() => {
                toast.classList.remove('show');
            }, 3500);
        }

    // ── Render ───────────────────────────────────────────────────────────────

    actualizarVista() {
  let pedidosCocina = this.pedidos.filter(p => {
    const est = (p.estado || '').toLowerCase();
    return est !== 'cancelado' && est !== 'pagado' && est !== 'facturado';
});

        let lista = pedidosCocina;
        if (this.filtro === 'urgente') {
            lista = lista.filter(p => p.urgente);
        } else if (this.filtro !== 'todos') {
            lista = lista.filter(p => this.estadoGeneral(p) === this.filtro);
        }

        lista = [...lista];
        switch (this.orden) {
            case 'horaDesc':
                lista.sort((a, b) =>
                    Number(b.codigo.replace('PED','')) - Number(a.codigo.replace('PED',''))
                );
                break;

            case 'tiempo':
                lista.sort((a, b) =>
                    (b.tiempoTotal || 0) - (a.tiempoTotal || 0)
                );
                break;

            case 'urgente':
                lista.sort((a, b) =>
                    (b.urgente ? 1 : 0) - (a.urgente ? 1 : 0)
                );
                break;

            default:
                lista.sort((a, b) =>
                    Number(a.codigo.replace('PED','')) - Number(b.codigo.replace('PED',''))
                );
                break;
        }

        const pendientes = pedidosCocina.filter(p => this.estadoGeneral(p) === 'Pendiente').length;
        const enPrep     = pedidosCocina.filter(p => this.estadoGeneral(p) === 'En preparación').length;
        const listos     = pedidosCocina.filter(p => this.estadoGeneral(p) === 'Listo').length;

        const el = id => document.getElementById(id);
        if (el('pendientesCount'))  el('pendientesCount').textContent  = pendientes;
        if (el('preparacionCount')) el('preparacionCount').textContent = enPrep;
        if (el('listosCount'))      el('listosCount').textContent      = listos;

        const container = el('cocinaPedidos');
        if (!container) return;

        if (lista.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-check-circle"></i>
                    <p>No hay pedidos que mostrar</p>
                </div>`;
            return;
        }

        container.innerHTML = lista.map(p => this.renderizarPedido(p)).join('');
    }

    renderizarPedido(pedido) {
        const eg        = this.estadoGeneral(pedido);
        const esUrgente = !!pedido.urgente;
        const tiempoMax = pedido.tiempoTotal ||
            (pedido.platos?.length ? Math.max(...pedido.platos.map(i => parseInt(i.tiempo) || 0)) : 0);
        const mozo      = pedido.mozo || pedido.cliente || '—';
        const progreso  = this.progresoEstado(eg);
        const fecha     = this.formatearFecha(pedido.fecha);

        const estadoIcono = { 'Pendiente': '⏳', 'En preparación': '🔥', 'Listo': '✅' };
        const badgeClass  = eg === 'Pendiente'      ? 'estado-pendiente'
                          : eg === 'En preparación' ? 'estado-preparacion'
                          : 'estado-listo';

        // ── Platos individuales ──────────────────────────────────────────────
        const platosHTML = (pedido.platos || []).map((item, idx) => {
            const epPlato = item.estadoPlato || pedido.estadoCocina || 'Pendiente';
            const epClass = epPlato === 'Pendiente'      ? 'estado-pendiente'
                          : epPlato === 'En preparación' ? 'estado-preparacion'
                          : 'estado-listo';
            const cantidad = item.cantidad || 1;

            // ── Datos de cocina enriquecidos (alérgenos + modificable + obs mozo)
const { alergenos, modificable } = this._infoCocinaItem(item);
const aleStr = alergenos.join(', ');

// 🔥 NUEVO: extras bonitos en tags
let extrasHTML = '';

if (Array.isArray(item.observaciones) && item.observaciones.length > 0) {
    const tags = item.observaciones.map(o => `
        <span class="obs-extra-tag">
            ${o.texto}
            ${o.extra > 0 ? `<strong>+S/ ${o.extra.toFixed(2)}</strong>` : ''}
        </span>
    `).join('');

    extrasHTML = `
        <div class="plato-obs-extras">
            <i class="fas fa-plus-circle"></i>
            ${tags}
        </div>
    `;
}

            return `
                <div class="plato-row">
                    <div class="plato-cant">${cantidad}x</div>
                    <div class="plato-info">
                        <span class="plato-nombre">${item.nombre || ''}</span>
                        ${item.tiempo
                            ? `<span class="plato-tiempo">
                                <i class="fas fa-clock"></i> ${item.tiempo} min
                               </span>`
                            : ''}

                        <!-- OBSERVACIÓN DEL MOZO (por pedido) -->
 ${extrasHTML || `
    <div class="plato-sin-obs">
        <i class="fas fa-minus-circle"></i> Sin extras
    </div>
`}

                        <!-- MODIFICACIONES PERMITIDAS (del catálogo de platos) -->
                        ${modificable
                            ? `<div class="plato-modificable">
                                <i class="fas fa-sliders-h"></i>
                                <span><strong>Modificaciones posibles:</strong> ${modificable}</span>
                               </div>`
                            : `<div class="plato-sin-modificable">
                                <i class="fas fa-ban"></i> Sin modificaciones registradas
                               </div>`}

                        <!-- ALÉRGENOS (del catálogo, actualizados en tiempo real) -->
                        ${aleStr
                            ? `<div class="plato-alergenos">
                                <i class="fas fa-exclamation-triangle"></i>
                                <span><strong>⚠ Alérgenos:</strong> ${aleStr}</span>
                               </div>`
                            : `<div class="plato-sin-alergenos">
                                <i class="fas fa-shield-alt"></i> Sin alérgenos
                               </div>`}
                    </div>
<div class="plato-estado-buttons">
    <button type="button" 
        class="btn-estado-plato ${epPlato === 'Pendiente' ? 'active' : ''}"
        data-estado="Pendiente"
        ${epPlato !== 'Pendiente' ? 'disabled' : ''}
        onclick="controlCocina.cambiarEstadoPlato('${pedido.codigo}', ${idx}, 'Pendiente')">
        <i class="fas fa-hourglass-start"></i>
        <span>Pendiente</span>
    </button>
    <button type="button" 
        class="btn-estado-plato ${epPlato === 'En preparación' ? 'active' : ''}"
        data-estado="En preparación"
        ${epPlato === 'Listo' ? 'disabled' : ''}
        onclick="controlCocina.cambiarEstadoPlato('${pedido.codigo}', ${idx}, 'En preparación')">
        <i class="fas fa-fire"></i>
        <span>Cocinando</span>
    </button>
    <button type="button" 
        class="btn-estado-plato ${epPlato === 'Listo' ? 'active' : ''}"
        data-estado="Listo"
        onclick="controlCocina.cambiarEstadoPlato('${pedido.codigo}', ${idx}, 'Listo')">
        <i class="fas fa-check-circle"></i>
        <span>Listo</span>
    </button>
</div>
                </div>`;
        }).join('');

        return `
            <div class="pedido-cocina-card ${esUrgente ? 'pedido-urgente' : ''}">

                ${esUrgente ? `
                    <div class="urgente-banner">
                        <i class="fas fa-exclamation-triangle"></i>
                        <strong>PEDIDO URGENTE</strong>
                        ${pedido.justificacionUrgente
                            ? `<span>— ${pedido.justificacionUrgente}</span>`
                            : ''}
                    </div>` : ''}

                <!-- ENCABEZADO -->
                <div class="pedido-header">
                    <div class="pedido-header-info">
                        <h3 class="pedido-codigo">
                            Pedido #${pedido.codigo}
                            ${esUrgente ? '<span class="urgente-chip">URGENTE</span>' : ''}
                        </h3>
                        <div class="pedido-meta">
                            <span><i class="fas fa-chair"></i> Mesa ${pedido.mesa}</span>
                            <span><i class="fas fa-user"></i> ${mozo}</span>
                            <span><i class="fas fa-clock"></i> ${fecha}</span>
                            <span><i class="fas fa-hourglass-half"></i> ${tiempoMax} min estimados</span>
                            <span class="prioridad-label ${esUrgente ? 'prioridad-alta' : 'prioridad-normal'}">
                                <i class="fas fa-flag"></i>
                                Prioridad: ${esUrgente ? 'Alta' : 'Normal'}
                            </span>
                        </div>
                    </div>
                    <div class="pedido-header-estado">
                        <span class="estado-badge ${badgeClass}">
                            ${estadoIcono[eg] || ''} ${eg}
                        </span>
                    </div>
                </div>

                <!-- PLATOS -->
                <div class="platos-detalle">
                    <p class="platos-titulo">
                        <i class="fas fa-utensils"></i> Platos del pedido
                    </p>
                    ${platosHTML || '<p class="sin-platos">Sin platos registrados</p>'}
                </div>

                <!-- OBSERVACIÓN GENERAL DEL PEDIDO -->
                ${pedido.observaciones
                    ? `<div class="obs-general">
                        <i class="fas fa-sticky-note"></i>
                        <span><strong>Observación general del pedido:</strong> ${pedido.observaciones}</span>
                       </div>`
                    : ''}

                <!-- ACCIONES GLOBALES -->
                <div class="item-actions">
                    ${this.renderizarBotones(pedido, eg)}
                </div>

                <!-- BARRA DE PROGRESO -->
                <div class="progress-bar">
                    <div class="progress-fill progress-${eg === 'Pendiente' ? 'pendiente' : eg === 'En preparación' ? 'prep' : 'listo'}"
                         style="width: ${progreso}%">
                    </div>
                </div>

            </div>`;
    }

renderizarBotones(pedido, estadoGeneral) {
    switch (estadoGeneral) {
        case 'Pendiente':
            return `
                <button class="btn-accion btn-preparacion"
                    onclick="controlCocina.cambiarEstadoPedido('${pedido.codigo}', 'En preparación')">
                    <i class="fas fa-play"></i>
                    <span class="btn-text">Iniciar preparación</span>
                    <span class="btn-subtext">Comienza la cocina</span>
                </button>`;
        case 'En preparación':
            return `
                <button class="btn-accion btn-listo-pedido"
                    onclick="controlCocina.cambiarEstadoPedido('${pedido.codigo}', 'Listo')">
                    <i class="fas fa-check-double"></i> 
                    <span class="btn-text">Marcar todos como listos</span>
                    <span class="btn-subtext">Presiona para completar</span>
                </button>`;
            case 'Listo':
                return `
                    <button class="btn-accion btn-completado" disabled>
                        <i class="fas fa-star"></i> 
                        <span class="btn-text">¡Listo para servir!</span>
                    </button>`;

        default:
            return '';
    }
}
}

let controlCocina;
document.addEventListener('DOMContentLoaded', () => {
    controlCocina = new ControlCocina();
});