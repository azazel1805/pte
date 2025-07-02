// frontend/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & Constants ---
    const taskButtons = document.querySelectorAll('.task-btn');
    const questionContainer = document.getElementById('question-container');
    const feedbackContainer = document.getElementById('feedback-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const welcomeMessage = document.getElementById('welcome-message');
    
    // IMPORTANT: Update this if you deploy your backend
    const API_BASE_URL = 'https://pte-backend-y5hy.onrender.com/api'; // For local testing
    // const API_BASE_URL = 'https://your-backend-name.onrender.com/api'; // For production

    let originalTextForEvaluation = '';
    let currentTimerInterval = null;

    // --- Web Speech API Initialization ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true; // Keep listening even after a pause
        recognition.lang = 'en-US';
        recognition.interimResults = false; // We only want final results
    } else {
        console.error("Web Speech API is not supported in this browser.");
        alert("Your browser does not support Speech Recognition. Speaking tasks will not work. Please use Google Chrome or Microsoft Edge.");
    }

    // --- Event Listeners ---
    taskButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (currentTimerInterval) clearInterval(currentTimerInterval);
            if (recognition) recognition.stop(); // Stop any active recognition
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
                    displayReadAloud(await response.json());
                    break;
                case 'describe-image':
                    response = await fetch(`${API_BASE_URL}/generate/describe-image`);
                    displayDescribeImage(await response.json());
                    break;
                case 'reorder-paragraph':
                     response = await fetch(`${API_BASE_URL}/generate/reorder-paragraph`);
                     displayReorderParagraph(await response.json());
                     break;
                case 'essay':
                     response = await fetch(`${API_BASE_URL}/generate/essay`);
                     displayEssay(await response.json());
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
            <p class="instructions">You will have 30-40 seconds to read this text aloud as naturally and clearly as possible.</p>
            <div class="content-box"><p>${data.text}</p></div>
            ${createAudioControlsHTML()}
        `;
        addAudioControlListeners('Read Aloud');
    }

    function displayDescribeImage(data) {
        if (data.error) { questionContainer.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`; return; }
        originalTextForEvaluation = `An image showing: ${data.alt}`;
        questionContainer.innerHTML = `
            <h2 class="question-title">Describe Image</h2>
            <div id="timer" class="timer-display"></div>
            <p class="instructions">You have 25 seconds to prepare. After the beep, you will have 40 seconds to describe the image.</p>
            <div class="image-container">
                <img src="${data.imageUrl}" alt="${data.alt}">
                <p class="photographer-credit">Photo by ${data.photographer} on Pexels</p>
            </div>
            ${createAudioControlsHTML()}
        `;
        
        const recordBtn = document.getElementById('record-btn');
        if (recordBtn) recordBtn.disabled = true;

        startTimer(25, 'Preparation Time', document.getElementById('timer'), () => {
            document.getElementById('timer').style.color = 'var(--success-color)';
            try { new Audio('https://www.soundjay.com/buttons/beep-07a.mp3').play(); } catch(e) { console.warn("Could not play beep sound."); }
            if (recordBtn) {
                recordBtn.disabled = false;
                recordBtn.click(); // Auto-start recording
            }
            startTimer(40, 'Answering Time', document.getElementById('timer'), () => {
                if (recordBtn && recordBtn.classList.contains('recording')) {
                    recordBtn.click(); // Auto-stop recording
                }
            });
        });
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
        // Make list sortable
        new Sortable(document.getElementById('reorder-list'), { animation: 150, ghostClass: 'sortable-ghost' });
        // Add listener for check button (functionality can be expanded later)
        document.getElementById('check-reorder-btn').addEventListener('click', () => alert("Answer checking for this question type is a future enhancement!"));
    }

    // NEW DISPLAY FUNCTION FOR ESSAY
    function displayEssay(data) {
        if (data.error) { questionContainer.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`; return; }
        originalTextForEvaluation = data.prompt;
        questionContainer.innerHTML = `
            <h2 class="question-title">Essay Writing</h2>
            <p class="instructions">You have 20 minutes to plan, write, and revise an essay on the topic below. Your response should be 200-300 words.</p>
            <div class="content-box">
                <p><strong>${data.prompt}</strong></p>
            </div>
            <textarea id="essay-textarea" placeholder="Start writing your essay here..." rows="15"></textarea>
            <p id="word-count">Word Count: 0</p>
            <button id="submit-essay-btn" class="task-btn submit-btn">Submit for Evaluation</button>
        `;

        const textArea = document.getElementById('essay-textarea');
        const wordCountEl = document.getElementById('word-count');
        
        textArea.addEventListener('input', () => {
            const words = textArea.value.trim().split(/\s+/).filter(word => word.length > 0);
            wordCountEl.textContent = `Word Count: ${words.length}`;
        });

        document.getElementById('submit-essay-btn').addEventListener('click', () => {
            const essayText = textArea.value;
            if (essayText.trim().length < 50) {
                alert("Please write a more substantial essay before submitting.");
                return;
            }
            evaluateEssay(data.prompt, essayText);
        });
    }

    // --- Audio & Evaluation Logic ---

    function createAudioControlsHTML() {
        if (!SpeechRecognition) return `<div class="status" style="color:var(--danger-color); font-weight:bold;">Your browser does not support speech recognition. Please use Google Chrome or Microsoft Edge for speaking tasks.</div>`;
        return `
            <div class="audio-controls">
                <button id="record-btn" class="record-btn">Start Recording</button>
                <div id="status" class="status">Press start to record</div>
            </div>`;
    }

    /** MODIFIED: This function now handles speech recognition events properly. */
    function addAudioControlListeners(taskType) {
        if (!recognition) return;

        const recordBtn = document.getElementById('record-btn');
        const statusDiv = document.getElementById('status');
        let isRecording = false;
        let finalTranscript = ''; // Variable to hold the final transcript

        // When user clicks the button
        recordBtn.onclick = () => {
            if (isRecording) {
                recognition.stop();
            } else {
                recognition.start();
            }
        };

        // When recognition starts
        recognition.onstart = () => {
            isRecording = true;
            finalTranscript = ''; // Reset transcript at the start
            recordBtn.textContent = 'Stop Recording';
            recordBtn.classList.add('recording');
            statusDiv.textContent = 'Recording... Speak now.';
        };

        // When a final result is recognized
        recognition.onresult = (event) => {
            // Concatenate all final results
            let newTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    newTranscript += event.results[i][0].transcript;
                }
            }
            finalTranscript += newTranscript;
            // We do NOT display or evaluate here. We wait for onend.
        };
        
        // When recognition ends (either by user stop or timeout)
        recognition.onend = () => {
            isRecording = false;
            recordBtn.textContent = 'Start Recording';
            recordBtn.classList.remove('recording');
            recordBtn.disabled = true; // Disable until processing is done
            
            if (finalTranscript.trim()) {
                statusDiv.textContent = 'Processing your speech...';
                evaluateSpokenResponse(finalTranscript.trim(), originalTextForEvaluation, taskType);
            } else {
                statusDiv.textContent = "Couldn't hear you. Please try again.";
                recordBtn.disabled = false; // Re-enable if nothing was heard
            }
        };

        // If an error occurs
        recognition.onerror = (event) => {
            statusDiv.textContent = `Error: ${event.error}. Please try again.`;
            isRecording = false;
        };
    }

    async function evaluateSpokenResponse(transcript, originalText, taskType) {
        showLoading();
        questionContainer.classList.add('hidden');
        try {
            const res = await fetch(`${API_BASE_URL}/evaluate/spoken-response`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify({ transcript, originalText, taskType }) 
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }
            // MODIFICATION: No JSON.parse() needed as backend sends a proper JSON object now.
            const feedback = await res.json();
            displayFeedback(feedback);
        } catch (error) { 
            console.error('Evaluation failed:', error);
            showWelcomeMessage(`Error during evaluation: ${error.message}`);
        } finally { 
            hideLoading();
        }
    }

    // NEW EVALUATION FUNCTION FOR ESSAY
    async function evaluateEssay(prompt, essayText) {
        showLoading();
        questionContainer.classList.add('hidden');
        try {
            const response = await fetch(`${API_BASE_URL}/evaluate/essay`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt, essayText })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }
            // MODIFICATION: No JSON.parse() needed.
            const feedback = await response.json();
            displayEssayFeedback(feedback);
        } catch (error) {
            console.error('Essay evaluation failed:', error);
            showWelcomeMessage(`Error during evaluation: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    // --- Feedback Display ---

    function displayFeedback(feedback) {
        feedbackContainer.innerHTML = `
            <h2 class="question-title">Evaluation Report</h2>
            <div class="score-card">
                <h3>Overall Score (Estimated)</h3>
                <p class="score">${feedback.overall_score_out_of_90} / 90</p>
                <p><strong>Summary:</strong> ${feedback.final_summary}</p>
            </div>
            <div class="score-card">
                <h3>Your Transcript</h3>
                <p><em>"${feedback.transcript}"</em></p>
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
    
    // NEW FEEDBACK DISPLAY FOR ESSAY
    function displayEssayFeedback(feedback) {
        feedbackContainer.innerHTML = `
            <h2 class="question-title">Essay Evaluation Report</h2>
            <div class="score-card">
                <h3>Overall Score (Estimated)</h3>
                <p class="score">${feedback.overall_score_out_of_90} / 90</p>
                <p><strong>Summary:</strong> ${feedback.final_summary}</p>
            </div>
            <div class="score-card">
                <h3>Content</h3>
                <p class="score">${feedback.content.score} / 5</p>
                <p><strong>Feedback:</strong> ${feedback.content.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Form (Word Count)</h3>
                <p class="score">${feedback.form.word_count} words</p>
                <p><strong>Feedback:</strong> ${feedback.form.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Grammar</h3>
                <p class="score">${feedback.grammar.score} / 5</p>
                <p><strong>Feedback:</strong> ${feedback.grammar.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Vocabulary</h3>
                <p class="score">${feedback.vocabulary.score} / 5</p>
                <p><strong>Feedback:</strong> ${feedback.vocabulary.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Structure & Coherence</h3>
                <p class="score">${feedback.structure.score} / 5</p>
                <p><strong>Feedback:</strong> ${feedback.structure.feedback}</p>
            </div>
        `;
        feedbackContainer.classList.remove('hidden');
    }

    // --- UI & Helper Functions ---

    function startTimer(duration, phase, timerElement, onComplete) {
        if (currentTimerInterval) clearInterval(currentTimerInterval);
        let timer = duration;
        timerElement.textContent = `${phase}: ${timer}s`;
        currentTimerInterval = setInterval(() => {
            timer--;
            timerElement.textContent = `${phase}: ${timer}s`;
            if (timer <= 0) {
                clearInterval(currentTimerInterval);
                if (onComplete) onComplete();
            }
        }, 1000);
    }
    
    function showLoading() {
        questionContainer.classList.add('hidden');
        welcomeMessage.classList.add('hidden');
        feedbackContainer.classList.add('hidden');
        loadingSpinner.classList.remove('hidden');
    }
    function hideLoading() {
        loadingSpinner.classList.add('hidden');
        questionContainer.classList.remove('hidden'); // Show container for content
    }
    function showWelcomeMessage(message = 'Select a task from the menu above to begin.') {
        welcomeMessage.innerHTML = `<p>${message}</p>`;
        welcomeMessage.classList.remove('hidden');
        questionContainer.classList.add('hidden');
        feedbackContainer.classList.add('hidden');
    }
});
