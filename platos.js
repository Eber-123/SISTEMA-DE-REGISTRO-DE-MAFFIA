// ============================================================
// platos.js - Gestión completa de platos
// MAFFIA Restaurante Oriental
// ============================================================

class GestionPlatos {
    constructor() {
        this.platos = [];
        this.editandoId = null;
        this.init();
    }

    // ─────────────────────────────────────────
    // INICIALIZACIÓN
    // ─────────────────────────────────────────

    init() {
        this.cargarPlatos();
        this.registrarEventos();
        this.actualizarListado();
        this.manejarAlergenos();
    }

    // ─────────────────────────────────────────
    // CARGA Y PERSISTENCIA
    // ─────────────────────────────────────────

    cargarPlatos() {
        const stored = localStorage.getItem('platos');
        this.platos = stored ? JSON.parse(stored) : [];

        // Datos de ejemplo si está vacío
        if (this.platos.length === 0) {
            this.platos = [
                {
                    id: '1',
                    codigo: 'PL001',
                    nombre: 'Lomo Saltado Oriental',
                    descripcion: 'Trozos de lomo de res salteados con cebolla, tomate, ají amarillo, acompañado de papas fritas y arroz jazmín',
                    categoria: 'Plato de fondo',
                    precio: 32.50,
                    tiempo: 25,
                    estado: 'Activo',
                    alergenos: ['Soya', 'Gluten'],
                    otroAlergeno: '',
                    modificable: 'Puede pedirse sin cebolla, sin ají, cambiar arroz por ensalada'
                },
                {
                    id: '2',
                    codigo: 'PL002',
                    nombre: 'Wantán Frito',
                    descripcion: 'Wantán relleno de cerdo y verduras, servido con salsa agridulce',
                    categoria: 'Entrada',
                    precio: 18.00,
                    tiempo: 15,
                    estado: 'Activo',
                    alergenos: ['Gluten', 'Huevo'],
                    otroAlergeno: '',
                    modificable: 'No permite modificaciones'
                }
            ];
            this.guardarPlatos();
        }
    }

    guardarPlatos() {
        const json = JSON.stringify(this.platos);
        localStorage.setItem('platos', json);
        
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'platos',
            newValue: json,
            storageArea: localStorage
        }));
        
        this.actualizarListado();
    }
        
    // ─────────────────────────────────────────
    // EVENTOS
    // ─────────────────────────────────────────

    registrarEventos() {
        document.getElementById('platoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.guardarPlato();
        });

        document.getElementById('cancelarEdicion').addEventListener('click', () => {
            this.cancelarEdicion();
        });

        document.getElementById('buscarInput').addEventListener('input', () => {
            this.filtrarPlatos();
        });

        document.getElementById('filtroEstado').addEventListener('change', () => {
            this.filtrarPlatos();
        });
    }

    manejarAlergenos() {
        const checkboxes = document.querySelectorAll('.alergeno');
        const otroInput = document.getElementById('otroAlergeno');

        checkboxes.forEach(cb => {
            cb.addEventListener('change', () => {
                // Si selecciona "Ninguno", desmarcar los demás
                if (cb.value === 'Ninguno' && cb.checked) {
                    checkboxes.forEach(c => {
                        if (c.value !== 'Ninguno') c.checked = false;
                    });
                    otroInput.style.display = 'none';
                }

                // Si selecciona "Otro", mostrar campo de texto
                if (cb.value === 'Otro' && cb.checked) {
                    otroInput.style.display = 'block';
                } else if (cb.value === 'Otro' && !cb.checked) {
                    otroInput.style.display = 'none';
                    otroInput.value = '';
                }

                // Si se marca cualquier otro, desmarcar "Ninguno"
                if (cb.value !== 'Ninguno' && cb.checked) {
                    const ninguno = document.querySelector('.alergeno[value="Ninguno"]');
                    if (ninguno) ninguno.checked = false;
                }
            });
        });
    }

    // ─────────────────────────────────────────
    // VALIDACIÓN
    // ─────────────────────────────────────────

    validarPlato(datos) {
        const errores = {};

        // Código
        if (!datos.codigo) {
            errores.codigo = 'El código es obligatorio';
        } else if (datos.codigo.length < 3) {
            errores.codigo = 'Mínimo 3 caracteres';
        } else if (datos.codigo !== datos.codigo.trim()) {
            errores.codigo = 'No debe tener espacios al inicio o final';
        } else if (!this.editandoId && this.platos.some(p => p.codigo === datos.codigo)) {
            errores.codigo = 'El código ya existe';
        }

        // Nombre
        if (!datos.nombre) {
            errores.nombre = 'El nombre es obligatorio';
        } else if (datos.nombre.length < 3) {
            errores.nombre = 'Mínimo 3 caracteres';
        } else if (datos.nombre.length > 60) {
            errores.nombre = 'Máximo 60 caracteres';
        } else if (/^\d+$/.test(datos.nombre)) {
            errores.nombre = 'No puede ser solo números';
        }

        // Descripción
        if (!datos.descripcion) {
            errores.descripcion = 'La descripción es obligatoria';
        } else if (datos.descripcion.length < 10) {
            errores.descripcion = 'Mínimo 10 caracteres';
        } else if (datos.descripcion.length > 250) {
            errores.descripcion = 'Máximo 250 caracteres';
        }

        // Categoría
        if (!datos.categoria) {
            errores.categoria = 'Seleccione una categoría';
        }

        // Precio
        if (!datos.precio) {
            errores.precio = 'El precio es obligatorio';
        } else if (isNaN(datos.precio) || datos.precio <= 0) {
            errores.precio = 'Precio debe ser mayor a 0';
        } else if (datos.precio > 500) {
            errores.precio = 'Precio máximo S/ 500';
        }

        // Tiempo
        if (!datos.tiempo) {
            errores.tiempo = 'El tiempo es obligatorio';
        } else if (isNaN(datos.tiempo) || datos.tiempo <= 0) {
            errores.tiempo = 'Tiempo debe ser mayor a 0';
        } else if (datos.tiempo > 120) {
            errores.tiempo = 'Tiempo máximo 120 minutos';
        }

        // Estado
        if (!datos.estado) {
            errores.estado = 'Seleccione un estado';
        }

        // Alérgenos
        if (datos.alergenos.length === 0) {
            errores.alergenos = 'Seleccione al menos un alérgeno';
        }
        if (datos.alergenos.includes('Otro') && !datos.otroAlergeno) {
            errores.alergenos = 'Especifique el otro alérgeno';
        }

        // Modificable
        if (!datos.modificable) {
            errores.modificable = 'Este campo es obligatorio';
        } else if (datos.modificable.length > 200) {
            errores.modificable = 'Máximo 200 caracteres';
        }

        return errores;
    }

    mostrarErrores(errores) {
        for (const [campo, mensaje] of Object.entries(errores)) {
            const errorSpan = document.getElementById(`${campo}Error`);
            if (errorSpan) errorSpan.textContent = mensaje;
        }
    }

    limpiarErrores() {
        document.querySelectorAll('.error-message').forEach(span => span.textContent = '');
    }

    // ─────────────────────────────────────────
    // CRUD - GUARDAR / EDITAR / ELIMINAR
    // ─────────────────────────────────────────

    guardarPlato() {
        const datos = {
            id: this.editandoId || Date.now().toString(),
            codigo: document.getElementById('codigo').value.trim(),
            nombre: document.getElementById('nombre').value.trim(),
            descripcion: document.getElementById('descripcion').value.trim(),
            categoria: document.getElementById('categoria').value,
            precio: parseFloat(document.getElementById('precio').value),
            tiempo: parseInt(document.getElementById('tiempo').value),
            estado: document.getElementById('estado').value,
            alergenos: Array.from(document.querySelectorAll('.alergeno:checked')).map(cb => cb.value),
            otroAlergeno: document.getElementById('otroAlergeno').value.trim(),
            modificable: document.getElementById('modificable').value.trim()
        };

        const errores = this.validarPlato(datos);

        if (Object.keys(errores).length > 0) {
            this.mostrarErrores(errores);
            return;
        }

        if (this.editandoId) {
            const index = this.platos.findIndex(p => p.id === this.editandoId);
            this.platos[index] = datos;
            alert('Plato actualizado exitosamente');
            this.cancelarEdicion();
        } else {
            this.platos.push(datos);
            alert('Plato registrado exitosamente');
            document.getElementById('platoForm').reset();
        }

        this.guardarPlatos();
        this.limpiarErrores();
    }

    editarPlato(id) {
        const plato = this.platos.find(p => p.id === id);
        if (!plato) return;

        this.editandoId = id;

        document.getElementById('codigo').value      = plato.codigo;
        document.getElementById('nombre').value      = plato.nombre;
        document.getElementById('descripcion').value = plato.descripcion;
        document.getElementById('categoria').value   = plato.categoria;
        document.getElementById('precio').value      = plato.precio;
        document.getElementById('tiempo').value      = plato.tiempo;
        document.getElementById('estado').value      = plato.estado;
        document.getElementById('modificable').value = plato.modificable;

        // Marcar alérgenos
        document.querySelectorAll('.alergeno').forEach(cb => cb.checked = false);
        plato.alergenos.forEach(alergeno => {
            const cb = document.querySelector(`.alergeno[value="${alergeno}"]`);
            if (cb) cb.checked = true;
        });

        if (plato.alergenos.includes('Otro')) {
            document.getElementById('otroAlergeno').style.display = 'block';
            document.getElementById('otroAlergeno').value = plato.otroAlergeno;
        }

        document.getElementById('cancelarEdicion').style.display = 'inline-block';
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    cancelarEdicion() {
        this.editandoId = null;
        document.getElementById('platoForm').reset();
        document.getElementById('cancelarEdicion').style.display = 'none';
        this.limpiarErrores();

        document.querySelectorAll('.alergeno').forEach(cb => cb.checked = false);
        document.getElementById('otroAlergeno').style.display = 'none';
        document.getElementById('otroAlergeno').value = '';
    }

    eliminarPlato(id) {
        const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
    
        const enUso = pedidos
            .filter(p => p.estado !== 'Cancelado')
            .some(p => 
                (p.platos || []).some(item => String(item.id) === String(id))
            );

        if (enUso) {
            alert('No se puede eliminar el plato porque tiene pedidos asociados');
            return;
        }

        if (confirm('¿Está seguro de eliminar este plato?')) {
            this.platos = this.platos.filter(p => p.id !== id);
            this.guardarPlatos();
            alert('Plato eliminado exitosamente');
        }
    }

    cambiarEstado(id) {
        const plato = this.platos.find(p => p.id === id);
        if (plato) {
            plato.estado = plato.estado === 'Activo' ? 'Inactivo' : 'Activo';
            this.guardarPlatos();
            alert(`Plato ${plato.estado === 'Activo' ? 'activado' : 'desactivado'} exitosamente`);
        }
    }

    // ─────────────────────────────────────────
    // FILTRADO Y RENDERIZADO
    // ─────────────────────────────────────────

    filtrarPlatos() {
        const busqueda    = document.getElementById('buscarInput').value.toLowerCase();
        const filtroEstado = document.getElementById('filtroEstado').value;

        let filtrados = this.platos;

        if (busqueda) {
            filtrados = filtrados.filter(p =>
                p.nombre.toLowerCase().includes(busqueda) ||
                p.categoria.toLowerCase().includes(busqueda)
            );
        }

        if (filtroEstado !== 'todos') {
            filtrados = filtrados.filter(p => p.estado === filtroEstado);
        }

        this.renderizarListado(filtrados);
    }

    renderizarListado(platos) {
        const container = document.getElementById('platosList');

        if (platos.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-utensils"></i>
                    <p>No hay platos registrados</p>
                </div>`;
            return;
        }

        container.innerHTML = platos.map(plato => `
            <div class="item-card">
                <div class="item-header">
                    <div>
                        <h3>${plato.nombre}</h3>
                        <small>Código: ${plato.codigo} | Categoría: ${plato.categoria}</small>
                    </div>
                    <span class="item-badge ${plato.estado === 'Inactivo' ? 'inactive' : ''}">
                        ${plato.estado === 'Activo' ? '✅ Activo' : '❌ Inactivo'}
                    </span>
                </div>
                <p><strong>Descripción:</strong> ${plato.descripcion}</p>
                <p><strong>Precio:</strong> S/ ${plato.precio.toFixed(2)} | <strong>Tiempo:</strong> ${plato.tiempo} min</p>
                <p><strong>Alérgenos:</strong> ${plato.alergenos.join(', ')} ${plato.otroAlergeno ? `(${plato.otroAlergeno})` : ''}</p>
                <p><strong>Modificable:</strong> ${plato.modificable}</p>
                <div class="item-actions">
                    <button onclick="gestionPlatos.editarPlato('${plato.id}')" class="btn-secondary">
                        <i class="fas fa-edit"></i> Editar
                    </button>
                    <button onclick="gestionPlatos.cambiarEstado('${plato.id}')" class="btn-primary">
                        <i class="fas fa-sync-alt"></i> Cambiar Estado
                    </button>
                    <button onclick="gestionPlatos.eliminarPlato('${plato.id}')" class="btn-danger">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `).join('');
    }

    actualizarListado() {
        this.renderizarListado(this.platos);
    }
}

// ─────────────────────────────────────────
// INICIALIZAR AL CARGAR EL DOM
// ─────────────────────────────────────────

let gestionPlatos;
document.addEventListener('DOMContentLoaded', () => {
    gestionPlatos = new GestionPlatos();
});