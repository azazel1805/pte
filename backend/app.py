# backend/app.py

import os
import json
import google.generativeai as genai
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

load_dotenv()
app = Flask(__name__)
CORS(app) 

# --- API Configuration ---
try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    gemini_model = None
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY")

# --- Helper Functions for Prompts ---
def generate_prompt(task, topic="general academic"):
    prompts = {
        "read_aloud": f"Generate a short, academic paragraph of about 60-70 words on the topic of '{topic}'...",
        "reorder_paragraph": f"Generate a coherent academic paragraph of exactly 4 sentences on '{topic}'...",
        "essay": f"Generate a short, two-sentence controversial topic or question suitable for a 20-minute PTE Essay Writing task...",
        # --- NEW PROMPTS ---
        "summarize_written_text": f"Generate a dense, academic text of about 300 words on the topic of '{topic}'. The text must contain several key ideas and supporting details, suitable for a PTE 'Summarize Written Text' task.",
        "mcsa": f"""
        Generate a PTE-style 'Multiple-choice, Single Answer' reading task about '{topic}'.
        Provide a response in a valid JSON format ONLY. Do not include any other text or markdown formatting.
        The JSON object must have these exact keys:
        "passage": A 150-200 word academic text.
        "question": A clear question about the content of the passage.
        "options": An array of 4 string options. One option must be clearly correct according to the passage.
        "correct_answer_index": The 0-based integer index of the correct option in the "options" array.
        """
    }
    return prompts.get(task, "Generate a simple sentence.")

# --- API Routes ---
@app.route('/')
def index(): return "PTE Practice Platform Backend is running!"

# --- Question Generation Routes ---
# ... (read-aloud, describe-image, reorder-paragraph, essay routes are unchanged) ...
@app.route('/api/generate/read-aloud', methods=['GET'])
def get_read_aloud(): # ...
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    response = gemini_model.generate_content(generate_prompt("read_aloud"))
    return jsonify({"text": response.text})
@app.route('/api/generate/describe-image', methods=['GET'])
def get_describe_image(): # ...
    if not PEXELS_API_KEY: return jsonify({"error": "Pexels API key not found"}), 500
    search_terms = ["lecture", "graph", "technology", "environment", "cityscape", "laboratory"]; random_topic = requests.utils.quote(search_terms[os.urandom(1)[0] % len(search_terms)])
    url = f"https://api.pexels.com/v1/search?query={random_topic}&per_page=10"; headers = {"Authorization": PEXELS_API_KEY}
    try:
        response = requests.get(url, headers=headers); response.raise_for_status(); data = response.json()
        if data['photos']:
            photo = data['photos'][os.urandom(1)[0] % len(data['photos'])]
            return jsonify({ "imageUrl": photo['src']['large'], "alt": photo['alt'], "photographer": photo['photographer'] })
        else: return jsonify({"error": "No images found"}), 404
    except Exception as e: return jsonify({"error": f"Failed to fetch image: {e}"}), 500
@app.route('/api/generate/reorder-paragraph', methods=['GET'])
def get_reorder_paragraph(): # ...
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    response = gemini_model.generate_content(generate_prompt("reorder_paragraph"))
    return jsonify({"sentences": [s.strip() for s in response.text.split('\n') if s.strip()]})
@app.route('/api/generate/essay', methods=['GET'])
def get_essay_prompt(): # ...
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    response = gemini_model.generate_content(generate_prompt("essay"))
    return jsonify({"prompt": response.text})

# --- NEW GENERATION ROUTES ---
@app.route('/api/generate/summarize-written-text', methods=['GET'])
def get_summarize_written_text():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("summarize_written_text")
    response = gemini_model.generate_content(prompt)
    return jsonify({"text": response.text})

@app.route('/api/generate/mcsa', methods=['GET'])
def get_mcsa():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("mcsa")
    try:
        response = gemini_model.generate_content(prompt)
        # Clean the response and parse it as JSON
        clean_json_string = response.text.strip().replace("```json", "").replace("```", "")
        task_data = json.loads(clean_json_string)
        return jsonify(task_data)
    except Exception as e:
        print(f"Error generating or parsing MCSA JSON: {e}")
        return jsonify({"error": "Failed to generate a valid multiple-choice question. Please try again."}), 500

# --- Evaluation Routes ---
# ... (evaluate/spoken-response and evaluate/essay routes are unchanged) ...
@app.route('/api/evaluate/spoken-response', methods=['POST'])
def evaluate_spoken_response(): # ...
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    data = request.json; transcript, original_text, task_type = data.get('transcript'), data.get('originalText'), data.get('taskType')
    if not transcript: return jsonify({"error": "Transcript is required"}), 400
    prompt = f'You are a PTE examiner. Evaluate this spoken response. Task: {task_type}. Original: "{original_text}". Transcript: "{transcript}". Provide a JSON response with keys: oral_fluency, pronunciation, content, overall_score_out_of_90, final_summary, and transcript.'
    try:
        response = gemini_model.generate_content(prompt); clean_response = response.text.strip().replace("```json", "").replace("```", "")
        return jsonify(clean_response)
    except Exception as e: return jsonify({"error": f"Failed to evaluate: {e}"}), 500
@app.route('/api/evaluate/essay', methods=['POST'])
def evaluate_essay(): # ...
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    data = request.json; essay_prompt, essay_text = data.get('prompt'), data.get('essayText')
    if not essay_text: return jsonify({"error": "Essay text required"}), 400
    prompt = f'You are a PTE examiner. Evaluate this essay. Prompt: "{essay_prompt}". Essay: "{essay_text}". Provide a JSON response with keys for content, form, grammar, vocabulary, structure, overall_score_out_of_90, and final_summary.'
    try:
        response = gemini_model.generate_content(prompt); clean_response = response.text.strip().replace("```json", "").replace("```", "")
        return jsonify(clean_response)
    except Exception as e: return jsonify({"error": f"Failed to evaluate: {e}"}), 500


# --- NEW EVALUATION ROUTE FOR SWT ---
@app.route('/api/evaluate/swt', methods=['POST'])
def evaluate_swt():
    if not gemini_model:
        return jsonify({"error": "Gemini API not configured"}), 500
    
    data = request.json
    original_text = data.get('originalText')
    summary_text = data.get('summaryText')

    if not summary_text or not original_text:
        return jsonify({"error": "Original text and summary are required"}), 400

    evaluation_prompt = f"""
    You are an expert PTE Academic examiner evaluating a 'Summarize Written Text' response.

    Original Passage: "{original_text}"
    Student's Summary: "{summary_text}"

    Evaluate the summary based on these PTE criteria:
    1.  Content: Does the summary accurately capture the main point of the passage?
    2.  Form: Is the summary a SINGLE, grammatically correct sentence?
    3.  Grammar & Vocabulary: Is the language used correct and appropriate?
    4.  Word Count: Is the summary between 5 and 75 words?

    Provide your evaluation in a JSON format ONLY.
    {{
      "content": {{ "score": "<score out of 2>", "feedback": "<Feedback on capturing the main point>" }},
      "form": {{ "is_single_sentence": <true or false>, "feedback": "<Feedback on sentence structure>" }},
      "grammar": {{ "score": "<score out of 2>", "feedback": "<Feedback on grammar>" }},
      "vocabulary": {{ "score": "<score out of 1>", "feedback": "<Feedback on word choice>" }},
      "word_count": {{ "count": <integer word count>, "is_valid": <true or false> }},
      "overall_score_out_of_7": <an estimated overall score for this task, out of 7>,
      "final_summary": "<A concluding summary of the performance>"
    }}
    """
    try:
        response = gemini_model.generate_content(evaluation_prompt)
        clean_response = response.text.strip().replace("```json", "").replace("```", "")
        return jsonify(clean_response)
    except Exception as e:
        return jsonify({"error": f"Failed to evaluate summary with Gemini: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
