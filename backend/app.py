# backend/app.py

import os
import json
import random # Import the random library
import google.generativeai as genai
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# ... (initialization code is the same) ...
load_dotenv()
app = Flask(__name__)
CORS(app) 

try:
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    if not gemini_api_key:
        raise ValueError("GEMINI_API_KEY not found in environment variables.")
    genai.configure(api_key=gemini_api_key)
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    gemini_model = None

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY")
# ... (generate_prompt and other routes are the same) ...
def generate_prompt(task, topic="general academic"):
    prompts = {
        "read_aloud": f"Generate a short, academic paragraph of about 60-70 words on '{topic}'. The paragraph should have varied sentence structure for a PTE Read Aloud task.",
        "reorder_paragraph": f"Generate a single, coherent academic paragraph of exactly 4 distinct sentences on '{topic}'. Ensure each sentence is on a new line.",
        "essay": f"Generate a short, two-sentence controversial topic or question for a 20-minute PTE Essay task about '{topic}'.",
        "repeat_sentence": "Generate a single, grammatically correct sentence of 10-15 words with average complexity, suitable for a PTE Repeat Sentence task.",
        "answer_short_question": "You are a PTE test creator. Generate a simple general knowledge question whose answer is a single word or a short phrase. Provide the output as a JSON object ONLY with two keys: 'question' and 'answer'. Do not include any markdown like ```json. For example: {\"question\": \"What do you call the piece of paper you receive in a shop after buying something?\", \"answer\": \"A receipt\"}"
    }
    return prompts.get(task, "Generate a simple sentence.")

@app.route('/')
def index(): return "PTE Practice Platform Backend is running!"

# --- Question Generation Routes ---
# ... (read_aloud, repeat_sentence routes are unchanged) ...
@app.route('/api/generate/read-aloud', methods=['GET'])
def get_read_aloud():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("read_aloud")
    response = gemini_model.generate_content(prompt)
    return jsonify({"text": response.text})

@app.route('/api/generate/repeat-sentence', methods=['GET'])
def get_repeat_sentence():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("repeat_sentence")
    response = gemini_model.generate_content(prompt)
    return jsonify({"text": response.text})

# ** MODIFIED ROUTE **
@app.route('/api/generate/answer-short-question', methods=['GET'])
def get_answer_short_question():
    # Create a list of fallback questions in case the API fails
    fallback_questions = [
        {"question": "What is the opposite of 'hot'?", "answer": "cold"},
        {"question": "What is the color of the sun?", "answer": "yellow"},
        {"question": "How many months are in a year?", "answer": "twelve"},
        {"question": "What do you use to unlock a door?", "answer": "a key"},
        {"question": "What is the chemical symbol for water?", "answer": "H2O"},
    ]

    if not gemini_model:
        return jsonify(random.choice(fallback_questions))

    prompt = generate_prompt("answer_short_question")
    try:
        response = gemini_model.generate_content(prompt)
        clean_response = response.text.strip().replace("```json", "").replace("```", "")
        data = json.loads(clean_response)
        # Basic validation to ensure we got a proper response
        if "question" in data and "answer" in data:
            return jsonify(data)
        else:
            # If JSON is valid but keys are missing, use fallback
            return jsonify(random.choice(fallback_questions))
    except (json.JSONDecodeError, Exception) as e:
        # If any error occurs (API call, JSON parsing), use a random fallback
        print(f"Error in 'answer-short-question' generation: {e}")
        return jsonify(random.choice(fallback_questions))

# ... (Other routes like describe-image, reorder-paragraph, etc., are unchanged) ...
@app.route('/api/generate/describe-image', methods=['GET'])
def get_describe_image():
    if not PEXELS_API_KEY: return jsonify({"error": "Pexels API key not found"}), 500
    search_terms = ["lecture", "graph", "technology", "environment", "cityscape", "laboratory"]
    random_topic = requests.utils.quote(search_terms[os.urandom(1)[0] % len(search_terms)])
    url = f"https://api.pexels.com/v1/search?query={random_topic}&per_page=10"
    headers = {"Authorization": PEXELS_API_KEY}
    try:
        response = requests.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()
        if data['photos']:
            photo = data['photos'][os.urandom(1)[0] % len(data['photos'])]
            return jsonify({ "imageUrl": photo['src']['large'], "alt": photo['alt'], "photographer": photo['photographer'] })
        else: return jsonify({"error": "No images found"}), 404
    except requests.exceptions.RequestException as e: return jsonify({"error": f"Failed to fetch image: {e}"}), 500

@app.route('/api/generate/reorder-paragraph', methods=['GET'])
def get_reorder_paragraph():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("reorder_paragraph")
    response = gemini_model.generate_content(prompt)
    solution_sentences = [s.strip() for s in response.text.split('\n') if s.strip()]
    shuffled_sentences = solution_sentences[:]
    random.shuffle(shuffled_sentences)
    while shuffled_sentences == solution_sentences and len(solution_sentences) > 1:
        random.shuffle(shuffled_sentences)
    return jsonify({"shuffledSentences": shuffled_sentences, "solution": solution_sentences})

@app.route('/api/generate/essay', methods=['GET'])
def get_essay_prompt():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("essay")
    response = gemini_model.generate_content(prompt)
    return jsonify({"prompt": response.text})

# --- Evaluation Routes ---
# ... (Evaluation routes are unchanged) ...
@app.route('/api/evaluate/spoken-response', methods=['POST'])
def evaluate_spoken_response():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    data = request.json
    transcript, original_text, task_type = data.get('transcript'), data.get('originalText'), data.get('taskType')
    correct_answer = data.get('correctAnswer')

    if not transcript: return jsonify({"error": "Transcript is required"}), 400

    evaluation_prompt = ""
    if task_type == 'Answer Short Question':
        evaluation_prompt = f"""You are a strict PTE examiner. The task is "Answer Short Question". The question asked was: "{original_text}". The expected correct answer is: "{correct_answer}". The student's spoken answer was transcribed as: "{transcript}".
        Evaluate the following:
        1. Content: Is the student's answer semantically correct? It doesn't need to be an exact word match but must have the right meaning.
        Provide a JSON response ONLY with these keys: "content" (dict with "score" (1 for correct, 0 for incorrect) and "feedback"), "pronunciation" (dict with "score" (5 for clear) and "feedback"), "oral_fluency" (dict with "score" (5 for smooth) and "feedback"), "overall_score_out_of_90" (90 if content is 1, 10 if 0), "final_summary", and "transcript"."""
    else:
        evaluation_prompt = f"""You are an expert PTE Academic examiner. Evaluate the student's spoken response based on oral fluency, pronunciation, and content. Task: {task_type}. Original Text/Task: "{original_text}". Student's Transcript: "{transcript}".
        Provide a JSON response ONLY with keys: "oral_fluency" (score/5, feedback), "pronunciation" (score/5, feedback), "content" (score/5, feedback), "overall_score_out_of_90", "final_summary", and "transcript". The content score should reflect how accurately the transcript matches the original text."""

    try:
        response = gemini_model.generate_content(evaluation_prompt)
        clean_response = response.text.strip().replace("```json", "").replace("```", "")
        response_data = json.loads(clean_response)
        response_data['transcript'] = transcript
        return jsonify(response_data)
    except Exception as e:
        return jsonify({"error": f"Failed to evaluate with Gemini: {e}"}), 500

@app.route('/api/evaluate/essay', methods=['POST'])
def evaluate_essay():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    data = request.json
    essay_prompt, essay_text = data.get('prompt'), data.get('essayText')
    if not essay_text or not essay_prompt: return jsonify({"error": "Essay prompt and text are required"}), 400
    evaluation_prompt = f"""
    You are an expert PTE Academic examiner evaluating a student's essay. Original Essay Prompt: "{essay_prompt}". Student's Essay: "{essay_text}".
    Please evaluate the essay based on the following PTE criteria: Content, Form, Grammar, Vocabulary, Structure and Coherence.
    Provide your evaluation in a JSON format ONLY. Do not include any other text or markdown formatting. Your response must be a single, valid JSON object.
    {{
      "content": {{ "score": "<score out of 5>", "feedback": "<Brief feedback>" }},
      "form": {{ "word_count": {len(essay_text.split())}, "feedback": "<Feedback on word count>" }},
      "grammar": {{ "score": "<score out of 5>", "feedback": "<Feedback>" }},
      "vocabulary": {{ "score": "<score out of 5>", "feedback": "<Feedback>" }},
      "structure": {{ "score": "<score out of 5>", "feedback": "<Feedback>" }},
      "overall_score_out_of_90": <estimated overall PTE score out of 90>,
      "final_summary": "<A one-sentence summary>"
    }}"""
    try:
        response = gemini_model.generate_content(evaluation_prompt)
        clean_response = response.text.strip().replace("```json", "").replace("```", "")
        response_data = json.loads(clean_response)
        return jsonify(response_data)
    except Exception as e:
        return jsonify({"error": f"Failed to evaluate essay with Gemini: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
