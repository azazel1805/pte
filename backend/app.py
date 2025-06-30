# backend/app.py

import os
import google.generativeai as genai
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# --- App Initialization ---
app = Flask(__name__)
# CORS allows our frontend (on a different 'origin') to communicate with this backend
CORS(app) 

# --- API Configuration ---
# We ONLY need Gemini and Pexels now.
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
        "read_aloud": f"Generate a short, academic paragraph of about 60-70 words on the topic of '{topic}'. The paragraph should contain some complex vocabulary and varied sentence structure, suitable for a PTE Read Aloud task.",
        "repeat_sentence": f"Generate a single, clear sentence between 10 and 15 words long on the topic of '{topic}'. It should be grammatically correct and suitable for a PTE Repeat Sentence task.",
        "reorder_paragraph": f"Generate a coherent academic paragraph of exactly 4 sentences on '{topic}'. Then, present these 4 sentences in a completely random, shuffled order. Do not number them. Just present the shuffled sentences.",
        "summarize_written_text": f"Generate a dense, academic text of about 300 words on the topic of '{topic}'. The text must contain several key ideas and supporting details, suitable for a PTE 'Summarize Written Text' task."
    }
    return prompts.get(task, "Generate a simple sentence.")

# --- API Routes ---

@app.route('/')
def index():
    return "PTE Practice Platform Backend is running!"

# --- Question Generation Routes ---

@app.route('/api/generate/read-aloud', methods=['GET'])
def get_read_aloud():
    if not gemini_model:
        return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("read_aloud")
    response = gemini_model.generate_content(prompt)
    return jsonify({"text": response.text})

@app.route('/api/generate/describe-image', methods=['GET'])
def get_describe_image():
    if not PEXELS_API_KEY:
        return jsonify({"error": "Pexels API key not found"}), 500
    
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
            return jsonify({
                "imageUrl": photo['src']['large'],
                "alt": photo['alt'],
                "photographer": photo['photographer']
            })
        else:
            return jsonify({"error": "No images found for the topic"}), 404
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to fetch image from Pexels: {e}"}), 500

@app.route('/api/generate/reorder-paragraph', methods=['GET'])
def get_reorder_paragraph():
    if not gemini_model:
        return jsonify({"error": "Gemini API not configured"}), 500
    prompt = generate_prompt("reorder_paragraph")
    response = gemini_model.generate_content(prompt)
    sentences = [s.strip() for s in response.text.split('\n') if s.strip()]
    return jsonify({"sentences": sentences})


# --- SIMPLIFIED Evaluation Route (accepts TEXT) ---
@app.route('/api/evaluate/spoken-response', methods=['POST'])
def evaluate_spoken_response():
    if not gemini_model:
        return jsonify({"error": "Gemini API not configured"}), 500
        
    data = request.json
    transcript = data.get('transcript')
    original_text = data.get('originalText')
    task_type = data.get('taskType')

    if not transcript:
        return jsonify({"error": "Transcript is required for evaluation"}), 400

    # A more sophisticated prompt to ask Gemini to act as a PTE evaluator
    evaluation_prompt = f"""
    You are an expert PTE Academic examiner. Evaluate the following student's spoken response based on typical PTE criteria: oral fluency, pronunciation, and content. The student's response was transcribed using their browser's built-in speech recognition.

    Task Type: {task_type}
    Original Text/Task (if applicable): "{original_text}"
    Student's Spoken Transcript: "{transcript}"

    Please provide your evaluation in the following JSON format ONLY. Do not include any other text, comments, or markdown formatting like ```json.
    {{
      "oral_fluency": {{ "score": <score out of 5>, "feedback": "<brief feedback on rhythm, phrasing, and speed>" }},
      "pronunciation": {{ "score": <score out of 5>, "feedback": "<brief feedback on clarity, vowel/consonant sounds, and stress>" }},
      "content": {{ "score": <score out of 5>, "feedback": "<brief feedback on how well the transcript matches the original task>" }},
      "overall_score_out_of_90": <an estimated overall PTE-style score for this specific task, out of 90>,
      "final_summary": "<a concluding one-sentence summary of the performance>",
      "transcript": "{transcript.replace('"', '’')}"
    }}
    """
    
    try:
        response = gemini_model.generate_content(evaluation_prompt)
        # Attempt to clean and parse the JSON response from Gemini
        clean_response = response.text.strip().replace("```json", "").replace("```", "")
        return jsonify(clean_response)
    except Exception as e:
        return jsonify({"error": f"Failed to evaluate with Gemini: {e}", "raw_response": response.text if 'response' in locals() else 'No response'}), 500


if __name__ == '__main__':
    # Use 0.0.0.0 to make it accessible on your network
    app.run(host='0.0.0.0', port=5001, debug=True)
