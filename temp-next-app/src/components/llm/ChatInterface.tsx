'use client';

import { useState, useRef, useEffect } from 'react';
import * as webllm from '@mlc-ai/web-llm';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ChatMessage, ModelConfig, ModelStatus } from '@/types/llm';

type MLCEngine = webllm.MLCEngine;
type InitProgressReport = webllm.InitProgressReport;

export default function ChatInterface({
  config,
  onStatusChange
}: {
  config: ModelConfig;
  onStatusChange: (status: ModelStatus) => void;
}) {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'system', content: 'You are a helpful AI assistant.' }
  ]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [engine, setEngine] = useState<MLCEngine | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Initialize the engine when config changes
  useEffect(() => {
    let isMounted = true;
    
    const initEngine = async () => {
      try {
        // Report loading status
        onStatusChange({ isLoading: true });
        
        // Cleanup the previous engine if it exists
        if (engine) {
          await engine.unload();
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
          // Engine config - removed here as it may need to be set differently
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
    
    // Cleanup function
    return () => {
      isMounted = false;
      if (engine) {
        engine.unload().catch(console.error);
      }
    };
  }, [
    config.modelId, 
    config.maxTokens, 
    config.temperature, 
    config.topP, 
    config.repetitionPenalty, 
    engine, 
    onStatusChange
  ]);
  
  // Scroll to bottom of messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!input.trim() || !engine || isGenerating) return;
    
    const userMessage: ChatMessage = { role: 'user', content: input };
    setMessages([...messages, userMessage]);
    setInput('');
    setIsGenerating(true);
    
    try {
      // Prepare chat messages in the format expected by web-llm
      const chatMessages = messages.concat(userMessage).map(msg => ({
        role: msg.role,
        content: msg.content
      }));

      // Start generating the response
      const assistantMessage: ChatMessage = { role: 'assistant', content: '' };
      setMessages([...messages, userMessage, assistantMessage]);

      // Use streaming API with correct property names for the web-llm API
      const chunks = await engine.chat.completions.create({
        messages: chatMessages,
        stream: true,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
        top_p: config.topP,
        // Omitting repetition_penalty as it's not supported in the API
      });

      // Process the streaming response
      let fullResponse = '';
      for await (const chunk of chunks) {
        const content = chunk.choices[0]?.delta?.content || '';
        fullResponse += content;
        
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
      setMessages(prev => [
        ...prev,
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
              <div 
                key={i} 
                className={`p-3 md:p-4 rounded-lg ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground ml-2 md:ml-10' 
                    : 'bg-secondary text-secondary-foreground mr-2 md:mr-10'
                }`}
              >
                <p className="font-semibold capitalize mb-1 text-sm md:text-base">{message.role}:</p>
                <div className="whitespace-pre-wrap text-sm md:text-base">{message.content}</div>
              </div>
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
}