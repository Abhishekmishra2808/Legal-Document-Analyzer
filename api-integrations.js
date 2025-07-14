// api-integrations.js
// Enhanced AI API Integrations for Indian Legal Document Analyzer
// Now using only Gemini (Google) for all AI tasks via serverless function

const legalAPIs = {
    availableServices: {
        ai: ['gemini'],
        nlp: false,
        documentAI: false,
        translation: false
    },

    async initializeServices() {
        // Only Gemini is available for AI
        this.availableServices.ai = ['gemini'];
        // Optionally check for other Google services if needed
        this.availableServices.nlp = !!API_CONFIG.GOOGLE_NATURAL_LANGUAGE.API_KEY;
        this.availableServices.documentAI = !!API_CONFIG.GOOGLE_DOCUMENT_AI.API_KEY;
        this.availableServices.translation = !!API_CONFIG.GOOGLE_TRANSLATE.API_KEY;
        
        console.log('🤖 Available AI Services:', this.availableServices);
        return this.availableServices;
    },

    async processDocument(file) {
        try {
            console.log('📄 Processing document with AI pipeline...');
            
            const results = {
                originalFile: file,
                extractedText: '',
                entities: [],
                structure: {},
                ocrConfidence: 0,
                naturalLanguageAnalysis: {},
                legalEntities: []
            };

            // Step 1: Extract text and structure using Document AI
            if (this.availableServices.documentAI) {
                const documentAIResult = await this._processWithDocumentAI(file);
                results.extractedText = documentAIResult.text;
                results.structure = documentAIResult.structure;
                results.ocrConfidence = documentAIResult.confidence;
            } else {
                // Fallback: Basic file reading
                results.extractedText = await this._extractTextFallback(file);
            }

            // Step 2: Enhanced NLP analysis
            if (this.availableServices.nlp && results.extractedText) {
                results.naturalLanguageAnalysis = await this._analyzeWithNaturalLanguage(results.extractedText);
                results.entities = results.naturalLanguageAnalysis.entities || [];
            }

            // Step 3: Legal entity extraction with specialized models
            if (this.availableServices.ai.includes('huggingface')) {
                results.legalEntities = await this._extractLegalEntities(results.extractedText);
            }

            console.log('✅ Document processing complete:', results);
            return results;

        } catch (error) {
            console.error('Error in document processing pipeline:', error);
            return this._getFallbackDocumentProcessing(file);
        }
    },

    async askLegalQuestion(question, documentContext = '') {
        return await this._callServerless('askLegalQuestion', { question, documentContext });
    },

    async summarizeDocument(documentText, summaryType = 'comprehensive', summaryLength = 'medium') {
        return await this._callServerless('summarizeDocument', { documentText, summaryType, summaryLength });
    },

    async translateText(text, sourceLang, targetLang) {
        return await this._callServerless('translateText', { text, sourceLang, targetLang });
    },

    async performSemanticSearch(query, documentText) {
        return await this._callServerless('performSemanticSearch', { query, documentText });
    },

    async compareDocuments(doc1Text, doc2Text) {
        return await this._callServerless('compareDocuments', { doc1Text, doc2Text });
    },

    async assessLegalRisk(documentText) {
        return await this._callServerless('assessLegalRisk', { documentText });
    },

    async _callServerless(action, params) {
        const response = await fetch('/api/legal-ai', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action, ...params })
        });
        if (!response.ok) throw new Error('Serverless AI API error');
        const data = await response.json();
        if (!data.success) throw new Error(data.error || 'Unknown AI error');
        return data.data;
    },

    // Enhanced OpenAI Integration
    async _callOpenAI(prompt, type = 'general') {
        const response = await fetch(`${API_CONFIG.OPENAI.BASE_URL}/chat/completions`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.OPENAI.API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: API_CONFIG.OPENAI.MODEL,
                messages: [
                    {
                        role: 'system',
                        content: 'You are an expert legal AI assistant specializing in Indian law and legal document analysis. Provide accurate, detailed, and practical legal insights.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                max_tokens: API_CONFIG.OPENAI.MAX_TOKENS,
                temperature: API_CONFIG.OPENAI.TEMPERATURE
            })
        });

        if (!response.ok) {
            throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.choices[0].message.content;
    },

    // Google Gemini Integration
    async _callGemini(prompt, type = 'general') {
        const response = await fetch(`${API_CONFIG.GEMINI.BASE_URL}/models/${API_CONFIG.GEMINI.MODEL}:generateContent?key=${API_CONFIG.GEMINI.API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `You are an expert legal AI assistant specializing in Indian law. ${prompt}`
                    }]
                }],
                generationConfig: {
                    temperature: API_CONFIG.GEMINI.TEMPERATURE,
                    maxOutputTokens: API_CONFIG.GEMINI.MAX_TOKENS
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.candidates[0].content.parts[0].text;
    },

    // Enhanced Anthropic Integration
    async _callAnthropic(prompt) {
        const response = await fetch(`${API_CONFIG.ANTHROPIC.BASE_URL}/messages`, {
            method: 'POST',
            headers: {
                'x-api-key': API_CONFIG.ANTHROPIC.API_KEY,
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01'
            },
            body: JSON.stringify({
                model: API_CONFIG.ANTHROPIC.MODEL,
                max_tokens: 2000,
                messages: [
                    {
                        role: 'user',
                        content: `You are an expert legal AI assistant specializing in Indian law. ${prompt}`
                    }
                ]
            })
        });

        if (!response.ok) {
            throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return data.content[0].text;
    },

    // Enhanced Hugging Face Integration with Specialized Models
    async _callHuggingFace(prompt, taskType) {
        let model = API_CONFIG.HUGGINGFACE.LEGAL_MODEL;
        
        if (taskType === 'summarization') {
            model = API_CONFIG.HUGGINGFACE.SUMMARIZATION_MODEL;
        }

        const response = await fetch(`${API_CONFIG.HUGGINGFACE.BASE_URL}/${model}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${API_CONFIG.HUGGINGFACE.API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                inputs: prompt,
                parameters: {
                    max_length: 500,
                    min_length: 100,
                    temperature: 0.3
                }
            })
        });

        if (!response.ok) {
            throw new Error(`Hugging Face API error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        return Array.isArray(data) ? data[0].generated_text || data[0].summary_text : data.generated_text || data.summary_text;
    },

    // Google Document AI Integration
    async _processWithDocumentAI(file) {
        // This is a simplified version - full implementation would require proper base64 encoding and project setup
        try {
            const fileContent = await this._fileToBase64(file);
            
            const response = await fetch(`${API_CONFIG.GOOGLE_DOCUMENT_AI.BASE_URL}/projects/${API_CONFIG.GOOGLE_DOCUMENT_AI.PROJECT_ID}/locations/${API_CONFIG.GOOGLE_DOCUMENT_AI.LOCATION}/processors/${API_CONFIG.GOOGLE_DOCUMENT_AI.PROCESSOR_ID}:process?key=${API_CONFIG.GOOGLE_DOCUMENT_AI.API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    rawDocument: {
                        content: fileContent,
                        mimeType: file.type
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Document AI error: ${response.status}`);
            }

            const data = await response.json();
            return {
                text: data.document.text || '',
                structure: data.document.pages || [],
                confidence: data.document.entities?.[0]?.confidence || 0
            };

        } catch (error) {
            console.warn('Document AI processing failed, using fallback');
            return this._extractTextFallback(file);
        }
    },

    // Google Natural Language API Integration
    async _analyzeWithNaturalLanguage(text) {
        try {
            const response = await fetch(`${API_CONFIG.GOOGLE_NATURAL_LANGUAGE.BASE_URL}/documents:analyzeEntities?key=${API_CONFIG.GOOGLE_NATURAL_LANGUAGE.API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    document: {
                        content: text.substring(0, 10000), // Limit for API
                        type: 'PLAIN_TEXT'
                    },
                    features: {
                        extractSyntax: true,
                        extractEntities: true,
                        extractDocumentSentiment: true,
                        classifyText: true
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Natural Language API error: ${response.status}`);
            }

            const data = await response.json();
            return {
                entities: data.entities || [],
                sentiment: data.documentSentiment || { score: 0 },
                syntax: data.tokens || [],
                classification: data.categories || []
            };

        } catch (error) {
            console.warn('Natural Language analysis failed:', error);
            return { entities: [], sentiment: { score: 0 } };
        }
    },

    // Utility Methods
    async _fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = () => resolve(reader.result.split(',')[1]);
            reader.onerror = error => reject(error);
        });
    },

    async _extractTextFallback(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsText(file);
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
        });
    },

    _buildLegalPrompt(question, context) {
        return `As an expert in Indian law, please provide a comprehensive answer to this legal question:

Question: ${question}

Context: ${context}

Please include:
1. Relevant Indian laws and sections
2. Legal precedents if applicable
3. Practical implications
4. Step-by-step guidance
5. Important deadlines or procedures

Response:`;
    },

    _buildSummarizationPrompt(text, type, length, nlpAnalysis) {
        const typeInstructions = {
            'comprehensive': 'Provide a comprehensive summary covering all key aspects',
            'executive': 'Focus on executive-level insights and key decisions',
            'keypoints': 'Extract and list the most important key points',
            'timeline': 'Present events and decisions in chronological order'
        };

        const lengthInstructions = {
            'short': 'in 2-3 concise paragraphs',
            'medium': 'in 4-6 detailed paragraphs',
            'long': 'in a comprehensive analysis with multiple sections'
        };

        return `You are an expert legal document analyst specializing in Indian law. 
        Please analyze the following legal document and provide a ${type} summary ${lengthInstructions[length]}.

        ${typeInstructions[type]}

        ${nlpAnalysis ? `NLP Analysis Insights: ${nlpAnalysis}` : ''}

        Document to analyze:
        ${text.substring(0, 4000)}...

        Please structure your summary with:
        1. Document Type and Overview
        2. Key Legal Issues
        3. Important Parties Involved
        4. Critical Dates and Deadlines
        5. Legal Implications
        6. Actionable Items (if any)

        Summary:`;
    },

    _buildSearchPrompt(query, documentText) {
        return `You are an AI legal research assistant specializing in Indian law. 
        Based on the following document content, please perform a semantic search for: "${query}"

        Document content:
        ${documentText.substring(0, 3000)}...

        Please provide:
        1. Relevant sections that match the search query
        2. Legal concepts and terms related to the query
        3. Any applicable Indian laws or acts mentioned
        4. Case law references if any
        5. Practical implications
        6. Related legal concepts to explore

        Search Results:`;
    },

    _formatNLPAnalysis(nlpResult) {
        if (!nlpResult || !nlpResult.entities) return '';
        
        const entities = nlpResult.entities.slice(0, 10).map(e => `${e.name} (${e.type})`).join(', ');
        const sentiment = nlpResult.sentiment?.score || 0;
        
        return `Key entities detected: ${entities}. Document sentiment: ${sentiment > 0.1 ? 'positive' : sentiment < -0.1 ? 'negative' : 'neutral'}.`;
    },

    _combineSearchResults(results, query) {
        if (!results || results.length === 0) {
            return this._getFallbackSearchResults(query);
        }

        let combined = `**Enhanced Semantic Search Results for: "${query}"**\n\n`;
        
        results.forEach((result, index) => {
            combined += `### ${result.source} Analysis\n`;
            combined += `${result.results}\n\n`;
        });

        combined += `\n**Multi-AI Analysis Complete** ✅\n`;
        combined += `Used ${results.length} AI service(s) for comprehensive analysis.`;

        return combined;
    },

    // Enhanced Fallback Methods
    _getFallbackLegalResponse(question) {
        return `**Legal Question: "${question}"**

⚠️ *This is a demonstration response. Configure your AI services for full functionality.*

For comprehensive legal advice on this question, I recommend:

**Relevant Indian Legal Framework:**
- The Indian Constitution (Fundamental Rights & DPSP)
- Indian Contract Act, 1872
- Indian Penal Code, 1860
- Code of Civil Procedure, 1908
- Indian Evidence Act, 1872

**Recommended Actions:**
1. Consult with a qualified legal practitioner
2. Review relevant case law on legal databases
3. Check for recent amendments to applicable acts
4. Consider jurisdiction-specific variations

**Legal Resources:**
- Supreme Court of India judgments
- High Court decisions
- Legal databases (Manupatra, SCC Online)
- Bar Council of India guidelines

*For personalized legal advice, please consult with a licensed attorney.*`;
    },

    _getFallbackSummary(summaryType, summaryLength) {
        return `**Enhanced Document Summary (${summaryType} - ${summaryLength})**

⚠️ *This is a demonstration summary. Configure your AI services for intelligent analysis.*

**Multi-AI Analysis Available:**
With proper API configuration, this system provides:

✅ **Document Structure Analysis** (Google Document AI)
- OCR and text extraction
- Layout understanding
- Form field detection

✅ **Natural Language Processing** (Google Natural Language)
- Entity extraction
- Sentiment analysis
- Content classification

✅ **AI-Powered Summarization** (OpenAI/Gemini/Anthropic)
- Legal-specific insights
- Multi-perspective analysis
- Risk assessment

✅ **Specialized Legal Models** (Hugging Face)
- Legal entity recognition
- Contract analysis
- Clause extraction

**Setup Required:**
Configure your API keys to unlock all AI-powered features for comprehensive legal document analysis.`;
    },

    _getFallbackTranslation(text, sourceLang, targetLang) {
        const sampleTranslations = {
            'en-hi': 'यह एक उन्नत अनुवाद प्रणाली है। सभी AI सुविधाओं के लिए अपनी API keys कॉन्फ़िगर करें।',
            'en-ta': 'இது ஒரு மேம்பட்ட மொழிபெயர்ப்பு அமைப்பு. அனைத்து AI அம்சங்களுக்கும் உங்கள் API விசைகளை கட்டமைக்கவும்.',
            'en-bn': 'এটি একটি উন্নত অনুবাদ সিস্টেম। সমস্ত AI বৈশিষ্ট্যের জন্য আপনার API কীগুলি কনফিগার করুন।',
            'en-te': 'ఇది ఒక అధునాతన అనువాద వ్యవస్థ. అన్ని AI లక్షణాలకు మీ API కీలను కాన్ఫిగర్ చేయండి।',
            'en-mr': 'ही एक प्रगत भाषांतर प्रणाली आहे. सर्व AI वैशिष्ट्यांसाठी तुमच्या API की कॉन्फिगर करा.',
            'en-gu': 'આ એક અદ્યતન અનુવાદ સિસ્ટમ છે. બધી AI સુવિધાઓ માટે તમારી API કીઓ ગોઠવો.'
        };

        const langKey = `${sourceLang}-${targetLang}`;
        return sampleTranslations[langKey] || `**Enhanced Translation System**

Original text: ${text}

Configure Google Translate API for professional legal document translation with:
- Context-aware translation
- Legal terminology preservation
- Entity recognition
- Quality assurance

*Sample translation shown - configure APIs for full functionality.*`;
    },

    _getFallbackSearchResults(query) {
        return `**Multi-AI Semantic Search Results for: "${query}"**

⚠️ *Configure your AI services for comprehensive search capabilities.*

**Enhanced Search Features Available:**
🔍 **Google Natural Language API** - Entity and sentiment analysis
🤖 **Multiple AI Models** - OpenAI, Gemini, Anthropic, Hugging Face
📄 **Document AI** - Structure and content understanding
⚖️ **Legal Specialization** - Indian law expertise

**Sample Legal Database Results:**
1. **Indian Contract Act, 1872** - Sections related to your query
2. **Indian Penal Code, 1860** - Criminal law provisions
3. **Constitution of India** - Fundamental rights and duties
4. **Recent Case Law** - Supreme Court and High Court decisions

**Setup Instructions:**
Configure your API keys to unlock intelligent semantic search across multiple AI platforms for comprehensive legal research.`;
    },

    // Additional utility methods for specialized features
    async _extractLegalEntities(text) {
        // This would use Hugging Face NER models specialized for legal text
        return [];
    },

    async _summarizeWithHuggingFace(text, type) {
        // Specialized legal summarization with Hugging Face models
        return null;
    },

    async _searchWithNaturalLanguage(query, text) {
        // Use Google Natural Language for entity-based search
        return '';
    },

    async _searchLegalEntities(query, text) {
        // Search for legal entities and concepts
        return '';
    },

    _getFallbackDocumentProcessing(file) {
        return {
            originalFile: file,
            extractedText: 'Document processing requires API configuration.',
            entities: [],
            structure: {},
            ocrConfidence: 0,
            naturalLanguageAnalysis: {},
            legalEntities: []
        };
    }
};

// Initialize services on load
document.addEventListener('DOMContentLoaded', async function() {
    console.log('🚀 Initializing Enhanced Legal AI System...');
    
    if (typeof API_CONFIG !== 'undefined') {
        await legalAPIs.initializeServices();
        const isValid = validateAPIKeys();
        
        if (isValid) {
            console.log('✅ Multi-AI Legal System Ready!');
        } else {
            console.warn('⚠️ Some AI services not configured. Using available services and fallback modes.');
        }
    }
});

// Export for Node.js environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = legalAPIs;
}
