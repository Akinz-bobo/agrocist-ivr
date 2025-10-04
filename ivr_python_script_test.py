import json
from fastapi import APIRouter, HTTPException, status, Response, Form, Request
from typing import Optional
from pydantic import BaseModel, Field, ValidationError
from app.core.system_logger import system_logger as logger


# Define the router for voice-related endpoints
router = APIRouter(
    prefix="/api/v1/voice",
    tags=["Voice"]
)

#=========================CONFIGURATION==========================================================
BASE_URL = "https://dev.dsnsandbox.com/ivr/api/v1/voice"
recording_url = f"{BASE_URL}/handle-recording"
STARTUP_DATA = {"+2342017001284": {"name": "Fertitude", "welcome_message": "Welcome to the Fertitude service."}}
audio_url = "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
agent_number = "+2348103317295"  # Replace with the actual agent number
queue_name = "SupportQueue"
hold_music_url="https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
action_url=f"{BASE_URL}/get-digits"
redirect_url=f"{BASE_URL}/incoming-call"


def create_response_xml(text_to_say: str,action_url:Optional[str]=None) -> str:
    """
    Creates a basic XML response for a voice call that stays active.
    """
    if action_url:
        response_xml = (
            f'<Response>'
            f'<Say voice="en-US-Standard-C" playBeep="true">{text_to_say}</Say>'
            f'<GetDigits timeout="30" finishOnKey="#" callbackUrl="{action_url}">'
            f'<Say>Please press 1 for a welcome message or 2 to start recording or 3 to speak to an agent or 4 to listen to a pre-recorded message or 5 to join the queue , followed by the hash key.</Say>'
            f'</GetDigits>'
            f'</Response>'
        )
        return response_xml
    else:
        response_xml = (
            f'<Response>'
            f'<Say voice="en-US-Standard-C" playBeep="true">{text_to_say}</Say>'
            f'<Say>Redirecting you to the main menu. </Say>'
            f'<Redirect>{BASE_URL}/get-digits</Redirect>'
            f'</Response>'
        )
        return response_xml 
def create_response_xml_for_recording(recording_url):
    if recording_url:
        logger.info(f"Recording will be sent to: {recording_url}")
        response_xml = ( f"""
        <Response>
            <Record 
                maxDuration="30" 
                playBeep="true" 
                trimSilence="true" 
                finishOnKey="#" 
                callbackUrl="{recording_url}"
            >
                <Say>Please leave your message after the tone. Press pound when you are done.</Say>
            </Record>
           
        </Response>
        """
        )
        return response_xml
    else:
        logger.error("Recording URL is not set.")
        raise ValueError("Recording URL is not set.")



def create_xml_for_dial(agent_number: str) -> str:
    """Creates XML for the Dial action (Call Forwarding)."""
    return f"""
    <Response>
        <Say>Connecting you now. Please wait.</Say>
        <Dial phoneNumbers="{agent_number}"/>
    </Response>
    """

def create_xml_for_play(audio_url: str) -> str:
    """Creates XML for the Play action (Playing a pre-recorded file)."""
    return f"""
    <Response>
        <Say>Playing an important message now.</Say>
        <Play url="{audio_url}"/>
        <Redirect>{BASE_URL}/get-digits</Redirect>
    </Response>
    """

def create_xml_for_call_queue(queue_name: str, audio_url: str) -> str:
    """Creates XML for the CallQueue action. 
    The callbackUrl handles events like the call being answered or abandoning the queue."""
    return f"""
    <Response>
        <Say>Please hold while we connect you to the next available agent. You are now joining the {queue_name} queue.</Say>
        <Enqueue 
            name="{queue_name}" 
            holdMusic="{audio_url}" 
            callbackUrl="{BASE_URL}/handle-queue-events"
        />
    </Response>
    """
'''
def create_xml_for_redirect(action_url: str) -> str:
    """Creates XML for the Redirect action."""
    return f"""
    <Response>
        <Say>Redirecting your call now.</Say>
        <Redirect>{redirect_url}</Redirect>
    </Response>
    """
'''
@router.post("/incoming-call", status_code=status.HTTP_200_OK)
async def handle_incoming_call(
    sessionId: Optional[str] = Form(None),
    direction: Optional[str] = Form(None),
    callerNumber: str = Form(...),
    destinationNumber: str = Form(...),
    callStartTime: Optional[str] = Form(None),
    isActive: str = Form(...),
    call_status: Optional[str] = Form(None),
    durationInSeconds: Optional[int] = Form(None),
    callType: Optional[str] = Form(None),
    callEndTime: Optional[str] = Form(None),
    callDurationInSeconds: Optional[int] = Form(None),
    callStatus: Optional[str] = Form(None),
    callEndReason: Optional[str] = Form(None),
    callRecordingUrl: Optional[str] = Form(None),
    callRecordingDurationInSeconds: Optional[int] = Form(None),
    callRecordingSizeInBytes: Optional[int] = Form(None),
    callRecordingFormat: Optional[str] = Form(None)
):
    """
    Handles incoming voice call webhooks from Africa's Talking.
    This version now provides a dynamic response based on the caller's number.
    """
    try:
        # If the call is not active, return a blank response.
        if isActive == "0":
            logger.info("Received call with isActive=0. Ending session.", {"session_id": sessionId})
            return Response(content="", media_type="text/plain")

        logger.info("Received incoming call", {"session_id": sessionId, "caller": callerNumber, "destination": destinationNumber})

        # Look up the destination number in our startup data dictionary.
        # The .get() method is used to avoid a KeyError if the number is not found.
        startup = STARTUP_DATA.get(destinationNumber)
        logger.info(f"Lookup result for destination {destinationNumber}: {startup}")

        if startup:
            # If the startup is found, use their personalized welcome message.
            response_xml = create_response_xml(startup["welcome_message"],action_url=f"{BASE_URL}/get-digits")
            logger.info(f"Recognized startup {startup['name']}. Sending personalized welcome.", {"destination": destinationNumber})
        else:
            # If the startup's number is not found, provide a generic welcome message.
            response_xml = create_response_xml("Hello, thank you for calling but your number did not match any startup. Your call is important to us. Goodbye!")
            logger.info("Unrecognized destination. Sending generic welcome.", {"destination": destinationNumber})
        
        # Log the exact XML response being sent
        logger.info(f"Sending XML Response: {response_xml}")
        
        # Return the XML response with the correct media type
        return Response(content=response_xml, media_type="application/xml")
    except Exception as e:
        logger.error("Failed to process incoming call", {"error": str(e)}, exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to process incoming call: {e}"
        )
@router.post("/get-digits", status_code=status.HTTP_200_OK)
async def handle_get_digits(
    sessionId: str = Form(...),
    isActive: str = Form(...),
    dtmfDigits: str = Form(None),
    recordingUrl: Optional[str] = Form(None),
    durationInSeconds: Optional[str] = Form(None)
    
):  
    logger.info("Received /get-digits webhook", {
        "sessionId": sessionId, 
        "isActive": isActive, 
        "dtmfDigits": dtmfDigits, 
        "recordingUrl": recordingUrl
    })
    if isActive == "0":
        #return Response(content="", media_type="text/plain")
        if recordingUrl:
            # THIS IS WHERE YOU PROCESS THE RECORDING DATA 💾
            # The user pressed # or hung up, and the recording is available.
            logger.info(
                f"Session {sessionId} completed with recording. URL: {recordingUrl}",
                {"recording_url": recordingUrl}
            )
            # You would typically save recordingUrl and other details to your DB here.
            
            # Since the call is ending, return a blank response to acknowledge the webhook.
            return Response(content="", media_type="text/plain")
        else:
            logger.info(f"Session {sessionId} ended after GetDigits without recording.")
            # Return blank response for a normal hangup without recording
            return Response(content="", media_type="text/plain")
        
    if dtmfDigits == "1":
        # Handle option 1
        response_xml = create_response_xml("You pressed 1. Thank you for calling. Goodbye!")
    elif dtmfDigits == "2":
        # Handle option 2, start recording
        response_xml = create_response_xml_for_recording(recording_url)
    elif dtmfDigits =="3":
        #Handle option 3, dial agent
        response_xml = create_xml_for_dial(agent_number)  # Replace
    elif dtmfDigits =="4":
        #Handle option 4, play audio
        response_xml = create_xml_for_play(audio_url)  # Replace
    elif dtmfDigits =="5":
        #Handle option 5, join queue
        response_xml = create_xml_for_call_queue(queue_name, hold_music_url)  
    elif dtmfDigits =="":
        logger.info("No DTMF input received. Re-presenting menu using <GetDigits>.")
    
        # Call your primary menu creation function and pass the action_url.
        # This triggers the 'if action_url' block in create_response_xml, 
        # which contains the necessary <GetDigits> tag.
        response_xml = create_response_xml(
            "Welcome back. Please select an option.",
            action_url=f"{BASE_URL}/get-digits"
        )
        
        return Response(content=response_xml, media_type="application/xml")
    else:
        # Handle invalid input
        logger.warning(f"Session {sessionId} sent invalid DTMF input: {dtmfDigits}")
        response_xml = create_response_xml("Invalid input. Goodbye!")

    return Response(content=response_xml, media_type="application/xml")

@router.post("/handle-recording", status_code=status.HTTP_200_OK)
async def handle_recording_webhook(
    sessionId:Optional[str] = Form(None), 
    callRecordingUrl:Optional[str] = Form(None), 
    callRecordingDurationInSeconds:Optional[int] = Form(None),
    isActive: str = Form(...),
):
    """Receives the webhook after a recording is complete."""
    print(f"Session {sessionId}: Recording URL: {callRecordingUrl}, Duration: {callRecordingDurationInSeconds}s")
    logger.info(f"Session {sessionId}: Recording URL: {callRecordingUrl}, Duration: {callRecordingDurationInSeconds}s")
    if isActive == "0":
         logger.info(f"Session {sessionId}: Received isActive=0 at /handle-recording. Returning blank.")
         return Response(content="", media_type="text/plain")

    # LOGGING: You would typically save this URL and duration to your database here.
    print(f"Session {sessionId}: Recording URL: {callRecordingUrl}, Duration: {callRecordingDurationInSeconds}s")
    logger.info(f"Session {sessionId}: Recording URL: {callRecordingUrl}, Duration: {callRecordingDurationInSeconds}s")

    response_xml = create_response_xml("Your message has been saved successfully. Goodbye!")
    
    return Response(content=response_xml, media_type="application/xml") 

@router.post("/handle-queue-events", status_code=status.HTTP_200_OK)
async def handle_queue_events(
    sessionId:Optional[str] = Form(None),
    status: str = Form(...), # Queue status: Joined, Transferring, Bridged, Finished, Hold
    queueName:Optional[str] = Form(None),
    numCallersInQueue: int = Form(None),
    isActive: str = Form(...),
):
    """Receives webhooks when events occur in the CallQueue."""
    if isActive == "0":
        return Response(content="", media_type="text/plain")
    
    logger.info(f"Queue Event: Session {sessionId} - Status: {status}, Queue: {queueName}, Callers: {numCallersInQueue}")

    # You can return XML here if the status indicates the call needs a new instruction,
    # for example, if the caller leaves the queue:
    if status == "Finished" and isActive == "1":
        # If the call was finished but isActive is 1, it means the agent hung up, 
        # but the caller needs a final message.
        return Response(
            content=create_response_xml("Thank you for holding, the call has now ended. Goodbye!"),
            media_type="text/plain"
        )
    
    # Otherwise, return empty response for status updates
    return Response(content="", media_type="text/plain")


@router.post("/redirect-destination", status_code=status.HTTP_200_OK)
async def handle_redirect_destination(
    sessionId: str = Form(...),
    isActive: str = Form(...),
):
    """The final destination endpoint after a Redirect action (Option 5)."""
    if isActive == "0":
        return Response(content="", media_type="text/plain")
        
    logger.info(f"Session {sessionId} redirected to final destination.")

    # After the redirect, provide the information and hang up
    response_xml = create_response_xml("Our office hours are Monday to Friday, 9 AM to 5 PM. Goodbye!")
    return Response(content=response_xml, media_type="text/plain")
