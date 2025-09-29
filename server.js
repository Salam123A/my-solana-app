import { Connection, PublicKey } from "@solana/web3.js";
import express from "express";

const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=07ed88b0-3573-4c79-8d62-3a2cbd5c141a";
const connection = new Connection(RPC_ENDPOINT, { commitment: "confirmed" });
const TOKEN_MINT = new PublicKey("47TE3qRYoWdGFcvafubPLHPtNmhRQtcTWDUWkLw4oNy8");

const app = express();

// Cabal Ranks
const CABAL_RANKS = [
    { name: "Academy", min: 10000, max: 50000, reward: 0.01, color: "#4a5568" },
    { name: "Clan", min: 50000, max: 100000, reward: 0.1, color: "#2d3748" },
    { name: "1st Royal Guard", min: 100000, max: 200000, reward: 0.2, color: "#2b6cb0" },
    { name: "2nd Royal Guard", min: 200000, max: 300000, reward: 0.3, color: "#2c5aa0" },
    { name: "1st Order of Knights", min: 300000, max: 400000, reward: 0.4, color: "#e53e3e" },
    { name: "2nd Order of Knights", min: 400000, max: 500000, reward: 0.5, color: "#c53030" },
    { name: "3rd Order of Knights", min: 500000, max: 600000, reward: 0.6, color: "#9b2c2c" },
    { name: "4th Order of Knights", min: 600000, max: 1000000, reward: 0.7, color: "#742a2a" },
    { name: "CABAL", min: 1000000, max: Infinity, reward: 1.0, color: "#000000" }
];

let burnTracker = new Map();
let totalBurned = 0;
let scanStatus = "INITIALIZING_SYSTEM";
let lastUpdate = Date.now();

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
        .slice(0, 15); // Limit to top 15

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
                    grid-template-rows: auto 1fr;
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

                .ranks-container {
                    display: flex;
                    flex-direction: column;
                    gap: 0.3rem;
                    max-height: 300px;
                    overflow-y: auto;
                }

                .rank-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 0.4rem;
                    border: 1px solid;
                    font-size: 0.8rem;
                    transition: all 0.3s ease;
                }

                .rank-item:hover {
                    transform: translateX(5px);
                    box-shadow: 0 0 10px currentColor;
                }

                .rank-name {
                    font-weight: bold;
                }

                .rank-reward {
                    color: #ffff00;
                    font-weight: bold;
                }

                .burners-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                    max-height: 400px;
                    overflow-y: auto;
                }

                .burner-item {
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 0.5rem;
                    padding: 0.5rem;
                    background: rgba(255, 255, 255, 0.05);
                    border: 1px solid;
                    font-size: 0.8rem;
                    align-items: center;
                    transition: all 0.3s ease;
                }

                .burner-item:hover {
                    background: rgba(255, 255, 255, 0.1);
                    transform: translateX(3px);
                }

                .burner-rank {
                    padding: 0.2rem 0.5rem;
                    font-size: 0.7rem;
                    font-weight: bold;
                    text-align: center;
                    min-width: 80px;
                }

                .burner-wallet {
                    font-family: 'Courier New', monospace;
                    color: #00ffff;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }

                .burner-amount {
                    color: #ff6b6b;
                    font-weight: bold;
                    text-align: right;
                    min-width: 80px;
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

                <!-- Panel 1: Stats -->
                <div class="panel">
                    <div class="panel-title">SYSTEM OVERVIEW</div>
                    <div class="stats-grid">
                        <div class="stat">
                            <div class="stat-value">${burnTracker.size}</div>
                            <div class="stat-label">INITIATES</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${totalBurned.toLocaleString()}</div>
                            <div class="stat-label">TOKENS BURNED</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${CABAL_RANKS.length}</div>
                            <div class="stat-label">RANKS</div>
                        </div>
                        <div class="stat">
                            <div class="stat-value">${topBurners.filter(b => b.rank.name === 'THE CABAL').length}</div>
                            <div class="stat-label">CABAL MEMBERS</div>
                        </div>
                    </div>
                    <div style="margin-top: 1rem; color: #ff00ff; font-size: 0.8rem;">
                        <div>MINIMUM ENTRY: 10,000 TOKENS</div>
                        <div>LAST UPDATE: ${new Date(lastUpdate).toLocaleTimeString()}</div>
                    </div>
                </div>

                <!-- Panel 2: Ranks -->
                <div class="panel">
                    <div class="panel-title">RANK STRUCTURE</div>
                    <div class="ranks-container">
                        ${CABAL_RANKS.map(rank => `
                            <div class="rank-item" style="border-color: ${rank.color}; color: ${rank.color}">
                                <span class="rank-name">${rank.name}</span>
                                <span class="rank-reward">${rank.reward}%</span>
                            </div>
                        `).join('')}
                    </div>
                </div>

                <!-- Panel 3: Top Burners -->
                <div class="panel">
                    <div class="panel-title">ELITE BURNERS</div>
                    <div class="burners-list">
                        ${topBurners.length > 0 ? topBurners.map((burner, index) => `
                            <div class="burner-item" style="border-color: ${burner.rank.color}">
                                <div class="burner-rank" style="background: ${burner.rank.bg}; color: ${burner.rank.color}">
                                    ${burner.rank.name.split(' ')[0]}
                                </div>
                                <div class="burner-wallet" title="${burner.wallet}">
                                    ${burner.wallet.substring(0, 6)}...${burner.wallet.substring(burner.wallet.length - 4)}
                                </div>
                                <div class="burner-amount">${burner.burned.toLocaleString()}</div>
                            </div>
                        `).join('') : `
                            <div style="text-align: center; color: #666; padding: 2rem; font-size: 0.9rem;">
                                NO ELITE BURNERS DETECTED<br>
                                <span style="color: #ff6b6b;">MINIMUM 10K TOKENS REQUIRED</span>
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
