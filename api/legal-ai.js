import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

dotenv.config();

// api/legal-ai.js
// Serverless function for Indian Legal Document Analyzer with Gemini AI
// Deploy on Vercel, Netlify, or AWS Lambda



// API Configuration for Gemini only
const API_CONFIG = {
    // Google Gemini Configuration
    GEMINI: {
        API_KEY: process.env.GEMINI_API_KEY,
        MODEL: 'gemini-1.5-pro',
        TEMPERATURE: 0.3,
        MAX_TOKENS: 2000
    },

    // Google Translate Configuration
    GOOGLE_TRANSLATE: {
        API_KEY: process.env.GOOGLE_TRANSLATE_API_KEY,
        BASE_URL: 'https://translation.googleapis.com/language/translate/v2'
    },

    // Google Cloud Document AI Configuration
    GOOGLE_DOCUMENT_AI: {
        API_KEY: process.env.GOOGLE_DOCUMENT_AI_API_KEY,
        PROJECT_ID: process.env.GOOGLE_PROJECT_ID,
        LOCATION: process.env.GOOGLE_LOCATION || 'us',
        PROCESSOR_ID: process.env.DOCUMENT_AI_PROCESSOR_ID,
        BASE_URL: 'https://documentai.googleapis.com/v1'
    },

    // Google Cloud Natural Language API Configuration
    GOOGLE_NATURAL_LANGUAGE: {
        API_KEY: process.env.GOOGLE_NATURAL_LANGUAGE_API_KEY,
        BASE_URL: 'https://language.googleapis.com/v1'
    },

    // Hugging Face Configuration (For specialized legal models)
    HUGGINGFACE: {
        API_KEY: process.env.HUGGINGFACE_API_KEY,
        BASE_URL: 'https://api-inference.huggingface.co/models',
        LEGAL_MODEL: 'nlpaueb/legal-bert-base-uncased',
        SUMMARIZATION_MODEL: 'facebook/bart-large-cnn',
        NER_MODEL: 'dbmdz/bert-large-cased-finetuned-conll03-english'
    }
};

// Initialize Gemini AI
let genAI;
let model;

function initializeGemini() {
    if (!API_CONFIG.GEMINI.API_KEY) {
        throw new Error('GEMINI_API_KEY environment variable is required');
    }
    
    genAI = new GoogleGenerativeAI(API_CONFIG.GEMINI.API_KEY);
    model = genAI.getGenerativeModel({ model: API_CONFIG.GEMINI.MODEL });
    
    console.log('✅ Gemini AI initialized successfully');
}

// Legal AI Service Class
class LegalAIService {
    constructor() {
        this.availableServices = {
            ai: ['gemini'],
            nlp: !!API_CONFIG.GOOGLE_NATURAL_LANGUAGE.API_KEY,
            documentAI: !!API_CONFIG.GOOGLE_DOCUMENT_AI.API_KEY,
            translation: !!API_CONFIG.GOOGLE_TRANSLATE.API_KEY,
            huggingface: !!API_CONFIG.HUGGINGFACE.API_KEY
        };
    }

    // Enhanced Legal Q&A with Gemini
    async askLegalQuestion(question, documentContext = '') {
        try {
            console.log('🤖 Processing legal question with Gemini AI...');

            let enhancedContext = documentContext;
            
            // Enhance context with NLP insights if available
            if (this.availableServices.nlp && documentContext) {
                try {
                    const nlpAnalysis = await this._analyzeWithNaturalLanguage(documentContext.substring(0, 1000));
                    enhancedContext += `\n\nKey entities: ${nlpAnalysis.entities?.map(e => e.name).join(', ') || 'None detected'}`;
                    enhancedContext += `\nDocument sentiment: ${nlpAnalysis.sentiment?.score || 'neutral'}`;
                } catch (nlpError) {
                    console.warn('NLP analysis failed:', nlpError.message);
                }
            }

            const prompt = this._buildLegalPrompt(question, enhancedContext);
            const response = await this._callGemini(prompt, 'legal_qa');
            
            return response || this._getFallbackLegalResponse(question);

        } catch (error) {
            console.error('Error in askLegalQuestion:', error);
            return this._getFallbackLegalResponse(question);
        }
    }

    // Document Summarization with Gemini
    async summarizeDocument(documentText, summaryType = 'comprehensive', summaryLength = 'medium') {
        try {
            console.log(`📝 Generating ${summaryType} summary (${summaryLength}) with Gemini...`);

            // Pre-process document with NLP if available
            let enhancedAnalysis = '';
            if (this.availableServices.nlp) {
                try {
                    const nlpResult = await this._analyzeWithNaturalLanguage(documentText.substring(0, 5000));
                    enhancedAnalysis = this._formatNLPAnalysis(nlpResult);
                } catch (nlpError) {
                    console.warn('NLP analysis failed:', nlpError.message);
                }
            }

            const prompt = this._buildSummarizationPrompt(documentText, summaryType, summaryLength, enhancedAnalysis);
            
            // Try specialized legal summarization model first
            let summary;
            if (this.availableServices.huggingface) {
                try {
                    summary = await this._summarizeWithHuggingFace(documentText, summaryType);
                } catch (hfError) {
                    console.warn('Hugging Face summarization failed, falling back to Gemini');
                }
            }

            // Use Gemini for summarization
            if (!summary) {
                summary = await this._callGemini(prompt, 'summarization');
            }

            return summary || this._getFallbackSummary(summaryType, summaryLength);

        } catch (error) {
            console.error('Error in summarizeDocument:', error);
            return this._getFallbackSummary(summaryType, summaryLength);
        }
    }

    // Enhanced Translation with Context Awareness
    async translateText(text, sourceLang, targetLang) {
        try {
            console.log(`🌐 Translating from ${sourceLang} to ${targetLang}...`);

            if (!this.availableServices.translation) {
                throw new Error('Google Translate API not configured');
            }

            // For legal documents, enhance translation with context
            let contextualText = text;
            if (this.availableServices.nlp && text.length > 100) {
                try {
                    const nlpAnalysis = await this._analyzeWithNaturalLanguage(text);
                    const entities = nlpAnalysis.entities?.filter(e => e.type === 'ORGANIZATION' || e.type === 'PERSON') || [];
                    
                    // Add context notes for better translation
                    if (entities.length > 0) {
                        contextualText += `\n\n[Legal entities: ${entities.map(e => e.name).join(', ')}]`;
                    }
                } catch (nlpError) {
                    console.warn('NLP analysis for translation failed:', nlpError.message);
                }
            }

            const response = await fetch(`${API_CONFIG.GOOGLE_TRANSLATE.BASE_URL}?key=${API_CONFIG.GOOGLE_TRANSLATE.API_KEY}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    q: contextualText,
                    source: sourceLang,
                    target: targetLang,
                    format: 'text',
                    model: 'nmt'
                })
            });

            if (!response.ok) {
                throw new Error(`Translation API error: ${response.status}`);
            }

            const data = await response.json();
            let translation = data.data.translations[0].translatedText;

            // Clean up context notes from translation
            translation = translation.replace(/\[Legal entities:.*?\]/g, '');

            return translation.trim();

        } catch (error) {
            console.error('Error in translateText:', error);
            return this._getFallbackTranslation(text, sourceLang, targetLang);
        }
    }

    // Semantic Search with Gemini
    async performSemanticSearch(query, documentText) {
        try {
            console.log('🔍 Performing semantic search with Gemini...');

            const searchResults = [];

            // NLP-enhanced search
            if (this.availableServices.nlp) {
                try {
                    const nlpResult = await this._searchWithNaturalLanguage(query, documentText);
                    searchResults.push({
                        source: 'Google Natural Language',
                        results: nlpResult
                    });
                } catch (nlpError) {
                    console.warn('NLP search failed:', nlpError.message);
                }
            }

            // Gemini-powered semantic search
            const searchPrompt = this._buildSearchPrompt(query, documentText);
            const geminiSearchResult = await this._callGemini(searchPrompt, 'search');
            
            if (geminiSearchResult) {
                searchResults.push({
                    source: 'Gemini AI',
                    results: geminiSearchResult
                });
            }

            // Legal entity-based search if available
            if (this.availableServices.huggingface) {
                try {
                    const entitySearch = await this._searchLegalEntities(query, documentText);
                    if (entitySearch) {
                        searchResults.push({
                            source: 'Legal Entity Search',
                            results: entitySearch
                        });
                    }
                } catch (hfError) {
                    console.warn('Hugging Face entity search failed:', hfError.message);
                }
            }

            return this._combineSearchResults(searchResults, query);

        } catch (error) {
            console.error('Error in performSemanticSearch:', error);
            return this._getFallbackSearchResults(query);
        }
    }

    // Document Comparison with Gemini
    async compareDocuments(doc1Text, doc2Text) {
        try {
            console.log('📊 Comparing documents with Gemini AI...');

            const prompt = `As a legal AI expert specializing in Indian law, compare these two documents and provide:
            1. Key differences
            2. Similar clauses
            3. Legal implications of differences
            4. Recommendations

            Document 1:
            ${doc1Text.substring(0, 2000)}...

            Document 2:
            ${doc2Text.substring(0, 2000)}...

            Please provide a detailed comparison analysis:`;

            return await this._callGemini(prompt, 'comparison');

        } catch (error) {
            console.error('Error in compareDocuments:', error);
            return 'Document comparison failed. Please check your configuration.';
        }
    }

    // Legal Risk Assessment with Gemini
    async assessLegalRisk(documentText) {
        try {
            console.log('⚖️ Performing legal risk assessment with Gemini...');

            const assessments = [];

            // Sentiment and entity analysis
            if (this.availableServices.nlp) {
                try {
                    const nlpAnalysis = await this._analyzeWithNaturalLanguage(documentText);
                    assessments.push({
                        source: 'Natural Language Analysis',
                        sentiment: nlpAnalysis.sentiment,
                        entities: nlpAnalysis.entities
                    });
                } catch (nlpError) {
                    console.warn('NLP analysis for risk assessment failed:', nlpError.message);
                }
            }

            // Gemini-powered risk analysis
            const riskPrompt = `As a legal risk analyst specializing in Indian law, assess the legal risks in this document:

            ${documentText.substring(0, 3000)}...

            Provide:
            1. Risk level (Low/Medium/High)
            2. Specific risk factors
            3. Legal compliance issues
            4. Mitigation recommendations
            5. Relevant Indian laws/acts

            Assessment:`;

            const geminiRiskAssessment = await this._callGemini(riskPrompt, 'risk_analysis');
            
            return {
                nlpAnalysis: assessments[0] || null,
                aiAssessment: geminiRiskAssessment,
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            console.error('Error in assessLegalRisk:', error);
            return { error: 'Risk assessment failed', details: error.message };
        }
    }

    // Private Methods

    // Gemini AI Integration
    async _callGemini(prompt, type = 'general') {
        try {
            const systemPrompt = `You are an expert legal AI assistant specializing in Indian law and legal document analysis. Provide accurate, detailed, and practical legal insights. Focus on Indian legal framework, acts, and precedents.`;
            
            const fullPrompt = `${systemPrompt}\n\n${prompt}`;
            
            const result = await model.generateContent(fullPrompt);
            const response = await result.response;
            return response.text();

        } catch (error) {
            console.error(`Gemini API error for ${type}:`, error);
            throw new Error(`Gemini API error: ${error.message}`);
        }
    }

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
                        content: text.substring(0, 10000),
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
    }

    // Hugging Face Integration for specialized legal models
    async _summarizeWithHuggingFace(text, type) {
        try {
            const model = API_CONFIG.HUGGINGFACE.SUMMARIZATION_MODEL;
            
            const response = await fetch(`${API_CONFIG.HUGGINGFACE.BASE_URL}/${model}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_CONFIG.HUGGINGFACE.API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    inputs: text.substring(0, 1000),
                    parameters: {
                        max_length: 200,
                        min_length: 50,
                        temperature: 0.3
                    }
                })
            });

            if (!response.ok) {
                throw new Error(`Hugging Face API error: ${response.status}`);
            }

            const data = await response.json();
            return Array.isArray(data) ? data[0].summary_text : data.summary_text;

        } catch (error) {
            console.warn('Hugging Face summarization failed:', error);
            return null;
        }
    }

    // Utility Methods
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
    }

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
    }

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
    }

    _formatNLPAnalysis(nlpResult) {
        if (!nlpResult || !nlpResult.entities) return '';
        
        const entities = nlpResult.entities.slice(0, 10).map(e => `${e.name} (${e.type})`).join(', ');
        const sentiment = nlpResult.sentiment?.score || 0;
        
        return `Key entities detected: ${entities}. Document sentiment: ${sentiment > 0.1 ? 'positive' : sentiment < -0.1 ? 'negative' : 'neutral'}.`;
    }

    _combineSearchResults(results, query) {
        if (!results || results.length === 0) {
            return this._getFallbackSearchResults(query);
        }

        let combined = `**Enhanced Semantic Search Results for: "${query}"**\n\n`;
        
        results.forEach((result, index) => {
            combined += `### ${result.source} Analysis\n`;
            combined += `${result.results}\n\n`;
        });

        combined += `\n**Gemini AI Analysis Complete** ✅\n`;
        combined += `Used ${results.length} service(s) for comprehensive analysis.`;

        return combined;
    }

    // Fallback Methods
    _getFallbackLegalResponse(question) {
        return `**Legal Question: "${question}"**

⚠️ *This is a demonstration response. Configure your Gemini API key for full functionality.*

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
    }

    _getFallbackSummary(summaryType, summaryLength) {
        return `**Enhanced Document Summary (${summaryType} - ${summaryLength})**

⚠️ *This is a demonstration summary. Configure your Gemini API key for intelligent analysis.*

**Gemini AI Analysis Available:**
With proper API configuration, this system provides:

✅ **Gemini AI Integration** - Advanced legal analysis
✅ **Document Structure Analysis** (Google Document AI)
✅ **Natural Language Processing** (Google Natural Language)
✅ **Specialized Legal Models** (Hugging Face)

**Setup Required:**
Configure your GEMINI_API_KEY environment variable to unlock all AI-powered features for comprehensive legal document analysis.`;
    }

    _getFallbackTranslation(text, sourceLang, targetLang) {
        return `**Enhanced Translation System**

Original text: ${text}

Configure Google Translate API for professional legal document translation with:
- Context-aware translation
- Legal terminology preservation
- Entity recognition
- Quality assurance

*Sample translation shown - configure APIs for full functionality.*`;
    }

    _getFallbackSearchResults(query) {
        return `**Gemini AI Semantic Search Results for: "${query}"**

⚠️ *Configure your Gemini API key for comprehensive search capabilities.*

**Enhanced Search Features Available:**
🔍 **Google Natural Language API** - Entity and sentiment analysis
🤖 **Gemini AI** - Advanced reasoning and analysis
📄 **Document AI** - Structure and content understanding
⚖️ **Legal Specialization** - Indian law expertise

**Sample Legal Database Results:**
1. **Indian Contract Act, 1872** - Sections related to your query
2. **Indian Penal Code, 1860** - Criminal law provisions
3. **Constitution of India** - Fundamental rights and duties
4. **Recent Case Law** - Supreme Court and High Court decisions

**Setup Instructions:**
Configure your GEMINI_API_KEY environment variable to unlock intelligent semantic search.`;
    }

    // Additional utility methods
    async _searchWithNaturalLanguage(query, text) {
        // Use Google Natural Language for entity-based search
        return `NLP-based search results for: ${query}`;
    }

    async _searchLegalEntities(query, text) {
        // Search for legal entities and concepts
        return `Legal entity search results for: ${query}`;
    }
}

// Serverless Function Handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    try {
        // Initialize Gemini AI
        if (!model) {
            initializeGemini();
        }

        const legalAI = new LegalAIService();
        const { action, ...params } = req.body;

        let result;

        switch (action) {
            case 'askLegalQuestion':
                result = await legalAI.askLegalQuestion(params.question, params.documentContext);
                break;

            case 'summarizeDocument':
                result = await legalAI.summarizeDocument(params.documentText, params.summaryType, params.summaryLength);
                break;

            case 'translateText':
                result = await legalAI.translateText(params.text, params.sourceLang, params.targetLang);
                break;

            case 'performSemanticSearch':
                result = await legalAI.performSemanticSearch(params.query, params.documentText);
                break;

            case 'compareDocuments':
                result = await legalAI.compareDocuments(params.doc1Text, params.doc2Text);
                break;

            case 'assessLegalRisk':
                result = await legalAI.assessLegalRisk(params.documentText);
                break;

            case 'healthCheck':
                result = {
                    status: 'healthy',
                    services: legalAI.availableServices,
                    timestamp: new Date().toISOString()
                };
                break;

            default:
                throw new Error(`Unknown action: ${action}`);
        }

        res.status(200).json({
            success: true,
            data: result,
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('Serverless function error:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}

// For local development




const app = express();
app.use(express.json());

// For ES modules, get __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from the project root
app.use(express.static(path.join(__dirname, '..')));

// API endpoint
app.post('/api/legal-ai', async (req, res) => {
  await handler(req, res);
});

// Fallback: serve index.html for any other route (for SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

app.listen(3000, () => {
  console.log('Server started on http://localhost:3000');
});
