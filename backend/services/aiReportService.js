const { GoogleGenerativeAI } = require('@google/generative-ai');
const db = require('../database');

/**
 * AI Report Service - Uses Google Gemini to analyze analytics data
 */
class AIReportService {
  constructor() {
    this.apiKey = null;
    this.model = 'gemini-2.5-flash';
    this.genAI = null;
  }

  /**
   * Initialize the service with API key
   */
  initialize(apiKey, model = 'gemini-2.5-flash') {
    if (!apiKey) {
      throw new Error('Google AI API key is required');
    }
    this.apiKey = apiKey;
    this.model = model || 'gemini-2.5-flash';
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  /**
   * Get API key from database
   */
  getApiKey() {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const result = stmt.get('google_ai_api_key');
      return result ? result.value : null;
    } catch (error) {
      console.error('Error getting API key:', error);
      return null;
    }
  }

  /**
   * Save API key to database
   */
  saveApiKey(apiKey) {
    try {
      // Ensure we're saving the full, trimmed key
      const trimmedKey = apiKey ? apiKey.trim() : '';
      
      if (!trimmedKey) {
        // Clearing the key
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO settings (key, value, updated_at) 
          VALUES (?, ?, datetime('now'))
        `);
        stmt.run('google_ai_api_key', '');
        this.apiKey = null;
        this.genAI = null;
        return true;
      }
      
      // Validate it looks like a valid key before saving
      if (!trimmedKey.startsWith('AIza') || trimmedKey.length < 30) {
        console.warn('API key format looks invalid, but saving anyway');
      }
      
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at) 
        VALUES (?, ?, datetime('now'))
      `);
      stmt.run('google_ai_api_key', trimmedKey);
      
      // Update instance variables
      this.apiKey = trimmedKey;
      this.genAI = new GoogleGenerativeAI(trimmedKey);
      
      console.log('API key saved successfully, length:', trimmedKey.length);
      return true;
    } catch (error) {
      console.error('Error saving API key:', error);
      return false;
    }
  }

  /**
   * Get model from database
   */
  getModel() {
    try {
      const stmt = db.prepare('SELECT value FROM settings WHERE key = ?');
      const result = stmt.get('google_ai_model');
      return result ? result.value : 'gemini-2.5-flash';
    } catch (error) {
      return 'gemini-2.5-flash';
    }
  }

  /**
   * Save model to database
   */
  saveModel(model) {
    try {
      const stmt = db.prepare(`
        INSERT OR REPLACE INTO settings (key, value, updated_at) 
        VALUES (?, ?, datetime('now'))
      `);
      stmt.run('google_ai_model', model);
      this.model = model;
      return true;
    } catch (error) {
      console.error('Error saving model:', error);
      return false;
    }
  }

  /**
   * Initialize from database settings
   */
  initializeFromDB() {
    const apiKey = this.getApiKey();
    const model = this.getModel();
    if (apiKey && apiKey.trim().length > 10) {
      // Only initialize if we have a valid-looking key
      try {
        this.initialize(apiKey.trim(), model);
        console.log('AI service initialized from database, key length:', apiKey.trim().length);
        return true;
      } catch (error) {
        console.error('Failed to initialize AI service:', error);
        return false;
      }
    }
    return false;
  }

  /**
   * Analyze analytics data and generate insights
   */
  async generateInsights(analyticsData, period = '30d') {
    if (!this.genAI) {
      // Try to initialize from DB
      if (!this.initializeFromDB()) {
        throw new Error('Google AI API key not configured. Please set it in the control panel.');
      }
    }

    try {
      // Ensure we're using a valid model, fallback to gemini-2.5-flash if needed
      const modelName = this.model || 'gemini-2.5-flash';
      const model = this.genAI.getGenerativeModel({ model: modelName });

      // Prepare data summary for AI
      const dataSummary = this.prepareDataSummary(analyticsData, period);

      const prompt = `You are an expert data analyst for a tourism ministry. Analyze the following analytics data and provide comprehensive insights.

ANALYTICS DATA:
${JSON.stringify(dataSummary, null, 2)}

Please provide a detailed analysis in the following JSON format:
{
  "executiveSummary": "A 2-3 paragraph executive summary highlighting key findings and overall trends",
  "keyInsights": [
    "Insight 1 about user engagement patterns",
    "Insight 2 about geographic distribution",
    "Insight 3 about device usage",
    "Insight 4 about popular destinations",
    "Insight 5 about search behavior"
  ],
  "trends": [
    "Trend 1 with specific data points",
    "Trend 2 with specific data points"
  ],
  "anomalies": [
    "Any unusual patterns or anomalies detected"
  ],
  "recommendations": [
    "Actionable recommendation 1 for the tourism ministry",
    "Actionable recommendation 2 for the tourism ministry",
    "Actionable recommendation 3 for the tourism ministry"
  ],
  "opportunities": [
    "Opportunity 1 for growth or improvement",
    "Opportunity 2 for growth or improvement"
  ]
}

Focus on actionable insights that can help the Ministry of Tourism make data-driven decisions. Be specific with numbers and percentages where relevant.`;

      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Try to parse JSON from response
      let insights;
      try {
        // Extract JSON from markdown code blocks if present
        const jsonMatch = text.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) {
          insights = JSON.parse(jsonMatch[1]);
        } else {
          insights = JSON.parse(text);
        }
      } catch (parseError) {
        // If JSON parsing fails, create structured response from text
        console.warn('Failed to parse AI response as JSON, using fallback:', parseError);
        insights = this.createFallbackInsights(text, analyticsData);
      }

      return insights;
    } catch (error) {
      console.error('Error generating AI insights:', error);
      // Return fallback insights
      return this.createFallbackInsights(null, analyticsData);
    }
  }

  /**
   * Prepare data summary for AI analysis
   */
  prepareDataSummary(analyticsData, period) {
    const summary = {
      period: period,
      sessionStats: analyticsData.sessionStats || {},
      topPlaces: analyticsData.topPlaces || [],
      topCategories: analyticsData.topCategories || [],
      deviceStats: analyticsData.deviceStats || [],
      hourlyStats: analyticsData.hourlyStats || [],
      dailyStats: analyticsData.dailyStats || [],
      searchAnalytics: analyticsData.searchAnalytics || [],
      economicActivity: analyticsData.economicActivity || [],
      heatmapData: {
        totalLocations: analyticsData.heatmapData?.length || 0,
        topLocations: analyticsData.heatmapData?.slice(0, 10) || []
      }
    };

    return summary;
  }

  /**
   * Create fallback insights if AI fails
   */
  createFallbackInsights(aiText, analyticsData) {
    const sessionStats = analyticsData.sessionStats || {};
    const topPlaces = analyticsData.topPlaces || [];
    const topCategories = analyticsData.topCategories || [];

    return {
      executiveSummary: aiText || `This ${analyticsData.period || '30-day'} analytics report shows ${sessionStats.total_sessions || 0} total sessions with ${sessionStats.unique_users || 0} unique users. The average session duration was ${Math.round(sessionStats.avg_session_duration || 0)} seconds.`,
      keyInsights: [
        `Total of ${sessionStats.total_sessions || 0} sessions recorded`,
        `${sessionStats.unique_users || 0} unique users engaged with the platform`,
        `Average session duration: ${Math.round(sessionStats.avg_session_duration || 0)} seconds`,
        topPlaces.length > 0 ? `Top destination: ${topPlaces[0]?.place_name || 'N/A'}` : 'No place data available',
        topCategories.length > 0 ? `Most popular category: ${topCategories[0]?.category || 'N/A'}` : 'No category data available'
      ],
      trends: [
        'User engagement patterns show consistent activity',
        'Geographic distribution reflects tourist interest areas'
      ],
      anomalies: [],
      recommendations: [
        'Continue monitoring user engagement metrics',
        'Focus marketing efforts on top-performing categories',
        'Consider expanding content for popular destinations'
      ],
      opportunities: [
        'Potential to increase engagement in underperforming categories',
        'Opportunity to enhance user experience based on device analytics'
      ]
    };
  }

  /**
   * Validate API key
   */
  async validateApiKey(apiKey) {
    try {
      if (!apiKey || !apiKey.trim()) {
        throw new Error('API key is empty');
      }
      
      // Basic format check - Gemini API keys usually start with AIza
      if (!apiKey.startsWith('AIza')) {
        throw new Error('Invalid API key format. Gemini API keys should start with "AIza"');
      }
      
      const testAI = new GoogleGenerativeAI(apiKey);
      // Use gemini-2.5-flash for validation as it's available and fast
      const model = testAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
      
      // Try a simple test request
      const result = await model.generateContent('Say "test"');
      const response = await result.response;
      const text = response.text();
      
      // If we get a response, the key is valid
      return true;
    } catch (error) {
      console.error('API key validation failed:', error);
      // Return more detailed error information
      if (error.message) {
        throw new Error(error.message);
      }
      throw new Error('Failed to validate API key: ' + error.toString());
    }
  }
}

// Export singleton instance
const aiReportService = new AIReportService();

module.exports = aiReportService;

