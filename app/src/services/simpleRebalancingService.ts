import { APYService, Protocol } from './apyService';

export interface RebalanceEvent {
    timestamp: Date;
    fromProtocol: string;
    toProtocol: string;
    amount: number;
    newAPY: number;
    reason: string;
}

export class SimpleRebalancingService {
    private static currentProtocol: Protocol | null = null;
    private static userBalance = 0;

    static async checkAndRebalance(balance: number): Promise<RebalanceEvent | null> {
        this.userBalance = balance;

        const bestProtocol = await APYService.getBestProtocol();

        // Check if we need to rebalance (protocol changed)
        if (!this.currentProtocol || this.currentProtocol.name !== bestProtocol.name) {
            const event: RebalanceEvent = {
                timestamp: new Date(),
                fromProtocol: this.currentProtocol?.name || 'Vault',
                toProtocol: bestProtocol.name,
                amount: balance,
                newAPY: bestProtocol.apy,
                reason: this.currentProtocol ? 'Better yield found' : 'Initial allocation'
            };

            this.currentProtocol = bestProtocol;
            this.logRebalanceEvent(event);

            return event;
        }

        return null;
    }

    static getCurrentProtocol(): Protocol | null {
        return this.currentProtocol;
    }

    static getRebalanceHistory(): RebalanceEvent[] {
        const history = localStorage.getItem('rebalanceHistory');
        return history ? JSON.parse(history) : [];
    }

    private static logRebalanceEvent(event: RebalanceEvent) {
        const history = this.getRebalanceHistory();
        history.unshift(event);
        localStorage.setItem('rebalanceHistory', JSON.stringify(history.slice(0, 10)));

        console.log(`🔄 Rebalanced: ${event.amount} USDC → ${event.toProtocol} (${event.newAPY.toFixed(2)}% APY)`);
    }

    static startAutoRebalancing(balance: number) {
        // Initial check
        this.checkAndRebalance(balance);

        // Check every 5 minutes for demo (would be 24h in production)
        setInterval(() => {
            this.checkAndRebalance(balance);
        }, 5 * 60 * 1000);
    }
}