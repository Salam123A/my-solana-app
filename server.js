import { Connection, PublicKey } from "@solana/web3.js";
import express from "express";

const RPC_ENDPOINT = "https://mainnet.helius-rpc.com/?api-key=07ed88b0-3573-4c79-8d62-3a2cbd5c141a";
const connection = new Connection(RPC_ENDPOINT, { commitment: "confirmed" });
const TOKEN_MINT = new PublicKey("47TE3qRYoWdGFcvafubPLHPtNmhRQtcTWDUWkLw4oNy8");

const app = express();

// Cabal Ranks
const CABAL_RANKS = [
    { name: "Academy", min: 100000, max: 500000, reward: 0.01, color: "#4a5568" },
    { name: "Clan", min: 500000, max: 1000000, reward: 0.1, color: "#2d3748" },
    { name: "1st Royal Guard", min: 1000000, max: 2000000, reward: 0.2, color: "#2b6cb0" },
    { name: "2nd Royal Guard", min: 2000000, max: 3000000, reward: 0.3, color: "#2c5aa0" },
    { name: "1st Order of Knights", min: 3000000, max: 4000000, reward: 0.4, color: "#e53e3e" },
    { name: "2nd Order of Knights", min: 4000000, max: 5000000, reward: 0.5, color: "#c53030" },
    { name: "3rd Order of Knights", min: 5000000, max: 6000000, reward: 0.6, color: "#9b2c2c" },
    { name: "4th Order of Knights", min: 6000000, max: 10000000, reward: 0.7, color: "#742a2a" },
    { name: "CABAL", min: 1000000, max: Infinity, reward: 1.0, color: "#000000" }
];

let burnTracker = new Map();
let totalBurned = 0;

function getCabalRank(burned) {
    return CABAL_RANKS.find(rank => burned >= rank.min && burned < rank.max) || CABAL_RANKS[0];
}

app.get("/", (req, res) => {
    const topBurners = Array.from(burnTracker.entries())
        .map(([wallet, burned]) => ({ 
            wallet, 
            burned,
            rank: getCabalRank(burned)
        }))
        .sort((a, b) => b.burned - a.burned);

    res.setHeader("Content-Type", "text/html");
    res.end(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>THE CABAL - Burn Ranks</title>
            <style>
                body { 
                    background: #0a0a0a; 
                    color: #c0c0c0; 
                    font-family: 'Georgia', serif;
                    padding: 20px;
                }
                .header { 
                    text-align: center; 
                    border-bottom: 2px solid gold; 
                    padding-bottom: 20px;
                    margin-bottom: 30px;
                }
                .cabal-title {
                    font-size: 3em;
                    color: gold;
                    text-shadow: 2px 2px 4px #000;
                    letter-spacing: 8px;
                }
                .total-burned {
                    font-size: 1.2em;
                    color: #ff6b6b;
                    margin: 20px 0;
                }
                .burner {
                    margin: 15px 0;
                    padding: 15px;
                    border-radius: 5px;
                    border-left: 5px solid;
                    background: rgba(255,255,255,0.05);
                }
                .rank-badge {
                    background: #333;
                    padding: 4px 12px;
                    border-radius: 15px;
                    font-size: 0.8em;
                    margin-right: 10px;
                    border: 1px solid;
                }
                .wallet {
                    color: #87ceeb;
                    font-weight: bold;
                }
                .amount {
                    color: #ff6b6b;
                    font-weight: bold;
                    float: right;
                }
                .reward {
                    color: gold;
                    font-size: 0.9em;
                    margin-left: 10px;
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="cabal-title">THE CABAL</div>
                <div class="total-burned">Total Burned: ${totalBurned.toLocaleString()} tokens</div>
            </div>

            <h3 style="color: gold;">ORGANIZATIONAL RANKS</h3>
            ${topBurners.map((burner, index) => `
                <div class="burner" style="border-color: ${burner.rank.color}">
                    <span class="rank-badge" style="border-color: ${burner.rank.color}; color: ${burner.rank.color}">
                        ${burner.rank.name}
                    </span>
                    <span class="wallet">${burner.wallet}</span>
                    <span class="amount">${burner.burned.toLocaleString()} burned</span>
                    <span class="reward">${burner.rank.reward}% fees</span>
                </div>
            `).join('')}
        </body>
        </html>
    `);
});

// Scan token history for burn transactions
async function scanTokenBurns() {
    try {
        console.log("🔍 Scanning token burn history...");
        
        // Get all signatures for this token mint
        const signatures = await connection.getSignaturesForAddress(TOKEN_MINT, { limit: 1000 });
        
        for (const sig of signatures) {
            if (processedSignatures.has(sig.signature)) continue;
            
            try {
                const tx = await connection.getTransaction(sig.signature, {
                    commitment: "confirmed",
                    maxSupportedTransactionVersion: 0
                });
                
                if (!tx?.meta) continue;
                
                // Analyze transaction for burns
                const burns = analyzeTransactionForBurns(tx, sig.signature);
                
                for (const burn of burns) {
                    const currentTotal = burnTracker.get(burn.wallet) || 0;
                    burnTracker.set(burn.wallet, currentTotal + burn.amount);
                    totalBurned += burn.amount;
                    
                    console.log(`🔥 ${burn.wallet} burned ${burn.amount} tokens`);
                }
                
                processedSignatures.add(sig.signature);
            } catch (e) {
                console.log('Error processing tx:', e.message);
            }
            
            // Small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 100));
        }
        
        console.log(`✅ Scan complete. Found ${burnTracker.size} burners`);
        
    } catch (e) {
        console.log('Scan error:', e.message);
    }
}

// Analyze transaction to find burns
function analyzeTransactionForBurns(tx, signature) {
    const burns = [];
    
    if (!tx.meta?.preTokenBalances || !tx.meta?.postTokenBalances) {
        return burns;
    }
    
    const preBalances = tx.meta.preTokenBalances;
    const postBalances = tx.meta.postTokenBalances;
    
    // Find wallets that held this token before but not after (burned)
    for (const preBalance of preBalances) {
        if (preBalance.mint === TOKEN_MINT.toBase58()) {
            const wallet = preBalance.owner;
            const preAmount = preBalance.uiTokenAmount?.uiAmount || 0;
            
            // Find post balance for this wallet
            const postBalance = postBalances.find(pb => 
                pb.mint === TOKEN_MINT.toBase58() && pb.owner === wallet
            );
            const postAmount = postBalance?.uiTokenAmount?.uiAmount || 0;
            
            // If tokens decreased and weren't sent to another holder, it's a burn
            if (preAmount > postAmount) {
                const burnedAmount = preAmount - postAmount;
                
                // Verify this isn't just a transfer by checking if tokens went to another wallet
                const tokensReceivedByOthers = postBalances
                    .filter(pb => pb.mint === TOKEN_MINT.toBase58() && pb.owner !== wallet)
                    .reduce((sum, pb) => sum + (pb.uiTokenAmount?.uiAmount || 0), 0);
                
                const tokensBeforeOthers = preBalances
                    .filter(pb => pb.mint === TOKEN_MINT.toBase58() && pb.owner !== wallet)
                    .reduce((sum, pb) => sum + (pb.uiTokenAmount?.uiAmount || 0), 0);
                
                const netTransfer = tokensReceivedByOthers - tokensBeforeOthers;
                
                // If the burned amount isn't accounted for by transfers, it's a burn
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

// Initial scan and periodic rescan
async function startScanner() {
    await scanTokenBurns();
    
    // Rescan every 5 minutes
    setInterval(async () => {
        console.log("🔄 Rescanning for new burns...");
        await scanTokenBurns();
    }, 1 * 10 * 1000);
}

app.listen(1000, () => {
    console.log('🔥 CABAL burn scanner at http://localhost:1000');
    startScanner();
});
