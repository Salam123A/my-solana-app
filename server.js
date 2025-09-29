import { Connection, PublicKey } from "@solana/web3.js";
import express from "express";

const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=07ed88b0-3573-4c79-8d62-3a2cbd5c141a";
const connection = new Connection(RPC_ENDPOINT, { commitment: "confirmed" });
const TOKEN_MINT = new PublicKey("47TE3qRYoWdGFcvafubPLHPtNmhRQtcTWDUWkLw4oNy8");

const app = express();

// Cabal Ranks
const CABAL_RANKS = [
    { name: "Academy", min: 10000, max: 50000, reward: 0.01, color: "#4a5568", bg: "rgba(74, 85, 104, 0.1)" },
    { name: "Clan", min: 50000, max: 100000, reward: 0.1, color: "#2d3748", bg: "rgba(45, 55, 72, 0.1)" },
    { name: "1st Royal Guard", min: 100000, max: 200000, reward: 0.2, color: "#2b6cb0", bg: "rgba(43, 108, 176, 0.1)" },
    { name: "2nd Royal Guard", min: 200000, max: 300000, reward: 0.3, color: "#2c5aa0", bg: "rgba(44, 90, 160, 0.1)" },
    { name: "1st Order of Knights", min: 300000, max: 400000, reward: 0.4, color: "#e53e3e", bg: "rgba(229, 62, 62, 0.1)" },
    { name: "2nd Order of Knights", min: 400000, max: 500000, reward: 0.5, color: "#c53030", bg: "rgba(197, 48, 48, 0.1)" },
    { name: "3rd Order of Knights", min: 500000, max: 600000, reward: 0.6, color: "#9b2c2c", bg: "rgba(155, 44, 44, 0.1)" },
    { name: "4th Order of Knights", min: 600000, max: 1000000, reward: 0.7, color: "#742a2a", bg: "rgba(116, 42, 42, 0.1)" },
    { name: "CABAL", min: 1000000, max: Infinity, reward: 1.0, color: "#000000", bg: "rgba(0, 0, 0, 0.2)" }
];

let burnTracker = new Map();
let totalBurned = 0;
let scanProgress = { current: 0, total: 0, status: "Initializing..." };
let lastUpdate = Date.now();

function getCabalRank(burned) {
    return CABAL_RANKS.find(rank => burned >= rank.min && burned < rank.max) || CABAL_RANKS[0];
}

function getProgressPercentage() {
    return scanProgress.total > 0 ? (scanProgress.current / scanProgress.total) * 100 : 0;
}

app.get("/", (req, res) => {
    const topBurners = Array.from(burnTracker.entries())
        .map(([wallet, burned]) => ({ 
            wallet, 
            burned,
            rank: getCabalRank(burned)
        }))
        .filter(burner => burner.burned >= 10000) // Only show 10k+ burned
        .sort((a, b) => b.burned - a.burned);

    const progressPercent = getProgressPercentage();
    
    res.setHeader("Content-Type", "text/html");
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>THE CABAL - Elite Burn Ranks</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                
                body {
                    background: linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #16213e 100%);
                    color: #e0e0e0;
                    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                    min-height: 100vh;
                    padding: 0;
                    overflow-x: hidden;
                }

                .container {
                    max-width: 98vw;
                    margin: 0 auto;
                    padding: 2rem;
                    display: grid;
                    grid-template-columns: 300px 1fr;
                    gap: 2rem;
                    min-height: 100vh;
                }

                .sidebar {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border-radius: 20px;
                    padding: 2rem;
                    border: 1px solid rgba(255, 215, 0, 0.1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                    height: fit-content;
                    position: sticky;
                    top: 2rem;
                }

                .main-content {
                    display: flex;
                    flex-direction: column;
                    gap: 2rem;
                }

                .header {
                    text-align: center;
                    padding: 2rem 0;
                    background: linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(255,215,0,0.05) 100%);
                    border-radius: 20px;
                    border: 1px solid rgba(255, 215, 0, 0.2);
                    margin-bottom: 0;
                }

                .cabal-title {
                    font-size: 3.5rem;
                    font-weight: 800;
                    background: linear-gradient(135deg, #FFD700 0%, #FFA500 100%);
                    -webkit-background-clip: text;
                    -webkit-text-fill-color: transparent;
                    background-clip: text;
                    text-shadow: 0 4px 8px rgba(255, 215, 0, 0.3);
                    letter-spacing: 3px;
                    margin-bottom: 1rem;
                }

                .stats-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 1rem;
                    margin: 1.5rem 0;
                }

                .stat-card {
                    background: rgba(255, 255, 255, 0.08);
                    padding: 1.5rem;
                    border-radius: 15px;
                    border: 1px solid rgba(255, 255, 255, 0.1);
                    text-align: center;
                }

                .stat-value {
                    font-size: 2rem;
                    font-weight: 700;
                    color: #FFD700;
                    margin-bottom: 0.5rem;
                }

                .stat-label {
                    font-size: 0.9rem;
                    color: #a0a0a0;
                    text-transform: uppercase;
                    letter-spacing: 1px;
                }

                .progress-section {
                    background: rgba(255, 255, 255, 0.05);
                    padding: 1.5rem;
                    border-radius: 15px;
                    border: 1px solid rgba(255, 215, 0, 0.2);
                    margin: 1rem 0;
                }

                .progress-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1rem;
                }

                .progress-bar {
                    width: 100%;
                    height: 12px;
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 10px;
                    overflow: hidden;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #FFD700, #FF6B6B);
                    border-radius: 10px;
                    transition: width 0.5s ease;
                    position: relative;
                }

                .progress-text {
                    font-size: 0.9rem;
                    color: #a0a0a0;
                    margin-top: 0.5rem;
                }

                .ranks-grid {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                    gap: 1.5rem;
                    margin-top: 1rem;
                }

                .rank-card {
                    background: rgba(255, 255, 255, 0.05);
                    border-radius: 15px;
                    padding: 1.5rem;
                    border: 1px solid;
                    transition: transform 0.3s ease, box-shadow 0.3s ease;
                }

                .rank-card:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
                }

                .rank-name {
                    font-size: 1.2rem;
                    font-weight: 700;
                    margin-bottom: 0.5rem;
                }

                .rank-range {
                    color: #a0a0a0;
                    font-size: 0.9rem;
                    margin-bottom: 0.5rem;
                }

                .rank-reward {
                    color: #FFD700;
                    font-weight: 600;
                    font-size: 1.1rem;
                }

                .burners-section {
                    background: rgba(255, 255, 255, 0.05);
                    backdrop-filter: blur(20px);
                    border-radius: 20px;
                    padding: 2rem;
                    border: 1px solid rgba(255, 215, 0, 0.1);
                    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
                }

                .section-title {
                    font-size: 1.8rem;
                    font-weight: 700;
                    color: #FFD700;
                    margin-bottom: 1.5rem;
                    text-align: center;
                    text-transform: uppercase;
                    letter-spacing: 2px;
                }

                .burners-grid {
                    display: grid;
                    gap: 1rem;
                    max-height: 70vh;
                    overflow-y: auto;
                    padding-right: 1rem;
                }

                .burner-card {
                    background: rgba(255, 255, 255, 0.08);
                    border-radius: 15px;
                    padding: 1.5rem;
                    border-left: 4px solid;
                    transition: all 0.3s ease;
                    display: grid;
                    grid-template-columns: auto 1fr auto;
                    gap: 1rem;
                    align-items: center;
                }

                .burner-card:hover {
                    background: rgba(255, 255, 255, 0.12);
                    transform: translateX(5px);
                }

                .rank-badge {
                    padding: 0.5rem 1rem;
                    border-radius: 20px;
                    font-size: 0.8rem;
                    font-weight: 700;
                    text-align: center;
                    min-width: 120px;
                }

                .wallet-info {
                    display: flex;
                    flex-direction: column;
                    gap: 0.25rem;
                }

                .wallet-address {
                    font-family: 'Courier New', monospace;
                    font-weight: 600;
                    color: #87ceeb;
                }

                .wallet-short {
                    font-size: 0.8rem;
                    color: #a0a0a0;
                }

                .burn-stats {
                    text-align: right;
                }

                .burn-amount {
                    font-size: 1.3rem;
                    font-weight: 800;
                    color: #ff6b6b;
                    margin-bottom: 0.25rem;
                }

                .fee-reward {
                    font-size: 0.9rem;
                    color: #FFD700;
                    font-weight: 600;
                }

                .last-update {
                    text-align: center;
                    color: #666;
                    font-size: 0.8rem;
                    margin-top: 1rem;
                    padding-top: 1rem;
                    border-top: 1px solid rgba(255, 255, 255, 0.1);
                }

                /* Scrollbar Styling */
                .burners-grid::-webkit-scrollbar {
                    width: 6px;
                }

                .burners-grid::-webkit-scrollbar-track {
                    background: rgba(255, 255, 255, 0.1);
                    border-radius: 3px;
                }

                .burners-grid::-webkit-scrollbar-thumb {
                    background: linear-gradient(135deg, #FFD700, #FF6B6B);
                    border-radius: 3px;
                }

                .burners-grid::-webkit-scrollbar-thumb:hover {
                    background: linear-gradient(135deg, #FFA500, #FF5252);
                }

                @media (max-width: 1400px) {
                    .container {
                        grid-template-columns: 1fr;
                    }
                    
                    .sidebar {
                        position: relative;
                        top: 0;
                    }
                    
                    .ranks-grid {
                        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
                    }
                }

                .loading-pulse {
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.7; }
                    100% { opacity: 1; }
                }
            </style>
        </head>
        <body>
            <div class="container">
                <!-- Sidebar -->
                <div class="sidebar">
                    <div class="header">
                        <div class="cabal-title">CABAL</div>
                        <div style="color: #a0a0a0; font-size: 1.1rem;">Elite Burn Ranks</div>
                    </div>

                    <div class="stats-grid">
                        <div class="stat-card">
                            <div class="stat-value">${burnTracker.size}</div>
                            <div class="stat-label">Elite Members</div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-value">${totalBurned.toLocaleString()}</div>
                            <div class="stat-label">Total Burned</div>
                        </div>
                    </div>

                    <div class="progress-section">
                        <div class="progress-header">
                            <div style="font-weight: 600; color: #FFD700;">Scan Progress</div>
                            <div style="font-size: 0.9rem; color: #a0a0a0;">${progressPercent.toFixed(1)}%</div>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercent}%"></div>
                        </div>
                        <div class="progress-text">${scanProgress.status}</div>
                    </div>

                    <div style="margin-top: 2rem;">
                        <h3 style="color: #FFD700; margin-bottom: 1rem; text-align: center;">RANK STRUCTURE</h3>
                        <div class="ranks-grid">
                            ${CABAL_RANKS.map(rank => `
                                <div class="rank-card" style="border-color: ${rank.color}; background: ${rank.bg}">
                                    <div class="rank-name" style="color: ${rank.color}">${rank.name}</div>
                                    <div class="rank-range">${rank.min.toLocaleString()}+ tokens</div>
                                    <div class="rank-reward">${rank.reward}% fees</div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Main Content -->
                <div class="main-content">
                    <div class="burners-section">
                        <div class="section-title">ELITE BURNERS (10K+ TOKENS)</div>
                        <div class="burners-grid">
                            ${topBurners.length > 0 ? topBurners.map((burner, index) => `
                                <div class="burner-card" style="border-color: ${burner.rank.color}">
                                    <div class="rank-badge" style="background: ${burner.rank.bg}; color: ${burner.rank.color}; border: 1px solid ${burner.rank.color}">
                                        ${burner.rank.name}
                                    </div>
                                    <div class="wallet-info">
                                        <div class="wallet-address">${burner.wallet}</div>
                                        <div class="wallet-short">${burner.wallet.substring(0, 8)}...${burner.wallet.substring(burner.wallet.length - 8)}</div>
                                    </div>
                                    <div class="burn-stats">
                                        <div class="burn-amount">${burner.burned.toLocaleString()}</div>
                                        <div class="fee-reward">${burner.rank.reward}% fees</div>
                                    </div>
                                </div>
                            `).join('') : `
                                <div style="text-align: center; padding: 3rem; color: #666;">
                                    <div style="font-size: 1.2rem; margin-bottom: 1rem;">No elite burners found yet</div>
                                    <div>Minimum 10,000 tokens burned required</div>
                                </div>
                            `}
                        </div>
                    </div>

                    <div class="last-update">
                        Last updated: ${new Date(lastUpdate).toLocaleString()} | 
                        <span class="loading-pulse">Live Updates Active</span>
                    </div>
                </div>
            </div>

            <script>
                // Auto-refresh every 10 seconds
                setInterval(() => {
                    window.location.reload();
                }, 10000);
            </script>
        </body>
        </html>
    `);
});

// Optimized batch scanning
async function scanTokenBurns() {
    try {
        console.log("🚀 Starting optimized burn scan...");
        scanProgress = { current: 0, total: 1000, status: "Fetching transactions..." };
        
        // Get signatures in larger batches
        const signatures = await connection.getSignaturesForAddress(TOKEN_MINT, { 
            limit: 1000,
            before: lastSignature 
        });
        
        scanProgress.total = signatures.length;
        scanProgress.status = "Analyzing transactions...";
        
        // Process in parallel batches
        const batchSize = 10;
        for (let i = 0; i < signatures.length; i += batchSize) {
            const batch = signatures.slice(i, i + batchSize);
            
            // Process batch in parallel
            await Promise.all(batch.map(async (sig, index) => {
                if (processedSignatures.has(sig.signature)) return;
                
                try {
                    const tx = await connection.getTransaction(sig.signature, {
                        commitment: "confirmed",
                        maxSupportedTransactionVersion: 0
                    });
                    
                    if (tx?.meta) {
                        const burns = analyzeTransactionForBurns(tx, sig.signature);
                        for (const burn of burns) {
                            if (burn.amount >= 10000) { // Only track 10k+ burns
                                const currentTotal = burnTracker.get(burn.wallet) || 0;
                                burnTracker.set(burn.wallet, currentTotal + burn.amount);
                                totalBurned += burn.amount;
                                console.log(`🔥 ${burn.wallet.substring(0, 8)}... burned ${burn.amount.toLocaleString()} tokens`);
                            }
                        }
                    }
                    
                    processedSignatures.add(sig.signature);
                } catch (e) {
                    console.log('Error processing tx:', e.message);
                }
            }));
            
            scanProgress.current = Math.min(i + batchSize, signatures.length);
            lastUpdate = Date.now();
            
            // Small delay between batches
            await new Promise(r => setTimeout(r, 50));
        }
        
        console.log(`✅ Scan complete. Found ${burnTracker.size} elite burners`);
        scanProgress.status = "Scan complete";
        
    } catch (e) {
        console.log('Scan error:', e.message);
        scanProgress.status = "Error: " + e.message;
    }
}

// Optimized burn analysis
function analyzeTransactionForBurns(tx, signature) {
    const burns = [];
    
    if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
        return burns;
    }
    
    const preBalances = tx.meta.preTokenBalances;
    const postBalances = tx.meta.postTokenBalances;
    
    // Quick analysis - only check significant burns
    for (const preBalance of preBalances) {
        if (preBalance.mint === TOKEN_MINT.toBase58()) {
            const wallet = preBalance.owner;
            const preAmount = preBalance.uiTokenAmount?.uiAmount || 0;
            
            const postBalance = postBalances.find(pb => 
                pb.mint === TOKEN_MINT.toBase58() && pb.owner === wallet
            );
            const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;
            
            // Only consider burns of 10k+ tokens
            if (preAmount - postAmount >= 10000) {
                const burnedAmount = preAmount - postAmount;
                
                // Quick transfer check
                const otherReceivers = postBalances
                    .filter(pb => pb.mint === TOKEN_MINT.toBase58() && pb.owner !== wallet)
                    .reduce((sum, pb) => sum + (pb.uiTokenAmount?.uiAmount || 0), 0);
                
                const otherSenders = preBalances
                    .filter(pb => pb.mint === TOKEN_MINT.toBase58() && pb.owner !== wallet)
                    .reduce((sum, pb) => sum + (pb.uiTokenAmount?.uiAmount || 0), 0);
                
                const netTransfer = otherReceivers - otherSenders;
                
                if (burnedAmount > netTransfer) {
                    burns.push({
                        wallet: wallet,
                        amount: burnedAmount - Math.max(0, netTransfer),
                        signature: signature
                    });
                }
            }
        }
    }
    
    return burns;
}

const processedSignatures = new Set();
let lastSignature = null;

// Fast scanning with progress tracking
async function startScanner() {
    await scanTokenBurns();
    
    // Faster rescan every 2 minutes
    setInterval(async () => {
        console.log("🔄 Fast rescanning...");
        await scanTokenBurns();
    }, 2 * 60 * 1000);
}

app.listen(1000, () => {
    console.log('🔥 ELITE CABAL burn scanner at http://localhost:1000');
    startScanner();
});
