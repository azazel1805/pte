// frontend/script.js

document.addEventListener('DOMContentLoaded', () => {
    const taskButtons = document.querySelectorAll('.task-btn');
    const questionContainer = document.getElementById('question-container');
    const feedbackContainer = document.getElementById('feedback-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const welcomeMessage = document.getElementById('welcome-message');
    
    // The backend URL. If you run the Flask app on a different port, change it here.
    const API_BASE_URL = 'https://pte-backend-y5hy.onrender.com/api';

    // --- State Management for Audio Recording ---
    let mediaRecorder;
    let audioChunks = [];
    let originalTextForEvaluation = ''; // Store the text/task for evaluation

    // --- Event Listeners ---
    taskButtons.forEach(button => {
        button.addEventListener('click', () => {
            const task = button.dataset.task;
            
            // Highlight active button
            taskButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');

            loadTask(task);
        });
    });

    // --- Core Task Loading Function ---
    async function loadTask(task) {
        showLoading();
        feedbackContainer.classList.add('hidden'); // Hide old feedback
        
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
                // Add more cases here for other tasks
                default:
                    showWelcomeMessage(`Task "${task}" not implemented yet.`);
            }
        } catch (error) {
            console.error('Error loading task:', error);
            showWelcomeMessage(`Failed to load task. Please check the backend connection. Error: ${error.message}`);
        } finally {
            hideLoading();
        }
    }
    
    // --- Display Functions for each Task Type ---

    function displayReadAloud(data) {
        originalTextForEvaluation = data.text; // Save for evaluation
        questionContainer.innerHTML = `
            <h2 class="question-title">Read Aloud</h2>
            <p class="instructions">Look at the text below. In 40 seconds, you must read this text aloud as naturally and clearly as possible.</p>
            <div class="content-box">
                <p>${data.text}</p>
            </div>
            ${createAudioControlsHTML()}
        `;
        addAudioControlListeners('read aloud');
    }

    function displayDescribeImage(data) {
        if (data.error) {
            questionContainer.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`;
            return;
        }
        originalTextForEvaluation = `Describe the image titled '${data.alt}' by ${data.photographer}.`;
        questionContainer.innerHTML = `
            <h2 class="question-title">Describe Image</h2>
            <p class="instructions">Look at the image below. In 25 seconds, please speak into the microphone and describe in detail what the image is showing.</p>
            <div class="image-container">
                <img src="${data.imageUrl}" alt="${data.alt}">
                <p class="photographer-credit">Photo by ${data.photographer} on Pexels</p>
            </div>
            ${createAudioControlsHTML()}
        `;
        addAudioControlListeners('describe image');
    }

    function displayReorderParagraph(data) {
        const listItems = data.sentences.map(sentence => 
            `<li class="reorder-item" draggable="true">${sentence}</li>`
        ).join('');

        questionContainer.innerHTML = `
            <h2 class="question-title">Re-order Paragraphs</h2>
            <p class="instructions">The text boxes in the left panel have been placed in a random order. Restore the original order by dragging them.</p>
            <ul id="reorder-list">${listItems}</ul>
            <button id="check-reorder-btn" class="task-btn" style="margin-top: 20px;">Check Answer</button>
        `;
        
        const reorderList = document.getElementById('reorder-list');
        new Sortable(reorderList, {
            animation: 150,
            ghostClass: 'sortable-ghost'
        });
        
        // Note: Full evaluation for re-order is complex.
        // For now, this is just the UI.
        document.getElementById('check-reorder-btn').addEventListener('click', () => {
            alert("Answer checking for this question type is a future enhancement!");
        });
    }


    // --- Audio Handling ---

    function createAudioControlsHTML() {
        return `
            <div class="audio-controls">
                <button id="record-btn" class="record-btn">Start Recording</button>
                <div id="status" class="status">Press start to record</div>
            </div>
        `;
    }

    function addAudioControlListeners(taskType) {
        const recordBtn = document.getElementById('record-btn');
        const statusDiv = document.getElementById('status');
        
        recordBtn.onclick = async () => {
            if (mediaRecorder && mediaRecorder.state === 'recording') {
                // Stop recording
                mediaRecorder.stop();
                recordBtn.textContent = 'Start Recording';
                recordBtn.classList.remove('recording');
                statusDiv.textContent = 'Processing...';
                recordBtn.disabled = true;
            } else {
                // Start recording
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    mediaRecorder = new MediaRecorder(stream);
                    audioChunks = [];

                    mediaRecorder.ondataavailable = event => {
                        audioChunks.push(event.data);
                    };

                    mediaRecorder.onstop = () => {
                        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
                        // For this demo, we can't directly send audio to Gemini for transcription.
                        // In a real app, you'd send `audioBlob` to a Speech-to-Text API.
                        // For NOW, we'll ask the user for a manual transcript to test the evaluation flow.
                        const userTranscript = prompt("For this demo, please type what you said:");
                        if (userTranscript) {
                             evaluateSpokenResponse(userTranscript, originalTextForEvaluation, taskType);
                        } else {
                            statusDiv.textContent = 'Evaluation cancelled.';
                            recordBtn.disabled = false;
                        }
                    };
                    
                    mediaRecorder.start();
                    recordBtn.textContent = 'Stop Recording';
                    recordBtn.classList.add('recording');
                    statusDiv.textContent = 'Recording...';

                } catch (err) {
                    console.error("Error accessing microphone:", err);
                    statusDiv.textContent = 'Could not access microphone. Please allow permission.';
                    alert('Microphone access denied. Please allow microphone access in your browser settings.');
                }
            }
        };
    }
    
    // --- Evaluation Function ---
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
            // The Gemini response might be a stringified JSON inside a string.
            const feedback = JSON.parse(rawFeedback);
            
            displayFeedback(feedback);

        } catch (error) {
            console.error('Evaluation failed:', error);
            showWelcomeMessage(`Error during evaluation: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    function displayFeedback(feedback) {
        feedbackContainer.innerHTML = `
            <h2 class="question-title">Evaluation Report</h2>
            <div class="score-card">
                <h3>Overall Score (Estimated for this task)</h3>
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
            </div>
        `;
        feedbackContainer.classList.remove('hidden');
    }


    // --- UI Helper Functions ---
    function showLoading() {
        questionContainer.classList.add('hidden');
        welcomeMessage.classList.add('hidden');
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
