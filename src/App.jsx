import React, { useState, useRef, useEffect } from 'react';
import { Upload, Send, FileText, MessageCircle, Loader2, AlertCircle, CheckCircle2, User, Bot } from 'lucide-react';

// Get API base URL from environment or use default
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://localhost:5048/api/web';
const MAX_FILE_SIZE = parseInt(import.meta.env.VITE_MAX_FILE_SIZE) || 52428800; // 50MB default

const TeamsAIWebApp = () => {
    const [sessionId, setSessionId] = useState(null);
    const [messages, setMessages] = useState([]);
    const [currentMessage, setCurrentMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    const [isUploading, setIsUploading] = useState(false);
    const [sessionStatus, setSessionStatus] = useState('initializing');
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);
    const messagesEndRef = useRef(null);

    // Create session on component mount
    useEffect(() => {
        createSession();
    }, []);

    // Scroll to bottom when messages change
    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const createSession = async () => {
        try {
            setSessionStatus('initializing');
            setError(null);

            const response = await fetch(`${API_BASE_URL}/session`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    userId: 'web-user',
                    channelId: 'web-channel'
                }),
            });

            if (!response.ok) {
                throw new Error(`Failed to create session: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();
            setSessionId(data.sessionId);
            setSessionStatus('active');

            // Add welcome message
            setMessages([{
                id: Date.now(),
                role: 'assistant',
                content: 'Hello! I\'m your AI document assistant. Upload some documents and I\'ll help you analyze and answer questions about them.',
                timestamp: new Date(),
                citations: []
            }]);

        } catch (error) {
            console.error('Error creating session:', error);
            setError('Failed to initialize session. Please refresh the page to try again.');
            setSessionStatus('error');
        }
    };

    const handleFileUpload = async (files) => {
        if (!sessionId) {
            setError('No active session. Please refresh the page.');
            return;
        }

        setIsUploading(true);
        setError(null);
        const uploadPromises = [];

        for (const file of files) {
            if (file.size > MAX_FILE_SIZE) {
                setError(`File ${file.name} is too large. Maximum size is ${Math.round(MAX_FILE_SIZE / (1024 * 1024))}MB.`);
                continue;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('sessionId', sessionId);

            uploadPromises.push(
                fetch(`${API_BASE_URL}/documents/upload`, {
                    method: 'POST',
                    body: formData,
                }).then(async response => {
                    if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || `Failed to upload ${file.name}`);
                    }
                    return response.json();
                })
            );
        }

        try {
            const results = await Promise.all(uploadPromises);
            const newFiles = results.map(result => ({
                id: result.documentId,
                name: result.fileName,
                size: result.fileSize,
                status: result.status,
                chunkCount: result.chunkCount
            }));

            setUploadedFiles(prev => [...prev, ...newFiles]);

            // Add success message
            const fileNames = newFiles.map(f => f.name).join(', ');
            setMessages(prev => [...prev, {
                id: Date.now(),
                role: 'assistant',
                content: `✅ Successfully uploaded and processed: ${fileNames}. You can now ask questions about your documents!`,
                timestamp: new Date(),
                citations: []
            }]);

        } catch (error) {
            console.error('Error uploading files:', error);
            setError(`Upload failed: ${error.message}`);
        } finally {
            setIsUploading(false);
        }
    };

    const handleSendMessage = async () => {
        if (!currentMessage.trim() || !sessionId || isLoading) return;

        const userMessage = {
            id: Date.now(),
            role: 'user',
            content: currentMessage.trim(),
            timestamp: new Date(),
            citations: []
        };

        setMessages(prev => [...prev, userMessage]);
        setCurrentMessage('');
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    sessionId: sessionId,
                    message: userMessage.content,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || 'Failed to get response');
            }

            const data = await response.json();

            const assistantMessage = {
                id: Date.now() + 1,
                role: 'assistant',
                content: data.response,
                timestamp: new Date(),
                citations: data.citations || []
            };

            setMessages(prev => [...prev, assistantMessage]);

        } catch (error) {
            console.error('Error sending message:', error);
            setError(`Failed to send message: ${error.message}`);

            // Add error message
            setMessages(prev => [...prev, {
                id: Date.now() + 1,
                role: 'assistant',
                content: '❌ I encountered an error processing your message. Please try again.',
                timestamp: new Date(),
                citations: []
            }]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    };

    const handleFileSelect = (e) => {
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            handleFileUpload(files);
        }
        e.target.value = '';
    };

    const handleDrop = (e) => {
        e.preventDefault();
        const files = Array.from(e.dataTransfer.files);
        if (files.length > 0) {
            handleFileUpload(files);
        }
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const clearSession = async () => {
        if (!sessionId) return;

        try {
            await fetch(`${API_BASE_URL}/session/${sessionId}`, {
                method: 'DELETE',
            });

            // Reset state
            setMessages([]);
            setUploadedFiles([]);
            setCurrentMessage('');
            setError(null);

            // Create new session
            await createSession();

        } catch (error) {
            console.error('Error clearing session:', error);
            setError('Failed to clear session');
        }
    };

    if (sessionStatus === 'error') {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
                    <div className="flex items-center space-x-3 text-red-600 mb-4">
                        <AlertCircle className="w-6 h-6" />
                        <h2 className="text-lg font-semibold">Connection Error</h2>
                    </div>
                    <p className="text-gray-700 mb-4">{error}</p>
                    <button
                        onClick={createSession}
                        className="w-full bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        Try Again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <div className="bg-white shadow-sm border-b">
                <div className="max-w-6xl mx-auto px-4 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                                <MessageCircle className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Document Assistant</h1>
                                <p className="text-sm text-gray-600">
                                    {sessionStatus === 'initializing' ? 'Initializing...' : `Session: ${sessionId?.substring(0, 8)}...`}
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-3">
                            {uploadedFiles.length > 0 && (
                                <span className="text-sm text-gray-600">
                                    {uploadedFiles.length} document{uploadedFiles.length !== 1 ? 's' : ''} uploaded
                                </span>
                            )}
                            <button
                                onClick={clearSession}
                                className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 border rounded-lg hover:bg-gray-50"
                            >
                                Clear Session
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 py-6 flex gap-6 h-[calc(100vh-100px)]">
                {/* Sidebar */}
                <div className="w-80 bg-white rounded-lg shadow-sm p-6 overflow-auto">
                    <h2 className="font-semibold text-gray-900 mb-4">Upload Documents</h2>

                    {/* File Upload Area */}
                    <div
                        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-blue-400 cursor-pointer transition-colors mb-4"
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                        <p className="text-sm text-gray-600">
                            {isUploading ? 'Uploading...' : 'Drop files here or click to upload'}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                            PDF, Word, PowerPoint, Excel, Text (max 50MB)
                        </p>
                    </div>

                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        accept=".pdf,.docx,.doc,.pptx,.ppt,.xlsx,.xls,.txt"
                        onChange={handleFileSelect}
                        className="hidden"
                    />

                    {/* Uploaded Files */}
                    {uploadedFiles.length > 0 && (
                        <div>
                            <h3 className="font-medium text-gray-900 mb-2">Uploaded Files</h3>
                            <div className="space-y-2">
                                {uploadedFiles.map((file) => (
                                    <div key={file.id} className="flex items-center space-x-2 p-2 bg-gray-50 rounded">
                                        <FileText className="w-4 h-4 text-blue-600" />
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium text-gray-900 truncate">{file.name}</p>
                                            <p className="text-xs text-gray-500">{file.chunkCount} sections processed</p>
                                        </div>
                                        <CheckCircle2 className="w-4 h-4 text-green-600" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Chat Area */}
                <div className="flex-1 bg-white rounded-lg shadow-sm flex flex-col">
                    {/* Messages */}
                    <div className="flex-1 overflow-auto p-6">
                        {sessionStatus === 'initializing' ? (
                            <div className="flex items-center justify-center h-full">
                                <div className="text-center">
                                    <Loader2 className="w-8 h-8 text-blue-600 mx-auto mb-2 animate-spin" />
                                    <p className="text-gray-600">Initializing session...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {messages.map((message) => (
                                    <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                        <div className={`max-w-[80%] ${message.role === 'user' ? 'order-2' : 'order-1'}`}>
                                            <div className="flex items-center space-x-2 mb-1">
                                                {message.role === 'assistant' ? (
                                                    <Bot className="w-4 h-4 text-blue-600" />
                                                ) : (
                                                    <User className="w-4 h-4 text-gray-600" />
                                                )}
                                                <span className="text-xs text-gray-500">
                                                    {message.timestamp.toLocaleTimeString()}
                                                </span>
                                            </div>
                                            <div className={`p-3 rounded-lg ${message.role === 'user'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-100 text-gray-900'
                                                }`}>
                                                <p className="whitespace-pre-wrap">{message.content}</p>

                                                {/* Citations */}
                                                {message.citations && message.citations.length > 0 && (
                                                    <div className="mt-3 pt-3 border-t border-gray-200">
                                                        <p className="text-sm font-medium mb-2">Sources:</p>
                                                        <div className="space-y-2">
                                                            {message.citations.map((citation, index) => (
                                                                <div key={index} className="text-sm p-2 bg-white/50 rounded">
                                                                    <p className="font-medium">{citation.fileName}</p>
                                                                    {citation.pageReference && (
                                                                        <p className="text-xs text-gray-600">Page: {citation.pageReference}</p>
                                                                    )}
                                                                    {citation.quotedText && (
                                                                        <p className="text-xs italic mt-1">"{citation.quotedText}"</p>
                                                                    )}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}

                                {isLoading && (
                                    <div className="flex justify-start">
                                        <div className="bg-gray-100 p-3 rounded-lg">
                                            <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                                        </div>
                                    </div>
                                )}

                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    {/* Input Area */}
                    <div className="border-t p-4">
                        {error && (
                            <div className="mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-800 text-sm">
                                {error}
                            </div>
                        )}

                        <div className="flex space-x-3">
                            <textarea
                                value={currentMessage}
                                onChange={(e) => setCurrentMessage(e.target.value)}
                                onKeyPress={handleKeyPress}
                                placeholder={uploadedFiles.length === 0 ? "Upload documents first, then ask questions..." : "Ask a question about your documents..."}
                                className="flex-1 resize-none rounded-lg border border-gray-300 px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                rows="2"
                                disabled={sessionStatus !== 'active' || isLoading}
                            />
                            <button
                                onClick={handleSendMessage}
                                disabled={!currentMessage.trim() || sessionStatus !== 'active' || isLoading}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                <Send className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-xs text-gray-500 mt-2">
                            Press Enter to send, Shift+Enter for new line
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default TeamsAIWebApp;