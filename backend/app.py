# backend/app.py

import os
import json # Make sure json is imported
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
    # ... (This function is unchanged from the previous version)
    prompts = {
        "read_aloud": f"Generate a short, academic paragraph of about 60-70 words on the topic of '{topic}'...",
        "reorder_paragraph": f"Generate a coherent academic paragraph of exactly 4 sentences on '{topic}'...",
        "essay": f"Generate a short, two-sentence controversial topic or question suitable for a 20-minute PTE Essay Writing task...",
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
# ... (All generation routes are unchanged from the previous version)
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
@app.route('/api/generate/summarize-written-text', methods=['GET'])
def get_summarize_written_text(): # ...
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    response = gemini_model.generate_content(generate_prompt("summarize_written_text"))
    return jsonify({"text": response.text})
@app.route('/api/generate/mcsa', methods=['GET'])
def get_mcsa(): # ...
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    prompt = generate_prompt("mcsa")
    try:
        response = gemini_model.generate_content(prompt); clean_json_string = response.text.strip().replace("```json", "").replace("```", "")
        task_data = json.loads(clean_json_string); return jsonify(task_data)
    except Exception as e: return jsonify({"error": "Failed to generate a valid MCSA question."}), 500

# --- Evaluation Routes (MODIFIED) ---

@app.route('/api/evaluate/spoken-response', methods=['POST'])
def evaluate_spoken_response():
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    data = request.json
    transcript, original_text, task_type = data.get('transcript'), data.get('originalText'), data.get('taskType')
    if not transcript: return jsonify({"error": "Transcript is required"}), 400
    prompt = f'You are a PTE examiner...' # (prompt content is the same)
    
    try:
        response = gemini_model.generate_content(prompt)
        clean_text = response.text.strip().replace("```json", "").replace("```", "")
        json_feedback = json.loads(clean_text)
        return jsonify(json_feedback)
    except json.JSONDecodeError:
        return jsonify({"error": "AI returned a malformed response. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred during evaluation: {e}"}), 500

@app.route('/api/evaluate/essay', methods=['POST'])
def evaluate_essay():
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    data = request.json
    essay_prompt, essay_text = data.get('prompt'), data.get('essayText')
    if not essay_text: return jsonify({"error": "Essay text required"}), 400
    prompt = f'You are a PTE examiner evaluating an essay...' # (prompt content is the same)
    
    try:
        response = gemini_model.generate_content(prompt)
        clean_text = response.text.strip().replace("```json", "").replace("```", "")
        json_feedback = json.loads(clean_text)
        return jsonify(json_feedback)
    except json.JSONDecodeError:
        return jsonify({"error": "AI returned a malformed response. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred during evaluation: {e}"}), 500

@app.route('/api/evaluate/swt', methods=['POST'])
def evaluate_swt():
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    data = request.json
    original_text, summary_text = data.get('originalText'), data.get('summaryText')
    if not summary_text: return jsonify({"error": "Summary text required"}), 400
    prompt = f'You are a PTE examiner evaluating a summary...' # (prompt content is the same)
    
    try:
        response = gemini_model.generate_content(prompt)
        clean_text = response.text.strip().replace("```json", "").replace("```", "")
        json_feedback = json.loads(clean_text)
        return jsonify(json_feedback)
    except json.JSONDecodeError:
        return jsonify({"error": "AI returned a malformed response. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred during evaluation: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
