// frontend/script.js

document.addEventListener('DOMContentLoaded', () => {
    const taskButtons = document.querySelectorAll('.task-btn');
    const questionContainer = document.getElementById('question-container');
    const feedbackContainer = document.getElementById('feedback-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const welcomeMessage = document.getElementById('welcome-message');
    
    // IMPORTANT: Update this URL to your deployed Render backend URL
    const API_BASE_URL = 'https://pte-backend-y5hy.onrender.com/api'; // For local testing
    // const API_BASE_URL = 'https://your-backend-name.onrender.com/api'; // For production

    // --- State Management ---
    let originalTextForEvaluation = '';
    
    // --- Web Speech API Initialization ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;

    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.lang = 'en-US';
        recognition.interimResults = false;
    } else {
        console.error("Web Speech API is not supported in this browser.");
    }
    
    // --- Event Listeners ---
    taskButtons.forEach(button => {
        button.addEventListener('click', () => {
            const task = button.dataset.task;
            taskButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            loadTask(task);
        });
    });

    // --- Core Task Loading Function ---
    async function loadTask(task) {
        showLoading();
        feedbackContainer.classList.add('hidden');
        
        try {
            let response;
            switch (task) {
                case 'read-aloud':
                    response = await fetch(`${API_BASE_URL}/generate/read-aloud`);
                    const readAloudData = await response.json();
                    displayReadAloud(readAloudData);
                    break;
                case 'describe-image':
                    response = await fetch(`${API_BASE_URL}/generate/describe-image`);
                    const describeImageData = await response.json();
                    displayDescribeImage(describeImageData);
                    break;
                case 'reorder-paragraph':
                     response = await fetch(`${API_BASE_URL}/generate/reorder-paragraph`);
                     const reorderData = await response.json();
                     displayReorderParagraph(reorderData);
                     break;
                default:
                    showWelcomeMessage(`Task "${task}" not implemented yet.`);
            }
        } catch (error) {
            console.error('Error loading task:', error);
            showWelcomeMessage(`Failed to load task. Is the backend running? Error: ${error.message}`);
        } finally {
            hideLoading();
        }
    }
    
    // --- Display Functions ---
    function displayReadAloud(data) {
        originalTextForEvaluation = data.text;
        questionContainer.innerHTML = `
            <h2 class="question-title">Read Aloud</h2>
            <p class="instructions">Look at the text below. You will have 40 seconds to read this text aloud as naturally and clearly as possible.</p>
            <div class="content-box"><p>${data.text}</p></div>
            ${createAudioControlsHTML()}
        `;
        addAudioControlListeners('Read Aloud');
    }

    function displayDescribeImage(data) {
        if (data.error) {
            questionContainer.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`;
            return;
        }
        originalTextForEvaluation = `An image showing: ${data.alt}`;
        questionContainer.innerHTML = `
            <h2 class="question-title">Describe Image</h2>
            <p class="instructions">Look at the image below. You will have 25 seconds to describe in detail what the image is showing.</p>
            <div class="image-container">
                <img src="${data.imageUrl}" alt="${data.alt}">
                <p class="photographer-credit">Photo by ${data.photographer} on Pexels</p>
            </div>
            ${createAudioControlsHTML()}
        `;
        addAudioControlListeners('Describe Image');
    }

    function displayReorderParagraph(data) {
        const listItems = data.sentences.map(sentence => `<li class="reorder-item" draggable="true">${sentence}</li>`).join('');
        questionContainer.innerHTML = `
            <h2 class="question-title">Re-order Paragraphs</h2>
            <p class="instructions">The text boxes below are in a random order. Restore the original order by dragging and dropping them.</p>
            <ul id="reorder-list">${listItems}</ul>
            <button id="check-reorder-btn" class="task-btn" style="margin-top: 20px;">Check Answer</button>
        `;
        const reorderList = document.getElementById('reorder-list');
        new Sortable(reorderList, { animation: 150, ghostClass: 'sortable-ghost' });
        document.getElementById('check-reorder-btn').addEventListener('click', () => alert("Answer checking for this question type is a future enhancement!"));
    }

    // --- Audio Handling (Using Web Speech API) ---
    function createAudioControlsHTML() {
        if (!SpeechRecognition) {
            return `<div class="status" style="color:var(--danger-color); font-weight:bold;">Your browser does not support speech recognition. Please use Google Chrome or Microsoft Edge for speaking tasks.</div>`;
        }
        return `
            <div class="audio-controls">
                <button id="record-btn" class="record-btn">Start Recording</button>
                <div id="status" class="status">Press start to record</div>
            </div>`;
    }

    function addAudioControlListeners(taskType) {
        const recordBtn = document.getElementById('record-btn');
        if (!recordBtn) return; 

        const statusDiv = document.getElementById('status');
        let isRecording = false;

        recordBtn.onclick = () => {
            if (isRecording) {
                recognition.stop();
                // onend will handle the state change
            } else {
                recognition.start();
            }
        };

        recognition.onstart = () => {
            isRecording = true;
            recordBtn.textContent = 'Stop Recording';
            recordBtn.classList.add('recording');
            statusDiv.textContent = 'Recording... Speak now.';
        };

        recognition.onend = () => {
            isRecording = false;
            recordBtn.textContent = 'Start Recording';
            recordBtn.classList.remove('recording');
            statusDiv.textContent = 'Processing... Please wait.';
            recordBtn.disabled = true;
        };

        recognition.onerror = (event) => {
            console.error('Speech recognition error', event.error);
            statusDiv.textContent = `Error: ${event.error}. Please try again or check microphone permissions.`;
            isRecording = false;
        };
        
        recognition.onresult = (event) => {
            let finalTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                finalTranscript += event.results[i][0].transcript;
            }
            
            if (finalTranscript.trim()) {
                evaluateSpokenResponse(finalTranscript.trim(), originalTextForEvaluation, taskType);
            } else {
                statusDiv.textContent = "Couldn't hear you. Please try again.";
                recordBtn.disabled = false;
            }
        };
    }

    // --- Evaluation Function (Sends JSON) ---
    async function evaluateSpokenResponse(transcript, originalText, taskType) {
        showLoading();
        questionContainer.classList.add('hidden');
        
        try {
            const response = await fetch(`${API_BASE_URL}/evaluate/spoken-response`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ transcript, originalText, taskType })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            const rawFeedback = await response.json();
            const feedback = JSON.parse(rawFeedback);
            
            displayFeedback(feedback);

        } catch (error) {
            console.error('Evaluation failed:', error);
            showWelcomeMessage(`Error during evaluation: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    // --- Display Feedback ---
    function displayFeedback(feedback) {
        feedbackContainer.innerHTML = `
            <h2 class="question-title">Evaluation Report</h2>
            <div class="score-card">
                <h3>Your Transcript</h3>
                <p><em>"${feedback.transcript}"</em></p>
            </div>
            <div class="score-card">
                <h3>Overall Score (Estimated)</h3>
                <p class="score">${feedback.overall_score_out_of_90} / 90</p>
                <p><strong>Summary:</strong> ${feedback.final_summary}</p>
            </div>
            <div class="score-card">
                <h3>Oral Fluency</h3>
                <p class="score">${feedback.oral_fluency.score} / 5</p>
                <p><strong>Feedback:</strong> ${feedback.oral_fluency.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Pronunciation</h3>
                <p class="score">${feedback.pronunciation.score} / 5</p>
                <p><strong>Feedback:</strong> ${feedback.pronunciation.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Content</h3>
                <p class="score">${feedback.content.score} / 5</p>
                <p><strong>Feedback:</strong> ${feedback.content.feedback}</p>
            </div>`;
        feedbackContainer.classList.remove('hidden');
    }

    // --- UI Helper Functions ---
    function showLoading() {
        questionContainer.classList.add('hidden');
        welcomeMessage.classList.add('hidden');
        feedbackContainer.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
    }

    function hideLoading() {
        loadingSpinner.classList.add('hidden');
        questionContainer.classList.remove('hidden');
    }

    function showWelcomeMessage(message = 'Select a task from the menu above to begin.') {
        welcomeMessage.innerHTML = `<p>${message}</p>`;
        welcomeMessage.classList.remove('hidden');
        questionContainer.classList.add('hidden');
        feedbackContainer.classList.add('hidden');
    }
});
