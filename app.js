// Configuración Supabase
const SUPABASE_URL = 'https://qaxxggokkclsfsjfmtbs.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_xbiL5biH5Y9jUf9wfM-7Fg_C2TqshKs';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Variables de Estado
let actividades = [];
let fechaFoco = new Date();
let tooltipElem = null;
let semanasVisibles = { 0: true, 1: true, 2: true, 3: true, 4: true };
let sidebarOculto = false;

const COL_WIDTH_HORA = 80;

// Colorimetría por Estado
const COLOR_ESTADO = {
    planificado: { bg: '#EFF6FF', border: '#3B82F6', text: '#1E40AF', fill: '#2563EB', badgeBg: '#DBEAFE' },
    en_proceso: { bg: '#FFFBEB', border: '#F59E0B', text: '#92400E', fill: '#D97706', badgeBg: '#FEF3C7' },
    en_revision: { bg: '#FAF5FF', border: '#A855F7', text: '#6B21A8', fill: '#9333EA', badgeBg: '#F3E8FF' },
    finalizado: { bg: '#ECFDF5', border: '#10B981', text: '#065F46', fill: '#059669', badgeBg: '#D1FAE5' },
    detenido: { bg: '#FEF2F2', border: '#EF4444', text: '#991B1B', fill: '#DC2626', badgeBg: '#FEE2E2' }
};

// Porcentajes predefinidos por estado
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
    actualizarKPIs();
    poblarFiltroProyectos();
    renderTodo();
}

function renderTodo() {
    actualizarBreadcrumbs();
    renderBotonesSemanas();
    renderHeaderGrid();
    renderGantt();
}

function renderBotonesSemanas() {
    const container = document.getElementById('weeks-toggle-buttons');
    container.innerHTML = '';

    const anio = fechaFoco.getFullYear();
    const mes = fechaFoco.getMonth();
    const totalDias = new Date(anio, mes + 1, 0).getDate();
    const totalSemanas = Math.ceil(totalDias / 7);

    for (let s = 0; s < totalSemanas; s++) {
        const btn = document.createElement('button');
        btn.className = `btn-week-toggle ${semanasVisibles[s] ? 'active' : ''}`;
        btn.innerText = `Sem ${s + 1}`;
        btn.onclick = () => {
            semanasVisibles[s] = !semanasVisibles[s];
            renderGantt();
            renderBotonesSemanas();
        };
        container.appendChild(btn);
    }
}

function renderHeaderGrid() {
    const headerContainer = document.getElementById('timeline-header');
    headerContainer.innerHTML = '';

    const totalCols = 24;
    headerContainer.style.width = `${totalCols * COL_WIDTH_HORA}px`;

    for (let h = 0; h < 24; h++) {
        const timeStr = `${h.toString().padStart(2, '0')}:00`;
        const col = document.createElement('div');
        col.className = 'time-col-header';
        col.style.width = `${COL_WIDTH_HORA}px`;
        col.style.minWidth = `${COL_WIDTH_HORA}px`;
        col.innerText = timeStr;
        headerContainer.appendChild(col);
    }
}

function renderGantt() {
    const sidebarBody = document.getElementById('gantt-sidebar-body');
    const timelineBody = document.getElementById('timeline-body');
    const filtroProyecto = document.getElementById('filter-proyecto').value;

    sidebarBody.innerHTML = '';
    timelineBody.innerHTML = '';

    const totalCols = 24;
    const totalWidthPx = totalCols * COL_WIDTH_HORA;
    timelineBody.style.width = `${totalWidthPx}px`;

    const anio = fechaFoco.getFullYear();
    const mes = fechaFoco.getMonth();
    const diasDelMes = getDiasDelMes(anio, mes);

    const listaFiltrada = filtroProyecto === 'todos'
        ? actividades
        : actividades.filter(a => a.proyecto === filtroProyecto);

    diasDelMes.forEach((diaInfo) => {
        if (!semanasVisibles[diaInfo.numSemana]) return;

        const fechaStr = diaInfo.fecha.toISOString().split('T')[0];
        const actsDelDia = listaFiltrada.filter(a => a.fecha_inicio <= fechaStr && a.fecha_fin >= fechaStr);

        const actividadesARenderizar = actsDelDia.length > 0 ? actsDelDia : [null];

        actividadesARenderizar.forEach((act) => {
            const sidebarRow = document.createElement('div');
            sidebarRow.className = 'sidebar-row';

            sidebarRow.innerHTML = `
                <div class="col-actividad">
                    <div class="row-header-badge">
                        <span class="day-badge">
                            ${diaInfo.nombreDia} ${diaInfo.diaNum} (Sem ${diaInfo.numSemana + 1})
                        </span>
                        ${act ? `<span class="macro-badge">${act.proyecto || 'General'}</span>` : ''}
                    </div>
                    <h4 title="${act ? act.titulo : 'Sin Actividades'}">${act ? act.titulo : '-'}</h4>
                    ${act ? `<span class="encargado-label"><i data-lucide="user"></i> ${act.encargado || 'Sin Asignar'}</span>` : ''}
                </div>
                <div class="col-meta">${act ? act.hora_inicio.slice(0, 5) : '-'}</div>
                <div class="col-meta">${act ? act.hora_fin.slice(0, 5) : '-'}</div>
                <div class="col-meta">
                    ${act ? `<span class="status-badge state-${act.estado}">${act.estado.replace('_', ' ').toUpperCase()}</span>` : '-'}
                </div>
                <div class="col-meta font-bold">${act ? act.porcentaje_avance + '%' : '-'}</div>
                <div class="col-acciones">
                    ${act ? `
                        <button class="btn-icon" title="Editar" onclick="abrirModalEditar('${act.id}')">
                            <i data-lucide="edit-2"></i>
                        </button>
                        <button class="btn-icon" title="Eliminar" onclick="eliminarActividad('${act.id}')">
                            <i data-lucide="trash-2"></i>
                        </button>
                    ` : ''}
                </div>
            `;
            sidebarBody.appendChild(sidebarRow);

            // Timeline Grid Row
            const timelineRow = document.createElement('div');
            timelineRow.className = 'timeline-row';
            timelineRow.style.width = `${totalWidthPx}px`;

            for (let i = 0; i < totalCols; i++) {
                const cell = document.createElement('div');
                cell.className = 'time-cell';
                cell.style.width = `${COL_WIDTH_HORA}px`;
                cell.style.minWidth = `${COL_WIDTH_HORA}px`;
                timelineRow.appendChild(cell);
            }

            if (act) {
                const bar = crearBarraGantt(act);
                if (bar) timelineRow.appendChild(bar);
            }

            timelineBody.appendChild(timelineRow);
        });
    });

    lucide.createIcons();
}

function crearBarraGantt(act) {
    const startMin = timeToMinutes(act.hora_inicio);
    const endMin = timeToMinutes(act.hora_fin);

    const leftPx = (startMin / 60) * COL_WIDTH_HORA;
    const widthPx = Math.max(((endMin - startMin) / 60) * COL_WIDTH_HORA, 40);

    const estadoColor = COLOR_ESTADO[act.estado] || COLOR_ESTADO.planificado;

    const bar = document.createElement('div');
    bar.className = 'gantt-bar draggable';
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
        <button class="bar-status-btn" title="Rotar Estado"><i data-lucide="refresh-cw"></i></button>
    `;

    // Botón para cambio rápido de estado
    const statusBtn = bar.querySelector('.bar-status-btn');
    statusBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        rotarEstadoActividad(act);
    });

    // Tooltip estilizado en tarjeta moderna
    bar.addEventListener('mouseenter', (e) => mostrarTooltip(e, act));
    bar.addEventListener('mousemove', moverTooltip);
    bar.addEventListener('mouseleave', ocultarTooltip);

    // Arrastre horizontal
    habilitarDragHorizontal(bar, act);

    return bar;
}

function habilitarDragHorizontal(bar, act) {
    let isDragging = false;
    let startX = 0;
    let initialLeft = 0;

    bar.addEventListener('mousedown', (e) => {
        if (e.target.closest('.bar-status-btn')) return;
        isDragging = true;
        startX = e.clientX;
        initialLeft = parseFloat(bar.style.left) || 0;
        bar.classList.add('dragging');
    });

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const deltaX = e.clientX - startX;
        let newLeft = initialLeft + deltaX;

        const durationMin = timeToMinutes(act.hora_fin) - timeToMinutes(act.hora_inicio);
        const barWidth = (durationMin / 60) * COL_WIDTH_HORA;
        const maxLeft = (24 * COL_WIDTH_HORA) - barWidth;

        if (newLeft < 0) newLeft = 0;
        if (newLeft > maxLeft) newLeft = maxLeft;

        bar.style.left = `${newLeft}px`;
    });

    document.addEventListener('mouseup', async () => {
        if (!isDragging) return;
        isDragging = false;
        bar.classList.remove('dragging');

        const currentLeft = parseFloat(bar.style.left) || 0;
        const durationMin = timeToMinutes(act.hora_fin) - timeToMinutes(act.hora_inicio);

        const newStartMin = Math.round((currentLeft / COL_WIDTH_HORA) * 60);
        const newEndMin = newStartMin + durationMin;

        const newHoraInicio = minutesToTime(newStartMin);
        const newHoraFin = minutesToTime(newEndMin);

        if (newHoraInicio !== act.hora_inicio.slice(0, 5)) {
            act.hora_inicio = newHoraInicio + ':00';
            act.hora_fin = newHoraFin + ':00';

            await supabaseClient
                .from('actividades_gantt')
                .update({ hora_inicio: act.hora_inicio, hora_fin: act.hora_fin })
                .eq('id', act.id);

            renderGantt();
        }
    });
}

// Rotación de estado aplicando reglas de % automáticas
async function rotarEstadoActividad(act) {
    const secuenciaEstados = ['planificado', 'en_proceso', 'en_revision', 'finalizado', 'detenido'];
    const indexActual = secuenciaEstados.indexOf(act.estado);
    const nuevoEstado = secuenciaEstados[(indexActual + 1) % secuenciaEstados.length];

    act.estado = nuevoEstado;
    act.porcentaje_avance = PORCENTAJES_ESTADO[nuevoEstado] !== undefined ? PORCENTAJES_ESTADO[nuevoEstado] : 0;

    await supabaseClient
        .from('actividades_gantt')
        .update({ estado: nuevoEstado, porcentaje_avance: act.porcentaje_avance })
        .eq('id', act.id);

    actualizarKPIs();
    renderGantt();
}

function getDiasDelMes(year, month) {
    const dias = [];
    const numDias = new Date(year, month + 1, 0).getDate();
    const nombresDias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];

    for (let d = 1; d <= numDias; d++) {
        const fecha = new Date(year, month, d);
        const numSemana = Math.floor((d - 1) / 7);

        dias.push({
            diaNum: d,
            nombreDia: nombresDias[fecha.getDay()],
            numSemana: numSemana,
            fecha: fecha
        });
    }

    return dias;
}

function actualizarBreadcrumbs() {
    const root = document.getElementById('bc-root');
    const nombreMes = fechaFoco.toLocaleString('es', { month: 'long', year: 'numeric' });
    root.innerHTML = `<i data-lucide="calendar"></i> Vista Mensual - ${nombreMes.toUpperCase()}`;
    lucide.createIcons();
}

function setupEventListeners() {
    document.getElementById('btn-nueva-actividad').addEventListener('click', () => abrirModal());
    document.getElementById('btn-cerrar-modal').addEventListener('click', () => cerrarModal());
    document.getElementById('btn-cancelar-modal').addEventListener('click', () => cerrarModal());

    // Toggle de la barra lateral de actividades
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

    document.getElementById('filter-proyecto').addEventListener('change', () => renderGantt());

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
            hora_inicio: document.getElementById('hora_inicio').value + ':00',
            hora_fin: document.getElementById('hora_fin').value + ':00',
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
        document.getElementById('hora_inicio').value = act.hora_inicio.slice(0, 5);
        document.getElementById('hora_fin').value = act.hora_fin.slice(0, 5);
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

function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function minutesToTime(totalMin) {
    const h = Math.floor(totalMin / 60) % 24;
    const m = totalMin % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
}

async function eliminarActividad(id) {
    if (confirm('¿Deseas eliminar esta actividad del proyecto?')) {
        await supabaseClient
            .from('actividades_gantt')
            .delete()
            .eq('id', id);
        cargarActividades();
    }
}

// Cuadro de Detalles (Tooltip) moderno y colorido
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
                    <span class="tt-label">PRIORIDAD</span>
                    <span class="tt-value tt-prio-${act.prioridad}">${act.prioridad.toUpperCase()}</span>
                </div>
                <div class="tooltip-card">
                    <span class="tt-label">HORARIO</span>
                    <span class="tt-value">${act.hora_inicio.slice(0, 5)} - ${act.hora_fin.slice(0, 5)}</span>
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
    document.getElementById('kpi-total').innerText = actividades.length;
    document.getElementById('kpi-proceso').innerText = actividades.filter(a => a.estado === 'en_proceso').length;
    document.getElementById('kpi-revision').innerText = actividades.filter(a => a.estado === 'en_revision').length;
    document.getElementById('kpi-finalizado').innerText = actividades.filter(a => a.estado === 'finalizado').length;
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