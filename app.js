// Configuración Supabase
const SUPABASE_URL = 'https://qaxxggokkclsfsjfmtbs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xbiL5biH5Y9jUf9wfM-7Fg_C2TqshKs';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de Estado
let actividades = [];
let fechaFoco = new Date(); // Por defecto toma la fecha actual
let tooltipElem = null;
let sidebarOculto = false;
let vistaActual = 'gantt'; // 'gantt' o 'dashboard'
let idActividadAEliminar = null;

const COL_WIDTH_DIA = 68; // Ancho de cada columna de día en píxeles

// Colorimetría por Estado
const COLOR_ESTADO = {
    planificado: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', fill: '#2563EB', badgeBg: '#DBEAFE' },
    en_proceso: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', fill: '#D97706', badgeBg: '#FEF3C7' },
    en_revision: { bg: '#FAF5FF', border: '#A855F7', text: '#6B21A8', fill: '#9333EA', badgeBg: '#F3E8FF' },
    finalizado: { bg: '#ECFDF5', border: '#10B981', text: '#065F46', fill: '#059669', badgeBg: '#D1FAE5' },
    detenido: { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B', fill: '#DC2626', badgeBg: '#FEE2E2' }
};

const PORCENTAJES_ESTADO = {
    planificado: 0,
    en_proceso: 25,
    en_revision: 50,
    finalizado: 100,
    detenido: 0
};

document.addEventListener('DOMContentLoaded', () => {
    lucide.createIcons();
    crearTooltipElement();

    // Establecer el selector de mes en Septiembre por defecto (mes 8)
    fechaFoco.setMonth(8);
    document.getElementById('filter-mes').value = "8";

    setupEventListeners();
    setupScrollSynchronization();
    cargarActividades();
});

function crearTooltipElement() {
    tooltipElem = document.createElement('div');
    tooltipElem.className = 'gantt-tooltip';
    document.body.appendChild(tooltipElem);
}

function setupScrollSynchronization() {
    const sidebarBody = document.getElementById('gantt-sidebar-body');
    const timelineContainer = document.getElementById('timeline-container');

    let isSyncingSidebar = false;
    let isSyncingTimeline = false;

    sidebarBody.addEventListener('scroll', () => {
        if (!isSyncingSidebar) {
            isSyncingTimeline = true;
            timelineContainer.scrollTop = sidebarBody.scrollTop;
        }
        isSyncingSidebar = false;
    });

    timelineContainer.addEventListener('scroll', () => {
        if (!isSyncingTimeline) {
            isSyncingSidebar = true;
            sidebarBody.scrollTop = timelineContainer.scrollTop;
        }
        isSyncingTimeline = false;
    });
}

async function cargarActividades() {
    const { data, error } = await supabaseClient
        .from('actividades_gantt')
        .select('*')
        .order('fecha_inicio', { ascending: true });

    if (error) {
        console.error('Error al cargar actividades:', error);
        return;
    }

    actividades = data || [];
    poblarFiltroProyectos();
    poblarDatalistProyectos();
    renderTodo();
}

function renderTodo() {
    actualizarKPIs();
    if (vistaActual === 'gantt') {
        renderHeaderGrid();
        renderGantt();
    } else {
        renderDashboard();
    }
}

function renderHeaderGrid() {
    const headerContainer = document.getElementById('timeline-header');
    headerContainer.innerHTML = '';

    const anio = fechaFoco.getFullYear();
    const mes = fechaFoco.getMonth();
    const diasDelMes = getDiasDelMes(anio, mes);

    headerContainer.style.width = `${diasDelMes.length * COL_WIDTH_DIA}px`;

    diasDelMes.forEach(dia => {
        const col = document.createElement('div');
        col.className = 'time-col-header';
        col.style.width = `${COL_WIDTH_DIA}px`;
        col.style.minWidth = `${COL_WIDTH_DIA}px`;
        col.innerHTML = `${dia.diaNum} <span>${dia.nombreDia}</span>`;
        headerContainer.appendChild(col);
    });
}

function renderGantt() {
    const sidebarBody = document.getElementById('gantt-sidebar-body');
    const timelineBody = document.getElementById('timeline-body');
    const filtroProyecto = document.getElementById('filter-proyecto').value;
    const filtroEstado = document.getElementById('filter-estado').value;

    sidebarBody.innerHTML = '';
    timelineBody.innerHTML = '';

    const anio = fechaFoco.getFullYear();
    const mes = fechaFoco.getMonth();
    const diasDelMes = getDiasDelMes(anio, mes);
    const totalWidthPx = diasDelMes.length * COL_WIDTH_DIA;
    timelineBody.style.width = `${totalWidthPx}px`;

    let listaFiltrada = filtrarActividadesPorContexto(filtroProyecto, filtroEstado);

    listaFiltrada.forEach((act, index) => {
        const sidebarRow = document.createElement('div');
        sidebarRow.className = 'sidebar-row';
        sidebarRow.dataset.index = index;

        sidebarRow.innerHTML = `
            <div class="col-actividad">
                <div class="row-header-badge">
                    <span class="macro-badge">${act.proyecto || 'General'}</span>
                </div>
                <h4 title="${act.titulo}">${act.titulo}</h4>
                <div class="encargado-box">
                    <span class="encargado-label"><i data-lucide="user"></i> <strong>${act.encargado || 'Sin Asignar'}</strong></span>
                </div>
            </div>
            <div class="col-meta font-bold">${act.fecha_inicio}</div>
            <div class="col-meta font-bold">${act.fecha_fin}</div>
            <div class="col-meta">
                <span class="status-badge state-${act.estado}">${act.estado.replace('_', ' ').toUpperCase()}</span>
            </div>
            <div class="col-meta font-bold">${act.porcentaje_avance}%</div>
            <div class="col-acciones">
                <button class="btn-icon" title="Editar" onclick="abrirModalEditar('${act.id}')">
                    <i data-lucide="edit-2"></i>
                </button>
                <button class="btn-icon" title="Eliminar" onclick="solicitarEliminarActividad('${act.id}')">
                    <i data-lucide="trash-2"></i>
                </button>
            </div>
        `;
        sidebarBody.appendChild(sidebarRow);

        const timelineRow = document.createElement('div');
        timelineRow.className = 'timeline-row';
        timelineRow.dataset.index = index;
        timelineRow.style.width = `${totalWidthPx}px`;

        diasDelMes.forEach(() => {
            const cell = document.createElement('div');
            cell.className = 'time-cell';
            cell.style.width = `${COL_WIDTH_DIA}px`;
            cell.style.minWidth = `${COL_WIDTH_DIA}px`;
            timelineRow.appendChild(cell);
        });

        const bar = crearBarraGantt(act, diasDelMes);
        if (bar) timelineRow.appendChild(bar);

        timelineBody.appendChild(timelineRow);

        // Sincronización automática de altura por fila tras renderizar
        requestAnimationFrame(() => {
            const realHeight = sidebarRow.getBoundingClientRect().height;
            if (realHeight > 0) {
                sidebarRow.style.height = `${realHeight}px`;
                timelineRow.style.height = `${realHeight}px`;
            }
        });
    });

    lucide.createIcons();
}

function filtrarActividadesPorContexto(filtroProyecto = 'todos', filtroEstado = 'todos') {
    const anio = fechaFoco.getFullYear();
    const mes = fechaFoco.getMonth();
    const diasDelMes = getDiasDelMes(anio, mes);

    return actividades.filter(a => {
        const matchProyecto = filtroProyecto === 'todos' || a.proyecto === filtroProyecto;
        const matchEstado = filtroEstado === 'todos' || a.estado === filtroEstado;

        const fInicio = new Date(a.fecha_inicio + 'T00:00:00');
        const fFin = new Date(a.fecha_fin + 'T00:00:00');
        const mesInicioAct = fInicio.getMonth();
        const anioInicioAct = fInicio.getFullYear();
        const mesFinAct = fFin.getMonth();
        const anioFinAct = fFin.getFullYear();

        const esDelMes = (mesInicioAct === mes && anioInicioAct === anio) ||
            (mesFinAct === mes && anioFinAct === anio) ||
            (fInicio <= diasDelMes[0].fecha && fFin >= diasDelMes[diasDelMes.length - 1].fecha);

        return matchProyecto && matchEstado && esDelMes;
    });
}

function renderDashboard() {
    const filtroProyecto = document.getElementById('filter-proyecto').value;
    const listaMes = filtrarActividadesPorContexto(filtroProyecto, 'todos');

    // 1. Gráfico de Proyectos Macro
    const proyectosCont = document.getElementById('dash-proyectos-container');
    proyectosCont.innerHTML = '';
    const mapProyectos = {};
    listaMes.forEach(a => {
        const p = a.proyecto || 'General';
        if (!mapProyectos[p]) mapProyectos[p] = { total: 0, sumaAvance: 0 };
        mapProyectos[p].total++;
        mapProyectos[p].sumaAvance += (a.porcentaje_avance || 0);
    });

    if (Object.keys(mapProyectos).length === 0) {
        proyectosCont.innerHTML = '<p class="dash-empty">No hay actividades para el filtro seleccionado en este mes.</p>';
    } else {
        for (let [proj, data] of Object.entries(mapProyectos)) {
            const promAvance = Math.round(data.sumaAvance / data.total);
            const row = document.createElement('div');
            row.className = 'dash-stat-row';
            row.innerHTML = `
                <div class="dash-stat-info">
                    <span class="dash-stat-title">${proj}</span>
                    <span class="dash-stat-meta">${data.total} actividades • <strong>${promAvance}% prom.</strong></span>
                </div>
                <div class="dash-progress-track">
                    <div class="dash-progress-fill" style="width: ${promAvance}%"></div>
                </div>
            `;
            proyectosCont.appendChild(row);
        }
    }

    // 2. Gráfico de Encargados
    const encargadosCont = document.getElementById('dash-encargados-container');
    encargadosCont.innerHTML = '';
    const mapEncargados = {};
    listaMes.forEach(a => {
        const enc = a.encargado || 'Sin Asignar';
        if (!mapEncargados[enc]) mapEncargados[enc] = { total: 0, finalizados: 0 };
        mapEncargados[enc].total++;
        if (a.estado === 'finalizado') mapEncargados[enc].finalizados++;
    });

    if (Object.keys(mapEncargados).length === 0) {
        encargadosCont.innerHTML = '<p class="dash-empty">No hay encargados registrados.</p>';
    } else {
        for (let [enc, data] of Object.entries(mapEncargados)) {
            const row = document.createElement('div');
            row.className = 'dash-stat-row';
            row.innerHTML = `
                <div class="dash-stat-info">
                    <span class="dash-stat-title">${enc}</span>
                    <span class="dash-stat-meta">${data.total} tareas asignadas (${data.finalizados} terminadas)</span>
                </div>
                <div class="dash-badge-count">${data.total}</div>
            `;
            encargadosCont.appendChild(row);
        }
    }

    // 3. Gráfico de Prioridades
    const prioridadesCont = document.getElementById('dash-prioridades-container');
    prioridadesCont.innerHTML = '';
    const mapPrio = { critica: 0, alta: 0, media: 0, baja: 0 };
    listaMes.forEach(a => {
        if (mapPrio[a.prioridad] !== undefined) mapPrio[a.prioridad]++;
    });

    const prioLabels = { critica: 'Crítica', alta: 'Alta', media: 'Media', baja: 'Baja' };
    const prioClasses = { critica: 'prio-critica', alta: 'prio-alta', media: 'prio-media', baja: 'prio-baja' };

    const prioGrid = document.createElement('div');
    prioGrid.className = 'dash-prio-grid';
    for (let [key, count] of Object.entries(mapPrio)) {
        const card = document.createElement('div');
        card.className = `dash-prio-card ${prioClasses[key]}`;
        card.innerHTML = `
            <span class="dash-prio-label">${prioLabels[key]}</span>
            <span class="dash-prio-value">${count}</span>
            <span class="dash-prio-sub">actividades</span>
        `;
        prioGrid.appendChild(card);
    }
    prioridadesCont.appendChild(prioGrid);

    // 4. Semanas con más Actividades
    const semanasCont = document.getElementById('dash-semanas-container');
    semanasCont.innerHTML = '';

    const anio = fechaFoco.getFullYear();
    const mes = fechaFoco.getMonth();
    const diasDelMes = getDiasDelMes(anio, mes);

    const semanasMap = { 'Semana 1': 0, 'Semana 2': 0, 'Semana 3': 0, 'Semana 4': 0, 'Semana 5': 0 };

    listaMes.forEach(a => {
        const diaInicio = parseInt(a.fecha_inicio.split('-')[2]);
        if (diaInicio <= 7) semanasMap['Semana 1']++;
        else if (diaInicio <= 14) semanasMap['Semana 2']++;
        else if (diaInicio <= 21) semanasMap['Semana 3']++;
        else if (diaInicio <= 28) semanasMap['Semana 4']++;
        else semanasMap['Semana 5']++;
    });

    const maxSemanaVal = Math.max(...Object.values(semanasMap), 1);

    for (let [sem, count] of Object.entries(semanasMap)) {
        if (count > 0 || diasDelMes.length > 28) {
            const pct = Math.round((count / maxSemanaVal) * 100);
            const item = document.createElement('div');
            item.className = 'dash-bar-item';
            item.innerHTML = `
                <div class="dash-bar-meta">
                    <span>${sem}</span>
                    <span>${count} actividades</span>
                </div>
                <div class="dash-bar-track">
                    <div class="dash-bar-fill" style="width: ${pct}%; background-color: #2563EB"></div>
                </div>
            `;
            semanasCont.appendChild(item);
        }
    }
    if (semanasCont.children.length === 0) {
        semanasCont.innerHTML = '<p class="dash-empty">No hay registro de semanas activas.</p>';
    }

    // 5. Gráfico de Dona Lateral
    const donaCont = document.getElementById('dash-dona-container');
    donaCont.innerHTML = '';

    const mapEstados = { planificado: 0, en_proceso: 0, en_revision: 0, finalizado: 0, detenido: 0 };
    listaMes.forEach(a => {
        if (mapEstados[a.estado] !== undefined) mapEstados[a.estado]++;
    });

    const estadoColoresHex = {
        planificado: '#2563EB',
        en_proceso: '#D97706',
        en_revision: '#9333EA',
        finalizado: '#059669',
        detenido: '#DC2626'
    };

    let acumulado = 0;
    let conicStops = [];
    const totalEst = listaMes.length || 1;

    for (let [est, count] of Object.entries(mapEstados)) {
        if (count > 0) {
            const porcentajeGrados = (count / totalEst) * 360;
            const siguienteAcumulado = acumulado + porcentajeGrados;
            conicStops.push(`${estadoColoresHex[est]} ${acumulado}deg ${siguienteAcumulado}deg`);
            acumulado = siguienteAcumulado;
        }
    }

    const gradienteCSS = conicStops.length > 0 ? `conic-gradient(${conicStops.join(', ')})` : '#E2E8F0';

    const donutBox = document.createElement('div');
    donutBox.className = 'donut-inner-wrap';
    donutBox.innerHTML = `
        <div class="dash-donut-chart" style="background: ${gradienteCSS};">
            <div class="dash-donut-center">
                <span>${listaMes.length}</span>
                <span style="font-size: 0.55rem; color: #64748B; font-weight: 600;">TOTAL</span>
            </div>
        </div>
        <div class="dash-donut-legend">
            <div class="donut-legend-item"><span class="donut-dot" style="background:#059669"></span> Finalizado</div>
            <div class="donut-legend-item"><span class="donut-dot" style="background:#D97706"></span> Proceso</div>
            <div class="donut-legend-item"><span class="donut-dot" style="background:#9333EA"></span> Revisión</div>
            <div class="donut-legend-item"><span class="donut-dot" style="background:#2563EB"></span> Planificado</div>
            <div class="donut-legend-item"><span class="donut-dot" style="background:#DC2626"></span> Detenido</div>
        </div>
    `;
    donaCont.appendChild(donutBox);
}

function crearBarraGantt(act, diasDelMes) {
    const fechaInicioAct = new Date(act.fecha_inicio + 'T00:00:00');
    const fechaFinAct = new Date(act.fecha_fin + 'T00:00:00');

    let startIndex = -1;
    let endIndex = -1;

    diasDelMes.forEach((d, index) => {
        const dStr = d.fecha.toISOString().split('T')[0];
        if (dStr === act.fecha_inicio) startIndex = index;
        if (dStr === act.fecha_fin) endIndex = index;
    });

    if (startIndex === -1 && fechaInicioAct < diasDelMes[0].fecha && fechaFinAct >= diasDelMes[0].fecha) startIndex = 0;
    if (endIndex === -1 && fechaFinAct > diasDelMes[diasDelMes.length - 1].fecha && fechaInicioAct <= diasDelMes[diasDelMes.length - 1].fecha) endIndex = diasDelMes.length - 1;

    if (startIndex === -1 && endIndex === -1) return null;
    if (startIndex === -1) startIndex = 0;
    if (endIndex === -1) endIndex = diasDelMes.length - 1;

    const spanDias = (endIndex - startIndex) + 1;
    const leftPx = startIndex * COL_WIDTH_DIA;
    const widthPx = Math.max(spanDias * COL_WIDTH_DIA, 40);

    const estadoColor = COLOR_ESTADO[act.estado] || COLOR_ESTADO.planificado;

    const bar = document.createElement('div');
    bar.className = 'gantt-bar';
    bar.style.left = `${leftPx}px`;
    bar.style.width = `${widthPx}px`;
    bar.style.backgroundColor = estadoColor.bg;
    bar.style.borderColor = estadoColor.border;
    bar.style.color = estadoColor.text;

    bar.innerHTML = `
        <div class="gantt-bar-progress" style="width: ${act.porcentaje_avance}%; background-color: ${estadoColor.fill}"></div>
        <span class="gantt-bar-title">
            <span>${act.titulo}</span>
            <span class="bar-pct-badge" style="background: ${estadoColor.badgeBg}; color: ${estadoColor.text}">${act.porcentaje_avance}%</span>
        </span>
        <div class="resize-handle resize-left" title="Arrastrar para cambiar inicio"></div>
        <div class="resize-handle resize-right" title="Arrastrar para cambiar fin"></div>
        <button class="bar-status-btn" title="Rotar Estado"><i data-lucide="refresh-cw"></i></button>
    `;

    setupDragAndResize(bar, act, diasDelMes);

    const statusBtn = bar.querySelector('.bar-status-btn');
    statusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        rotarEstadoActividad(act);
    });

    bar.addEventListener('mouseenter', (e) => mostrarTooltip(e, act));
    bar.addEventListener('mousemove', moverTooltip);
    bar.addEventListener('mouseleave', ocultarTooltip);
    bar.addEventListener('click', (e) => {
        if (!e.target.closest('.resize-handle') && !e.target.closest('.bar-status-btn')) {
            abrirModalEditar(act.id);
        }
    });

    return bar;
}

function setupDragAndResize(bar, act, diasDelMes) {
    const handleRight = bar.querySelector('.resize-right');
    const handleLeft = bar.querySelector('.resize-left');

    let isResizingRight = false;
    let isResizingLeft = false;
    let isDragging = false;
    let startX = 0;
    let initialLeft = 0;
    let initialWidth = 0;

    handleRight.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizingRight = true;
        startX = e.clientX;
        initialWidth = bar.offsetWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    handleLeft.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        isResizingLeft = true;
        startX = e.clientX;
        initialLeft = bar.offsetLeft;
        initialWidth = bar.offsetWidth;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    bar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.resize-handle') || e.target.closest('.bar-status-btn')) return;
        isDragging = true;
        startX = e.clientX;
        initialLeft = bar.offsetLeft;
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        const deltaX = e.clientX - startX;
        if (isResizingRight) {
            const newWidth = Math.max(COL_WIDTH_DIA, initialWidth + deltaX);
            bar.style.width = `${Math.round(newWidth / COL_WIDTH_DIA) * COL_WIDTH_DIA}px`;
        } else if (isResizingLeft) {
            const newLeft = initialLeft + deltaX;
            const snappedLeft = Math.round(newLeft / COL_WIDTH_DIA) * COL_WIDTH_DIA;
            const boundedLeft = Math.max(0, Math.min(snappedLeft, initialLeft + initialWidth - COL_WIDTH_DIA));
            bar.style.left = `${boundedLeft}px`;
            bar.style.width = `${initialWidth - (boundedLeft - initialLeft)}px`;
        } else if (isDragging) {
            bar.style.left = `${Math.max(0, Math.round((initialLeft + deltaX) / COL_WIDTH_DIA) * COL_WIDTH_DIA)}px`;
        }
    }

    async function onMouseUp() {
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);

        if (!isResizingRight && !isResizingLeft && !isDragging) return;

        const startIndex = Math.round(bar.offsetLeft / COL_WIDTH_DIA);
        const spanCount = Math.round(bar.offsetWidth / COL_WIDTH_DIA);
        const endIndex = startIndex + spanCount - 1;

        if (startIndex >= 0 && startIndex < diasDelMes.length && endIndex >= 0 && endIndex < diasDelMes.length) {
            const nuevaFechaInicio = diasDelMes[startIndex].fecha.toISOString().split('T')[0];
            const nuevaFechaFin = diasDelMes[Math.min(endIndex, diasDelMes.length - 1)].fecha.toISOString().split('T')[0];

            if (act.fecha_inicio !== nuevaFechaInicio || act.fecha_fin !== nuevaFechaFin) {
                act.fecha_inicio = nuevaFechaInicio;
                act.fecha_fin = nuevaFechaFin;

                await supabaseClient
                    .from('actividades_gantt')
                    .update({ fecha_inicio: nuevaFechaInicio, fecha_fin: nuevaFechaFin })
                    .eq('id', act.id);

                renderTodo();
            }
        }
    }
}

async function rotarEstadoActividad(act) {
    const secuenciaEstados = ['planificado', 'en_proceso', 'en_revision', 'finalizado', 'detenido'];
    const nuevoEstado = secuenciaEstados[(secuenciaEstados.indexOf(act.estado) + 1) % secuenciaEstados.length];

    act.estado = nuevoEstado;
    act.porcentaje_avance = PORCENTAJES_ESTADO[nuevoEstado] !== undefined ? PORCENTAJES_ESTADO[nuevoEstado] : 0;

    await supabaseClient
        .from('actividades_gantt')
        .update({ estado: nuevoEstado, porcentaje_avance: act.porcentaje_avance })
        .eq('id', act.id);

    renderTodo();
}

function getDiasDelMes(year, month) {
    const dias = [];
    const numDias = new Date(year, month + 1, 0).getDate();
    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let d = 1; d <= numDias; d++) {
        const fecha = new Date(year, month, d);
        dias.push({ diaNum: d, nombreDia: nombresDias[fecha.getDay()], fecha: fecha });
    }
    return dias;
}

function setupEventListeners() {
    document.getElementById('btn-nueva-actividad').addEventListener('click', () => abrirModal());
    document.getElementById('btn-cerrar-modal').addEventListener('click', () => cerrarModal());
    document.getElementById('btn-cancelar-modal').addEventListener('click', () => cerrarModal());

    document.getElementById('btn-cerrar-modal-borrar').addEventListener('click', cerrarModalBorrar);
    document.getElementById('btn-cancelar-borrar').addEventListener('click', cerrarModalBorrar);
    document.getElementById('btn-aceptar-borrar').addEventListener('click', confirmarYEliminarActividad);

    const btnToggleSidebar = document.getElementById('btn-toggle-sidebar');
    const sidebarElem = document.getElementById('gantt-sidebar');

    btnToggleSidebar.addEventListener('click', () => {
        sidebarOculto = !sidebarOculto;
        if (sidebarOculto) {
            sidebarElem.classList.add('collapsed');
            btnToggleSidebar.innerHTML = `<i data-lucide="layout-sidebar-open"></i> Mostrar Actividades`;
        } else {
            sidebarElem.classList.remove('collapsed');
            btnToggleSidebar.innerHTML = `<i data-lucide="layout-sidebar-close"></i> Ocultar Actividades`;
        }
        lucide.createIcons();
    });

    const btnToggleDashboard = document.getElementById('btn-toggle-dashboard');
    const viewGantt = document.getElementById('view-gantt');
    const viewDashboard = document.getElementById('view-dashboard');

    btnToggleDashboard.addEventListener('click', () => {
        if (vistaActual === 'gantt') {
            vistaActual = 'dashboard';
            viewGantt.style.display = 'none';
            viewDashboard.style.display = 'flex';
            btnToggleDashboard.innerHTML = `<i data-lucide="bar-chart-2"></i> Ver Diagrama Gantt`;
            btnToggleDashboard.classList.add('btn-primary');
            btnToggleDashboard.classList.remove('btn-secondary');
        } else {
            vistaActual = 'gantt';
            viewDashboard.style.display = 'none';
            viewGantt.style.display = 'flex';
            btnToggleDashboard.innerHTML = `<i data-lucide="pie-chart"></i> Dashboard Analítico`;
            btnToggleDashboard.classList.remove('btn-primary');
            btnToggleDashboard.classList.add('btn-secondary');
        }
        renderTodo();
    });

    document.getElementById('filter-proyecto').addEventListener('change', () => renderTodo());
    document.getElementById('filter-estado').addEventListener('change', () => {
        if (vistaActual === 'gantt') renderGantt();
    });

    document.getElementById('filter-mes').addEventListener('change', (e) => {
        fechaFoco.setMonth(parseInt(e.target.value));
        renderTodo();
    });

    document.getElementById('form-actividad').addEventListener('submit', async (e) => {
        e.preventDefault();

        const id = document.getElementById('actividad-id').value;
        const estadoVal = document.getElementById('estado').value;

        const payload = {
            titulo: document.getElementById('titulo').value,
            proyecto: document.getElementById('proyecto').value || 'General',
            encargado: document.getElementById('encargado').value || 'Sin asignar',
            prioridad: document.getElementById('prioridad').value,
            fecha_inicio: document.getElementById('fecha_inicio').value,
            fecha_fin: document.getElementById('fecha_fin').value,
            hora_inicio: '08:00:00',
            hora_fin: '17:00:00',
            estado: estadoVal,
            porcentaje_avance: PORCENTAJES_ESTADO[estadoVal] !== undefined ? PORCENTAJES_ESTADO[estadoVal] : 0,
            descripcion: document.getElementById('descripcion').value
        };

        if (id) {
            await supabaseClient.from('actividades_gantt').update(payload).eq('id', id);
        } else {
            await supabaseClient.from('actividades_gantt').insert([payload]);
        }

        cerrarModal();
        cargarActividades();
    });
}

function abrirModal(act = null) {
    const modal = document.getElementById('modal-actividad');
    const form = document.getElementById('form-actividad');

    form.reset();
    document.getElementById('actividad-id').value = '';
    document.getElementById('fecha_inicio').valueAsDate = new Date();
    document.getElementById('fecha_fin').valueAsDate = new Date();

    if (act) {
        document.getElementById('modal-title').innerText = 'Editar Actividad';
        document.getElementById('actividad-id').value = act.id;
        document.getElementById('titulo').value = act.titulo;
        document.getElementById('proyecto').value = act.proyecto;
        document.getElementById('encargado').value = act.encargado || '';
        document.getElementById('prioridad').value = act.prioridad;
        document.getElementById('fecha_inicio').value = act.fecha_inicio;
        document.getElementById('fecha_fin').value = act.fecha_fin;
        document.getElementById('estado').value = act.estado;
        document.getElementById('descripcion').value = act.descripcion || '';
    } else {
        document.getElementById('modal-title').innerText = 'Nueva Actividad';
        document.getElementById('estado').value = 'planificado';
    }

    modal.classList.add('active');
}

function abrirModalEditar(id) {
    const act = actividades.find(a => a.id === id);
    if (act) abrirModal(act);
}

function cerrarModal() {
    document.getElementById('modal-actividad').classList.remove('active');
}

function solicitarEliminarActividad(id) {
    idActividadAEliminar = id;
    document.getElementById('modal-confirmar-borrar').classList.add('active');
}

function cerrarModalBorrar() {
    idActividadAEliminar = null;
    document.getElementById('modal-confirmar-borrar').classList.remove('active');
}

async function confirmarYEliminarActividad() {
    if (idActividadAEliminar) {
        await supabaseClient.from('actividades_gantt').delete().eq('id', idActividadAEliminar);
        cerrarModalBorrar();
        cargarActividades();
    }
}

function mostrarTooltip(e, act) {
    const est = COLOR_ESTADO[act.estado] || COLOR_ESTADO.planificado;

    tooltipElem.innerHTML = `
        <div class="tooltip-header">
            <h4>${act.titulo}</h4>
            <span class="tooltip-badge" style="background: ${est.badgeBg}; color: ${est.text}">
                ${act.estado.replace('_', ' ').toUpperCase()} (${act.porcentaje_avance}%)
            </span>
        </div>
        <div class="tooltip-body">
            <div class="tooltip-grid">
                <div class="tooltip-card">
                    <span class="tt-label">PROYECTO MACRO</span>
                    <span class="tt-value">${act.proyecto || 'General'}</span>
                </div>
                <div class="tooltip-card">
                    <span class="tt-label">ENCARGADO</span>
                    <span class="tt-value">${act.encargado || 'Sin asignar'}</span>
                </div>
                <div class="tooltip-card">
                    <span class="tt-label">FECHAS</span>
                    <span class="tt-value">${act.fecha_inicio} al ${act.fecha_fin}</span>
                </div>
                <div class="tooltip-card">
                    <span class="tt-label">PRIORIDAD</span>
                    <span class="tt-value tt-prio-${act.prioridad}">${act.prioridad.toUpperCase()}</span>
                </div>
            </div>
            ${act.descripcion ? `<div class="tooltip-desc">${act.descripcion}</div>` : ''}
        </div>
    `;
    tooltipElem.classList.add('visible');
    moverTooltip(e);
}

function moverTooltip(e) {
    tooltipElem.style.left = `${e.clientX + 16}px`;
    tooltipElem.style.top = `${e.clientY + 16}px`;
}

function ocultarTooltip() {
    tooltipElem.classList.remove('visible');
}

function actualizarKPIs() {
    const filtroProyecto = document.getElementById('filter-proyecto').value;
    const actividadesMes = filtrarActividadesPorContexto(filtroProyecto, 'todos');

    const total = actividadesMes.length;
    const enProceso = actividadesMes.filter(a => a.estado === 'en_proceso').length;
    const enRevision = actividadesMes.filter(a => a.estado === 'en_revision').length;
    const finalizados = actividadesMes.filter(a => a.estado === 'finalizado').length;
    const porcentajeFinalizados = total > 0 ? Math.round((finalizados / total) * 100) : 0;

    document.getElementById('kpi-total').innerText = total;
    document.getElementById('kpi-proceso').innerText = enProceso;
    document.getElementById('kpi-revision').innerText = enRevision;
    document.getElementById('kpi-finalizado').innerText = finalizados;
    document.getElementById('kpi-porcentaje').innerText = `${porcentajeFinalizados}%`;
}

function poblarFiltroProyectos() {
    const select = document.getElementById('filter-proyecto');
    const proyectos = [...new Set(actividades.map(a => a.proyecto).filter(Boolean))];

    const valPrevio = select.value;
    select.innerHTML = '<option value="todos">Todos los proyectos</option>';

    proyectos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        opt.innerText = p;
        select.appendChild(opt);
    });

    select.value = valPrevio;
}

function poblarDatalistProyectos() {
    const datalist = document.getElementById('lista-proyectos');
    const proyectos = [...new Set(actividades.map(a => a.proyecto).filter(Boolean))];

    datalist.innerHTML = '';
    proyectos.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p;
        datalist.appendChild(opt);
    });
}
