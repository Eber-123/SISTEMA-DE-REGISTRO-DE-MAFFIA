// app.js - Dashboard principal
class DashboardApp {
    constructor() {
        this.init();
    }

    init() {
        this.actualizarEstadisticas();
        this.escucharCambiosStorage();
    }

    actualizarEstadisticas() {
        // Obtener platos
        const platos = JSON.parse(localStorage.getItem('platos')) || [];
        const platosActivos = platos.filter(p => p.estado === 'Activo').length;
        
        // Obtener pedidos
        const pedidos = JSON.parse(localStorage.getItem('pedidos')) || [];
        const pedidosActivos = pedidos.filter(p => 
            p.estado !== 'Pagado' && p.estado !== 'Cancelado'
        ).length;
        
        // Pedidos en cocina (pendientes y en preparación)
        const enCocina = pedidos.filter(p => 
            p.estado !== 'Cancelado' &&
            (p.estadoCocina === 'Pendiente' || p.estadoCocina === 'En preparación')
        ).length;
        
        // Pedidos listos
        const listos = pedidos.filter(p => 
            p.estado !== 'Pagado' &&
            p.estado !== 'Cancelado' &&
            p.estadoCocina === 'Listo'
        ).length;
        
        // Actualizar DOM
        document.getElementById('totalPlatos').textContent = platosActivos;
        document.getElementById('totalPedidos').textContent = pedidosActivos;
        document.getElementById('enCocina').textContent = enCocina;
        document.getElementById('listos').textContent = listos;
    }

    escucharCambiosStorage() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'platos' || e.key === 'pedidos') {
                this.actualizarEstadisticas();
            }
        });
    }
}

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    new DashboardApp();
})