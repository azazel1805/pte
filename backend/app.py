# backend/app.py

import os
import google.generativeai as genai
import requests
from flask import Flask, jsonify, request
from flask_cors import CORS
from dotenv import load_dotenv

# New Import for Speech-to-Text
from google.cloud import speech

# Load environment variables from .env file
load_dotenv()

# --- App Initialization ---
app = Flask(__name__)
# CORS allows our frontend (on a different 'origin') to communicate with this backend
CORS(app) 

# --- API Configuration ---
try:
    genai.configure(api_key=os.environ["GEMINI_API_KEY"])
    gemini_model = genai.GenerativeModel('gemini-1.5-flash')
except Exception as e:
    print(f"Error configuring Gemini API: {e}")
    gemini_model = None

PEXELS_API_KEY = os.environ.get("PEXELS_API_KEY")

# --- Speech-to-Text Client Initialization ---
# The SpeechClient will automatically find the credentials file if the
# GOOGLE_APPLICATION_CREDENTIALS environment variable is set.
try:
    speech_client = speech.SpeechClient()
    print("Google Speech Client initialized successfully.")
except Exception as e:
    print(f"CRITICAL: Could not initialize Google Speech Client. Transcription will fail. Error: {e}")
    speech_client = None

# --- Helper Functions for Prompts (Unchanged) ---
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

# --- Question Generation Routes (Unchanged) ---

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
            image_url = photo['src']['large']
            photographer = photo['photographer']
            return jsonify({
                "imageUrl": image_url,
                "alt": photo['alt'],
                "photographer": photographer
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


# --- NEW: Audio Transcription and Evaluation Route ---
@app.route('/api/transcribe-and-evaluate', methods=['POST'])
def transcribe_and_evaluate():
    if not speech_client or not gemini_model:
        return jsonify({"error": "A backend API (Speech or Gemini) is not configured correctly."}), 500

    if 'audio_file' not in request.files:
        return jsonify({"error": "No audio file part in the request"}), 400
    
    file = request.files['audio_file']
    if file.filename == '':
        return jsonify({"error": "No selected audio file"}), 400

    original_text = request.form.get('originalText', '')
    task_type = request.form.get('taskType', 'unknown task')

    try:
        # 1. Transcribe Audio using Google Speech-to-Text
        audio_content = file.read()
        audio = speech.RecognitionAudio(content=audio_content)
        
        # The frontend sends 'audio/webm;codecs=opus'
        config = speech.RecognitionConfig(
            encoding=speech.RecognitionConfig.AudioEncoding.WEBM_OPUS,
            sample_rate_hertz=48000, # A standard sample rate for web audio
            language_code="en-US",
            model="latest_long" # Use a high-quality model for better accuracy
        )

        print("Sending audio to Google Speech-to-Text API...")
        response = speech_client.recognize(config=config, audio=audio)
        print("Received response from STT API.")

        if response.results and response.results[0].alternatives:
            transcript = response.results[0].alternatives[0].transcript
        else:
            transcript = ""
        
        print(f"Transcript: '{transcript}'")

        if not transcript.strip():
            # Return a specific, user-friendly error if no speech was detected
            return jsonify({
                "error": "Could not detect any speech in the audio. Please record again and speak clearly into the microphone."
            }), 400

        # 2. Evaluate Transcript using Gemini
        evaluation_prompt = f"""
        You are an expert PTE Academic examiner. Evaluate the following student's spoken response based on typical PTE criteria: oral fluency, pronunciation, and content. The student's response was automatically transcribed from their speech.

        Task Type: {task_type}
        Original Text/Task (if applicable): "{original_text}"
        Student's Spoken Transcript: "{transcript}"

        Provide your evaluation in the following JSON format ONLY. Do not include any other text or markdown formatting.
        {{
          "oral_fluency": {{ "score": <score out of 5>, "feedback": "<brief feedback on rhythm, phrasing, and speed>" }},
          "pronunciation": {{ "score": <score out of 5>, "feedback": "<brief feedback on clarity, vowel/consonant sounds, and stress>" }},
          "content": {{ "score": <score out of 5>, "feedback": "<brief feedback on how well the transcript matches the original task>" }},
          "overall_score_out_of_90": <an estimated overall PTE-style score for this specific task, out of 90>,
          "final_summary": "<a concluding one-sentence summary of the performance>",
          "transcript": "{transcript.replace('"', '’')}"
        }}
        """
        
        print("Sending transcript to Gemini for evaluation...")
        gemini_response = gemini_model.generate_content(evaluation_prompt)
        print("Received evaluation from Gemini.")
        
        clean_response = gemini_response.text.strip().replace("```json", "").replace("```", "")
        return jsonify(clean_response)

    except Exception as e:
        print(f"An error occurred: {e}")
        return jsonify({"error": f"An unexpected error occurred on the server during processing."}), 500

if __name__ == '__main__':
    # This is for LOCAL testing only. On Render, this is set in the dashboard.
    os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = 'gcp-credentials.json'
    # Use 0.0.0.0 to make it accessible on your network
    app.run(host='0.0.0.0', port=5001, debug=True)
