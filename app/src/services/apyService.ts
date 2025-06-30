export interface Protocol {
    name: string;
    apy: number;
    emoji: string;
    risk: string;
}

export class APYService {
    private static protocols: Protocol[] = [
        { name: 'Kamino Finance', apy: 8.4, emoji: '🏦', risk: 'Low' },
        { name: 'MarginFi', apy: 7.8, emoji: '📊', risk: 'Low' },
        { name: 'Drift Protocol', apy: 9.2, emoji: '🌊', risk: 'Medium' },
        { name: 'Jupiter JLP', apy: 11.6, emoji: '🪐', risk: 'Medium' }
    ];

    private static currentBest: Protocol | null = null;

    static async getBestProtocol(): Promise<Protocol> {
        // Rotate through protocols every 3 minutes for demo
        const currentIndex = Math.floor(Date.now() / 180000) % this.protocols.length;
        const selected = { ...this.protocols[currentIndex] };
        
        // Add small realistic fluctuation
        selected.apy += (Math.random() - 0.5) * 0.8; // ±0.4%
        
        // Store for rebalancing check
        this.currentBest = selected;
        return selected;
    }

    static getAllProtocols(): Protocol[] {
        return this.protocols.map(p => ({
            ...p,
            apy: p.apy + (Math.random() - 0.5) * 0.6
        }));
    }

    static getCurrentBest(): Protocol | null {
        return this.currentBest;
    }
}