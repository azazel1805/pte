// frontend/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & Constants ---
    const taskButtons = document.querySelectorAll('.task-btn');
    const questionContainer = document.getElementById('question-container');
    const feedbackContainer = document.getElementById('feedback-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const welcomeMessage = document.getElementById('welcome-message');
    
    const API_BASE_URL = 'http://127.0.0.1:5001/api'; // For local testing
    // const API_BASE_URL = 'https://your-backend-name.onrender.com/api'; // For production

    let originalTextForEvaluation = '';
    let currentTimerInterval = null;

    // --- Web Speech API Init ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition;
    if (SpeechRecognition) {
        recognition = new SpeechRecognition();
        recognition.continuous = true; recognition.lang = 'en-US'; recognition.interimResults = false;
    }

    // --- Event Listeners ---
    taskButtons.forEach(button => {
        button.addEventListener('click', () => {
            if (currentTimerInterval) clearInterval(currentTimerInterval);
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
            const response = await fetch(`${API_BASE_URL}/generate/${task.replace('_', '-')}`);
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to load task from server.');
            }
            const data = await response.json();
            
            switch (task) {
                case 'read-aloud': displayReadAloud(data); break;
                case 'describe-image': displayDescribeImage(data); break;
                case 'reorder-paragraph': displayReorderParagraph(data); break;
                case 'essay': displayEssay(data); break;
                // --- NEW CASES ---
                case 'summarize-written-text': displaySummarizeWrittenText(data); break;
                case 'mcsa': displayMcsa(data); break;
                default: showWelcomeMessage(`Task "${task}" not implemented yet.`);
            }
        } catch (error) {
            console.error('Error loading task:', error);
            showWelcomeMessage(`Error: ${error.message}`);
        } finally {
            hideLoading();
        }
    }
    
    // --- Display Functions ---
    // ... (Read Aloud, Describe Image, Reorder Para, Essay functions are unchanged) ...
    function displayReadAloud(data) { /* ... unchanged ... */ }
    function displayDescribeImage(data) { /* ... unchanged ... */ }
    function displayReorderParagraph(data) { /* ... unchanged ... */ }
    function displayEssay(data) { /* ... unchanged ... */ }

    // --- NEW DISPLAY FUNCTIONS ---
    function displaySummarizeWrittenText(data) {
        originalTextForEvaluation = data.text;
        questionContainer.innerHTML = `
            <h2 class="question-title">Summarize Written Text</h2>
            <div id="timer" class="timer-display"></div>
            <p class="instructions">Read the passage below and summarize it in one single sentence. You have 10 minutes.</p>
            <div class="content-box" style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;">
                <p>${data.text}</p>
            </div>
            <textarea id="swt-textarea" placeholder="Write your one-sentence summary here..." rows="4" style="width: 100%; padding: 10px; font-size: 1rem;"></textarea>
            <p id="word-count" style="text-align: right; margin-top: 5px; font-weight: bold;">Word Count: 0</p>
            <button id="submit-swt-btn" class="task-btn" style="margin-top: 1rem; background-color: var(--success-color); border-color: var(--success-color); color: white;">Submit</button>
        `;
        
        const textArea = document.getElementById('swt-textarea');
        const wordCountEl = document.getElementById('word-count');
        const submitBtn = document.getElementById('submit-swt-btn');

        textArea.addEventListener('input', () => {
            const words = textArea.value.trim().split(/\s+/).filter(word => word.length > 0);
            wordCountEl.textContent = `Word Count: ${words.length}`;
        });
        
        submitBtn.addEventListener('click', () => {
            if (currentTimerInterval) clearInterval(currentTimerInterval);
            evaluateSwt(data.text, textArea.value);
        });

        startTimer(600, "Time Remaining", document.getElementById('timer'), () => {
            alert("Time is up!");
            submitBtn.click();
        });
    }

    function displayMcsa(data) {
        let optionsHtml = data.options.map((option, index) => `
            <div class="mcsa-option">
                <input type="radio" id="option${index}" name="mcsa-option" value="${index}">
                <label for="option${index}">${option}</label>
            </div>
        `).join('');

        questionContainer.innerHTML = `
            <h2 class="question-title">Multiple-Choice, Single Answer</h2>
            <p class="instructions">Read the text and answer the multiple-choice question by selecting the correct response.</p>
            <div class="content-box" style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;">
                <p>${data.passage}</p>
            </div>
            <div class="mcsa-question"><strong>${data.question}</strong></div>
            <div id="mcsa-options-container">${optionsHtml}</div>
            <button id="submit-mcsa-btn" class="task-btn" style="margin-top: 1rem;">Submit Answer</button>
            <div id="mcsa-feedback" style="margin-top: 1rem; font-weight: bold;"></div>
        `;

        document.getElementById('submit-mcsa-btn').addEventListener('click', () => {
            const selectedOption = document.querySelector('input[name="mcsa-option"]:checked');
            const feedbackEl = document.getElementById('mcsa-feedback');
            
            if (!selectedOption) {
                alert("Please select an answer.");
                return;
            }

            const selectedIndex = parseInt(selectedOption.value, 10);
            const correctIndex = data.correct_answer_index;

            if (selectedIndex === correctIndex) {
                feedbackEl.textContent = "Correct!";
                feedbackEl.style.color = 'var(--success-color)';
            } else {
                feedbackEl.textContent = `Incorrect. The correct answer was: "${data.options[correctIndex]}"`;
                feedbackEl.style.color = 'var(--danger-color)';
            }
            document.getElementById('submit-mcsa-btn').disabled = true;
        });
    }

    // --- Evaluation Logic ---
    // ... (evaluateSpokenResponse, evaluateEssay are unchanged) ...
    async function evaluateSpokenResponse(transcript, originalText, taskType) { /* ... unchanged ... */ }
    async function evaluateEssay(prompt, essayText) { /* ... unchanged ... */ }

    // --- NEW EVALUATION FUNCTION ---
    async function evaluateSwt(originalText, summaryText) {
        showLoading();
        questionContainer.classList.add('hidden');
        try {
            const response = await fetch(`${API_BASE_URL}/evaluate/swt`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ originalText, summaryText })
            });

            if (!response.ok) throw new Error((await response.json()).error);
            const feedback = JSON.parse(await response.json());
            displaySwtFeedback(feedback);
        } catch (error) {
            console.error('SWT evaluation failed:', error);
            showWelcomeMessage(`Error during evaluation: ${error.message}`);
        } finally {
            hideLoading();
        }
    }

    // --- Feedback Display ---
    // ... (displayFeedback for spoken, displayEssayFeedback are unchanged) ...
    function displayFeedback(feedback) { /* ... unchanged ... */ }
    function displayEssayFeedback(feedback) { /* ... unchanged ... */ }

    // --- NEW FEEDBACK DISPLAY ---
    function displaySwtFeedback(feedback) {
        feedbackContainer.innerHTML = `
            <h2 class="question-title">Summarize Written Text - Report</h2>
            <div class="score-card">
                <h3>Overall Score (Estimated)</h3>
                <p class="score">${feedback.overall_score_out_of_7} / 7</p>
                <p><strong>Summary:</strong> ${feedback.final_summary}</p>
            </div>
            <div class="score-card">
                <h3>Content</h3>
                <p class="score">${feedback.content.score} / 2</p>
                <p><strong>Feedback:</strong> ${feedback.content.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Form (Single Sentence)</h3>
                <p class="score">${feedback.form.is_single_sentence ? 'Correct' : 'Incorrect'}</p>
                <p><strong>Feedback:</strong> ${feedback.form.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Grammar</h3>
                <p class="score">${feedback.grammar.score} / 2</p>
                <p><strong>Feedback:</strong> ${feedback.grammar.feedback}</p>
            </div>
            <div class="score-card">
                <h3>Vocabulary</h3>
                <p class="score">${feedback.vocabulary.score} / 1</p>
                <p><strong>Feedback:</strong> ${feedback.vocabulary.feedback}</p>
            </div>
             <div class="score-card">
                <h3>Word Count</h3>
                <p class="score">${feedback.word_count.count} words (${feedback.word_count.is_valid ? 'Valid' : 'Invalid'})</p>
            </div>
        `;
        feedbackContainer.classList.remove('hidden');
    }

    // --- UI & Helper Functions ---
    // ... (All helpers are unchanged, but I'll paste them for completeness) ...
    function startTimer(duration, phase, timerElement, onComplete) {
        if (currentTimerInterval) clearInterval(currentTimerInterval);
        let timer = duration;
        timerElement.textContent = `${phase}: ${timer}s`;
        const interval = setInterval(() => {
            timer--;
            const minutes = Math.floor(timer / 60);
            const seconds = timer % 60;
            timerElement.textContent = `${phase}: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
            if (timer <= 0) {
                clearInterval(interval);
                if (onComplete) onComplete();
            }
        }, 1000);
        currentTimerInterval = interval;
    }
    
    function showLoading() { questionContainer.classList.add('hidden'); welcomeMessage.classList.add('hidden'); feedbackContainer.classList.add('hidden'); loadingSpinner.classList.remove('hidden'); }
    function hideLoading() { loadingSpinner.classList.add('hidden'); questionContainer.classList.remove('hidden'); }
    function showWelcomeMessage(message = 'Select a task to begin.') { welcomeMessage.innerHTML = `<p>${message}</p>`; welcomeMessage.classList.remove('hidden'); questionContainer.classList.add('hidden'); feedbackContainer.classList.add('hidden'); }
    
    // Unchanged functions (pasted for reference)
    function displayReadAloud(data) { originalTextForEvaluation = data.text; questionContainer.innerHTML = `<h2 class="question-title">Read Aloud</h2><p class="instructions">...</p><div class="content-box"><p>${data.text}</p></div>${createAudioControlsHTML()}`; addAudioControlListeners('Read Aloud'); }
    function displayDescribeImage(data) { if (data.error) { questionContainer.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`; return; } originalTextForEvaluation = `An image showing: ${data.alt}`; questionContainer.innerHTML = `<h2 class="question-title">Describe Image</h2><div id="timer" class="timer-display"></div><p class="instructions">...</p><div class="image-container"><img src="${data.imageUrl}" alt="${data.alt}"><p class="photographer-credit">...</p></div>${createAudioControlsHTML()}`; const recordBtn = document.getElementById('record-btn'); if (recordBtn) recordBtn.disabled = true; startTimer(25, 'Preparation', document.getElementById('timer'), () => { document.getElementById('timer').style.color = 'var(--success-color)'; try { new Audio('https://www.soundjay.com/buttons/beep-07a.mp3').play(); } catch(e){} if (recordBtn) { recordBtn.disabled = false; recordBtn.click(); } startTimer(40, 'Answering', document.getElementById('timer'), () => { if (recordBtn && recordBtn.classList.contains('recording')) { recordBtn.click(); } }); }); addAudioControlListeners('Describe Image'); }
    function displayReorderParagraph(data) { const listItems = data.sentences.map(sentence => `<li class="reorder-item" draggable="true">${sentence}</li>`).join(''); questionContainer.innerHTML = `<h2 class="question-title">Re-order Paragraphs</h2>...<ul id="reorder-list">${listItems}</ul><button id="check-reorder-btn" class="task-btn">Check</button>`; new Sortable(document.getElementById('reorder-list'), { animation: 150 }); document.getElementById('check-reorder-btn').addEventListener('click', () => alert("Answer checking is a future enhancement!")); }
    function displayEssay(data) { originalTextForEvaluation = data.prompt; questionContainer.innerHTML = `<h2 class="question-title">Essay Writing</h2>...<div class="content-box"><p><strong>${data.prompt}</strong></p></div><textarea id="essay-textarea" ...></textarea><p id="word-count">Word Count: 0</p><button id="submit-essay-btn" class="task-btn">Submit</button>`; const textArea = document.getElementById('essay-textarea'); const wordCountEl = document.getElementById('word-count'); textArea.addEventListener('input', () => { const words = textArea.value.trim().split(/\s+/).filter(Boolean); wordCountEl.textContent = `Word Count: ${words.length}`; }); document.getElementById('submit-essay-btn').addEventListener('click', () => { if (textArea.value.trim().length < 50) return alert("Please write more."); evaluateEssay(data.prompt, textArea.value); }); }
    function createAudioControlsHTML() { if (!SpeechRecognition) return `<div class="status" style="color:var(--danger-color);">Speech recognition not supported in this browser.</div>`; return `<div class="audio-controls"><button id="record-btn" class="record-btn">Start</button><div id="status" class="status">Press start</div></div>`; }
    function addAudioControlListeners(taskType) { const recordBtn = document.getElementById('record-btn'); if (!recordBtn) return; const statusDiv = document.getElementById('status'); let isRecording = false; recordBtn.onclick = () => isRecording ? recognition.stop() : recognition.start(); recognition.onstart = () => { isRecording = true; recordBtn.textContent = 'Stop'; recordBtn.classList.add('recording'); statusDiv.textContent = 'Recording...'; }; recognition.onend = () => { isRecording = false; recordBtn.textContent = 'Start'; recordBtn.classList.remove('recording'); statusDiv.textContent = 'Processing...'; recordBtn.disabled = true; }; recognition.onerror = (e) => { statusDiv.textContent = `Error: ${e.error}.`; isRecording = false; }; recognition.onresult = (e) => { let transcript = Array.from(e.results).map(r => r[0]).map(r => r.transcript).join(''); if (transcript.trim()) evaluateSpokenResponse(transcript.trim(), originalTextForEvaluation, taskType); else { statusDiv.textContent = "Couldn't hear you."; recordBtn.disabled = false; } }; }
    async function evaluateSpokenResponse(transcript, originalText, taskType) { showLoading(); questionContainer.classList.add('hidden'); try { const res = await fetch(`${API_BASE_URL}/evaluate/spoken-response`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, originalText, taskType }) }); if (!res.ok) throw new Error((await res.json()).error); const feedback = JSON.parse(await res.json()); displayFeedback(feedback); } catch (error) { console.error('Evaluation failed:', error); showWelcomeMessage(`Error: ${error.message}`); } finally { hideLoading(); } }
    async function evaluateEssay(prompt, essayText) { showLoading(); questionContainer.classList.add('hidden'); try { const res = await fetch(`${API_BASE_URL}/evaluate/essay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, essayText }) }); if (!res.ok) throw new Error((await res.json()).error); const feedback = JSON.parse(await res.json()); displayEssayFeedback(feedback); } catch (error) { console.error('Essay evaluation failed:', error); showWelcomeMessage(`Error: ${error.message}`); } finally { hideLoading(); } }
    function displayFeedback(feedback) { feedbackContainer.innerHTML = `<h2 class="question-title">Evaluation Report</h2>...`; feedbackContainer.classList.remove('hidden'); }
    function displayEssayFeedback(feedback) { feedbackContainer.innerHTML = `<h2 class="question-title">Essay Evaluation Report</h2>...`; feedbackContainer.classList.remove('hidden'); }
});
