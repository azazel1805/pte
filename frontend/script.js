// frontend/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & Constants ---
    const taskButtons = document.querySelectorAll('.task-btn');
    const questionContainer = document.getElementById('question-container');
    const feedbackContainer = document.getElementById('feedback-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const welcomeMessage = document.getElementById('welcome-message');
    
    const API_BASE_URL = 'http://127.0.0.1:5001/api'; 

    let originalTextForEvaluation = '';
    let currentTimerInterval = null;
    let reorderParagraphSolution = [];

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
            if (currentTimerInterval) clearInterval(currentTimerInterval);
            if (recognition) recognition.stop();
            // Stop any speech synthesis
            window.speechSynthesis.cancel();
            
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
                // NEW TASK CASES
                case 'repeat-sentence':
                    response = await fetch(`${API_BASE_URL}/generate/repeat-sentence`);
                    displayRepeatSentence(await response.json());
                    break;
                case 'answer-short-question':
                    response = await fetch(`${API_BASE_URL}/generate/answer-short-question`);
                    displayAnswerShortQuestion(await response.json());
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
        questionContainer.innerHTML = `<h2 class="question-title">Read Aloud</h2><p class="instructions">You will have 30-40 seconds to read this text aloud as naturally and clearly as possible.</p><div class="content-box"><p>${data.text}</p></div>${createAudioControlsHTML()}`;
        addAudioControlListeners('Read Aloud');
    }

    // NEW DISPLAY FUNCTION: Repeat Sentence
    function displayRepeatSentence(data) {
        originalTextForEvaluation = data.text;
        questionContainer.innerHTML = `
            <h2 class="question-title">Repeat Sentence</h2>
            <p class="instructions">You will hear a sentence. Listen carefully and repeat the sentence exactly as you hear it.</p>
            <div id="status-light" class="status-light-off"></div>
            <button id="play-sentence-btn" class="task-btn">Play Sentence</button>
            <div class="audio-controls-container" style="visibility: hidden;">
                ${createAudioControlsHTML()}
            </div>
        `;
        
        const playBtn = document.getElementById('play-sentence-btn');
        const statusLight = document.getElementById('status-light');
        const audioControls = document.querySelector('.audio-controls-container');
        const recordBtn = document.getElementById('record-btn');

        playBtn.addEventListener('click', () => {
            if (!data.text) return;
            
            const utterance = new SpeechSynthesisUtterance(data.text);
            utterance.onstart = () => {
                playBtn.disabled = true;
                playBtn.textContent = 'Playing...';
                statusLight.className = 'status-light-on';
            };
            utterance.onend = () => {
                playBtn.textContent = 'Played';
                statusLight.className = 'status-light-off';
                audioControls.style.visibility = 'visible';
                if(recordBtn) recordBtn.click(); // Auto-start recording
            };
            window.speechSynthesis.speak(utterance);
        }, { once: true }); // Ensure the button is only clicked once

        addAudioControlListeners('Repeat Sentence');
    }

    // NEW DISPLAY FUNCTION: Answer Short Question
    function displayAnswerShortQuestion(data) {
        if (!data.question || !data.answer) {
             questionContainer.innerHTML = `<p style="color:red;">Error loading question. Please try again.</p>`;
             return;
        }
        originalTextForEvaluation = data.question; // The question is the "original text"
        questionContainer.innerHTML = `
            <h2 class="question-title">Answer Short Question</h2>
            <p class="instructions">You will hear a short question. Please give a simple and short answer.</p>
            <div class="content-box"><p>${data.question}</p></div>
            ${createAudioControlsHTML()}
        `;
        // Pass the correct answer to the listener setup
        addAudioControlListeners('Answer Short Question', data.answer);
    }
    
    function displayDescribeImage(data) {
        if (data.error) { questionContainer.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`; return; }
        originalTextForEvaluation = `An image showing: ${data.alt}`;
        questionContainer.innerHTML = `<h2 class="question-title">Describe Image</h2><div id="timer" class="timer-display"></div><p class="instructions">You have 25 seconds to prepare. After the beep, you will have 40 seconds to describe the image.</p><div class="image-container"><img src="${data.imageUrl}" alt="${data.alt}"><p class="photographer-credit">Photo by ${data.photographer} on Pexels</p></div>${createAudioControlsHTML()}`;
        const recordBtn = document.getElementById('record-btn');
        if (recordBtn) recordBtn.disabled = true;
        startTimer(25, 'Preparation Time', document.getElementById('timer'), () => {
            document.getElementById('timer').style.color = 'var(--success-color)';
            try { new Audio('https://www.soundjay.com/buttons/beep-07a.mp3').play(); } catch(e) { console.warn("Could not play beep sound."); }
            if (recordBtn) {
                recordBtn.disabled = false;
                recordBtn.click();
            }
            startTimer(40, 'Answering Time', document.getElementById('timer'), () => {
                if (recordBtn && recordBtn.classList.contains('recording')) recordBtn.click();
            });
        });
        addAudioControlListeners('Describe Image');
    }

    function displayReorderParagraph(data) {
        if (!data.shuffledSentences || !data.solution) { questionContainer.innerHTML = `<p style="color:red;">Error: Invalid data for Re-order Paragraph.</p>`; return; }
        reorderParagraphSolution = data.solution;
        const listItems = data.shuffledSentences.map(sentence => `<li class="reorder-item" draggable="true">${sentence}</li>`).join('');
        questionContainer.innerHTML = `<h2 class="question-title">Re-order Paragraphs</h2><p class="instructions">The text boxes below are in a random order. Restore the original order by dragging and dropping them.</p><ul id="reorder-list">${listItems}</ul><button id="check-reorder-btn" class="task-btn submit-btn" style="margin-top: 20px;">Check Answer</button><div id="reorder-feedback-message" class="feedback-message"></div>`;
        new Sortable(document.getElementById('reorder-list'), { animation: 150, ghostClass: 'sortable-ghost' });
        document.getElementById('check-reorder-btn').addEventListener('click', (event) => {
            const checkButton = event.target;
            const feedbackMessageEl = document.getElementById('reorder-feedback-message');
            const userOrderedItems = document.querySelectorAll('#reorder-list .reorder-item');
            const userOrder = Array.from(userOrderedItems).map(item => item.textContent);
            if (JSON.stringify(userOrder) === JSON.stringify(reorderParagraphSolution)) {
                feedbackMessageEl.textContent = "Correct! The order is perfect.";
                feedbackMessageEl.className = 'feedback-message correct';
                checkButton.disabled = true;
            } else {
                feedbackMessageEl.textContent = "Not quite right. Try re-arranging the sentences again.";
                feedbackMessageEl.className = 'feedback-message incorrect';
            }
        });
    }

    function displayEssay(data) {
        if (data.error) { questionContainer.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`; return; }
        originalTextForEvaluation = data.prompt;
        questionContainer.innerHTML = `<h2 class="question-title">Essay Writing</h2><p class="instructions">You have 20 minutes to plan, write, and revise an essay on the topic below. Your response should be 200-300 words.</p><div class="content-box"><p><strong>${data.prompt}</strong></p></div><textarea id="essay-textarea" placeholder="Start writing your essay here..." rows="15"></textarea><p id="word-count">Word Count: 0</p><button id="submit-essay-btn" class="task-btn submit-btn">Submit for Evaluation</button>`;
        const textArea = document.getElementById('essay-textarea');
        const wordCountEl = document.getElementById('word-count');
        textArea.addEventListener('input', () => {
            const words = textArea.value.trim().split(/\s+/).filter(word => word.length > 0);
            wordCountEl.textContent = `Word Count: ${words.length}`;
        });
        document.getElementById('submit-essay-btn').addEventListener('click', () => {
            const essayText = textArea.value;
            if (essayText.trim().length < 50) { alert("Please write a more substantial essay before submitting."); return; }
            evaluateEssay(data.prompt, essayText);
        });
    }

    // --- Audio & Evaluation Logic ---

    function createAudioControlsHTML() {
        if (!SpeechRecognition) return `<div class="status" style="color:var(--danger-color); font-weight:bold;">Your browser does not support speech recognition.</div>`;
        return `<div class="audio-controls"><button id="record-btn" class="record-btn">Start Recording</button><div id="status" class="status">Press start to record</div></div>`;
    }
    
    // MODIFIED: Now accepts an optional correctAnswer parameter
    function addAudioControlListeners(taskType, correctAnswer = null) {
        if (!recognition) return;
        const recordBtn = document.getElementById('record-btn');
        if (!recordBtn) return;
        const statusDiv = document.getElementById('status');
        let isRecording = false;
        let finalTranscript = ''; 
        recordBtn.onclick = () => isRecording ? recognition.stop() : recognition.start();
        recognition.onstart = () => { isRecording = true; finalTranscript = ''; recordBtn.textContent = 'Stop Recording'; recordBtn.classList.add('recording'); statusDiv.textContent = 'Recording...'; };
        recognition.onresult = (event) => {
            let newTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) newTranscript += event.results[i][0].transcript;
            }
            finalTranscript += newTranscript;
        };
        recognition.onend = () => {
            isRecording = false;
            recordBtn.textContent = 'Start Recording';
            recordBtn.classList.remove('recording');
            recordBtn.disabled = true;
            if (finalTranscript.trim()) {
                statusDiv.textContent = 'Processing...';
                // Pass the correct answer to the evaluation function
                evaluateSpokenResponse(finalTranscript.trim(), originalTextForEvaluation, taskType, correctAnswer);
            } else {
                statusDiv.textContent = "Couldn't hear you. Please try again.";
                recordBtn.disabled = false;
            }
        };
        recognition.onerror = (event) => { statusDiv.textContent = `Error: ${event.error}.`; isRecording = false; };
    }
    
    // MODIFIED: Now accepts correctAnswer and sends it to the backend
    async function evaluateSpokenResponse(transcript, originalText, taskType, correctAnswer = null) {
        showLoading(); questionContainer.classList.add('hidden');
        try {
            const payload = { transcript, originalText, taskType };
            if (correctAnswer) {
                payload.correctAnswer = correctAnswer;
            }

            const res = await fetch(`${API_BASE_URL}/evaluate/spoken-response`, { 
                method: 'POST', 
                headers: { 'Content-Type': 'application/json' }, 
                body: JSON.stringify(payload)
            });

            if (!res.ok) { const errorData = await res.json(); throw new Error(errorData.error || `HTTP error! status: ${res.status}`); }
            const feedback = await res.json();
            displayFeedback(feedback);
        } catch (error) { console.error('Evaluation failed:', error); showWelcomeMessage(`Error during evaluation: ${error.message}`); } finally { hideLoading(); }
    }
    
    async function evaluateEssay(prompt, essayText) {
        showLoading(); questionContainer.classList.add('hidden');
        try {
            const response = await fetch(`${API_BASE_URL}/evaluate/essay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, essayText }) });
            if (!response.ok) { const errorData = await response.json(); throw new Error(errorData.error || `HTTP error! status: ${response.status}`); }
            const feedback = await response.json();
            displayEssayFeedback(feedback);
        } catch (error) { console.error('Essay evaluation failed:', error); showWelcomeMessage(`Error during evaluation: ${error.message}`); } finally { hideLoading(); }
    }

    // --- Feedback Display & UI Helpers ---
    // ... (These functions are unchanged) ...
    function displayFeedback(feedback) {
        feedbackContainer.innerHTML = `<h2 class="question-title">Evaluation Report</h2><div class="score-card"><h3>Overall Score (Estimated)</h3><p class="score">${feedback.overall_score_out_of_90} / 90</p><p><strong>Summary:</strong> ${feedback.final_summary}</p></div><div class="score-card"><h3>Your Transcript</h3><p><em>"${feedback.transcript}"</em></p></div><div class="score-card"><h3>Oral Fluency</h3><p class="score">${feedback.oral_fluency.score} / 5</p><p><strong>Feedback:</strong> ${feedback.oral_fluency.feedback}</p></div><div class="score-card"><h3>Pronunciation</h3><p class="score">${feedback.pronunciation.score} / 5</p><p><strong>Feedback:</strong> ${feedback.pronunciation.feedback}</p></div><div class="score-card"><h3>Content</h3><p class="score">${feedback.content.score} / ${feedback.taskType === 'Answer Short Question' ? 1:5}</p><p><strong>Feedback:</strong> ${feedback.content.feedback}</p></div>`;
        feedbackContainer.classList.remove('hidden');
    }
    function displayEssayFeedback(feedback) {
        feedbackContainer.innerHTML = `<h2 class="question-title">Essay Evaluation Report</h2><div class="score-card"><h3>Overall Score (Estimated)</h3><p class="score">${feedback.overall_score_out_of_90} / 90</p><p><strong>Summary:</strong> ${feedback.final_summary}</p></div><div class="score-card"><h3>Content</h3><p class="score">${feedback.content.score} / 5</p><p><strong>Feedback:</strong> ${feedback.content.feedback}</p></div><div class="score-card"><h3>Form (Word Count)</h3><p class="score">${feedback.form.word_count} words</p><p><strong>Feedback:</strong> ${feedback.form.feedback}</p></div><div class="score-card"><h3>Grammar</h3><p class="score">${feedback.grammar.score} / 5</p><p><strong>Feedback:</strong> ${feedback.grammar.feedback}</p></div><div class="score-card"><h3>Vocabulary</h3><p class="score">${feedback.vocabulary.score} / 5</p><p><strong>Feedback:</strong> ${feedback.vocabulary.feedback}</p></div><div class="score-card"><h3>Structure & Coherence</h3><p class="score">${feedback.structure.score} / 5</p><p><strong>Feedback:</strong> ${feedback.structure.feedback}</p></div>`;
        feedbackContainer.classList.remove('hidden');
    }
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
    function showLoading() { questionContainer.classList.add('hidden'); welcomeMessage.classList.add('hidden'); feedbackContainer.classList.add('hidden'); loadingSpinner.classList.remove('hidden'); }
    function hideLoading() { loadingSpinner.classList.add('hidden'); questionContainer.classList.remove('hidden'); }
    function showWelcomeMessage(message = 'Select a task from the menu above to begin.') { welcomeMessage.innerHTML = `<p>${message}</p>`; welcomeMessage.classList.remove('hidden'); questionContainer.classList.add('hidden'); feedbackContainer.classList.add('hidden'); }
});
