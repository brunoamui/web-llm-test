'use client';

import { useState, useRef, useEffect, memo } from 'react';
import * as webllm from '@mlc-ai/web-llm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatMessage, ModelConfig, ModelStatus } from '@/types/llm';

type MLCEngine = webllm.MLCEngine;
type InitProgressReport = webllm.InitProgressReport;

// Create a memoized MessageItem component
const MessageItem = memo(({ message }: { message: ChatMessage }) => (
  <div 
    className={`p-3 md:p-4 rounded-lg ${
      message.role === 'user' 
        ? 'bg-primary text-primary-foreground ml-2 md:ml-10' 
        : 'bg-secondary text-secondary-foreground mr-2 md:mr-10'
    }`}
  >
    <p className="font-semibold capitalize mb-1 text-sm md:text-base">{message.role}:</p>
    <div className="whitespace-pre-wrap text-sm md:text-base">{message.content}</div>
  </div>
));

// Add display name for better debugging
MessageItem.displayName = 'MessageItem';

const ChatInterface = ({
  config,
  onStatusChange
}: {
  config: ModelConfig;
  onStatusChange: (status: ModelStatus) => void;
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Use refs to track previous state/props without triggering re-renders
  const prevModelIdRef = useRef<string>(config.modelId);
  const engineRef = useRef<MLCEngine | null>(engine);
  const configRef = useRef<ModelConfig>(config);
  
  // Update refs when their values change
  useEffect(() => {
    engineRef.current = engine;
    configRef.current = config;
  }, [engine, config]);

  // Split engine initialization effect to reduce dependencies
  useEffect(() => {
    let isMounted = true;
    
    // Only initialize engine if model ID has changed
    if (prevModelIdRef.current !== config.modelId) {
      const initEngine = async () => {
        try {
          // Report loading status
          onStatusChange({ isLoading: true });
          
          // Cleanup the previous engine if it exists
          if (engineRef.current) {
            await engineRef.current.unload();
          }
          
          // Create a new engine with the selected model
          const newEngine = await webllm.CreateMLCEngine(
            config.modelId,
            {
              // Progress callback
              initProgressCallback: (report: InitProgressReport) => {
                if (isMounted) {
                  onStatusChange({
                    isLoading: true,
                    progress: report.progress,
                  });
                }
              },
            }
          );
          
          if (isMounted) {
            setEngine(newEngine);
            onStatusChange({ isLoading: false });
          }
        } catch (error) {
          console.error("Error initializing Web-LLM:", error);
          if (isMounted) {
            onStatusChange({
              isLoading: false,
              error: `Error initializing model: ${error instanceof Error ? error.message : String(error)}`,
            });
          }
        }
      };
      
      initEngine();
      prevModelIdRef.current = config.modelId;
    }
    
    // Cleanup function for mounting/unmounting, not for every dependency change
    return () => {
      isMounted = false;
    };
  }, [config.modelId, onStatusChange]); // Minimal dependencies to avoid re-runs
  
  // Separate cleanup effect that runs only on unmount
  useEffect(() => {
    return () => {
      // Cleanup engine on component unmount
      if (engineRef.current) {
        engineRef.current.unload().catch(console.error);
      }
    };
  }, []); // Empty dependency array means this runs only on unmount
  
  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const currentEngine = engineRef.current;
    if (!input.trim() || !currentEngine || isGenerating) return;
    
    const userMessage: ChatMessage = { role: 'user', content: input };
    const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
    
    // Batch state updates together
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsGenerating(true);
    
    try {
      // Prepare chat messages in the format expected by web-llm
      const chatMessages = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Use streaming API with correct property names for the web-llm API
      const chunks = await currentEngine.chat.completions.create({
        messages: chatMessages,
        stream: true,
        temperature: configRef.current.temperature,
        max_tokens: configRef.current.maxTokens,
        top_p: configRef.current.topP,
        // Omitting repetition_penalty as it's not supported in the API
      });

      // Process the streaming response
      let fullResponse = '';
      for await (const chunk of chunks) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        
        // Use functional updates for state that depends on previous state
        setMessages(prev => {
          const updatedMessages = [...prev];
          updatedMessages[updatedMessages.length - 1] = {
            ...updatedMessages[updatedMessages.length - 1],
            content: fullResponse
          };
          return updatedMessages;
        });
      }
      
    } catch (error) {
      console.error("Error generating response:", error);
      // Use functional update
      setMessages(prev => [
        ...prev.slice(0, -1), // Remove the empty assistant message
        {
          role: 'assistant',
          content: `Error generating response: ${error instanceof Error ? error.message : String(error)}`
        }
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Chat</CardTitle>
        <CardDescription>
          Interact with the selected model
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col h-[40vh] md:h-[50vh]">
          <div className="flex-1 overflow-y-auto mb-4 space-y-4">
            {messages.slice(1).map((message, i) => (
              <MessageItem key={`${message.role}-${i}`} message={message} />
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2">
            <Textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message..."
              className="resize-none min-h-24 sm:min-h-0"
              disabled={!engine || isGenerating}
            />
            <Button 
              type="submit" 
              disabled={!engine || isGenerating || !input.trim()}
              className="sm:self-end sm:w-24"
            >
              {isGenerating ? "..." : "Send"}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
};

export default memo(ChatInterface);