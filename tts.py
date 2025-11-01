import requests

BASE_URL = "https://api.dsnsandbox.com" 

AUTH_ENDPOINT = "/api/v1/auth/login/json"
TRANSLATE_ENDPOINT = "/api/v1/ai/spitch/translate"

# Auth credentials
IDENTIFIER = "evet"               
PASSWORD = "D1wmd7IkzfjrOW"                
# -----------------------------------------

def authenticate():
    """Authenticate and return access token."""
    url = BASE_URL + AUTH_ENDPOINT
    payload = {
        "identifier": IDENTIFIER,
        "password": PASSWORD
    }
    response = requests.post(url, json=payload)
    response.raise_for_status()
    token = response.json().get("access_token")
    return token

def text_to_speech(token, text, voice="default", language="en"):
    """Send text to the text-to-speech endpoint."""
    url = BASE_URL + "/api/v1/ai/spitch/text-to-speech"
    headers = {
        "Authorization": f"Bearer {token}"
    }
    data = {
        "text": text,
        "voice": voice,
        "language": language
    }

    response = None
    try:
        response = requests.post(url, headers=headers, data=data) 
        response.raise_for_status()
        return response.content  
    except requests.exceptions.HTTPError as e:
        if response:
            print(f"Error: {response.status_code} {response.reason} for url: {url}")
            print("Response text:", response.text)
            print(f"Exception details: {str(e)}")
        raise e
    except Exception as e:
        print(f"Unexpected error: {str(e)}")
        raise e

def run_tts():
    print("Authenticating...")
    token = authenticate()
    print("✅ Authenticated!\n")

    while True:
        text = input("Enter text for TTS (or 'exit' to quit): ")
        if text.lower() in ["exit", "quit"]:
            break

        voice = input("Voice [default=default]: ") or "default"
        language = input("Language [default=en]: ") or "en"

        audio_data = text_to_speech(token, text, voice, language)
        
        # Save audio to file
        filename = f"tts_output_{hash(text) % 10000}.wav"
        with open(filename, "wb") as f:
            f.write(audio_data)
        print(f"Audio saved as: {filename}\n")


# Run TTS
run_tts()