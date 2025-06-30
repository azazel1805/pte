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
# ... (This section is unchanged)
try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    gemini_model = None
PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY")

# --- Helper Functions for Prompts ---
# ... (This section is unchanged)
def generate_prompt(task, topic="general academic"):
    prompts = {
        "read_aloud": f"...", "reorder_paragraph": f"...", "essay": f"...",
        "summarize_written_text": f"...", "mcsa": f"..."
    }
    return prompts.get(task, "Generate a simple sentence.")

# --- API Routes ---
# ... (All generation routes are unchanged)
@app.route('/')
def index(): return "..."
@app.route('/api/generate/read-aloud', methods=['GET'])
def get_read_aloud(): return jsonify({"text": "..."})
# ... and so on for all other generation routes.

# --- Evaluation Routes (WITH MODIFIED PROMPTS) ---

@app.route('/api/evaluate/spoken-response', methods=['POST'])
def evaluate_spoken_response():
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    data = request.json
    transcript, original_text, task_type = data.get('transcript'), data.get('originalText'), data.get('taskType')
    if not transcript: return jsonify({"error": "Transcript is required"}), 400
    
    # --- MODIFIED PROMPT ---
    evaluation_prompt = f"""
    As a PTE examiner, evaluate the student's spoken response.
    Task: {task_type}. Original Text/Task: "{original_text}". Student's Transcript: "{transcript}".
    
    You MUST reply with only the raw JSON object. Your entire response must start with {{ and end with }}.
    Do not include any explanatory text, comments, or markdown formatting like ```json.
    
    The JSON must have keys: "oral_fluency" (with score/5 and feedback), "pronunciation" (score/5, feedback), "content" (score/5, feedback), "overall_score_out_of_90", "final_summary", and "transcript".
    """
    
    try:
        response = gemini_model.generate_content(evaluation_prompt)
        clean_text = response.text.strip()
        json_feedback = json.loads(clean_text)
        return jsonify(json_feedback)
    except json.JSONDecodeError:
        print(f"JSONDecodeError from Gemini's response: {response.text}")
        return jsonify({"error": "AI returned a malformed response. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred during evaluation: {e}"}), 500

@app.route('/api/evaluate/essay', methods=['POST'])
def evaluate_essay():
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    data = request.json
    essay_prompt, essay_text = data.get('prompt'), data.get('essayText')
    if not essay_text: return jsonify({"error": "Essay text required"}), 400
    
    # --- MODIFIED PROMPT ---
    evaluation_prompt = f"""
    As a PTE examiner, evaluate this essay.
    Prompt: "{essay_prompt}". Essay: "{essay_text}".

    You MUST reply with only the raw JSON object. Your entire response must start with {{ and end with }}.
    Do not include any explanatory text, comments, or markdown formatting like ```json.
    
    The JSON must have keys for "content" (score, feedback), "form" (word_count, feedback), "grammar" (score, feedback), "vocabulary" (score, feedback), "structure" (score, feedback), "overall_score_out_of_90", and "final_summary".
    """
    
    try:
        response = gemini_model.generate_content(evaluation_prompt)
        clean_text = response.text.strip()
        json_feedback = json.loads(clean_text)
        return jsonify(json_feedback)
    except json.JSONDecodeError:
        print(f"JSONDecodeError from Gemini's response: {response.text}")
        return jsonify({"error": "AI returned a malformed response. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred during evaluation: {e}"}), 500

@app.route('/api/evaluate/swt', methods=['POST'])
def evaluate_swt():
    if not gemini_model: return jsonify({"error": "API not configured"}), 500
    data = request.json
    original_text, summary_text = data.get('originalText'), data.get('summaryText')
    if not summary_text: return jsonify({"error": "Summary text required"}), 400
    
    # --- MODIFIED PROMPT ---
    evaluation_prompt = f"""
    As a PTE examiner, evaluate this 'Summarize Written Text' response.
    Original Passage: "{original_text}"
    Student's Summary: "{summary_text}"

    You MUST reply with only the raw JSON object. Your entire response must start with {{ and end with }}.
    Do not include any explanatory text, comments, or markdown formatting like ```json.
    
    The JSON must have keys for "content" (score/2, feedback), "form" (is_single_sentence, feedback), "grammar" (score/2, feedback), "vocabulary" (score/1, feedback), "word_count" (count, is_valid), "overall_score_out_of_7", and "final_summary".
    """
    
    try:
        response = gemini_model.generate_content(evaluation_prompt)
        clean_text = response.text.strip()
        json_feedback = json.loads(clean_text)
        return jsonify(json_feedback)
    except json.JSONDecodeError:
        print(f"JSONDecodeError from Gemini's response: {response.text}")
        return jsonify({"error": "AI returned a malformed response. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": f"An unexpected error occurred during evaluation: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
