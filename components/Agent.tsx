// Marks this as a client-side component (Next.js)
'use client';

// Importing necessary modules and libraries
import Image from "next/image"; // Next.js optimized image component
import { cn } from "@/lib/utils"; // Utility for conditional className concatenation
import { useRouter } from "next/navigation"; // For client-side routing
import { useEffect, useState } from "react"; // React hooks
import { vapi } from '@/lib/vapi.sdk'; // Custom SDK to handle voice API interactions
import { interviewer } from "@/constants"; // Constant for interviewer config
import { createFeedback } from "@/lib/actions/general.action"; // Function to store feedback

// Enum to define various call statuses
enum CallStatus {
    INACTIVE = 'INACTIVE',
    CONNECTING = 'CONNECTING',
    ACTIVE = 'ACTIVE',
    FINISHED = 'FINISHED',
}

// Type for stored message
interface SavedMessage {
    role: 'user' | 'system' | 'assistant';
    content: string;
}

// The main Agent component with props
const Agent = ({ userName, userId, type, interviewId, questions }: AgentProps) => {
    const router = useRouter(); // Router instance for navigation
    const [isSpeaking, setIsSpeaking] = useState(false); // Indicates if the AI is currently speaking
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE); // Tracks the current call state
    const [messages, setMessages] = useState<SavedMessage[]>([]); // Stores the transcript messages

    // Effect to set up VAPI event listeners
    useEffect(() => {
        // Event handlers for VAPI events
        const onCallStart = () => setCallStatus(CallStatus.ACTIVE);
        const onCallEnd = () => setCallStatus(CallStatus.FINISHED);

        const onMessage = (message: Message) => {
            // Only handle final transcripts
            if(message.type === 'transcript' && message.transcriptType === 'final') {
                const newMessage = { role: message.role, content: message.transcript };
                setMessages((prev) => [...prev, newMessage]);
            }
        }

        const onSpeechStart = () => setIsSpeaking(true);
        const onSpeechEnd = () => setIsSpeaking(false);

        const onError = (error: Error) => console.log('Error', error);

        // Registering all VAPI event listeners
        vapi.on('call-start', onCallStart);
        vapi.on('call-end', onCallEnd);
        vapi.on('message', onMessage);
        vapi.on('speech-start', onSpeechStart);
        vapi.on('speech-end', onSpeechEnd);
        vapi.on('error', onError);

        // Cleanup all listeners when component unmounts
        return () => {
            vapi.off('call-start', onCallStart);
            vapi.off('call-end', onCallEnd);
            vapi.off('message', onMessage);
            vapi.off('speech-start', onSpeechStart);
            vapi.off('speech-end', onSpeechEnd);
            vapi.off('error', onError);
        }
    }, [])

    // Function to handle feedback generation and redirection
    const handleGenerateFeedback = async (messages: SavedMessage[]) => {
        console.log('Generate feedback here.');

        // Calls backend action to create feedback entry
        const { success, feedbackId: id } = await createFeedback({
            interviewId: interviewId!,
            userId: userId!,
            transcript: messages
        });

        // Redirect to feedback page or home depending on result
        if(success && id) {
            router.push(`/interview/${interviewId}/feedback`);
        } else {
            console.log('Error saving feedback');
            router.push('/');
        }
    }

    // Trigger feedback logic when call ends
    useEffect(() => {
        if(callStatus === CallStatus.FINISHED) {
            if(type === 'generate') {
                router.push('/') // For generate-only calls, return to home
            } else {
                handleGenerateFeedback(messages); // Else create feedback
            }
        }
    }, [messages, callStatus, type, userId]);

    // Function to start a call
    const handleCall = async () => {
        setCallStatus(CallStatus.CONNECTING); // Set status to connecting

        if(type === 'generate') {
            // For test generation calls, use workflow ID
            await vapi.start(process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID!, {
                variableValues: {
                    username: userName,
                    userid: userId,
                }
            })
        } else {
            // Prepare formatted question list
            let formattedQuestions = '';
            if(questions) {
                formattedQuestions = questions
                    .map((question) => `- ${question}`)
                    .join('\n');
            }

            // Start the interview call using AI interviewer
            await vapi.start(interviewer, {
                variableValues: {
                    questions: formattedQuestions
                }
            })
        }
    }

    // Function to stop an active call
    const handleDisconnect = async () => {
        setCallStatus(CallStatus.FINISHED); // Mark call as finished
        vapi.stop(); // Stop the VAPI call
    }

    // Get the latest message from the transcript
    const latestMessage = messages[messages.length - 1]?.content;

    // Boolean to check if call is inactive or ended
    const isCallInactiveOrFinished = callStatus === CallStatus.INACTIVE || callStatus === CallStatus.FINISHED;


    return (
        <>
        <div className="call-view">
            <div className="card-interviewer">
                <div className="avatar">
                    <Image src="/ai-avatar.png" alt="vapi" width={65} height={54} className="object-cover" />
                    {isSpeaking && <span className="animate-speak" />}
                </div>
                <h3>AI Interviewer</h3>
            </div>

            <div className="card-border">
                <div className="card-content">
                    <Image src="/user-avatar.png" alt="user avatar" width={540} height={540} className="rounded-full object-cover size-[120px]" />
                    <h3>{userName}</h3>
                </div>
            </div>
        </div>
            {messages.length > 0 && (
                <div className="transcript-border">
                    <div className="transcript">
                        <p key={latestMessage} className={cn('transition-opacity duration-500 opacity-0', 'animate-fadeIn opacity-100')}>
                            {latestMessage}
                        </p>
                    </div>
                </div>
            )}

            <div className="w-full flex justify-center">
                {callStatus !== 'ACTIVE' ? (
                    <button className="relative btn-call" onClick={handleCall}>
                        <span className={cn('absolute animate-ping rounded-full opacity-75', callStatus !=='CONNECTING' && 'hidden')}
                             />

                            <span>
                                {isCallInactiveOrFinished ? 'Call' : '. . .'}
                            </span>
                    </button>
                ) : (
                    <button className="btn-disconnect" onClick={handleDisconnect}>
                        End
                    </button>
                )}
            </div>
        </>
    )
}
export default Agent