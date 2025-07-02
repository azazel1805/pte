# backend/app.py

import os
import json # Import the json library
import google.generativeai as genai
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- App Initialization ---
app = Flask(__name__)
# Be more specific with CORS in production if possible
CORS(app) 

# --- API Configuration ---
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

# --- Helper Functions for Prompts ---
def generate_prompt(task, topic="general academic"):
    prompts = {
        "read_aloud": f"Generate a short, academic paragraph of about 60-70 words on the topic of '{topic}'. The paragraph should contain some complex vocabulary and varied sentence structure, suitable for a PTE Read Aloud task.",
        "reorder_paragraph": f"Generate a coherent academic paragraph of exactly 4 sentences on '{topic}'. Then, present these 4 sentences in a completely random, shuffled order. Do not number them. Just present the shuffled sentences.",
        # NEW PROMPT FOR ESSAY TASK
        "essay": f"Generate a short, two-sentence controversial topic or question suitable for a 20-minute PTE Essay Writing task. The topic should be about '{topic}'. The prompt should encourage taking a clear stance."
    }
    return prompts.get(task, "Generate a simple sentence.")

# --- API Routes ---

@app.route('/')
def index():
    return "PTE Practice Platform Backend is running!"

# --- Question Generation Routes ---

@app.route('/api/generate/read-aloud', methods=['GET'])
def get_read_aloud():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("read_aloud")
    response = gemini_model.generate_content(prompt)
    return jsonify({"text": response.text})

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
    sentences = [s.strip() for s in response.text.split('\n') if s.strip()]
    return jsonify({"sentences": sentences})

# NEW ROUTE TO GENERATE ESSAY PROMPT
@app.route('/api/generate/essay', methods=['GET'])
def get_essay_prompt():
    if not gemini_model:
        return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("essay")
    response = gemini_model.generate_content(prompt)
    return jsonify({"prompt": response.text})

# --- Evaluation Routes ---

@app.route('/api/evaluate/spoken-response', methods=['POST'])
def evaluate_spoken_response():
    if not gemini_model: return jsonify({"error": "Gemini API not configured"}), 500
    data = request.json
    transcript, original_text, task_type = data.get('transcript'), data.get('originalText'), data.get('taskType')
    if not transcript: return jsonify({"error": "Transcript is required"}), 400
    
    evaluation_prompt = f"""You are an expert PTE Academic examiner. Evaluate the student's spoken response based on oral fluency, pronunciation, and content. The response was transcribed by the browser's speech recognition.
    Task: {task_type}. Original Text/Task: "{original_text}". Student's Transcript: "{transcript}".
    Provide a JSON response ONLY with keys: "oral_fluency" (score/5, feedback), "pronunciation" (score/5, feedback), "content" (score/5, feedback), "overall_score_out_of_90", "final_summary", and "transcript". The transcript key should contain the student's transcript you received."""
    
    try:
        response = gemini_model.generate_content(evaluation_prompt)
        clean_response = response.text.strip().replace("```json", "").replace("```", "")
        # MODIFICATION: Parse the string into a Python dict and then jsonify it.
        # This sends a proper JSON object to the frontend.
        response_data = json.loads(clean_response)
        response_data['transcript'] = transcript # Ensure the original transcript is in the response
        return jsonify(response_data)
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse evaluation response from AI. Please try again."}), 500
    except Exception as e: 
        return jsonify({"error": f"Failed to evaluate with Gemini: {e}"}), 500

# NEW ROUTE TO EVALUATE ESSAY
@app.route('/api/evaluate/essay', methods=['POST'])
def evaluate_essay():
    if not gemini_model:
        return jsonify({"error": "Gemini API not configured"}), 500
    
    data = request.json
    essay_prompt = data.get('prompt')
    essay_text = data.get('essayText')

    if not essay_text or not essay_prompt:
        return jsonify({"error": "Essay prompt and text are required"}), 400

    evaluation_prompt = f"""
    You are an expert PTE Academic examiner evaluating a student's essay.
    
    Original Essay Prompt: "{essay_prompt}"
    Student's Essay: "{essay_text}"

    Please evaluate the essay based on the following PTE criteria:
    1.  Content: How well does the essay address the prompt? Are the ideas relevant and well-supported? Score out of 5.
    2.  Form: Is the word count between 200 and 300 words? Provide feedback.
    3.  Grammar: Is the grammar correct and varied? Score out of 5.
    4.  Vocabulary: Is the vocabulary appropriate, and is there a good range of words? Score out of 5.
    5.  Structure and Coherence: Is the essay well-organized with clear paragraphs and logical flow? Score out of 5.

    Provide your evaluation in a JSON format ONLY. Do not include any other text or markdown formatting like ```json.
    Your response must be a single, valid JSON object.
    {{
      "content": {{ "score": "<score out of 5>", "feedback": "<Brief feedback on relevance and ideas>" }},
      "form": {{ "word_count": {len(essay_text.split())}, "feedback": "<Feedback on word count, ideally mentioning the 200-300 range>" }},
      "grammar": {{ "score": "<score out of 5>", "feedback": "<Feedback on grammatical accuracy and range>" }},
      "vocabulary": {{ "score": "<score out of 5>", "feedback": "<Feedback on vocabulary usage>" }},
      "structure": {{ "score": "<score out of 5>", "feedback": "<Feedback on organization and coherence>" }},
      "overall_score_out_of_90": <an estimated overall PTE-style score for this essay, out of 90>,
      "final_summary": "<A concluding one-sentence summary of the essay's strengths and weaknesses>"
    }}
    """
    try:
        response = gemini_model.generate_content(evaluation_prompt)
        clean_response = response.text.strip().replace("```json", "").replace("```", "")
        # MODIFICATION: Parse the string into a Python dict and then jsonify it.
        response_data = json.loads(clean_response)
        return jsonify(response_data)
    except json.JSONDecodeError:
        return jsonify({"error": "Failed to parse essay evaluation response from AI. Please try again."}), 500
    except Exception as e:
        return jsonify({"error": f"Failed to evaluate essay with Gemini: {e}"}), 500

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)
