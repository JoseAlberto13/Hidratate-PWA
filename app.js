
let settings = {
    weight: 0,
    startTime: '08:00',
    endTime: '22:00',
    goalMl: 0,
    goalGlasses: 0,
    intervalMinutes: 0
};

let glasses = [];
let selectedPhoto = null;
let reminderInterval = null;
let nextGlassInterval = null;

document.addEventListener('DOMContentLoaded', () => {
    loadData();
    checkView();
    startReminderSystem();
    startNextGlassTimer();

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker registrado'))
            .catch(err => console.log('Error en Service Worker:', err));
    }
});

function loadData() {
    const savedSettings = localStorage.getItem('hydrationSettings');
    const savedGlasses = localStorage.getItem('hydrationGlasses');

    if (savedSettings) {
        settings = JSON.parse(savedSettings);
    }

    if (savedGlasses) {
        glasses = JSON.parse(savedGlasses);
        const today = new Date().toDateString();
        glasses = glasses.filter(g => new Date(g.timestamp).toDateString() === today);
        saveGlasses();
    }
}

function checkView() {
    if (settings.weight === 0) {
        document.getElementById('setupView').style.display = 'block';
        document.getElementById('mainView').style.display = 'none';
    } else {
        document.getElementById('setupView').style.display = 'none';
        document.getElementById('mainView').style.display = 'block';
        updateUI();
    }
}

function saveSettings() {
    const weight = parseFloat(document.getElementById('weightInput').value);
    const startTime = document.getElementById('startTime').value;
    const endTime = document.getElementById('endTime').value;

    if (!weight || weight < 20 || weight > 200) {
        showToast('Por favor ingresa un peso válido (20-200 kg)', 'warning');
        return;
    }

    settings.weight = weight;
    settings.startTime = startTime;
    settings.endTime = endTime;
    settings.goalMl = Math.round(weight * 35);
    settings.goalGlasses = Math.ceil(settings.goalMl / 250);

    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
    settings.intervalMinutes = Math.floor(totalMinutes / settings.goalGlasses);

    localStorage.setItem('hydrationSettings', JSON.stringify(settings));

    showToast('¡Configuración guardada exitosamente!', 'success');
    checkView();
}

function showSettings() {
    document.getElementById('weightInput').value = settings.weight;
    document.getElementById('startTime').value = settings.startTime;
    document.getElementById('endTime').value = settings.endTime;

    document.getElementById('setupView').style.display = 'block';
    document.getElementById('mainView').style.display = 'none';
}

function showAddGlassModal() {
    selectedPhoto = null;
    document.getElementById('photoPreview').style.display = 'none';
    const modal = new bootstrap.Modal(document.getElementById('addGlassModal'));
    modal.show();
}

function handlePhotoSelected(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
            selectedPhoto = e.target.result;
            document.getElementById('previewImage').src = selectedPhoto;
            document.getElementById('photoPreview').style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
}

function addGlass(photo) {
    const glass = {
        id: Date.now(),
        timestamp: new Date().toISOString(),
        photo: photo || selectedPhoto
    };

    glasses.push(glass);
    saveGlasses();
    updateUI();

    if ('vibrate' in navigator) {
        navigator.vibrate(200);
    }

    const modal = bootstrap.Modal.getInstance(document.getElementById('addGlassModal'));
    if (modal) modal.hide();

    showToast('¡Vaso agregado! 💧', 'success');

    if (glasses.length === settings.goalGlasses) {
        setTimeout(() => {
            showToast('🎉 ¡Felicitaciones! Completaste tu meta diaria', 'success');
        }, 500);
    }
}

function deleteGlass(glassId) {
    const modal = new bootstrap.Modal(document.getElementById('deleteModal'));
    modal.show();

    document.getElementById('confirmDeleteBtn').onclick = () => {
        glasses = glasses.filter(g => g.id !== glassId);
        saveGlasses();
        updateUI();
        modal.hide();
        showToast('Registro eliminado', 'info');
    };
}

function resetDay() {
    if (confirm('¿Estás seguro de que deseas reiniciar el día? Se eliminarán todos los registros.')) {
        glasses = [];
        saveGlasses();
        updateUI();
        showToast('Día reiniciado. ¡Comienza de nuevo!', 'info');
    }
}

function saveGlasses() {
    localStorage.setItem('hydrationGlasses', JSON.stringify(glasses));
}

function updateUI() {
    const consumed = glasses.length;
    const goal = settings.goalGlasses;
    const percentage = Math.min((consumed / goal) * 100, 100);

    document.getElementById('progressBar').style.width = percentage + '%';
    document.getElementById('progressBar').textContent = Math.round(percentage) + '%';
    document.getElementById('glassesCount').textContent = consumed;
    document.getElementById('glassesGoal').textContent = goal;
    document.getElementById('mlConsumed').textContent = consumed * 250;
    document.getElementById('mlGoal').textContent = settings.goalMl;

    // Mostrar mensaje de felicitación o tiempo del próximo vaso
    if (consumed >= goal) {
        document.getElementById('nextGlassInfo').style.display = 'none';
        document.getElementById('congratsMessage').style.display = 'block';
    } else {
        document.getElementById('nextGlassInfo').style.display = 'block';
        document.getElementById('congratsMessage').style.display = 'none';
        updateNextGlassTime();
    }

    updateHistory();
}

function updateNextGlassTime() {
    if (glasses.length >= settings.goalGlasses) return;

    const lastGlass = glasses.length > 0 ? new Date(glasses[glasses.length - 1].timestamp) : null;
    const now = new Date();

    let nextGlassTime;
    if (lastGlass) {
        nextGlassTime = new Date(lastGlass.getTime() + settings.intervalMinutes * 60000);
    } else {
        const [startH, startM] = settings.startTime.split(':').map(Number);
        nextGlassTime = new Date(now);
        nextGlassTime.setHours(startH, startM, 0, 0);
    }

    const diff = nextGlassTime - now;

    if (diff > 0) {
        const minutes = Math.floor(diff / 60000);
        const seconds = Math.floor((diff % 60000) / 1000);
        document.getElementById('nextGlassTime').textContent =
            `${minutes} min ${seconds} seg`;
    } else {
        document.getElementById('nextGlassTime').textContent = '¡Ya es hora!';
    }
}

function startNextGlassTimer() {
    if (nextGlassInterval) clearInterval(nextGlassInterval);

    nextGlassInterval = setInterval(() => {
        if (settings.weight > 0 && glasses.length < settings.goalGlasses) {
            updateNextGlassTime();
        }
    }, 1000);
}

function updateHistory() {
    const container = document.getElementById('todayHistory');

    if (glasses.length === 0) {
        container.innerHTML = '<p class="text-muted text-center">Aún no has registrado vasos hoy</p>';
        return;
    }

    container.innerHTML = glasses.map((glass, index) => {
        const date = new Date(glass.timestamp);
        const time = date.toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' });

        return `
                    <div class="card mb-2">
                        <div class="card-body p-3">
                            <div class="d-flex align-items-center justify-content-between">
                                <div class="flex-grow-1">
                                    <strong>Vaso ${index + 1}</strong>
                                    <br>
                                    <small class="text-muted">
                                        <i class="fas fa-clock"></i> ${time}
                                    </small>
                                </div>
                                <div class="d-flex align-items-center gap-2">
                                    ${glass.photo ? `
                                        <img src="${glass.photo}" 
                                             class="img-thumbnail" 
                                             style="width: 60px; height: 60px; object-fit: cover; cursor: pointer;"
                                             onclick="showPhoto('${glass.photo}')"
                                             alt="Foto del vaso">
                                    ` : '<span class="text-muted small">Sin foto</span>'}
                                    <button onclick="deleteGlass(${glass.id})" 
                                            class="btn btn-sm btn-outline-danger">
                                        <i class="fas fa-trash"></i>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                `;
    }).reverse().join('');
}

function showPhoto(photoUrl) {
    document.getElementById('fullPhoto').src = photoUrl;
    const modal = new bootstrap.Modal(document.getElementById('photoModal'));
    modal.show();
}

function showToast(message, type) {
    const bgClass = type === 'success' ? 'bg-success' :
        type === 'warning' ? 'bg-warning' :
            type === 'info' ? 'bg-info' : 'bg-primary';

    const toast = document.createElement('div');
    toast.className = `toast align-items-center text-white ${bgClass} border-0`;
    toast.setAttribute('role', 'alert');
    toast.innerHTML = `
                <div class="d-flex">
                    <div class="toast-body">${message}</div>
                    <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
                </div>
            `;

    document.getElementById('toastContainer').appendChild(toast);
    const bsToast = new bootstrap.Toast(toast, { delay: 3000 });
    bsToast.show();

    toast.addEventListener('hidden.bs.toast', () => toast.remove());
}

function startReminderSystem() {
    if (reminderInterval) clearInterval(reminderInterval);

    reminderInterval = setInterval(() => {
        if (settings.weight === 0) return;

        const now = new Date();
        const currentTime = now.getHours() * 60 + now.getMinutes();
        const [startH, startM] = settings.startTime.split(':').map(Number);
        const [endH, endM] = settings.endTime.split(':').map(Number);
        const startMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        if (currentTime >= startMinutes && currentTime <= endMinutes) {
            if (glasses.length >= settings.goalGlasses) return;

            const minutesPassed = currentTime - startMinutes;
            const expectedGlasses = Math.floor(minutesPassed / settings.intervalMinutes);

            if (glasses.length < expectedGlasses) {
                showReminder();
            }
        }
    }, 60000);
}

function showReminder() {
    if ('vibrate' in navigator) {
        navigator.vibrate([200, 100, 200]);
    }

    showToast('💧 ¡Hora de tomar un vaso de agua!', 'info');

    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Hidratación Diaria', {
            body: '¡Hora de tomar un vaso de agua!',
            icon: 'icon-192.png',
            vibrate: [200, 100, 200]
        });
    }
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
        glasses = [];
        saveGlasses();
        updateUI();
    }
}, 60000);