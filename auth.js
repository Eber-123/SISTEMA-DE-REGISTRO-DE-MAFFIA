// auth.js - Sistema central de autenticación y roles MAFFIA
// Incluir en TODAS las páginas antes de cualquier otro script

const Auth = {
    ROLES: {
        CLIENTE: 'Cliente',
        MOZO: 'Mozo',
        COCINERO: 'Cocinero',
        ADMINISTRADOR: 'Administrador'
    },

    // Permisos por rol
    PERMISOS: {
        Cliente: ['ver_menu', 'hacer_pedidos', 'ver_historial_propio'],
        Mozo: ['ver_pedidos', 'cambiar_estado_pedido', 'asignar_mesa'],
        Cocinero: ['ver_pedidos_cocina', 'marcar_preparado'],
        Administrador: ['gestionar_usuarios', 'gestionar_productos', 'gestionar_pedidos', 'ver_reportes', 'ver_ventas', 'ver_pedidos', 'cambiar_estado_pedido', 'asignar_mesa', 'ver_pedidos_cocina', 'marcar_preparado']
    },

    // Obtener sesión activa
    getSesion() {
        const s = localStorage.getItem('maffia_sesion');
        return s ? JSON.parse(s) : null;
    },

    // Guardar sesión
    setSesion(usuario) {
        localStorage.setItem('maffia_sesion', JSON.stringify({
            id: usuario.id,
            nombre: usuario.nombre,
            apellidos: usuario.apellidos,
            correo: usuario.correo,
            rol: usuario.rol,
            loginTime: Date.now()
        }));
    },

    // Cerrar sesión
    cerrarSesion() {
        localStorage.removeItem('maffia_sesion');
        window.location.href = 'login.html';
    },

    // Verificar si está autenticado
    estaAutenticado() {
        return this.getSesion() !== null;
    },

    // Obtener rol actual
    getRol() {
        const s = this.getSesion();
        return s ? s.rol : null;
    },

    // Verificar permiso
    tienePermiso(permiso) {
        const rol = this.getRol();
        if (!rol) return false;
        return (this.PERMISOS[rol] || []).includes(permiso);
    },

    // Proteger página - redirige si no autenticado o no tiene rol permitido
    proteger(rolesPermitidos = []) {
        if (!this.estaAutenticado()) {
            window.location.href = 'login.html';
            return false;
        }
        if (rolesPermitidos.length > 0 && !rolesPermitidos.includes(this.getRol())) {
            alert('No tienes permiso para acceder a esta sección.');
            window.location.href = 'index.html';
            return false;
        }
        return true;
    },

    // Obtener todos los usuarios
    getUsuarios() {
        return JSON.parse(localStorage.getItem('maffia_usuarios')) || [];
    },

    // Guardar usuarios
    setUsuarios(usuarios) {
        localStorage.setItem('maffia_usuarios', JSON.stringify(usuarios));
    },

    // Buscar usuario por correo
    buscarPorCorreo(correo) {
        return this.getUsuarios().find(u => u.correo.toLowerCase() === correo.toLowerCase());
    },

    // Inicializar con admin por defecto si no hay usuarios
    inicializarDatos() {
        const usuarios = this.getUsuarios();
        if (usuarios.length === 0) {
            this.setUsuarios([
                {
                    id: 1,
                    nombre: 'Admin',
                    apellidos: 'MAFFIA',
                    correo: 'admin@maffia.com',
                    celular: '999000001',
                    contrasena: btoa('admin123'),
                    rol: 'Administrador',
                    estado: 'Activo',
                    fechaRegistro: new Date().toISOString()
                },
                {
                    id: 2,
                    nombre: 'Carlos',
                    apellidos: 'Mozo',
                    correo: 'mozo@maffia.com',
                    celular: '999000002',
                    contrasena: btoa('mozo123'),
                    rol: 'Mozo',
                    estado: 'Activo',
                    fechaRegistro: new Date().toISOString()
                },
                {
                    id: 3,
                    nombre: 'Ana',
                    apellidos: 'Chef',
                    correo: 'cocina@maffia.com',
                    celular: '999000003',
                    contrasena: btoa('cocina123'),
                    rol: 'Cocinero',
                    estado: 'Activo',
                    fechaRegistro: new Date().toISOString()
                }
            ]);
        }
    }
};

// Inicializar datos al cargar
Auth.inicializarDatos();