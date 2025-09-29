import { Connection, PublicKey } from "@solana/web3.js";
import express from "express";

const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=07ed88b0-3573-4c79-8d62-3a2cbd5c141a";
const connection = new Connection(RPC_ENDPOINT, { commitment: "confirmed" });
const TOKEN_MINT = new PublicKey("47TE3qRYoWdGFcvafubPLHPtNmhRQtcTWDUWkLw4oNy8");

const app = express();

// Cabal Ranks - Dark Theme
const CABAL_RANKS = [
    { name: "ACADEMY", min: 10000, max: 50000, reward: 0.01, color: "#00ff41", bg: "rgba(0, 255, 65, 0.1)" },
    { name: "CLAN", min: 50000, max: 100000, reward: 0.1, color: "#ff6b6b", bg: "rgba(255, 107, 107, 0.1)" },
    { name: "ROYAL GUARD I", min: 100000, max: 200000, reward: 0.2, color: "#ff00ff", bg: "rgba(255, 0, 255, 0.1)" },
    { name: "ROYAL GUARD II", min: 200000, max: 300000, reward: 0.3, color: "#ff4444", bg: "rgba(255, 68, 68, 0.1)" },
    { name: "KNIGHTS I", min: 300000, max: 400000, reward: 0.4, color: "#ffff00", bg: "rgba(255, 255, 0, 0.1)" },
    { name: "KNIGHTS II", min: 400000, max: 500000, reward: 0.5, color: "#00ffff", bg: "rgba(0, 255, 255, 0.1)" },
    { name: "KNIGHTS III", min: 500000, max: 600000, reward: 0.6, color: "#ffa500", bg: "rgba(255, 165, 0, 0.1)" },
    { name: "KNIGHTS IV", min: 600000, max: 1000000, reward: 0.7, color: "#ff0000", bg: "rgba(255, 0, 0, 0.1)" },
    { name: "THE CABAL", min: 1000000, max: Infinity, reward: 1.0, color: "#ffffff", bg: "linear-gradient(45deg, #000000, #ff0000)" }
];

let burnTracker = new Map();
let totalBurned = 0;
let scanStatus = "INITIALIZING_SYSTEM";
let lastUpdate = Date.now();
let payoutProgress = 45; // Example progress - you can update this dynamically

function getCabalRank(burned) {
    return CABAL_RANKS.find(rank => burned >= rank.min && burned < rank.max) || CABAL_RANKS[0];
}

// Rate limiting helper
async function rateLimitedCall(apiCall, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            return await apiCall();
        } catch (error) {
            if (error.message.includes('429') && attempt < retries) {
                const delay = Math.min(1000 * Math.pow(2, attempt), 5000);
                console.log(`⚠️ Rate limited, waiting ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }
}

app.get("/", (req, res) => {
    const topBurners = Array.from(burnTracker.entries())
        .map(([wallet, burned]) => ({ 
            wallet, 
            burned,
            rank: getCabalRank(burned)
        }))
        .filter(burner => burner.burned >= 10000)
        .sort((a, b) => b.burned - a.burned)
        .slice(0, 12); // Limit to top 12

    // Group burners by rank for display
    const cabalMembers = topBurners.filter(b => b.rank.name === "THE CABAL");
    const knightsMembers = topBurners.filter(b => b.rank.name.startsWith("KNIGHTS"));
    const royalGuardMembers = topBurners.filter(b => b.rank.name.startsWith("ROYAL GUARD"));
    const otherMembers = topBurners.filter(b => !["THE CABAL", "KNIGHTS", "ROYAL GUARD"].some(rank => b.rank.name.includes(rank)));

    res.setHeader("Content-Type", "text/html");
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>// THE CABAL //</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    background: #000000;
                    color: #00ff41;
                    font-family: 'Courier New', 'Monaco', monospace;
                    min-height: 100vh;
                    padding: 1rem;
                    overflow: hidden;
                    position: relative;
                }

                body::before {
                    content: '';
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: 
                        linear-gradient(90deg, transparent 95%, rgba(0, 255, 65, 0.03) 100%),
                        linear-gradient(0deg, transparent 95%, rgba(0, 255, 65, 0.03) 100%);
                    background-size: 20px 20px;
                    pointer-events: none;
                    z-index: -1;
                }

                .matrix-bg {
                    position: fixed;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(0,255,65,0.1) 100%);
                    opacity: 0.1;
                    z-index: -2;
                }

                .container {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    grid-template-rows: auto 1fr auto;
                    gap: 1rem;
                    height: 97vh;
                    max-width: 100%;
                }

                .header {
                    grid-column: 1 / -1;
                    background: rgba(0, 0, 0, 0.8);
                    border: 1px solid #00ff41;
                    padding: 1rem;
                    text-align: center;
                    box-shadow: 0 0 20px rgba(0, 255, 65, 0.3);
                    position: relative;
                    overflow: hidden;
                }

                .header::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 2px;
                    background: linear-gradient(90deg, transparent, #00ff41, transparent);
                    animation: scan 3s linear infinite;
                }

                @keyframes scan {
                    0% { left: -100%; }
                    100% { left: 100%; }
                }

                .title {
                    font-size: 2.5rem;
                    font-weight: bold;
                    color: #00ff41;
                    text-shadow: 0 0 10px #00ff41;
                    letter-spacing: 4px;
                    margin-bottom: 0.5rem;
                }

                .subtitle {
                    color: #ff6b6b;
                    font-size: 0.9rem;
                    letter-spacing: 2px;
                }

                .panel {
                    background: rgba(0, 0, 0, 0.9);
                    border: 1px solid #00ff41;
                    padding: 1rem;
                    overflow: hidden;
                    position: relative;
                    box-shadow: inset 0 0 20px rgba(0, 255, 65, 0.1);
                }

                .panel::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    height: 1px;
                    background: linear-gradient(90deg, transparent, #00ff41, transparent);
                }

                .panel-title {
                    color: #ff00ff;
                    font-size: 1rem;
                    font-weight: bold;
                    margin-bottom: 1rem;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                    border-bottom: 1px solid #ff00ff;
                    padding-bottom: 0.5rem;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem;
                    margin-bottom: 1rem;
                }

                .stat {
                    background: rgba(0, 255, 65, 0.05);
                    padding: 0.5rem;
                    border: 1px solid rgba(0, 255, 65, 0.3);
                }

                .stat-value {
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: #ffff00;
                    margin-bottom: 0.2rem;
                }

                .stat-label {
                    font-size: 0.7rem;
                    color: #00ff41;
                    text-transform: uppercase;
                }

                .members-grid {
                    display: grid;
                    grid-template-columns: 1fr;
                    gap: 0.5rem;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .member-item {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 0.5rem;
                    padding: 0.5rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid;
                    font-size: 0.8rem;
                    align-items: center;
                    transition: all 0.3s ease;
                    text-decoration: none;
                }

                .member-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateX(3px);
                    text-decoration: none;
                }

                .member-rank {
                    padding: 0.2rem 0.5rem;
                    font-size: 0.7rem;
                    font-weight: bold;
                    text-align: center;
                    min-width: 80px;
                }

                .member-wallet {
                    font-family: 'Courier New', monospace;
                    color: #00ffff;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .member-amount {
                    color: #ff6b6b;
                    font-weight: bold;
                    text-align: right;
                    min-width: 80px;
                }

                .payout-section {
                    display: flex;
                    flex-direction: column;
                    gap: 1rem;
                }

                .progress-container {
                    background: rgba(0, 255, 65, 0.05);
                    border: 1px solid #00ff41;
                    padding: 1rem;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 0.5rem;
                    font-size: 0.9rem;
                }

                .progress-bar {
                    width: 100%;
                    height: 20px;
                    background: rgba(0, 255, 65, 0.1);
                    border: 1px solid #00ff41;
                    position: relative;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #00ff41, #ffff00);
                    transition: width 0.5s ease;
                    position: relative;
                }

                .progress-fill::after {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent);
                    animation: shimmer 2s infinite;
                }

                @keyframes shimmer {
                    0% { transform: translateX(-100%); }
                    100% { transform: translateX(100%); }
                }

                .progress-text {
                    text-align: center;
                    font-size: 1.2rem;
                    font-weight: bold;
                    color: #ffff00;
                    margin-top: 0.5rem;
                }

                .payouts-list {
                    max-height: 200px;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 0.3rem;
                }

                .payout-item {
                    padding: 0.5rem;
                    background: rgba(255, 255, 0, 0.05);
                    border: 1px solid #ffff00;
                    font-size: 0.8rem;
                    display: flex;
                    justify-content: space-between;
                }

                .status-bar {
                    grid-column: 1 / -1;
                    background: rgba(0, 0, 0, 0.9);
                    border: 1px solid #00ff41;
                    padding: 0.5rem 1rem;
                    font-size: 0.8rem;
                    color: #ffff00;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .status-pulse {
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }

                /* Scrollbar */
                ::-webkit-scrollbar {
                    width: 6px;
                }

                ::-webkit-scrollbar-track {
                    background: rgba(0, 255, 65, 0.1);
                }

                ::-webkit-scrollbar-thumb {
                    background: #00ff41;
                    border-radius: 3px;
                }

                ::-webkit-scrollbar-thumb:hover {
                    background: #00cc33;
                }

                .glitch {
                    animation: glitch 5s infinite;
                }

                @keyframes glitch {
                    0% { text-shadow: 2px 2px #ff00ff, -2px -2px #00ffff; }
                    50% { text-shadow: -2px -2px #ff00ff, 2px 2px #00ffff; }
                    100% { text-shadow: 2px 2px #ff00ff, -2px -2px #00ffff; }
                }

                .empty-state {
                    text-align: center;
                    color: #666;
                    padding: 2rem;
                    font-size: 0.9rem;
                }
            </style>
        </head>
        <body>
            <div class="matrix-bg"></div>
            
            <div class="container">
                <!-- Header -->
                <div class="header">
                    <div class="title glitch">// THE CABAL //</div>
                    <div class="subtitle">ELITE BURNER RANKS // TOKEN INCINERATION PROTOCOL</div>
                </div>

                <!-- Panel 1: CABAL MEMBERS -->
                <div class="panel">
                    <div class="panel-title">THE CABAL</div>
                    <div class="members-grid">
                        ${cabalMembers.length > 0 ? cabalMembers.map((member, index) => `
                            <a href="https://solscan.io/account/${member.wallet}" target="_blank" class="member-item" style="border-color: ${member.rank.color}">
                                <div class="member-rank" style="background: ${member.rank.bg}; color: ${member.rank.color}">
                                    CABAL
                                </div>
                                <div class="member-wallet" title="${member.wallet}">
                                    ${member.wallet.substring(0, 6)}...${member.wallet.substring(member.wallet.length - 4)}
                                </div>
                                <div class="member-amount">${member.burned.toLocaleString()}</div>
                            </a>
                        `).join('') : `
                            <div class="empty-state">
                                NO CABAL MEMBERS<br>
                                <span style="color: #ff6b6b;">1M+ TOKENS REQUIRED</span>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Panel 2: PAYOUTS -->
                <div class="panel">
                    <div class="panel-title">PAYOUTS</div>
                    <div class="payout-section">
                        <div class="progress-container">
                            <div class="progress-header">
                                <span>PAYDAY PROGRESS</span>
                                <span>${payoutProgress}/10 SOL</span>
                            </div>
                            <div class="progress-bar">
                                <div class="progress-fill" style="width: ${payoutProgress * 10}%"></div>
                            </div>
                            <div class="progress-text">${payoutProgress * 10}% COMPLETE</div>
                        </div>
                        <div class="payouts-list">
                            <div class="payout-item">
                                <span>Next Payout:</span>
                                <span style="color: #ffff00">${10 - payoutProgress} SOL needed</span>
                            </div>
                            <div class="payout-item">
                                <span>Last Payout:</span>
                                <span style="color: #00ff41">--/--/----</span>
                            </div>
                            <div class="payout-item">
                                <span>Total Distributed:</span>
                                <span style="color: #00ff41">0 SOL</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Panel 3: OTHER MEMBERS -->
                <div class="panel">
                    <div class="panel-title">OTHER INITIATES</div>
                    <div class="members-grid">
                        ${otherMembers.length > 0 ? otherMembers.map((member, index) => `
                            <a href="https://solscan.io/account/${member.wallet}" target="_blank" class="member-item" style="border-color: ${member.rank.color}">
                                <div class="member-rank" style="background: ${member.rank.bg}; color: ${member.rank.color}">
                                    ${member.rank.name.split(' ')[0]}
                                </div>
                                <div class="member-wallet" title="${member.wallet}">
                                    ${member.wallet.substring(0, 6)}...${member.wallet.substring(member.wallet.length - 4)}
                                </div>
                                <div class="member-amount">${member.burned.toLocaleString()}</div>
                            </a>
                        `).join('') : `
                            <div class="empty-state">
                                NO OTHER INITIATES<br>
                                <span style="color: #ff6b6b;">10K+ TOKENS REQUIRED</span>
                            </div>
                        `}
                    </div>
                </div>

                <!-- Status Bar -->
                <div class="status-bar">
                    <div>STATUS: <span class="status-pulse">${scanStatus}</span></div>
                    <div>SYSTEM: <span style="color: #00ff41;">OPERATIONAL</span></div>
                    <div>PROTOCOL: <span style="color: #ff00ff;">BURN_TRACKER_V2</span></div>
                </div>
            </div>

            <script>
                // Auto-refresh every 15 seconds
                setTimeout(() => {
                    window.location.reload();
                }, 15000);
            </script>
        </body>
        </html>
    `);
});

// Optimized scanning with proper rate limiting
async function scanTokenBurns() {
    try {
        scanStatus = "SCANNING_TRANSACTIONS";
        console.log("🔍 Scanning token burn history...");
        
        // Use rate limiting for all RPC calls
        const signatures = await rateLimitedCall(() => 
            connection.getSignaturesForAddress(TOKEN_MINT, { limit: 500 })
        );

        let processed = 0;
        const batchSize = 5; // Smaller batches to avoid rate limits
        
        for (let i = 0; i < signatures.length; i += batchSize) {
            const batch = signatures.slice(i, i + batchSize);
            
            // Process with delays between batches
            for (const sig of batch) {
                if (processedSignatures.has(sig.signature)) {
                    processed++;
                    continue;
                }
                
                try {
                    const tx = await rateLimitedCall(() =>
                        connection.getTransaction(sig.signature, {
                            commitment: "confirmed",
                            maxSupportedTransactionVersion: 0
                        })
                    );
                    
                    if (tx?.meta) {
                        const burns = analyzeTransactionForBurns(tx, sig.signature);
                        for (const burn of burns) {
                            if (burn.amount >= 10000) {
                                const currentTotal = burnTracker.get(burn.wallet) || 0;
                                burnTracker.set(burn.wallet, currentTotal + burn.amount);
                                totalBurned += burn.amount;
                            }
                        }
                    }
                    
                    processedSignatures.add(sig.signature);
                } catch (e) {
                    console.log('Error processing tx:', e.message);
                }
                
                processed++;
            }
            
            // Longer delay between batches to avoid 429
            await new Promise(r => setTimeout(r, 1000));
            scanStatus = `PROCESSING: ${processed}/${signatures.length}`;
        }
        
        console.log(`✅ Scan complete. Found ${burnTracker.size} elite burners`);
        scanStatus = "SYNC_COMPLETE";
        lastUpdate = Date.now();
        
    } catch (e) {
        console.log('Scan error:', e.message);
        scanStatus = "ERROR: " + e.message;
    }
}

// Fast burn analysis
function analyzeTransactionForBurns(tx, signature) {
    const burns = [];
    
    if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
        return burns;
    }
    
    const preBalances = tx.meta.preTokenBalances;
    const postBalances = tx.meta.postTokenBalances;
    
    for (const preBalance of preBalances) {
        if (preBalance.mint === TOKEN_MINT.toBase58()) {
            const wallet = preBalance.owner;
            const preAmount = preBalance.uiTokenAmount?.uiAmount || 0;
            
            const postBalance = postBalances.find(pb => 
                pb.mint === TOKEN_MINT.toBase58() && pb.owner === wallet
            );
            const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;
            
            if (preAmount - postAmount >= 10000) {
                burns.push({
                    wallet: wallet,
                    amount: preAmount - postAmount,
                    signature: signature
                });
            }
        }
    }
    
    return burns;
}

const processedSignatures = new Set();

// Start scanner with longer intervals
async function startScanner() {
    await scanTokenBurns();
    
    // Longer intervals to avoid rate limits
    setInterval(async () => {
        console.log("🔄 Rescanning...");
        await scanTokenBurns();
    }, 10 * 60 * 1000); // 10 minutes
}

app.listen(1000, () => {
    console.log('🔥 THE CABAL active at http://localhost:1000');
    startScanner();
});
