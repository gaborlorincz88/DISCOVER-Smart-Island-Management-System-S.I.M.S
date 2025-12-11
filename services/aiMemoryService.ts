import { ChatMessage } from '../types';

interface AIMemoryEntry {
  question: string;
  answers: string[]; // Multiple variations for believability
  timestamp: number;
  placeId: string;
}

interface AIMemoryData {
  placeId: string;
  placeName: string;
  entries: AIMemoryEntry[];
  lastUpdated: number;
}

class AIMemoryService {
  private memoryCache: Map<string, AIMemoryData> = new Map();
  private readonly MEMORY_DIR = '/backend/data/ai-memory/';

  /**
   * Load memory data for a specific place
   */
  async loadPlaceMemory(placeId: string): Promise<AIMemoryData | null> {
    // Check cache first
    if (this.memoryCache.has(placeId)) {
      return this.memoryCache.get(placeId)!;
    }

    try {
      const response = await fetch(`${this.MEMORY_DIR}${placeId}.json`);
      if (!response.ok) {
        return null; // No memory file exists yet
      }
      
      const data: AIMemoryData = await response.json();
      this.memoryCache.set(placeId, data);
      return data;
    } catch (error) {
      console.error('Error loading AI memory for place:', placeId, error);
      return null;
    }
  }

  /**
   * Save memory data for a specific place
   */
  async savePlaceMemory(placeId: string, placeName: string, entries: AIMemoryEntry[]): Promise<void> {
    const memoryData: AIMemoryData = {
      placeId,
      placeName,
      entries,
      lastUpdated: Date.now()
    };

    // Update cache
    this.memoryCache.set(placeId, memoryData);

    try {
      // In a real implementation, this would save to the backend
      // For now, we'll store in localStorage as a fallback
      localStorage.setItem(`ai_memory_${placeId}`, JSON.stringify(memoryData));
    } catch (error) {
      console.error('Error saving AI memory for place:', placeId, error);
    }
  }

  /**
   * Find a matching answer for a question
   */
  async findAnswer(placeId: string, question: string): Promise<string | null> {
    const memory = await this.loadPlaceMemory(placeId);
    if (!memory) return null;

    // Simple similarity matching (in production, you might want more sophisticated matching)
    const normalizedQuestion = question.toLowerCase().trim();
    
    for (const entry of memory.entries) {
      const normalizedEntryQuestion = entry.question.toLowerCase().trim();
      
      // Exact match
      if (normalizedEntryQuestion === normalizedQuestion) {
        return this.getRandomAnswer(entry.answers);
      }
      
      // Partial match (contains key words)
      const questionWords = normalizedQuestion.split(/\s+/);
      const entryWords = normalizedEntryQuestion.split(/\s+/);
      const commonWords = questionWords.filter(word => 
        word.length > 3 && entryWords.includes(word)
      );
      
      if (commonWords.length >= Math.min(2, questionWords.length / 2)) {
        return this.getRandomAnswer(entry.answers);
      }
    }

    return null;
  }

  /**
   * Add a new Q&A pair to memory
   */
  async addMemoryEntry(placeId: string, placeName: string, question: string, answer: string): Promise<void> {
    const memory = await this.loadPlaceMemory(placeId) || {
      placeId,
      placeName,
      entries: [],
      lastUpdated: Date.now()
    };

    // Check if question already exists
    const existingEntry = memory.entries.find(entry => 
      entry.question.toLowerCase().trim() === question.toLowerCase().trim()
    );

    if (existingEntry) {
      // Add answer variation if it's different
      if (!existingEntry.answers.includes(answer)) {
        existingEntry.answers.push(answer);
        // Keep only the last 3 variations to avoid too many
        if (existingEntry.answers.length > 3) {
          existingEntry.answers = existingEntry.answers.slice(-3);
        }
      }
    } else {
      // Create new entry
      const newEntry: AIMemoryEntry = {
        question: question.trim(),
        answers: [answer],
        timestamp: Date.now(),
        placeId
      };
      memory.entries.push(newEntry);
    }

    // Update last updated timestamp
    memory.lastUpdated = Date.now();

    await this.savePlaceMemory(placeId, placeName, memory.entries);
  }

  /**
   * Generate multiple answer variations for a given response
   */
  generateAnswerVariations(originalAnswer: string): string[] {
    const variations = [originalAnswer];
    
    // Simple variations by rephrasing common phrases
    const rephrases = [
      { from: /I can tell you that/, to: 'Let me share that' },
      { from: /This place is/, to: 'This location is' },
      { from: /You should know that/, to: 'It\'s worth noting that' },
      { from: /This is a/, to: 'This represents a' },
      { from: /The best time to visit is/, to: 'I\'d recommend visiting during' },
      { from: /It\'s located/, to: 'You\'ll find it' },
      { from: /The place offers/, to: 'Visitors can enjoy' },
      { from: /This makes it/, to: 'This creates' },
    ];

    // Generate 2-3 variations
    for (let i = 0; i < 2; i++) {
      let variation = originalAnswer;
      rephrases.forEach(({ from, to }) => {
        if (variation.includes(from.source)) {
          variation = variation.replace(from, to);
        }
      });
      
      if (variation !== originalAnswer && !variations.includes(variation)) {
        variations.push(variation);
      }
    }

    return variations.slice(0, 3); // Return max 3 variations
  }

  /**
   * Get a random answer from the available variations
   */
  private getRandomAnswer(answers: string[]): string {
    return answers[Math.floor(Math.random() * answers.length)];
  }

  /**
   * Clear memory for a specific place
   */
  async clearPlaceMemory(placeId: string): Promise<void> {
    this.memoryCache.delete(placeId);
    localStorage.removeItem(`ai_memory_${placeId}`);
  }

  /**
   * Get memory statistics
   */
  async getMemoryStats(): Promise<{ totalPlaces: number; totalEntries: number }> {
    const totalPlaces = this.memoryCache.size;
    let totalEntries = 0;
    
    for (const memory of this.memoryCache.values()) {
      totalEntries += memory.entries.length;
    }
    
    return { totalPlaces, totalEntries };
  }
}

export const aiMemoryService = new AIMemoryService();

