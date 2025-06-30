// frontend/script.js

document.addEventListener('DOMContentLoaded', () => {
    // --- Global Variables & Constants ---
    const taskButtons = document.querySelectorAll('.task-btn');
    const questionContainer = document.getElementById('question-container');
    const feedbackContainer = document.getElementById('feedback-container');
    const loadingSpinner = document.getElementById('loading-spinner');
    const welcomeMessage = document.getElementById('welcome-message');
    
    const API_BASE_URL = 'https://pte-backend-y5hy.onrender.com/api';

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
            const response = await fetch(`${API_BASE_URL}/generate/${task.replace(/_/g, '-')}`);
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error || 'Failed to load task from server.');
            }
            
            switch (task) {
                case 'read-aloud': displayReadAloud(data); break;
                case 'describe-image': displayDescribeImage(data); break;
                case 'reorder-paragraph': displayReorderParagraph(data); break;
                case 'essay': displayEssay(data); break;
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
    // (All display functions are unchanged from the previous version)
    function displayReadAloud(data) { /* ... unchanged ... */ }
    function displayDescribeImage(data) { /* ... unchanged ... */ }
    function displayReorderParagraph(data) { /* ... unchanged ... */ }
    function displayEssay(data) { /* ... unchanged ... */ }
    function displaySummarizeWrittenText(data) { /* ... unchanged ... */ }
    function displayMcsa(data) { /* ... unchanged ... */ }

    // --- Evaluation Logic (MODIFIED) ---
    async function evaluateSpokenResponse(transcript, originalText, taskType) {
        showLoading(); questionContainer.classList.add('hidden');
        try {
            const response = await fetch(`${API_BASE_URL}/evaluate/spoken-response`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ transcript, originalText, taskType }) });
            const feedback = await response.json(); // Single, robust parse
            if (!response.ok) throw new Error(feedback.error);
            displayFeedback(feedback);
        } catch (error) { console.error('Evaluation failed:', error); showWelcomeMessage(`Error: ${error.message}`); } finally { hideLoading(); }
    }

    async function evaluateEssay(prompt, essayText) {
        showLoading(); questionContainer.classList.add('hidden');
        try {
            const response = await fetch(`${API_BASE_URL}/evaluate/essay`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt, essayText }) });
            const feedback = await response.json(); // Single, robust parse
            if (!response.ok) throw new Error(feedback.error);
            displayEssayFeedback(feedback);
        } catch (error) { console.error('Essay evaluation failed:', error); showWelcomeMessage(`Error: ${error.message}`); } finally { hideLoading(); }
    }

    async function evaluateSwt(originalText, summaryText) {
        showLoading(); questionContainer.classList.add('hidden');
        try {
            const response = await fetch(`${API_BASE_URL}/evaluate/swt`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ originalText, summaryText }) });
            const feedback = await response.json(); // Single, robust parse
            if (!response.ok) throw new Error(feedback.error);
            displaySwtFeedback(feedback);
        } catch (error) { console.error('SWT evaluation failed:', error); showWelcomeMessage(`Error: ${error.message}`); } finally { hideLoading(); }
    }

    // --- Feedback Display ---
    // (All feedback display functions are unchanged)
    function displayFeedback(feedback) { /* ... unchanged ... */ }
    function displayEssayFeedback(feedback) { /* ... unchanged ... */ }
    function displaySwtFeedback(feedback) { /* ... unchanged ... */ }

    // --- UI & Helper Functions ---
    // (All helper functions are unchanged)
    function startTimer(duration, phase, timerElement, onComplete) { /* ... unchanged ... */ }
    function showLoading() { /* ... unchanged ... */ }
    function hideLoading() { /* ... unchanged ... */ }
    function showWelcomeMessage(message = 'Select a task to begin.') { /* ... unchanged ... */ }
    function createAudioControlsHTML() { /* ... unchanged ... */ }
    function addAudioControlListeners(taskType) { /* ... unchanged ... */ }

    // --- Paste the full, unchanged functions here for completeness ---
    // (Copy these from the previous answer. They don't need modification, but are required for the script to run.)
    function displayReadAloud(data) { originalTextForEvaluation = data.text; questionContainer.innerHTML = `<h2 class="question-title">Read Aloud</h2><p class="instructions">Look at the text below. You will have 40 seconds to read this text aloud as naturally and clearly as possible.</p><div class="content-box"><p>${data.text}</p></div>${createAudioControlsHTML()}`; addAudioControlListeners('Read Aloud'); }
    function displayDescribeImage(data) { if (data.error) { questionContainer.innerHTML = `<p style="color:red;">Error: ${data.error}</p>`; return; } originalTextForEvaluation = `An image showing: ${data.alt}`; questionContainer.innerHTML = `<h2 class="question-title">Describe Image</h2><div id="timer" class="timer-display"></div><p class="instructions">You have 25 seconds to prepare. After the beep, you will have 40 seconds to describe the image.</p><div class="image-container"><img src="${data.imageUrl}" alt="${data.alt}"><p class="photographer-credit">Photo by ${data.photographer} on Pexels</p></div>${createAudioControlsHTML()}`; const recordBtn = document.getElementById('record-btn'); if (recordBtn) recordBtn.disabled = true; startTimer(25, 'Preparation', document.getElementById('timer'), () => { document.getElementById('timer').style.color = 'var(--success-color)'; try { new Audio('https://www.soundjay.com/buttons/beep-07a.mp3').play(); } catch(e){} if (recordBtn) { recordBtn.disabled = false; recordBtn.click(); } startTimer(40, 'Answering', document.getElementById('timer'), () => { if (recordBtn && recordBtn.classList.contains('recording')) { recordBtn.click(); } }); }); addAudioControlListeners('Describe Image'); }
    function displayReorderParagraph(data) { const listItems = data.sentences.map(sentence => `<li class="reorder-item" draggable="true">${sentence}</li>`).join(''); questionContainer.innerHTML = `<h2 class="question-title">Re-order Paragraphs</h2><p class="instructions">The text boxes below are in a random order. Restore the original order by dragging and dropping them.</p><ul id="reorder-list">${listItems}</ul><button id="check-reorder-btn" class="task-btn" style="margin-top: 20px;">Check Answer</button>`; new Sortable(document.getElementById('reorder-list'), { animation: 150 }); document.getElementById('check-reorder-btn').addEventListener('click', () => alert("Answer checking for this question type is a future enhancement!")); }
    function displayEssay(data) { originalTextForEvaluation = data.prompt; questionContainer.innerHTML = `<h2 class="question-title">Essay Writing</h2><p class="instructions">You have 20 minutes to plan, write, and revise an essay on the topic below. Your response should be 200-300 words.</p><div class="content-box"><p><strong>${data.prompt}</strong></p></div><textarea id="essay-textarea" placeholder="Start writing your essay here..." rows="15" style="width: 100%; margin-top: 1rem; padding: 10px; font-size: 1rem; border-radius: 5px; border: 1px solid var(--border-color);"></textarea><p id="word-count" style="text-align: right; margin-top: 5px; font-weight: bold;">Word Count: 0</p><button id="submit-essay-btn" class="task-btn" style="margin-top: 1rem; background-color: var(--success-color); border-color: var(--success-color); color: white;">Submit for Evaluation</button>`; const textArea = document.getElementById('essay-textarea'); const wordCountEl = document.getElementById('word-count'); textArea.addEventListener('input', () => { const words = textArea.value.trim().split(/\s+/).filter(Boolean); wordCountEl.textContent = `Word Count: ${words.length}`; }); document.getElementById('submit-essay-btn').addEventListener('click', () => { if (textArea.value.trim().length < 50) return alert("Please write a more substantial essay before submitting."); evaluateEssay(data.prompt, textArea.value); }); }
    function displaySummarizeWrittenText(data) { originalTextForEvaluation = data.text; questionContainer.innerHTML = `<h2 class="question-title">Summarize Written Text</h2><div id="timer" class="timer-display"></div><p class="instructions">Read the passage below and summarize it in one single sentence. You have 10 minutes.</p><div class="content-box" style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;"><p>${data.text}</p></div><textarea id="swt-textarea" placeholder="Write your one-sentence summary here..." rows="4" style="width: 100%; padding: 10px; font-size: 1rem;"></textarea><p id="word-count" style="text-align: right; margin-top: 5px; font-weight: bold;">Word Count: 0</p><button id="submit-swt-btn" class="task-btn" style="margin-top: 1rem; background-color: var(--success-color); border-color: var(--success-color); color: white;">Submit</button>`; const textArea = document.getElementById('swt-textarea'); const wordCountEl = document.getElementById('word-count'); const submitBtn = document.getElementById('submit-swt-btn'); textArea.addEventListener('input', () => { const words = textArea.value.trim().split(/\s+/).filter(word => word.length > 0); wordCountEl.textContent = `Word Count: ${words.length}`; }); submitBtn.addEventListener('click', () => { if (currentTimerInterval) clearInterval(currentTimerInterval); evaluateSwt(data.text, textArea.value); }); startTimer(600, "Time Remaining", document.getElementById('timer'), () => { alert("Time is up!"); submitBtn.click(); }); }
    function displayMcsa(data) { let optionsHtml = data.options.map((option, index) => `<div class="mcsa-option" style="margin: 10px 0; padding: 10px; border: 1px solid #ccc; border-radius: 5px;"><input type="radio" id="option${index}" name="mcsa-option" value="${index}"><label for="option${index}" style="margin-left: 10px;">${option}</label></div>`).join(''); questionContainer.innerHTML = `<h2 class="question-title">Multiple-Choice, Single Answer</h2><p class="instructions">Read the text and answer the multiple-choice question by selecting the correct response.</p><div class="content-box" style="max-height: 200px; overflow-y: auto; margin-bottom: 1rem;"><p>${data.passage}</p></div><div class="mcsa-question" style="font-weight: bold; margin-bottom: 1rem;"><strong>${data.question}</strong></div><div id="mcsa-options-container">${optionsHtml}</div><button id="submit-mcsa-btn" class="task-btn" style="margin-top: 1rem;">Submit Answer</button><div id="mcsa-feedback" style="margin-top: 1rem; font-weight: bold; padding: 10px; border-radius: 5px;"></div>`; document.getElementById('submit-mcsa-btn').addEventListener('click', () => { const selectedOption = document.querySelector('input[name="mcsa-option"]:checked'); const feedbackEl = document.getElementById('mcsa-feedback'); if (!selectedOption) { alert("Please select an answer."); return; } const selectedIndex = parseInt(selectedOption.value, 10); const correctIndex = data.correct_answer_index; if (selectedIndex === correctIndex) { feedbackEl.textContent = "Correct!"; feedbackEl.style.color = 'white'; feedbackEl.style.backgroundColor = 'var(--success-color)'; } else { feedbackEl.innerHTML = `Incorrect. The correct answer was: <br><strong>"${data.options[correctIndex]}"</strong>`; feedbackEl.style.color = 'white'; feedbackEl.style.backgroundColor = 'var(--danger-color)'; } document.getElementById('submit-mcsa-btn').disabled = true; }); }
    function displayFeedback(feedback) { feedbackContainer.innerHTML = `<h2 class="question-title">Evaluation Report</h2><div class="score-card"><h3>Your Transcript</h3><p><em>"${feedback.transcript}"</em></p></div><div class="score-card"><h3>Overall Score (Estimated)</h3><p class="score">${feedback.overall_score_out_of_90} / 90</p><p><strong>Summary:</strong> ${feedback.final_summary}</p></div><div class="score-card"><h3>Oral Fluency</h3><p class="score">${feedback.oral_fluency.score} / 5</p><p><strong>Feedback:</strong> ${feedback.oral_fluency.feedback}</p></div><div class="score-card"><h3>Pronunciation</h3><p class="score">${feedback.pronunciation.score} / 5</p><p><strong>Feedback:</strong> ${feedback.pronunciation.feedback}</p></div><div class="score-card"><h3>Content</h3><p class="score">${feedback.content.score} / 5</p><p><strong>Feedback:</strong> ${feedback.content.feedback}</p></div>`; feedbackContainer.classList.remove('hidden'); }
    function displayEssayFeedback(feedback) { feedbackContainer.innerHTML = `<h2 class="question-title">Essay Evaluation Report</h2><div class="score-card"><h3>Overall Score (Estimated)</h3><p class="score">${feedback.overall_score_out_of_90} / 90</p><p><strong>Summary:</strong> ${feedback.final_summary}</p></div><div class="score-card"><h3>Content</h3><p class="score">${feedback.content.score} / 5</p><p><strong>Feedback:</strong> ${feedback.content.feedback}</p></div><div class="score-card"><h3>Form (Word Count)</h3><p class="score">${feedback.form.word_count} words</p><p><strong>Feedback:</strong> ${feedback.form.feedback}</p></div><div class="score-card"><h3>Grammar</h3><p class="score">${feedback.grammar.score} / 5</p><p><strong>Feedback:</strong> ${feedback.grammar.feedback}</p></div><div class="score-card"><h3>Vocabulary</h3><p class="score">${feedback.vocabulary.score} / 5</p><p><strong>Feedback:</strong> ${feedback.vocabulary.feedback}</p></div><div class="score-card"><h3>Structure & Coherence</h3><p class="score">${feedback.structure.score} / 5</p><p><strong>Feedback:</strong> ${feedback.structure.feedback}</p></div>`; feedbackContainer.classList.remove('hidden'); }
    function displaySwtFeedback(feedback) { feedbackContainer.innerHTML = `<h2 class="question-title">Summarize Written Text - Report</h2><div class="score-card"><h3>Overall Score (Estimated)</h3><p class="score">${feedback.overall_score_out_of_7} / 7</p><p><strong>Summary:</strong> ${feedback.final_summary}</p></div><div class="score-card"><h3>Content</h3><p class="score">${feedback.content.score} / 2</p><p><strong>Feedback:</strong> ${feedback.content.feedback}</p></div><div class="score-card"><h3>Form (Single Sentence)</h3><p class="score" style="color:${feedback.form.is_single_sentence ? 'var(--success-color)' : 'var(--danger-color)'}">${feedback.form.is_single_sentence ? 'Correct' : 'Incorrect'}</p><p><strong>Feedback:</strong> ${feedback.form.feedback}</p></div><div class="score-card"><h3>Grammar</h3><p class="score">${feedback.grammar.score} / 2</p><p><strong>Feedback:</strong> ${feedback.grammar.feedback}</p></div><div class="score-card"><h3>Vocabulary</h3><p class="score">${feedback.vocabulary.score} / 1</p><p><strong>Feedback:</strong> ${feedback.vocabulary.feedback}</p></div><div class="score-card"><h3>Word Count</h3><p class="score" style="color:${feedback.word_count.is_valid ? 'var(--success-color)' : 'var(--danger-color)'}">${feedback.word_count.count} words (${feedback.word_count.is_valid ? 'Valid' : 'Invalid'})</p></div>`; feedbackContainer.classList.remove('hidden'); }
    function startTimer(duration, phase, timerElement, onComplete) { if (currentTimerInterval) clearInterval(currentTimerInterval); let timer = duration; timerElement.textContent = `${phase}: ${Math.floor(timer/60)}:${(timer%60)<10?'0':''}${timer%60}`; const interval = setInterval(() => { timer--; const minutes = Math.floor(timer / 60); const seconds = timer % 60; timerElement.textContent = `${phase}: ${minutes}:${seconds < 10 ? '0' : ''}${seconds}`; if (timer <= 0) { clearInterval(interval); if (onComplete) onComplete(); } }, 1000); currentTimerInterval = interval; }
    function showLoading() { questionContainer.classList.add('hidden'); welcomeMessage.classList.add('hidden'); feedbackContainer.classList.add('hidden'); loadingSpinner.classList.remove('hidden'); }
    function hideLoading() { loadingSpinner.classList.add('hidden'); questionContainer.classList.remove('hidden'); }
    function showWelcomeMessage(message = 'Select a task to begin.') { welcomeMessage.innerHTML = `<p>${message}</p>`; welcomeMessage.classList.remove('hidden'); questionContainer.classList.add('hidden'); feedbackContainer.classList.add('hidden'); }
    function createAudioControlsHTML() { if (!SpeechRecognition) return `<div class="status" style="color:var(--danger-color); font-weight:bold;">Your browser does not support speech recognition. Please use Google Chrome or Microsoft Edge for speaking tasks.</div>`; return `<div class="audio-controls"><button id="record-btn" class="record-btn">Start Recording</button><div id="status" class="status">Press start to record</div></div>`; }
    function addAudioControlListeners(taskType) { const recordBtn = document.getElementById('record-btn'); if (!recordBtn) return; const statusDiv = document.getElementById('status'); let isRecording = false; recordBtn.onclick = () => isRecording ? recognition.stop() : recognition.start(); recognition.onstart = () => { isRecording = true; recordBtn.textContent = 'Stop Recording'; recordBtn.classList.add('recording'); statusDiv.textContent = 'Recording... Speak now.'; }; recognition.onend = () => { isRecording = false; recordBtn.textContent = 'Start Recording'; recordBtn.classList.remove('recording'); statusDiv.textContent = 'Processing... Please wait.'; recordBtn.disabled = true; }; recognition.onerror = (e) => { console.error('Speech recognition error', e.error); statusDiv.textContent = `Error: ${e.error}. Please try again or check microphone permissions.`; isRecording = false; }; recognition.onresult = (e) => { let transcript = Array.from(e.results).map(result => result[0]).map(result => result.transcript).join(''); if (transcript.trim()) { evaluateSpokenResponse(transcript.trim(), originalTextForEvaluation, taskType); } else { statusDiv.textContent = "Couldn't hear you. Please try again."; recordBtn.disabled = false; } }; }
});
