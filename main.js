// Global variables
let uploadedFiles = [];
let currentDocument = null;
let searchHistory = [];

// Tab functionality
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const tabName = this.dataset.tab;
        switchTab(tabName);
    });
});

function switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    document.querySelector(`[data-tab="${tabName}"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
}

// File upload functionality
document.getElementById('file-input').addEventListener('change', handleFileUpload);

// Drag and drop functionality
const uploadArea = document.querySelector('.upload-area');
uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});
uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});
uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    const files = e.dataTransfer.files;
    handleFileUpload({ target: { files } });
});

function handleFileUpload(event) {
    const files = Array.from(event.target.files);
    const fileList = document.getElementById('file-list');
    const progressContainer = document.getElementById('progress-container');
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');

    files.forEach(file => {
        if (file.size > 50 * 1024 * 1024) {
            alert(`File ${file.name} exceeds 50MB limit`);
            return;
        }
        const fileItem = {
            name: file.name,
            size: formatFileSize(file.size),
            type: file.type,
            file: file,
            id: Date.now() + Math.random()
        };
        uploadedFiles.push(fileItem);
        addFileToList(fileItem);
        updateDocumentSelector();
    });
    if (files.length > 0) {
        progressContainer.style.display = 'block';
        simulateProcessing();
    }
}

function addFileToList(fileItem) {
    const fileList = document.getElementById('file-list');
    const fileDiv = document.createElement('div');
    fileDiv.className = 'file-item fade-in';
    fileDiv.innerHTML = `
        <div class="file-info">
            <i class="fas fa-file-alt file-icon"></i>
            <div class="file-details">
            </div>
        </div>
        <div class="file-actions">
            <button class="btn btn-secondary btn-small" onclick="processFile('${fileItem.id}')">
            </button>
            <button class="btn btn-secondary btn-small" onclick="removeFile('${fileItem.id}')">
            </button>
        </div>
    `;
    fileList.appendChild(fileDiv);
}

function removeFile(fileId) {
    uploadedFiles = uploadedFiles.filter(file => file.id != fileId);
    const fileList = document.getElementById('file-list');
    fileList.innerHTML = '';
    uploadedFiles.forEach(file => addFileToList(file));
    updateDocumentSelector();
}

function processFile(fileId) {
    const file = uploadedFiles.find(f => f.id == fileId);
    if (file) {
        showProcessingStatus(file.name);
    }
}

function simulateProcessing() {
    const progressFill = document.getElementById('progress-fill');
    const progressText = document.getElementById('progress-text');
    let progress = 0;
    const interval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 100) progress = 100;
        progressFill.style.width = progress + '%';
        progressText.textContent = `Processing documents... ${Math.round(progress)}%`;
        if (progress >= 100) {
            clearInterval(interval);
            showProcessingComplete();
        }
    }, 200);
}

function showProcessingComplete() {
    const analysisOverview = document.getElementById('analysis-overview');
    analysisOverview.innerHTML = `
        <div class="status-indicator status-success">
        </div>
        <div style="margin-top: 20px;">
        </div>
    `;
}

function updateDocumentSelector() {
    const selector = document.getElementById('viewer-document');
    selector.innerHTML = '<option value="">Select a document to view...</option>';
    uploadedFiles.forEach(file => {
        const option = document.createElement('option');
        option.value = file.id;
        option.textContent = file.name;
        selector.appendChild(option);
    });
}

document.getElementById('chat-input').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        sendMessage();
    }
});

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const message = input.value.trim();
    if (!message) return;
    addMessageToChat(message, 'user');
    input.value = '';
    addMessageToChat('<div class="typing-indicator"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div>', 'ai');
    try {
        setTimeout(() => {
            addMessageToChat('This is a simulated AI response.', 'ai');
        }, 1000);
    } catch (error) {
        addMessageToChat('Error processing your request.', 'ai');
    }
}

function addMessageToChat(message, sender) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender} fade-in`;
    messageDiv.innerHTML = `
        <div class="message-avatar">${sender === 'user' ? 'You' : 'AI'}</div>
        <div class="message-content">${message}</div>
    `;
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    else return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}
// ...existing code for other features (summarization, translation, etc.)...
