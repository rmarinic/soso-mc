/* ============================================
   SOSO MC - App Logic
   ============================================ */

// Configuration
const API_URL = 'https://mjszw5n7k47fdxxjomkq555kcq0ndmjr.lambda-url.eu-central-1.on.aws/';
const MC_API_URL = 'http://soso-mc.duckdns.org:8080/';  // Direct MC server API
const POLL_INTERVAL = 5000;
const AUTO_REFRESH = 30000;

// State
let currentStatus = 'unknown';
let debugOpen = false;
let polling = false;

// DOM Elements
const elements = {
    statusDot: document.getElementById('statusDot'),
    statusLabel: document.getElementById('statusLabel'),
    statusPill: document.getElementById('statusPill'),
    actionBtn: document.getElementById('actionBtn'),
    btnContent: document.getElementById('btnContent'),
    btnText: document.getElementById('btnText'),
    btnLoader: document.getElementById('btnLoader'),
    debugArrow: document.getElementById('debugArrow'),
    debugContent: document.getElementById('debugContent'),
    debugLogs: document.getElementById('debugLogs'),
    copyFeedback: document.getElementById('copyFeedback'),
    addressBox: document.getElementById('addressBox'),
    playersSection: document.getElementById('playersSection'),
    playersList: document.getElementById('playersList'),
    playersCount: document.getElementById('playersCount')
};

// ============================================
// LOGGING
// ============================================
function log(message, level = 'info') {
    const time = new Date().toLocaleTimeString('en-US', { 
        hour12: false,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
    });
    
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `<span class="log-time">${time}</span><span class="log-${level}">${message}</span>`;
    elements.debugLogs.appendChild(entry);
    elements.debugLogs.scrollTop = elements.debugLogs.scrollHeight;
    
    console.log(`[${level.toUpperCase()}] ${message}`);
}

// ============================================
// UI UPDATES
// ============================================
function updateStatus(status, ip = null) {
    currentStatus = status;
    
    // Update status pill
    elements.statusDot.className = 'status-dot';
    elements.actionBtn.className = 'action-btn';
    
    switch(status) {
        case 'running':
            elements.statusDot.classList.add('online');
            elements.statusLabel.textContent = 'Online';
            elements.btnText.textContent = 'Server Online';
            elements.actionBtn.classList.add('online');
            elements.actionBtn.disabled = true;
            updateButtonIcon('check');
            break;
            
        case 'stopped':
            elements.statusDot.classList.add('offline');
            elements.statusLabel.textContent = 'Offline';
            elements.btnText.textContent = 'Start Server';
            elements.actionBtn.disabled = false;
            updateButtonIcon('play');
            break;
            
        case 'pending':
        case 'starting':
            elements.statusDot.classList.add('pending');
            elements.statusLabel.textContent = 'Starting...';
            elements.btnText.textContent = 'Starting...';
            elements.actionBtn.disabled = true;
            break;
            
        case 'stopping':
            elements.statusDot.classList.add('pending');
            elements.statusLabel.textContent = 'Stopping...';
            elements.btnText.textContent = 'Stopping...';
            elements.actionBtn.disabled = true;
            break;
            
        default:
            elements.statusLabel.textContent = status;
            elements.actionBtn.disabled = true;
    }
    
    log(`Status: ${status}${ip ? ` | IP: ${ip}` : ''}`, 'info');
}

function updateButtonIcon(type) {
    const icons = {
        play: '<polygon points="5 3 19 12 5 21 5 3"></polygon>',
        check: '<polyline points="20 6 9 17 4 12"></polyline>'
    };
    
    const svg = elements.btnContent.querySelector('.btn-icon');
    if (svg && icons[type]) {
        svg.innerHTML = icons[type];
    }
}

function setLoading(loading) {
    if (loading) {
        elements.actionBtn.classList.add('loading');
    } else {
        elements.actionBtn.classList.remove('loading');
    }
}

// ============================================
// API CALLS
// ============================================
async function checkStatus() {
    log('Checking server status...', 'info');
    
    try {
        const response = await fetch(`${API_URL}?action=status`);
        const data = await response.json();
        
        log(`Response: ${JSON.stringify(data)}`, 'success');
        updateStatus(data.status, data.ip);
        
        // Fetch players if server is running
        if (data.status === 'running') {
            fetchPlayers();
        } else {
            hidePlayers();
        }
        
        return data.status;
        
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
        elements.statusLabel.textContent = 'Error';
        elements.statusDot.classList.add('offline');
        hidePlayers();
        return null;
    }
}

async function fetchPlayers() {
    log('Fetching players...', 'info');
    
    try {
        const response = await fetch(MC_API_URL, { timeout: 5000 });
        const data = await response.json();
        
        log(`Players: ${data.online}/${data.max} - ${data.players.join(', ') || 'none'}`, 'success');
        updatePlayers(data);
        
    } catch (error) {
        log(`Players fetch failed: ${error.message}`, 'warning');
        hidePlayers();
    }
}

function updatePlayers(data) {
    elements.playersSection.classList.add('visible');
    elements.playersCount.textContent = `${data.online}/${data.max}`;
    
    if (data.players && data.players.length > 0) {
        elements.playersList.innerHTML = data.players.map((name, i) => `
            <div class="player-tag" style="animation-delay: ${i * 0.05}s">
                <img src="https://mc-heads.net/avatar/${name}/24" alt="${name}">
                <span>${name}</span>
            </div>
        `).join('');
    } else {
        elements.playersList.innerHTML = '<div class="no-players">No players online</div>';
    }
}

function hidePlayers() {
    elements.playersSection.classList.remove('visible');
}

async function startServer() {
    log('Starting server...', 'warning');
    setLoading(true);
    
    try {
        const response = await fetch(`${API_URL}?action=start`);
        const data = await response.json();
        
        log(`Response: ${JSON.stringify(data)}`, 'success');
        updateStatus('starting');
        
        // Start polling
        startPolling();
        
    } catch (error) {
        log(`Error: ${error.message}`, 'error');
        setLoading(false);
    }
}

// ============================================
// POLLING
// ============================================
function startPolling() {
    if (polling) return;
    polling = true;
    
    log('Polling started...', 'info');
    
    const poll = setInterval(async () => {
        const status = await checkStatus();
        
        if (status === 'running') {
            log('Server is now online! 🎉', 'success');
            clearInterval(poll);
            polling = false;
            setLoading(false);
        } else if (status === 'stopped') {
            log('Server stopped unexpectedly', 'warning');
            clearInterval(poll);
            polling = false;
            setLoading(false);
        }
    }, POLL_INTERVAL);
    
    // Timeout after 2 minutes
    setTimeout(() => {
        if (polling) {
            clearInterval(poll);
            polling = false;
            setLoading(false);
            log('Polling timeout', 'warning');
            checkStatus();
        }
    }, 120000);
}

// ============================================
// USER ACTIONS
// ============================================
function handleAction() {
    if (currentStatus === 'stopped') {
        startServer();
    }
}

function copyAddress() {
    const address = 'soso-mc.duckdns.org:25565';
    
    navigator.clipboard.writeText(address).then(() => {
        log('Address copied to clipboard', 'success');
        
        elements.copyFeedback.classList.add('show');
        elements.addressBox.style.borderColor = 'rgba(34, 197, 94, 0.5)';
        
        setTimeout(() => {
            elements.copyFeedback.classList.remove('show');
            elements.addressBox.style.borderColor = '';
        }, 1500);
        
    }).catch(err => {
        log(`Copy failed: ${err.message}`, 'error');
    });
}

function toggleDebug() {
    debugOpen = !debugOpen;
    elements.debugArrow.classList.toggle('open', debugOpen);
    elements.debugContent.classList.toggle('open', debugOpen);
    
    if (debugOpen) {
        log('Console opened', 'info');
    }
}

// ============================================
// INIT
// ============================================
function init() {
    log('Initializing...', 'info');
    log(`API: ${API_URL}`, 'info');
    
    // Initial status check
    checkStatus();
    
    // Auto refresh
    setInterval(() => {
        if (!polling) {
            checkStatus();
        }
    }, AUTO_REFRESH);
    
    log('Ready!', 'success');
}

// Start
document.addEventListener('DOMContentLoaded', init);