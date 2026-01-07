/* ============================================
   SOSO MC - App Logic
   ============================================ */

// Configuration
const API_URL = 'https://mjszw5n7k47fdxxjomkq555kcq0ndmjr.lambda-url.eu-central-1.on.aws/';
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
    playersCount: document.getElementById('playersCount'),
    splashText: document.getElementById('splashText'),
    lastOnlineItem: document.getElementById('lastOnlineItem'),
    lastOnline: document.getElementById('lastOnline'),
    recentlyPlayed: document.getElementById('recentlyPlayed'),
    recentPlayers: document.getElementById('recentPlayers')
};

// Splash texts (loaded from file)
let splashes = [];

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
            // Update last online to now
            localStorage.setItem('lastOnline', new Date().toISOString());
            fetchPlayers();
        } else {
            hidePlayers();
            // Show last online time
            const lastOnline = localStorage.getItem('lastOnline');
            if (lastOnline) {
                updateLastOnline(lastOnline);
            }
        }
        
        // Always show recently played
        showRecentlyPlayed();
        
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
        const response = await fetch(`${API_URL}?action=players`);
        const data = await response.json();
        
        log(`Players: ${data.online}/${data.max} - ${data.players.join(', ') || 'none'}`, 'success');
        updatePlayers(data);
        
        // Track recently played in localStorage
        if (data.players && data.players.length > 0) {
            trackRecentPlayers(data.players);
        }
        
    } catch (error) {
        log(`Players fetch failed: ${error.message}`, 'warning');
        hidePlayers();
    }
}

function trackRecentPlayers(currentPlayers) {
    let recent = JSON.parse(localStorage.getItem('recentPlayers') || '[]');
    
    // Add current players to the front
    currentPlayers.forEach(player => {
        recent = recent.filter(p => p !== player); // Remove duplicates
        recent.unshift(player); // Add to front
    });
    
    // Keep only last 10
    recent = recent.slice(0, 10);
    
    localStorage.setItem('recentPlayers', JSON.stringify(recent));
}

function showRecentlyPlayed() {
    const recent = JSON.parse(localStorage.getItem('recentPlayers') || '[]');
    if (recent.length > 0) {
        updateRecentlyPlayed(recent);
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
// SPLASH TEXT
// ============================================
async function loadSplashes() {
    try {
        const response = await fetch('splashes.txt');
        const text = await response.text();
        splashes = text.split('\n').filter(line => line.trim());
        log(`Loaded ${splashes.length} splash texts`, 'success');
        showRandomSplash();
    } catch (error) {
        log(`Failed to load splashes: ${error.message}`, 'warning');
    }
}

function showRandomSplash() {
    if (splashes.length > 0) {
        const splash = splashes[Math.floor(Math.random() * splashes.length)];
        elements.splashText.textContent = splash;
        elements.splashText.style.animation = 'none';
        elements.splashText.offsetHeight; // Trigger reflow
        elements.splashText.style.animation = 'splashPop 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    }
}

// Change splash every 30 seconds
setInterval(showRandomSplash, 30000);

// ============================================
// COPY SEED
// ============================================
function copySeed() {
    const seed = '-388733565617576344';
    navigator.clipboard.writeText(seed).then(() => {
        log('Seed copied to clipboard', 'success');
        
        // Show feedback
        elements.copyFeedback.classList.add('show');
        setTimeout(() => {
            elements.copyFeedback.classList.remove('show');
        }, 1500);
    });
}

// ============================================
// LAST ONLINE & RECENTLY PLAYED
// ============================================
function updateLastOnline(timestamp) {
    if (timestamp) {
        elements.lastOnlineItem.style.display = 'flex';
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        
        let timeAgo;
        if (diff < 60000) {
            timeAgo = 'Just now';
        } else if (diff < 3600000) {
            timeAgo = `${Math.floor(diff / 60000)}m ago`;
        } else if (diff < 86400000) {
            timeAgo = `${Math.floor(diff / 3600000)}h ago`;
        } else {
            timeAgo = `${Math.floor(diff / 86400000)}d ago`;
        }
        
        elements.lastOnline.textContent = timeAgo;
    }
}

function updateRecentlyPlayed(players) {
    if (players && players.length > 0) {
        elements.recentlyPlayed.style.display = 'block';
        elements.recentPlayers.innerHTML = players.map(name => `
            <div class="recent-player">
                <img src="https://mc-heads.net/avatar/${name}/18" alt="${name}">
                <span>${name}</span>
            </div>
        `).join('');
    }
}

// ============================================
// INIT
// ============================================
function init() {
    log('Initializing...', 'info');
    log(`API: ${API_URL}`, 'info');
    
    // Load splash texts
    loadSplashes();
    
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